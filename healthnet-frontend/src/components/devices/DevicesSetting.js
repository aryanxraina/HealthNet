import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, Watch } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useUserData } from '../../context/UserDataContext';
import { useTranslation } from '../../i18n';
import { connectGoogle, disconnectGoogle } from '../../api/wearables';
import { syncGoogleHealth, SYNC_DAYS } from '../../wearables/activity';
import { useGoogleConnection } from '../../wearables/useWearables';
import ComingSoonBadge from '../ComingSoonBadge';

// Settings > Devices: connect Google Health (Fitbit, Pixel Watch and apps that share with it), sync, disconnect.
// Google sends people back to /settings?device=google&result=connected|denied|expired|failed.

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const LATER = ['withings', 'oura', 'appleHealth'];

const errorKey = (code) =>
  ['notConfigured', 'notConnected', 'reconnect', 'forbidden', 'rateLimited', 'unavailable', 'auth'].includes(code)
    ? `devices.errors.${code}`
    : 'devices.errors.unknown';

const DevicesSetting = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { status: dataStatus, settings, updateSettings } = useUserData();
  const connection = useGoogleConnection();
  const [searchParams, setSearchParams] = useSearchParams();
  const [working, setWorking] = useState(null); // connect | sync | disconnect
  const [notice, setNotice] = useState(null); // { kind: 'success' | 'error', text }
  const handledReturn = useRef(false);
  const google = connection.google;

  const sync = async () => {
    setWorking('sync');
    setNotice(null);
    try {
      const count = await syncGoogleHealth(user.uid);
      setNotice({ kind: 'success', text: count ? t('devices.synced', { count }) : t('devices.syncedNothing') });
    } catch (error) {
      setNotice({ kind: 'error', text: t(errorKey(error.code)) });
    } finally {
      setWorking(null);
      connection.refresh();
    }
  };

  // Keep the Dashboard's hint in step with the server, once the saved settings have loaded
  const connected = connection.status === 'ready' ? Boolean(google?.connected) : null;
  useEffect(() => {
    if (dataStatus !== 'ready' || connected === null || connected === (settings.connectedDevice === 'google')) return;
    updateSettings({ connectedDevice: connected ? 'google' : null }).catch(() => {});
  }, [dataStatus, connected, settings.connectedDevice, updateSettings]);

  // Coming back from Google's sign-in page
  useEffect(() => {
    const result = searchParams.get('result');
    if (searchParams.get('device') !== 'google' || !result || handledReturn.current) return;
    handledReturn.current = true;
    setSearchParams({}, { replace: true });
    if (result === 'connected') {
      sync();
    } else {
      setNotice({ kind: 'error', text: t(`devices.return.${['denied', 'expired'].includes(result) ? result : 'failed'}`) });
    }
    // Runs once for the return address; sync uses the current user
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const connect = async () => {
    setWorking('connect');
    setNotice(null);
    try {
      window.location.assign(await connectGoogle());
    } catch (error) {
      setNotice({ kind: 'error', text: t(errorKey(error.code)) });
      setWorking(null);
    }
  };

  const disconnect = async () => {
    setWorking('disconnect');
    setNotice(null);
    try {
      await disconnectGoogle();
      setNotice({ kind: 'success', text: t('devices.disconnected') });
    } catch (error) {
      setNotice({ kind: 'error', text: t(errorKey(error.code)) });
    } finally {
      setWorking(null);
      connection.refresh();
    }
  };

  let statusText;
  if (connection.status === 'loading') statusText = t('devices.status.checking');
  else if (connection.status === 'unreachable') statusText = t('devices.status.unreachable');
  else if (!google?.available) statusText = t('devices.status.notConfigured');
  else if (!google.connected) statusText = t('devices.status.notConnected');
  else if (google.lastSyncAt) statusText = t('devices.status.lastSync', { time: new Date(google.lastSyncAt).toLocaleString() });
  else statusText = t('devices.status.connected');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 p-4 dark:border-slate-700">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Watch className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-100">{t('devices.google.name')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('devices.google.help')}</p>
              <p className={`mt-1 text-sm font-medium ${google?.connected ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-300'}`} data-testid="google-health-status">
                {statusText}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
            {google?.connected ? (
              <>
                <button
                  type="button"
                  onClick={sync}
                  disabled={Boolean(working)}
                  className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500`}
                >
                  {working === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                  {working === 'sync' ? t('devices.syncing') : t('devices.syncNow')}
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={Boolean(working)}
                  className={`${buttonClass} border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-200 dark:hover:bg-slate-800`}
                >
                  {t('devices.disconnect')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={Boolean(working) || !google?.available}
                className={`${buttonClass} bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500`}
              >
                {working === 'connect' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t('devices.connect')}
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t('devices.privacy', { days: SYNC_DAYS })}</p>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`text-sm ${notice.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}
        >
          {notice.text}
        </p>
      )}

      <ul className="space-y-2">
        {LATER.map((id) => (
          <li key={id} className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-200 px-4 py-2 dark:border-slate-700">
            <span className="text-sm text-gray-600 dark:text-gray-300">{t(`devices.later.${id}`)}</span>
            <ComingSoonBadge />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DevicesSetting;
