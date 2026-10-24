import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './locales/en.json';

// A small translation layer with the same `t('section.key')` shape as react-i18next.
// (i18next's packages can't install alongside Create React App's TypeScript 4 pin.)
// To add a language: copy locales/en.json, translate it, and register it in both lists below.
const DICTIONARIES = { en };
export const LANGUAGES = [{ code: 'en', label: 'English' }];

const STORAGE_KEY = 'healthnet:language';

const lookup = (dictionary, key) =>
  key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dictionary);

// "Hello {{name}}" + { name: 'Alex' } -> "Hello Alex"
const interpolate = (text, values) =>
  values ? text.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in values ? String(values[name]) : match)) : text;

const readStoredLanguage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return DICTIONARIES[stored] ? stored : 'en';
  } catch {
    return 'en';
  }
};

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
  const [language, setLanguageState] = useState(readStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((code) => {
    if (!DICTIONARIES[code]) {
      return;
    }
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Storage can be unavailable (e.g. private browsing); the language still applies for this visit
    }
  }, []);

  // Falls back to English, then to the key itself, so a missing translation never breaks a page
  const t = useCallback(
    (key, values) => {
      const text = lookup(DICTIONARIES[language], key) ?? lookup(DICTIONARIES.en, key);
      return typeof text === 'string' ? interpolate(text, values) : key;
    },
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used inside I18nProvider');
  }
  return context;
};
