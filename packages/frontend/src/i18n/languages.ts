export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LanguagePreference = 'system' | SupportedLocale;

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** Native names shown in the language picker; they do not change with the UI language. */
export const LANGUAGE_NATIVE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'system' || isSupportedLocale(value);
}

/**
 * Maps a BCP 47 tag to a shipped locale.
 *
 * All Chinese variants currently resolve to Simplified Chinese; Traditional
 * Chinese can become a separate locale once translations exist.
 */
export function normalizeLanguageTag(tag: string | null | undefined): SupportedLocale | null {
  const normalized = tag?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return null;
}

/** First shipped locale in the browser's preference list, falling back to English. */
export function systemLocale(languages?: readonly string[]): SupportedLocale {
  const list = languages
    ?? (typeof navigator !== 'undefined' && Array.isArray(navigator.languages) ? navigator.languages : []);
  for (const tag of list) {
    const locale = normalizeLanguageTag(tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

export function resolveLanguage(
  preference: LanguagePreference,
  languages?: readonly string[],
): SupportedLocale {
  return preference === 'system' ? systemLocale(languages) : preference;
}
