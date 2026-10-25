import { ageFrom, bmiFrom, riskSexOf } from '../questionnaire/answers';
import { detailLines, missingLabel, reasonText } from '../lib/scoreText';
import { formatMeasurement } from '../lib/units';
import { suggestionIds } from './suggestions';
import { medicationSummary } from '../lib/medicationText';

// Everything the PDF report card shows, as plain text, so the PDF component only lays it out.
// The PDF uses the built-in Helvetica font, which lacks a few symbols; pdfSafe swaps those for ASCII.

const REPORT_SCORES = ['whoCvd', 'prevent', 'framinghamHtn', 'findrisc', 'mlDiabetes', 'bodyComposition', 'phq4', 'stopBang', 'auditC'];

const SYMBOLS = { '≥': '>=', '≤': '<=', '→': '->', '✓': '', ' ': ' ' };
export const pdfSafe = (text) => String(text).replace(/[≥≤→✓ ]/g, (char) => SYMBOLS[char]);

const has = (value) =>
  value !== undefined && value !== null && value !== false && value !== '' && !(Array.isArray(value) && value.length === 0);

const valueText = (score) => {
  if (score.unit === '%') return `${score.value}%`;
  if (score.unit === 'points') return score.details.maxPoints ? `${score.value} / ${score.details.maxPoints}` : String(score.value);
  return `${score.value} ${score.unit}`;
};

const scoreRow = (id, score, t) => {
  const row = {
    id,
    title: t(`questionnaire.scores.${id}`),
    status: score.status,
    model: `${score.model.name}. ${score.model.reference}.`,
  };
  if (score.status === 'ok') {
    return {
      ...row,
      value: valueText(score),
      category: t(`dashboard.risk.categories.${id}.${score.category}`),
      level: score.level,
      horizon: score.details.horizonYears ? t('dashboard.risk.horizon', { years: score.details.horizonYears }) : '',
      notes: detailLines(id, score, t).filter(Boolean),
      assumptions: score.assumptions.map((code) => t(`dashboard.risk.assumptions.${code}`)),
    };
  }
  if (score.status === 'needs_input') return { ...row, notes: [missingLabel(score.missing, t)] };
  return { ...row, notes: [reasonText(score, t)] };
};

const measurementRows = (answers, units, t) => {
  const about = answers.about || {};
  const vitals = answers.vitals || {};
  const label = (id) => t(`questionnaire.questions.${id}.label`);
  const rows = [];
  const add = (name, value) => has(value) && rows.push({ label: name, value });
  const measure = (kind, value) => (has(value) ? formatMeasurement(kind, value, units) : null);
  const fixed = (value, unit) => (has(value) ? `${value} ${unit}` : null);

  add(t('report.labels.height'), measure('height', about.height));
  add(t('report.labels.weight'), measure('weight', about.weight));
  const bmi = bmiFrom(about.height, about.weight);
  add('BMI', bmi ? `${bmi.toFixed(1)} kg/m²` : null);
  add(t('report.labels.waist'), measure('length', about.waist));
  add(t('report.labels.neck'), measure('length', about.neck));
  add(
    t('report.labels.bloodPressure'),
    has(vitals.systolic) ? `${vitals.systolic}${has(vitals.diastolic) ? `/${vitals.diastolic}` : ''} mmHg` : null
  );
  add(label('restingHeartRate'), fixed(vitals.restingHeartRate, 'bpm'));
  add(label('fastingGlucose'), measure('glucose', vitals.fastingGlucose));
  add('HbA1c', fixed(vitals.hba1c, '%'));
  add(label('totalCholesterol'), measure('cholesterol', vitals.totalCholesterol));
  add(label('hdlCholesterol'), measure('cholesterol', vitals.hdlCholesterol));
  add('eGFR', fixed(vitals.egfr, 'mL/min/1.73m²'));
  add(label('creatinine'), measure('creatinine', vitals.creatinine));
  add('SpO2', fixed(vitals.spo2, '%'));
  add(label('temperature'), measure('temperature', vitals.temperature));
  return rows;
};

