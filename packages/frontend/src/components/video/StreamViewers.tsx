/** Who is watching a bot's video stream, with a Kick action per viewer. */

import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useKickVideoViewer, useVideoStreamStatus } from '@/hooks/use-music-bots';
import { apiErrorMessage } from '@/lib/api-error';
import i18n from '@/i18n';

function watchedFor(joinedAt: number, now: number): string {
  const duration = Math.max(0, Math.floor((now - joinedAt) / 1000));
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;
  return mins > 0
    ? i18n.t('media:videoViewers.watchedMinutesSeconds', { minutes: mins, seconds: secs })
    : i18n.t('media:videoViewers.watchedSeconds', { seconds: secs });
}

export function StreamViewers({ botId, now }: { botId: number; now: number }) {
  const { t } = useTranslation('media');
  const { data: streamStatus } = useVideoStreamStatus(botId);
  const kickViewer = useKickVideoViewer();

  if (!streamStatus?.streaming) return null;
  const viewers: Array<{ clid: number; joinedAt: number; iceState?: string }> = streamStatus.viewers ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('videoViewers.title', { count: streamStatus.viewerCount })}</CardTitle>
      </CardHeader>
      <CardContent>
        {viewers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('videoViewers.none')}</p>
        ) : (
          <ul className="space-y-2">
            {viewers.map((viewer) => (
              <li key={viewer.clid} className="flex items-center justify-between rounded bg-muted/50 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${viewer.iceState === 'connected' ? 'bg-green-500' : 'bg-yellow-500'}`} aria-hidden="true" />
                  <span className="text-sm">{t('videoViewers.client', { clid: viewer.clid })}</span>
                  <span className="text-xs text-muted-foreground">{watchedFor(viewer.joinedAt, now)}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-red-500 hover:text-red-400"
                  aria-label={t('videoViewers.kickAria', { clid: viewer.clid })}
                  disabled={kickViewer.isPending}
                  onClick={() => kickViewer.mutate({ botId, clid: viewer.clid }, {
                    onError: (err) => toast.error(apiErrorMessage(err, t('videoViewers.kickFailed'))),
                  })}
                >
                  {t('videoViewers.kick')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
