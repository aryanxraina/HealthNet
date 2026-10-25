import React, { useEffect, useState } from 'react';
import { Cloud, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useUserData } from '../../context/UserDataContext';
import { getExtractionStatus } from '../../api/extract';

// Optional cloud reading for documents the on-device reader struggles with. It is offered only when
// the user has switched it on in Settings and the HealthNet server has a provider configured, and
// every file needs the user's go-ahead before it is sent.

export const useEnhancedReading = () => {
  const { settings } = useUserData();
  const [status, setStatus] = useState(null);
  const wanted = Boolean(settings.enhancedReading);

  useEffect(() => {
    if (!wanted) return undefined;
    let live = true;
    getExtractionStatus()
      .then((result) => live && setStatus(result))
      .catch(() => live && setStatus(null));
    return () => {
      live = false;
    };
  }, [wanted]);

  return { available: wanted && Boolean(status?.available), providerName: status?.providerName || '' };
};

export const EnhancedOffer = ({ providerName, onClick }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-100 sm:flex-row sm:items-center">
      <Sparkles className="hidden h-5 w-5 flex-shrink-0 text-violet-500 sm:block" aria-hidden="true" />
      <p className="flex-1">{t('enhanced.offer', { provider: providerName })}</p>
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
      >
        {t('enhanced.try')}
      </button>
    </div>
  );
};

export const ConsentPanel = ({ providerName, onSend }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-300">
          <Cloud className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
          <p className="font-semibold text-gray-900 dark:text-gray-100">{t('enhanced.consentTitle', { provider: providerName })}</p>
          <p>{t('enhanced.consentBody', { provider: providerName })}</p>
          <ul className="list-disc space-y-1 pl-5 text-gray-600 dark:text-gray-300">
            <li>{t('enhanced.consentPoints.notStored')}</li>
            <li>{t('enhanced.consentPoints.provider', { provider: providerName })}</li>
            <li>{t('enhanced.consentPoints.review')}</li>
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={onSend}
        className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400"
      >
        {t('enhanced.send', { provider: providerName })}
      </button>
    </div>
  );
};

// Settings switch (off by default) with the server's provider status underneath
export const EnhancedReadingSetting = () => {
  const { t } = useTranslation();
  const { settings, updateSettings } = useUserData();
  const on = Boolean(settings.enhancedReading);
  const [status, setStatus] = useState(null); // null while unknown, { available, providerName } or 'unreachable'

  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    getExtractionStatus()
      .then((result) => live && setStatus(result))
      .catch(() => live && setStatus('unreachable'));
    return () => {
      live = false;
    };
  }, [on]);

  let statusText = null;
  if (on && status === 'unreachable') statusText = t('enhanced.setting.unreachable');
  else if (on && status && !status.available) statusText = t('enhanced.setting.notConfigured');
  else if (on && status?.available) statusText = t('enhanced.setting.ready', { provider: status.providerName });

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p id="enhanced-label" className="font-medium text-gray-800 dark:text-gray-100">
          {t('enhanced.setting.label')}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('enhanced.setting.help')}</p>
        {statusText && <p className="mt-1 text-sm font-medium text-violet-700 dark:text-violet-300">{statusText}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="enhanced-label"
        onClick={() => updateSettings({ enhancedReading: !on }).catch(() => {})}
        className={`relative mt-1 inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-violet-600 dark:bg-violet-500' : 'bg-gray-300 dark:bg-slate-600'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
};
