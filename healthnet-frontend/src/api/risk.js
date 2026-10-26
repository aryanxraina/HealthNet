import { ageFrom, riskSexOf } from '../questionnaire/answers';
import { SECTIONS } from '../questionnaire/sections';

// Risk scores for questionnaire answers. They are calculated on this device by the risk engine in
// src/risk (a tested port of the Python reference engine in FINAL YEAR PROJECT/risk), so the health
// profile is never sent anywhere. Results are kept in Firestore by UserDataContext.

// Answers the engine reads (see src/risk/profile.js)
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

export class RiskError extends Error {
  constructor(code) {
    super(`Risk calculation failed: ${code}`);
    this.code = code; // invalid | loadFailed | unknown
  }
}

// { engineVersion, scores, disclaimer } for a profile from buildProfile. The engine is loaded on
// first use, so it only downloads for people who have answered something.
export const calculateAssessment = async (profile) => {
  let engine;
  try {
    engine = await import('../risk');
  } catch {
    throw new RiskError('loadFailed');
  }
  try {
    return engine.assess(profile);
  } catch (error) {
    throw new RiskError(error.code === 'invalid' ? 'invalid' : 'unknown');
  }
};
