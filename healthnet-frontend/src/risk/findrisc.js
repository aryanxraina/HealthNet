// FINDRISC (port of risk/findrisc.py): Finnish Diabetes Risk Score for the 10-year risk of type 2
// diabetes (0-26 points). Lindström J, Tuomilehto J. Diabetes Care 2003;26:725-731.
import { bmiOf, hasCondition, missing } from './profile';
import { band, needsInput, notApplicable, ok } from './result';

export const MODEL = {
  id: 'findrisc',
  name: 'FINDRISC (Finnish Diabetes Risk Score)',
  reference: 'Lindström J, Tuomilehto J. Diabetes Care 2003;26:725-731',
};

// Total score bands and the published estimate of how many people in each band develop diabetes in 10 years
const BAND_CUTS = [7, 12, 15, 21];
const BAND_NAMES = ['low', 'slightlyElevated', 'moderate', 'high', 'veryHigh'];
const TEN_YEAR_RISK = ['1 in 100', '1 in 25', '1 in 6', '1 in 3', '1 in 2'];

const WAIST_CUTS = { male: [94, 102], female: [80, 88] }; // cm

export const points = ({ age, bmi, waist, sex, active, fruitVeg, bpMedication, highGlucose, family }) => {
  const [low, high] = WAIST_CUTS[sex];
  return {
    age: age < 45 ? 0 : age < 55 ? 2 : age < 65 ? 3 : 4,
    bmi: bmi < 25 ? 0 : bmi <= 30 ? 1 : 3,
    waist: waist < low ? 0 : waist <= high ? 3 : 4,
    activity: active ? 0 : 2,
    fruitVeg: fruitVeg ? 0 : 1,
    bpMedication: bpMedication ? 2 : 0,
    highGlucose: highGlucose ? 5 : 0,
    family: { no: 0, extended: 3, immediate: 5 }[family],
  };
};

export const assess = (profile) => {
  const absent = missing(
    profile, 'age', 'sex', 'height', 'weight', 'waist', 'dailyActivity', 'fruitVeg',
    'bpMedication', 'highGlucoseHistory', 'familyDiabetes'
  );
  if (absent.length) return needsInput(MODEL, absent);
  if (profile.age < 18) return notApplicable(MODEL, 'adultsOnly');
  if (hasCondition(profile, 'diabetes')) return notApplicable(MODEL, 'alreadyDiabetes');

  const breakdown = points({
    age: profile.age,
    bmi: bmiOf(profile),
    waist: profile.waist,
    sex: profile.sex,
    active: profile.dailyActivity === 'yes',
    fruitVeg: profile.fruitVeg === 'yes',
    bpMedication: profile.bpMedication === 'yes',
    highGlucose: profile.highGlucoseHistory === 'yes',
    family: profile.familyDiabetes,
  });
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const level = band(total, BAND_CUTS);
  return ok(MODEL, total, {
    unit: 'points',
    category: BAND_NAMES[level],
    level,
    details: { maxPoints: 26, points: breakdown, tenYearRisk: TEN_YEAR_RISK[level], horizonYears: 10 },
  });
};
