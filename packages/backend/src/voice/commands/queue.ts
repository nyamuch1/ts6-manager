import type { VoiceBot } from '../voice-bot.js';
import { MAX_QUEUE_ITEMS, QueueFullError, type QueueItem, type QueueReservation } from '../playlist/queue.js';
import { translateChat } from '../bot-locale.js';
import { defaultMediaUrlDeps, runMediaUrlPipeline, type MediaUrlPipelineDeps } from '../media-url-pipeline.js';
import { invalidatePlaylistExpansion } from '../playlist-expansion.js';
import { musicHistoryErrorCode, recordMusicRequests } from '../music-request-history.js';
import { formatQueueMessage } from '../ts6-chat-format.js';
import type { CommandContext } from './context.js';
/** Cancels stale background playlist expansions for chat !play / !queue. */
const chatPlaylistGeneration = new Map<number, number>();
/** Abort pending song searches when the bot's media request is replaced or stopped. */
const chatMediaControllers = new Map<number, AbortController>();

/** Observe pending media intent without cancelling it. */
export function getChatMediaGeneration(botId: number): number {
  return chatPlaylistGeneration.get(botId) ?? 0;
}

/** One cancellation identity spans song search, channel movement, and queue insertion. */
export interface ChatMediaRequest {
  signal: AbortSignal;
  isCancelled(): boolean;
}

/** Start a request using the same generation as background playlist expansion. */
export function beginChatMediaRequest(botId: number): ChatMediaRequest {
  invalidateChatPlaylistExpansion(botId);
  const generation = chatPlaylistGeneration.get(botId);
  const controller = new AbortController();
  chatMediaControllers.set(botId, controller);
  return { signal: controller.signal, isCancelled: () => chatPlaylistGeneration.get(botId) !== generation };
}

/** Advance a bot’s generation so pending background playlist work is discarded. */
export function invalidateChatPlaylistExpansion(botId: number): void {
  chatMediaControllers.get(botId)?.abort();
  chatMediaControllers.delete(botId);
  chatPlaylistGeneration.set(botId, (chatPlaylistGeneration.get(botId) ?? 0) + 1);
}

/**
 * Start a resolved item when the bot is idle, otherwise append it to the queue.
 * Returns true when appended behind current music, false when it started, and
 * null when it did not start (the queue is restored). `options` carries the
 * caller's decision about replacing an active video; it is only used when the
 * bot is idle. A full queue throws QueueFullError before anything changes.
 */
export async function startOrAppendMediaItem(
  bot: VoiceBot,
  item: QueueItem,
  isCurrent: () => boolean,
  options: { replaceSessionIds: string[] } | undefined,
  reservation?: QueueReservation,
): Promise<boolean | null> {
  if (bot.status === 'playing' || bot.status === 'paused') {
    bot.queue.add(item, reservation);
    return true;
  }
  if (options) bot.assertMusicCanStart(options.replaceSessionIds);
  const cleanup = bot.queue.addForPlayback(item, reservation);
  let started = false;
  try {
    if (item.streamUrl) await bot.playStream(item, options);
    else await bot.play(item, options);
    started = isCurrent() && bot.nowPlaying === item;
  } finally {
    if (!started) cleanup();
  }
  return started ? false : null;
}

/** Append a resolved request, starting it only when music is idle. */
export async function enqueueMediaItem(
  context: CommandContext,
  bot: VoiceBot,
  item: QueueItem,
  isCurrent: () => boolean,
  reservation?: QueueReservation,
): Promise<boolean | null> {
  if (!['connected', 'playing', 'paused'].includes(bot.status)) throw new Error('Bot is not connected');
  const idle = bot.status === 'connected';
  const queued = await startOrAppendMediaItem(bot, item, isCurrent, idle ? context.chatMusicSwitch(bot) : undefined, reservation);
  if (queued === null) return null;
  context.saveMusicRequest(bot, item);
  return queued;
}

/**
 * Resolve Spotify / Apple Music / YouTube Music / playlist URLs, download the first track,
 * and queue the rest in the background (same approach as play-url).
 */
