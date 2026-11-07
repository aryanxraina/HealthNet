"""Publishes HealthNet's on-device models with a signed manifest (R3 in docs/on-device-model-roadmap.md).

    python -m training.release --generate-key   # once: makes the signing key, prints the public key
    python -m training.release                  # after training: copies models and signs the manifest

The app downloads healthnet-frontend/public/models/manifest.json, checks its Ed25519 signature against
the public key built into the app (src/models/publicKey.json), then checks every file's SHA-256 before
using it. A copied, corrupted or tampered model is never run.

The private key lives outside the repository, at HEALTHNET_MODEL_SIGNING_KEY or
~/.healthnet/model-signing-key.pem. Never commit it. Losing it means generating a new key and shipping
the new public key in an app update.

The manifest's payload is stored as a JSON string and signed byte for byte, so the app needs no
canonical-JSON rules to check it.
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import shutil
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT.parent / "healthnet-frontend"
PUBLIC_MODELS = FRONTEND / "public" / "models"
PUBLIC_KEY_OUT = FRONTEND / "src" / "models" / "publicKey.json"
DEFAULT_KEY = Path.home() / ".healthnet" / "model-signing-key.pem"

# What gets published. `source` is the trained model; `eval` comes from the benchmark baseline.
RELEASES = [
    {
        "id": "healthnet-tagger",
        "source": FRONTEND / "src" / "ocr" / "tagger" / "model.json",
        "evalFrom": FRONTEND / "src" / "benchmark" / "baselines" / "lab-tagger.json",
        "minAppVersion": "0.1.0",
        "rollout": 1.0,
        "notes": "Recognises lab test names the rule-based reader doesn't know.",
    },
]


def key_path():
    return Path(os.getenv("HEALTHNET_MODEL_SIGNING_KEY") or DEFAULT_KEY)


def public_key_text(private_key):
    raw = private_key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    return base64.b64encode(raw).decode()


def key_id(public_key):
    return hashlib.sha256(base64.b64decode(public_key)).hexdigest()[:16]


def generate_key(path):
    if path.exists():
        raise SystemExit(f"{path} already exists; delete it first if you really want a new key")
    path.parent.mkdir(parents=True, exist_ok=True)
    private_key = Ed25519PrivateKey.generate()
    pem = private_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    path.write_bytes(pem)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return private_key


def load_key(path):
    if not path.exists():
        raise SystemExit(f"No signing key at {path}: run python -m training.release --generate-key")
    return serialization.load_pem_private_key(path.read_bytes(), password=None)


def write_public_key(private_key, out=PUBLIC_KEY_OUT):
    public = public_key_text(private_key)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"algorithm": "Ed25519", "key": public, "keyId": key_id(public)}, indent=2) + "\n", encoding="utf-8", newline="\n")
    return public


def model_entry(release, out_dir):
    source = Path(release["source"])
    model = json.loads(source.read_text(encoding="utf-8"))
    version = str(model["version"])
    data = source.read_bytes()
    target = out_dir / release["id"] / version / source.name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    entry = {
        "id": release["id"],
        "version": version,
        "minAppVersion": release["minAppVersion"],
        "rollout": release["rollout"],
        "disabled": False,
        "notes": release["notes"],
        "files": [{"path": f"{release['id']}/{version}/{source.name}", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}],
    }
    eval_path = release.get("evalFrom")
    if eval_path and Path(eval_path).exists():
        overall = json.loads(Path(eval_path).read_text(encoding="utf-8"))["overall"]
        entry["eval"] = {k: overall[k] for k in ("precision", "recall", "f1", "dangerousErrorRate")}
    return entry


def build_manifest(private_key, releases=RELEASES, out_dir=PUBLIC_MODELS, published=None):
    payload = {
        "format": 1,
        "published": published or dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "models": [model_entry(release, out_dir) for release in releases],
    }
    payload_text = json.dumps(payload, indent=2, ensure_ascii=False)
    signature = private_key.sign(payload_text.encode("utf-8"))
    manifest = {
        "algorithm": "Ed25519",
        "keyId": key_id(public_key_text(private_key)),
        "payload": payload_text,
        "signature": base64.b64encode(signature).decode(),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--generate-key", action="store_true", help="create the signing key and the app's public key file")
    args = parser.parse_args()
    path = key_path()
    if args.generate_key:
        private_key = generate_key(path)
        public = write_public_key(private_key)
        print(f"Private key written to {path} (keep it secret, never commit it)")
        print(f"Public key {public} written to {PUBLIC_KEY_OUT.relative_to(ROOT.parent)}")
        return
    private_key = load_key(path)
    write_public_key(private_key)
    manifest = build_manifest(private_key)
    for model in json.loads(manifest["payload"])["models"]:
        size = sum(f["bytes"] for f in model["files"])
        print(f"published {model['id']} {model['version']} ({size // 1024} KB)")
    print(f"signed {PUBLIC_MODELS.relative_to(ROOT.parent) / 'manifest.json'} with key {manifest['keyId']}")


if __name__ == "__main__":
    main()
