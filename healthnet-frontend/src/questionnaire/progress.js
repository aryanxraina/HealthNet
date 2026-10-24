import { SECTIONS } from './sections';
import { isAnswered } from './answers';
import { DEFAULT_UNITS, toStandard, unitFor } from '../lib/units';

// Seconds a typical answer takes, for the "about N min left" estimate
const SECONDS_PER_QUESTION = 8;

export const visibleSections = (answers) => SECTIONS.filter((section) => !section.showIf || section.showIf(answers));

export const visibleQuestions = (section, answers) =>
  section.questions.filter((question) => !question.showIf || question.showIf(answers));

// Sections store a `_status` of 'complete' or 'skipped' once the user moves past them
export const sectionStatus = (section, answers) => {
  const sectionAnswers = answers[section.id] || {};
  if (sectionAnswers._status) return sectionAnswers._status;
  const answered = visibleQuestions(section, answers).some((question) => isAnswered(sectionAnswers[question.id]));
  return answered ? 'inProgress' : 'notStarted';
};

// 0..1 for one section: finished sections count fully; otherwise the share of
// required questions answered (all questions for optional sections)
export const sectionProgress = (section, answers) => {
  const status = sectionStatus(section, answers);
  if (status === 'complete' || status === 'skipped') return 1;
  const questions = visibleQuestions(section, answers);
  const counted = section.optional ? questions : questions.filter((question) => question.required);
  if (counted.length === 0) return 0;
  const sectionAnswers = answers[section.id] || {};
  return counted.filter((question) => isAnswered(sectionAnswers[question.id])).length / counted.length;
};

export const overallProgress = (answers) => {
  const sections = visibleSections(answers);
  const total = sections.reduce((sum, section) => sum + sectionProgress(section, answers), 0);
  return Math.round((total / sections.length) * 100);
};

export const minutesLeft = (answers) => {
  const remaining = visibleSections(answers)
    .filter((section) => !['complete', 'skipped'].includes(sectionStatus(section, answers)))
    .reduce((count, section) => {
      const sectionAnswers = answers[section.id] || {};
      return count + visibleQuestions(section, answers).filter((question) => !isAnswered(sectionAnswers[question.id])).length;
    }, 0);
  return remaining === 0 ? 0 : Math.max(1, Math.ceil((remaining * SECONDS_PER_QUESTION) / 60));
};

// First section that isn't finished yet, or null when everything is done
export const firstUnfinishedSection = (answers) =>
  visibleSections(answers).find((section) => !['complete', 'skipped'].includes(sectionStatus(section, answers)))?.id ?? null;

// Half of the smallest step shown in the user's units, converted to standard units, so a limit
// shown rounded (e.g. "1.8 mmol/L" for 70 mg/dL) is accepted when typed exactly as shown
const roundingTolerance = (question, units) => {
  if (!question.kind) return 0;
  const step = question.kind === 'creatinine' && unitFor('creatinine', units) === 'mg/dL' ? 0.005 : 0.05;
  return Math.abs(toStandard(question.kind, step, units) - toStandard(question.kind, 0, units));
};

// { questionId: { key, min?, max? } } for answers that block Next. Ranges are in standard units.
export const validateSection = (section, answers, units = DEFAULT_UNITS) => {
  const sectionAnswers = answers[section.id] || {};
  const errors = {};
  visibleQuestions(section, answers).forEach((question) => {
    const value = sectionAnswers[question.id];
    if (!isAnswered(value)) {
      if (question.required && !section.optional) {
        errors[question.id] = { key: 'questionnaire.errors.required' };
      }
      return;
    }
    if (question.type === 'number') {
      const n = Number(value);
      const tolerance = roundingTolerance(question, units);
      const outOfRange = Number.isNaN(n) || n < question.min - tolerance || n > question.max + tolerance;
      if (outOfRange || (question.integer && !Number.isInteger(n))) {
        errors[question.id] = { key: 'questionnaire.errors.range', min: question.min, max: question.max };
      }
    }
    if (question.type === 'date' && !isPastDate(value)) {
      errors[question.id] = { key: 'questionnaire.errors.date' };
    }
  });
  return errors;
};

// 'YYYY-MM-DD' between 1900 and today
const isPastDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.getFullYear() >= 1900 && date <= new Date();
};

export const todayIso = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Drops answers to questions that are now hidden (e.g. drinking details after choosing "Never")
export const pruneHidden = (section, answers) => {
  const sectionAnswers = answers[section.id] || {};
  const visibleIds = new Set(visibleQuestions(section, answers).map((question) => question.id));
  return Object.fromEntries(
    Object.entries(sectionAnswers).filter(([key]) => key.startsWith('_') || visibleIds.has(key))
  );
};

// Answers from the first questionnaire version (personal/lifestyle/medical) mapped to the
// current sections. Returns only sections that need saving.
export const migrateLegacyAnswers = (answers) => {
  const migrated = {};
  const { personal } = answers;
  if (personal && !answers.about) {
    const gender = ['female', 'male'].includes(personal.gender) ? personal.gender : personal.gender ? 'nonBinary' : undefined;
    migrated.about = Object.fromEntries(
      Object.entries({ gender, height: personal.height, weight: personal.weight }).filter(([, value]) => isAnswered(value))
    );
  }
  const lifestyle = answers.lifestyle;
  if (lifestyle && 'exercise' in lifestyle && !('exerciseFrequency' in lifestyle)) {
    const { exercise, alcohol, ...rest } = lifestyle;
    migrated.lifestyle = { ...rest, exerciseFrequency: exercise };
  }
  const medical = answers.medical;
  if (medical?.conditions?.includes('heart_disease')) {
    migrated.medical = {
      ...medical,
      conditions: medical.conditions.map((condition) => (condition === 'heart_disease' ? 'heartDisease' : condition)),
    };
  }
  // Old completed sections had no fields the new version requires, so let people revisit them
  Object.values(migrated).forEach((section) => {
    delete section._status;
  });
  return migrated;
};
