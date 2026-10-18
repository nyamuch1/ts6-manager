import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from './languages.js';
import { en, type MessageKey } from './locales/en.js';
import { zhCN } from './locales/zh-CN.js';

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale, negotiateLocale } from './languages.js';
export type { SupportedLocale } from './languages.js';
export type { MessageKey } from './locales/en.js';

type MessageVariables = Record<string, string | number | boolean | null | undefined>;

const dictionaries: Record<SupportedLocale, Record<MessageKey, string>> = {
  en,
  'zh-CN': zhCN,
};

function interpolate(template: string, variables?: MessageVariables): string {
  if (!variables) return template;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, name: string) => {
    const value = variables[name];
    return value == null ? match : String(value);
  });
}

/** Falls back to English, then to the key itself, so a missing string never throws. */
export function translate(
  locale: SupportedLocale | null | undefined,
  key: MessageKey,
  variables?: MessageVariables,
): string {
  const dictionary = locale && isSupportedLocale(locale) ? dictionaries[locale] : dictionaries[DEFAULT_LOCALE];
  const template = dictionary[key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
  return interpolate(template, variables);
}

/**
 * Bot chat has no request context. Prefer the bot's own language, then the
 * instance default, then English.
 */
export function resolveBotLocale(
  botLanguage: string | null | undefined,
  instanceDefault?: string | null,
): SupportedLocale {
  if (isSupportedLocale(botLanguage)) return botLanguage;
  if (isSupportedLocale(instanceDefault)) return instanceDefault;
  return DEFAULT_LOCALE;
}
