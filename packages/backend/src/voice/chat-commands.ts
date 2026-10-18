import {
  BUILTIN_CHAT_COMMANDS,
  type BuiltinChatCommand,
} from '@ts6/common';
import { translate, type MessageKey, type SupportedLocale } from '../i18n/index.js';

export { BUILTIN_CHAT_COMMANDS, type BuiltinChatCommand };

const BUILTIN_SET = new Set<string>(BUILTIN_CHAT_COMMANDS);

/** Usage strings stay English (command syntax); blurb text follows the bot locale. */
const BUILTIN_COMMAND_HELP_KEYS: { name: string; usage: string; blurbKey: MessageKey }[] = [
  { name: 'help', usage: '!help', blurbKey: 'bot.help.blurb.help' },
  { name: 'commands', usage: '!commands', blurbKey: 'bot.help.blurb.commands' },
  { name: 'here', usage: '!here [id]', blurbKey: 'bot.help.blurb.here' },
  { name: 'come', usage: '!come [id]', blurbKey: 'bot.help.blurb.come' },
  { name: 'play', usage: '!play <url|song name>', blurbKey: 'bot.help.blurb.play' },
  { name: 'queue', usage: '!queue [url|show|clear|remove <n>|play <n>]', blurbKey: 'bot.help.blurb.queue' },
  { name: 'history', usage: '!history', blurbKey: 'bot.help.blurb.history' },
  { name: 'again', usage: '!again [id]', blurbKey: 'bot.help.blurb.again' },
  { name: 'add', usage: '!add <url>', blurbKey: 'bot.help.blurb.add' },
  { name: 'playlist', usage: '!playlist [name-or-id]', blurbKey: 'bot.help.blurb.playlist' },
  { name: 'pl', usage: '!pl <name-or-id>', blurbKey: 'bot.help.blurb.pl' },
  { name: 'repeat', usage: '!repeat [off|track|queue]', blurbKey: 'bot.help.blurb.repeat' },
  { name: 'seek', usage: '!seek <seconds|+seconds|-seconds>', blurbKey: 'bot.help.blurb.seek' },
  { name: 'remove', usage: '!remove <text>', blurbKey: 'bot.help.blurb.remove' },
  { name: 'shuffle', usage: '!shuffle [on|off]', blurbKey: 'bot.help.blurb.shuffle' },
  { name: 'stop', usage: '!stop', blurbKey: 'bot.help.blurb.stop' },
  { name: 'pause', usage: '!pause', blurbKey: 'bot.help.blurb.pause' },
  { name: 'skip', usage: '!skip', blurbKey: 'bot.help.blurb.skip' },
  { name: 'voteskip', usage: '!voteskip', blurbKey: 'bot.help.blurb.voteskip' },
  { name: 'remote', usage: '!remote [bot name]', blurbKey: 'bot.help.blurb.remote' },
  { name: 'next', usage: '!next', blurbKey: 'bot.help.blurb.next' },
  { name: 'prev', usage: '!prev', blurbKey: 'bot.help.blurb.prev' },
  { name: 'vol', usage: '!vol [0-100]', blurbKey: 'bot.help.blurb.vol' },
  { name: 'volume', usage: '!volume [0-100]', blurbKey: 'bot.help.blurb.volume' },
  { name: 'np', usage: '!np', blurbKey: 'bot.help.blurb.np' },
  { name: 'nowplaying', usage: '!nowplaying', blurbKey: 'bot.help.blurb.nowplaying' },
  { name: 'radio', usage: '!radio [id]', blurbKey: 'bot.help.blurb.radio' },
  { name: 'stream', usage: '!stream <url> [preset]', blurbKey: 'bot.help.blurb.stream' },
  { name: 'stopstream', usage: '!stopstream', blurbKey: 'bot.help.blurb.stopstream' },
  { name: 'viewers', usage: '!viewers', blurbKey: 'bot.help.blurb.viewers' },
  { name: 'channels', usage: '!channels [search]', blurbKey: 'bot.help.blurb.channels' },
  { name: 'tv', usage: '!tv <name>', blurbKey: 'bot.help.blurb.tv' },
  { name: 'iptv', usage: '!iptv <name>', blurbKey: 'bot.help.blurb.iptv' },
  { name: 'lyrics', usage: '!lyrics [artist - title]', blurbKey: 'bot.help.blurb.lyrics' },
];

