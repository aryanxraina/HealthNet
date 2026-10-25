import en from '../i18n/locales/en.json';
import fixture from '../api/__fixtures__/assessment.json';
import { buildReport, pdfSafe } from './reportData';
import { suggestionIds } from './suggestions';

// Same lookup and {{placeholder}} rules as the app's i18n layer
const t = (key, values = {}) => {
  const text = key.split('.').reduce((node, part) => node?.[part], en);
  return typeof text === 'string' ? text.replace(/\{\{(\w+)\}\}/g, (m, name) => (name in values ? String(values[name]) : m)) : key;
};

const answers = {
  about: { dateOfBirth: '1976-01-15', gender: 'female', country: 'IN', height: 160, weight: 68, waist: 86 },
  lifestyle: { smoking: 'never', dailyActivity: 'no', fruitVeg: 'yes', auditFrequency: 'never' },
  medical: {
    conditions: ['asthma'],
    bpMedication: 'no',
    statin: 'no',
    medicationList: [{ id: 'm1', name: 'Albuterol inhaler', strength: null, frequency: 'When needed', rxcui: '435' }],
    medications: 'Vitamin D',
    allergies: '',
    familyDiabetes: 'immediate',
  },
  vitals: { systolic: 128, diastolic: 82, fastingGlucose: 104 },
  mental: { phq1: '2', phq2: '2', phq3: '1', phq4: '0' },
};
const results = { ...fixture.response, calculatedAt: '2026-10-20T10:00:00Z' };

const build = (overrides = {}) =>
  buildReport({ name: 'Priya Sharma', answers, results, settings: { units: { system: 'metric', lab: 'mg/dL', temperature: 'C' } }, t, now: new Date('2026-10-25T12:00:00'), ...overrides });

test('page 1 shows the preferred diabetes model; the doctor page shows every score', () => {
  const report = build();
  const friendly = report.friendlyScores.map((s) => s.id);
  expect(friendly).toContain('findrisc');
  expect(friendly).not.toContain('mlDiabetes');
  expect(report.allScores.map((s) => s.id)).toEqual(expect.arrayContaining(['findrisc', 'mlDiabetes', 'prevent']));

  const withMl = build({ settings: { diabetesModel: 'ml', units: {} } }).friendlyScores.map((s) => s.id);
  expect(withMl).toContain('mlDiabetes');
  expect(withMl).not.toContain('findrisc');
});

test('score rows are written out in words', () => {
  const report = build();
  const who = report.allScores.find((s) => s.id === 'whoCvd');
  expect(who).toMatchObject({ value: '3.2%', category: 'Under 5%', horizon: '10-year risk' });
  const findrisc = report.allScores.find((s) => s.id === 'findrisc');
  expect(findrisc.value).toBe('13 / 26');
  const prevent = report.allScores.find((s) => s.id === 'prevent');
  expect(prevent.notes[0]).toMatch(/add total cholesterol/i);
  expect(prevent.model).toMatch(/Circulation 2024/);
});

test('the doctor page lists measurements in the chosen units and the medical history', () => {
  const metric = build();
  expect(metric.person).toEqual([
    { label: 'Age', value: '50' },
    { label: 'Sex used in risk models', value: 'Female' },
    { label: 'Country', value: 'India' },
  ]);
  expect(metric.measurements).toEqual(
    expect.arrayContaining([
      { label: 'Height', value: '160 cm' },
      { label: 'BMI', value: '26.6 kg/m²' },
      { label: 'Blood pressure', value: '128/82 mmHg' },
      { label: 'Fasting blood sugar (glucose)', value: '104 mg/dL' },
    ])
  );
  expect(metric.history).toEqual(
    expect.arrayContaining([
      { label: 'Diagnosed conditions', value: 'Asthma or COPD' },
      { label: 'Current medicines', value: 'Albuterol inhaler · When needed' },
      { label: 'Other medicines and supplements', value: 'Vitamin D' },
    ])
  );
  expect(metric.history.find((row) => row.label === 'Allergies')).toBeUndefined();

  const imperial = build({ settings: { units: { system: 'imperial', lab: 'mmol/L', temperature: 'F' } } });
  expect(imperial.measurements).toEqual(expect.arrayContaining([{ label: 'Height', value: '5 ft 3 in' }]));
  expect(imperial.measurements.find((row) => row.value.includes('mmol/L'))).toBeDefined();
});

test('next steps follow the answers, most important first', () => {
  const steps = build().suggestions.map((s) => s.title);
  expect(steps).toHaveLength(3);
  expect(steps[0]).toBe('Talk to someone about how you feel');
  expect(suggestionIds({}, {})).toEqual(['keepItUp']);
  expect(suggestionIds({}, { lifestyle: { smoking: 'current', dailyActivity: 'no' } })).toEqual(['quitSmoking', 'moveMore']);
});

test('symbols missing from the PDF font are replaced', () => {
  expect(pdfSafe('Score ≥ 5 → see a doctor')).toBe('Score >= 5 -> see a doctor');
});
