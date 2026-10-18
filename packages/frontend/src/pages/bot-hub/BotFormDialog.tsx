/**
 * New bot / Edit bot dialog, shared by the Bot Hub and each bot's console.
 * Moved from the old Media Bots → Bots tab with the same fields and rules.
 */

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MusicBotSummary } from '@ts6/common';
import { musicBotsApi } from '@/api/music.api';
import { useCreateMusicBot, useUpdateMusicBot } from '@/hooks/use-music-bots';
import { useServers } from '@/hooks/use-servers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BotAvatarSettings } from '@/pages/media-bots/BotAvatarSettings';

/** TeamSpeak refuses a nickname outside these lengths (error 1541); the bot name is its nickname. */
const MIN_BOT_NICKNAME_LENGTH = 3;

const MAX_BOT_NICKNAME_LENGTH = 30;

function isBotNicknameLengthOk(name: string): boolean {
  const length = name.trim().length;
  return length >= MIN_BOT_NICKNAME_LENGTH && length <= MAX_BOT_NICKNAME_LENGTH;
}

/** Create can succeed server-side while the browser sees timeout / proxy 499. */
function isMusicBotCreateTransportFailure(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  if (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') return true;
  const status = err.response?.status;
  if (status === 499 || status === 408 || status === 504) return true;
  // Aborted before a status body (nginx 499 often surfaces as network error)
  if (!err.response) return true;
  return false;
}

interface BotForm {
  name: string;
  serverConfigId: string;
  serverPassword: string;
  defaultChannel: string;
  commandChannelsText: string;
  virtualServerId: number;
  channelPassword: string;
  voicePort: number;
  volume: number;
  /** Empty means inherit the instance default. */
  language: 'en' | 'zh-CN' | '';
  autoStart: boolean;
}

const EMPTY_FORM: BotForm = {
  name: '',
  serverConfigId: '',
  serverPassword: '',
  defaultChannel: '',
  commandChannelsText: '',
  virtualServerId: 1,
  channelPassword: '',
  voicePort: 9987,
  volume: 50,
  language: '',
  autoStart: false,
};

function formFor(bot: MusicBotSummary): BotForm {
  return {
    name: bot.name,
    serverConfigId: String(bot.serverConfigId),
    serverPassword: bot.serverPassword || '',
    defaultChannel: bot.defaultChannel || '',
    commandChannelsText: (bot.commandChannelIds ?? []).join(', '),
    virtualServerId: bot.virtualServerId ?? 1,
    channelPassword: bot.channelPassword || '',
    voicePort: bot.voicePort ?? 9987,
    volume: bot.volume,
    language: bot.language ?? '',
    autoStart: bot.autoStart,
  };
}

const parseCommandChannelsInput = (text: string): string[] =>
  text
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));

