import { buildProfile, calculateAssessment, profileKey, RiskError, sectionForField } from './risk';

jest.mock('../firebase');

const answers = {
  about: { dateOfBirth: '1975-03-10', gender: 'nonBinary', riskSex: 'female', country: 'IN', height: 160, weight: 68, _status: 'complete' },
  lifestyle: { smoking: 'never', exerciseFrequency: 'daily', auditFrequency: 'never' },
  medical: { conditions: ['none'], medications: 'Metformin 500 mg', allergies: 'Penicillin', pregnancies: 2 },
  mental: { phq1: '2', phq2: '0', phq3: '1', phq4: '3' },
  checkups: { lastCheckup: 'lt6m' },
};

test('builds the engine profile from answers, sending only what the engine reads', () => {
  const profile = buildProfile(answers, new Date('2026-10-25T12:00:00'));
  expect(profile).toEqual({
    age: 51,
    sex: 'female',
    country: 'IN',
    height: 160,
    weight: 68,
    smoking: 'never',
    auditFrequency: 'never',
    conditions: ['none'],
    pregnancies: 2,
    phq1: 2,
    phq2: 0,
    phq3: 1,
    phq4: 3,
  });
  expect(JSON.stringify(profile)).not.toMatch(/Metformin|Penicillin|_status|dateOfBirth/);
});

test('profile keys change only when the profile changes', () => {
  expect(profileKey({ a: 1, b: 'x' })).toBe(profileKey({ b: 'x', a: 1 }));
  expect(profileKey({ a: 1 })).not.toBe(profileKey({ a: 2 }));
});

test('missing fields link to the section that asks for them', () => {
  expect(sectionForField('age')).toBe('about');
  expect(sectionForField('totalCholesterol')).toBe('vitals');
  expect(sectionForField('parentsHypertension')).toBe('medical');
  expect(sectionForField('snoring')).toBe('sleep');
});

describe('calculateAssessment', () => {
  test('calculates every score on the device without any request', async () => {
    global.fetch = jest.fn();
    const result = await calculateAssessment(buildProfile(answers, new Date('2026-10-25')));
    expect(result.engineVersion).toBe('1.0.0');
    expect(Object.keys(result.scores)).toEqual([
      'bodyComposition', 'whoCvd', 'prevent', 'framinghamHtn', 'findrisc', 'mlDiabetes', 'phq4', 'stopBang', 'auditC',
    ]);
    expect(result.scores.phq4).toMatchObject({ status: 'ok', value: 6 });
    expect(global.fetch).not.toHaveBeenCalled();
    delete global.fetch;
  });

  test('rejects profiles the engine cannot use', async () => {
    const error = await calculateAssessment({ age: 40, systolic: 400 }).catch((e) => e);
    expect(error).toBeInstanceOf(RiskError);
    expect(error.code).toBe('invalid');
  });
});
