import PUBLIC_KEY from './publicKey.json';
import { createModelStore } from './modelStore';
import { APP_VERSION, MODELS } from './registry';
import { cacheStorage } from './storage';

// The app's model store: manifests and model files come from the app's own /models folder, or from
// REACT_APP_MODEL_BASE_URL (e.g. a CDN). Signatures make the source irrelevant to safety.
let store;
export const getModelStore = () => {
  store ??= createModelStore({
    fetchImpl: (...args) => fetch(...args),
    subtle: typeof window !== 'undefined' ? window.crypto?.subtle : undefined,
    storage: cacheStorage('healthnet-models-v1'),
    publicKey: PUBLIC_KEY,
    baseUrl: (process.env.REACT_APP_MODEL_BASE_URL || `${process.env.PUBLIC_URL || ''}/models`).replace(/\/$/, ''),
    appVersion: APP_VERSION,
    models: MODELS,
  });
  return store;
};

export { MODELS } from './registry';
