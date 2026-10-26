// Experimental diabetes estimate from HealthNet's own model (port of risk/ml_diabetes.py), trained on
// the Pima Indians Diabetes dataset (768 women aged 21+ of Pima heritage). See train_diabetes_model.py.
// The fitted pipeline (median imputer -> standard scaler -> logistic regression) is exported to
// data/diabetes_model.json by risk/export_frontend.py, so no scikit-learn is needed here.
//
// Shown only as an alternative to FINDRISC, and only for women aged 21 or over, because:
// - the training data covers a single population of women;
// - the dataset's glucose is a 2-hour oral glucose tolerance test, but we pass fasting glucose;
// - skin thickness and insulin are not asked, so the model fills in typical values;
// - the "diabetes pedigree" input is estimated from the family-history answer.
import PIPELINE from './data/diabetes_model.json';
import { bmiOf, hasCondition, missing } from './profile';
import { band, needsInput, notApplicable, ok, percent } from './result';

export const MODEL = {
  id: 'mlDiabetes',
  name: 'HealthNet experimental model (logistic regression, Pima dataset)',
  reference: 'Smith JW et al. Proc Annu Symp Comput Appl Med Care 1988:261-265 (dataset)',
  experimental: true,
};

// Quartiles of DiabetesPedigreeFunction in diabetes.csv, standing in for the family-history answer
const PEDIGREE = { no: 0.244, extended: 0.372, immediate: 0.626 };

// HealthNet display bands for the estimated probability
const BAND_CUTS = [20, 40, 60];
const BAND_NAMES = ['low', 'moderate', 'high', 'veryHigh'];

// Same steps as the scikit-learn pipeline's predict_proba
export const predictProbability = (features) => {
  const columns = PIPELINE.columnOrder.map((name) => {
    const value = features[name];
    return name in PIPELINE.medians && value === PIPELINE.missingValue ? PIPELINE.medians[name] : value;
  });
  const scaled = columns.map((value, index) => (value - PIPELINE.mean[index]) / PIPELINE.scale[index]);
  const decision = scaled.reduce((sum, value, index) => sum + value * PIPELINE.coef[index], 0) + PIPELINE.intercept;
  return 1 / (1 + Math.exp(-decision));
};

export const assess = (profile) => {
  const absent = missing(profile, 'age', 'sex', 'fastingGlucose', 'diastolic', 'height', 'weight', 'familyDiabetes', 'pregnancies');
  if (profile.sex === 'male') return notApplicable(MODEL, 'womenOnly');
  if (absent.length) return needsInput(MODEL, absent);
  if (profile.age < 21) return notApplicable(MODEL, 'ageMin', { min: 21 });
  if (hasCondition(profile, 'diabetes')) return notApplicable(MODEL, 'alreadyDiabetes');

  const probability = predictProbability({
    Pregnancies: profile.pregnancies,
    Glucose: profile.fastingGlucose,
    BloodPressure: profile.diastolic,
    SkinThickness: 0, // 0 = not measured; the pipeline fills in the median
    Insulin: 0,
    BMI: bmiOf(profile),
    DiabetesPedigreeFunction: PEDIGREE[profile.familyDiabetes],
    Age: profile.age,
  });
  const value = percent(probability);
  const level = band(value, BAND_CUTS);
  return ok(MODEL, value, {
    unit: '%',
    category: BAND_NAMES[level],
    level: [0, 2, 3, 4][level],
    details: { experimental: true },
    assumptions: ['fastingGlucoseForOgtt', 'skinInsulinImputed', 'pedigreeFromFamilyHistory'],
  });
};
