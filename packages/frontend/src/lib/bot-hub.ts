/**
 * Bot hub wording: what a bot is doing right now, in one line.
 */

import type { TFunction } from 'i18next';
import type { BotMediaOverview } from '@ts6/common';
import {
  SOURCE_MODE_LABELS, formatClock, lastStopLabel, qualityLabel, encoderLabel, formatTimeout, healthLabel,
} from './video-streaming';

export type HubTone = 'live' | 'music' | 'idle' | 'offline';

export function hubTone(bot: BotMediaOverview): HubTone {
  if (bot.status === 'stopped' || bot.status === 'error') return 'offline';
  if (bot.session?.kind === 'video') return 'live';
  if (bot.session?.kind === 'music') return 'music';
  return 'idle';
}

/** "Neon Skyline — Aurora", "Streaming from iptv.example", "Idle", "Offline". */
export function hubHeadline(bot: BotMediaOverview, t?: TFunction<'bots'>): string {
  const tone = hubTone(bot);
  if (tone === 'offline') {
    if (bot.status === 'error') return t ? t('hubStatus.error') : 'Error';
    return t ? t('hubStatus.offline') : 'Offline';
  }
  if (tone === 'live') {
    const label = bot.session?.label;
    if (bot.session?.state === 'starting') {
      if (label) return t ? t('hubStatus.startingFrom', { label }) : `Starting stream from ${label}…`;
      return t ? t('hubStatus.starting') : 'Starting stream…';
    }
    if (label) return t ? t('hubStatus.streamingFrom', { label }) : `Streaming from ${label}`;
    return t ? t('hubStatus.streaming') : 'Streaming';
  }
  if (tone === 'music' && bot.music) {
    const title = bot.music.title ?? (t ? t('hubStatus.unknownTrack') : 'Unknown track');
    return bot.music.artist ? `${title} — ${bot.music.artist}` : title;
  }
  return t ? t('hubStatus.idle') : 'Idle';
}

/** Compact facts for the card: quality/encoder/viewers for video, progress for music. */
export function hubFacts(bot: BotMediaOverview, now: number, t?: TFunction<'bots'>): string[] {
  const facts: string[] = [];
  if (bot.video) {
    facts.push(qualityLabel(bot.video.quality, bot.video.preset));
    facts.push(encoderLabel(bot.video.encoder));
    if (bot.video.sourceMode) facts.push(SOURCE_MODE_LABELS[bot.video.sourceMode]);
    if (bot.video.health?.speed != null) facts.push(healthLabel(bot.video.health));
    facts.push(t
      ? t('hubFacts.viewers', { count: bot.video.viewerCount })
      : `${bot.video.viewerCount} viewer${bot.video.viewerCount === 1 ? '' : 's'}`);
    if (bot.video.startedAt) {
      const time = formatClock(now - bot.video.startedAt);
      facts.push(t ? t('hubFacts.up', { time }) : `up ${time}`);
    }
    if (bot.video.noViewer.stopAt) {
      const time = formatClock(bot.video.noViewer.stopAt - now);
      facts.push(t ? t('hubFacts.autoStopIn', { time }) : `auto-stop in ${time}`);
    } else if (bot.video.noViewer.timeoutSec > 0) {
      const time = formatTimeout(bot.video.noViewer.timeoutSec);
      facts.push(t ? t('hubFacts.stopsAfterIdle', { time }) : `stops after ${time} idle`);
    }
  } else if (bot.music) {
    if (bot.music.live) {
      facts.push(t ? t('hubFacts.liveRadio') : 'Live radio');
      if (bot.music.position != null) {
        const time = formatClock(bot.music.position * 1000);
        facts.push(t ? t('hubFacts.up', { time }) : `up ${time}`);
      }
    } else if (bot.music.position != null) {
      facts.push(bot.music.duration
        ? `${formatClock(bot.music.position * 1000)} / ${formatClock(bot.music.duration * 1000)}`
        : formatClock(bot.music.position * 1000));
    }
    if (bot.status === 'paused') facts.push(t ? t('hubFacts.paused') : 'Paused');
  }
  return facts;
}