const optionText = (t, questionId, value, optionSet) =>
  optionSet ? t(`questionnaire.optionSets.${optionSet}.${value}`) : t(`questionnaire.options.${questionId}.${value}`);

const historyRows = (answers, t) => {
  const lifestyle = answers.lifestyle || {};
  const medical = answers.medical || {};
  const rows = [];
  const add = (labelKey, value) => has(value) && rows.push({ label: t(labelKey), value });

  add('report.labels.conditions', medical.conditions?.map((c) => optionText(t, 'conditions', c)).join(', '));
  add('report.labels.bpMedication', has(medical.bpMedication) && optionText(t, 'bpMedication', medical.bpMedication, 'yesNo'));
  add('report.labels.statin', has(medical.statin) && optionText(t, 'statin', medical.statin, 'yesNoUnsure'));
  add('report.labels.medicationList', medical.medicationList?.map(medicationSummary).join('; '));
  add('report.labels.medications', medical.medications?.trim());
  add('report.labels.allergies', medical.allergies?.trim());
  add('report.labels.smoking', has(lifestyle.smoking) && optionText(t, 'smoking', lifestyle.smoking));
  add('report.labels.alcohol', has(lifestyle.auditFrequency) && optionText(t, 'auditFrequency', lifestyle.auditFrequency));
  add('report.labels.familyDiabetes', has(medical.familyDiabetes) && optionText(t, 'familyDiabetes', medical.familyDiabetes));
  add('report.labels.parentsHypertension', has(medical.parentsHypertension) && optionText(t, 'parentsHypertension', medical.parentsHypertension));
  add('report.labels.highGlucose', has(medical.highGlucoseHistory) && optionText(t, 'highGlucoseHistory', medical.highGlucoseHistory, 'yesNo'));
  add('report.labels.pregnancies', has(medical.pregnancies) && String(medical.pregnancies));
  return rows;
};

const countryName = (code, language) => {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code);
  } catch {
    return code;
  }
};

// Deep-copies strings through pdfSafe
const sanitize = (value) => {
  if (typeof value === 'string') return pdfSafe(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]));
  return value;
};

export const buildReport = ({ name, answers, results, settings, t, language = 'en', now = new Date() }) => {
  const scores = results?.scores || {};
  const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: 'long' });
  const age = ageFrom(answers.about?.dateOfBirth, now);
  const sex = riskSexOf(answers);
  const preferredDiabetes = settings?.diabetesModel === 'ml' ? 'mlDiabetes' : 'findrisc';
  const friendlyScores = REPORT_SCORES.filter((id) => scores[id] && (id === preferredDiabetes || !['findrisc', 'mlDiabetes'].includes(id)));

  return sanitize({
    name: name || t('report.you'),
    generatedOn: dateFormat.format(now),
    calculatedOn: results?.calculatedAt ? dateFormat.format(new Date(results.calculatedAt)) : null,
    engineVersion: results?.engineVersion || null,
    person: [
      { label: t('report.labels.age'), value: age !== null ? String(age) : '—' },
      { label: t('report.labels.sex'), value: sex ? t(`questionnaire.options.riskSex.${sex}`) : '—' },
      { label: t('report.labels.country'), value: countryName(answers.about?.country, language) || '—' },
    ],
    // Page 1 shows the chosen diabetes model; the doctor page shows every score
    friendlyScores: friendlyScores.map((id) => scoreRow(id, scores[id], t)),
    allScores: REPORT_SCORES.filter((id) => scores[id]).map((id) => scoreRow(id, scores[id], t)),
    suggestions: suggestionIds(scores, answers).map((id) => ({
      title: t(`report.suggestions.${id}.title`),
      body: t(`report.suggestions.${id}.body`),
    })),
    measurements: measurementRows(answers, settings?.units, t),
    history: historyRows(answers, t),
    disclaimer: t('dashboard.risk.disclaimer'),
  });
};
