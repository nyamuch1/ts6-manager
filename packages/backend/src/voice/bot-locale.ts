import type { PrismaClient } from '../../generated/prisma/index.js';
import { resolveBotLocale, translate, type MessageKey, type SupportedLocale } from '../i18n/index.js';
import { loadDefaultBotLanguage } from '../utils/app-settings.js';

type MessageVariables = Record<string, string | number | boolean | null | undefined>;

/**
 * One bot chat command's locale: the bot's own language, then the instance
 * default, then English. Resolve once per command and reuse for every reply
 * so a slow settings read never runs twice or changes mid-command.
 */
export async function resolveChatLocale(
  prisma: PrismaClient,
  botLanguage?: string | null,
): Promise<SupportedLocale> {
  const instanceDefault = await loadDefaultBotLanguage(prisma);
  return resolveBotLocale(botLanguage, instanceDefault);
}

/** Translate a bot chat message, accepting the request context's current locale. */
export function translateChat(
  locale: SupportedLocale | null | undefined,
  key: MessageKey,
  variables?: MessageVariables,
): string {
  return translate(locale, key, variables);
}
