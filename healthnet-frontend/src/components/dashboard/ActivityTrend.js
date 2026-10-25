import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import { Loader2, RefreshCw } from 'lucide-react';
import '../../chartSetup';
import { useAuth } from '../../context/AuthContext';
import { useUserData } from '../../context/UserDataContext';
import { useTranslation } from '../../i18n';
import { themedOptions, useChartColors } from '../../lib/chartTheme';
import { activitySeries, hasReadings, isSyncDue, latestReading, METRICS, syncGoogleHealth, SYNC_DAYS } from '../../wearables/activity';
import { useActivityDays, useGoogleConnection } from '../../wearables/useWearables';

// Daily steps, resting heart rate and sleep from a connected wearable, for the last 30 days.
// Syncs by itself when the device is connected and the last sync is a few hours old.

const display = (metric, value) => (METRICS[metric].toDisplay ? METRICS[metric].toDisplay(value) : value);

const ActivityTrend = () => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const colors = useChartColors();
  const { settings, updateSettings } = useUserData();
  // Only people who connected a device in Settings cause a request to the server
  const connection = useGoogleConnection(settings.connectedDevice === 'google');
  const [refreshKey, setRefreshKey] = useState(0);
  const stored = useActivityDays(SYNC_DAYS, refreshKey);
  const [metric, setMetric] = useState('steps');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const autoSynced = useRef(false);
  const google = connection.google;

  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      await syncGoogleHealth(user.uid);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      if (error.code === 'reconnect' || error.code === 'notConnected') {
        setSyncError('reconnect');
        updateSettings({ connectedDevice: null }).catch(() => {});
      } else {
        setSyncError('failed');
      }
    } finally {
      setSyncing(false);
      connection.refresh();
    }
  };

  useEffect(() => {
    if (autoSynced.current || !google?.connected || !isSyncDue(google.lastSyncAt)) return;
    autoSynced.current = true;
    sync();
    // Once per visit, as soon as the connection is known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google]);

  const series = useMemo(() => (stored ? activitySeries(stored, new Date(), SYNC_DAYS) : []), [stored]);
  const field = METRICS[metric].field;
  const latest = latestReading(series, field);
  const values = series.filter((day) => day[field] !== null).map((day) => day[field]);
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  const chart = useMemo(() => {
    const { color, chart: type } = METRICS[metric];
    const label = t(`dashboard.activity.metrics.${metric}`);
    const data = {
      labels: series.map((day) => day.date.toLocaleDateString(language, { month: 'short', day: 'numeric' })),
      datasets: [{
        label,
        data: series.map((day) => (day[field] === null ? null : display(metric, day[field]))),
        borderColor: color,
        backgroundColor: type === 'bar' ? color.replace('rgb', 'rgba').replace(')', ', 0.7)') : color.replace('rgb', 'rgba').replace(')', ', 0.1)'),
        borderRadius: 4,
        // Monotone curves never overshoot the real readings between days
        cubicInterpolationMode: 'monotone',
        spanGaps: true,
      }],
    };
    const options = themedOptions(
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: false } },
        scales: { x: {}, y: { beginAtZero: type === 'bar' } },
      },
      colors
    );
    options.scales.x.ticks = { ...options.scales.x.ticks, maxTicksLimit: 8, maxRotation: 0 };
    return { type, data, options };
  }, [series, metric, field, colors, language, t]);

  const formatValue = (value) =>
    t(`dashboard.activity.units.${metric}`, { value: Number(display(metric, value).toFixed(metric === 'sleep' ? 1 : 0)).toLocaleString(language) });

  let body;
  if (stored === null) {
    body = <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>;
  } else if (!hasReadings(series)) {
    body = (
      <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-slate-600">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {google?.connected ? t('dashboard.activity.emptyConnected', { days: SYNC_DAYS }) : t('dashboard.activity.empty')}
        </p>
        {!google?.connected && (
          <Link to="/settings#devices" className="mt-3 inline-block text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            {t('dashboard.activity.connect')}
          </Link>
        )}
      </div>
    );
  } else {
    body = (
      <>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-slate-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.activity.latest')}</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-gray-100" data-testid="activity-latest">
              {latest ? formatValue(latest[field]) : '—'}
            </p>
            {latest && <p className="text-xs text-gray-500 dark:text-gray-400">{latest.date.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-slate-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('dashboard.activity.average', { days: SYNC_DAYS })}</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-gray-100" data-testid="activity-average">
              {average === null ? '—' : formatValue(average)}
            </p>
          </div>
        </div>
        <div className="relative h-64" role="img" aria-label={t('dashboard.activity.chartLabel', { metric: t(`dashboard.activity.metrics.${metric}`), days: SYNC_DAYS })}>
          {chart.type === 'bar' ? <Bar data={chart.data} options={chart.options} /> : <Line data={chart.data} options={chart.options} />}
        </div>
      </>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">{t('dashboard.activity.title')}</h3>
        <div role="radiogroup" aria-label={t('dashboard.activity.show')} className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-slate-800">
          {Object.keys(METRICS).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={metric === id}
              onClick={() => setMetric(id)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors sm:text-sm ${
                metric === id ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              {t(`dashboard.activity.metrics.${id}`)}
            </button>
          ))}
        </div>
      </div>

      {body}

      {google?.connected && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {google.lastSyncAt
              ? t('dashboard.activity.source', { time: new Date(google.lastSyncAt).toLocaleString(language) })
              : t('dashboard.activity.sourceNew')}
          </span>
          <button
            type="button"
            onClick={sync}
            disabled={syncing}
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline disabled:opacity-60 dark:text-indigo-400"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            {syncing ? t('devices.syncing') : t('devices.syncNow')}
          </button>
        </div>
      )}
      {syncError && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {syncError === 'reconnect' ? (
            <>
              {t('devices.errors.reconnect')}{' '}
              <Link to="/settings#devices" className="font-semibold underline">{t('dashboard.activity.openSettings')}</Link>
            </>
          ) : (
            t('dashboard.activity.syncFailed')
          )}
        </p>
      )}
    </div>
  );
};

export default ActivityTrend;
