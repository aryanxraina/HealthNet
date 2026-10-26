// Short validated screeners plus body measurements (port of risk/screeners.py).
//
// PHQ-4      Kroenke K et al. Psychosomatics 2009;50:613-621
// STOP-Bang  Chung F et al. Chest 2016;149:631-638 (scoring and the high-risk refinement)
// AUDIT-C    Bush K et al. Arch Intern Med 1998;158:1789-1795 (cut-offs: men ≥4, women ≥3)
// BMI        WHO adult categories; waist-to-height ratio bands from NICE NG246 (2023)
import { bmiOf, missing, treatedOrKnownHypertension } from './profile';
import { band, needsInput, notApplicable, ok, pyRound } from './result';

export const PHQ4 = { id: 'phq4', name: 'PHQ-4', reference: 'Kroenke K et al. Psychosomatics 2009;50:613-621' };
export const STOP_BANG = { id: 'stopBang', name: 'STOP-Bang', reference: 'Chung F et al. Chest 2016;149:631-638' };
export const AUDIT_C = { id: 'auditC', name: 'AUDIT-C', reference: 'Bush K et al. Arch Intern Med 1998;158:1789-1795' };
export const BODY = { id: 'bodyComposition', name: 'BMI and waist-to-height ratio', reference: 'WHO; NICE NG246 (2023)' };

export const phq4 = (profile) => {
  const absent = missing(profile, 'phq1', 'phq2', 'phq3', 'phq4');
  if (absent.length) return needsInput(PHQ4, absent);
  const anxiety = profile.phq1 + profile.phq2; // GAD-2
  const depression = profile.phq3 + profile.phq4; // PHQ-2
  const total = anxiety + depression;
  const level = band(total, [3, 6, 9]);
  return ok(PHQ4, total, {
    unit: 'points',
    category: ['normal', 'mild', 'moderate', 'severe'][level],
    level: [0, 1, 3, 4][level],
    details: {
      maxPoints: 12,
      anxiety,
      depression,
      // A subscale score of 3 or more is a positive screen and worth discussing with a professional
      anxietyPositive: anxiety >= 3,
      depressionPositive: depression >= 3,
    },
  });
};

export const stopBang = (profile) => {
  const absent = missing(profile, 'snoring', 'tired', 'observedApnea', 'age', 'sex', 'height', 'weight', 'neck', 'bpMedication');
  if (absent.length) return needsInput(STOP_BANG, absent);
  const items = {
    snoring: profile.snoring === 'yes',
    tired: profile.tired === 'yes',
    observed: profile.observedApnea === 'yes',
    pressure: treatedOrKnownHypertension(profile),
    bmi: bmiOf(profile) > 35,
    age: profile.age > 50,
    neck: profile.neck > 40,
    male: profile.sex === 'male',
  };
  const total = Object.values(items).filter(Boolean).length;
  const stop = [items.snoring, items.tired, items.observed, items.pressure].filter(Boolean).length;
  const high = total >= 5 || (stop >= 2 && (items.male || items.bmi || items.neck));
  let category;
  let level;
  if (high) [category, level] = ['high', 4];
  else if (total >= 3) [category, level] = ['intermediate', 2];
  else [category, level] = ['low', 0];
  return ok(STOP_BANG, total, { unit: 'points', category, level, details: { maxPoints: 8, items } });
};

const AUDIT_POINTS = {
  auditFrequency: { never: 0, monthly: 1, twoToFourMonth: 2, twoToThreeWeek: 3, fourPlusWeek: 4 },
  auditTypical: { oneTwo: 0, threeFour: 1, fiveSix: 2, sevenNine: 3, tenPlus: 4 },
  auditBinge: { never: 0, lessMonthly: 1, monthly: 2, weekly: 3, daily: 4 },
};

export const auditC = (profile) => {
  const drinks = profile.auditFrequency !== undefined && profile.auditFrequency !== 'never';
  const absent = missing(profile, 'auditFrequency', 'sex', ...(drinks ? ['auditTypical', 'auditBinge'] : []));
  if (absent.length) return needsInput(AUDIT_C, absent);
  // People who never drink score 0 and skip the two follow-up questions
  const total = drinks ? Object.entries(AUDIT_POINTS).reduce((sum, [field, table]) => sum + table[profile[field]], 0) : 0;
  const cutOff = profile.sex === 'male' ? 4 : 3;
  const positive = total >= cutOff;
  return ok(AUDIT_C, total, {
    unit: 'points',
    category: positive ? 'positive' : 'negative',
    level: positive ? (total >= 8 ? 4 : 3) : 0,
    details: { maxPoints: 12, cutOff },
  });
};

export const bodyComposition = (profile) => {
  const absent = missing(profile, 'height', 'weight');
  if (absent.length) return needsInput(BODY, absent);
  if (profile.age !== undefined && profile.age < 18) {
    // Children and teens need age- and sex-specific BMI charts
    return notApplicable(BODY, 'adultsOnly');
  }
  const bmi = pyRound(bmiOf(profile), 1);
  const index = band(bmi, [18.5, 25, 30, 35, 40]);
  const category = ['underweight', 'healthy', 'overweight', 'obese1', 'obese2', 'obese3'][index];
  const level = [2, 0, 1, 2, 3, 4][index];
  const details = { bmi };
  if (profile.waist !== undefined) {
    const ratio = pyRound(profile.waist / profile.height, 2);
    details.waistToHeight = ratio;
    details.waistToHeightCategory = ['healthy', 'increased', 'high'][band(ratio, [0.5, 0.6])];
  }
  return ok(BODY, bmi, { unit: 'kg/m²', category, level, details });
};
