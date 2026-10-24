import { isAnswered, riskSexOf, valueAt } from './answers';

// Which answers each score needs, so the questionnaire can show what's unlocked.
// This is only a hint for the UI; the risk engine makes the final call (age ranges etc.).
// A nested array means "any one of these".
const BODY = ['about.height', 'about.weight'];

export const SCORES = [
  { id: 'bodyComposition', requires: [...BODY] },
  {
    id: 'whoCvd',
    needsSex: true,
    requires: ['about.dateOfBirth', 'about.country', 'lifestyle.smoking', 'vitals.systolic', ...BODY],
  },
  {
    id: 'framinghamHtn',
    needsSex: true,
    requires: ['about.dateOfBirth', 'vitals.systolic', 'vitals.diastolic', 'lifestyle.smoking', 'medical.parentsHypertension', ...BODY],
  },
  {
    id: 'prevent',
    needsSex: true,
    requires: [
      'about.dateOfBirth',
      'vitals.systolic',
      'vitals.totalCholesterol',
      'vitals.hdlCholesterol',
      ['vitals.egfr', 'vitals.creatinine'],
      'medical.bpMedication',
      'medical.statin',
      'medical.conditions',
      'lifestyle.smoking',
      ...BODY,
    ],
  },
  {
    id: 'findrisc',
    needsSex: true,
    requires: [
      'about.dateOfBirth',
      'about.waist',
      'lifestyle.dailyActivity',
      'lifestyle.fruitVeg',
      'medical.bpMedication',
      'medical.highGlucoseHistory',
      'medical.familyDiabetes',
      ...BODY,
    ],
  },
  {
    id: 'mlDiabetes',
    needsSex: true,
    womenOnly: true,
    requires: ['about.dateOfBirth', 'vitals.fastingGlucose', 'vitals.diastolic', 'medical.pregnancies', 'medical.familyDiabetes', ...BODY],
  },
  { id: 'phq4', requires: ['mental.phq1', 'mental.phq2', 'mental.phq3', 'mental.phq4'] },
  {
    id: 'stopBang',
    needsSex: true,
    requires: ['sleep.snoring', 'sleep.tired', 'sleep.observedApnea', 'about.neck', 'about.dateOfBirth', 'medical.bpMedication', ...BODY],
  },
  {
    id: 'auditC',
    requires: ['lifestyle.auditFrequency'],
    // Drinkers also answer how much and how often they binge
    extra: (answers) =>
      answers.lifestyle?.auditFrequency && answers.lifestyle.auditFrequency !== 'never'
        ? ['lifestyle.auditTypical', 'lifestyle.auditBinge']
        : [],
  },
];

const satisfied = (answers, requirement) =>
  Array.isArray(requirement)
    ? requirement.some((path) => isAnswered(valueAt(answers, path)))
    : isAnswered(valueAt(answers, requirement));

const requirementsOf = (score, answers) => [
  ...score.requires,
  ...(score.extra ? score.extra(answers) : []),
  ...(score.needsSex ? ['about.gender'] : []),
];

// { state: 'ready' | 'missing' | 'notApplicable', missing: number }
export const scoreReadiness = (score, answers) => {
  if (score.womenOnly && riskSexOf(answers) === 'male') {
    return { state: 'notApplicable', missing: 0 };
  }
  const requirements = requirementsOf(score, answers);
  // "Which sex for calculations" counts too when gender isn't female/male
  const missing =
    requirements.filter((requirement) => !satisfied(answers, requirement)).length +
    (score.needsSex && isAnswered(answers.about?.gender) && !riskSexOf(answers) ? 1 : 0);
  return { state: missing === 0 ? 'ready' : 'missing', missing };
};

export const readyScoreIds = (answers) =>
  SCORES.filter((score) => scoreReadiness(score, answers).state === 'ready').map((score) => score.id);

// Scores that use answers from a section, for the "Helps unlock" chips
export const scoresForSection = (sectionId) =>
  SCORES.filter((score) =>
    score.requires.flat().some((path) => path.startsWith(`${sectionId}.`)) ||
    (score.id === 'auditC' && sectionId === 'lifestyle')
  ).map((score) => score.id);
