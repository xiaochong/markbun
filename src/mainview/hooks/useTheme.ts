import { useState, useEffect, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface UseThemeOptions {
  initialTheme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
}

export function useTheme({ initialTheme = 'system', onThemeChange }: UseThemeOptions = {}) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // Resolve theme based on mode and system preference
  useEffect(() => {
    const resolveTheme = (): ResolvedTheme => {
      if (themeMode === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return themeMode;
    };

    const resolved = resolveTheme();
    setResolvedTheme(resolved);

    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [themeMode]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const resolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);

      const root = document.documentElement;
      if (resolved === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeMode]);

  // Update theme mode when initialTheme prop changes
  useEffect(() => {
    setThemeMode(initialTheme);
  }, [initialTheme]);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeMode(newTheme);
    onThemeChange?.(newTheme);
  }, [onThemeChange]);

  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light';
    setThemeMode(newTheme);
    onThemeChange?.(newTheme);
  }, [resolvedTheme, onThemeChange]);

  return {
    theme: resolvedTheme,
    themeMode,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };
}
