import { useState } from 'react';
import {
  AlertTriangle, Gauge, Music, Pause, Play, Radio, SkipForward, Square, Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BotAutomationDialog } from '@/pages/bot-hub/BotAutomationDialog';
import type { BotMediaOverview } from '@ts6/common';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { Badge } from '@/components/ui/badge';
import { AutomationBadges } from './AutomationBadges';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  usePausePlayback, useResumePlayback, useSkipTrack, useSetVolume,
  useMusicBotState, useStopPlayback, useStopVideoStream,
} from '@/hooks/use-music-bots';
import { apiErrorMessage } from '@/lib/api-error';
import { hubTone, type HubTone } from '@/lib/bot-hub';
import {
  SOURCE_MODE_LABELS,
  encoderLabel,
  formatClock,
  formatTimeout,
  healthLabel,
  lastStopLabel,
  qualityAdaptationNote,
  qualityLabel,
} from '@/lib/video-streaming';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

// Getters keep labels-language-aware even though this constant is built at
// module load, before the i18n instance is initialized.
const TONE_BADGE: Record<HubTone, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
  live: { get label() { return i18n.t('media:nowPlaying.toneLive'); }, variant: 'destructive' },
  music: { get label() { return i18n.t('media:nowPlaying.tonePlaying'); }, variant: 'default' },
  idle: { get label() { return i18n.t('media:nowPlaying.toneIdle'); }, variant: 'secondary' },
  offline: { get label() { return i18n.t('media:nowPlaying.toneOffline'); }, variant: 'outline' },
};

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** One-line summary of what a bot is doing right now. */
function headlineFor(bot: BotMediaOverview, t: TFunction<'media'>): string {
  const tone = hubTone(bot);
  if (tone === 'offline') {
    return t(bot.status === 'error' ? 'hub.error' : 'hub.offline');
  }
  if (tone === 'live') {
    const label = bot.session?.label;
    if (bot.session?.state === 'starting') {
      return label
        ? t('hub.startingFrom', { label })
        : t('hub.starting');
    }
    return label ? t('hub.streamingFrom', { label }) : t('hub.streaming');
  }
  if (tone === 'music' && bot.music) {
    const title = bot.music.title ?? t('nowPlaying.unknownTrack');
    return bot.music.artist ? `${title} — ${bot.music.artist}` : title;
  }
  return t('hub.idle');
}

/** Compact facts for the card: quality/encoder/viewers for video, progress for music. */
function factsFor(bot: BotMediaOverview, now: number, t: TFunction<'media'>): string[] {
  const facts: string[] = [];
  if (bot.video) {
    facts.push(qualityLabel(bot.video.quality, bot.video.preset));
    facts.push(encoderLabel(bot.video.encoder));
    if (bot.video.sourceMode) facts.push(SOURCE_MODE_LABELS[bot.video.sourceMode]);
    if (bot.video.health?.speed != null) facts.push(healthLabel(bot.video.health));
    facts.push(t('hub.viewerCount', { count: bot.video.viewerCount }));
    if (bot.video.startedAt) {
      facts.push(t('hub.up', { time: formatClock(now - bot.video.startedAt) }));
    }
    if (bot.video.noViewer.stopAt) {
      facts.push(t('hub.autoStopIn', {
        time: formatClock(bot.video.noViewer.stopAt - now),
      }));
    } else if (bot.video.noViewer.timeoutSec > 0) {
      facts.push(t('hub.stopsAfterIdle', {
        time: formatTimeout(bot.video.noViewer.timeoutSec),
      }));
    }
  } else if (bot.music) {
    if (bot.music.live) {
      facts.push(t('hub.liveRadio'));
      if (bot.music.position != null) {
        facts.push(t('hub.up', { time: formatClock(bot.music.position * 1000) }));
      }
    } else if (bot.music.position != null) {
      facts.push(bot.music.duration
        ? `${formatClock(bot.music.position * 1000)} / ${formatClock(bot.music.duration * 1000)}`
        : formatClock(bot.music.position * 1000));
    }
    if (bot.status === 'paused') facts.push(t('hub.paused'));
  }
  return facts;
}

