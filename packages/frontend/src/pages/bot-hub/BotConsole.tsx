/**
 * Bot console (`/bot-hub/:botId`): what one bot is playing, its queue, and
 * every way to start something on it. Starts use the existing endpoints and
 * the global "Replace what is playing?" prompt.
 */

import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Bot } from 'lucide-react';
import type { BotMediaOverview, PlaybackState } from '@ts6/common';
import { NowPlaying } from '@/components/media/NowPlaying';
import { AutomationBadges } from '@/components/media/AutomationBadges';
import { StreamSourceSwitch } from '@/components/video/StreamSourceSwitch';
import { StreamViewers } from '@/components/video/StreamViewers';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBotMedia, useMusicBotState, useVideoQueue } from '@/hooks/use-music-bots';
import { apiErrorMessage } from '@/lib/api-error';
import { hubTone } from '@/lib/bot-hub';
import { useEffect, useState } from 'react';
import { LinkSource } from './LinkSource';
import { MusicSource } from './MusicSource';
import { RadioSource } from './RadioSource';
import { IptvSource } from './IptvSource';
import { SourcePicker, type ConsoleSourceTab } from './SourcePicker';
import { UpNextQueue } from './UpNextQueue';
import { VideoUpNext } from './VideoUpNext';
import { activeLane, upNext } from './console-queue';
import { BotSettingsMenu } from './BotSettingsMenu';
import { BotAvatar } from '@/components/shared/BotAvatar';

/** Source tabs in order Music · Link · Radio · IPTV. */
export const CONSOLE_TABS: ConsoleSourceTab[] = [
  { id: 'music', labelKey: 'console.tabs.music', render: (ctx) => <MusicSource {...ctx} /> },
  { id: 'link', labelKey: 'console.tabs.link', render: (ctx) => <LinkSource {...ctx} /> },
  { id: 'radio', labelKey: 'console.tabs.radio', render: (ctx) => <RadioSource {...ctx} /> },
  { id: 'iptv', labelKey: 'console.tabs.iptv', render: (ctx) => <IptvSource key={ctx.serverConfigId} {...ctx} /> },
];

/** The bot's TeamSpeak connection, shown next to its name. */
const CONNECTION_BADGE: Record<string, { labelKey: string; variant: 'success' | 'warning' | 'destructive' | 'outline' }> = {
  connected: { labelKey: 'console.connection.connected', variant: 'success' },
  playing: { labelKey: 'console.connection.connected', variant: 'success' },
  paused: { labelKey: 'console.connection.connected', variant: 'success' },
  starting: { labelKey: 'console.connection.connecting', variant: 'warning' },
  stopped: { labelKey: 'console.connection.offline', variant: 'outline' },
  error: { labelKey: 'console.connection.error', variant: 'destructive' },
};

/** Keep elapsed playback displays current while the console is open. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** What the music queue is waiting behind, if anything. */
function musicKeptFor(bot: BotMediaOverview): 'radio' | 'video' | null {
  if (bot.music?.live) return 'radio';
  return bot.session?.kind === 'video' ? 'video' : null;
}

/** Up next for an online bot: one lane owns it; the other, when it holds items, waits as a one-line strip. */
function UpNextLanes({ bot }: { bot: BotMediaOverview }) {
  const stateQuery = useMusicBotState(bot.botId);
  const state = stateQuery.data as PlaybackState | undefined;
  const videoQueueQuery = useVideoQueue(bot.botId);
  const videoQueue = videoQueueQuery.data;
  const lane = activeLane({
    sessionKind: bot.session?.kind ?? null,
    musicLive: !!bot.music?.live,
    musicUpNext: state ? upNext(state).length : 0,
    videoUpNext: videoQueue?.upNext.length ?? 0,
  });
  const musicQueue = (
    <UpNextQueue botId={bot.botId} state={state} keptFor={musicKeptFor(bot)} stripOnly={lane === 'video'}
      loadError={stateQuery.isError ? stateQuery.error : null} />
  );
  const videoLane = (
    <VideoUpNext botId={bot.botId} state={videoQueue} streaming={bot.session?.kind === 'video'}
      stripOnly={lane === 'music'}
      loadError={lane === 'video' && videoQueueQuery.isError ? videoQueueQuery.error : null} />
  );
  return lane === 'video' ? <>{videoLane}{musicQueue}</> : <>{musicQueue}{videoLane}</>;
}

/** Render one bot's playback state, queue, and source tabs. */
export default function BotConsole() {
  const { t } = useTranslation('bots');
  const botId = Number(useParams().botId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const media = useBotMedia();
  const now = useNow();
  const bot = (media.data ?? []).find((b) => b.botId === botId);
  const tone = bot ? hubTone(bot) : 'offline';
  const online = !!bot && tone !== 'offline';

  if (media.isLoading) return <PageLoader />;
  if (media.isError) {
    return <EmptyState icon={AlertTriangle} title={t('console.loadErrorTitle')} description={apiErrorMessage(media.error, t('console.tryAgain'))} />;
  }
  if (!bot) {
    return (
      <EmptyState icon={Bot} title={t('console.notFoundTitle')} description={t('console.notFoundDescription')}>
        <Button asChild size="sm"><Link to="/bot-hub">{t('console.backToHub')}</Link></Button>
      </EmptyState>
    );
  }

  const connection = CONNECTION_BADGE[bot.status] ?? CONNECTION_BADGE.connected;

  return (
    <div className="space-y-4">
      <nav aria-label={t('console.breadcrumbAria')} className="text-sm text-muted-foreground">
        <Link to="/bot-hub" className="hover:text-foreground">{t('console.botHub')}</Link> / <span>{bot.botName}</span>
      </nav>
      <PageHeader
        title={bot.botName}
        leading={<BotAvatar botId={bot.botId} name={bot.botName} mode={bot.avatarMode} md5={bot.avatarMd5} />}
        badge={(
          <span className="flex flex-wrap items-center gap-1">
            <Badge variant={connection.variant} aria-live="polite">{t(connection.labelKey)}</Badge>
            <AutomationBadges bot={bot} />
          </span>
        )}
        description={`${bot.serverName ?? t('console.serverFallback', { id: bot.serverConfigId })}${bot.channelName ? ` · #${bot.channelName}` : ''}`}
        actions={(
          <BotSettingsMenu botId={bot.botId} botName={bot.botName} status={bot.status} size="default"
            onDeleted={() => navigate('/bot-hub', { replace: true })} />
        )}
      />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="now-playing" className="min-w-0 space-y-4">
          <NowPlaying
            bot={bot}
            now={now}
            variant="full"
            footer={online ? <UpNextLanes bot={bot} /> : undefined}
          />
          {tone === 'live' && <StreamSourceSwitch botId={bot.botId} />}
          {tone === 'live' && <StreamViewers botId={bot.botId} now={now} />}
        </section>

        <SourcePicker
          tabs={CONSOLE_TABS}
          ctx={{ botId: bot.botId, serverConfigId: bot.serverConfigId, botOnline: online, searchParams }}
          initialTab={searchParams.get('iptv') ? 'iptv' : undefined}
        />
      </div>
    </div>
  );
}
