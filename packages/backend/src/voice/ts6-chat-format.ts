/**
 * TS6 client rich-text helpers for music-bot channel chat.
 * Messages are plain text with Markdown / limited HTML; the TS6 client renders them.
 * Interactive pause/skip buttons are not available server-side — use command hints.
 */

import type { BotAutomationOverview } from '@ts6/common';
import { translate, type MessageKey, type SupportedLocale } from '../i18n/index.js';

type ChatVariables = Record<string, string | number | boolean | null | undefined>;

function chatTranslate(
  locale: SupportedLocale | null | undefined,
  key: MessageKey,
  variables?: ChatVariables,
): string {
  return translate(locale, key, variables);
}

export interface TrackLine {
  title: string;
  artist?: string;
  duration?: number;
}

export interface NowPlayingFormatInput {
  title: string;
  artist?: string;
  position?: number;
  duration?: number;
  paused?: boolean;
  upcoming?: TrackLine[];
  totalQueueLength?: number;
  /** Index of the currently playing track in the full queue. */
  queueIndex?: number;
  includeControls?: boolean;
}

export interface HelpCommandLine {
  usage: string;
  blurb: string;
}

export interface CustomHelpLine {
  name: string;
  description?: string | null;
}

export const TS6_CHAT_FORMATTING_HINT =
  'TS6 renders Markdown in chat: **bold**, lists, > quotes, `code`, tables, <details>/<summary>, images, BBCode legacy tags.';

