import { isDeepStrictEqual } from 'util';
import PARITY from './__fixtures__/parity.json';
import { assess, DISCLAIMER, RiskInputError, VERSION } from '.';
import { pyRound } from './result';
import { regionFor, tenYearRisk } from './whoCvd';

// The fixture holds the Python reference engine's results (risk/export_frontend.py). Every score
// must match exactly: same status, value, category, level, details and assumptions.

const withoutModels = (scores) =>
  Object.fromEntries(Object.entries(scores).map(([id, { model, ...rest }]) => [id, rest]));

test('the port matches the Python engine on every fixture profile', () => {
  expect(PARITY.cases.length).toBeGreaterThan(300);
  const mismatches = PARITY.cases.filter(({ profile, scores }) => !isDeepStrictEqual(withoutModels(assess(profile).scores), scores));
  // On failure, the first differing case is shown in full
  const first = mismatches[0];
  expect(first && { profile: first.profile, scores: withoutModels(assess(first.profile).scores) }).toEqual(first);
  expect(mismatches).toHaveLength(0);
});

test('version, disclaimer and model descriptions match the Python engine', () => {
  const { engineVersion, disclaimer, scores } = assess(PARITY.cases[0].profile);
  expect(engineVersion).toBe(PARITY.engineVersion);
  expect(VERSION).toBe(PARITY.engineVersion);
  expect(disclaimer).toBe(DISCLAIMER);
  expect(disclaimer).toBe(PARITY.disclaimer);
  Object.entries(scores).forEach(([id, score]) => expect(score.model).toEqual(PARITY.models[id]));
});

test('profiles the Python validator rejects are rejected here too', () => {
  PARITY.invalid.forEach((profile) => {
    expect(() => assess(profile)).toThrow(RiskInputError);
  });
});

test('unknown fields are ignored, like the API', () => {
  const { profile, scores } = PARITY.cases[0];
  expect(withoutModels(assess({ ...profile, medications: 'Metformin', dateOfBirth: '1970-01-01' }).scores)).toEqual(scores);
});

test('WHO risk matches the independent Stata reference cases', () => {
  expect(PARITY.whoReference.length).toBe(98);
  PARITY.whoReference.forEach((row) => {
    const common = { age: row.age, sex: row.sex, sbp: row.sbp, smoking: row.smoking, region: regionFor(row.country), year: row.year };
    expect(Math.abs(tenYearRisk({ ...common, cholesterolMmol: row.cholesterol, diabetes: row.diabetes }) - row.refLab)).toBeLessThan(1e-9);
    expect(Math.abs(tenYearRisk({ ...common, bmi: row.bmi }) - row.refNonlab)).toBeLessThan(1e-9);
  });
});

test('pyRound follows Python round(): exact binary value, ties to even', () => {
  expect(pyRound(0.25, 1)).toBe(0.2);
  expect(pyRound(0.75, 1)).toBe(0.8);
  expect(pyRound(2.5)).toBe(2);
  expect(pyRound(3.5)).toBe(4);
  // 2.675 is stored as 2.67499999..., so it rounds down
  expect(pyRound(2.675, 2)).toBe(2.67);
  expect(pyRound(1.005, 2)).toBe(1);
  expect(pyRound(26.5625, 1)).toBe(26.6);
  expect(pyRound(-0.25, 1)).toBe(-0.2);
  expect(pyRound(99.95, 1)).toBe(100);
  expect(pyRound(0.04999, 1)).toBe(0);
  expect(pyRound(123.456)).toBe(123);
});