/** `bot` set = edit that bot; null = create a new one. */
export function BotFormDialog({ open, bot, onClose, defaultServerId }: {
  open: boolean;
  bot: MusicBotSummary | null;
  onClose: () => void;
  /** Pre-selected server for a new bot (usually the header's selection). */
  defaultServerId?: number | null;
}) {
  const { t } = useTranslation('bots');
  const queryClient = useQueryClient();
  const { data: servers } = useServers();
  const serverList = Array.isArray(servers) ? servers : [];
  const createBot = useCreateMusicBot();
  const updateBot = useUpdateMusicBot();
  const [form, setForm] = useState<BotForm>(EMPTY_FORM);

  // Reset the form when the dialog opens or switches bot. The bot list polls,
  // so a new `bot` object for the same bot must not wipe what is being typed.
  const botRef = useRef(bot);
  botRef.current = bot;
  const defaultServerRef = useRef(defaultServerId);
  defaultServerRef.current = defaultServerId;
  const botId = bot?.id ?? null;
  useEffect(() => {
    if (!open) return;
    const current = botRef.current;
    if (current) setForm(formFor(current));
    else setForm({ ...EMPTY_FORM, serverConfigId: defaultServerRef.current ? String(defaultServerRef.current) : '' });
  }, [open, botId]);

  // A saved bot can predate the limit, so its name may already be too long.
  const nameLengthError = form.name !== '' && !isBotNicknameLengthOk(form.name);

  const handleCreate = async () => {
    const configId = parseInt(form.serverConfigId);
    if (!configId) { toast.error(t('form.toasts.selectServer')); return; }
    const createdName = form.name;
    // Bots that exist before this create, to recognise ours if the response is lost.
    let known = queryClient.getQueryData<MusicBotSummary[]>(['music-bots']);
    if (!Array.isArray(known)) {
      try {
        known = await queryClient.fetchQuery({ queryKey: ['music-bots'], queryFn: musicBotsApi.list });
      } catch {
        known = undefined;
      }
    }
    const knownIds = new Set((Array.isArray(known) ? known : []).map((b) => b.id));
    createBot.mutate({
      name: createdName,
      serverConfigId: configId,
      nickname: form.name.trim() || 'MediaBot',
      serverPassword: form.serverPassword || undefined,
      defaultChannel: form.defaultChannel || undefined,
      // Empty = same-channel voice cmds + SSH roaming helper (no create-time pin).
      virtualServerId: form.virtualServerId,
      channelPassword: form.channelPassword || undefined,
      voicePort: form.voicePort,
      volume: form.volume,
      language: form.language || null,
      autoStart: form.autoStart,
    }, {
      onSuccess: () => { toast.success(t('form.toasts.created')); void queryClient.invalidateQueries({ queryKey: ['bot-media'] }); onClose(); },
      onError: async (err) => {
        // Proxy/client often abort (499 / timeout) while the bot row already exists.
        if (isMusicBotCreateTransportFailure(err)) {
          try {
            const list = await queryClient.fetchQuery({
              queryKey: ['music-bots'],
              queryFn: musicBotsApi.list,
            });
            const latest = Array.isArray(list) ? list : [];
            const appeared = latest.some(
              (b: MusicBotSummary) => b.name === createdName && !knownIds.has(b.id),
            );
            if (appeared) {
              toast.success(t('form.toasts.created'));
              void queryClient.invalidateQueries({ queryKey: ['bot-media'] });
              onClose();
              return;
            }
          } catch {
            // fall through to failure toast
          }
        }
        toast.error(t('form.toasts.createFailed'));
      },
    });
  };

  const handleUpdate = () => {
    if (!bot) return;
    updateBot.mutate({ id: bot.id, data: {
      name: form.name,
      nickname: form.name.trim(),
      serverPassword: form.serverPassword || undefined,
      defaultChannel: form.defaultChannel || undefined,
      commandChannelIds: parseCommandChannelsInput(form.commandChannelsText),
      virtualServerId: form.virtualServerId,
      channelPassword: form.channelPassword || undefined,
      voicePort: form.voicePort,
      volume: form.volume,
      language: form.language || null,
      autoStart: form.autoStart,
    }}, {
      onSuccess: () => { toast.success(t('form.toasts.updated')); void queryClient.invalidateQueries({ queryKey: ['bot-media'] }); onClose(); },
      onError: () => toast.error(t('form.toasts.updateFailed')),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{bot ? t('form.editTitle') : t('form.newTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t('form.name')}</Label>
            <Input type="text" aria-label={t('form.nameAria')} aria-required="true" aria-invalid={nameLengthError} aria-describedby="bot-nickname-hint" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('form.namePlaceholder')} maxLength={MAX_BOT_NICKNAME_LENGTH} />
            <p id="bot-nickname-hint" className={`text-[10px] mt-1 ${nameLengthError ? 'text-destructive' : 'text-muted-foreground'}`}>
              {nameLengthError
                ? t('form.nicknameHintWithLength', { min: MIN_BOT_NICKNAME_LENGTH, max: MAX_BOT_NICKNAME_LENGTH, length: form.name.trim().length })
                : t('form.nicknameHint', { min: MIN_BOT_NICKNAME_LENGTH, max: MAX_BOT_NICKNAME_LENGTH })}
            </p>
          </div>
          {!bot && (
            <div>
              <Label className="text-xs">{t('form.server')}</Label>
              <Select value={form.serverConfigId} onValueChange={(v) => setForm({ ...form, serverConfigId: v })}>
                <SelectTrigger aria-label={t('form.server')}><SelectValue placeholder={t('form.selectServer')} /></SelectTrigger>
                <SelectContent>
                  {serverList.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.host})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">{t('form.voicePort')}</Label>
            <Input type="number" value={form.voicePort} onChange={(e) => setForm({ ...form, voicePort: parseInt(e.target.value) || 9987 })} placeholder="9987" />
          </div>
          <div>
            <Label className="text-xs">{t('form.serverPassword')}</Label>
            <Input type="password" value={form.serverPassword} onChange={(e) => setForm({ ...form, serverPassword: e.target.value })} placeholder={t('form.leaveEmptyNone')} />
          </div>
          <div>
            <Label className="text-xs">{t('form.defaultChannel')}</Label>
            <Input value={form.defaultChannel} onChange={(e) => setForm({ ...form, defaultChannel: e.target.value })} placeholder={t('form.defaultChannelPlaceholder')} />
          </div>
          {bot && (
            <div>
              <Label className="text-xs">{t('form.commandChannels')}</Label>
              <Input
                value={form.commandChannelsText}
                onChange={(e) => setForm({ ...form, commandChannelsText: e.target.value })}
                placeholder={t('form.commandChannelsPlaceholder')}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {t('form.commandChannelsHint')}
              </p>
            </div>
          )}
          <div>
            <Label className="text-xs">{t('form.virtualServerId')}</Label>
            <Input
              type="number"
              min={1}
              value={form.virtualServerId}
              onChange={(e) => setForm({ ...form, virtualServerId: parseInt(e.target.value, 10) || 1 })}
            />
          </div>
          <div>
            <Label className="text-xs">{t('form.channelPassword')}</Label>
            <Input type="password" value={form.channelPassword} onChange={(e) => setForm({ ...form, channelPassword: e.target.value })} placeholder={t('form.leaveEmptyNone')} />
          </div>
          <div>
            <Label className="text-xs">{t('form.volume', { percent: form.volume })}</Label>
            <Slider value={[form.volume]} max={100} step={1} onValueChange={([v]) => setForm({ ...form, volume: v })} />
          </div>
          <div>
            <Label className="text-xs">{t('form.chatLanguage')}</Label>
            <Select
              value={form.language || 'default'}
              onValueChange={(v) => setForm({ ...form, language: v === 'default' ? '' : v as 'en' | 'zh-CN' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">{t('form.languageDefault')}</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh-CN">简体中文</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">{t('form.chatLanguageHint')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.autoStart} onCheckedChange={(v) => setForm({ ...form, autoStart: v })} />
            <Label className="text-xs">{t('form.autoStart')}</Label>
          </div>
          {bot && <BotAvatarSettings key={bot.id} bot={bot} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common:action.cancel')}</Button>
          <Button onClick={() => { if (bot) handleUpdate(); else void handleCreate(); }} disabled={!isBotNicknameLengthOk(form.name) || (!bot && !form.serverConfigId) || createBot.isPending || updateBot.isPending}>
            {bot ? t('common:action.save') : t('common:action.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
