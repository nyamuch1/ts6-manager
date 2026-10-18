/**
 * Per-bot settings menu (Bot Hub cards and the console header): edit,
 * start or stop the bot, widget link, delete.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link2, MoreHorizontal, Pencil, Power, PowerOff, Radio, Trash2 } from 'lucide-react';
import type { MusicBotSummary } from '@ts6/common';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { musicBotsApi } from '@/api/music.api';
import { useDeleteMusicBot, useStartMusicBot, useStopMusicBot } from '@/hooks/use-music-bots';
import { apiErrorMessage } from '@/lib/api-error';
import { BotFormDialog } from './BotFormDialog';
import { WidgetLinkDialog } from './WidgetLinkDialog';
import { BotAutomationDialog } from './BotAutomationDialog';

/** A bot counts as running unless it is stopped or failed. */
export function isBotRunning(status: string): boolean {
  return status !== 'stopped' && status !== 'error';
}

export function BotSettingsMenu({ botId, botName, status, onDeleted, size = 'sm' }: {
  botId: number;
  botName: string;
  status: string;
  onDeleted?: () => void;
  size?: 'sm' | 'default';
}) {
  const { t } = useTranslation('bots');
  const [editOpen, setEditOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  // Full settings are only needed for Edit; no extra polling on the hub.
  const bots = useQuery({ queryKey: ['music-bots'], queryFn: musicBotsApi.list, enabled: editOpen });
  const summary = (Array.isArray(bots.data) ? bots.data as MusicBotSummary[] : []).find((b) => b.id === botId) ?? null;
  const startBot = useStartMusicBot();
  const stopBot = useStopMusicBot();
  const queryClient = useQueryClient();
  const homeBot = useMutation({
    mutationFn: () => musicBotsApi.home(botId),
    onSuccess: () => {
      toast.success(t('settingsMenu.toasts.returnedHome'));
      void queryClient.invalidateQueries({ queryKey: ['bot-media'] });
      void queryClient.invalidateQueries({ queryKey: ['music-bots'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('settingsMenu.toasts.returnHomeFailed'))),
  });
  const deleteBot = useDeleteMusicBot();
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const running = isBotRunning(status);

  // Close Edit when its settings cannot load, so a later list update cannot open it unasked.
  useEffect(() => {
    if (!editOpen || bots.isFetching) return;
    if (bots.isError) {
      toast.error(apiErrorMessage(bots.error, t('settingsMenu.toasts.loadSettingsFailed')));
      setEditOpen(false);
    } else if (bots.isSuccess && !summary) {
      toast.error(t('settingsMenu.toasts.noLongerExists', { name: botName }));
      setEditOpen(false);
    }
  }, [editOpen, bots.isError, bots.isSuccess, bots.isFetching, bots.error, summary, botName, t]);

  return (
    <>
      {/* Non-modal so the dialogs it opens keep pointer events. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size === 'sm' ? 'icon' : 'default'} className={size === 'sm' ? 'h-9 w-9' : 'h-10'}
            aria-label={t('settingsMenu.aria', { name: botName })}>
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            {size !== 'sm' && <span className="ml-1.5">{t('settingsMenu.label')}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> {t('settingsMenu.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAutomationOpen(true)}>
            <Radio className="mr-2 h-4 w-4" aria-hidden="true" /> {t('settingsMenu.automation')}
          </DropdownMenuItem>
          {running ? (
            <DropdownMenuItem disabled={stopBot.isPending} onSelect={() => stopBot.mutate(botId, {
              onSuccess: () => toast.success(t('settingsMenu.toasts.stopped')),
              onError: (err) => toast.error(apiErrorMessage(err, t('settingsMenu.toasts.stopFailed'))),
            })}>
              <PowerOff className="mr-2 h-4 w-4" aria-hidden="true" /> {t('settingsMenu.stop')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={startBot.isPending} onSelect={() => startBot.mutate(botId, {
              onSuccess: () => toast.success(t('settingsMenu.toasts.started')),
              onError: (err) => toast.error(apiErrorMessage(err, t('settingsMenu.toasts.startFailed'))),
            })}>
              <Power className="mr-2 h-4 w-4" aria-hidden="true" /> {t('settingsMenu.start')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setWidgetOpen(true)}>
            <Link2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t('settingsMenu.widgetLink')}
          </DropdownMenuItem>
          {running && <DropdownMenuItem disabled={homeBot.isPending} onSelect={() => homeBot.mutate()}>
            {t('settingsMenu.returnHome')}
          </DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t('settingsMenu.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BotFormDialog open={editOpen && !!summary} bot={summary} onClose={() => setEditOpen(false)} />
      {automationOpen && <BotAutomationDialog botId={botId} botName={botName} onClose={() => setAutomationOpen(false)} />}
      <WidgetLinkDialog botId={botId} botName={botName} open={widgetOpen} onOpenChange={setWidgetOpen} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('settingsMenu.deleteDialog.title', { name: botName })}
        description={t('settingsMenu.deleteDialog.description')}
        confirmLabel={t('common:action.delete')}
        loading={deleteBot.isPending}
        onConfirm={() => {
          deleteBot.mutate(botId, {
            onSuccess: () => {
              toast.success(t('settingsMenu.toasts.deleted'));
              setDeleteOpen(false);
              onDeleted?.();
            },
            onError: (err) => toast.error(apiErrorMessage(err, t('settingsMenu.toasts.deleteFailed'))),
          });
        }}
        destructive
      />
    </>
  );
}
