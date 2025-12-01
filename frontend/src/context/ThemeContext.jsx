import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
});

const STORAGE_KEY = 'bragboard-theme-preference';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('light');

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      setThemeState(stored);
      applyThemeClass(stored);
      return;
    }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initialTheme = prefersDark ? 'dark' : 'light';
    setThemeState(initialTheme);
    applyThemeClass(initialTheme);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) {
      return undefined;
    }
    const listener = (event) => {
      const next = event.matches ? 'dark' : 'light';
      setTheme(next);
    };
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, []);

  const applyThemeClass = useCallback((value) => {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    if (value === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', value);
  }, []);

  const setTheme = useCallback(
    (value) => {
      setThemeState((current) => {
        const next = typeof value === 'function' ? value(current) : value;
        if (next !== 'light' && next !== 'dark') {
          return current;
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, next);
        }
        applyThemeClass(next);
        return next;
      });
    },
    [applyThemeClass]
  );

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, [setTheme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme,
    }),
    [theme, toggleTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
