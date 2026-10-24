import {
  cmToFeetInches,
  feetInchesToCm,
  formatMeasurement,
  fromStandard,
  toStandard,
  unitFor,
} from './units';

const metric = { system: 'metric', lab: 'mg/dL', temperature: 'C' };
const imperial = { system: 'imperial', lab: 'mmol/L', temperature: 'F' };

test('unit labels follow the preferences', () => {
  expect(unitFor('height', metric)).toBe('cm');
  expect(unitFor('height', imperial)).toBe('ft/in');
  expect(unitFor('weight', imperial)).toBe('lb');
  expect(unitFor('glucose', imperial)).toBe('mmol/L');
  expect(unitFor('creatinine', imperial)).toBe('µmol/L');
  expect(unitFor('temperature', imperial)).toBe('°F');
});

test('converts entered values to standard units', () => {
  expect(toStandard('weight', 154.3, imperial)).toBeCloseTo(70, 1);
  expect(toStandard('length', 32, imperial)).toBeCloseTo(81.28, 2);
  expect(toStandard('glucose', 5.55, imperial)).toBeCloseTo(100, 0);
  expect(toStandard('cholesterol', 5.17, imperial)).toBeCloseTo(200, 0);
  expect(toStandard('creatinine', 88.42, imperial)).toBeCloseTo(1, 3);
  expect(toStandard('temperature', 98.6, imperial)).toBeCloseTo(37, 5);
  expect(toStandard('weight', 70, metric)).toBe(70);
});

test('treats empty input as missing', () => {
  expect(toStandard('weight', '', metric)).toBeNull();
  expect(toStandard('weight', undefined, metric)).toBeNull();
  expect(toStandard('weight', 'abc', metric)).toBeNull();
  expect(fromStandard('weight', null, metric)).toBeNull();
});

test('round-trips every kind', () => {
  ['height', 'length', 'weight', 'glucose', 'cholesterol', 'creatinine', 'temperature'].forEach((kind) => {
    expect(toStandard(kind, fromStandard(kind, 123.4, imperial), imperial)).toBeCloseTo(123.4, 6);
  });
});

test('splits height into feet and inches without "12 in"', () => {
  expect(cmToFeetInches(170)).toEqual({ feet: 5, inches: 7 });
  expect(cmToFeetInches(182.6)).toEqual({ feet: 6, inches: 0 });
  expect(feetInchesToCm(5, 7)).toBeCloseTo(170.18, 2);
});

test('formats values for display', () => {
  expect(formatMeasurement('height', 170, imperial)).toBe('5 ft 7 in');
  expect(formatMeasurement('height', 170, metric)).toBe('170 cm');
  expect(formatMeasurement('weight', 70, imperial)).toBe('154.3 lb');
  expect(formatMeasurement('glucose', 100, imperial)).toBe('5.6 mmol/L');
  expect(formatMeasurement('glucose', 100, metric)).toBe('100 mg/dL');
  expect(formatMeasurement('temperature', 37, imperial)).toBe('98.6 °F');
  expect(formatMeasurement('weight', null, metric)).toBe('—');
});
