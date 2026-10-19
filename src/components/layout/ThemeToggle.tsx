import { useCallback, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { applyTheme, onSystemThemeChange, readStoredTheme, type Theme } from '@/lib/theme';

/**
 * Light/dark toggle button for the TopBar.
 *
 * Cycles through light → dark → light. The resolved (non-"system") value
 * drives the icon and aria-label. The button lives on a navy background,
 * so it uses on-navy color tokens.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  // Apply theme on mount and whenever it changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for OS-level changes when in system mode.
  useEffect(() => {
    if (theme !== 'system') return;
    return onSystemThemeChange(() => applyTheme(theme));
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      return next;
    });
  }, []);

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'grid h-7 w-7 shrink-0 place-items-center rounded-[2px] transition-colors duration-150',
        'text-on-navy-muted-85 hover:bg-on-navy-fill-12 hover:text-on-navy',
      )}
    >
      {isDark ? (
        <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      )}
    </button>
  );
}
