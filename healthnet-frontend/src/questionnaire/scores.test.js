import { SCORES, readyScoreIds, scoreReadiness, scoresForSection } from './scores';

const score = (id) => SCORES.find((item) => item.id === id);

test('AUDIT-C needs the follow-up answers only from people who drink', () => {
  expect(scoreReadiness(score('auditC'), { lifestyle: { auditFrequency: 'never' } }).state).toBe('ready');
  expect(scoreReadiness(score('auditC'), { lifestyle: { auditFrequency: 'monthly' } })).toEqual({ state: 'missing', missing: 2 });
});

test('the experimental diabetes model is not offered to men', () => {
  expect(scoreReadiness(score('mlDiabetes'), { about: { gender: 'male' } }).state).toBe('notApplicable');
  expect(scoreReadiness(score('mlDiabetes'), { about: { gender: 'female' } }).state).toBe('missing');
});

test('PREVENT accepts creatinine instead of eGFR', () => {
  const answers = {
    about: { dateOfBirth: '1970-05-01', gender: 'male', height: 180, weight: 82 },
    lifestyle: { smoking: 'never' },
    medical: { bpMedication: 'no', statin: 'no', conditions: ['none'] },
    vitals: { systolic: 128, totalCholesterol: 190, hdlCholesterol: 50, creatinine: 0.9 },
  };
  expect(scoreReadiness(score('prevent'), answers).state).toBe('ready');
});

test('a non-binary gender also needs the sex used for calculations', () => {
  const answers = { about: { gender: 'nonBinary', height: 170, weight: 70 } };
  expect(readyScoreIds(answers)).toEqual(['bodyComposition']);
  expect(scoreReadiness(score('stopBang'), answers).missing).toBeGreaterThan(scoreReadiness(score('stopBang'), {
    about: { gender: 'nonBinary', riskSex: 'male', height: 170, weight: 70 },
  }).missing);
});

test('sections list the scores they feed', () => {
  expect(scoresForSection('mental')).toEqual(['phq4']);
  expect(scoresForSection('lifestyle')).toEqual(expect.arrayContaining(['auditC', 'findrisc', 'whoCvd']));
  expect(scoresForSection('devices')).toEqual([]);
});
