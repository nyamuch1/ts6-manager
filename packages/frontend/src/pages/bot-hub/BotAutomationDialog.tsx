import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_BOT_AUTOMATION_SETTINGS, type BotAutomationSettings, type MusicBotDetail, type PlaylistSummary, type RadioStationInfo } from '@ts6/common';
import { toast } from 'sonner';
import { musicBotsApi, playlistsApi, radioStationsApi } from '@/api/music.api';
import { apiErrorMessage } from '@/lib/api-error';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';

function validAutomationSettings(settings: BotAutomationSettings): boolean {
  return (!settings.enabled || !!settings.source) &&
    Number.isSafeInteger(settings.quietPeriodSeconds) && settings.quietPeriodSeconds >= 0 && settings.quietPeriodSeconds <= 86400 &&
    Number.isSafeInteger(settings.retryBaseSeconds) && settings.retryBaseSeconds >= 1 && settings.retryBaseSeconds <= 3600 &&
    Number.isSafeInteger(settings.retryMaxSeconds) && settings.retryMaxSeconds >= settings.retryBaseSeconds && settings.retryMaxSeconds <= 86400;
}

export function BotAutomationDialog({ botId, botName, onClose }: Readonly<{
  botId: number; botName: string; onClose: () => void;
}>) {
  const { t } = useTranslation('bots');
  const qc = useQueryClient();
  const bot = useQuery<MusicBotDetail>({ queryKey: ['music-bot', botId], queryFn: () => musicBotsApi.get(botId) });
  const [settings, setSettings] = useState<BotAutomationSettings>({ ...DEFAULT_BOT_AUTOMATION_SETTINGS });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (bot.data && !bot.isFetching && !loaded) {
      setSettings(bot.data.automationSettings ?? { ...DEFAULT_BOT_AUTOMATION_SETTINGS });
      setLoaded(true);
    }
  }, [bot.data, bot.isFetching, loaded]);
  const serverId = bot.data?.serverConfigId;
  const playlists = useQuery<PlaylistSummary[]>({
    queryKey: ['playlists', serverId], queryFn: () => playlistsApi.list(serverId), enabled: !!serverId,
  });
  const radio = useQuery<RadioStationInfo[]>({
    queryKey: ['radio-stations', serverId], queryFn: () => radioStationsApi.list(serverId!), enabled: !!serverId,
  });
  const save = useMutation({
    mutationFn: () => musicBotsApi.automation(botId, settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['music-bots'] });
      qc.invalidateQueries({ queryKey: ['music-bot', botId] });
      qc.invalidateQueries({ queryKey: ['bot-media'] });
      toast.success(t('automation.toasts.saved'));
      onClose();
    },
  });
  const valid = validAutomationSettings(settings);
  const sourceValue = settings.source ? `${settings.source.kind}:${settings.source.id}` : '';
  const playlistChoices = (playlists.data ?? []).filter((p) => p.serverConfigId == null || p.serverConfigId === serverId);
  const radioChoices = (radio.data ?? []).filter((r) => r.serverConfigId === serverId);
  const sourceMissing = !!settings.source && (settings.source.kind === 'playlist'
    ? !playlistChoices.some((p) => p.id === settings.source!.id)
    : !radioChoices.some((r) => r.id === settings.source!.id));

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('automation.title', { name: botName })}</DialogTitle>
          <DialogDescription>{t('automation.description')}</DialogDescription>
        </DialogHeader>
        {bot.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(bot.error, t('automation.loadError'))}</p>}
        {!bot.isError && !loaded && <p role="status">{t('automation.loading')}</p>}
        {!bot.isError && loaded && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (valid) save.mutate(); }}>
            <fieldset className="space-y-4" disabled={save.isPending}>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="automation-enabled">{t('automation.enable')}</Label>
                <Switch id="automation-enabled" checked={settings.enabled} onCheckedChange={(enabled) => setSettings({ ...settings, enabled })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="automation-source">{t('automation.savedSource')}</Label>
                <Select value={sourceValue || 'none'} disabled={save.isPending} onValueChange={(value) => {
                    const [kind, id] = value.split(':');
                    setSettings({ ...settings, source: kind === 'none' ? null : { kind: kind as 'playlist' | 'radio', id: Number(id) } });
                  }}>
                  <SelectTrigger id="automation-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('automation.chooseSource')}</SelectItem>
                    {sourceMissing && <SelectItem value={sourceValue}>{t('automation.sourceUnavailable')}</SelectItem>}
                    <SelectGroup>
                      <SelectLabel>{t('automation.playlists')}</SelectLabel>
                      {playlistChoices.map((p) => <SelectItem key={p.id} value={`playlist:${p.id}`}>{p.name}</SelectItem>)}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>{t('automation.radioStations')}</SelectLabel>
                      {radioChoices.map((r) => <SelectItem key={r.id} value={`radio:${r.id}`}>{r.name}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {(playlists.isError || radio.isError) && <p role="alert" className="text-xs text-destructive">{t('automation.sourcesLoadFailed')}</p>}
                {settings.enabled && !settings.source && <p className="text-xs text-muted-foreground">{t('automation.chooseSourceHint')}</p>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="automation-listeners">{t('automation.requireListener')}</Label>
                <Switch id="automation-listeners" checked={settings.requireListeners} onCheckedChange={(requireListeners) => setSettings({ ...settings, requireListeners })} />
              </div>
              <p className="text-xs text-muted-foreground">{t('automation.requireListenerHint')}</p>
              <div className="space-y-1.5">
                <Label htmlFor="automation-quiet">{t('automation.quietPeriod')}</Label>
                <Input id="automation-quiet" type="number" min={0} max={86400} step={1} value={Number.isFinite(settings.quietPeriodSeconds) ? settings.quietPeriodSeconds : ''}
                  onChange={(e) => setSettings({ ...settings, quietPeriodSeconds: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">{t('automation.quietPeriodHint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="automation-retry">{t('automation.firstRetry')}</Label>
                  <Input id="automation-retry" type="number" min={1} max={3600} step={1} value={Number.isFinite(settings.retryBaseSeconds) ? settings.retryBaseSeconds : ''}
                    onChange={(e) => setSettings({ ...settings, retryBaseSeconds: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="automation-retry-max">{t('automation.maxRetry')}</Label>
                  <Input id="automation-retry-max" type="number" min={settings.retryBaseSeconds || 1} max={86400} step={1} value={Number.isFinite(settings.retryMaxSeconds) ? settings.retryMaxSeconds : ''}
                    onChange={(e) => setSettings({ ...settings, retryMaxSeconds: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t('automation.retryHint')}</p>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="automation-presence">{t('automation.keepInChannel')}</Label>
                <Switch id="automation-presence" checked={settings.stayInChannel} onCheckedChange={(stayInChannel) => setSettings({ ...settings, stayInChannel })} />
              </div>
              <p className="text-xs text-muted-foreground">{t('automation.keepInChannelHint')}</p>
              {!bot.data?.autoStart && <p className="rounded-md bg-muted p-3 text-xs">{t('automation.autoStartHint')}</p>}
            </fieldset>
            {save.isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(save.error, t('automation.saveError'))}</p>}
            {save.isPending && <p role="status" className="text-sm text-muted-foreground">{t('automation.saving')}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={save.isPending} onClick={onClose}>{t('common:action.cancel')}</Button>
              <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? t('common:action.saving') : t('automation.save')}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
