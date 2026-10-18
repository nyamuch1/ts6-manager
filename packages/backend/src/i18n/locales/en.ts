import { errorsEn } from './en/errors.js';
import { botEn } from './en/bot.js';
import { widgetEn } from './en/widget.js';
import { diagnosticsEn } from './en/diagnostics.js';

/** English source dictionary. Values must match the previously hardcoded text. */
export const en = {
  ...errorsEn,
  ...botEn,
  ...widgetEn,
  ...diagnosticsEn,
} as const;

export type MessageKey = keyof typeof en;