function escapeMarkdownInline(text: string): string {
  return text.replace(/([\\*_`~|])/g, '\\$1');
}

function formatMmSs(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function trackDurationSuffix(duration?: number): string {
  if (!duration || duration <= 0) return '';
  return ` _(${formatMmSs(duration)})_`;
}

/** Rich now-playing block for !np / !nowplaying. */
export function formatNowPlayingMessage(
  input: NowPlayingFormatInput,
  locale?: SupportedLocale | null,
): string {
  const t = (key: MessageKey, vars?: ChatVariables) => chatTranslate(locale, key, vars);
  const lines: string[] = [t('bot.chat.now_playing_heading'), ''];
  const title = escapeMarkdownInline(input.title);
  const artistPart = input.artist ? ` — *${escapeMarkdownInline(input.artist)}*` : '';
  lines.push(`**${title}**${artistPart}`);

  if (input.position != null && input.duration != null && input.duration > 0) {
    lines.push(`${formatMmSs(input.position)} / ${formatMmSs(input.duration)}`);
  }

  if (input.paused) {
    lines.push('');
    lines.push(t('bot.chat.paused'));
  }

  if (input.upcoming && input.upcoming.length > 0) {
    lines.push('');
    lines.push(t('bot.chat.up_next'));
    input.upcoming.forEach((item, i) => {
      const artist = item.artist ? ` — ${escapeMarkdownInline(item.artist)}` : '';
      lines.push(
        `${i + 1}. ${escapeMarkdownInline(item.title)}${artist}${trackDurationSuffix(item.duration)}`,
      );
    });
    const afterCurrent =
      input.totalQueueLength != null && input.queueIndex != null
        ? Math.max(0, input.totalQueueLength - input.queueIndex - 1)
        : 0;
    const extra = afterCurrent > input.upcoming.length ? afterCurrent - input.upcoming.length : 0;
    if (extra > 0) {
      lines.push(t('bot.chat.more_in_queue', { count: extra }));
    }
  }

  if (input.includeControls) {
    lines.push('');
    lines.push('<details>');
    lines.push(`<summary>${t('bot.chat.controls_heading')}</summary>`);
    lines.push('');
    lines.push(t('bot.chat.controls_intro'));
    lines.push(t('bot.chat.controls_pause'));
    lines.push(t('bot.chat.controls_skip'));
    lines.push(t('bot.chat.controls_prev'));
    lines.push(t('bot.chat.controls_stop'));
    lines.push(t('bot.chat.controls_queue'));
    lines.push('</details>');
  }

  return lines.join('\n');
}

/** Markdown help list for !help. */
export function formatHelpMessage(
  builtin: HelpCommandLine[],
  custom: CustomHelpLine[],
  automation?: BotAutomationOverview | null,
  locale?: SupportedLocale | null,
): string {
  const t = (key: MessageKey, vars?: ChatVariables) => chatTranslate(locale, key, vars);
  const lines: string[] = [t('bot.chat.help_heading'), '', t('bot.chat.builtin_heading')];
  for (const entry of builtin) {
    lines.push(`- **${entry.usage}** — ${entry.blurb}`);
  }
  lines.push('');
  lines.push(t('bot.chat.bot_name_hint'));

  if (custom.length > 0) {
    lines.push('');
    lines.push(t('bot.chat.custom_heading'));
    for (const c of custom) {
      const blurb = c.description?.trim() || t('bot.chat.custom_reply_default');
      lines.push(`- **!${c.name}** — ${blurb}`);
    }
  }

  // Auto-DJ and 24/7 have no chat command, so say here when the answering bot has them on.
  if (automation?.autoDj || automation?.stayInChannel) {
    lines.push('');
    lines.push(t('bot.chat.this_bot_heading'));
    if (automation.autoDj) {
      const source = t(
        automation.sourceKind === 'radio'
          ? 'bot.chat.auto_dj_source_radio'
          : 'bot.chat.auto_dj_source_playlist',
      );
      lines.push(t('bot.chat.auto_dj_on', { source }));
    }
    if (automation.stayInChannel) {
      lines.push(t('bot.chat.stay_247_on'));
    }
  }

  return lines.join('\n');
}

/** Compact list of enabled custom commands for !commands. */
export function formatCustomCommandsMessage(
  custom: CustomHelpLine[],
  locale?: SupportedLocale | null,
): string {
  const t = (key: MessageKey, vars?: ChatVariables) => chatTranslate(locale, key, vars);
  if (custom.length === 0) {
    return t('bot.chat.no_custom_commands');
  }

  const lines: string[] = [t('bot.chat.custom_commands_heading'), ''];
  for (const c of custom) {
    const blurb = c.description?.trim() || t('bot.chat.custom_reply_default');
    lines.push(`- **!${c.name}** — ${blurb}`);
  }
  lines.push('');
  lines.push(t('bot.chat.custom_commands_footer'));
  return lines.join('\n');
}

/** Markdown queue listing for !queue show. */
export function formatQueueMessage(
  items: TrackLine[],
  currentIndex: number,
  maxLines = 15,
  /** `start`: first position shown. `numberOffset`: added to every track number. */
  { start = 0, numberOffset = 0 }: { start?: number; numberOffset?: number } = {},
  locale?: SupportedLocale | null,
): string {
  const t = (key: MessageKey, vars?: ChatVariables) => chatTranslate(locale, key, vars);
  if (items.length === 0) return t('bot.chat.queue_empty');

  const lines: string[] = [t('bot.chat.queue_heading', { count: items.length }), ''];
  if (start > 0) lines.push(t('bot.chat.queue_earlier', { count: start }));
  const shown = items.slice(start, start + maxLines);
  shown.forEach((item, offset) => {
    const i = start + offset;
    const prefix = i === currentIndex ? '▶️' : '•';
    const artist = item.artist ? `${escapeMarkdownInline(item.artist)} — ` : '';
    lines.push(
      `${prefix} **${numberOffset + i + 1}.** ${artist}${escapeMarkdownInline(item.title)}${trackDurationSuffix(item.duration)}`,
    );
  });

  const after = items.length - start - shown.length;
  if (after > 0) {
    lines.push('', t('bot.chat.queue_more', { count: after }));
  }

  return lines.join('\n');
}

/** Short formatted radio station list. */
export function formatRadioListMessage(
  stations: Array<{ id: number; name: string; genre?: string | null }>,
  locale?: SupportedLocale | null,
): string {
  const t = (key: MessageKey, vars?: ChatVariables) => chatTranslate(locale, key, vars);
  const lines: string[] = [t('bot.chat.radio_heading'), ''];
  for (const s of stations) {
    const genre = s.genre ? ` _(${escapeMarkdownInline(s.genre)})_` : '';
    lines.push(`- **${s.id}** — ${escapeMarkdownInline(s.name)}${genre}`);
  }
  lines.push('');
  lines.push(t('bot.chat.radio_play_hint'));
  return lines.join('\n');
}

/** Reply for a `!command` no bot, custom command or flow handles. */
export function formatUnknownCommandMessage(
  command: string,
  suggestion: string | null,
  locale?: SupportedLocale | null,
): string {
  const shown = command.length > 32 ? `${command.slice(0, 32)}…` : command;
  return suggestion
    ? chatTranslate(locale, 'bot.chat.unknown_command_suggestion', {
        command: shown,
        suggestion,
      })
    : chatTranslate(locale, 'bot.chat.unknown_command', { command: shown });
}
