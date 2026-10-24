// Small helpers for reading questionnaire answers.
// Answers are stored per section, e.g. { about: { height: 172 }, lifestyle: { smoking: 'never' } },
// with measurements in standard units (see lib/units.js).

export const isAnswered = (value) =>
  !(value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0));

// 'about.height' -> answers.about.height
export const valueAt = (answers, path) =>
  path.split('.').reduce((node, part) => (node == null ? undefined : node[part]), answers);

export const ageFrom = (dateOfBirth, today = new Date()) => {
  if (!dateOfBirth) return null;
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

export const bmiFrom = (heightCm, weightKg) =>
  heightCm && weightKg ? weightKg / (heightCm / 100) ** 2 : null;

// The sex used by the risk models: the gender answer when it is female/male,
// otherwise the separate "which sex should we use for calculations" answer
export const riskSexOf = (answers) => {
  const gender = answers.about?.gender;
  if (gender === 'female' || gender === 'male') return gender;
  return answers.about?.riskSex || null;
};