/** Labelled video facts for the console's Now playing card. */
export function videoDetails(bot: BotMediaOverview, now: number, t?: TFunction<'bots'>): { label: string; value: string }[] {
  const v = bot.video;
  if (!v) return [];
  const tr = (key: string, fallback: string) => (t ? t(key) : fallback);
  const details = [
    { label: tr('videoDetails.quality', 'Quality'), value: qualityLabel(v.quality, v.preset) },
    { label: tr('videoDetails.encoder', 'Encoder'), value: encoderLabel(v.encoder) },
  ];
  if (v.sourceMode) details.push({ label: tr('videoDetails.source', 'Source'), value: SOURCE_MODE_LABELS[v.sourceMode] });
  if (v.health?.speed != null) details.push({ label: tr('videoDetails.encodeHealth', 'Encode health'), value: healthLabel(v.health) });
  details.push({
    label: tr('videoDetails.viewers', 'Viewers'),
    value: t ? t('videoDetails.viewersValue', { count: v.viewerCount }) : `${v.viewerCount} in channel`,
  });
  if (v.startedAt) details.push({ label: tr('videoDetails.upFor', 'Up for'), value: formatClock(now - v.startedAt) });
  if (v.noViewer.stopAt) {
    const time = formatClock(v.noViewer.stopAt - now);
    details.push({
      label: tr('videoDetails.autoStop', 'Auto-stop'),
      value: t ? t('videoDetails.autoStopIn', { time }) : `in ${time}`,
    });
  } else if (v.noViewer.timeoutSec > 0) {
    const time = formatTimeout(v.noViewer.timeoutSec);
    details.push({
      label: tr('videoDetails.autoStop', 'Auto-stop'),
      value: t ? t('videoDetails.autoStopIdle', { time }) : `if no viewers for ${time}`,
    });
  }
  return details;
}

/** "Track 2 of 8" from the bot's queue, or null when nothing is queued. */
export function queuePosition(
  state: { queue: unknown[]; currentIndex: number } | null | undefined,
  t?: TFunction<'bots'>,
): string | null {
  if (!state || state.queue.length === 0 || state.currentIndex < 0 || state.currentIndex >= state.queue.length) return null;
  return t
    ? t('queuePosition', { current: state.currentIndex + 1, total: state.queue.length })
    : `Track ${state.currentIndex + 1} of ${state.queue.length}`;
}

/** The newest stop across music and video, for idle cards. */
export function hubLastStop(bot: BotMediaOverview, now: number, t?: TFunction<'bots'>): string | null {
  const stops = [
    bot.lastVideoStop ? { ...bot.lastVideoStop, kind: 'Stream' } : null,
    bot.lastMusicStop ? { ...bot.lastMusicStop, kind: 'Music' } : null,
  ].filter((s): s is NonNullable<typeof s> => s != null).sort((a, b) => b.at - a.at);
  const latest = stops[0];
  if (!latest) return null;
  const detail = lastStopLabel(latest, now);
  if (!t) return `Last ${latest.kind.toLowerCase()}: ${detail}`;
  return latest.kind === 'Stream'
    ? t('hubLastStop.stream', { detail })
    : t('hubLastStop.music', { detail });
}

/** Bots with music or a stream on right now, playing ones before paused ones. */
export function activeBots(bots: BotMediaOverview[]): BotMediaOverview[] {
  return bots
    .filter((b) => b.session && hubTone(b) !== 'offline')
    .sort((a, b) => Number(a.status === 'paused') - Number(b.status === 'paused'));
}

/** The header pill: "Neon Skyline — Aurora", "2 active bots", or null when nothing is on. */
export function activeBotsLabel(active: BotMediaOverview[], t?: TFunction<'bots'>): string | null {
  if (active.length === 0) return null;
  if (active.length > 1) {
    return t ? t('activeBots', { count: active.length }) : `${active.length} active bots`;
  }
  return hubHeadline(active[0], t);
}

export interface AutomationBadge {
  label: string;
  /** Longer explanation for the tooltip and screen readers. */
  title: string;
}

/** Badges for a bot's Auto-DJ and 24/7 settings; empty when both are off. */
export function automationBadges(bot: BotMediaOverview, t?: TFunction<'bots'>): AutomationBadge[] {
  const automation = bot.automation;
  if (!automation) return [];
  const badges: AutomationBadge[] = [];
  if (automation.autoDj) {
    const source = automation.sourceKind === 'radio'
      ? (t ? t('automation.radioStation') : 'a radio station')
      : (t ? t('automation.savedPlaylist') : 'a saved playlist');
    badges.push(automation.playing
      ? {
          label: t ? t('automation.autoDjPlaying') : 'Auto-DJ playing',
          title: t
            ? t('automation.autoDjPlayingTitle', { source })
            : `Auto-DJ is playing ${source}. A request replaces it at once.`,
        }
      : {
          label: t ? t('automation.autoDj') : 'Auto-DJ',
          title: t
            ? t('automation.autoDjTitle', { source })
            : `Auto-DJ is on: it plays ${source} when nothing is queued.`,
        });
  }
  if (automation.stayInChannel) {
    badges.push({
      label: t ? t('automation.stayInChannel') : '24/7',
      title: t ? t('automation.stayInChannelTitle') : '24/7 is on: the bot stays in its channel.',
    });
  }
  return badges;
}