/** Labelled video facts for the console's Now playing card. */
function videoDetailsFor(
  bot: BotMediaOverview,
  now: number,
  t: TFunction<'media'>,
): { label: string; value: string }[] {
  const v = bot.video;
  if (!v) return [];
  const details = [
    { label: t('hub.detailQuality'), value: qualityLabel(v.quality, v.preset) },
    { label: t('hub.detailEncoder'), value: encoderLabel(v.encoder) },
  ];
  if (v.sourceMode) {
    details.push({ label: t('hub.detailSource'), value: SOURCE_MODE_LABELS[v.sourceMode] });
  }
  if (v.health?.speed != null) {
    details.push({ label: t('hub.detailEncodeHealth'), value: healthLabel(v.health) });
  }
  details.push({
    label: t('hub.detailViewers'),
    value: t('hub.viewerInChannel', { count: v.viewerCount }),
  });
  if (v.startedAt) {
    details.push({ label: t('hub.detailUpFor'), value: formatClock(now - v.startedAt) });
  }
  if (v.noViewer.stopAt) {
    details.push({
      label: t('hub.detailAutoStop'),
      value: t('hub.autoStopInValue', { time: formatClock(v.noViewer.stopAt - now) }),
    });
  } else if (v.noViewer.timeoutSec > 0) {
    details.push({
      label: t('hub.detailAutoStop'),
      value: t('hub.autoStopIdleValue', { time: formatTimeout(v.noViewer.timeoutSec) }),
    });
  }
  return details;
}

/** "Track 2 of 8" from the bot's queue, or null when nothing is queued. */
function trackPosition(
  state: { queue: unknown[]; currentIndex: number } | null | undefined,
  t: TFunction<'media'>,
): string | null {
  if (!state || state.queue.length === 0 || state.currentIndex < 0
    || state.currentIndex >= state.queue.length) return null;
  return t('hub.trackOf', {
    current: state.currentIndex + 1,
    total: state.queue.length,
  });
}

/** The newest stop across music and video, for idle cards. */
function lastStopFor(bot: BotMediaOverview, now: number, t: TFunction<'media'>): string | null {
  const stops = [
    bot.lastVideoStop ? { ...bot.lastVideoStop, kind: 'video' as const } : null,
    bot.lastMusicStop ? { ...bot.lastMusicStop, kind: 'music' as const } : null,
  ].filter((s): s is NonNullable<typeof s> => s != null).sort((a, b) => b.at - a.at);
  const latest = stops[0];
  if (!latest) return null;
  const detail = lastStopLabel(latest, now);
  if (!detail) return null;
  return t(latest.kind === 'video' ? 'hub.lastStream' : 'hub.lastMusic', { detail });
}

export interface NowPlayingProps {
  bot: BotMediaOverview;        // from @ts6/common, as SessionCard uses today
  now: number;                  // ms, from the page's 1 s clock
  variant: 'compact' | 'full';  // phase 2's console uses 'full'
  footer?: React.ReactNode;     // the hub passes its Open / Stop buttons here
  avatar?: React.ReactNode;
}

export function NowPlaying(props: NowPlayingProps): JSX.Element {
  return props.variant === 'full' ? <FullNowPlaying {...props} /> : <CompactNowPlaying {...props} />;
}

