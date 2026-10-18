/** Player widget URLs for one bot (channel description BBCode and JSON). */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { musicBotsApi } from '@/api/music.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiErrorMessage } from '@/lib/api-error';

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation('bots');
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="flex gap-1.5 mt-1">
        <Input readOnly aria-label={label} className="h-9 text-[11px] font-mono-data" value={value} />
        <Button variant="outline" size="sm" className="h-9 text-xs shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value).then(
              () => toast.success(t('widgetLink.copied')),
              () => toast.error(t('widgetLink.copyFailed')),
            );
          }}
        >{t('common:action.copy')}</Button>
      </div>
    </div>
  );
}

export function WidgetLinkDialog({ botId, botName, open, onOpenChange }: {
  botId: number;
  botName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('bots');
  const token = useQuery({
    queryKey: ['music-bot-widget-token', botId],
    queryFn: () => musicBotsApi.playerWidgetToken(botId) as Promise<{ token: string; jsonUrl: string; bbcodeUrl: string }>,
    enabled: open,
    staleTime: Infinity,
    retry: false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('widgetLink.title', { name: botName })}</DialogTitle>
          <DialogDescription className="text-xs">
            {t('widgetLink.description')}
          </DialogDescription>
        </DialogHeader>
        {token.isLoading && <p className="text-xs text-muted-foreground">{t('widgetLink.loading')}</p>}
        {token.isError && (
          <div className="space-y-2">
            <p role="alert" className="text-xs text-destructive">{apiErrorMessage(token.error, t('widgetLink.loadError'))}</p>
            <Button size="sm" variant="outline" onClick={() => { void token.refetch(); }} disabled={token.isFetching}>{t('common:action.retry')}</Button>
          </div>
        )}
        {token.data && (
          <div className="space-y-3">
            <CopyRow label={t('widgetLink.bbcodeLabel')} value={token.data.bbcodeUrl} />
            <CopyRow label={t('widgetLink.jsonLabel')} value={token.data.jsonUrl} />
            <div>
              <Label className="text-[10px] text-muted-foreground">{t('widgetLink.token')}</Label>
              <Input readOnly aria-label={t('widgetLink.tokenAria')} className="h-9 text-[11px] font-mono-data mt-1" value={token.data.token} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
