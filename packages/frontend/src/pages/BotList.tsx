import { useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBots, useCreateBot, useToggleBot } from '@/hooks/use-bots';
import { useServerStore } from '@/stores/server.store';
import { botsApi } from '@/api/bots.api';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { CONNECTION_SETUP_PATH, ConnectionRequiredNotice, useConnectionAvailability } from '@/components/shared/NoServerSelectedState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Pencil, Trash2, Play, Clock, AlertTriangle, LayoutTemplate } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TemplateGallery } from '@/components/bots/TemplateGallery';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { timeAgo } from '@/lib/utils';
import { CommandsTab } from '@/pages/media-bots/CommandsTab';
import { MediaCommandPermissions } from '@/components/bots/MediaCommandPermissions';

/** Render Bot Flows and its server-scoped Chat commands tab. */
export default function BotList() {
  const { t } = useTranslation('bots');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { selectedConfigId, selectedSid } = useServerStore();
  const { data, isLoading } = useBots();
  const createBot = useCreateBot();
  const toggleBot = useToggleBot();
  const deleteBot = useMutation({ mutationFn: (id: number) => botsApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['bots'] }) });

  const [showCreate, setShowCreate] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const flowsTabRef = useRef<HTMLButtonElement>(null);
  const chatCommandsTabRef = useRef<HTMLButtonElement>(null);

  const bots = Array.isArray(data) ? data : [];
  const { isPending: connectionsPending, hasNoConnections } = useConnectionAvailability();
  const createBlocked = connectionsPending || hasNoConnections;

  if (isLoading) return <PageLoader />;

  const handleCreate = () => {
    if (!selectedConfigId) {
      toast.error(t('list.toasts.selectServer'));
      return;
    }
    createBot.mutate({ name: newName, description: newDesc, serverConfigId: selectedConfigId, virtualServerId: selectedSid || 1, flowData: { nodes: [], edges: [] } }, {
      onSuccess: (bot: any) => { toast.success(t('list.toasts.created')); setShowCreate(false); setNewName(''); setNewDesc(''); navigate(`/bots/${bot.id}`); },
      onError: () => toast.error(t('list.toasts.createFailed')),
    });
  };

  const commandsTab = searchParams.get('tab') === 'commands';
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextCommands = !commandsTab;
    setSearchParams(nextCommands ? { tab: 'commands' } : {});
    (nextCommands ? chatCommandsTabRef : flowsTabRef).current?.focus();
  };
  const tabLinks = (
    <div className="flex gap-1 border-b" role="tablist" aria-label={t('list.tabsAria')}>
      <button
        type="button"
        role="tab"
        id="bot-flows-tab"
        ref={flowsTabRef}
        aria-controls="bot-flows-panel"
        aria-selected={!commandsTab}
        tabIndex={commandsTab ? -1 : 0}
        onKeyDown={handleTabKeyDown}
        className={`border-b-2 px-3 py-2 text-sm ${!commandsTab ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
        onClick={() => setSearchParams({})}
      >{t('list.tabs.flows')}</button>
      <button
        type="button"
        role="tab"
        id="bot-chat-commands-tab"
        ref={chatCommandsTabRef}
        aria-controls="bot-chat-commands-panel"
        aria-selected={commandsTab}
        tabIndex={commandsTab ? 0 : -1}
        onKeyDown={handleTabKeyDown}
        className={`border-b-2 px-3 py-2 text-sm ${commandsTab ? 'border-primary font-medium' : 'border-transparent text-muted-foreground'}`}
        onClick={() => setSearchParams({ tab: 'commands' })}
      >{t('list.tabs.chatCommands')}</button>
    </div>
  );

  if (commandsTab) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-semibold">{t('list.heading')}</h1>
        {tabLinks}
        <div role="tabpanel" id="bot-chat-commands-panel" aria-labelledby="bot-chat-commands-tab" tabIndex={0}>
          <MediaCommandPermissions />
          <CommandsTab showClashWarnings />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">{t('list.heading')}</h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Button variant="outline" size="sm" disabled={createBlocked} onClick={() => setShowTemplates(true)}><LayoutTemplate className="h-4 w-4 mr-1" /> {t('list.fromTemplate')}</Button>
          <Button size="sm" disabled={createBlocked} onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> {t('list.newBot')}</Button>
        </div>
      </div>
      {tabLinks}
      <div role="tabpanel" id="bot-flows-panel" aria-labelledby="bot-flows-tab" tabIndex={0}>
      {bots.length > 0 && hasNoConnections && (
        <ConnectionRequiredNotice>{t('list.connectionRequired')}</ConnectionRequiredNotice>
      )}

      {bots.length === 0 && hasNoConnections ? (
        <EmptyState icon={Bot} title={t('list.empty.connectTitle')} description={t('list.empty.connectDescription')}>
          <Button size="sm" asChild>
            <Link to={CONNECTION_SETUP_PATH}>{t('list.empty.openSetup')}</Link>
          </Button>
        </EmptyState>
      ) : bots.length === 0 ? (
        <EmptyState icon={Bot} title={t('list.empty.title')} description={t('list.empty.description')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bots.map((bot: any) => (
            <Card key={bot.id} className="group hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium truncate">{bot.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={bot.enabled}
                      onCheckedChange={(enabled) => toggleBot.mutate({ id: bot.id, enabled }, {
                        onSuccess: () => toast.success(enabled ? t('list.toasts.enabled') : t('list.toasts.disabled')),
                      })}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground line-clamp-2">{bot.description || t('list.noDescription')}</p>

                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={bot.enabled ? 'default' : 'secondary'} className="text-[10px]">
                    {bot.enabled ? t('list.active') : t('list.inactive')}
                  </Badge>
                  {bot.serverConfigId && (
                    <Badge variant="outline" className="text-[10px]">{t('list.serverBadge', { id: bot.serverConfigId })}</Badge>
                  )}
                </div>

                {bot.updatedAt && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {t('list.updated', { time: timeAgo(new Date(bot.updatedAt).getTime() / 1000) })}
                  </p>
                )}

                <div className="touch-action-reveal flex items-center gap-1 pt-1 transition-opacity">
                  <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => navigate(`/bots/${bot.id}`)}>
                    <Pencil className="h-3 w-3 mr-1" /> {t('list.editFlow')}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(bot.id)} aria-label={t('list.deleteAria', { name: bot.name })} title={t('list.deleteAria', { name: bot.name })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('list.createDialog.title')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t('list.createDialog.name')}</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('list.createDialog.namePlaceholder')} /></div>
            <div><Label className="text-xs">{t('list.createDialog.description')}</Label><Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('list.createDialog.descriptionPlaceholder')} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={handleCreate} disabled={!newName || !selectedConfigId || createBot.isPending}>{t('common:action.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Gallery */}
      <TemplateGallery
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelect={(name, description, flowData) => {
          if (!selectedConfigId) {
            toast.error(t('list.toasts.selectServer'));
            return;
          }
          createBot.mutate({ name, description, serverConfigId: selectedConfigId, virtualServerId: selectedSid || 1, flowData }, {
            onSuccess: (bot: any) => { toast.success(t('list.toasts.createdFromTemplate', { name })); navigate(`/bots/${bot.id}`); },
            onError: () => toast.error(t('list.toasts.createFromTemplateFailed')),
          });
        }}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title={t('list.deleteDialog.title')}
        description={t('list.deleteDialog.description')}
        confirmLabel={t('common:action.delete')}
        onConfirm={() => {
          if (deleteId) deleteBot.mutate(deleteId, { onSuccess: () => { toast.success(t('list.toasts.deleted')); setDeleteId(null); } });
        }}
        destructive
      />
      </div>
    </div>
  );
}
