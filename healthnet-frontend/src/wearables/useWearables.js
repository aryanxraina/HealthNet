import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getWearableStatus } from '../api/wearables';
import { loadActivityRange } from '../firebase';
import { dateKey } from '../food/nutrition';

// The Google Health connection as the server sees it. Nothing is requested while `enabled` is false.
// status: idle | loading | ready | unreachable; google: { available, connected, connectedAt, lastSyncAt } | null
export const useGoogleConnection = (enabled = true) => {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', google: null, error: null });

  const refresh = useCallback(() => {
    if (!enabled) return undefined;
    let live = true;
    getWearableStatus()
      .then((body) => live && setState({ status: 'ready', google: body.providers.find((p) => p.id === 'google') || null, error: null }))
      .catch((error) => live && setState({ status: 'unreachable', google: null, error }));
    return () => {
      live = false;
    };
  }, [enabled]);

  useEffect(() => refresh(), [refresh]);

  return { ...state, refresh };
};

// Stored daily readings for the `count` days ending today: { 'YYYY-MM-DD': readings } or null while loading
export const useActivityDays = (count, refreshKey) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const [days, setDays] = useState(null);
  const today = dateKey(new Date());

  useEffect(() => {
    if (!uid) return undefined;
    let live = true;
    const first = new Date();
    first.setDate(first.getDate() - (count - 1));
    loadActivityRange(uid, dateKey(first), today)
      .then((stored) => live && setDays(stored))
      .catch(() => live && setDays({}));
    return () => {
      live = false;
    };
  }, [uid, count, today, refreshKey]);

  return days;
};