export async function enqueueMediaUrl(
  context: CommandContext,
  botId: number,
  bot: VoiceBot,
  userClid: number,
  rawUrl: string,
  request = beginChatMediaRequest(botId),
  deps: MediaUrlPipelineDeps = defaultMediaUrlDeps(),
): Promise<void> {
  const serverConfigId = bot.currentConfig.serverConfigId;
  const virtualServerId = context.virtualServerIdForBot(botId);
  const isCurrent = () => !request.isCancelled()
    && context.voiceBotManager.getBot(botId) === bot
    && bot.currentConfig.serverConfigId === serverConfigId
    && context.virtualServerIdForBot(botId) === virtualServerId;
  if (!isCurrent()) return;
  await context.joinChannelForCommand(botId, bot, userClid);
  if (!isCurrent()) return;
  let firstCall = true;
  let alreadyPlaying = false;
  let playbackAccepted = true;
  // Room for every track of the link, held while its later tracks download.
  let reservation: QueueReservation | undefined;

  const result = await runMediaUrlPipeline(
    deps,
    {
      play: async (item, opts) => {
        const isFirst = firstCall;
        firstCall = false;
        const live = context.voiceBotManager.getBot(botId);
        if (!live || !isCurrent()) return;
        if (isFirst) {
          const queued = await enqueueMediaItem(context, live, item, isCurrent, reservation);
          playbackAccepted = queued !== null;
          alreadyPlaying = queued ?? false;
        } else {
          live.queue.add(item, reservation);
          context.saveMusicRequest(live, item);
          live.queue.playAt(live.queue.length - 1);
          await live.play(item).catch((err) => {
            console.error('[MusicCmd] Failed to resume playlist playback:', err);
          });
        }
      },
      enqueue: (item) => {
        if (!isCurrent() || !playbackAccepted) return;
        const live = context.voiceBotManager.getBot(botId);
        if (!live || live.status === 'stopped' || live.status === 'error') return;
        live.queue.add(item, reservation);
        context.saveMusicRequest(live, item);
      },
      isIdle: () => {
        const live = context.voiceBotManager.getBot(botId);
        return Boolean(isCurrent() && live?.status === 'connected' && !live.nowPlaying);
      },
      isCancelled: () => !isCurrent() || !playbackAccepted,
      reserve: (count) => { reservation = bot.queue.reserve(count); },
      release: () => reservation?.release(),
    },
    { url: rawUrl, enqueueOnly: false },
    {
      onBackgroundError: (err, label) => {
        console.error('[MusicCmd] Failed to queue %s:', label, err);
      },
    },
  );

  if (!isCurrent() || !playbackAccepted) return;

  const pendingTotal = result.queuedInBackground;
  const playlistNote =
    pendingTotal > 0
      ? translateChat(
        context.locale,
        result.playlistTitle ? 'bot.media.playlist_note_named' : 'bot.media.playlist_note',
        { count: pendingTotal, title: result.playlistTitle },
      )
      : '';

  if (alreadyPlaying) {
    context.reply(
      bot,
      userClid,
      translateChat(context.locale, 'bot.media.queued', {
        artist: result.first.artist,
        title: result.first.title,
        position: trackNumber(bot, bot.queue.length - 1),
        playlistNote,
      }),
    );
  } else {
    context.reply(
      bot,
      userClid,
      translateChat(context.locale, 'bot.media.now_playing', {
        artist: result.first.artist,
        title: result.first.title,
        playlistNote,
      }),
    );
  }
}

/** Resolve a server or shared playlist by ID or name and append its tracks in order. */
export async function handlePlaylist(
  context: CommandContext,
  botId: number,
  bot: VoiceBot,
  userClid: number,
  args: string,
): Promise<void> {
  const serverConfigId = bot.currentConfig.serverConfigId;
  if (!serverConfigId) {
    context.reply(bot, userClid, translateChat(context.locale, 'bot.playlist.no_server'));
    return;
  }
  // A Stop, queue clear or bot restart while the playlist is looked up drops this load.
  const stopGeneration = bot.stopGeneration;
  const where = { OR: [{ serverConfigId }, { serverConfigId: null }] };
  const playlists = await context.prisma.playlist.findMany({
    where, select: { id: true, name: true }, orderBy: { name: 'asc' },
  });
  const query = args.trim().toLowerCase();
  if (!query) {
    context.reply(
      bot,
      userClid,
      playlists.length
        ? translateChat(context.locale, 'bot.playlist.list_heading') + '\n' +
          playlists.slice(0, 10).map(p => `[${p.id}] ${p.name.slice(0, 60)}`).join('\n')
        : translateChat(context.locale, 'bot.playlist.none'),
    );
    return;
  }
  const byId = /^\d+$/.test(query) ? playlists.filter(p => p.id === Number(query)) : [];
  const exact = playlists.filter(p => p.name.toLowerCase() === query);
  const matches = byId.length ? byId : exact.length ? exact : playlists.filter(p => p.name.toLowerCase().includes(query));
  if (matches.length !== 1) {
    context.reply(
      bot,
      userClid,
      matches.length
        ? translateChat(context.locale, 'bot.playlist.ambiguous', {
          matches: matches.slice(0, 5).map(p => `[${p.id}] ${p.name.slice(0, 60)}`).join(', '),
        })
        : translateChat(context.locale, 'bot.playlist.not_found'),
    );
    return;
  }
  const playlist = await context.prisma.playlist.findFirst({
    where: { ...where, id: matches[0].id },
    include: { songs: { include: { song: true }, orderBy: { position: 'asc' } } },
  });
  if (!playlist?.songs.length) {
    context.reply(bot, userClid, translateChat(context.locale, 'bot.playlist.empty'));
    return;
  }
  if (context.voiceBotManager.getBot(botId) !== bot || bot.stopGeneration !== stopGeneration) {
    void context.reply(bot, userClid, translateChat(context.locale, 'bot.playlist.stopped'));
    return;
  }
  const items: QueueItem[] = playlist.songs.map(({ song }) => ({
    id: String(song.id), title: song.title, artist: song.artist ?? undefined,
    duration: song.duration ?? undefined, filePath: song.filePath,
    source: song.source as QueueItem['source'], sourceUrl: song.sourceUrl ?? undefined,
  }));
  try {
    bot.queue.addMany(items);
  } catch (err) {
    if (!(err instanceof QueueFullError)) throw err;
    void context.reply(bot, userClid, translateChat(
      context.locale,
      err.requested > 1 ? 'bot.queue.full_multi' : 'bot.queue.full',
      {
        room: err.room,
        requested: err.requested,
        limit: MAX_QUEUE_ITEMS.toLocaleString('en-US'),
      },
    ));
    return;
  }
  context.saveMusicRequest(bot, items);
  if (bot.status === 'connected' && !bot.nowPlaying) {
    const first = bot.queue.playAt(bot.queue.index < 0 ? 0 : bot.queue.index + 1);
    if (first) await bot.play(first, context.chatMusicSwitch(bot)); // VoiceBot owns local/stream playlist resolution.
  }
  context.reply(
    bot,
    userClid,
    translateChat(context.locale, 'bot.playlist.queued', {
      name: playlist.name.slice(0, 60),
      count: items.length,
    }),
  );
}

