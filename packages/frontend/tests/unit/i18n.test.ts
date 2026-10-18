import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isLanguagePreference,
  normalizeLanguageTag,
  resolveLanguage,
  systemLocale,
} from '../../src/i18n/languages.ts';

const require = createRequire(import.meta.url);

const NAMESPACES = [
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

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function loadLocale(locale: string, namespace: string): Record<string, Json> {
  return require(`../../src/i18n/locales/${locale}/${namespace}.json`) as Record<string, Json>;
}

function flattenKeys(value: Json, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

function placeholderNames(value: Json): string[] {
  if (typeof value !== 'string') return [];
  return [...value.matchAll(/\{\{\s*([\w.]+)/g)]
    .map((match) => match[1])
    .sort();
}

describe('language resolution', () => {
  it('normalizes Chinese and English variants and ignores unsupported tags', () => {
    assert.equal(normalizeLanguageTag('zh'), 'zh-CN');
    assert.equal(normalizeLanguageTag('zh-CN'), 'zh-CN');
    assert.equal(normalizeLanguageTag('zh-Hans'), 'zh-CN');
    assert.equal(normalizeLanguageTag('zh-TW'), 'zh-CN');
    assert.equal(normalizeLanguageTag('en'), 'en');
    assert.equal(normalizeLanguageTag('en-GB'), 'en');
    assert.equal(normalizeLanguageTag('fr-FR'), null);
    assert.equal(normalizeLanguageTag(''), null);
  });

  it('picks the first supported browser language and falls back to English', () => {
    assert.equal(systemLocale(['fr-FR', 'zh-CN', 'en']), 'zh-CN');
    assert.equal(systemLocale(['de-DE', 'en-US']), 'en');
    assert.equal(systemLocale([]), DEFAULT_LOCALE);
  });

  it('honours an explicit preference over the browser', () => {
    assert.equal(resolveLanguage('zh-CN', ['en-US']), 'zh-CN');
    assert.equal(resolveLanguage('en', ['zh-CN']), 'en');
    assert.equal(resolveLanguage('system', ['en-US']), 'en');
  });

  it('validates persisted preferences', () => {
    for (const locale of SUPPORTED_LOCALES) assert.equal(isLanguagePreference(locale), true);
    assert.equal(isLanguagePreference('system'), true);
    assert.equal(isLanguagePreference('fr'), false);
    assert.equal(isLanguagePreference(null), false);
  });
});

describe('locale resource parity', () => {
  for (const namespace of NAMESPACES) {
    it(`${namespace}: English and Chinese expose the same keys and placeholders`, () => {
      const en = loadLocale('en', namespace);
      const zh = loadLocale('zh-CN', namespace);
      const enKeys = flattenKeys(en).sort();
      const zhKeys = flattenKeys(zh).sort();

      assert.deepEqual(zhKeys, enKeys, `${namespace} keys differ`);

      for (const key of enKeys) {
        const enValue = key.split('.').reduce<Json>((value, part) => (value as Record<string, Json>)[part], en);
        const zhValue = key.split('.').reduce<Json>((value, part) => (value as Record<string, Json>)[part], zh);
        assert.equal(typeof enValue, 'string', `${namespace}.${key} must be a string in English`);
        assert.equal(typeof zhValue, 'string', `${namespace}.${key} must be a string in Chinese`);
        assert.notEqual((enValue as string).trim(), '', `${namespace}.${key} is empty in English`);
        assert.notEqual((zhValue as string).trim(), '', `${namespace}.${key} is empty in Chinese`);
        assert.deepEqual(
          placeholderNames(zhValue),
          placeholderNames(enValue),
          `${namespace}.${key} placeholders differ`,
        );
      }
    });
  }
});
