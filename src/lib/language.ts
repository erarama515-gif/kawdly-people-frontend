export type Language = 'ar' | 'en';

export const DEFAULT_LANGUAGE: Language = 'en';

export const LANGUAGE_STORAGE_KEY = 'kawdly-people-language';

export const STORAGE_KEYS = {
  language: LANGUAGE_STORAGE_KEY,
  ui: 'kawdly-people-ui',
  session: 'kawdly-people-session',
} as const;

export function isLanguage(value: unknown): value is Language {
  return value === 'ar' || value === 'en';
}

export function readStoredLanguage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

export function directionOf(language: Language): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/** Applies language + direction to the document instantly, without a reload. */
export function applyDocumentLanguage(language: Language): void {
  const root = document.documentElement;
  root.lang = language;
  root.dir = directionOf(language);
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* storage unavailable (private mode) — language stays in memory only */
  }
}
