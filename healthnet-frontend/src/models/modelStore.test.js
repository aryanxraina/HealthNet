/**
 * @jest-environment node
 */
// Real WebCrypto (Node's) and a throwaway key pair, so signatures and hashes are checked for real
import { webcrypto } from 'crypto';
import fs from 'fs';
import path from 'path';
import { createModelStore } from './modelStore';
import { memoryStorage } from './storage';
import { APP_VERSION, MODELS } from './registry';
import PUBLIC_KEY from './publicKey.json';
import BUILT_IN_TAGGER from '../ocr/tagger/model.json';

const { subtle } = webcrypto;
const encode = (text) => new TextEncoder().encode(text);
const base64 = (bytes) => Buffer.from(bytes).toString('base64');
const sha256 = async (bytes) => Buffer.from(await subtle.digest('SHA-256', bytes)).toString('hex');

const goodModel = { ...BUILT_IN_TAGGER, version: '1.1.0' };
const brokenModel = { ...BUILT_IN_TAGGER, version: '1.2.0', intercepts: BUILT_IN_TAGGER.intercepts.map(() => 0), weights: {} };

let keys;
beforeAll(async () => {
  keys = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
});

// A published release: { files: { path: bytes }, manifest }
const publish = async (entries, { signWith = keys.privateKey, tamper } = {}) => {
  const files = {};
  const models = [];
  for (const { model, ...overrides } of entries) {
    const bytes = encode(JSON.stringify(model));
    const filePath = `healthnet-tagger/${model.version}/model.json`;
    files[filePath] = bytes;
    models.push({ id: 'healthnet-tagger', version: model.version, minAppVersion: '0.1.0', rollout: 1, disabled: false, files: [{ path: filePath, bytes: bytes.length, sha256: await sha256(bytes) }], ...overrides });
  }
  const payload = JSON.stringify({ format: 1, published: '2026-10-26T00:00:00Z', models }, null, 2);
  const signature = base64(await subtle.sign({ name: 'Ed25519' }, signWith, encode(tamper ? tamper(payload) : payload)));
  return { files, manifest: { algorithm: 'Ed25519', payload, signature } };
};

const makeStore = async (release, options = {}) => {
  const publicKey = { key: base64(await subtle.exportKey('raw', keys.publicKey)) };
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    const name = url.replace('https://cdn.test/models/', '');
    if (options.offline) throw new TypeError('offline');
    if (name === 'manifest.json') return { ok: true, json: async () => release.manifest };
    const bytes = options.corrupt?.[name] ?? release.files[name];
    if (!bytes) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => bytes.slice().buffer };
  };
  const storage = options.storage || memoryStorage();
  const store = createModelStore({
    fetchImpl, subtle, storage, publicKey, baseUrl: 'https://cdn.test/models', appVersion: options.appVersion || '0.1.0', models: MODELS, random: () => options.bucket ?? 0.3,
  });
  return { store, storage, requests };
};

test('a newer signed model is offered, verified, self-tested and then used', async () => {
  const { store, requests } = await makeStore(await publish([{ model: goodModel }]));
  const before = await store.check();
  expect(before.models[0]).toMatchObject({ id: 'healthnet-tagger', builtIn: '1.0.0', installed: null, latest: '1.1.0', status: 'updateAvailable' });
  expect(before.models[0].sizeBytes).toBeGreaterThan(100000);
  // Checking downloads only the public manifest
  expect(requests).toEqual(['https://cdn.test/models/manifest.json']);

  expect(await store.install('healthnet-tagger')).toBe('1.1.0');
  const loaded = await store.loadNewerThanBuiltIn('healthnet-tagger');
  expect(loaded.version).toBe('1.1.0');
  expect(JSON.parse(new TextDecoder().decode(loaded.files[0])).version).toBe('1.1.0');
  expect((await store.check()).models[0]).toMatchObject({ installed: '1.1.0', status: 'upToDate' });
  expect(await store.installedInfo('healthnet-tagger')).toMatchObject({ version: '1.1.0' });
});

test('a manifest signed by anyone else is rejected', async () => {
  const stranger = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const { store } = await makeStore(await publish([{ model: goodModel }], { signWith: stranger.privateKey }));
  await expect(store.check()).rejects.toMatchObject({ code: 'signature' });
  await expect(store.install('healthnet-tagger')).rejects.toMatchObject({ code: 'signature' });
});

test('an edited manifest is rejected', async () => {
  const { store } = await makeStore(await publish([{ model: goodModel }], { tamper: (payload) => payload.replace('"rollout": 1', '"rollout": 0') }));
  await expect(store.check()).rejects.toMatchObject({ code: 'signature' });
});

