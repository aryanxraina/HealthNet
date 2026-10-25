import React, { useState } from 'react';
import { AlertTriangle, Camera } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { extractDocument } from '../../api/extract';
import { newEntryId } from '../../food/nutrition';
import { ConsentPanel } from '../import/EnhancedReading';
import { Problem, Reading } from '../import/DialogFrame';

// Meal photo -> estimated foods, through the opt-in cloud reader. Every estimate can be edited or
// unticked before it is logged. onAdd receives log entries marked source 'photo'.

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100';
const NUMBERS = ['kcal', 'protein', 'carbs', 'fat'];

const toEntry = (row) => ({
  id: newEntryId(),
  name: row.name.trim(),
  brand: null,
  amountLabel: row.portion.trim() || (row.grams ? `${row.grams} g` : '1 portion'),
  grams: row.grams ?? null,
  source: 'photo',
  sourceId: null,
  kcal: Math.round(Number(row.kcal) || 0),
  protein: row.protein === '' ? null : Number(row.protein),
  carbs: row.carbs === '' ? null : Number(row.carbs),
  fat: row.fat === '' ? null : Number(row.fat),
  fiber: null,
  sugar: null,
});

const MealPhoto = ({ meal, providerName, onAdd }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('choose'); // choose | consent | reading | review | empty | failed
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);

  const send = async () => {
    setPhase('reading');
    try {
      const { foods = [] } = await extractDocument('mealPhoto', file);
      setRows(
        foods.map((food, index) => ({
          key: index,
          checked: true,
          name: food.name,
          portion: food.portion,
          grams: food.grams,
          ...Object.fromEntries(NUMBERS.map((field) => [field, food[field] === null ? '' : String(food[field])])),
        }))
      );
      setPhase(foods.length ? 'review' : 'empty');
    } catch (failure) {
      setError(failure.code || 'unknown');
      setPhase('failed');
    }
  };

  const update = (key, changes) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  const selected = rows.filter((row) => row.checked && row.name.trim() && row.kcal !== '');

  if (phase === 'choose') {
    return (
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-violet-200 px-6 py-10 text-center hover:border-violet-400 dark:border-violet-900">
        <Camera className="h-8 w-8 text-violet-500" aria-hidden="true" />
        <span className="font-semibold text-violet-700 dark:text-violet-300">{t('food.photo.choose')}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{t('food.photo.help', { provider: providerName })}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label={t('food.photo.choose')}
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            if (chosen) {
              setFile(chosen);
              setPhase('consent');
            }
          }}
        />
      </label>
    );
  }
  if (phase === 'consent') return <ConsentPanel providerName={providerName} onSend={send} />;
  if (phase === 'reading') return <Reading message={t('enhanced.reading', { provider: providerName })} />;
  if (phase === 'empty') return <Problem message={t('food.photo.nothingFound')} />;
  if (phase === 'failed') return <Problem message={t(`enhanced.errors.${error}`)} />;

  return (
    <div className="space-y-3">
      <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {t('food.photo.estimates', { provider: providerName })}
      </p>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.key} className="rounded-xl border border-gray-200 p-3 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={row.checked}
                onChange={(event) => update(row.key, { checked: event.target.checked })}
                aria-label={t('import.include', { test: row.name })}
                className="mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-6">
                <input
                  className={`${inputClass} col-span-2 sm:col-span-3`}
                  value={row.name}
                  onChange={(event) => update(row.key, { name: event.target.value })}
                  aria-label={`${t('food.add.name')} ${index + 1}`}
                />
                <input
                  className={`${inputClass} col-span-2 sm:col-span-3`}
                  value={row.portion}
                  onChange={(event) => update(row.key, { portion: event.target.value })}
                  aria-label={`${t('food.add.portion')} ${index + 1}`}
                />
                {NUMBERS.map((field) => (
                  <label key={field} className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-1">
                    {t(`food.nutrients.${field}`)}
                    <input
                      className={`${inputClass} mt-0.5`}
                      type="number"
                      min="0"
                      step="any"
                      value={row[field]}
                      onChange={(event) => update(row.key, { [field]: event.target.value })}
                      aria-label={`${t(`food.nutrients.${field}`)} ${index + 1}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={selected.length === 0}
        onClick={() => onAdd(selected.map(toEntry))}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500"
      >
        {t('food.photo.add', { count: selected.length, meal: t(`food.meals.${meal}`) })}
      </button>
    </div>
  );
};

export default MealPhoto;
