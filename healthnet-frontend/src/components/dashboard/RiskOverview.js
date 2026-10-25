import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, HeartHandshake, Info, Lock, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useUserData } from '../../context/UserDataContext';
import { useRiskAssessment } from '../../api/useRiskAssessment';
import { sectionForField } from '../../api/risk';

// Real risk scores from the HealthNet risk engine (FINAL YEAR PROJECT/risk), grouped by topic

const GROUPS = [
  { id: 'heart', scores: ['whoCvd', 'prevent', 'framinghamHtn'] },
  { id: 'metabolic', scores: ['diabetes', 'bodyComposition'] },
  { id: 'wellbeing', scores: ['phq4', 'stopBang', 'auditC'] },
];

// Full class names so Tailwind keeps them; level 0 (best) to 4 (worst)
const LEVELS = [
  { pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', bar: 'bg-emerald-500' },
  { pill: 'bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300', bar: 'bg-lime-500' },
  { pill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', bar: 'bg-amber-500' },
  { pill: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300', bar: 'bg-orange-500' },
  { pill: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300', bar: 'bg-red-500' },
];

const cardClass = 'flex flex-col rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900';
const helperText = 'text-sm text-gray-600 dark:text-gray-300';

const LevelMeter = ({ level }) => (
  <div className="mt-3 flex gap-1" aria-hidden="true">
    {LEVELS.map((style, index) => (
      <span key={style.bar} className={`h-1.5 flex-1 rounded-full ${index <= level ? LEVELS[level].bar : 'bg-gray-200 dark:bg-slate-700'}`} />
    ))}
  </div>
);

// Extra lines under the headline number, specific to each score
const detailLines = (scoreId, score, t) => {
  const d = score.details;
  switch (scoreId) {
    case 'whoCvd':
      return [t(`dashboard.risk.variants.${d.variant}`), t('dashboard.risk.whoRegion')];
    case 'prevent':
      return [
        t('dashboard.risk.preventDetails', { ascvd: d.tenYear.ascvd, hf: d.tenYear.heartFailure }),
        d.thirtyYear && t('dashboard.risk.preventThirty', { value: d.thirtyYear.totalCvd }),
        t(`dashboard.risk.variants.${d.variant}`),
      ];
    case 'framinghamHtn':
      return [
        t('dashboard.risk.framinghamDetails', { one: d.oneYear, two: d.twoYear }),
        t('dashboard.risk.framinghamOptimal', { value: d.optimalFourYear }),
      ];
    case 'findrisc':
      return [t('dashboard.risk.findriscRisk', { risk: d.tenYearRisk })];
    case 'phq4':
      return [t('dashboard.risk.phqDetails', { anxiety: d.anxiety, depression: d.depression })];
    case 'bodyComposition':
      return [
        d.waistToHeight !== undefined &&
          t('dashboard.risk.waistToHeight', {
            ratio: d.waistToHeight,
            category: t(`dashboard.risk.waistCategories.${d.waistToHeightCategory}`),
          }),
      ];
    default:
      return [];
  }
};

const Headline = ({ scoreId, score }) => {
  const { t } = useTranslation();
  const { details } = score;
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        {score.value}
        {score.unit === '%' && <span className="text-xl">%</span>}
      </span>
      {score.unit === 'points' && details.maxPoints && (
        <span className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.risk.pointsOf', { max: details.maxPoints })}</span>
      )}
      {score.unit === 'kg/m²' && <span className="text-sm text-gray-500 dark:text-gray-400">BMI</span>}
      <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${LEVELS[score.level].pill}`}>
        {t(`dashboard.risk.categories.${scoreId}.${score.category}`)}
      </span>
    </div>
  );
};

// "blood pressure, total cholesterol and 2 more", without repeating labels shared by several fields
const missingLabel = (missing, t) => {
  const labels = [...new Set(missing.map((field) => t(`dashboard.risk.fields.${field}`)))];
  const shown = labels.slice(0, 2).join(', ');
  return labels.length > 2
    ? t('dashboard.risk.unlockMore', { fields: shown, count: labels.length - 2 })
    : t('dashboard.risk.unlock', { fields: shown });
};

const reasonText = (score, t) => {
  const params = { ...score.reasonParams };
  if (params.field) params.field = t(`dashboard.risk.rangeFields.${params.field}`);
  return t(`dashboard.risk.reasons.${score.reason}`, params);
};

export const RiskCard = ({ scoreId, score, children }) => {
  const { t } = useTranslation();
  const titleId = `risk-${scoreId}`;
  const horizon = score.details?.horizonYears;

  return (
    <article className={cardClass} aria-labelledby={titleId}>
      <div className="flex items-start justify-between gap-2">
        <h4 id={titleId} className="font-semibold text-gray-800 dark:text-gray-100">
          {t(`questionnaire.scores.${scoreId}`)}
        </h4>
        {score.status === 'ok' && horizon && (
          <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
            {t('dashboard.risk.horizon', { years: horizon })}
          </span>
        )}
      </div>
      {children}

      {score.status === 'ok' && (
        <>
          <Headline scoreId={scoreId} score={score} />
          <LevelMeter level={score.level} />
          <ul className="mt-3 space-y-1">
            {detailLines(scoreId, score, t)
              .filter(Boolean)
              .map((line) => (
                <li key={line} className={helperText}>
                  {line}
                </li>
              ))}
          </ul>
          {score.assumptions.length > 0 && (
            <ul className="mt-3 space-y-1">
              {score.assumptions.map((code) => (
                <li key={code} className="flex gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  {t(`dashboard.risk.assumptions.${code}`)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {score.status === 'needs_input' && (
        <div className="mt-3 flex flex-1 flex-col">
          <p className={`flex gap-2 ${helperText}`}>
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
            {missingLabel(score.missing, t)}
          </p>
          <Link
            to={`/questionnaire#${sectionForField(score.missing[0])}`}
            className="mt-auto inline-flex w-fit pt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {t('dashboard.risk.addAnswers')} →
          </Link>
        </div>
      )}

      {score.status === 'not_applicable' && (
        <p className={`mt-3 flex gap-2 ${helperText}`}>
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
          {reasonText(score, t)}
        </p>
      )}

      <details className="mt-auto pt-4 text-xs text-gray-500 dark:text-gray-400">
        <summary className="cursor-pointer select-none font-medium hover:text-gray-700 dark:hover:text-gray-200">
          {t('dashboard.risk.howCalculated')}
        </summary>
        <p className="mt-1">
          {score.model.name}. {score.model.reference}.
        </p>
      </details>
    </article>
  );
};

const DiabetesCard = ({ scores }) => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useUserData();
  const model = settings.diabetesModel === 'ml' ? 'ml' : 'findrisc';
  const scoreId = model === 'ml' ? 'mlDiabetes' : 'findrisc';
  const options = [
    { value: 'findrisc', label: t('dashboard.risk.diabetesModel.findrisc') },
    { value: 'ml', label: t('dashboard.risk.diabetesModel.ml') },
  ];

  return (
    <RiskCard scoreId={scoreId} score={scores[scoreId]}>
      <div
        role="radiogroup"
        aria-label={t('dashboard.risk.diabetesModel.label')}
        className="mt-3 inline-flex w-fit rounded-lg bg-gray-100 p-1 dark:bg-slate-800"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={model === option.value}
            onClick={() => updateSettings({ diabetesModel: option.value }).catch(() => {})}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              model === option.value
                ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-600 dark:text-white'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {model === 'ml' && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {t('dashboard.risk.diabetesModel.experimentalNote')}
        </p>
      )}
    </RiskCard>
  );
};

