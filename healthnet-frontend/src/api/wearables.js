import { apiFetch } from './client';

// Wearable connections through the HealthNet API (FINAL YEAR PROJECT/wearables_api.py). The server
// keeps the device sign-in; daily summaries come back here and are saved to the user's own Firestore data.

// { providers: [{ id, available, connected, connectedAt, lastSyncAt }] }
export const getWearableStatus = () => apiFetch('/wearables/status');

// Google's sign-in address; the browser goes there and comes back to /settings?device=google&result=...
export const connectGoogle = () => apiFetch('/wearables/google/connect', { method: 'POST' }).then((body) => body.url);

// { from, to, days: [{ date, steps, restingHeartRate, sleepMinutes }] } for the `days` days ending on `end`
export const syncGoogle = (end, days) =>
  apiFetch(`/wearables/google/sync?end=${encodeURIComponent(end)}&days=${days}`, { method: 'POST' });

export const disconnectGoogle = () => apiFetch('/wearables/google/disconnect', { method: 'POST' });
