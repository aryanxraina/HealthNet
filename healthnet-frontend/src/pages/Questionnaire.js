import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Lock, Minus, Sparkles } from 'lucide-react';
import { useUserData } from '../context/UserDataContext';
import { useTranslation } from '../i18n';
import DataStatusBanner from '../components/DataStatusBanner';
import QuestionField from '../components/questionnaire/QuestionField';
import ProgressTracker, { SectionNav } from '../components/questionnaire/ProgressTracker';
import { isAnswered } from '../questionnaire/answers';
import {
  firstUnfinishedSection,
  migrateLegacyAnswers,
  pruneHidden,
  sectionStatus,
  validateSection,
  visibleQuestions,
  visibleSections,
} from '../questionnaire/progress';
import { SCORES, readyScoreIds, scoreReadiness, scoresForSection } from '../questionnaire/scores';
import { sectionById } from '../questionnaire/sections';

// Guided questionnaire: one section per step, a live progress tracker, autosave,
// and a review step showing which scores the answers unlock.

const AUTOSAVE_DELAY = 800;
const TOAST_DURATION = 4500;
const MAX_UNLOCK_CHIPS = 4;

const cardClass = 'rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const primaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:ring-offset-slate-900';
const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-slate-800';

// Answers that are out of range or not a real date are kept on screen but never saved
const savableAnswers = (section, answers, units) => {
  const errors = validateSection(section, answers, units);
  return Object.fromEntries(
    Object.entries(pruneHidden(section, answers)).filter(
      ([key]) => !errors[key] || errors[key].key === 'questionnaire.errors.required'
    )
  );
};

const nextSectionId = (sectionId, answers) => {
  const sections = visibleSections(answers);
  const index = sections.findIndex((section) => section.id === sectionId);
  return sections[index + 1]?.id ?? 'review';
};

const previousSectionId = (sectionId, answers) => {
  const sections = visibleSections(answers);
  if (sectionId === 'review') return sections[sections.length - 1].id;
  const index = sections.findIndex((section) => section.id === sectionId);
  return index > 0 ? sections[index - 1].id : null;
};

const UnlockChips = ({ sectionId, answers }) => {
  const { t } = useTranslation();
  const scores = scoresForSection(sectionId)
    .map((id) => ({ id, readiness: scoreReadiness(SCORES.find((score) => score.id === id), answers) }))
    .filter(({ readiness }) => readiness.state !== 'notApplicable');
  if (scores.length === 0) return null;
  const shown = scores.slice(0, MAX_UNLOCK_CHIPS);
  const hidden = scores.length - shown.length;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('questionnaire.unlocks')}
      </span>
      {shown.map(({ id, readiness }) => {
        const ready = readiness.state === 'ready';
        const Icon = ready ? CheckCircle2 : Lock;
        return (
          <span
            key={id}
            title={ready ? t('questionnaire.review.ready') : missingText(t, readiness.missing)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              ready
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {t(`questionnaire.scores.${id}`)}
          </span>
        );
      })}
      {hidden > 0 && (
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {t('questionnaire.moreScores', { count: hidden })}
        </span>
      )}
    </div>
  );
};

const missingText = (t, count) =>
  count === 1 ? t('questionnaire.review.missingOne') : t('questionnaire.review.missingMany', { count });

const ScoreRow = ({ score, answers }) => {
  const { t } = useTranslation();
  const readiness = scoreReadiness(score, answers);
  let badge;
  if (readiness.state === 'ready') {
    badge = (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t('questionnaire.review.ready')}
      </span>
    );
  } else if (readiness.state === 'notApplicable') {
    badge = <span className="text-xs text-gray-500 dark:text-gray-400">{t('questionnaire.review.womenOnly')}</span>;
  } else {
    badge = (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        {missingText(t, readiness.missing)}
      </span>
    );
  }
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{t(`questionnaire.scores.${score.id}`)}</span>
      {badge}
    </li>
  );
};

const SectionStatusIcon = ({ status }) => {
  if (status === 'complete') return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden="true" />;
  if (status === 'skipped') return <Minus className="h-5 w-5 text-gray-400" aria-hidden="true" />;
  return <span className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-slate-600" aria-hidden="true" />;
};

