import React, { useEffect, useRef, useState } from 'react';
import { Cpu, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { getModelStore, MODELS } from '../../models';
import { compareVersions } from '../../models/semver';
import { forgetLoadedTagger } from '../../ocr/tagger/tagger';

// Settings > On-device models: which version of each model this device uses, with signed updates
// (src/models). Nothing is checked until the person asks.

const kb = (bytes) => Math.max(1, Math.round(bytes / 1024));
const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const ModelSettings = ({ store = getModelStore() }) => {
  const { t, language } = useTranslation();
  const [installed, setInstalled] = useState({}); // id -> { version, installedAt, sizeBytes }, downloaded models only
  const [check, setCheck] = useState(null); // { models } after a check
  const [working, setWorking] = useState(null); // 'check' or a model id
  const [notice, setNotice] = useState(null); // { kind, text }

  const shown = useRef('{}');
  const refreshInstalled = async () => {
    const entries = await Promise.all(Object.keys(MODELS).map(async (id) => [id, await store.installedInfo(id).catch(() => null)]));
    const next = Object.fromEntries(entries.filter(([, info]) => info));
    // Most devices have nothing downloaded: skip the update when nothing changed
    if (JSON.stringify(next) !== shown.current) {
      shown.current = JSON.stringify(next);
      setInstalled(next);
    }
  };

  useEffect(() => {
    refreshInstalled();
    // Once on opening Settings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (key, action) => {
    setWorking(key);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ kind: 'error', text: t(`models.errors.${error.code || 'network'}`) });
    } finally {
      setWorking(null);
    }
  };

  const checkNow = () =>
    run('check', async () => {
      const result = await store.check();
      setCheck(result);
      await refreshInstalled();
      const withdrawn = result.models.some((m) => m.status === 'disabled');
      setNotice({ kind: 'success', text: t(withdrawn ? 'models.withdrawn' : 'models.checked') });
      if (withdrawn) forgetLoadedTagger();
    });

  const install = (id) =>
    run(id, async () => {
      const version = await store.install(id);
      forgetLoadedTagger();
      await refreshInstalled();
      setCheck((current) => current && { models: current.models.map((m) => (m.id === id ? { ...m, installed: version, status: 'upToDate' } : m)) });
      setNotice({ kind: 'success', text: t('models.installed', { version }) });
    });

  const remove = (id) =>
    run(id, async () => {
      await store.remove(id);
      forgetLoadedTagger();
      await refreshInstalled();
      setCheck(null);
      setNotice({ kind: 'success', text: t('models.removed') });
    });

  return (
    <div className="space-y-4">
      {Object.entries(MODELS).map(([id, model]) => {
        const mine = installed[id];
        const latest = check?.models.find((m) => m.id === id);
        const usingDownload = mine && compareVersions(mine.version, model.builtInVersion) > 0;
        return (
          <div key={id} className="rounded-xl border border-gray-200 p-4 dark:border-slate-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                  <Cpu className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100">{t(`models.names.${id}`)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t(`models.descriptions.${id}`)}</p>
                  <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200" data-testid={`model-status-${id}`}>
                    {usingDownload
                      ? t('models.usingDownload', { version: mine.version, date: new Date(mine.installedAt).toLocaleDateString(language), size: kb(mine.sizeBytes) })
                      : t('models.usingBuiltIn', { version: model.builtInVersion })}
                  </p>
                  {latest?.status === 'updateAvailable' && (
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">{t('models.updateAvailable', { version: latest.latest, size: kb(latest.sizeBytes) })}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                {latest?.status === 'updateAvailable' && (
                  <button type="button" onClick={() => install(id)} disabled={Boolean(working)} className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500`}>
                    {working === id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {t('models.install', { version: latest.latest })}
                  </button>
                )}
                {mine && (
                  <button type="button" onClick={() => remove(id)} disabled={Boolean(working)} className={`${buttonClass} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800`}>
                    {t('models.remove')}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
          <ShieldCheck className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {t('models.privacy')}
        </p>
        <button type="button" onClick={checkNow} disabled={Boolean(working)} className={`${buttonClass} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800 sm:flex-shrink-0`}>
          {working === 'check' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          {t('models.check')}
        </button>
      </div>

      {notice && (
        <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {notice.text}
        </p>
      )}
    </div>
  );
};

export default ModelSettings;
