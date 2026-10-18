/**
 * Console Link tab: play a URL as music, or stream a URL / music-folder file
 * as video. Conflicts use the global "Replace what is playing?" dialog.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VideoOptions } from '@/components/video/VideoOptions';
import { usePlayUrl, useStartVideoStream, useBotMedia, useQueueVideo } from '@/hooks/use-music-bots';
import { ApiErrorAlert } from '@/components/ApiErrorAlert';
import { useVideoStartOptions } from '@/hooks/use-video-streaming';
import { toastMediaStarted } from '@/lib/media-start-toast';
import { cn } from '@/lib/utils';
import {
  buildLinkStartRequest,
  musicPlayAllowed,
  queuedVideoToast,
  type LinkPlayMode,
} from './link-request';
import { AddMediaLink } from './AddMediaLink';
import type { ConsoleSourceContext } from './SourcePicker';

export function LinkSource({ botId, serverConfigId }: ConsoleSourceContext) {
  const { t } = useTranslation('bots');
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<LinkPlayMode>('music');
  const [options, setOptions, optionsLoading, defaults] = useVideoStartOptions(serverConfigId);
  const playUrl = usePlayUrl();
  const startVideo = useStartVideoStream();
  const queueVideo = useQueueVideo();
  const media = useBotMedia();

  const trimmed = input.trim();
  // Empty input keeps music selectable (default); only a non-URL value disables it.
  const allowMusic = !trimmed || musicPlayAllowed(input);
  const effectiveMode: LinkPlayMode = mode === 'music' && trimmed && !musicPlayAllowed(input) ? 'video' : mode;
  const session = media.data?.find((b) => b.botId === botId)?.session;
  // With a video already streaming on this bot, another video is queued behind it.
  const videoStreaming = session?.kind === 'video';
  const busy = playUrl.isPending || startVideo.isPending || queueVideo.isPending;
  const error = effectiveMode === 'video' ? startVideo.error ?? queueVideo.error : playUrl.error;
  const canStart = trimmed.length > 0 && !busy && !(effectiveMode === 'video' && optionsLoading);
  const action = effectiveMode !== 'video'
    ? { label: t('linkSource.playAsMusic'), failed: t('linkSource.playFailed') }
    : videoStreaming
      ? { label: t('linkSource.queueAsVideo'), failed: t('linkSource.queueFailed') }
      : { label: t('linkSource.streamAsVideo'), failed: t('linkSource.startFailed') };
  const busyLabel = queueVideo.isPending && videoStreaming ? t('linkSource.adding') : t('linkSource.starting');

  useEffect(() => {
    if (trimmed && !musicPlayAllowed(input) && mode === 'music') setMode('video');
  }, [input, trimmed, mode]);

  useEffect(() => {
    startVideo.reset();
    queueVideo.reset();
    playUrl.reset();
    // Drop leftover errors when the user changes mode or source text.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only on mode/source change
  }, [mode, trimmed]);

  const onStart = () => {
    if (!canStart) return;
    const request = buildLinkStartRequest(input, effectiveMode, options, videoStreaming);
    if (request.endpoint === 'stream/queue') {
      playUrl.reset();
      startVideo.reset();
      queueVideo.mutate(
        { botId, ...request.body },
        { onSuccess: (data) => toastMediaStarted(queuedVideoToast(data, t)) },
      );
      return;
    }
    queueVideo.reset();
    if (request.endpoint === 'play-url') {
      startVideo.reset();
      playUrl.mutate(
        { botId, url: request.body.url },
        { onSuccess: () => toastMediaStarted(t('linkSource.toasts.playingUrl')) },
      );
      return;
    }
    playUrl.reset();
    startVideo.mutate(
      { botId, ...request.body },
      {
        onSuccess: (data: { alreadyRunning?: boolean }) => {
          toastMediaStarted(data?.alreadyRunning ? t('linkSource.toasts.alreadyStreaming') : t('linkSource.toasts.streamStarted'));
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="console-link-input">{t('linkSource.inputLabel')}</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="console-link-input"
            className="h-11 min-w-0 flex-1 basis-48"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('linkSource.inputPlaceholder')}
            autoComplete="off"
          />
          <AddMediaLink to="/media-bots" label={t('linkSource.addFiles')} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t('linkSource.modeLegend')}</legend>
        <label
          className={cn(
            'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
            !allowMusic && 'cursor-not-allowed opacity-60',
            effectiveMode === 'music' && allowMusic ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
          )}
        >
          <input
            type="radio"
            name="console-link-mode"
            className="mt-0.5 h-4 w-4 shrink-0"
            value="music"
            checked={effectiveMode === 'music'}
            disabled={!allowMusic}
            aria-labelledby="console-link-music-label"
            aria-describedby="console-link-music-hint"
            onChange={() => setMode('music')}
          />
          <span className="min-w-0">
            <span id="console-link-music-label" className="block font-medium">{t('linkSource.playAsMusic')}</span>
            <span id="console-link-music-hint" className="block text-xs text-muted-foreground">{t('linkSource.playAsMusicHint')}</span>
          </span>
        </label>
        {!allowMusic && input.trim() && (
          <p className="px-1 text-xs text-muted-foreground">{t('linkSource.folderHint')}</p>
        )}
        <label
          className={cn(
            'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors',
            effectiveMode === 'video' ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
          )}
        >
          <input
            type="radio"
            name="console-link-mode"
            className="mt-0.5 h-4 w-4 shrink-0"
            value="video"
            checked={effectiveMode === 'video'}
            aria-labelledby="console-link-video-label"
            aria-describedby="console-link-video-hint"
            onChange={() => setMode('video')}
          />
          <span className="min-w-0">
            <span id="console-link-video-label" className="block font-medium">{t('linkSource.streamAsVideo')}</span>
            <span id="console-link-video-hint" className="block text-xs text-muted-foreground">{t('linkSource.streamAsVideoHint')}</span>
          </span>
        </label>
      </fieldset>

      {effectiveMode === 'video' && (
        <VideoOptions value={options} onChange={setOptions} defaults={defaults} />
      )}

      {error && (
        <ApiErrorAlert
          error={error}
          fallback={action.failed}
        />
      )}

      <Button type="button" className="h-11 w-full sm:w-auto" disabled={!canStart} onClick={onStart}>
        {busy ? busyLabel : action.label}
      </Button>
    </div>
  );
}
