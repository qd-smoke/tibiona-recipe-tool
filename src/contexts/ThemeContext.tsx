'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';

const THEME_STORAGE_KEY = 'theme';
const DEFAULT_THEME = 'dark';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  darkMode: boolean;
  toggleTheme: () => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with default theme to avoid hydration mismatch
  // Will be updated on client mount
  const [darkMode, setDarkMode] = useState<boolean>(DEFAULT_THEME === 'dark');

  // Load theme from localStorage only on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (saved) {
        setDarkMode(saved === 'dark');
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Apply theme class on mount and when darkMode changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleTheme = useCallback(() => {
    setDarkMode((prev) => {
      const newTheme = !prev;
      const themeValue: Theme = newTheme ? 'dark' : 'light';
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(THEME_STORAGE_KEY, themeValue);
        }
      } catch (error) {
        console.warn(
          '[ThemeProvider] Failed to save theme to localStorage',
          error,
        );
      }
      return newTheme;
    });
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      darkMode,
      toggleTheme,
      theme: darkMode ? 'dark' : 'light',
    }),
    [darkMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
