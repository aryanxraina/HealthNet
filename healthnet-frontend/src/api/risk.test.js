import { buildProfile, fetchAssessment, profileKey, RiskApiError, sectionForField } from './risk';

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

describe('fetchAssessment', () => {
  afterEach(() => {
    delete global.fetch;
  });

  test('sends the profile with the signed-in user token', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ scores: {} }) });
    await expect(fetchAssessment({ age: 40 })).resolves.toEqual({ scores: {} });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/risk/assessment');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(options.body)).toEqual({ age: 40 });
  });

  test.each([
    [401, 'auth'],
    [422, 'invalid'],
    [503, 'notConfigured'],
    [500, 'unknown'],
  ])('maps HTTP %i to %s', async (status, code) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
    await expect(fetchAssessment({})).rejects.toMatchObject({ code });
  });

  test('reports an unreachable API', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await fetchAssessment({}).catch((e) => e);
    expect(error).toBeInstanceOf(RiskApiError);
    expect(error.code).toBe('unavailable');
  });
});
