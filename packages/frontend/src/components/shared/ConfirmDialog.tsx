import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  loading?: boolean;
  error?: string;
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel, cancelLabel, destructive, onConfirm, loading, error,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const confirmText = confirmLabel ?? t('common:action.confirm');
  const cancelText = cancelLabel ?? t('common:action.cancel');
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!loading) onOpenChange(nextOpen); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? t('common:confirm.processing') : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
