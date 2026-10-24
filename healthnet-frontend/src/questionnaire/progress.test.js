import { sectionById } from './sections';
import {
  migrateLegacyAnswers,
  minutesLeft,
  overallProgress,
  pruneHidden,
  sectionProgress,
  validateSection,
  visibleSections,
} from './progress';

const about = sectionById('about');
const ids = (sections) => sections.map((section) => section.id);

test("the women's health section follows the sex used for risk calculations", () => {
  expect(ids(visibleSections({ about: { gender: 'male' } }))).not.toContain('womens');
  expect(ids(visibleSections({ about: { gender: 'female' } }))).toContain('womens');
  expect(ids(visibleSections({ about: { gender: 'nonBinary', riskSex: 'female' } }))).toContain('womens');
});

test('required sections count only required questions; finished sections count fully', () => {
  // 4 of 5 required About questions (the riskSex question is hidden when gender is female)
  const answers = { about: { dateOfBirth: '1990-01-01', gender: 'female', country: 'GB', height: 165 } };
  expect(sectionProgress(about, answers)).toBeCloseTo(4 / 5);
  expect(sectionProgress(sectionById('vitals'), { vitals: { _status: 'skipped' } })).toBe(1);
});

test('overall progress goes from 0 to 100', () => {
  expect(overallProgress({})).toBe(0);
  const done = Object.fromEntries(visibleSections({}).map((section) => [section.id, { _status: 'complete' }]));
  expect(overallProgress(done)).toBe(100);
  expect(minutesLeft(done)).toBe(0);
  expect(minutesLeft({})).toBeGreaterThan(0);
});

test('validation flags missing required answers, out-of-range numbers and future dates', () => {
  const errors = validateSection(about, { about: { dateOfBirth: '2999-01-01', gender: 'male', height: 400, weight: 70 } });
  expect(errors.dateOfBirth.key).toBe('questionnaire.errors.date');
  expect(errors.height).toEqual({ key: 'questionnaire.errors.range', min: 50, max: 250 });
  expect(errors.country.key).toBe('questionnaire.errors.required');
  expect(errors.weight).toBeUndefined();
  expect(errors.waist).toBeUndefined();
});

test('limits shown rounded in the user units are accepted when typed as shown', () => {
  const mmol = { system: 'metric', lab: 'mmol/L', temperature: 'C' };
  const imperial = { system: 'imperial', lab: 'mg/dL', temperature: 'F' };
  // 300 kg is shown as 661.4 lb (= 300.006 kg); 70 mg/dL is shown as 1.8 mmol/L (= 69.6 mg/dL)
  expect(validateSection(about, { about: { weight: 661.4 / 2.2046226218 } }, imperial).weight).toBeUndefined();
  expect(validateSection(sectionById('vitals'), { vitals: { totalCholesterol: 1.8 * 38.67 } }, mmol)).toEqual({});
  // ...while a value clearly under the limit is still rejected
  expect(validateSection(sectionById('vitals'), { vitals: { totalCholesterol: 69.6 } }).totalCholesterol).toBeDefined();
});

test('optional sections only check ranges', () => {
  expect(validateSection(sectionById('vitals'), { vitals: {} })).toEqual({});
  expect(validateSection(sectionById('vitals'), { vitals: { systolic: 20 } }).systolic.key).toBe('questionnaire.errors.range');
});

test('answers to hidden follow-up questions are dropped', () => {
  const lifestyle = sectionById('lifestyle');
  const answers = { lifestyle: { auditFrequency: 'never', auditTypical: 'oneTwo', smoking: 'never', _status: 'complete' } };
  expect(pruneHidden(lifestyle, answers)).toEqual({ auditFrequency: 'never', smoking: 'never', _status: 'complete' });
});

test('answers from the first questionnaire version move to the new sections', () => {
  const migrated = migrateLegacyAnswers({
    personal: { name: 'Sam', gender: 'other', age: 40, height: 180, weight: 80 },
    lifestyle: { exercise: 'daily', smoking: 'former', alcohol: 'moderate' },
    medical: { conditions: ['heart_disease', 'asthma'], medications: 'None', allergies: '' },
  });
  expect(migrated.about).toEqual({ gender: 'nonBinary', height: 180, weight: 80 });
  expect(migrated.lifestyle).toEqual({ smoking: 'former', exerciseFrequency: 'daily' });
  expect(migrated.medical.conditions).toEqual(['heartDisease', 'asthma']);
  expect(migrateLegacyAnswers({ about: { gender: 'male' }, lifestyle: { smoking: 'never' } })).toEqual({});
});
