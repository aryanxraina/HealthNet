import { compareVersions } from './semver';

// Signed model delivery (R3 in docs/on-device-model-roadmap.md).
//
// The manifest (published by FINAL YEAR PROJECT/training/release.py) lists each model's latest
// version and the SHA-256 of every file. Its payload is signed with HealthNet's Ed25519 key; the app
// holds the public key. A model is used only if:
//   - the manifest's signature checks out, both when installing and every time the model loads;
//   - every file's hash matches the signed manifest;
//   - it passes the model's self-test before it replaces the current version;
//   - it isn't disabled in the manifest (a kill switch, which also removes an installed copy).
// Staged rollout ("rollout": share of devices) and a minimum app version are respected. The version
// built into the app is always the fallback. Checking for updates downloads the public manifest only;
// nothing about the person is sent.

export class ModelError extends Error {
  constructor(code) {
    super(`Model update failed: ${code}`);
    this.code = code; // network | signature | unsupported | integrity | selfTest | notOffered
  }
}

const bytesFromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const createModelStore = ({ fetchImpl, subtle, storage, publicKey, baseUrl, appVersion, models, random = Math.random }) => {
  const metaKey = (id) => `meta:${id}`;
  const fileKey = (path) => `file:${path}`;

  // The signed manifest's payload, or a ModelError
  const verify = async (manifest) => {
    if (!manifest || typeof manifest.payload !== 'string' || typeof manifest.signature !== 'string') throw new ModelError('signature');
    if (!subtle) throw new ModelError('unsupported');
    let key;
    try {
      key = await subtle.importKey('raw', bytesFromBase64(publicKey.key), { name: 'Ed25519' }, false, ['verify']);
    } catch {
      // Browsers without Ed25519 in WebCrypto can't check signatures, so they keep the built-in models
      throw new ModelError('unsupported');
    }
    let valid = false;
    try {
      valid = await subtle.verify({ name: 'Ed25519' }, key, bytesFromBase64(manifest.signature), new TextEncoder().encode(manifest.payload));
    } catch {
      valid = false;
    }
    if (!valid) throw new ModelError('signature');
    return JSON.parse(manifest.payload);
  };

  const sha256 = async (buffer) => hex(await subtle.digest('SHA-256', buffer));

  // A stable random number per device, for staged rollouts
  const bucket = async () => {
    const stored = await storage.getText('rollout-bucket');
    if (stored !== null && !Number.isNaN(Number(stored))) return Number(stored);
    const value = random();
    await storage.put('rollout-bucket', String(value));
    return value;
  };

  const readMeta = async (id) => {
    const text = await storage.getText(metaKey(id));
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  const remove = async (id) => {
    const meta = await readMeta(id);
    if (meta) await Promise.all(meta.files.map((file) => storage.delete(fileKey(file.path))));
    await storage.delete(metaKey(id));
  };

  const fetchManifest = async () => {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/manifest.json`, { cache: 'no-store' });
    } catch {
      throw new ModelError('network');
    }
    if (!response.ok) throw new ModelError('network');
    const manifest = await response.json().catch(() => null);
    return { manifest, payload: await verify(manifest) };
  };

  const offered = (entry, share) =>
    entry && !entry.disabled && compareVersions(appVersion, entry.minAppVersion || '0.0.0') >= 0 && share < (entry.rollout ?? 1);

  // { models: [{ id, builtIn, installed, latest, sizeBytes, status }] }
  // status: upToDate | updateAvailable | disabled (an installed copy was withdrawn and removed)
  const check = async () => {
    const { payload } = await fetchManifest();
    const share = await bucket();
    const results = [];
    for (const [id, model] of Object.entries(models)) {
      const entry = payload.models.find((candidate) => candidate.id === id);
      const meta = await readMeta(id);
      let installed = meta?.version ?? null;
      let status = 'upToDate';
      if (installed && payload.models.some((candidate) => candidate.id === id && candidate.version === installed && candidate.disabled)) {
        await remove(id);
        installed = null;
        status = 'disabled';
      }
      const current = installed && compareVersions(installed, model.builtInVersion) > 0 ? installed : model.builtInVersion;
      if (status !== 'disabled' && offered(entry, share) && compareVersions(entry.version, current) > 0) status = 'updateAvailable';
      results.push({
        id,
        builtIn: model.builtInVersion,
        installed,
        latest: entry?.version ?? null,
        sizeBytes: entry ? entry.files.reduce((sum, file) => sum + file.bytes, 0) : 0,
        status,
      });
    }
    return { models: results };
  };

  // Downloads, verifies and self-tests the latest offered version; the current one stays until it passes
  const install = async (id) => {
    const { manifest, payload } = await fetchManifest();
    const entry = payload.models.find((candidate) => candidate.id === id);
    if (!models[id] || !offered(entry, await bucket())) throw new ModelError('notOffered');
    const buffers = [];
    for (const file of entry.files) {
      let response;
      try {
        response = await fetchImpl(`${baseUrl}/${file.path}`, { cache: 'no-store' });
      } catch {
        throw new ModelError('network');
      }
      if (!response.ok) throw new ModelError('network');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== file.bytes || (await sha256(buffer)) !== file.sha256) throw new ModelError('integrity');
      buffers.push(buffer);
    }
    if (!models[id].selfTest(buffers)) throw new ModelError('selfTest');
    const previous = await readMeta(id);
    await Promise.all(entry.files.map((file, i) => storage.put(fileKey(file.path), buffers[i])));
    await storage.put(metaKey(id), JSON.stringify({ id, version: entry.version, files: entry.files, manifest, installedAt: new Date().toISOString() }));
    // The old version's files go only once the new one is in place
    if (previous && previous.version !== entry.version) {
      const keep = new Set(entry.files.map((file) => file.path));
      await Promise.all(previous.files.filter((file) => !keep.has(file.path)).map((file) => storage.delete(fileKey(file.path))));
    }
    return entry.version;
  };

  // The installed version's files, re-verified (signature and hashes), if it's newer than the built-in
  // version; otherwise null. A copy that fails verification is removed.
  const loadNewerThanBuiltIn = async (id) => {
    const meta = await readMeta(id);
    if (!meta || !models[id] || compareVersions(meta.version, models[id].builtInVersion) <= 0) return null;
    try {
      const payload = await verify(meta.manifest);
      const entry = payload.models.find((candidate) => candidate.id === id && candidate.version === meta.version);
      if (!entry || entry.disabled) throw new ModelError('signature');
      const files = [];
      for (const file of entry.files) {
        const buffer = await storage.get(fileKey(file.path));
        if (!buffer || (await sha256(buffer)) !== file.sha256) throw new ModelError('integrity');
        files.push(buffer);
      }
      return { version: meta.version, files };
    } catch (error) {
      if (error.code !== 'unsupported') await remove(id);
      return null;
    }
  };

  // What the Settings page shows without going online
  const installedInfo = async (id) => {
    const meta = await readMeta(id);
    return meta ? { version: meta.version, installedAt: meta.installedAt, sizeBytes: meta.files.reduce((sum, f) => sum + f.bytes, 0) } : null;
  };

  return { check, install, remove, loadNewerThanBuiltIn, installedInfo };
};
