import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_LOCALE,
  negotiateLocale,
  resolveBotLocale,
  translate,
} from './index.js';
import { en } from './locales/en.js';
import { zhCN } from './locales/zh-CN.js';

describe('Accept-Language negotiation', () => {
  it('defaults to English when the header is missing or unsupported', () => {
    assert.equal(DEFAULT_LOCALE, 'en');
    assert.equal(negotiateLocale(undefined), 'en');
    assert.equal(negotiateLocale(''), 'en');
    assert.equal(negotiateLocale('fr-FR, de;q=0.8'), 'en');
  });

  it('honours q-values and falls back through the list', () => {
    assert.equal(negotiateLocale('en-US,en;q=0.9'), 'en');
    assert.equal(negotiateLocale('zh-CN,zh;q=0.9,en;q=0.8'), 'zh-CN');
    assert.equal(negotiateLocale('fr-FR,zh;q=0.7,en;q=0.8'), 'en');
    assert.equal(negotiateLocale('fr;q=1, zh-TW;q=0.5'), 'zh-CN');
  });

  it('ignores q=0 entries and wildcards resolve to the default', () => {
    assert.equal(negotiateLocale('zh;q=0,en;q=0.5'), 'en');
    assert.equal(negotiateLocale('zh;q=0'), 'en');
    assert.equal(negotiateLocale('*'), 'en');
  });
});

describe('translation dictionaries', () => {
  it('English strings stay identical to the API text they replace', () => {
    assert.equal(translate('en', 'errors.not_authenticated'), 'Not authenticated');
    assert.equal(translate('en', 'errors.internal'), 'Something went wrong');
    assert.equal(translate('en', 'errors.teamspeak_api'), 'TeamSpeak API Error');
  });

  it('returns Chinese text and interpolates variables', () => {
    assert.equal(translate('zh-CN', 'errors.not_authenticated'), '未登录');
    assert.equal(translate(null, 'errors.internal'), en['errors.internal']);
  });

  it('exposes the same runtime keys in both dictionaries', () => {
    assert.deepEqual(Object.keys(zhCN).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(en)) {
      assert.notEqual(value.trim(), '', `${key} is empty in English`);
      assert.notEqual((zhCN as Record<string, string>)[key]?.trim(), '', `${key} is empty in Chinese`);
    }
  });
});

describe('bot language resolution', () => {
  it('prefers the bot language, then the instance default, then English', () => {
    assert.equal(resolveBotLocale('zh-CN', 'en'), 'zh-CN');
    assert.equal(resolveBotLocale(null, 'zh-CN'), 'zh-CN');
    assert.equal(resolveBotLocale('fr', 'zh-CN'), 'zh-CN');
    assert.equal(resolveBotLocale(null, null), 'en');
    assert.equal(resolveBotLocale('en', 'zh-CN'), 'en');
  });
});
