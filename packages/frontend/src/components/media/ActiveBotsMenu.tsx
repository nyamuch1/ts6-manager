/**
 * Header pill for the Media Library: what bots are playing right now, with a
 * menu to pause/resume music or jump to a bot's console in the Bot Hub.
 */

import { Link } from 'react-router-dom';
import { ChevronDown, LayoutGrid, Pause, Play, Radio, Tv } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import type { BotMediaOverview } from '@ts6/common';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { useBotMedia, usePausePlayback, useResumePlayback } from '@/hooks/use-music-bots';
import { activeBots, hubTone } from '@/lib/bot-hub';
import { apiErrorMessage } from '@/lib/api-error';

/** One-line summary of what a bot is doing right now. */
function headlineFor(bot: BotMediaOverview, t: TFunction<'media'>): string {
  const tone = hubTone(bot);
  if (tone === 'offline') return t(bot.status === 'error' ? 'hub.error' : 'hub.offline');
  if (tone === 'live') {
    const label = bot.session?.label;
    if (bot.session?.state === 'starting') {
      return label ? t('hub.startingFrom', { label }) : t('hub.starting');
    }
    return label ? t('hub.streamingFrom', { label }) : t('hub.streaming');
  }
  if (tone === 'music' && bot.music) {
    const title = bot.music.title ?? t('nowPlaying.unknownTrack');
    return bot.music.artist ? `${title} — ${bot.music.artist}` : title;
  }
  return t('hub.idle');
}

/** Pause or resume a music bot without closing the menu. */
function PlayPauseItem({ bot }: { bot: BotMediaOverview }) {
  const { t } = useTranslation('media');
  const pause = usePausePlayback();
  const resume = useResumePlayback();
  const paused = bot.status === 'paused';
  const pending = pause.isPending || resume.isPending;
  return (
    <DropdownMenuItem
      className="shrink-0 justify-center px-2"
      disabled={pending}
      aria-label={t(paused ? 'activeBots.resumeBot' : 'activeBots.pauseBot', { bot: bot.botName })}
      onSelect={(e) => {
        // Keep the menu open so the new state shows on the next poll.
        e.preventDefault();
        const action = paused ? resume : pause;
        action.mutate(bot.botId, {
          onError: (err) => toast.error(apiErrorMessage(
            err,
            t(paused ? 'activeBots.couldNotResume' : 'activeBots.couldNotPause'),
          )),
        });
      }}
    >
      {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
    </DropdownMenuItem>
  );
}

/** One active bot: a link to its console, plus pause/resume for music. */
function ActiveBotRow({ bot }: { bot: BotMediaOverview }) {
  const { t } = useTranslation('media');
  const tone = hubTone(bot);
  const KindIcon = tone === 'live' ? Tv : Radio;
  const headline = headlineFor(bot, t);
  return (
    <div className="flex items-center gap-1">
      <DropdownMenuItem asChild className="min-w-0 flex-1">
        <Link
          to={`/bot-hub/${bot.botId}`}
          aria-label={t('activeBots.openConsole', { bot: bot.botName, status: headline })}
        >
          <BotAvatar
            botId={bot.botId}
            name={bot.botName}
            mode={bot.avatarMode}
            md5={bot.avatarMd5}
            className="h-8 w-8 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{bot.botName}</span>
            <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <KindIcon className="!size-3" aria-hidden="true" />
              <span className="truncate">
                {bot.status === 'paused'
                  ? t('activeBots.pausedHeadline', { headline })
                  : headline}
              </span>
            </span>
          </span>
        </Link>
      </DropdownMenuItem>
      {tone === 'music' && !bot.music?.live && <PlayPauseItem bot={bot} />}
    </div>
  );
}

/** "Now playing" pill: hidden text on phones, a quiet Bot Hub link when nothing is on. */
export function ActiveBotsMenu() {
  const { t } = useTranslation('media');
  const { data } = useBotMedia();
  const active = activeBots(data ?? []);
  const label = active.length === 0
    ? null
    : active.length > 1
      ? t('activeBots.activeBotsCount', { count: active.length })
      : headlineFor(active[0], t);

  // Until the first poll succeeds we don't know what's playing: link to Bot Hub without a status.
  if (data === undefined) {
    return (
      <Button asChild variant="outline" size="sm" className="h-9 text-muted-foreground">
        <Link to="/bot-hub" aria-label={t('activeBots.openBotHub')}>
          <LayoutGrid className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
          <span className="hidden sm:inline">{t('activeBots.botHub')}</span>
        </Link>
      </Button>
    );
  }

  if (!label) {
    return (
      <Button asChild variant="outline" size="sm" className="h-9 text-muted-foreground">
        <Link to="/bot-hub" aria-label={t('activeBots.noBotsPlayingOpen')}>
          <LayoutGrid className="h-4 w-4 sm:mr-1.5" aria-hidden="true" />
          <span className="hidden sm:inline">{t('activeBots.noBotsPlaying')}</span>
        </Link>
      </Button>
    );
  }

  const allPaused = active.every((b) => b.status === 'paused');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 max-w-[18rem] gap-2 border-primary/40"
          aria-label={t('activeBots.nowPlayingShow', { label })}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            {!allPaused && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${allPaused ? 'bg-amber-400' : 'bg-emerald-500'}`}
            />
          </span>
          <span className="sm:hidden">{active.length}</span>
          <span className="hidden min-w-0 truncate sm:inline">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {t('activeBots.nowPlayingCount', { count: active.length })}
        </DropdownMenuLabel>
        {active.map((bot) => (
          <ActiveBotRow key={bot.botId} bot={bot} />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/bot-hub">
            <LayoutGrid aria-hidden="true" /> {t('activeBots.openBotHub')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
