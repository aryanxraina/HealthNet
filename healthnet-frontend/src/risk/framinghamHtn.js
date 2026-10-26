// Framingham hypertension risk (port of risk/framingham_htn.py): 1-, 2- and 4-year risk of
// developing high blood pressure, for adults without hypertension or diabetes.
//
// Parikh NI, Pencina MJ, Wang TJ, et al. Ann Intern Med 2008;148:102-110. Weibull model with the
// full-precision coefficients of the Framingham Heart Study's online calculator:
//     risk(t) = 1 - exp(-exp((ln t - (intercept + Σ βx)) / scale))
import { bmiOf, hasDiabetes, missing, treatedOrKnownHypertension } from './profile';
import { band, needsInput, notApplicable, ok, percent } from './result';

export const MODEL = {
  id: 'framinghamHtn',
  name: 'Framingham hypertension risk score',
  reference: 'Parikh NI et al. Ann Intern Med 2008;148:102-110',
};

const INTERCEPT = 22.949536;
const SCALE = 0.876925;
const BETA = {
  female: -0.202933,
  age: -0.156412,
  bmi: -0.033881,
  sbp: -0.05933,
  dbp: -0.128468,
  smoker: -0.190731,
  parents: -0.166121, // number of parents with high blood pressure (0-2)
  age_dbp: 0.001624,
};

// Limits of the official calculator; at 140/90 or above, blood pressure is already high
const AGE_RANGE = [20, 80];
const SBP_LIMIT = 140;
const DBP_LIMIT = 90;

// HealthNet display bands for 4-year risk (the paper defines no categories)
const BAND_CUTS = [10, 20];
const BAND_NAMES = ['low', 'moderate', 'high'];

const PARENTS = { none: 0, one: 1, both: 2, unsure: 0 };

// The calculator's "optimal" comparison person: same age and sex, BMI 22.5, BP 110.5/70.5, non-smoker
const OPTIMAL = { bmi: 22.5, sbp: 110.5, dbp: 70.5, smoker: false, parents: 0 };

// { 1: p, 2: p, 4: p } - probability of new hypertension within 1, 2 and 4 years
export const risks = ({ age, female, bmi, sbp, dbp, smoker, parents }) => {
  const x = { female: female ? 1 : 0, age, bmi, sbp, dbp, smoker: smoker ? 1 : 0, parents, age_dbp: age * dbp };
  const mu = INTERCEPT + Object.entries(x).reduce((sum, [name, value]) => sum + BETA[name] * value, 0);
  return Object.fromEntries([1, 2, 4].map((years) => [years, 1 - Math.exp(-Math.exp((Math.log(years) - mu) / SCALE))]));
};

export const assess = (profile) => {
  const absent = missing(profile, 'age', 'sex', 'systolic', 'diastolic', 'height', 'weight', 'smoking', 'parentsHypertension');
  if (absent.length) return needsInput(MODEL, absent);
  if (treatedOrKnownHypertension(profile)) return notApplicable(MODEL, 'alreadyHypertension');
  if (profile.systolic >= SBP_LIMIT || profile.diastolic >= DBP_LIMIT) {
    return notApplicable(MODEL, 'highReading', { systolic: SBP_LIMIT, diastolic: DBP_LIMIT });
  }
  if (hasDiabetes(profile)) return notApplicable(MODEL, 'diabetes');
  if (!(AGE_RANGE[0] <= profile.age && profile.age <= AGE_RANGE[1])) {
    return notApplicable(MODEL, 'ageRange', { min: AGE_RANGE[0], max: AGE_RANGE[1] });
  }

  const person = { age: profile.age, female: profile.sex === 'female' };
  const result = risks({
    ...person,
    bmi: bmiOf(profile),
    sbp: profile.systolic,
    dbp: profile.diastolic,
    smoker: profile.smoking === 'current',
    parents: PARENTS[profile.parentsHypertension],
  });
  const optimal = risks({ ...person, ...OPTIMAL });

  const value = percent(result[4]);
  const level = band(value, BAND_CUTS);
  return ok(MODEL, value, {
    unit: '%',
    category: BAND_NAMES[level],
    level: Math.min(level * 2, 4),
    details: {
      horizonYears: 4,
      oneYear: percent(result[1]),
      twoYear: percent(result[2]),
      fourYear: value,
      optimalFourYear: percent(optimal[4]),
    },
    assumptions: profile.parentsHypertension === 'unsure' ? ['parentsAssumedNone'] : [],
  });
};