const ReviewStep = ({ answers, onEdit, onBack, headingRef }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sections = visibleSections(answers);
  const requiredDone = sections
    .filter((section) => !section.optional)
    .every((section) => sectionStatus(section, answers) === 'complete');

  return (
    <div className="animate-fade-in-up space-y-6 motion-reduce:animate-none">
      <section className={`${cardClass} p-6 sm:p-8`}>
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-gray-900 focus:outline-none dark:text-gray-100 sm:text-2xl">
              {requiredDone ? t('questionnaire.review.title') : t('questionnaire.review.almostTitle')}
            </h2>
            <p className="mt-1 text-gray-600 dark:text-gray-300">{t('questionnaire.review.subtitle')}</p>
          </div>
        </div>

        <h3 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('questionnaire.review.scoresTitle')}
        </h3>
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-slate-800">
          {SCORES.map((score) => (
            <ScoreRow key={score.id} score={score} answers={answers} />
          ))}
        </ul>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onBack} className={secondaryButton}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {t('questionnaire.back')}
          </button>
          <button type="button" onClick={() => navigate('/dashboard')} className={primaryButton}>
            {t('questionnaire.review.goDashboard')}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 text-right text-xs text-gray-500 dark:text-gray-400">{t('questionnaire.review.dashboardNote')}</p>
      </section>

      <section className={`${cardClass} p-6 sm:p-8`}>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('questionnaire.review.sectionsTitle')}
        </h3>
        <ul className="mt-2 divide-y divide-gray-100 dark:divide-slate-800">
          {sections.map((section) => {
            const status = sectionStatus(section, answers);
            const title = t(`questionnaire.sections.${section.id}.title`);
            return (
              <li key={section.id} className="flex items-center gap-3 py-3">
                <SectionStatusIcon status={status} />
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                  {title}
                  <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">{t(`questionnaire.status.${status}`)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => onEdit(section.id)}
                  aria-label={`${t('questionnaire.review.edit')}: ${title}`}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                >
                  {t('questionnaire.review.edit')}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

const Questionnaire = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // Answers live in Firestore per signed-in user (see UserDataContext)
  const { status, answers, settings, saveAnswers, saveStatus } = useUserData();
  const [currentId, setCurrentId] = useState(null);
  const [draft, setDraft] = useState({});
  const [errors, setErrors] = useState({});
  const [unlocked, setUnlocked] = useState([]);
  const dirty = useRef(false);
  const readyAtEntry = useRef([]);
  const stepChanged = useRef(false);
  const fieldRefs = useRef({});
  const headingRef = useRef(null);

  const section = currentId && currentId !== 'review' ? sectionById(currentId) : null;
  const units = settings.units;

  // Saved answers with the section being edited swapped in, so progress and follow-up questions react as you type
  const merged = useMemo(
    () => (currentId && currentId !== 'review' ? { ...answers, [currentId]: draft } : answers),
    [answers, currentId, draft]
  );

  const enterStep = useCallback((id, base) => {
    setCurrentId(id);
    setDraft(id === 'review' ? {} : { ...base[id] });
    setErrors({});
    dirty.current = false;
    readyAtEntry.current = readyScoreIds(base);
  }, []);

  // Start where the user left off (or at #section from a link), after moving answers from the first version
  useEffect(() => {
    if (status !== 'ready') {
      setCurrentId(null);
      return;
    }
    if (currentId !== null) return;
    const migrated = migrateLegacyAnswers(answers);
    Object.entries(migrated).forEach(([id, data]) => saveAnswers(id, data).catch(() => {}));
    const effective = { ...answers, ...migrated };
    const requested = location.hash.slice(1);
    const linked = visibleSections(effective).some((item) => item.id === requested);
    enterStep(linked ? requested : firstUnfinishedSection(effective) ?? 'review', effective);
  }, [status, currentId, answers, saveAnswers, location.hash, enterStep]);

  // Saves the current section now. Without a status it keeps the saved one, unless the answers are no longer complete.
  const saveCurrent = (newStatus) => {
    if (!section) return answers;
    const payload = savableAnswers(section, merged, units);
    if (newStatus) {
      payload._status = newStatus;
    } else if (payload._status === 'complete' && Object.keys(validateSection(section, merged, units)).length > 0) {
      delete payload._status;
    }
    const statusChanged = (answers[section.id]?._status ?? null) !== (payload._status ?? null);
    if (dirty.current || statusChanged) {
      dirty.current = false;
      // Failures show in DataStatusBanner; answers stay on screen either way
      saveAnswers(section.id, payload).catch(() => {});
    }
    return { ...answers, [section.id]: payload };
  };

  const saveRef = useRef(saveCurrent);
  saveRef.current = saveCurrent;

  // Autosave shortly after the user stops answering
  useEffect(() => {
    if (!dirty.current) return undefined;
    const timer = setTimeout(() => saveRef.current(), AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [draft]);

  // Don't lose the last answers when leaving the page mid-section
  useEffect(() => {
    const latest = saveRef;
    return () => {
      if (dirty.current) latest.current();
    };
  }, []);

  // Move focus to the new step's heading and scroll it into view
  useEffect(() => {
    if (!stepChanged.current) return;
    stepChanged.current = false;
    headingRef.current?.focus({ preventScroll: true });
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentId]);

  useEffect(() => {
    if (unlocked.length === 0) return undefined;
    const timer = setTimeout(() => setUnlocked([]), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [unlocked]);

  const goTo = (id, base) => {
    const newlyReady = readyScoreIds(base).filter((scoreId) => !readyAtEntry.current.includes(scoreId));
    if (newlyReady.length > 0) setUnlocked(newlyReady);
    stepChanged.current = true;
    enterStep(id, base);
  };

  const setField = (questionId, value) => {
    dirty.current = true;
    setDraft((current) => {
      const next = { ...current };
      if (isAnswered(value)) {
        next[questionId] = value;
      } else {
        delete next[questionId];
      }
      return next;
    });
    setErrors((current) => {
      if (!current[questionId]) return current;
      const { [questionId]: _cleared, ...rest } = current;
      return rest;
    });
  };

  const handleNext = (event) => {
    event.preventDefault();
    const found = validateSection(section, merged, units);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const first = visibleQuestions(section, merged).find((question) => found[question.id]);
      // Centered so the sticky progress tracker never covers the field
      const element = fieldRefs.current[first.id];
      element?.focus({ preventScroll: true });
      element?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      return;
    }
    const saved = saveCurrent('complete');
    goTo(nextSectionId(section.id, saved), saved);
  };

  const handleSkip = () => {
    const saved = saveCurrent('skipped');
    goTo(nextSectionId(section.id, saved), saved);
  };

  const handleBack = () => {
    const saved = saveCurrent();
    const previous = previousSectionId(currentId, saved);
    if (previous) goTo(previous, saved);
  };

  const handleJump = (id) => {
    if (id === currentId) return;
    goTo(id, saveCurrent());
  };

  const handleFinishLater = () => {
    saveCurrent();
    navigate('/dashboard');
  };

  if (status === 'loading' || status === 'idle' || (status === 'ready' && currentId === null)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  const sections = visibleSections(merged);
  const errorCount = Object.keys(errors).length;
  const isFirst = section && sections[0].id === section.id;
  const isLast = section && sections[sections.length - 1].id === section.id;
  const unitsKey = `${units.system}-${units.lab}-${units.temperature}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-3xl">{t('questionnaire.title')}</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-300">{t('questionnaire.subtitle')}</p>
        </div>

        <DataStatusBanner className="mb-6" />

        {status === 'error' ? (
          <div className={`${cardClass} flex items-start gap-3 p-6 text-gray-700 dark:text-gray-200`}>
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" aria-hidden="true" />
            <p>{t('questionnaire.loadError')}</p>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <SectionNav sections={sections} answers={merged} currentId={currentId} onJump={handleJump} />
              </div>
            </aside>

            <div className="min-w-0">
              <div className="sticky top-16 z-30 -mx-4 bg-gray-50 px-4 pb-3 pt-2 dark:bg-slate-950 sm:mx-0 sm:px-0 sm:pb-4 sm:pt-3">
                <ProgressTracker
                  sections={sections}
                  answers={merged}
                  currentId={currentId}
                  saveState={saveStatus.state}
                  onJump={handleJump}
                  onFinishLater={handleFinishLater}
                />
              </div>

              {currentId === 'review' || !section ? (
                <ReviewStep answers={answers} onEdit={handleJump} onBack={handleBack} headingRef={headingRef} />
              ) : (
                <form
                  key={currentId}
                  onSubmit={handleNext}
                  noValidate
                  className={`${cardClass} animate-fade-in-up motion-reduce:animate-none`}
                >
                  <div className="border-b border-gray-100 p-6 dark:border-slate-800 sm:p-8">
                    <div className="flex items-start gap-4">
                      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20">
                        <section.icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            ref={headingRef}
                            tabIndex={-1}
                            className="text-xl font-bold text-gray-900 focus:outline-none dark:text-gray-100 sm:text-2xl"
                          >
                            {t(`questionnaire.sections.${section.id}.title`)}
                          </h2>
                          {section.optional && (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                              {t('questionnaire.optional')}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-gray-600 dark:text-gray-300">{t(`questionnaire.sections.${section.id}.description`)}</p>
                      </div>
                    </div>
                    <UnlockChips sectionId={section.id} answers={merged} />
                  </div>

                  <div className="space-y-8 p-6 sm:p-8">
                    {errorCount > 0 && (
                      <p
                        role="alert"
                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                      >
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        {t('questionnaire.errors.fixBelow')}
                      </p>
                    )}
                    {visibleQuestions(section, merged).map((question) => (
                      <QuestionField
                        key={question.type === 'number' ? `${question.id}-${unitsKey}` : question.id}
                        question={question}
                        sectionId={section.id}
                        value={draft[question.id]}
                        onChange={(value) => setField(question.id, value)}
                        error={errors[question.id]}
                        units={units}
                        optional={!section.optional && !question.required}
                        firstRef={(element) => {
                          fieldRefs.current[question.id] = element;
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50/70 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60 sm:px-8">
                    <button type="button" onClick={handleBack} disabled={isFirst} className={secondaryButton}>
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      {t('questionnaire.back')}
                    </button>
                    <div className="flex items-center gap-2">
                      {section.optional && (
                        <button type="button" onClick={handleSkip} className={secondaryButton}>
                          {t('questionnaire.skip')}
                        </button>
                      )}
                      <button type="submit" className={primaryButton}>
                        {isLast ? t('questionnaire.toReview') : t('questionnaire.next')}
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {unlocked.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            role="status"
            className="flex animate-fade-in-up items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-medium text-white shadow-xl motion-reduce:animate-none dark:bg-white dark:text-gray-900"
          >
            <Sparkles className="h-4 w-4 flex-shrink-0 text-fuchsia-300 dark:text-fuchsia-500" aria-hidden="true" />
            {t('questionnaire.unlockedToast', { scores: unlocked.map((id) => t(`questionnaire.scores.${id}`)).join(', ') })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Questionnaire;
