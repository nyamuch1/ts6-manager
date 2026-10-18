/**
 * Admin allowlist of LAN hosts (Threadfin, xTeVe, TVHeadend, a router proxy …)
 * that IPTV playlists and channels may use. URLs typed in chat or the video
 * URL box stay blocked from private addresses regardless.
 */

import { useEffect, useRef, useState } from 'react';
import { Network } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useIptvNetworkSettings, useUpdateIptvNetworkSettings } from '@/hooks/use-iptv-network';
import { apiErrorMessage } from '@/lib/api-error';
import { parseHostLines } from '@/lib/iptv-network';

/** Header / empty-state control that opens the allowlist dialog. */
export function IptvLocalHostsTrigger({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation('media');
  const query = useIptvNetworkSettings(true);
  const count = query.data?.allowedLocalHosts.length ?? 0;

  return (
    <Button type="button" variant="outline" onClick={onClick} title={t('localHosts.tooltip')}>
      <Network className="h-4 w-4 mr-1.5" aria-hidden="true" />
      {t('localHosts.trigger')}
      {count > 0 && (
        <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-[10px]" aria-label={t('localHosts.countAria', { count })}>
          {count}
        </Badge>
      )}
    </Button>
  );
}

export function IptvLocalHostsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('media');
  const query = useIptvNetworkSettings(true);
  const update = useUpdateIptvNetworkSettings();
  const saved = query.data?.allowedLocalHosts ?? [];
  /** null = not loaded for this open cycle (avoids refetch clobbering dirty edits). */
  const [draft, setDraft] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setDraft(null);
      return;
    }
    // Capture the control that opened the dialog (header button or empty-state hint).
    if (document.activeElement instanceof HTMLElement) {
      returnFocusRef.current = document.activeElement;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !query.data || draft !== null) return;
    setDraft(query.data.allowedLocalHosts.join('\n'));
  }, [open, query.data, draft]);

  const draftText = draft ?? '';
  const hosts = parseHostLines(draftText);
  const dirty = draft !== null && hosts.join('\n') !== saved.join('\n');

  const save = () => {
    update.mutate(hosts, {
      onSuccess: (data) => {
        setDraft(data.allowedLocalHosts.join('\n'));
        toast.success(t(data.allowedLocalHosts.length
          ? 'localHosts.saved'
          : 'localHosts.cleared'));
      },
      onError: (e) => toast.error(apiErrorMessage(e, t('localHosts.saveFailed'))),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-4 w-4" aria-hidden="true" /> {t('localHosts.title')}
          </DialogTitle>
          <DialogDescription>
            {t('localHosts.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Label htmlFor="iptv-local-hosts">{t('localHosts.allowedHosts')}</Label>
          <Textarea
            id="iptv-local-hosts"
            rows={5}
            spellCheck={false}
            placeholder={'192.168.1.20\n192.168.1.0/24\nthreadfin.lan'}
            value={draftText}
            onChange={(e) => setDraft(e.target.value)}
            disabled={draft === null || !query.data}
          />
          <p className="text-xs text-muted-foreground">
            {t('localHosts.help')}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {dirty && (
            <Button type="button" variant="ghost" onClick={() => setDraft(saved.join('\n'))}>
              {t('localHosts.reset')}
            </Button>
          )}
          <Button type="button" onClick={save} disabled={draft === null || !query.data || !dirty || update.isPending}>
            {t(update.isPending ? 'localHosts.saving' : 'localHosts.saveHosts')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