test('a model file that doesn\'t match its signed hash is never installed', async () => {
  const release = await publish([{ model: goodModel }]);
  const swapped = encode(JSON.stringify({ ...goodModel, intercepts: goodModel.intercepts.map((b) => b + 1) }));
  const { store } = await makeStore(release, { corrupt: { 'healthnet-tagger/1.1.0/model.json': swapped } });
  await expect(store.install('healthnet-tagger')).rejects.toMatchObject({ code: 'integrity' });
  expect(await store.loadNewerThanBuiltIn('healthnet-tagger')).toBeNull();
});

test('a model that fails its self-test keeps the current version', async () => {
  const { store, storage } = await makeStore(await publish([{ model: goodModel }]));
  await store.install('healthnet-tagger');
  const next = await makeStore(await publish([{ model: brokenModel }]), { storage });
  await expect(next.store.install('healthnet-tagger')).rejects.toMatchObject({ code: 'selfTest' });
  expect((await next.store.loadNewerThanBuiltIn('healthnet-tagger')).version).toBe('1.1.0');
});

test('files changed after installing are caught when the model loads, and removed', async () => {
  const { store, storage } = await makeStore(await publish([{ model: goodModel }]));
  await store.install('healthnet-tagger');
  await storage.put('file:healthnet-tagger/1.1.0/model.json', encode('{"tampered":true}').buffer);
  expect(await store.loadNewerThanBuiltIn('healthnet-tagger')).toBeNull();
  expect(await store.installedInfo('healthnet-tagger')).toBeNull();
});

test('a withdrawn version is removed by the next check (kill switch)', async () => {
  const { store, storage } = await makeStore(await publish([{ model: goodModel }]));
  await store.install('healthnet-tagger');
  const withdrawn = await makeStore(await publish([{ model: goodModel, disabled: true }]), { storage });
  expect((await withdrawn.store.check()).models[0]).toMatchObject({ installed: null, status: 'disabled' });
  expect(await withdrawn.store.loadNewerThanBuiltIn('healthnet-tagger')).toBeNull();
});

test('staged rollouts and minimum app versions are respected', async () => {
  const halfway = await publish([{ model: goodModel, rollout: 0.25 }]);
  expect((await (await makeStore(halfway, { bucket: 0.1 })).store.check()).models[0].status).toBe('updateAvailable');
  const outside = await makeStore(halfway, { bucket: 0.9 });
  expect((await outside.store.check()).models[0].status).toBe('upToDate');
  await expect(outside.store.install('healthnet-tagger')).rejects.toMatchObject({ code: 'notOffered' });

  const needsNewerApp = await publish([{ model: goodModel, minAppVersion: '9.0.0' }]);
  expect((await (await makeStore(needsNewerApp)).store.check()).models[0].status).toBe('upToDate');
});

test('a version no newer than the built-in one is not used', async () => {
  const sameAsBuiltIn = await publish([{ model: { ...BUILT_IN_TAGGER } }]);
  const { store } = await makeStore(sameAsBuiltIn);
  expect((await store.check()).models[0].status).toBe('upToDate');
});

test('offline checks fail gracefully', async () => {
  const { store } = await makeStore(await publish([{ model: goodModel }]), { offline: true });
  await expect(store.check()).rejects.toMatchObject({ code: 'network' });
  expect(await store.loadNewerThanBuiltIn('healthnet-tagger')).toBeNull();
});

test('removing a download goes back to the built-in model', async () => {
  const { store } = await makeStore(await publish([{ model: goodModel }]));
  await store.install('healthnet-tagger');
  await store.remove('healthnet-tagger');
  expect(await store.loadNewerThanBuiltIn('healthnet-tagger')).toBeNull();
  expect((await store.check()).models[0].status).toBe('updateAvailable');
});

test('versions in the registry match the app and the bundled model', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  expect(APP_VERSION).toBe(pkg.version);
  expect(MODELS['healthnet-tagger'].builtInVersion).toBe(BUILT_IN_TAGGER.version);
});

test('the manifest published with the app verifies against the app\'s public key', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'models', 'manifest.json'), 'utf8'));
  const key = await subtle.importKey('raw', Buffer.from(PUBLIC_KEY.key, 'base64'), { name: 'Ed25519' }, false, ['verify']);
  expect(await subtle.verify({ name: 'Ed25519' }, key, Buffer.from(manifest.signature, 'base64'), encode(manifest.payload))).toBe(true);
});
