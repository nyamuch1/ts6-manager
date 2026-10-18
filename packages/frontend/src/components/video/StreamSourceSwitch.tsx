/** Change a live video stream's source without stopping the stream. */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSetStreamSource, useVideoStreamStatus } from '@/hooks/use-music-bots';
import { apiErrorMessage } from '@/lib/api-error';

export function StreamSourceSwitch({ botId }: { botId: number }) {
  const { t } = useTranslation('media');
  const { data: streamStatus } = useVideoStreamStatus(botId);
  const setSource = useSetStreamSource();
  const [source, setSourceInput] = useState('');
  const trimmed = source.trim();

  if (!streamStatus?.streaming) return null;

  const onSwitch = () => {
    if (!trimmed || setSource.isPending) return;
    setSource.mutate({ botId, source: trimmed }, {
      onSuccess: () => { toast.success(t('sourceSwitch.switched')); setSourceInput(''); },
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('sourceSwitch.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor={`stream-source-${botId}`}>{t('sourceSwitch.newSource')}</Label>
        <div className="flex gap-2">
          <Input
            id={`stream-source-${botId}`}
            className="h-10"
            value={source}
            onChange={(event) => setSourceInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') onSwitch(); }}
            placeholder={t('sourceSwitch.placeholder')}
          />
          <Button variant="outline" className="h-10 shrink-0" disabled={!trimmed || setSource.isPending} onClick={onSwitch}>
            {t('sourceSwitch.switch')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('sourceSwitch.help')}
        </p>
        {setSource.error && (
          <p role="alert" className="text-sm text-destructive">{apiErrorMessage(setSource.error, t('sourceSwitch.failed'))}</p>
        )}
      </CardContent>
    </Card>
  );
}
