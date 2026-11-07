"""Signed model releases (training/release.py). Uses a throwaway key and folder, never the real ones."""
import base64
import hashlib
import json

import pytest
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey

from training import release


@pytest.fixture
def published(tmp_path):
    source = tmp_path / "model.json"
    source.write_text(json.dumps({"version": "2.1.0", "labels": ["a"], "intercepts": [0], "weights": {}}), encoding="utf-8")
    key = Ed25519PrivateKey.generate()
    releases = [{"id": "test-model", "source": source, "minAppVersion": "0.1.0", "rollout": 0.5, "notes": "test"}]
    manifest = release.build_manifest(key, releases=releases, out_dir=tmp_path / "models", published="2026-10-26T00:00:00Z")
    return key, manifest, tmp_path, source


def test_manifest_is_signed_over_the_exact_payload(published):
    key, manifest, out, _ = published
    public = key.public_key()
    public.verify(base64.b64decode(manifest["signature"]), manifest["payload"].encode("utf-8"))
    with pytest.raises(InvalidSignature):
        public.verify(base64.b64decode(manifest["signature"]), manifest["payload"].replace("0.5", "1.0").encode("utf-8"))
    assert json.loads((out / "models" / "manifest.json").read_text(encoding="utf-8")) == manifest


def test_files_are_copied_with_their_hashes(published):
    _, manifest, out, source = published
    [model] = json.loads(manifest["payload"])["models"]
    assert model["id"] == "test-model" and model["version"] == "2.1.0" and model["rollout"] == 0.5 and model["disabled"] is False
    [entry] = model["files"]
    copied = (out / "models" / entry["path"]).read_bytes()
    assert copied == source.read_bytes()
    assert entry["sha256"] == hashlib.sha256(copied).hexdigest() and entry["bytes"] == len(copied)


def test_public_key_file_matches_the_signing_key(tmp_path):
    key = Ed25519PrivateKey.generate()
    out = tmp_path / "publicKey.json"
    public = release.write_public_key(key, out)
    stored = json.loads(out.read_text(encoding="utf-8"))
    assert stored["algorithm"] == "Ed25519" and stored["key"] == public and stored["keyId"] == release.key_id(public)
    Ed25519PublicKey.from_public_bytes(base64.b64decode(public))


def test_generate_key_never_overwrites(tmp_path):
    path = tmp_path / "key.pem"
    release.generate_key(path)
    with pytest.raises(SystemExit):
        release.generate_key(path)


def test_published_manifest_in_the_app_is_valid():
    manifest = json.loads((release.PUBLIC_MODELS / "manifest.json").read_text(encoding="utf-8"))
    public = json.loads(release.PUBLIC_KEY_OUT.read_text(encoding="utf-8"))
    assert manifest["keyId"] == public["keyId"]
    Ed25519PublicKey.from_public_bytes(base64.b64decode(public["key"])).verify(
        base64.b64decode(manifest["signature"]), manifest["payload"].encode("utf-8")
    )
    for model in json.loads(manifest["payload"])["models"]:
        for entry in model["files"]:
            data = (release.PUBLIC_MODELS / entry["path"]).read_bytes()
            assert hashlib.sha256(data).hexdigest() == entry["sha256"], entry["path"]
