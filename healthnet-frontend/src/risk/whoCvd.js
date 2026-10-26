// WHO 2019 cardiovascular disease risk (port of risk/who_cvd.py): 10-year risk of fatal or
// non-fatal heart attack or stroke.
//
// Kaptoge S, Pennells L, De Bacquer D, et al. Lancet Glob Health 2019;7:e1332-45. Coefficients and
// recalibration parameters from the authors' Stata implementation `whocvdrisk`. The laboratory model
// is used when total cholesterol is known, otherwise the non-laboratory (BMI) model, recalibrated to
// the person's WHO/GBD region as in the published charts.
import DATA from './data/who_cvd.json';
import { bmiOf, diabetesFromLabs, hasCondition, hasDiabetes, missing } from './profile';
import { band, needsInput, notApplicable, ok, percent } from './result';

export const MODEL = {
  id: 'whoCvd',
  name: 'WHO CVD risk charts (2019)',
  reference: 'Kaptoge S et al. Lancet Glob Health 2019;7:e1332-45',
};

const AGE_RANGE = [40, 80];
const CALIBRATION_YEAR = 2017; // latest year of GBD incidence the authors published parameters for
const MG_DL_PER_MMOL_CHOLESTEROL = 38.67;

// Log hazard ratios per endpoint and sex: main effects, interactions with (age - 60), baseline survival.
// Variables are centred at age 60, SBP 120 mmHg, total cholesterol 6 mmol/L and BMI 25 kg/m².
const LAB = {
  chd: {
    male: { age: 0.0719227, chol: 0.2284944, sbp: 0.0132183, dm: 0.6410114, smk: 0.5638109, chol_age: -0.0045806, sbp_age: -0.0001576, dm_age: -0.0124966, smk_age: -0.0182545, s0: 0.9540108 },
    female: { age: 0.1020713, chol: 0.2050377, sbp: 0.015823, dm: 1.070358, smk: 1.053223, chol_age: -0.0051932, sbp_age: -0.0001378, dm_age: -0.0234174, smk_age: -0.0332666, s0: 0.9894159 },
  },
  stroke: {
    male: { age: 0.0986578, chol: 0.029526, sbp: 0.0222629, dm: 0.6268712, smk: 0.4981217, chol_age: 0.00142, sbp_age: -0.0004147, dm_age: -0.026302, smk_age: -0.0150561, s0: 0.9849257 },
    female: { age: 0.1056632, chol: 0.0257782, sbp: 0.0206278, dm: 0.8581998, smk: 0.7443627, chol_age: -0.0021387, sbp_age: -0.0004897, dm_age: -0.0209826, smk_age: -0.0200822, s0: 0.9890569 },
  },
};
const NONLAB = {
  chd: {
    male: { age: 0.073593, bmi: 0.0337219, sbp: 0.0133937, smk: 0.5954767, bmi_age: -0.0010432, sbp_age: -0.0001837, smk_age: -0.0200831, s0: 0.9544258 },
    female: { age: 0.1049418, bmi: 0.0257616, sbp: 0.016726, smk: 1.093132, bmi_age: -0.0006537, sbp_age: -0.0001966, smk_age: -0.0343739, s0: 0.9887124 },
  },
  stroke: {
    male: { age: 0.097674, bmi: 0.0159518, sbp: 0.0227294, smk: 0.4999862, bmi_age: -0.0003516, sbp_age: -0.0004374, smk_age: -0.0153895, s0: 0.984826 },
    female: { age: 0.1046105, bmi: 0.0036406, sbp: 0.0216741, smk: 0.7399405, bmi_age: -0.0000129, sbp_age: -0.0005311, smk_age: -0.0203997, s0: 0.9885706 },
  },
};

// The bands used by the WHO charts: <5%, 5-<10%, 10-<20%, 20-<30%, ≥30%
const BAND_CUTS = [5, 10, 20, 30];
const BAND_NAMES = ['lt5', '5to10', '10to20', '20to30', 'gte30'];

export const regionFor = (country) => DATA.countryRegion[country] ?? null;

