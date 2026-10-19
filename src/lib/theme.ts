export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'kawdly-people-theme';

export function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the theme to the document root instantly. */
export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);

  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage unavailable */
  }
}

/** Listen for OS-level color-scheme changes (only matters when theme='system'). */
export function onSystemThemeChange(callback: () => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
