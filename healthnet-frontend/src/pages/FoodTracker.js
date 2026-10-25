import React, { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Activity, Barcode, ChevronLeft, ChevronRight, Plus, SlidersHorizontal, Trash2, Utensils } from 'lucide-react';
import '../chartSetup';
import { themedOptions, useChartColors } from '../lib/chartTheme';
import ComingSoonBadge from '../components/ComingSoonBadge';
import DataStatusBanner from '../components/DataStatusBanner';
import AddFoodDialog from '../components/food/AddFoodDialog';
import { useTranslation } from '../i18n';
import { useUserData } from '../context/UserDataContext';
import { DEFAULT_CALORIE_GOAL, MEALS, dayTotals, macroGoals, mealForTime, totalsOf } from '../food/nutrition';
import { useFoodDay, useFoodWeek } from '../food/useFoodLog';

// The food log: one day at a time, saved to Firestore (users/{uid}/food/{date})

const MACROS = [
  { id: 'carbs', letter: 'C', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200', bar: 'bg-blue-500' },
  { id: 'protein', letter: 'P', pill: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300', bar: 'bg-green-500' },
  { id: 'fat', letter: 'F', pill: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300', bar: 'bg-yellow-500' },
];

const cardClass = 'bg-white dark:bg-slate-900 rounded-lg shadow-sm p-6';
const tabClass = (isActive) =>
  `py-3 px-6 font-medium transition-colors ${
    isActive
      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-b-2 hover:border-gray-300 dark:hover:border-slate-600'
  }`;

const sameDay = (a, b) => a.toDateString() === b.toDateString();

const GoalEditor = ({ goal, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [value, setValue] = useState(String(goal));
  const number = Number(value);
  const valid = Number.isFinite(number) && number >= 800 && number <= 6000;
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onSave(Math.round(number));
      }}
    >
      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
        {t('food.goal.label')}
        <input
          type="number"
          min="800"
          max="6000"
          step="50"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-1 block w-28 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
        />
      </label>
      <button type="submit" disabled={!valid} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
        {t('common.save')}
      </button>
      <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300">
        {t('common.cancel')}
      </button>
      {!valid && <p className="w-full text-xs text-red-600 dark:text-red-400">{t('food.goal.range')}</p>}
    </form>
  );
};

const FoodTracker = () => {
  const { t, language } = useTranslation();
  const { settings, updateSettings } = useUserData();
  const [activeTab, setActiveTab] = useState('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [adding, setAdding] = useState(null); // { meal, tab }
  const [editingGoal, setEditingGoal] = useState(false);
  const day = useFoodDay(currentDate);
  const week = useFoodWeek(currentDate, activeTab === 'weekly' ? day.meals : null);
  const chartColors = useChartColors();

  const goal = settings.calorieGoal || DEFAULT_CALORIE_GOAL;
  const goals = macroGoals(goal);
  const totals = dayTotals(day.meals);
  const percent = Math.min((totals.kcal / goal) * 100, 100);
  const remaining = Math.max(goal - totals.kcal, 0);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  let dateLabel;
  if (sameDay(currentDate, today)) dateLabel = t('food.today');
  else if (sameDay(currentDate, yesterday)) dateLabel = t('food.yesterday');
  else dateLabel = currentDate.toLocaleDateString(language, { weekday: 'long', month: 'short', day: 'numeric' });

  const moveDate = (days) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  };

  const weekChart = useMemo(() => {
    const labels = (week || []).map(({ date }) => date.toLocaleDateString(language, { weekday: 'short' }));
    return {
      data: {
        labels,
        datasets: [
          { label: t('food.week.consumed'), data: (week || []).map(({ totals: dayTotal }) => dayTotal.kcal), borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4 },
          { label: t('food.week.goal'), data: labels.map(() => goal), borderColor: 'rgb(239, 68, 68)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderDash: [5, 5], tension: 0.4 },
        ],
      },
      options: themedOptions(
        { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, title: { display: true, text: t('food.week.chartTitle') } }, scales: { y: { beginAtZero: true } } },
        chartColors
      ),
    };
  }, [week, goal, language, t, chartColors]);

  const weekAverage = week && week.length ? Math.round(week.reduce((sum, d) => sum + d.totals.kcal, 0) / Math.max(1, week.filter((d) => d.totals.kcal > 0).length)) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('food.title')}</h1>
              <p className="mt-1 text-lg text-gray-600 dark:text-gray-300">{t('food.subtitle')}</p>
            </div>

            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <button type="button" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800" onClick={() => moveDate(-1)} aria-label={t('food.previousDay')}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="text-lg font-medium text-gray-900 dark:text-gray-100" aria-live="polite">{dateLabel}</div>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30"
                onClick={() => moveDate(1)}
                disabled={sameDay(currentDate, today)}
                aria-label={t('food.nextDay')}
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ml-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/60"
                onClick={() => setCurrentDate(new Date())}
              >
                {t('food.today')}
              </button>
            </div>
          </div>

          <DataStatusBanner className="mb-6" />
          {(day.status === 'error' || day.saveError) && (
            <p role="alert" className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              {t(day.saveError ? 'food.errors.saveFailed' : 'food.errors.loadFailed')}
            </p>
          )}

          <div className="flex border-b border-gray-200 dark:border-slate-700 mb-6">
            <button type="button" className={tabClass(activeTab === 'daily')} onClick={() => setActiveTab('daily')} aria-pressed={activeTab === 'daily'}>
              {t('food.daily')}
            </button>
            <button type="button" className={tabClass(activeTab === 'weekly')} onClick={() => setActiveTab('weekly')} aria-pressed={activeTab === 'weekly'}>
              {t('food.weekly')}
            </button>
          </div>

          {activeTab === 'daily' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-6">
                <section className={cardClass} aria-labelledby="calorie-summary">
                  <h2 id="calorie-summary" className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('food.summary.title')}</h2>
                  <div className="flex items-center justify-between mb-6">
                    <div className="relative w-24 h-24">
                      <svg className="transform -rotate-90" width="100" height="100" aria-hidden="true">
                        <circle className="text-gray-200 dark:text-slate-700" strokeWidth="8" stroke="currentColor" fill="transparent" r="40" cx="50" cy="50" />
                        <circle
                          className="text-blue-600 dark:text-blue-400"
                          strokeWidth="8"
                          strokeDasharray={251.2}
                          strokeDashoffset={251.2 - (251.2 * percent) / 100}
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                          r="40"
                          cx="50"
                          cy="50"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-gray-800 dark:text-gray-100">{Math.round(percent)}%</span>
                      </div>
                    </div>
                    <dl className="flex-1 ml-6 space-y-1 text-sm">
                      {[
                        ['consumed', totals.kcal],
                        ['goal', goal],
                        ['remaining', remaining],
                      ].map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <dt className="font-medium text-gray-500 dark:text-gray-400">{t(`food.summary.${key}`)}</dt>
                          <dd data-testid={`calories-${key}`} className={`font-semibold ${key === 'remaining' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <button type="button" disabled title={t('common.comingSoon')} className="px-4 py-2 bg-blue-500 text-white rounded-md inline-flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                      <Activity className="h-4 w-4 mr-2" aria-hidden="true" />
                      {t('food.summary.addExercise')}
                      <ComingSoonBadge className="ml-2" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGoal(true)}
                      className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-md inline-flex items-center hover:bg-gray-200 dark:hover:bg-slate-700"
                    >
                      <SlidersHorizontal className="h-4 w-4 mr-2" aria-hidden="true" />
                      {t('food.summary.adjustGoal')}
                    </button>
                  </div>
                  {editingGoal && (
                    <GoalEditor
                      goal={goal}
                      onCancel={() => setEditingGoal(false)}
                      onSave={(value) => {
                        updateSettings({ calorieGoal: value }).catch(() => {});
                        setEditingGoal(false);
                      }}
                    />
                  )}
                </section>

                <section className={cardClass} aria-labelledby="macros">
                  <h2 id="macros" className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('food.macros.title')}</h2>
                  <div className="space-y-4">
                    {MACROS.map((macro) => (
                      <div key={macro.id}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium mr-2 ${macro.pill}`}>{macro.letter}</span>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t(`food.nutrients.${macro.id}`)}</span>
                          </div>
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                            {Math.round(totals[macro.id])}g / {goals[macro.id]}g
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                          <div className={`${macro.bar} h-2 rounded-full transition-all duration-300`} style={{ width: `${Math.min((totals[macro.id] / goals[macro.id]) * 100, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t('food.macros.split')}</p>
                </section>

                <section className={cardClass} aria-labelledby="quick-add">
                  <h2 id="quick-add" className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">{t('food.quick.title')}</h2>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setAdding({ meal: mealForTime(), tab: 'search' })}
                      className="w-full text-left p-3 border border-gray-200 dark:border-slate-700 rounded-lg flex items-center hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-3" aria-hidden="true" />
                      <span className="text-gray-700 dark:text-gray-200">{t('food.quick.addFood')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdding({ meal: mealForTime(), tab: 'barcode' })}
                      className="w-full text-left p-3 border border-gray-200 dark:border-slate-700 rounded-lg flex items-center hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-slate-800"
                    >
                      <Barcode className="h-4 w-4 text-green-600 dark:text-green-400 mr-3" aria-hidden="true" />
                      <span className="text-gray-700 dark:text-gray-200">{t('food.quick.barcode')}</span>
                    </button>
                    <button type="button" disabled title={t('common.comingSoon')} className="w-full text-left p-3 border border-gray-200 dark:border-slate-700 rounded-lg flex items-center disabled:opacity-60 disabled:cursor-not-allowed">
                      <Utensils className="h-4 w-4 text-purple-600 dark:text-purple-400 mr-3" aria-hidden="true" />
                      <span className="text-gray-700 dark:text-gray-200">{t('food.quick.recipe')}</span>
                      <ComingSoonBadge className="ml-auto" />
                    </button>
                  </div>
                </section>
              </div>

              <section className={`lg:col-span-2 ${cardClass}`} aria-labelledby="meals-heading">
                <h2 id="meals-heading" className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-6">
                  {t('food.mealsFor', { date: dateLabel })}
                </h2>
                {day.status === 'loading' ? (
                  <div role="status" className="space-y-3">
                    <span className="sr-only">{t('common.loading')}</span>
                    {MEALS.map((meal) => (
                      <div key={meal} className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-slate-800" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {MEALS.map((meal) => {
                      const entries = day.meals[meal] || [];
                      const mealTotal = totalsOf(entries);
                      return (
                        <div key={meal} aria-labelledby={`meal-${meal}`} role="group">
                          <div className="flex justify-between items-center mb-3">
                            <h3 id={`meal-${meal}`} className="text-lg font-medium text-gray-800 dark:text-gray-100">
                              {t(`food.meals.${meal}`)}
                              {entries.length > 0 && <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">{t('food.kcal', { kcal: mealTotal.kcal })}</span>}
                            </h3>
                            <button
                              type="button"
                              onClick={() => setAdding({ meal, tab: 'search' })}
                              aria-label={t('food.addTo', { meal: t(`food.meals.${meal}`) })}
                              className="text-blue-600 dark:text-blue-400 text-sm font-medium inline-flex items-center hover:text-blue-800"
                            >
                              <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                              {t('food.addFood')}
                            </button>
                          </div>
                          {entries.length === 0 ? (
                            <div className="bg-gray-50 dark:bg-slate-800/60 rounded-lg p-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('food.noFoods')}</div>
                          ) : (
                            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 dark:divide-slate-800 dark:border-slate-800">
                              {entries.map((entry) => (
                                <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{entry.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {entry.amountLabel}
                                      {entry.protein !== null && ` · ${t('food.entryMacros', { protein: entry.protein ?? 0, carbs: entry.carbs ?? 0, fat: entry.fat ?? 0 })}`}
                                    </p>
                                  </div>
                                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('food.kcal', { kcal: entry.kcal })}</span>
                                  <button
                                    type="button"
                                    onClick={() => day.removeEntry(meal, entry.id)}
                                    aria-label={t('food.remove', { name: entry.name })}
                                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-slate-800"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'weekly' && (
            <section className={cardClass} aria-labelledby="week-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
                <h2 id="week-heading" className="text-xl font-semibold text-gray-800 dark:text-gray-100">{t('food.week.title')}</h2>
                {weekAverage > 0 && <p className="text-sm text-gray-600 dark:text-gray-300">{t('food.week.average', { kcal: weekAverage })}</p>}
              </div>
              <div className="relative h-64">{week && <Line data={weekChart.data} options={weekChart.options} />}</div>
            </section>
          )}
        </div>
      </div>

      {adding && (
        <AddFoodDialog
          meal={adding.meal}
          initialTab={adding.tab}
          onClose={() => setAdding(null)}
          onAdd={(entries) => {
            day.addEntries(adding.meal, entries);
            setAdding(null);
          }}
        />
      )}
    </div>
  );
};

export default FoodTracker;
