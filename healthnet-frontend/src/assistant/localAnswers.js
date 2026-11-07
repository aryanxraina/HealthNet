import { detailLines, missingLabel, reasonText } from '../lib/scoreText';
import { suggestionIds } from '../report/suggestions';

// Answers the assistant gives on the device, from the person's own scores. Nothing is sent anywhere.
// An answer is a list of blocks: { type: 'p', text } or { type: 'list', items }.

const HEART = ['whoCvd', 'prevent', 'framinghamHtn'];
const METABOLIC = ['findrisc', 'bodyComposition'];
const WELLBEING = ['phq4', 'stopBang', 'auditC'];

const ok = (score) => score?.status === 'ok';

const scoreLine = (id, score, t) => {
  const title = t(`questionnaire.scores.${id}`);
  const unit = score.unit === '%' ? '%' : ` ${score.unit === 'points' ? t('assistant.points') : score.unit}`;
  return t('assistant.scoreLine', { title, value: `${score.value}${unit}`, category: t(`dashboard.risk.categories.${id}.${score.category}`) });
};

// What the person still needs to answer for a score, or why it doesn't apply
const notReadyLine = (id, score, t) => {
  const title = t(`questionnaire.scores.${id}`);
  if (score.status === 'needs_input') return `${title}: ${missingLabel(score.missing, t)}`;
  return `${title}: ${reasonText(score, t)}`;
};

const explainScores = (ids, scores, t) => {
  const blocks = [];
  ids.forEach((id) => {
    const score = scores[id];
    if (!score) return;
    if (!ok(score)) {
      blocks.push({ type: 'p', text: notReadyLine(id, score, t) });
      return;
    }
    blocks.push({ type: 'p', text: `${scoreLine(id, score, t)} ${t(`assistant.explain.${id}`)}` });
    const details = detailLines(id, score, t).filter(Boolean);
    if (details.length) blocks.push({ type: 'list', items: details });
  });
  return blocks;
};

// Suggested questions, as answer ids. Signed-out visitors get questions about HealthNet itself.
export const suggestedQuestions = (results) => {
  if (!results) return ['whatIs', 'privacy'];
  const scores = results.scores || {};
  const ids = ['overview'];
  if (HEART.some((id) => scores[id])) ids.push('heart');
  if (METABOLIC.some((id) => scores[id])) ids.push('diabetes');
  ids.push('improve');
  if (Object.values(scores).some((score) => score.status === 'needs_input')) ids.push('missing');
  ids.push('doctor', 'privacy');
  return ids;
};

export const localAnswer = (id, { results, answers = {}, t }) => {
  const scores = results?.scores || {};
  switch (id) {
    case 'overview': {
      const ready = Object.entries(scores).filter(([, score]) => ok(score));
      if (!ready.length) return [{ type: 'p', text: t('assistant.answers.noScores') }];
      return [
        { type: 'p', text: t('assistant.answers.overviewIntro') },
        { type: 'list', items: ready.map(([scoreId, score]) => scoreLine(scoreId, score, t)) },
        { type: 'p', text: t('assistant.answers.overviewOutro') },
      ];
    }
    case 'heart':
      return [...explainScores(HEART, scores, t), { type: 'p', text: t('assistant.answers.estimate') }];
    case 'diabetes':
      return [...explainScores(METABOLIC, scores, t), { type: 'p', text: t('assistant.answers.estimate') }];
    case 'wellbeing':
      return explainScores(WELLBEING, scores, t);
    case 'improve': {
      const ids = suggestionIds(scores, answers, 4);
      return [
        { type: 'p', text: t('assistant.answers.improveIntro') },
        { type: 'list', items: ids.map((s) => `${t(`report.suggestions.${s}.title`)}: ${t(`report.suggestions.${s}.body`)}`) },
      ];
    }
    case 'missing': {
      const waiting = Object.entries(scores).filter(([, score]) => score.status === 'needs_input');
      if (!waiting.length) return [{ type: 'p', text: t('assistant.answers.nothingMissing') }];
      return [
        { type: 'p', text: t('assistant.answers.missingIntro') },
        { type: 'list', items: waiting.map(([scoreId, score]) => notReadyLine(scoreId, score, t)) },
      ];
    }
    case 'doctor': {
      // Suggestions without a matching doctor question are skipped (t returns the key when it's missing)
      const items = suggestionIds(scores, answers, 6)
        .map((s) => t(`assistant.doctorQuestions.${s}`))
        .filter((text) => !text.startsWith('assistant.'));
      return [
        { type: 'p', text: t('assistant.answers.doctorIntro') },
        { type: 'list', items: [...items, t('assistant.doctorQuestions.general'), t('assistant.doctorQuestions.followUp')] },
      ];
    }
    case 'privacy':
      return [{ type: 'p', text: t('assistant.answers.privacy') }];
    case 'whatIs':
      return [{ type: 'p', text: t('assistant.answers.whatIs') }];
    default:
      return [{ type: 'p', text: t('assistant.answers.unknown') }];
  }
};

// A typed question that matches a suggested topic, for when the cloud assistant isn't available
const TOPICS = [
  ['heart', /\b(heart|cardio|stroke|blood pressure|bp|hypertension|prevent|who)\b/i],
  ['diabetes', /\b(diabet|sugar|glucose|findrisc|hba1c|bmi|weight|waist)\b/i],
  ['wellbeing', /\b(mood|anxi|depress|sleep|snor|apnoea|apnea|alcohol|drink)\b/i],
  ['improve', /\b(improve|lower|reduce|better|help|tips?|what can i do)\b/i],
  ['missing', /\b(missing|unlock|add|why (no|not)|can't see)\b/i],
  ['doctor', /\b(doctor|gp|nurse|appointment|ask)\b/i],
  ['privacy', /\b(privacy|private|data|share|stored|safe)\b/i],
  ['overview', /\b(overview|summary|results?|scores?)\b/i],
];
export const topicFor = (text) => TOPICS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;

// The score summary the cloud assistant receives: titles, values and categories only
export const scoreSummaries = (results, t) =>
  Object.entries(results?.scores || {}).map(([id, score]) => {
    const summary = { id, title: t(`questionnaire.scores.${id}`), status: score.status };
    if (ok(score)) {
      Object.assign(summary, {
        value: score.value,
        unit: score.unit,
        category: t(`dashboard.risk.categories.${id}.${score.category}`),
        detail: detailLines(id, score, t).filter(Boolean).join(' · ').slice(0, 200) || undefined,
      });
    } else if (score.status === 'needs_input') {
      summary.missing = [...new Set(score.missing.map((field) => t(`dashboard.risk.fields.${field}`)))];
    } else {
      summary.reason = reasonText(score, t).slice(0, 200);
    }
    return summary;
  });

// A cloud reply as blocks: lines starting with "-", "*" or "•" become a list
export const replyBlocks = (text) => {
  const blocks = [];
  text.split(/\n+/).map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      const last = blocks[blocks.length - 1];
      if (last?.type === 'list') last.items.push(bullet[1]);
      else blocks.push({ type: 'list', items: [bullet[1]] });
    } else {
      blocks.push({ type: 'p', text: line.replace(/\*\*(.+?)\*\*/g, '$1') });
    }
  });
  return blocks;
};
