import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useUserData } from '../../context/UserDataContext';
import { sectionById } from '../../questionnaire/sections';
import { fromStandard, toStandard, unitFor } from '../../lib/units';
import { labItemsFromCloud, parseLabReport } from '../../ocr/labParser';
import { readDocument } from '../../ocr/readDocument';
import { extractDocument } from '../../api/extract';
import { DialogFrame, FilePicker, FooterButtons, Problem, Reading } from './DialogFrame';
import { ConsentPanel, EnhancedOffer, useEnhancedReading } from './EnhancedReading';

// "Import from a lab report": read a PDF or photo on this device, let the user check every value,
// then hand the confirmed values (standard units, keyed by Vitals question id) to onApply.
// If the user has switched on Enhanced reading, a file can also be sent (with consent) to a cloud reader.

const VITALS = sectionById('vitals');
const questionFor = (field) => VITALS.questions.find((question) => question.id === field);

// Values are edited in the user's own units, like the questionnaire
const displayUnit = (question, units) => (question.kind ? unitFor(question.kind, units) : question.unit);
const toDisplay = (question, value, units) => {
  const shown = question.kind ? fromStandard(question.kind, value, units) : value;
  return String(Math.round(shown * 100) / 100);
};
const fromDisplay = (question, text, units) => (question.kind ? toStandard(question.kind, text, units) : Number(text));

const ImportReportDialog = ({ onClose, onApply }) => {
  const { t } = useTranslation();
  const { answers, settings } = useUserData();
  const units = settings.units;
  const [phase, setPhase] = useState('choose'); // choose | reading | review | empty | failed | consent | cloud
  const [step, setStep] = useState(null);
  const [rows, setRows] = useState([]);
  const [file, setFile] = useState(null);
  const [source, setSource] = useState('device'); // device | cloud
  const [cloudError, setCloudError] = useState(null);
  const enhanced = useEnhancedReading();

  const showItems = (items) => {
    setRows(
      items.map((item) => ({
        ...item,
        text: toDisplay(questionFor(item.field), item.standardValue, units),
        checked: item.inRange && item.confidence >= 0.5,
      }))
    );
    setPhase(items.length > 0 ? 'review' : 'empty');
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
      showItems(parseLabReport(lines));
    } catch {
      setPhase('failed');
    }
  };

  const readInCloud = async () => {
    setPhase('cloud');
    setCloudError(null);
    try {
      const result = await extractDocument('labReport', file);
      setSource('cloud');
      showItems(labItemsFromCloud(result.labResults || []));
    } catch (error) {
      setCloudError(error.code || 'unknown');
      setPhase('failed');
    }
  };

  const update = (field, changes) => setRows((current) => current.map((row) => (row.field === field ? { ...row, ...changes } : row)));
  const selected = rows.filter((row) => row.checked && row.text !== '' && !Number.isNaN(Number(row.text)));

  const save = () => {
    const values = Object.fromEntries(
      selected.map((row) => [row.field, Math.round(fromDisplay(questionFor(row.field), row.text, units) * 1000) / 1000])
    );
    onApply(values);
  };

  const current = answers.vitals || {};
  const done = phase === 'review' || phase === 'empty' || phase === 'failed';
  const busy = phase === 'reading' || phase === 'cloud';
  // Offered after an on-device attempt, unless the cloud reader was already used for this file
  const offerEnhanced = enhanced.available && file && source === 'device' && done && !cloudError;

  return (
    <DialogFrame
      title={phase === 'review' ? t('import.reviewTitle') : t('import.title')}
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
          saveLabel={selected.length === 1 ? t('import.saveOne') : t('import.save', { count: selected.length })}
          saveDisabled={selected.length === 0}
        />
      }
    >
      {phase === 'choose' && <FilePicker intro={t('import.intro')} label={t('import.choose')} onFile={read} />}
      {phase === 'reading' && <Reading message={t(`import.steps.${step || 'starting'}`)} />}
      {phase === 'cloud' && <Reading message={t('enhanced.reading', { provider: enhanced.providerName })} />}
      {phase === 'consent' && <ConsentPanel providerName={enhanced.providerName} onSend={readInCloud} />}
      {phase === 'empty' && <Problem message={t('import.nothingFound')} />}
      {phase === 'failed' && <Problem message={cloudError ? t(`enhanced.errors.${cloudError}`) : t('import.failed')} />}
      {offerEnhanced && phase !== 'review' && (
        <div className="mt-4">
          <EnhancedOffer providerName={enhanced.providerName} onClick={() => setPhase('consent')} />
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('import.reviewHelp')}</p>
          {offerEnhanced && <EnhancedOffer providerName={enhanced.providerName} onClick={() => setPhase('consent')} />}
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {rows.map((row) => {
              const question = questionFor(row.field);
              const label = t(`questionnaire.questions.${row.field}.label`);
              const inputId = `import-${row.field}`;
              return (
                <li key={row.field} className="flex gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={(event) => update(row.field, { checked: event.target.checked })}
                    aria-label={t('import.include', { test: label })}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <label htmlFor={inputId} className="font-medium text-gray-900 dark:text-gray-100">
                        {label}
                      </label>
                      {row.confidence < 0.7 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          {t('import.lowConfidence')}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-gray-500 dark:text-gray-400" title={row.sourceText}>
                      {t('import.fromReport')}: “{row.sourceText}”
                    </p>
                    {row.notes.map((note) => (
                      <p key={note} className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                        {t(`import.notes.${note}`, { unit: row.unit })}
                      </p>
                    ))}
                    {current[row.field] !== undefined && current[row.field] !== null && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {t('import.current', { value: `${toDisplay(question, current[row.field], units)} ${displayUnit(question, units)}` })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      id={inputId}
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={row.text}
                      onChange={(event) => update(row.field, { text: event.target.value, checked: true })}
                      className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
                    />
                    <span className="w-20 text-xs text-gray-500 dark:text-gray-400">{displayUnit(question, units)}</span>
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

export default ImportReportDialog;
