import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMediaSwitchStore } from '@/stores/media-switch.store';
import { conflictIsReplaceable, describeMediaSession } from '@/lib/media-switch';

/** Global confirmation for replacing an active media session (music ↔ video). */
export function MediaSwitchDialog() {
  const { t } = useTranslation('media');
  const pending = useMediaSwitchStore((s) => s.pending);
  const answer = useMediaSwitchStore((s) => s.answer);
  if (!pending) return null;

  const { conflict } = pending;
  const replaceable = conflictIsReplaceable(conflict);
  const target = t(conflict.requested === 'video' ? 'mediaSwitch.targetVideo' : 'mediaSwitch.targetMusic');

  return (
    <Dialog open onOpenChange={(open) => { if (!open) answer(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
            {t(replaceable ? 'mediaSwitch.replaceTitle' : 'mediaSwitch.startingTitle')}
          </DialogTitle>
          <DialogDescription>
            {replaceable
              ? t('mediaSwitch.replaceDescription', { target })
              : t('mediaSwitch.startingDescription')}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 text-sm">
          {conflict.conflicts.map((c) => (
            <li key={c.id} className="rounded bg-muted/50 px-3 py-2">{describeMediaSession(c)}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={() => answer(false)}>
            {t(replaceable ? 'mediaSwitch.keepPlaying' : 'mediaSwitch.ok')}
          </Button>
          {replaceable && (
            <Button variant="destructive" onClick={() => answer(true)}>
              {t('mediaSwitch.stopAndSwitch')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
