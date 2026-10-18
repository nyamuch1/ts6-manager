import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MusicBotSummary } from '@ts6/common';
import { Button } from '@/components/ui/button';
import { BotAvatar } from '@/components/shared/BotAvatar';
import { useSetBotAvatarMode, useUploadBotAvatar } from '@/hooks/use-music-bots';
import { apiErrorMessage } from '@/lib/api-error';

export function BotAvatarSettings({ bot }: { bot: MusicBotSummary }) {
  const { t } = useTranslation('media');
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadBotAvatar();
  const setMode = useSetBotAvatarMode();
  const pending = upload.isPending || setMode.isPending;
  const error = upload.error ?? setMode.error;
  return (
    <section aria-labelledby={`avatar-settings-${bot.id}`} className="space-y-3 rounded-md border p-3">
      <h3 id={`avatar-settings-${bot.id}`} className="text-sm font-medium">{t('avatar.title')}</h3>
      <div className="flex items-center gap-3">
        <BotAvatar botId={bot.id} name={bot.name} mode={bot.avatarMode} md5={bot.avatarMd5} className="h-16 w-16" />
        <p className="text-xs text-muted-foreground">{t('avatar.formats')}</p>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/gif" aria-label={t('avatar.uploadAria')}
        className="hidden" disabled={pending} onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setMode.reset();
          upload.mutate({ botId: bot.id, file });
        }} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => input.current?.click()}>{t('avatar.upload')}</Button>
        <Button type="button" variant={bot.avatarMode === 'default' ? 'secondary' : 'outline'} className="h-11"
          aria-pressed={bot.avatarMode === 'default'} disabled={pending} onClick={() => {
            upload.reset();
            setMode.mutate({ botId: bot.id, mode: 'default' });
          }}>{t('avatar.useDefault')}</Button>
        <Button type="button" variant={bot.avatarMode === 'none' ? 'secondary' : 'outline'} className="h-11"
          aria-pressed={bot.avatarMode === 'none'} disabled={pending} onClick={() => {
            upload.reset();
            setMode.mutate({ botId: bot.id, mode: 'none' });
          }}>{t('avatar.none')}</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{apiErrorMessage(error, t('avatar.updateFailed'))}</p>}
      {bot.avatarError && <p role="alert" className="text-xs text-destructive">{bot.avatarError}</p>}
    </section>
  );
}