/** Report or set the queue repeat mode after validating the requested mode. */
export function handleRepeat(context: CommandContext, bot: VoiceBot, userClid: number, args: string): void {
  const mode = args.trim().toLowerCase();
  if (mode && mode !== 'off' && mode !== 'track' && mode !== 'queue') {
    context.reply(bot, userClid, translateChat(context.locale, 'bot.repeat.usage')); return;
  }
  if (mode === 'off' || mode === 'track' || mode === 'queue') bot.queue.setRepeat(mode);
  context.reply(
    bot,
    userClid,
    translateChat(context.locale, 'bot.repeat.mode', { mode: bot.queue.repeat }),
  );
}

/**
 * Chat track numbers count from the first track kept since the last clear, so
 * pruning played tracks never renumbers the ones still queued.
 */
function trackNumber(bot: VoiceBot, index: number): number {
  return bot.queue.pruned + index + 1;
}

/** Queue position of a chat track number, or NaN when it is not a number. */
function indexOfTrackNumber(bot: VoiceBot, raw: string): number {
  const value = raw.trim();
  return (/^[1-9]\d*$/.test(value) ? Number(value) : Number.NaN) - 1 - bot.queue.pruned;
}

function invalidTrackNumber(context: CommandContext, bot: VoiceBot): string {
  if (bot.queue.length === 0) return translateChat(context.locale, 'bot.queue.invalid_empty');
  return translateChat(context.locale, 'bot.queue.invalid_range', {
    min: trackNumber(bot, 0),
    max: trackNumber(bot, bot.queue.length - 1),
  });
}

/** Remove one unambiguous upcoming track matched by title or artist. */
export function handleRemove(context: CommandContext, bot: VoiceBot, userClid: number, args: string): void {
  const query = args.trim().toLowerCase();
  if (!query) {
    context.reply(bot, userClid, translateChat(context.locale, 'bot.remove.usage'));
    return;
  }
  const upcoming = bot.queue.getAll().map((item, index) => ({ item, index }))
    .filter(({ index }) => index > bot.queue.index);
  const exact = upcoming.filter(({ item }) => item.title.toLowerCase() === query || item.artist?.toLowerCase() === query);
  const matches = exact.length ? exact : upcoming.filter(({ item }) =>
    item.title.toLowerCase().includes(query) || item.artist?.toLowerCase().includes(query));
  if (matches.length !== 1) {
    context.reply(
      bot,
      userClid,
      matches.length
        ? translateChat(context.locale, 'bot.remove.multiple', {
          matches: matches.slice(0, 5).map(({ item, index }) =>
            `#${trackNumber(bot, index)} ${item.title.slice(0, 60)}`).join(', '),
        })
        : translateChat(context.locale, 'bot.remove.none'),
    );
    return;
  }
  bot.queue.removeAt(matches[0].index);
  context.reply(
    bot,
    userClid,
    translateChat(context.locale, 'bot.remove.removed', {
      title: matches[0].item.title.slice(0, 100),
    }),
  );
}

/** Lines one !queue reply lists. */
const QUEUE_LINES = 15;

