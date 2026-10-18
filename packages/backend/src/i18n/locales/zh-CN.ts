import type { MessageKey } from './en.js';
import { errorsZh } from './zh-CN/errors.js';
import { botZh } from './zh-CN/bot.js';
import { widgetZh } from './zh-CN/widget.js';
import { diagnosticsZh } from './zh-CN/diagnostics.js';

/** Simplified Chinese dictionary; TypeScript enforces the English key set. */
export const zhCN: Record<MessageKey, string> = {
  ...errorsZh,
  ...botZh,
  ...widgetZh,
  ...diagnosticsZh,
};