// Years up to 2015 use the 5-year period they fall in, as in the authors' Stata code
const calibrationYear = (year) => (year <= 2015 ? 5 * Math.floor(year / 5) : year);

const uncalibrated = (b, { ageC, sbpC, smoking, cholC, diabetes, bmiC }) => {
  let lp = b.age * ageC + b.sbp * sbpC + b.smk * smoking;
  lp += b.sbp_age * sbpC * ageC + b.smk_age * smoking * ageC;
  if (cholC !== undefined) {
    lp += b.chol * cholC + b.dm * diabetes;
    lp += b.chol_age * cholC * ageC + b.dm_age * diabetes * ageC;
  } else {
    lp += b.bmi * bmiC + b.bmi_age * bmiC * ageC;
  }
  return 1 - b.s0 ** Math.exp(lp);
};

// Complementary log-log recalibration: 1 - exp(-exp(cons + slope * log(-log(1 - risk))))
const recalibrate = (risk, cons, slope) => 1 - Math.exp(-Math.exp(cons + slope * Math.log(-Math.log(1 - risk))));

// 10-year CVD risk (0-1). Lab model when cholesterolMmol is given, otherwise the BMI model.
export const tenYearRisk = ({ age, sex, sbp, smoking, region, cholesterolMmol, diabetes = false, bmi, year = CALIBRATION_YEAR }) => {
  const lab = cholesterolMmol !== undefined && cholesterolMmol !== null;
  const params = DATA.calibration[region][sex][String(calibrationYear(year))];
  const modelName = lab ? 'lab' : 'nonlab';
  const centred = { ageC: age - 60, sbpC: sbp - 120, smoking: smoking ? 1 : 0 };
  if (lab) {
    centred.cholC = cholesterolMmol - 6;
    centred.diabetes = diabetes ? 1 : 0;
  } else {
    centred.bmiC = bmi - 25;
  }
  const [chd, stroke] = ['chd', 'stroke'].map((endpoint) => {
    const coefficients = (lab ? LAB : NONLAB)[endpoint][sex];
    const [cons, slope] = params[`${modelName}_${endpoint}`];
    return recalibrate(uncalibrated(coefficients, centred), cons, slope);
  });
  return 1 - (1 - chd) * (1 - stroke);
};

export const assess = (profile) => {
  const lab = profile.totalCholesterol !== undefined;
  const absent = missing(profile, 'age', 'sex', 'country', 'smoking', 'systolic', ...(lab ? [] : ['height', 'weight']));
  if (absent.length) return needsInput(MODEL, absent);
  if (!(AGE_RANGE[0] <= profile.age && profile.age <= AGE_RANGE[1])) {
    return notApplicable(MODEL, 'ageRange', { min: AGE_RANGE[0], max: AGE_RANGE[1] });
  }
  if (hasCondition(profile, 'heartDisease') || hasCondition(profile, 'stroke')) {
    // Risk charts are for people without established cardiovascular disease
    return notApplicable(MODEL, 'existingCvd');
  }
  const region = regionFor(profile.country);
  if (region === null) return notApplicable(MODEL, 'unknownCountry');

  const risk = tenYearRisk({
    age: profile.age,
    sex: profile.sex,
    sbp: profile.systolic,
    smoking: profile.smoking === 'current',
    region,
    cholesterolMmol: lab ? profile.totalCholesterol / MG_DL_PER_MMOL_CHOLESTEROL : undefined,
    diabetes: hasDiabetes(profile),
    bmi: lab ? undefined : bmiOf(profile),
  });
  const value = percent(risk);
  const level = band(value, BAND_CUTS);
  return ok(MODEL, value, {
    unit: '%',
    category: BAND_NAMES[level],
    level,
    details: { variant: lab ? 'lab' : 'nonlab', region, horizonYears: 10, calibrationYear: CALIBRATION_YEAR },
    assumptions: lab && diabetesFromLabs(profile) && !hasCondition(profile, 'diabetes') ? ['diabetesFromLabs'] : [],
  });
};
