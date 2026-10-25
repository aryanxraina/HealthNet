import { syncGoogle } from '../api/wearables';
import { saveActivityDays } from '../firebase';
import { dateKey } from '../food/nutrition';

// Daily wearable readings: { steps, restingHeartRate, sleepMinutes } per 'YYYY-MM-DD'

export const SYNC_DAYS = 30;
// Devices upload with a delay, so recent days are fetched again when the last sync is this old
export const AUTO_SYNC_HOURS = 6;

export const METRICS = {
  steps: { field: 'steps', chart: 'bar', color: 'rgb(16, 185, 129)' },
  restingHeartRate: { field: 'restingHeartRate', chart: 'line', color: 'rgb(239, 68, 68)' },
  sleep: { field: 'sleepMinutes', chart: 'bar', color: 'rgb(99, 102, 241)', toDisplay: (minutes) => Math.round((minutes / 60) * 10) / 10 },
};

// The `count` days ending on `endDate`, oldest first, each with its readings (null when missing)
export const activitySeries = (stored, endDate, count) =>
  Array.from({ length: count }, (_, index) => {
    const day = new Date(endDate);
    day.setDate(day.getDate() - (count - 1 - index));
    const key = dateKey(day);
    const values = stored[key] || {};
    return {
      date: day,
      key,
      steps: values.steps ?? null,
      restingHeartRate: values.restingHeartRate ?? null,
      sleepMinutes: values.sleepMinutes ?? null,
    };
  });

export const hasReadings = (series) =>
  series.some((day) => day.steps !== null || day.restingHeartRate !== null || day.sleepMinutes !== null);

// The newest day with a value for `field`, or null
export const latestReading = (series, field) => [...series].reverse().find((day) => day[field] !== null) || null;

export const isSyncDue = (lastSyncAt, now = Date.now()) =>
  !lastSyncAt || now - new Date(lastSyncAt).getTime() > AUTO_SYNC_HOURS * 3600 * 1000;

// Fetches the last SYNC_DAYS days from Google Health and saves them; resolves to the number of days with data
export const syncGoogleHealth = async (uid, today = new Date()) => {
  const { days } = await syncGoogle(dateKey(today), SYNC_DAYS);
  if (days.length) await saveActivityDays(uid, days, 'google');
  return days.length;
};
