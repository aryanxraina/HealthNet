import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { dataErrorKey, useUserData } from '../context/UserDataContext';
import { useTranslation } from '../i18n';

// Explains loading or saving problems with cloud storage (e.g. Firestore not set up yet)
const DataStatusBanner = ({ className = '' }) => {
  const { status, error, saveStatus, reload } = useUserData();
  const { t } = useTranslation();

  const loadFailed = status === 'error';
  const saveFailed = saveStatus.state === 'error';
  if (!loadFailed && !saveFailed) {
    return null;
  }

  const problem = loadFailed ? error : saveStatus.error;
  const message = t(dataErrorKey(problem), { code: problem?.code || 'unknown' });

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <div className="flex-1">
        {saveFailed && !loadFailed && <p className="font-medium">{t('data.saveFailed')}</p>}
        <p>{message}</p>
      </div>
      {loadFailed && (
        <button
          type="button"
          onClick={reload}
          className="rounded-md bg-amber-100 px-3 py-1 font-medium hover:bg-amber-200 dark:bg-amber-900/60 dark:hover:bg-amber-900"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
};

export default DataStatusBanner;
