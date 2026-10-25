import React, { useState } from 'react';
import { CheckCircle2, FileUp, Plus, X } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { parsePrescription } from '../../ocr/prescriptionParser';
import { frequencyText, instructionsText, medicationSummary } from '../../lib/medicationText';
import PrescriptionDialog, { withDrugMatches } from '../import/PrescriptionDialog';

// The structured "Medicines you take" answer: add from a prescription or by typing, remove any time.
// value: [{ id, name, strength, frequency, duration, instructions, rxcui, ingredient, matchedName, source }]

const sameMedicine = (a, b) =>
  a.name.trim().toLowerCase() === b.name.trim().toLowerCase() && (a.strength || '').toLowerCase() === (b.strength || '').toLowerCase();

const MedicationList = ({ value = [], onChange, labelledBy }) => {
  const { t } = useTranslation();
  const [reading, setReading] = useState(false);
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);

  const add = (items) => onChange([...value, ...items.filter((item) => !value.some((existing) => sameMedicine(existing, item)))]);

  const addTyped = async (event) => {
    event.preventDefault();
    const typed = text.trim();
    if (!typed) return;
    // "Metformin 500 mg twice a day" is split up the same way as a prescription line
    const [parsed] = parsePrescription([{ text: typed, confidence: 1 }]);
    const medicine = parsed || { name: typed, strength: null, frequency: null, duration: null, instructions: null };
    setChecking(true);
    const { medicines } = await withDrugMatches([medicine]);
    const [checked] = medicines;
    add([
      {
        id: `med-${Date.now().toString(36)}`,
        name: checked.name,
        strength: checked.strength,
        frequency: frequencyText(checked.frequency, t),
        duration: checked.duration,
        instructions: instructionsText(checked.instructions, t),
        rxcui: checked.rxcui,
        ingredient: checked.ingredient,
        matchedName: checked.matchedName,
        source: 'manual',
      },
    ]);
    setText('');
    setChecking(false);
  };

  return (
    <div className="space-y-3" role="group" aria-labelledby={labelledBy}>
      {value.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('prescription.list.empty')}</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-slate-800 dark:border-slate-700">
          {value.map((medicine) => (
            <li key={medicine.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{medicationSummary(medicine)}</p>
                {medicine.rxcui && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('prescription.matched', { name: medicine.matchedName || medicine.ingredient || medicine.name })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item.id !== medicine.id))}
                aria-label={t('prescription.list.remove', { name: medicine.name })}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => setReading(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/70"
        >
          <FileUp className="h-4 w-4" aria-hidden="true" />
          {t('prescription.button')}
        </button>
        <div className="flex flex-1 gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addTyped(event);
            }}
            placeholder={t('prescription.list.placeholder')}
            aria-label={t('prescription.list.add')}
            className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={addTyped}
            disabled={!text.trim() || checking}
            className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {checking ? t('prescription.list.checking') : t('prescription.list.addButton')}
          </button>
        </div>
      </div>

      {reading && (
        <PrescriptionDialog
          onClose={() => setReading(false)}
          onApply={(items) => {
            add(items);
            setReading(false);
          }}
        />
      )}
    </div>
  );
};

export default MedicationList;