const SupportBox = () => {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40" role="note">
      <HeartHandshake className="h-6 w-6 flex-shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
      <div className="space-y-2 text-sm text-sky-900 dark:text-sky-100">
        <p className="font-semibold">{t('dashboard.risk.support.title')}</p>
        <p>{t('dashboard.risk.support.body')}</p>
        <a
          href="https://findahelpline.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-sky-700 underline hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
        >
          {t('dashboard.risk.support.helplines')}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        <p className="text-xs">{t('dashboard.risk.support.emergency')}</p>
      </div>
    </div>
  );
};

const needsSupport = (phq4) =>
  phq4?.status === 'ok' && (phq4.details.anxietyPositive || phq4.details.depressionPositive || phq4.level >= 3);

const RiskOverview = () => {
  const { t, language } = useTranslation();
  const { status, results, error, retry } = useRiskAssessment();

  let body;
  if (status === 'loading') {
    body = (
      <div role="status" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <span className="sr-only">{t('dashboard.risk.calculating')}</span>
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-44 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  } else if (status === 'empty') {
    body = (
      <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-slate-700">
        <Sparkles className="h-8 w-8 text-indigo-500" aria-hidden="true" />
        <h3 className="mt-3 text-lg font-semibold text-gray-800 dark:text-gray-100">{t('dashboard.risk.empty.title')}</h3>
        <p className={`mt-1 max-w-md ${helperText}`}>{t('dashboard.risk.empty.body')}</p>
        <Link
          to="/questionnaire"
          className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {t('dashboard.risk.empty.action')}
        </Link>
      </div>
    );
  } else if (status === 'error') {
    body = (
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <p className="flex-1">{t(`dashboard.risk.errors.${error?.code || 'unknown'}`)}</p>
        <button
          type="button"
          onClick={retry}
          className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-3 py-1 font-medium hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.retry')}
        </button>
      </div>
    );
  } else {
    const { scores } = results;
    body = (
      <div className="space-y-8">
        {GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={`risk-group-${group.id}`}>
            <h3 id={`risk-group-${group.id}`} className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t(`dashboard.risk.groups.${group.id}`)}
            </h3>
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${group.scores.length > 2 ? 'xl:grid-cols-3' : ''}`}>
              {group.scores.map((scoreId) =>
                scoreId === 'diabetes' ? (
                  <DiabetesCard key={scoreId} scores={scores} />
                ) : (
                  <RiskCard key={scoreId} scoreId={scoreId} score={scores[scoreId]} />
                )
              )}
            </div>
            {group.id === 'wellbeing' && needsSupport(scores.phq4) && (
              <div className="mt-4">
                <SupportBox />
              </div>
            )}
          </section>
        ))}
      </div>
    );
  }

  const updated =
    status === 'ready' && results.calculatedAt
      ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(results.calculatedAt))
      : null;

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900" aria-labelledby="risk-title">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="risk-title" className="text-xl font-semibold text-gray-800 dark:text-gray-100">
            {t('dashboard.risk.title')}
          </h2>
          <p className={helperText}>{t('dashboard.risk.subtitle')}</p>
        </div>
        {updated && (
          <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{t('dashboard.risk.updated', { date: updated })}</span>
        )}
      </div>
      {body}
      {status === 'ready' && (
        <p className="mt-6 flex gap-2 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
          <Info className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {t('dashboard.risk.disclaimer')}
        </p>
      )}
    </section>
  );
};

export default RiskOverview;
