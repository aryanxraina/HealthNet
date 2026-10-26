// The health profile every calculator reads (port of risk/profile.py).
//
// Field names match the questionnaire question ids, and measurements are in standard units:
// cm, kg, mmHg, mg/dL, %, mL/min/1.73m². validateProfile applies the same rules as the Python
// validator; anything else in the input is ignored.

export class RiskInputError extends Error {
  constructor(field) {
    super(`Invalid risk profile field: ${field}`);
    this.code = 'invalid';
    this.field = field;
  }
}

const YES_NO = ['yes', 'no'];
const CONDITIONS = ['diabetes', 'hypertension', 'heartDisease', 'stroke', 'kidneyDisease', 'asthma', 'none'];

// field: ['int' | 'float', min, max] or ['choice', options] or ['conditions'] or ['country']
const RULES = {
  age: ['int', 0, 120],
  sex: ['choice', ['female', 'male']],
  country: ['country'],
  height: ['float', 50, 250],
  weight: ['float', 20, 300],
  waist: ['float', 40, 200],
  neck: ['float', 20, 70],
  smoking: ['choice', ['never', 'former', 'current']],
  dailyActivity: ['choice', YES_NO],
  fruitVeg: ['choice', YES_NO],
  auditFrequency: ['choice', ['never', 'monthly', 'twoToFourMonth', 'twoToThreeWeek', 'fourPlusWeek']],
  auditTypical: ['choice', ['oneTwo', 'threeFour', 'fiveSix', 'sevenNine', 'tenPlus']],
  auditBinge: ['choice', ['never', 'lessMonthly', 'monthly', 'weekly', 'daily']],
  conditions: ['conditions'],
  bpMedication: ['choice', YES_NO],
  statin: ['choice', ['yes', 'no', 'unsure']],
  highGlucoseHistory: ['choice', YES_NO],
  familyDiabetes: ['choice', ['no', 'extended', 'immediate']],
  parentsHypertension: ['choice', ['none', 'one', 'both', 'unsure']],
  pregnancies: ['int', 0, 20],
  systolic: ['float', 70, 250],
  diastolic: ['float', 40, 150],
  fastingGlucose: ['float', 40, 600],
  hba1c: ['float', 3, 20],
  totalCholesterol: ['float', 70, 500],
  hdlCholesterol: ['float', 10, 150],
  egfr: ['float', 5, 200],
  creatinine: ['float', 0.2, 15],
  phq1: ['choice', [0, 1, 2, 3]],
  phq2: ['choice', [0, 1, 2, 3]],
  phq3: ['choice', [0, 1, 2, 3]],
  phq4: ['choice', [0, 1, 2, 3]],
  snoring: ['choice', YES_NO],
  tired: ['choice', YES_NO],
  observedApnea: ['choice', YES_NO],
};

const checkNumber = (field, value, integer, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < min || value > max) {
    throw new RiskInputError(field);
  }
  return value;
};

// A clean profile object with only known fields; throws RiskInputError like the API's 422
export const validateProfile = (input) => {
  const profile = {};
  Object.entries(RULES).forEach(([field, [kind, ...args]]) => {
    const value = input?.[field];
    if (value === undefined || value === null) return;
    if (kind === 'int' || kind === 'float') {
      profile[field] = checkNumber(field, value, kind === 'int', args[0], args[1]);
    } else if (kind === 'choice') {
      if (!args[0].includes(value)) throw new RiskInputError(field);
      profile[field] = value;
    } else if (kind === 'country') {
      if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value)) throw new RiskInputError(field);
      profile[field] = value;
    } else if (kind === 'conditions') {
      if (!Array.isArray(value) || value.some((item) => !CONDITIONS.includes(item))) throw new RiskInputError(field);
      profile[field] = [...value];
    }
  });
  return profile;
};

// Names of the fields that are still empty. An array means "any one of these"; its first name is reported.
export const missing = (profile, ...fields) =>
  fields
    .map((field) => (Array.isArray(field) ? field : [field]))
    .filter((options) => options.every((name) => profile[name] === undefined))
    .map((options) => options[0]);

export const bmiOf = (profile) =>
  profile.height === undefined || profile.weight === undefined ? null : profile.weight / (profile.height / 100) ** 2;

export const hasCondition = (profile, condition) => (profile.conditions || []).includes(condition);

// HbA1c ≥ 6.5% or fasting glucose ≥ 126 mg/dL meets the diagnostic threshold for diabetes
export const diabetesFromLabs = (profile) =>
  (profile.hba1c !== undefined && profile.hba1c >= 6.5) || (profile.fastingGlucose !== undefined && profile.fastingGlucose >= 126);

export const hasDiabetes = (profile) => hasCondition(profile, 'diabetes') || diabetesFromLabs(profile);

export const treatedOrKnownHypertension = (profile) => profile.bpMedication === 'yes' || hasCondition(profile, 'hypertension');

// Inker LA et al. N Engl J Med 2021;385:1737-49 (race-free CKD-EPI creatinine equation)
export const ckdEpi2021 = (creatinineMgDl, age, sex) => {
  const female = sex === 'female';
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = creatinineMgDl / kappa;
  const egfr = 142 * Math.min(ratio, 1) ** alpha * Math.max(ratio, 1) ** -1.2 * 0.9938 ** age;
  return female ? egfr * 1.012 : egfr;
};

// [eGFR, source]: the entered value, or one estimated from creatinine
export const egfrValue = (profile) => {
  if (profile.egfr !== undefined) return [profile.egfr, 'entered'];
  if (profile.creatinine === undefined || profile.age === undefined || profile.sex === undefined) return [null, null];
  return [ckdEpi2021(profile.creatinine, profile.age, profile.sex), 'creatinine'];
};
