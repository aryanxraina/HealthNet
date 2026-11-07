import { selfTest as taggerSelfTest } from '../ocr/tagger/classify';

// The on-device models HealthNet knows about. Each ships with the app (builtInVersion) and can be
// replaced by a newer, signed download (modelStore.js). Keep APP_VERSION equal to package.json's
// version and builtInVersion equal to the bundled model's "version" (registry.test.js checks both).

export const APP_VERSION = '0.1.0';

export const MODELS = {
  'healthnet-tagger': {
    builtInVersion: '1.0.0',
    // Runs on the downloaded files before they replace the current model
    selfTest: ([file]) => {
      try {
        return taggerSelfTest(JSON.parse(new TextDecoder().decode(file)));
      } catch {
        return false;
      }
    },
  },
};
