import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLanguagePreference,
  normalizeLanguageTag,
  resolveLanguage,
  type LanguagePreference,
  type SupportedLocale,
} from './languages';

import enCommon from './locales/en/common.json' with { type: 'json' };
import enApp from './locales/en/app.json' with { type: 'json' };
import enDashboard from './locales/en/dashboard.json' with { type: 'json' };
import enAdmin from './locales/en/admin.json' with { type: 'json' };
import enAdminOps from './locales/en/adminOps.json' with { type: 'json' };
import enSettings from './locales/en/settings.json' with { type: 'json' };
import enMedia from './locales/en/media.json' with { type: 'json' };
import enBots from './locales/en/bots.json' with { type: 'json' };
import enPublic from './locales/en/public.json' with { type: 'json' };
import enContent from './locales/en/content.json' with { type: 'json' };

import zhCommon from './locales/zh-CN/common.json' with { type: 'json' };
import zhApp from './locales/zh-CN/app.json' with { type: 'json' };
import zhDashboard from './locales/zh-CN/dashboard.json' with { type: 'json' };
import zhAdmin from './locales/zh-CN/admin.json' with { type: 'json' };
import zhAdminOps from './locales/zh-CN/adminOps.json' with { type: 'json' };
import zhSettings from './locales/zh-CN/settings.json' with { type: 'json' };
import zhMedia from './locales/zh-CN/media.json' with { type: 'json' };
import zhBots from './locales/zh-CN/bots.json' with { type: 'json' };
import zhPublic from './locales/zh-CN/public.json' with { type: 'json' };
import zhContent from './locales/zh-CN/content.json' with { type: 'json' };

export const NAMESPACES = [
  'common',
  'app',
  'dashboard',
  'admin',
  'adminOps',
  'settings',
  'media',
  'bots',
  'public',
  'content',
] as const;

export const DEFAULT_NAMESPACE = 'common';

const resources = {
  en: {
    common: enCommon,
    app: enApp,
    dashboard: enDashboard,
    admin: enAdmin,
    adminOps: enAdminOps,
    settings: enSettings,
    media: enMedia,
    bots: enBots,
    public: enPublic,
    content: enContent,
  },
  'zh-CN': {
    common: zhCommon,
    app: zhApp,
    dashboard: zhDashboard,
    admin: zhAdmin,
    adminOps: zhAdminOps,
    settings: zhSettings,
    media: zhMedia,
    bots: zhBots,
    public: zhPublic,
    content: zhContent,
  },
} as const;

/** Zustand persist key for `ui.store`; read before React mounts to avoid a language flash. */
const UI_STORE_KEY = 'ts6-ui';

function readPersistedLanguagePreference(): LanguagePreference {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(UI_STORE_KEY);
    if (!raw) return 'system';
    const parsed = JSON.parse(raw) as { state?: { language?: unknown } };
    return isLanguagePreference(parsed.state?.language) ? parsed.state.language : 'system';
  } catch {
    return 'system';
  }
}

let initialized = false;

export function initI18n() {
  if (initialized) return i18n;
  initialized = true;

  const locale = resolveLanguage(readPersistedLanguagePreference());
  void i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    defaultNS: DEFAULT_NAMESPACE,
    ns: [...NAMESPACES],
    interpolation: { escapeValue: false },
    // Static resources are available immediately; do not render before init.
    initAsync: false,
    returnNull: false,
  });

  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  return i18n;
}

/** Resolves a preference, applies it to i18next and the document, and returns the locale. */
export function changeAppLanguage(preference: LanguagePreference): SupportedLocale {
  const locale = resolveLanguage(preference);
  if (i18n.resolvedLanguage !== locale) {
    void i18n.changeLanguage(locale);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  return locale;
}

export function currentLocale(): SupportedLocale {
  return normalizeLanguageTag(i18n.resolvedLanguage ?? i18n.language) ?? DEFAULT_LOCALE;
}

const i18nInstance = i18n;

// Initialize on import as well as in main.tsx: non-React helpers (and node:test
// imports) call i18n.t directly and must see English resources, not raw keys.
initI18n();

export default i18nInstance;
