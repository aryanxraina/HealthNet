import React from 'react';
import { AlertCircle, Check, CheckCircle2, Clock, Loader2, Minus, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { minutesLeft, overallProgress, sectionProgress, sectionStatus } from '../../questionnaire/progress';

const SaveIndicator = ({ state }) => {
  const { t } = useTranslation();
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t('common.saving')}
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <Check className="h-4 w-4" aria-hidden="true" />
        {t('common.saved')}
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        {t('questionnaire.notSaved')}
      </span>
    );
  }
  return null;
};

// Overall % bar, time left, save state and one segment per section (sticky at the top of the page)
const ProgressTracker = ({ sections, answers, currentId, saveState, onJump, onFinishLater }) => {
  const { t } = useTranslation();
  const percent = overallProgress(answers);
  const minutes = minutesLeft(answers);
  const stepIndex = sections.findIndex((section) => section.id === currentId);
  const stepLabel =
    stepIndex >= 0
      ? `${t('questionnaire.stepOf', { current: stepIndex + 1, total: sections.length })} · ${t(`questionnaire.sections.${currentId}.title`)}`
      : t('questionnaire.reviewStep');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:p-5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-gray-700 dark:text-gray-200">{stepLabel}</span>
        <div className="flex flex-shrink-0 items-center gap-4">
          <span aria-live="polite">
            <SaveIndicator state={saveState} />
          </span>
          <button
            type="button"
            onClick={onFinishLater}
            className="font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {t('questionnaire.finishLater')}
          </button>
        </div>
      </div>

      <div className="mt-1.5 flex items-end justify-between gap-3 sm:mt-3">
        <p className="text-lg font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl">
          {t('questionnaire.percentComplete', { percent })}
        </p>
        <p className="inline-flex items-center gap-1.5 pb-0.5 text-xs text-gray-500 dark:text-gray-400 sm:pb-1 sm:text-sm">
          {minutes > 0 ? <Clock className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          {minutes > 0 ? t('questionnaire.minutesLeft', { minutes }) : t('questionnaire.allDone')}
        </p>
      </div>

      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800"
        role="progressbar"
        aria-label={t('questionnaire.progressLabel')}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 flex gap-1.5 sm:mt-3" aria-hidden="true">
        {sections.map((section) => {
          const status = sectionStatus(section, answers);
          const fill = Math.round(sectionProgress(section, answers) * 100);
          const current = section.id === currentId;
          return (
            <button
              key={section.id}
              type="button"
              tabIndex={-1}
              title={t(`questionnaire.sections.${section.id}.title`)}
              onClick={() => onJump(section.id)}
              className={`relative h-1.5 flex-1 overflow-hidden rounded-full transition ${
                current ? 'ring-2 ring-indigo-500/60 ring-offset-1 dark:ring-offset-slate-900' : ''
              } ${status === 'skipped' ? 'bg-gray-300 dark:bg-slate-600' : 'bg-gray-200 dark:bg-slate-700'}`}
            >
              {status !== 'skipped' && (
                <span
                  className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${
                    status === 'complete' ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${fill}%` }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const StatusDot = ({ status, current, index, Icon }) => {
  if (status === 'complete') {
    return <CheckCircle2 className="h-7 w-7 text-emerald-500" aria-hidden="true" />;
  }
  if (status === 'skipped') {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500">
        <Minus className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  if (current) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md shadow-indigo-500/30 dark:bg-indigo-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold ${
        status === 'inProgress'
          ? 'border-indigo-400 text-indigo-600 dark:border-indigo-500 dark:text-indigo-300'
          : 'border-gray-300 text-gray-500 dark:border-slate-600 dark:text-slate-400'
      }`}
      aria-hidden="true"
    >
      {index + 1}
    </span>
  );
};

// Vertical list of sections with their status, for jumping around on larger screens
export const SectionNav = ({ sections, answers, currentId, onJump }) => {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('questionnaire.sectionNav')}>
      <ol className="space-y-1">
        {sections.map((section, index) => {
          const status = sectionStatus(section, answers);
          const current = section.id === currentId;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onJump(section.id)}
                aria-current={current ? 'step' : undefined}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  current ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-gray-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <StatusDot status={status} current={current} index={index} Icon={section.icon} />
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm font-medium ${
                      current ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {t(`questionnaire.sections.${section.id}.title`)}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {t(`questionnaire.status.${status}`)}
                    {section.optional && status === 'notStarted' ? ` · ${t('questionnaire.optional')}` : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => onJump('review')}
            aria-current={currentId === 'review' ? 'step' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
              currentId === 'review' ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-gray-100 dark:hover:bg-slate-800/70'
            }`}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t('questionnaire.reviewStep')}</span>
          </button>
        </li>
      </ol>
    </nav>
  );
};

export default ProgressTracker;
