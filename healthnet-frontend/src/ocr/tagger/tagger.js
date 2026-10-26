import { featureCounts } from './features';

// HealthNet Tagger (R2 in docs/on-device-model-roadmap.md): recognises which lab test a report line
// names, including spellings the rule-based dictionary doesn't know ("Creat.", "O2 Sat", "Glycated Hb").
// A small logistic regression over character n-grams, trained by FINAL YEAR PROJECT/training/tagger.
// It only labels a name; values, units and ranges are still read by the rules in labParser.js.
//
// model: { labels, intercepts, weights: { feature: [weight per label] } } from model.json

// { label, probability } for a name; label is a Vitals field id, 'glucoseUnspecified',
// 'bloodPressure' or 'other'
export const classifyName = (model, text) => {
  const counts = Object.entries(featureCounts(text)).filter(([name]) => name in model.weights);
  const norm = Math.sqrt(counts.reduce((sum, [, count]) => sum + count * count, 0));
  const scores = [...model.intercepts];
  if (norm) {
    counts.forEach(([name, count]) => {
      model.weights[name].forEach((weight, k) => {
        scores[k] += (weight * count) / norm;
      });
    });
  }
  const top = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - top));
  const total = exps.reduce((sum, value) => sum + value, 0);
  const probabilities = exps.map((value) => value / total);
  const best = probabilities.indexOf(Math.max(...probabilities));
  return { label: model.labels[best], probability: probabilities[best], probabilities };
};

// The model is loaded on first use, only when someone imports a report
let loading;
export const loadTagger = () => {
  loading ??= import('./model.json').then((module) => module.default || module).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
};
