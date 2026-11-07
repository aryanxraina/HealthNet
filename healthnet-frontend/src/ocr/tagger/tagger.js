import { getModelStore } from '../../models';

export { classifyName } from './classify';

const TAGGER = 'healthnet-tagger';

// The Tagger model, loaded on first use (only when someone imports a report). A verified download
// newer than the built-in version wins (src/models, R3); otherwise the version built into the app.
let loading;
export const loadTagger = () => {
  loading ??= (async () => {
    try {
      const installed = await getModelStore().loadNewerThanBuiltIn(TAGGER);
      if (installed) return JSON.parse(new TextDecoder().decode(installed.files[0]));
    } catch {
      // A broken download never blocks reading: fall back to the built-in model
    }
    const module = await import('./model.json');
    return module.default || module;
  })().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
};

// After a model is installed or removed in Settings, the next report uses the new choice
export const forgetLoadedTagger = () => {
  loading = undefined;
};
