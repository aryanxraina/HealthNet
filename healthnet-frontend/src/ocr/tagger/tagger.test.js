import PARITY from './__fixtures__/parity.json';
import MODEL from './model.json';
import { featureCounts } from './features';
import { classifyName } from './tagger';
import { parseLabReport, textToLines } from '../labParser';

// The fixture holds the Python training code's features and probabilities for the exported model
// (FINAL YEAR PROJECT/training/tagger/train.py)

test('features and probabilities match the Python training code', () => {
  expect(PARITY.length).toBeGreaterThan(150);
  PARITY.forEach(({ text, features, probabilities }) => {
    expect(featureCounts(text)).toEqual(features);
    classifyName(MODEL, text).probabilities.forEach((p, k) => expect(Math.abs(p - probabilities[k])).toBeLessThan(1e-9));
  });
});

test('the model is small enough to ship', () => {
  expect(JSON.stringify(MODEL).length).toBeLessThan(400 * 1024);
});

const read = (text, options) => parseLabReport(textToLines(text), options);

test('the Tagger reads test names the rules do not know, and says so', () => {
  const text = 'Creat.    1.10    mg/dL\nO2 Sat    97    %\nGlycated Hb    6.1    %';
  expect(read(text)).toEqual([]);
  const items = read(text, { tagger: MODEL });
  expect(items.map((i) => [i.field, i.standardValue])).toEqual([['hba1c', 6.1], ['creatinine', 1.1], ['spo2', 97]]);
  items.forEach((i) => {
    expect(i.notes).toContain('nameGuessed');
    expect(i.confidence).toBeLessThan(0.95);
  });
});

test('rules come first, and look-alikes stay excluded', () => {
  const [glucose] = read('Glucose, Fasting    95 mg/dL', { tagger: MODEL });
  expect(glucose.notes).not.toContain('nameGuessed');
  expect(read('Urine Creat.    80 mg/dL\nLDL Chol    120 mg/dL\nTriglycerides    150 mg/dL\nPatient ID 448812', { tagger: MODEL })).toEqual([]);
});

test('a name the Tagger is unsure about is left for the user', () => {
  expect(read('Xq-7 Index    42', { tagger: MODEL })).toEqual([]);
});

test('average glucose is never read as a fasting result, by the rules or the Tagger', () => {
  ['Est. Avg Glucose    131 mg/dL', 'Mean Plasma Glucose    126 mg/dL', 'Avg. Glucose (eAG)    140 mg/dL'].forEach((line) => {
    expect(read(line)).toEqual([]);
    expect(read(line, { tagger: MODEL })).toEqual([]);
  });
});

test('a test name that OCR turned partly into digits still reaches the Tagger', () => {
  const [spo2] = read('02 Sat    97    %    95-100', { tagger: MODEL });
  expect(spo2).toMatchObject({ field: 'spo2', standardValue: 97 });
});
