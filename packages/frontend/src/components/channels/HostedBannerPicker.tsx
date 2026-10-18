import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { HostedChannelBanner } from '@ts6/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useChannelBanners, useDeleteChannelBanner, useUpdatePublicUrl, useUploadChannelBanner } from '@/hooks/use-channel-banners';
import { apiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import { Check, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/api/client';

/**
 * Where this browser reaches the manager: the address the API client uses,
 * minus its `/api` suffix, so a path prefix in front of the API is kept.
 */
function suggestedPublicUrl(): string {
  if (typeof window === 'undefined') return '';
  const apiBase = new URL(api.defaults.baseURL ?? '/api', window.location.href);
  return `${apiBase.origin}${apiBase.pathname.replace(/\/+$/, '').replace(/\/api$/, '')}`;
}

/**
 * Upload channel banners to this manager and pick one; the chosen banner's
 * public link becomes the channel's banner image URL.
 */
export function HostedBannerPicker({ value, onSelect }: { value: string; onSelect: (url: string) => void }) {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const banners = useChannelBanners(true);
  const upload = useUploadChannelBanner();
  const remove = useDeleteChannelBanner();
  const savePublicUrl = useUpdatePublicUrl();
  const [editingUrl, setEditingUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HostedChannelBanner | null>(null);

  const data = banners.data;
  const publicUrl = data?.publicUrl ?? null;
  // The address only matters once there is an uploaded image to link to.
  const showUrlForm = !!data && (editingUrl !== null || (!publicUrl && data.banners.length > 0));
  const urlDraft = editingUrl ?? suggestedPublicUrl();
  const maxMb = data ? Math.round(data.maxBytes / (1024 * 1024)) : 5;

  const handleSaveUrl = () => {
    // Keep a selected hosted banner pointing at the new address; leave other URLs alone.
    const selected = data?.banners.find((banner) => !!banner.url && banner.url === value);
    savePublicUrl.mutate(urlDraft, {
      onSuccess: (settings) => {
        if (selected && settings.effective && valueRef.current === selected.url) onSelect(`${settings.effective}${selected.path}`);
        setEditingUrl(null);
        toast.success(urlDraft.trim() ? t('hostedBanner.publicUrlSaved') : t('hostedBanner.publicUrlCleared'));
      },
    });
  };

  return (
    <section aria-label={t('hostedBanner.sectionLabel')} className="mt-2 space-y-2 rounded-md border p-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium">{t('hostedBanner.title')}</p>
          <p className="text-[10px] text-muted-foreground">{t('hostedBanner.intro')}</p>
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" aria-label={t('hostedBanner.uploadAria')}
          className="hidden" disabled={upload.isPending} onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            upload.mutate(file, {
              onSuccess: (banner) => {
                if (banner.url) onSelect(banner.url);
                toast.success(banner.url ? t('hostedBanner.uploadedSelected') : t('hostedBanner.uploaded'));
              },
            });
          }} />
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={upload.isPending || !data}
          onClick={() => input.current?.click()}>
          {upload.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
          {t('hostedBanner.uploadButton')}
        </Button>
      </div>

      {banners.isLoading && <p className="text-[10px] text-muted-foreground">{t('hostedBanner.loading')}</p>}
      {banners.error && <p role="alert" className="text-[10px] text-destructive">{apiErrorMessage(banners.error, t('hostedBanner.loadFailed'))}</p>}

      {data && showUrlForm && (
        <div className="space-y-1">
          <p className="text-xs font-medium">{t('hostedBanner.publicUrlTitle')}</p>
          <p className="text-[10px] text-muted-foreground">
            {data.publicUrlSource === 'setting' ? t('hostedBanner.publicUrlHelpWithClear') : t('hostedBanner.publicUrlHelp')}
          </p>
          <div className="flex gap-2">
            <Input aria-label={t('hostedBanner.publicUrlAria')} className="h-8 text-xs" value={urlDraft} placeholder="https://ts6.example.com"
              onChange={(e) => setEditingUrl(e.target.value)} />
            <Button type="button" size="sm" className="h-8 text-xs" disabled={savePublicUrl.isPending || (!urlDraft.trim() && data.publicUrlSource !== 'setting')} onClick={handleSaveUrl}>{tc('action.save')}</Button>
            {publicUrl && <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingUrl(null)}>{tc('action.cancel')}</Button>}
          </div>
          {savePublicUrl.error && <p role="alert" className="text-[10px] text-destructive">{apiErrorMessage(savePublicUrl.error, t('hostedBanner.saveFailed'))}</p>}
        </div>
      )}
      {data && !showUrlForm && publicUrl && (
        <p className="text-[10px] text-muted-foreground">
          <Trans
            i18nKey="admin:hostedBanner.servedFrom"
            values={{ url: publicUrl, suffix: data.publicUrlSource === 'env' ? ' (PUBLIC_URL)' : '' }}
            components={{
              url: <span className="font-mono break-all" />,
              change: <button type="button" className="underline underline-offset-2" onClick={() => setEditingUrl(publicUrl)} />,
            }}
          />
        </p>
      )}

      {data && data.banners.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.banners.map((banner) => {
            const selected = !!banner.url && banner.url === value;
            return (
              <li key={banner.name} className="relative">
                <button type="button" disabled={!banner.url} aria-pressed={selected}
                  aria-label={selected ? t('hostedBanner.selectedBanner') : t('hostedBanner.useBanner')}
                  title={banner.url ? t('hostedBanner.useBannerTitle') : t('hostedBanner.saveUrlFirst')}
                  onClick={() => banner.url && onSelect(banner.url)}
                  className={cn('block w-full overflow-hidden rounded border bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60',
                    selected ? 'ring-2 ring-primary' : 'hover:border-primary/60')}>
                  <img src={banner.path} alt="" loading="lazy" className="h-14 w-full object-cover" />
                  {selected && <Check className="absolute left-1 top-1 h-4 w-4 rounded-full bg-primary p-0.5 text-primary-foreground" />}
                </button>
                <Button type="button" size="icon" variant="ghost" aria-label={t('hostedBanner.deleteBanner')} title={t('hostedBanner.deleteBanner')}
                  className="absolute right-0.5 top-0.5 h-6 w-6 bg-background/80 hover:bg-background"
                  onClick={() => { remove.reset(); setDeleteTarget(banner); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[10px] text-muted-foreground">{t('hostedBanner.formatHint', { count: maxMb })}</p>
      {upload.error && <p role="alert" className="text-[10px] text-destructive">{apiErrorMessage(upload.error, t('hostedBanner.uploadFailed'))}</p>}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title={t('hostedBanner.deleteBanner')}
        description={t('hostedBanner.deleteDescription')}
        confirmLabel={tc('action.delete')}
        destructive
        loading={remove.isPending}
        error={remove.error ? apiErrorMessage(remove.error, t('hostedBanner.deleteFailed')) : undefined}
        onConfirm={() => {
          if (!deleteTarget) return;
          const target = deleteTarget;
          remove.mutate(target.name, {
            onSuccess: () => {
              if (target.url && target.url === value) onSelect('');
              setDeleteTarget(null);
              toast.success(t('hostedBanner.deleted'));
            },
          });
        }}
      />
    </section>
  );
}
