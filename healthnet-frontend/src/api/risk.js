import { ApiError, apiFetch } from './client';
import { ageFrom, riskSexOf } from '../questionnaire/answers';
import { SECTIONS } from '../questionnaire/sections';

// Talks to the HealthNet risk engine (FINAL YEAR PROJECT/risk_api.py).
// The engine calculates on the fly and stores nothing; results are kept in Firestore by UserDataContext.

// Answers the engine reads (see risk/profile.py). Anything else, such as medications or
// allergies, never leaves the browser for this request.
const PROFILE_FIELDS = {
  about: ['country', 'height', 'weight', 'waist', 'neck'],
  lifestyle: ['smoking', 'dailyActivity', 'fruitVeg', 'auditFrequency', 'auditTypical', 'auditBinge'],
  medical: ['conditions', 'bpMedication', 'statin', 'highGlucoseHistory', 'familyDiabetes', 'parentsHypertension', 'pregnancies'],
  vitals: ['systolic', 'diastolic', 'fastingGlucose', 'hba1c', 'totalCholesterol', 'hdlCholesterol', 'egfr', 'creatinine'],
  mental: ['phq1', 'phq2', 'phq3', 'phq4'],
  sleep: ['snoring', 'tired', 'observedApnea'],
};

const PHQ_FIELDS = new Set(['phq1', 'phq2', 'phq3', 'phq4']);

// Questionnaire answers -> the engine's flat profile (standard units, age instead of date of birth)
export const buildProfile = (answers, today = new Date()) => {
  const profile = {};
  const age = ageFrom(answers.about?.dateOfBirth, today);
  if (age !== null) profile.age = age;
  const sex = riskSexOf(answers);
  if (sex) profile.sex = sex;
  Object.entries(PROFILE_FIELDS).forEach(([sectionId, fields]) => {
    fields.forEach((field) => {
      const value = answers[sectionId]?.[field];
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return;
      profile[field] = PHQ_FIELDS.has(field) ? Number(value) : value;
    });
  });
  return profile;
};

// Short fingerprint of a profile, to tell whether saved results still match the answers
export const profileKey = (profile) => {
  const text = JSON.stringify(Object.keys(profile).sort().map((key) => [key, profile[key]]));
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33 + text.charCodeAt(i)) % 4294967296;
  }
  return hash.toString(36);
};

// Which questionnaire section asks for a profile field, for "add this to unlock" links
export const sectionForField = (field) => {
  if (field === 'age') return 'about';
  if (field === 'sex') return 'about';
  return SECTIONS.find((section) => section.questions.some((question) => question.id === field))?.id ?? 'about';
};

// Kept under its original name for existing callers
export const RiskApiError = ApiError;

export const fetchAssessment = async (profile) => {
  const data = await apiFetch('/risk/assessment', { method: 'POST', body: profile });
  // A reply without scores (e.g. from a proxy or an older API) must not reach the Dashboard
  if (!data || typeof data.scores !== 'object' || data.scores === null) {
    throw new ApiError('unknown');
  }
  return data;
};
