// "Your next steps": the few most useful, general suggestions for this person, chosen by simple
// rules on their scores and answers. Text lives in report.suggestions.<id> in the locale files.

const ok = (score) => score?.status === 'ok';

// Highest priority first
const RULES = [
  {
    id: 'talkToSomeone',
    when: ({ scores }) => ok(scores.phq4) && (scores.phq4.details.anxietyPositive || scores.phq4.details.depressionPositive),
  },
  {
    id: 'bloodPressureCheck',
    when: ({ scores, answers }) =>
      scores.framinghamHtn?.reason === 'highReading' || (Number(answers.vitals?.systolic) >= 130 && answers.medical?.bpMedication !== 'yes'),
  },
  {
    id: 'heartCheck',
    when: ({ scores }) => [scores.whoCvd, scores.prevent].some((score) => ok(score) && score.value >= 10),
  },
  { id: 'quitSmoking', when: ({ answers }) => answers.lifestyle?.smoking === 'current' },
  {
    id: 'diabetesTest',
    when: ({ scores }) => (ok(scores.findrisc) && scores.findrisc.value >= 12) || (ok(scores.mlDiabetes) && scores.mlDiabetes.level >= 3),
  },
  { id: 'sleepCheck', when: ({ scores }) => ok(scores.stopBang) && scores.stopBang.category !== 'low' },
  { id: 'drinkLess', when: ({ scores }) => ok(scores.auditC) && scores.auditC.category === 'positive' },
  {
    id: 'healthyWeight',
    when: ({ scores }) =>
      ok(scores.bodyComposition) &&
      (scores.bodyComposition.value >= 25 || ['increased', 'high'].includes(scores.bodyComposition.details.waistToHeightCategory)),
  },
  { id: 'moveMore', when: ({ answers }) => answers.lifestyle?.dailyActivity === 'no' },
  { id: 'eatPlants', when: ({ answers }) => answers.lifestyle?.fruitVeg === 'no' },
  { id: 'bloodTest', when: ({ scores }) => scores.prevent?.status === 'needs_input' },
  { id: 'regularCheckups', when: ({ answers }) => ['gt2y', 'never'].includes(answers.checkups?.lastCheckup) },
];

export const suggestionIds = (scores = {}, answers = {}, limit = 3) => {
  const chosen = RULES.filter((rule) => rule.when({ scores, answers })).map((rule) => rule.id);
  return (chosen.length > 0 ? chosen : ['keepItUp']).slice(0, limit);
};
