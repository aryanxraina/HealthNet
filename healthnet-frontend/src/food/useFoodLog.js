import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { loadFoodDay, loadFoodRange, saveFoodDay } from '../firebase';
import { dateKey, dayTotals } from './nutrition';

// One day of the food log: loads it, and saves the whole day after every change.
// status: loading | ready | error
export const useFoodDay = (date) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const key = dateKey(date);
  const [state, setState] = useState({ status: 'loading', meals: {}, error: null });
  const [saveError, setSaveError] = useState(null);
  const mealsRef = useRef({});

  useEffect(() => {
    if (!uid) return undefined;
    let live = true;
    setState({ status: 'loading', meals: {}, error: null });
    loadFoodDay(uid, key)
      .then((meals) => {
        if (!live) return;
        mealsRef.current = meals;
        setState({ status: 'ready', meals, error: null });
      })
      .catch((error) => live && setState({ status: 'error', meals: {}, error }));
    return () => {
      live = false;
    };
  }, [uid, key]);

  const change = useCallback(
    (update) => {
      const meals = update(mealsRef.current);
      mealsRef.current = meals;
      setState((current) => ({ ...current, meals }));
      setSaveError(null);
      saveFoodDay(uid, key, meals).catch(setSaveError);
    },
    [uid, key]
  );

  const addEntries = useCallback(
    (meal, entries) => change((meals) => ({ ...meals, [meal]: [...(meals[meal] || []), ...entries] })),
    [change]
  );
  const removeEntry = useCallback(
    (meal, id) => change((meals) => ({ ...meals, [meal]: (meals[meal] || []).filter((entry) => entry.id !== id) })),
    [change]
  );

  return { ...state, saveError, addEntries, removeEntry };
};

// Daily calorie and macro totals for the 7 days ending on `endDate`: [{ date, totals }]
export const useFoodWeek = (endDate, refreshKey) => {
  const { user } = useAuth();
  const uid = user?.uid;
  const endKey = dateKey(endDate);
  const [days, setDays] = useState(null);

  useEffect(() => {
    if (!uid) return undefined;
    let live = true;
    const dates = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(endDate);
      day.setDate(day.getDate() - (6 - index));
      return day;
    });
    loadFoodRange(uid, dateKey(dates[0]), endKey)
      .then((logged) => live && setDays(dates.map((day) => ({ date: day, totals: dayTotals(logged[dateKey(day)]) }))))
      .catch(() => live && setDays([]));
    return () => {
      live = false;
    };
    // endDate is represented by endKey; refreshKey reloads after the day view changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, endKey, refreshKey]);

  return days;
};