/** Short help lines for built-in commands (shown by !help) in the given bot locale. */
export function builtinCommandHelp(
  locale?: SupportedLocale | null,
): { name: string; usage: string; blurb: string }[] {
  return BUILTIN_COMMAND_HELP_KEYS.map(({ name, usage, blurbKey }) => ({
    name,
    usage,
    blurb: translate(locale, blurbKey),
  }));
}

/** English help lines (kept for callers that need a locale-independent list). */
export const BUILTIN_COMMAND_HELP = builtinCommandHelp('en');

/**
 * Recommended server-scoped canned-reply templates.
 * Seeded via Music Bots → Commands (disabled until an admin edits and enables).
 */
export interface ChatCommandPreset {
  name: string;
  description: string;
  response: string;
}

export const CHAT_COMMAND_PRESETS: ChatCommandPreset[] = [
  {
    name: 'rules',
    description: 'Server rules',
    response: [
      '## Server rules',
      '',
      '1. Be respectful — no harassment or hate speech.',
      '2. No spam or excessive caps in chat/voice.',
      '3. Keep music requests reasonable; staff may skip tracks.',
      '4. Follow staff instructions.',
      '',
      '_Edit this text in Music Bots → Commands._',
    ].join('\n'),
  },
  {
    name: 'links',
    description: 'Useful community links',
    response: [
      '## Links',
      '',
      '- **Website:** https://example.com',
      '- **Discord:** https://discord.gg/your-invite',
      '- **Donate:** https://example.com/donate',
      '',
      '_Replace these URLs in Music Bots → Commands._',
    ].join('\n'),
  },
  {
    name: 'discord',
    description: 'Discord invite',
    response: [
      '## Discord',
      '',
      'Join us: https://discord.gg/your-invite',
      '',
      '_Or fold this into !links and disable !discord._',
    ].join('\n'),
  },
  {
    name: 'info',
    description: 'Short server / community blurb',
    response: [
      '## About',
      '',
      'Welcome to our TeamSpeak community. Music bots, radio, and chat commands keep the lobby moving.',
      '',
      'Type **!help** for music commands or **!commands** for custom replies.',
      '',
      '_Edit this blurb in Music Bots → Commands._',
    ].join('\n'),
  },
  {
    name: 'about',
    description: 'Alias-style community blurb (same idea as !info)',
    response: [
      '## About',
      '',
      'Welcome to our TeamSpeak community. Music bots, radio, and chat commands keep the lobby moving.',
      '',
      'Type **!help** for music commands or **!commands** for custom replies.',
      '',
      '_Edit this blurb in Music Bots → Commands._',
    ].join('\n'),
  },
];

export function isReservedChatCommandName(name: string): boolean {
  return BUILTIN_SET.has(name.toLowerCase());
}

/** Normalize user input to a command name (no leading !). */
export function normalizeChatCommandName(raw: string): string {
  return raw
    .trim()
    .replace(/^!+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

/** Edit distance between two short command names (insert / delete / substitute / swap). */
function commandEditDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Closest built-in command to a mistyped name (e.g. `plya` → `play`), or null when nothing is close. */
export function suggestBuiltinCommand(raw: string): string | null {
  const name = raw.toLowerCase();
  if (name.length < 2 || name.length > 32) return null;
  const maxDistance = name.length <= 3 ? 1 : 2;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of BUILTIN_CHAT_COMMANDS) {
    const distance = commandEditDistance(name, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= maxDistance ? best : null;
}
