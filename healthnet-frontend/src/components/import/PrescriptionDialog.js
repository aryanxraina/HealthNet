import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { matchDrug } from '../../api/drugs';
import { parsePrescription } from '../../ocr/prescriptionParser';
import { readDocument } from '../../ocr/readDocument';
import { frequencyText, instructionsText } from '../../lib/medicationText';
import { extractDocument } from '../../api/extract';
import { DialogFrame, FilePicker, FooterButtons, Problem, Reading } from './DialogFrame';
import { ConsentPanel, EnhancedOffer, useEnhancedReading } from './EnhancedReading';

// "Add from a prescription": read a photo or PDF on this device, find the medicines, check each
// name against RxNorm, and let the user confirm everything. onApply receives medication items:
// { id, name, strength, frequency, duration, instructions, rxcui, ingredient, matchedName, source }

const newId = () => `med-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100';

// Looks up every medicine in parallel; the dialog still works if the drug database can't be reached
export const withDrugMatches = async (medicines) => {
  const lookups = await Promise.allSettled(medicines.map((m) => matchDrug([m.name, m.strength].filter(Boolean).join(' '))));
  const offline = lookups.some((lookup) => lookup.status === 'rejected');
  const matched = medicines.map((medicine, index) => {
    const best = lookups[index].status === 'fulfilled' ? lookups[index].value.matches[0] : null;
    return best ? { ...medicine, rxcui: best.rxcui, ingredient: best.ingredient || null, matchedName: best.name } : { ...medicine, rxcui: null, ingredient: null, matchedName: null };
  });
  return { medicines: matched, offline };
};

const PrescriptionDialog = ({ onClose, onApply }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('choose'); // choose | reading | matching | review | empty | failed | consent | cloud
  const [step, setStep] = useState(null);
  const [rows, setRows] = useState([]);
  const [offline, setOffline] = useState(false);
  const [file, setFile] = useState(null);
  const [source, setSource] = useState('device'); // device | cloud
  const [cloudError, setCloudError] = useState(null);
  const enhanced = useEnhancedReading();

  // Medicines from either reader are checked against RxNorm, then shown for review
  const showMedicines = async (found) => {
    if (found.length === 0) {
      setRows([]);
      setPhase('empty');
      return;
    }
    setPhase('matching');
    const result = await withDrugMatches(found);
    setOffline(result.offline);
    setRows(
      result.medicines.map((medicine) => ({
        ...medicine,
        id: newId(),
        frequency: frequencyText(medicine.frequency, t),
        instructions: instructionsText(medicine.instructions, t),
        checked: true,
      }))
    );
    setPhase('review');
  };

  const read = async (chosen) => {
    if (!chosen) return;
    setFile(chosen);
    setSource('device');
    setCloudError(null);
    setPhase('reading');
    setStep(null);
    try {
      const { lines } = await readDocument(chosen, setStep);
      await showMedicines(parsePrescription(lines));
    } catch {
      setPhase('failed');
    }
  };

  const readInCloud = async () => {
    setPhase('cloud');
    setCloudError(null);
    try {
      const result = await extractDocument('prescription', file);
      setSource('cloud');
      await showMedicines(
        (result.medicines || []).map((medicine) => ({
          name: medicine.name,
          strength: medicine.strength || null,
          frequency: medicine.frequency || null,
          duration: medicine.duration || null,
          instructions: medicine.instructions || null,
          sourceText: medicine.sourceText,
          confidence: 0.9,
        }))
      );
    } catch (error) {
      setCloudError(error.code || 'unknown');
      setPhase('failed');
    }
  };

  const update = (id, changes) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  const selected = rows.filter((row) => row.checked && row.name.trim());

  const save = () =>
    onApply(
      selected.map(({ checked, sourceText, confidence, ...medicine }) => ({
        ...medicine,
        name: medicine.name.trim(),
        source: 'prescription',
      }))
    );

  const done = phase === 'review' || phase === 'empty' || phase === 'failed';
  const busy = phase === 'reading' || phase === 'matching' || phase === 'cloud';
  // Offered after an on-device attempt, unless the cloud reader was already used for this file
  const offerEnhanced = enhanced.available && file && source === 'device' && done && !cloudError;

  return (
    <DialogFrame
      title={phase === 'review' ? t('prescription.reviewTitle') : t('prescription.title')}
      onClose={onClose}
      busy={busy}
      focusKey={phase}
      privacyNote={
        source === 'cloud'
          ? t('enhanced.readBy', { provider: enhanced.providerName })
          : phase === 'consent' || phase === 'cloud'
            ? t('enhanced.sendNote', { provider: enhanced.providerName })
            : null
      }
      footer={
        <FooterButtons
          onBack={done || phase === 'consent' ? () => setPhase(phase === 'consent' ? (rows.length ? 'review' : 'empty') : 'choose') : null}
          backLabel={phase === 'consent' ? t('enhanced.back') : t('import.chooseAnother')}
          onCancel={onClose}
          cancelDisabled={busy}
          onSave={phase === 'review' ? save : null}
          saveLabel={selected.length === 1 ? t('prescription.saveOne') : t('prescription.save', { count: selected.length })}
          saveDisabled={selected.length === 0}
        />
      }
    >
      {phase === 'choose' && <FilePicker intro={t('prescription.intro')} label={t('prescription.choose')} onFile={read} />}
      {phase === 'reading' && <Reading message={t(`import.steps.${step || 'starting'}`)} />}
      {phase === 'matching' && <Reading message={t('prescription.matching')} />}
      {phase === 'cloud' && <Reading message={t('enhanced.reading', { provider: enhanced.providerName })} />}
      {phase === 'consent' && <ConsentPanel providerName={enhanced.providerName} onSend={readInCloud} />}
      {phase === 'empty' && <Problem message={t('prescription.nothingFound')} />}
      {phase === 'failed' && <Problem message={cloudError ? t(`enhanced.errors.${cloudError}`) : t('import.failed')} />}
      {offerEnhanced && phase !== 'review' && (
        <div className="mt-4">
          <EnhancedOffer providerName={enhanced.providerName} onClick={() => setPhase('consent')} />
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-4">
          <p className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {t('prescription.warning')}
          </p>
          {offline && <p className="text-xs text-gray-500 dark:text-gray-400">{t('prescription.offline')}</p>}
          {offerEnhanced && <EnhancedOffer providerName={enhanced.providerName} onClick={() => setPhase('consent')} />}
          <ul className="space-y-3">
            {rows.map((row, index) => {
              const label = row.name || t('prescription.fields.name');
              return (
                <li key={row.id} className="rounded-xl border border-gray-200 p-3 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(event) => update(row.id, { checked: event.target.checked })}
                      aria-label={t('import.include', { test: label })}
                      className="mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="col-span-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                        {t('prescription.fields.name')}
                        <input
                          className={`${inputClass} mt-1`}
                          value={row.name}
                          // A changed name may no longer be the matched drug
                          onChange={(event) => update(row.id, { name: event.target.value, rxcui: null, ingredient: null, matchedName: null })}
                          aria-label={`${t('prescription.fields.name')} ${index + 1}`}
                        />
                      </label>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {t('prescription.fields.strength')}
                        <input className={`${inputClass} mt-1`} value={row.strength || ''} onChange={(event) => update(row.id, { strength: event.target.value })} />
                      </label>
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {t('prescription.fields.frequency')}
                        <input className={`${inputClass} mt-1`} value={row.frequency || ''} onChange={(event) => update(row.id, { frequency: event.target.value })} />
                      </label>
                      <label className="col-span-2 text-xs font-medium text-gray-600 dark:text-gray-300 sm:col-span-4">
                        {t('prescription.fields.notes')}
                        <input
                          className={`${inputClass} mt-1`}
                          value={[row.instructions, row.duration && t('prescription.duration', { duration: row.duration })].filter(Boolean).join(', ')}
                          onChange={(event) => update(row.id, { instructions: event.target.value, duration: null })}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="mt-2 space-y-0.5 pl-7 text-xs">
                    {row.matchedName ? (
                      <p className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('prescription.matched', { name: row.matchedName })}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('prescription.notMatched')}
                      </p>
                    )}
                    <p className="truncate font-mono text-gray-500 dark:text-gray-400" title={row.sourceText}>
                      {t('import.fromReport')}: “{row.sourceText}”
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </DialogFrame>
  );
};

export default PrescriptionDialog;
