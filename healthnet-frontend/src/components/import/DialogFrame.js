import React, { useEffect, useRef } from 'react';
import { AlertTriangle, FileUp, Loader2, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from '../../i18n';

// Shared pieces of the "read a document" dialogs (lab reports, prescriptions)

// privacyNote replaces the default "read on your device" line (e.g. after an enhanced cloud reading);
// false hides it for dialogs that don't read documents
export const DialogFrame = ({ title, onClose, busy, footer, children, focusKey, privacyNote }) => {
  const { t } = useTranslation();
  const dialogRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  useEffect(() => {
    dialogRef.current?.querySelector('button, input')?.focus();
  }, [focusKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-slate-800">
          <div>
            <h2 id="import-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            {privacyNote !== false && (
            <p
              className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${
                privacyNote ? 'text-violet-700 dark:text-violet-300' : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {privacyNote || t('import.privacy')}
            </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('common.close')}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/60">
          {footer}
        </div>
      </div>
    </div>
  );
};

export const FilePicker = ({ intro, label, onFile }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-300">{intro}</p>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 px-6 py-10 text-center hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-indigo-900 dark:hover:bg-indigo-950/30">
        <FileUp className="h-8 w-8 text-indigo-500" aria-hidden="true" />
        <span className="font-semibold text-indigo-700 dark:text-indigo-300">{label}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">{t('import.formats')}</span>
        <input type="file" accept="application/pdf,image/*" className="sr-only" aria-label={label} onChange={(event) => onFile(event.target.files?.[0])} />
      </label>
    </div>
  );
};

export const Reading = ({ message }) => (
  <div role="status" className="flex flex-col items-center gap-3 py-10 text-sm text-gray-600 dark:text-gray-300">
    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-hidden="true" />
    {message}
  </div>
);

export const Problem = ({ message }) => (
  <div role="alert" className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
    <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
    <p>{message}</p>
  </div>
);

export const FooterButtons = ({ onBack, backLabel, onCancel, cancelDisabled, onSave, saveLabel, saveDisabled }) => {
  const { t } = useTranslation();
  return (
    <>
      {onBack ? (
        <button type="button" onClick={onBack} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelDisabled}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-slate-800"
        >
          {t('common.cancel')}
        </button>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            {saveLabel}
          </button>
        )}
      </div>
    </>
  );
};