function CompactNowPlaying(props: NowPlayingProps): JSX.Element {
  const { t } = useTranslation('media');
  const { bot, now, footer, avatar } = props;
  const pausePlayback = usePausePlayback();
  const resumePlayback = useResumePlayback();
  const skipTrack = useSkipTrack();
  const setVolume = useSetVolume();
  const [draggingVolume, setDraggingVolume] = useState<number | null>(null);

  const tone = hubTone(bot);
  const showVolume = tone === 'music' || tone === 'live';
  const { data: musicState } = useMusicBotState(showVolume ? bot.botId : null);
  const badge = TONE_BADGE[tone];
  const facts = factsFor(bot, now, t);
  const adaptation = qualityAdaptationNote(bot.video?.quality, now);
  const lastStop = tone === 'idle' || tone === 'offline' ? lastStopFor(bot, now, t) : null;
  // One playback command at a time: repeat clicks would send duplicate skips.
  const playbackPending = pausePlayback.isPending || resumePlayback.isPending || skipTrack.isPending;
  const isPaused = bot.status === 'paused' || musicState?.status === 'paused';
  const volume = draggingVolume ?? musicState?.volume ?? 50;

  return (
    <Card className={cn(tone === 'offline' && 'opacity-70')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {avatar}
            <div className="min-w-0">
              <p className="truncate font-medium">{bot.botName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {bot.serverName ?? t('nowPlaying.serverFallback', { id: bot.serverConfigId })}
                {bot.channelName ? ` · #${bot.channelName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
            <AutomationBadges bot={bot} />
            <Badge variant={badge.variant} className="shrink-0 gap-1">
              {tone === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
              {bot.session?.state === 'starting' ? t('nowPlaying.toneStarting') : badge.label}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tone === 'live' ? <Video className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            : tone === 'music' ? (bot.music?.live
              ? <Radio className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              : <Music className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />)
              : null}
          <p className={cn('truncate text-sm', tone === 'idle' || tone === 'offline' ? 'text-muted-foreground' : 'font-medium')}>
            {headlineFor(bot, t)}
          </p>
        </div>

        {facts.length > 0 && (
          <p className="text-xs text-muted-foreground">{facts.join(' · ')}</p>
        )}
        {bot.video?.health?.warning && (
          <p className="flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-3">{bot.video.health.warning}</span>
          </p>
        )}
        {adaptation && (
          <p className={cn('flex items-start gap-1.5 text-xs', adaptation.reduced ? 'text-warning' : 'text-muted-foreground')}>
            <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-3">{adaptation.text}</span>
          </p>
        )}
        {bot.video?.encoder?.fallbackReason && (
          <p className="flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{t('nowPlaying.hardwareFallback', { reason: bot.video.encoder.fallbackReason })}</span>
          </p>
        )}
        {bot.video?.encoder?.decoderFallbackReason && (
          <p className="flex items-start gap-1.5 text-xs text-warning" role="status" aria-live="polite">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-2">{t('nowPlaying.decoderFallback', { reason: bot.video.encoder.decoderFallbackReason })}</span>
          </p>
        )}

        {tone === 'live' && (
          <div className="space-y-2">
            <VideoPlayer
              botId={bot.botId}
              streaming={bot.session?.state === 'active'}
              idleDetail={bot.session?.state === 'starting' ? t('nowPlaying.startingStream') : null}
              className="max-w-none w-full"
            />
            <div className="space-y-1 rounded-md border bg-muted/30 p-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('nowPlaying.volume')}</span>
                <span>{volume}%</span>
              </div>
              <Slider
                value={[volume]}
                max={100}
                step={1}
                aria-label={t('nowPlaying.volumeFor', { bot: bot.botName })}
                onValueChange={([val]) => setDraggingVolume(val)}
                onValueCommit={([val]) => {
                  setVolume.mutate({ botId: bot.botId, volume: val });
                  setDraggingVolume(null);
                }}
              />
            </div>
          </div>
        )}

        {tone === 'music' && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-2">
            <div className="flex items-center justify-center gap-1">
              {isPaused ? (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t('nowPlaying.resumeBot', { bot: bot.botName })}
                  disabled={playbackPending}
                  onClick={() => resumePlayback.mutate(bot.botId)}
                >
                  <Play className="h-4 w-4 ml-0.5" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t('nowPlaying.pauseBot', { bot: bot.botName })}
                  disabled={playbackPending}
                  onClick={() => pausePlayback.mutate(bot.botId)}
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              {!bot.music?.live && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t('nowPlaying.skipTrackOn', { bot: bot.botName })}
                  disabled={playbackPending}
                  onClick={() => skipTrack.mutate(bot.botId)}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Slider
              value={[volume]}
              max={100}
              step={1}
              aria-label={t('nowPlaying.volumeFor', { bot: bot.botName })}
              onValueChange={([val]) => setDraggingVolume(val)}
              onValueCommit={([val]) => {
                setVolume.mutate({ botId: bot.botId, volume: val });
                setDraggingVolume(null);
              }}
            />
          </div>
        )}

        {lastStop && <p className="text-xs text-muted-foreground">{lastStop}</p>}
        {footer}
      </CardContent>
    </Card>
  );
}

/** Labelled volume slider; music, video and IPTV share one level per bot. */
function VolumeControl({ bot, volume, onDrag, onCommit }: {
  bot: BotMediaOverview; volume: number; onDrag(v: number): void; onCommit(v: number): void;
}) {
  const { t } = useTranslation('media');
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('nowPlaying.volume')}</span>
        <span className="font-mono tabular-nums">{volume}%</span>
      </div>
      <Slider
        value={[volume]}
        max={100}
        step={1}
        aria-label={t('nowPlaying.volumeFor', { bot: bot.botName })}
        onValueChange={([val]) => onDrag(val)}
        onValueCommit={([val]) => onCommit(val)}
      />
    </div>
  );
}

/**
 * The console's Now playing card: one block per media type (music, radio,
 * video, idle), its own controls including Stop, then the caller's footer
 * (Up next).
 */
function FullNowPlaying({ bot, now, footer }: NowPlayingProps): JSX.Element {
  const { t } = useTranslation('media');
  const pausePlayback = usePausePlayback();
  const resumePlayback = useResumePlayback();
  const skipTrack = useSkipTrack();
  const setVolume = useSetVolume();
  const stopMusic = useStopPlayback();
  const stopVideo = useStopVideoStream();
  const [draggingVolume, setDraggingVolume] = useState<number | null>(null);
  const [automationOpen, setAutomationOpen] = useState(false);

  const tone = hubTone(bot);
  const active = tone === 'music' || tone === 'live';
  const { data: musicState } = useMusicBotState(active ? bot.botId : null);
  const radio = tone === 'music' && !!bot.music?.live;
  const isPaused = bot.status === 'paused' || musicState?.status === 'paused';
  const playbackPending = pausePlayback.isPending || resumePlayback.isPending || skipTrack.isPending;
  const volume = draggingVolume ?? musicState?.volume ?? 50;
  const lastStop = lastStopFor(bot, now, t);
  const stopError = tone === 'music' ? stopMusic.error : tone === 'live' ? stopVideo.error : null;

  const badge = TONE_BADGE[tone];
  const badgeLabel = bot.session?.state === 'starting' ? t('nowPlaying.toneStarting')
    : tone === 'music' && isPaused ? t('nowPlaying.tonePaused')
      : radio ? t('nowPlaying.toneRadio')
        : badge.label;

  const volumeControl = (
    <VolumeControl bot={bot} volume={volume} onDrag={setDraggingVolume}
      onCommit={(val) => { setVolume.mutate({ botId: bot.botId, volume: val }); setDraggingVolume(null); }} />
  );
  const music = bot.music;
  const subline = radio
    ? [
      t('nowPlaying.liveRadio'),
      music?.position != null
        ? t('nowPlaying.upFor', { time: formatClock(music.position * 1000) })
        : null,
    ]
    : [music?.artist, trackPosition(musicState, t)];
  const details = videoDetailsFor(bot, now, t);
  const adaptation = qualityAdaptationNote(bot.video?.quality, now);

  return (
    <Card className={cn(tone === 'offline' && 'opacity-70')}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="now-playing" className="text-base font-semibold">{t('nowPlaying.title')}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setAutomationOpen(true)}>
              <Radio className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> {t('nowPlaying.automationButton')}
            </Button>
            <Badge variant={badge.variant} className="shrink-0 gap-1">
              {tone === 'live' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" />}
              {badgeLabel}
            </Badge>
          </div>
        </div>

        {tone === 'music' && music && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {radio ? <Radio className="h-6 w-6" aria-hidden="true" /> : <Music className="h-6 w-6" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{radio ? headlineFor(bot, t) : (music.title ?? t('nowPlaying.unknownTrack'))}</p>
                {subline.some(Boolean) && (
                  <p className="truncate text-sm text-muted-foreground">{subline.filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </div>

            {!radio && music.duration ? (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-muted" role="progressbar" aria-label={t('nowPlaying.trackProgress')}
                  aria-valuemin={0} aria-valuemax={music.duration} aria-valuenow={music.position ?? 0}>
                  <div className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.min(100, ((music.position ?? 0) / music.duration) * 100)}%` }} />
                </div>
                <div className="flex justify-between font-mono text-xs tabular-nums text-muted-foreground">
                  <span>{clock(music.position ?? 0)}</span><span>{clock(music.duration)}</span>
                </div>
              </div>
            ) : null}

            {/* ponytail: 3 nowrap buttons overflow ~390px; Stop full-width below sm */}
            <div className={cn('grid min-w-0 gap-2', radio ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
              {isPaused ? (
                <Button variant="outline" className="h-11 min-w-0" aria-label={t('nowPlaying.resumeBot', { bot: bot.botName })} disabled={playbackPending}
                  onClick={() => resumePlayback.mutate(bot.botId)}>
                  <Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('nowPlaying.resume')}
                </Button>
              ) : (
                <Button variant="outline" className="h-11 min-w-0" aria-label={t('nowPlaying.pauseBot', { bot: bot.botName })} disabled={playbackPending}
                  onClick={() => pausePlayback.mutate(bot.botId)}>
                  <Pause className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('nowPlaying.pause')}
                </Button>
              )}
              {!radio && (
                <Button variant="outline" className="h-11 min-w-0" aria-label={t('nowPlaying.skipTrackOn', { bot: bot.botName })} disabled={playbackPending}
                  onClick={() => skipTrack.mutate(bot.botId)}>
                  <SkipForward className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('nowPlaying.skip')}
                </Button>
              )}
              <Button variant="outline" className={cn('h-11 min-w-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive', !radio && 'col-span-2 sm:col-span-1')}
                disabled={stopMusic.isPending} onClick={() => stopMusic.mutate(bot.botId)}>
                <Square className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t(radio ? 'nowPlaying.stopRadio' : 'nowPlaying.stop')}
              </Button>
            </div>
            {volumeControl}
          </div>
        )}

        {tone === 'live' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <p className="truncate text-base font-semibold">{headlineFor(bot, t)}</p>
            </div>
            <VideoPlayer
              botId={bot.botId}
              streaming={bot.session?.state === 'active'}
              idleDetail={bot.session?.state === 'starting' ? t('nowPlaying.startingStream') : null}
              className="max-w-none w-full"
            />
            {details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border bg-muted/30 p-3">
                {details.map((d) => (
                  <div key={d.label} className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{d.label}</dt>
                    <dd className="break-words text-sm">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {bot.video?.health?.warning && (
              <p className="flex items-start gap-1.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-3">{bot.video.health.warning}</span>
              </p>
            )}
            {adaptation && (
              <p className={cn('flex items-start gap-1.5 text-xs', adaptation.reduced ? 'text-warning' : 'text-muted-foreground')}>
                <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-3">{adaptation.text}</span>
              </p>
            )}
            {bot.video?.encoder?.fallbackReason && (
              <p className="flex items-start gap-1.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2">{t('nowPlaying.hardwareFallback', { reason: bot.video.encoder.fallbackReason })}</span>
              </p>
            )}
            {bot.video?.encoder?.decoderFallbackReason && (
              <p className="flex items-start gap-1.5 text-xs text-warning" role="status" aria-live="polite">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2">{t('nowPlaying.decoderFallback', { reason: bot.video.encoder.decoderFallbackReason })}</span>
              </p>
            )}
            {volumeControl}
            {bot.session?.state === 'active' && (
              <Button variant="outline" className="h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={stopVideo.isPending} onClick={() => stopVideo.mutate(bot.botId)}>
                <Square className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t('nowPlaying.stopStream')}
              </Button>
            )}
          </div>
        )}

        {(tone === 'idle' || tone === 'offline') && (
          <div className="rounded-md border border-dashed px-4 py-6 text-center">
            <p className="text-sm font-medium">
              {t(tone === 'idle' ? 'nowPlaying.idleNothing' : bot.status === 'error' ? 'nowPlaying.idleError' : 'nowPlaying.idleOffline')}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(tone === 'idle' ? 'nowPlaying.idleHint' : 'nowPlaying.offlineHint')}
            </p>
          </div>
        )}

        {stopError && <p role="alert" className="text-xs text-destructive">{apiErrorMessage(stopError, t('nowPlaying.couldNotStop'))}</p>}
        {lastStop && <p className="text-xs text-muted-foreground">{lastStop}</p>}
        {footer}
      </CardContent>
      {automationOpen && (
        <BotAutomationDialog botId={bot.botId} botName={bot.botName} onClose={() => setAutomationOpen(false)} />
      )}
    </Card>
  );
}
