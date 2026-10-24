import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { useTranslation } from '../i18n';
import { DEFAULT_UNITS } from '../lib/units';
import { loadUserData, saveSettings, saveSection, saveResults } from '../firebase';

export const DEFAULT_SETTINGS = {
  units: DEFAULT_UNITS,
  theme: 'system',
  language: 'en',
  diabetesModel: 'findrisc',
};

const EMPTY_STATE = { status: 'idle', settings: DEFAULT_SETTINGS, answers: {}, results: null, error: null };

// Answers saved in the browser before cloud storage existed; moved to Firestore once
const legacyKey = (uid) => `healthnet:questionnaire:${uid}`;

const readLegacyAnswers = (uid) => {
  try {
    const raw = localStorage.getItem(legacyKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearLegacyAnswers = (uid) => {
  try {
    localStorage.removeItem(legacyKey(uid));
  } catch {
    // Nothing to clean up if storage is unavailable
  }
};

const withDefaults = (settings = {}) => ({
  ...DEFAULT_SETTINGS,
  ...settings,
  units: { ...DEFAULT_UNITS, ...settings.units },
});

// Turns a Firebase error into a translation key for DataStatusBanner
export const dataErrorKey = (error) => {
  switch (error?.code) {
    case 'permission-denied':
      return 'data.errors.permission';
    case 'unavailable':
    case 'failed-precondition':
    case 'not-found':
      return 'data.errors.unavailable';
    case 'app/not-configured':
      return 'data.errors.notConfigured';
    default:
      return 'data.errors.generic';
  }
};

const UserDataContext = createContext(null);

export const UserDataProvider = ({ children }) => {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const { setLanguage } = useTranslation();
  const uid = user?.uid;
  const [state, setState] = useState(EMPTY_STATE);
  const [saveStatus, setSaveStatus] = useState({ state: 'idle', error: null });
  const [reloadCount, setReloadCount] = useState(0);
  // Latest settings without waiting for a re-render, so quick successive changes don't drop each other
  const settingsRef = useRef(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!uid) {
      settingsRef.current = DEFAULT_SETTINGS;
      setState(EMPTY_STATE);
      return undefined;
    }
    let cancelled = false;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    (async () => {
      try {
        const data = await loadUserData(uid);
        let { answers } = data;
        const legacy = readLegacyAnswers(uid);
        if (legacy && Object.keys(answers).length === 0) {
          await Promise.all(Object.entries(legacy).map(([sectionId, section]) => saveSection(uid, sectionId, section)));
          answers = legacy;
        }
        if (legacy) {
          clearLegacyAnswers(uid);
        }
        if (cancelled) {
          return;
        }
        // Saved preferences win over this device's; unsaved ones keep the device's choice
        if (data.settings.theme) setTheme(data.settings.theme);
        if (data.settings.language) setLanguage(data.settings.language);
        const settings = withDefaults(data.settings);
        settingsRef.current = settings;
        setState({ status: 'ready', settings, answers, results: data.results, error: null });
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({ ...current, status: 'error', error }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, reloadCount, setTheme, setLanguage]);

  const track = useCallback(async (write) => {
    setSaveStatus({ state: 'saving', error: null });
    try {
      await write();
      setSaveStatus({ state: 'saved', error: null });
    } catch (error) {
      setSaveStatus({ state: 'error', error });
      throw error;
    }
  }, []);

  const updateSettings = useCallback(
    (changes) => {
      const next = withDefaults({ ...settingsRef.current, ...changes });
      settingsRef.current = next;
      setState((current) => ({ ...current, settings: next }));
      return track(() => saveSettings(uid, next));
    },
    [uid, track]
  );

  const saveAnswers = useCallback(
    (sectionId, sectionAnswers) => {
      setState((current) => ({ ...current, answers: { ...current.answers, [sectionId]: sectionAnswers } }));
      return track(() => saveSection(uid, sectionId, sectionAnswers));
    },
    [uid, track]
  );

  const storeResults = useCallback(
    (results) => {
      setState((current) => ({ ...current, results }));
      return track(() => saveResults(uid, results));
    },
    [uid, track]
  );

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  const value = useMemo(
    () => ({ ...state, saveStatus, updateSettings, saveAnswers, storeResults, reload }),
    [state, saveStatus, updateSettings, saveAnswers, storeResults, reload]
  );

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>;
};

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (!context) {
    throw new Error('useUserData must be used inside UserDataProvider');
  }
  return context;
};
