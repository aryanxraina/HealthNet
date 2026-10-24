import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Must match the key read by the inline script in public/index.html
const STORAGE_KEY = 'healthnet:theme';
export const THEMES = ['system', 'light', 'dark'];

const readStoredTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
};

// matchMedia is missing in some environments (e.g. the test runner)
const darkQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [systemDark, setSystemDark] = useState(() => Boolean(darkQuery()?.matches));

  // Follow the operating system's setting live while the theme is "system"
  useEffect(() => {
    const query = darkQuery();
    if (!query?.addEventListener) {
      return undefined;
    }
    const handleChange = (e) => setSystemDark(e.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const setTheme = useCallback((next) => {
    if (!THEMES.includes(next)) {
      return;
    }
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (e.g. private browsing); the theme still applies for this visit
    }
  }, []);

  const value = useMemo(() => ({ theme, isDark, setTheme }), [theme, isDark, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
};
