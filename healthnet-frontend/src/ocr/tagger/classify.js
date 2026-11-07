import { featureCounts } from './features';

// HealthNet Tagger (R2 in docs/on-device-model-roadmap.md): recognises which lab test a report line
// names, including spellings the rule-based dictionary doesn't know ("Creat.", "O2 Sat", "Glycated Hb").
// A small logistic regression over character n-grams, trained by FINAL YEAR PROJECT/training/tagger.
// It only labels a name; values, units and ranges are still read by the rules in labParser.js.
//
// model: { version, labels, intercepts, weights: { feature: [weight per label] } } from model.json

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

// Checks a downloaded model before it replaces the current one: the right shape, and sensible answers
// on names any version must get right
const SELF_TEST = [
  ['Total Cholesterol', 'totalCholesterol'],
  ['HDL Cholesterol', 'hdlCholesterol'],
  ['HbA1c', 'hba1c'],
  ['Fasting Blood Sugar', 'fastingGlucose'],
  ['Serum Creatinine', 'creatinine'],
  ['eGFR', 'egfr'],
  ['LDL Cholesterol', 'other'],
  ['Triglycerides', 'other'],
  ['Patient ID', 'other'],
];

export const selfTest = (model) => {
  if (!model || !Array.isArray(model.labels) || !Array.isArray(model.intercepts) || typeof model.weights !== 'object') return false;
  if (model.intercepts.length !== model.labels.length) return false;
  if (Object.values(model.weights).some((row) => !Array.isArray(row) || row.length !== model.labels.length)) return false;
  return SELF_TEST.every(([name, label]) => classifyName(model, name).label === label);
};
