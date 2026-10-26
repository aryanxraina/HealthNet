// AHA PREVENT equations (port of risk/prevent.py): 10- and 30-year risk of total cardiovascular
// disease, atherosclerotic CVD and heart failure, for adults aged 30-79 without known CVD.
//
// Khan SS, Matsushita K, Sang Y, et al. Circulation 2024;149:430-449 (with the 2026 erratum swapping
// the HbA1c terms). Coefficients from the `preventr` R package (MIT licence). The HbA1c model is used
// when HbA1c is known, otherwise the base model.
import COEFFICIENTS from './data/prevent.json';
import { bmiOf, diabetesFromLabs, egfrValue, hasCondition, hasDiabetes, missing } from './profile';
import { band, needsInput, notApplicable, ok, percent, pyRound } from './result';

export const MODEL = {
  id: 'prevent',
  name: 'AHA PREVENT equations',
  reference: 'Khan SS et al. Circulation 2024;149:430-449',
};

const AGE_RANGE = [30, 79];
const THIRTY_YEAR_MAX_AGE = 59; // 30-year estimates are not advised beyond this age
const MMOL_PER_MG_DL_CHOLESTEROL = 0.02586;

// Ranges the equations were developed for (preventr's validity checks)
const VALID = {
  totalCholesterol: [130, 320],
  hdlCholesterol: [20, 100],
  systolic: [90, 180],
  bmi: [18.5, 39.9],
  egfr: [15, 140],
  hba1c: [4.5, 15],
};

// The bands of the WHO charts, so all 10-year CVD risks in HealthNet read the same way
const BAND_CUTS = [5, 10, 20, 30];
const BAND_NAMES = ['lt5', '5to10', '10to20', '20to30', 'gte30'];

// Model terms, centred as in the published equations. Cholesterol in mg/dL.
export const terms = ({ age, totalC, hdlC, sbp, diabetes, smoking, bmi, egfr, bpTx, statin, hba1c }) => {
  const ageT = (age - 55) / 10;
  const nonHdl = (totalC - hdlC) * MMOL_PER_MG_DL_CHOLESTEROL - 3.5;
  const hdl = (hdlC * MMOL_PER_MG_DL_CHOLESTEROL - 1.3) / 0.3;
  const sbpGte110 = (Math.max(sbp, 110) - 130) / 20;
  const bmiGte30 = (Math.max(bmi, 30) - 30) / 5;
  const egfrLt60 = (Math.min(egfr, 60) - 60) / -15;
  const [dm, smk, bp, st] = [diabetes, smoking, bpTx, statin].map((x) => (x ? 1 : 0));
  const values = {
    age: ageT,
    ageSquared: ageT ** 2,
    nonHdl,
    hdl,
    sbpLt110: (Math.min(sbp, 110) - 110) / 20,
    sbpGte110,
    diabetes: dm,
    smoking: smk,
    bmiLt30: (Math.min(bmi, 30) - 25) / 5,
    bmiGte30,
    egfrLt60,
    egfrGte60: (Math.max(egfr, 60) - 90) / -15,
    bpTx: bp,
    statin: st,
    bpTxSbpGte110: bp * sbpGte110,
    statinNonHdl: st * nonHdl,
    ageNonHdl: ageT * nonHdl,
    ageHdl: ageT * hdl,
    ageSbpGte110: ageT * sbpGte110,
    ageDiabetes: ageT * dm,
    ageSmoking: ageT * smk,
    ageBmiGte30: ageT * bmiGte30,
    ageEgfrLt60: ageT * egfrLt60,
    constant: 1,
  };
  if (hba1c !== undefined && hba1c !== null) {
    values.hba1cNoDm = diabetes ? 0 : hba1c - 5.3;
    values.hba1cDm = diabetes ? hba1c - 5.3 : 0;
    values.missingHba1c = 0;
  }
  return values;
};

// { outcome: probability } for one sex and horizon ('10yr' or '30yr'); terms are summed in the published order
const estimate = (sex, horizon, values, model) =>
  Object.fromEntries(
    Object.entries(COEFFICIENTS[model][horizon][sex]).map(([outcome, betas]) => {
      const logOdds = Object.entries(betas).reduce((sum, [term, beta]) => sum + beta * values[term], 0);
      return [outcome, 1 / (1 + Math.exp(-logOdds))];
    })
  );

const percents = (probabilities) => Object.fromEntries(Object.entries(probabilities).map(([outcome, p]) => [outcome, percent(p)]));

export const assess = (profile) => {
  const absent = missing(
    profile, 'age', 'sex', 'systolic', 'totalCholesterol', 'hdlCholesterol', ['egfr', 'creatinine'],
    'bpMedication', 'statin', 'smoking', 'height', 'weight'
  );
  if (absent.length) return needsInput(MODEL, absent);
  if (!(AGE_RANGE[0] <= profile.age && profile.age <= AGE_RANGE[1])) {
    return notApplicable(MODEL, 'ageRange', { min: AGE_RANGE[0], max: AGE_RANGE[1] });
  }
  if (hasCondition(profile, 'heartDisease') || hasCondition(profile, 'stroke')) return notApplicable(MODEL, 'existingCvd');

  const [egfr, egfrSource] = egfrValue(profile);
  const bmi = bmiOf(profile);
  const measured = {
    totalCholesterol: profile.totalCholesterol,
    hdlCholesterol: profile.hdlCholesterol,
    systolic: profile.systolic,
    bmi,
    egfr,
    hba1c: profile.hba1c,
  };
  for (const [field, value] of Object.entries(measured)) {
    const [low, high] = VALID[field];
    if (value !== undefined && value !== null && !(low <= value && value <= high)) {
      return notApplicable(MODEL, 'outOfRange', { field, min: low, max: high });
    }
  }

  const assumptions = [];
  if (profile.statin === 'unsure') assumptions.push('statinAssumedNo');
  if (diabetesFromLabs(profile) && !hasCondition(profile, 'diabetes')) assumptions.push('diabetesFromLabs');
  const model = profile.hba1c !== undefined ? 'hba1c' : 'base';
  const values = terms({
    age: profile.age,
    totalC: profile.totalCholesterol,
    hdlC: profile.hdlCholesterol,
    sbp: profile.systolic,
    diabetes: hasDiabetes(profile),
    smoking: profile.smoking === 'current',
    bmi,
    egfr,
    bpTx: profile.bpMedication === 'yes',
    statin: profile.statin === 'yes',
    hba1c: profile.hba1c,
  });
  const tenYear = estimate(profile.sex, '10yr', values, model);
  const thirtyYear = profile.age <= THIRTY_YEAR_MAX_AGE ? estimate(profile.sex, '30yr', values, model) : null;

  const value = percent(tenYear.totalCvd);
  const level = band(value, BAND_CUTS);
  return ok(MODEL, value, {
    unit: '%',
    category: BAND_NAMES[level],
    level,
    details: {
      variant: model,
      horizonYears: 10,
      tenYear: percents(tenYear),
      thirtyYear: thirtyYear ? percents(thirtyYear) : null,
      egfr: pyRound(egfr),
      egfrSource,
    },
    assumptions,
  });
};