/** Format the queue around the playing track; the kept history would otherwise fill the list. */
export function showQueue(context: CommandContext, bot: VoiceBot, userClid: number): void {
  const items = bot.queue.getAll();
  const trackLines = items.map((item) => ({
    title: item.title,
    artist: item.artist,
    duration: item.duration,
  }));
  const start = Math.max(0, Math.min(bot.queue.index - 2, items.length - QUEUE_LINES));
  context.reply(
    bot,
    userClid,
    formatQueueMessage(
      trackLines,
      bot.queue.index,
      QUEUE_LINES,
      { start, numberOffset: bot.queue.pruned },
      context.locale,
    ),
  );
}

/** Show, remove, play, clear, or append queue items using chat arguments. */
export async function handleQueue(
  context: CommandContext,
  botId: number,
  bot: VoiceBot,
  userClid: number,
  args: string,
): Promise<void> {
  // No args or "show" — display current queue
  if (!args || args.toLowerCase() === 'show') {
    context.showQueue(bot, userClid);
    return;
  }

  // !queue remove <index>
  if (args.toLowerCase().startsWith('remove ')) {
    const idx = indexOfTrackNumber(bot, args.substring(7));
    const items = bot.queue.getAll();
    if (isNaN(idx) || idx < 0 || idx >= items.length) {
      void context.reply(bot, userClid, invalidTrackNumber(context, bot));
      return;
    }
    const removed = items[idx];
    const number = trackNumber(bot, idx);
    bot.queue.removeAt(idx);
    void context.reply(
      bot,
      userClid,
      translateChat(context.locale, 'bot.queue.removed', { number, title: removed.title }),
    );
    return;
  }

  // !queue play <index>
  if (args.toLowerCase().startsWith('play ')) {
    const idx = indexOfTrackNumber(bot, args.substring(5));
    const number = trackNumber(bot, idx);
    const item = bot.queue.playAt(idx);
    if (!item) {
      void context.reply(bot, userClid, invalidTrackNumber(context, bot));
      return;
    }
    if (item.streamUrl) {
      await bot.playStream(item, context.chatMusicSwitch(bot));
    } else {
      await bot.play(item, context.chatMusicSwitch(bot));
    }
    void context.reply(
      bot,
      userClid,
      translateChat(context.locale, 'bot.queue.playing', { number, title: item.title }),
    );
    return;
  }

  // !queue clear — like !stop, cancels chat and console requests still resolving
  if (args.toLowerCase() === 'clear') {
    invalidateChatPlaylistExpansion(bot.currentConfig.id);
    invalidatePlaylistExpansion(bot.currentConfig.id);
    bot.queue.clear();
    bot.clearPlayback();
    context.reply(bot, userClid, translateChat(context.locale, 'bot.queue.cleared'));
    return;
  }

  // URL provided — add to queue without interrupting
  if (!args.startsWith('http://') && !args.startsWith('https://')) {
    context.reply(bot, userClid, translateChat(context.locale, 'bot.queue.usage'));
    return;
  }

  context.reply(bot, userClid, translateChat(context.locale, 'bot.play.loading'));

  try {
    await context.enqueueMediaUrl(botId, bot, userClid, args);
  } catch (err: any) {
    context.reply(bot, userClid, translateChat(context.locale, 'bot.queue.failed', { error: err.message }));
  }
}

/** Toggle or explicitly set queue shuffling using the accepted chat values. */
export function handleShuffle(context: CommandContext, bot: VoiceBot, userClid: number, args: string): void {
  const arg = args.trim().toLowerCase();
  let enabled: boolean;
  if (!arg) {
    enabled = !bot.queue.shuffle;
  } else if (arg === 'on' || arg === '1' || arg === 'true' || arg === 'yes') {
    enabled = true;
  } else if (arg === 'off' || arg === '0' || arg === 'false' || arg === 'no') {
    enabled = false;
  } else {
    context.reply(bot, userClid, translateChat(context.locale, 'bot.shuffle.usage'));
    return;
  }

  bot.queue.setShuffle(enabled);
  context.reply(
    bot,
    userClid,
    translateChat(context.locale, enabled ? 'bot.shuffle.on' : 'bot.shuffle.off'),
  );
}

/** Record a canonical source reference in per-bot request history without blocking playback. */
export function saveMusicRequest(context: CommandContext, bot: VoiceBot, item: QueueItem | QueueItem[]): void {
  const serverConfigId = bot.currentConfig.serverConfigId;
  if (!serverConfigId) return;
  void recordMusicRequests(context.prisma, {
    serverConfigId,
    musicBotId: bot.currentConfig.id,
  }, Array.isArray(item) ? item : [item]).catch(error => {
    console.error('[MusicCmd] Failed to save music request history (%s)', musicHistoryErrorCode(error));
  });
}
