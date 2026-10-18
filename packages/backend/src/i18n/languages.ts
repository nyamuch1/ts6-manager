export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Maps a BCP 47 tag to a shipped locale. Chinese variants currently share
 * Simplified Chinese; `zh-TW`/`zh-HK` can split once a Traditional locale ships.
 */
export function normalizeLanguageTag(tag: string | null | undefined): SupportedLocale | null {
  const normalized = tag?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return null;
}

type WeightedLanguage = { tag: string; quality: number; order: number };

function parseWeightedLanguages(header: string): WeightedLanguage[] {
  return header
    .split(',')
    .map((part, order) => {
      const [rawTag, ...parameters] = part.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().toLowerCase().startsWith('q='));
      const parsedQuality = qualityParameter ? Number.parseFloat(qualityParameter.split('=')[1]) : 1;
      return {
        tag: rawTag.trim(),
        quality: Number.isFinite(parsedQuality) ? parsedQuality : 0,
        order,
      };
    })
    .filter((entry) => entry.tag.length > 0 && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.order - b.order);
}

/** Picks the highest-weighted shipped locale from an `Accept-Language` header. */
export function negotiateLocale(header: string | null | undefined): SupportedLocale {
  if (!header) return DEFAULT_LOCALE;
  for (const entry of parseWeightedLanguages(header)) {
    if (entry.tag === '*') return DEFAULT_LOCALE;
    const locale = normalizeLanguageTag(entry.tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
