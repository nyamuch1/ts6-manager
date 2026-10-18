import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useChannels, useCreateChannel, useDeleteChannel, useEditChannel, useMoveChannel } from '@/hooks/use-channels';
import { useClients } from '@/hooks/use-clients';
import { channelsApi } from '@/api/channels.api';
import { useServerStore } from '@/stores/server.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { PageHeader } from '@/components/shared/PageHeader';
import { RefreshStatus, StaleDataNotice } from '@/components/shared/RefreshStatus';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { apiErrorMessage, isTeamSpeakStarting, teamSpeakConnectionTitle, teamSpeakRefreshTone } from '@/lib/api-error';
import { formatNumber } from '@/lib/formatting';
import { Hash, Plus, Trash2, Pencil, ChevronRight, ChevronDown, Users, Lock, Volume2, Loader2, MicOff, VolumeX, Clock3, Terminal, MoveRight } from 'lucide-react';
import { ClientAvatar } from '@/components/shared/ClientAvatar';
import { HostedBannerPicker } from '@/components/channels/HostedBannerPicker';
import { ServerIconPicker } from '@/components/channels/ServerIconPicker';
import { toast } from 'sonner';
import { useVirtualServers } from '@/hooks/use-servers';

interface ChannelNode {
  cid: number;
  pid: number;
  channel_name: string;
  channel_topic: string;
  total_clients: number;
  channel_flag_permanent: number;
  channel_flag_password: number;
  channel_codec_quality: number;
  channel_icon_id?: number;
  channel_banner_gfx_url?: string;
  channel_banner_mode?: number;
  children: ChannelNode[];
}

interface EditChannelForm {
  channel_name: string;
  channel_topic: string;
  channel_password: string;
  channel_description: string;
  channel_icon_id: string;
  channel_banner_gfx_url: string;
  channel_banner_mode: string;
}

const EMPTY_EDIT_FORM: EditChannelForm = {
  channel_name: '',
  channel_topic: '',
  channel_password: '',
  channel_description: '',
  channel_icon_id: '0',
  channel_banner_gfx_url: '',
  channel_banner_mode: '0',
};

interface ClientInfo {
  clid: number;
  cid: number;
  client_nickname: string;
  client_type: string;
  client_away: number;
  client_away_message: string;
  client_flag_talking: number;
  client_input_muted: number;
  client_output_muted: number;
  client_input_hardware: number;
  client_output_hardware: number;
}

function buildTree(channels: any[]): ChannelNode[] {
  const normalized = channels.map((ch) => ({
    ...ch,
    cid: Number(ch.cid),
    pid: Number(ch.pid),
    total_clients: Number(ch.total_clients) || 0,
    channel_flag_permanent: Number(ch.channel_flag_permanent) || 0,
    channel_flag_password: Number(ch.channel_flag_password) || 0,
    channel_codec_quality: Number(ch.channel_codec_quality) || 0,
    channel_icon_id: Number(ch.channel_icon_id) || 0,
    channel_topic: ch.channel_topic || '',
    channel_banner_gfx_url: ch.channel_banner_gfx_url || '',
    channel_banner_mode: Number(ch.channel_banner_mode) || 0,
  }));
  const map = new Map<number, ChannelNode>();
  const roots: ChannelNode[] = [];
  normalized.forEach((ch) => map.set(ch.cid, { ...ch, children: [] }));
  normalized.forEach((ch) => {
    const node = map.get(ch.cid)!;
    if (ch.pid === 0) roots.push(node);
    else map.get(ch.pid)?.children.push(node);
  });
  return roots;
}

interface ChannelDestination {
  cid: number;
  pid: number;
  label: string;
}

function flattenTree(nodes: ChannelNode[], ancestors: string[] = []): ChannelDestination[] {
  return nodes.flatMap((node) => {
    const path = [...ancestors, node.channel_name];
    return [
      { cid: node.cid, pid: node.pid, label: `${path.join(' / ')} (#${node.cid})` },
      ...flattenTree(node.children, path),
    ];
  });
}

function collectDescendantCids(node: ChannelNode): Set<number> {
  const descendants = new Set<number>();
  const visit = (children: ChannelNode[]) => children.forEach((child) => {
    descendants.add(child.cid);
    visit(child.children);
  });
  visit(node.children);
  return descendants;
}

function findChannel(nodes: ChannelNode[], cid: number): ChannelNode | undefined {
  for (const node of nodes) {
    if (node.cid === cid) return node;
    const child = findChannel(node.children, cid);
    if (child) return child;
  }
  return undefined;
}

function ClientEntry({ client, depth, configId, sid }: { client: ClientInfo; depth: number; configId: number; sid: number }) {
  const { t } = useTranslation('admin');
  const isQuery = client.client_type === '1';
  return (
    <div
      className="flex items-center gap-1.5 py-0.5 px-2 text-xs text-muted-foreground"
      style={{ paddingLeft: `${depth * 16 + 28}px` }}
    >
      {isQuery ? (
        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          <Terminal className="h-3 w-3 text-muted-foreground" aria-label={t('channels.serverQueryClient')} />
        </div>
      ) : (
        <div className="relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[8px] font-mono-data text-primary">
          <ClientAvatar
            configId={configId}
            sid={sid}
            clid={client.clid}
            nickname={client.client_nickname}
          />
        </div>
      )}
      {!isQuery && (
        <span className="flex min-w-4 shrink-0 items-center justify-center gap-0.5" aria-label={t('channels.voiceStatus')}>
          {client.client_away === 1 && <Clock3 className="h-3 w-3 text-amber-400" aria-label={client.client_away_message || t('channels.away')} />}
          {(client.client_output_muted === 1 || client.client_output_hardware === 0) && <VolumeX className="h-3 w-3 text-rose-400" aria-label={t('channels.outputMuted')} />}
          {(client.client_input_muted === 1 || client.client_input_hardware === 0) && <MicOff className="h-3 w-3 text-rose-400" aria-label={t('channels.micMuted')} />}
          {client.client_away !== 1
            && client.client_output_muted !== 1
            && client.client_output_hardware !== 0
            && client.client_input_muted !== 1
            && client.client_input_hardware !== 0
            && (
              <span
                className={cn('h-2 w-2 rounded-full bg-sky-400', client.client_flag_talking === 1 && 'bg-emerald-400')}
                title={client.client_flag_talking === 1 ? t('channels.talking') : t('channels.available')}
              />
            )}
        </span>
      )}
      <span className="truncate">{client.client_nickname}</span>
      {isQuery && <Badge variant="outline" className="h-3.5 px-1 py-0 text-[8px]">{t('channels.queryBadge')}</Badge>}
    </div>
  );
}

interface TreeNodeProps {
  node: ChannelNode;
  depth?: number;
  isAdmin: boolean;
  configId: number;
  sid: number;
  showQueryClients: boolean;
  clientsByChannel: Map<number, ClientInfo[]>;
  onDelete: (cid: number, name: string) => void;
  onEdit: (node: ChannelNode) => void;
  onMove: (node: ChannelNode) => void;
  onDrop: (draggedCid: number, targetCid: number) => void;
  draggedCid: number | null;
  setDraggedCid: (cid: number | null) => void;
}

const channelActionClass = 'flex h-9 w-9 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-7 sm:w-7';

function ChannelTreeNode({ node, depth = 0, isAdmin, configId, sid, showQueryClients, clientsByChannel, onDelete, onEdit, onMove, onDrop, draggedCid, setDraggedCid }: TreeNodeProps) {
  const { t } = useTranslation('admin');
  const [expanded, setExpanded] = useState(true);
  const [dropOver, setDropOver] = useState(false);
  const hasChildren = node.children.length > 0;
  const clients = clientsByChannel.get(node.cid) || [];
  const humanClients = clients.filter((client) => client.client_type !== '1');
  const queryClients = clients.filter((client) => client.client_type === '1');
  const hasContent = hasChildren || humanClients.length > 0 || (showQueryClients && queryClients.length > 0);
  const isSpacer = node.channel_name.startsWith('[spacer') || node.channel_name.startsWith('[*spacer');

  if (isSpacer) {
    return (
      <div className="py-0.5" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
        <div className="border-t border-border/40 my-1" />
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(node.cid));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedCid(node.cid);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedCid && draggedCid !== node.cid) {
      setDropOver(true);
    }
  };

  const handleDragLeave = () => setDropOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropOver(false);
    const cidStr = e.dataTransfer.getData('text/plain');
    const cid = Number(cidStr);
    if (cid && cid !== node.cid) {
      onDrop(cid, node.cid);
    }
  };

  const handleDragEnd = () => setDraggedCid(null);

  return (
    <div>
      <div
        className={cn(
          'group flex min-h-10 items-center gap-1 rounded-sm px-2 py-1 text-sm transition-colors hover:bg-muted/30 sm:min-h-0',
          isAdmin && 'cursor-grab active:cursor-grabbing',
          dropOver && 'bg-primary/10 ring-1 ring-primary/40',
          draggedCid === node.cid && 'opacity-40',
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        draggable={isAdmin}
        onDragStart={isAdmin ? handleDragStart : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
      >
        {hasContent ? (
          <button onClick={() => setExpanded(!expanded)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-muted sm:h-5 sm:w-5" aria-label={expanded ? t('channels.collapse', { name: node.channel_name }) : t('channels.expand', { name: node.channel_name })}>
            {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <Hash className="h-3.5 w-3.5 text-primary/70 shrink-0" />

        <span className="truncate flex-1">{node.channel_name}</span>

        <span className="text-[10px] font-mono-data text-muted-foreground/50 shrink-0">#{node.cid}</span>

        {isAdmin && (
          <div className="touch-action-reveal flex items-center gap-0.5 transition-opacity">
            <button
              onClick={() => onMove(node)}
              className={cn(channelActionClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
              aria-label={t('channels.moveAria', { name: node.channel_name })}
              title={t('channels.moveAria', { name: node.channel_name })}
            >
              <MoveRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => onEdit(node)}
              className={cn(channelActionClass, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
              aria-label={t('channels.editAria', { name: node.channel_name })}
              title={t('channels.editAria', { name: node.channel_name })}
            >
              <Pencil className="h-3 w-3" />
            </button>
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
            <button
              onClick={() => onDelete(node.cid, node.channel_name)}
              className={cn(channelActionClass, 'text-destructive/70 hover:bg-destructive/15 hover:text-destructive')}
              aria-label={t('channels.deleteAria', { name: node.channel_name })}
              title={t('channels.deleteAria', { name: node.channel_name })}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 ml-1">
          {node.channel_flag_password === 1 && <Lock className="h-3 w-3 text-amber-400/60" />}
          {humanClients.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono-data" title={t('channels.humanClients')}>
              <Users className="h-3 w-3" />
              {humanClients.length}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <>
          {humanClients.map((client) => (
            <ClientEntry key={client.clid} client={client} depth={depth + 1} configId={configId} sid={sid} />
          ))}
          {showQueryClients && queryClients.length > 0 && (
            <div
              className="my-1 border-l border-border/60 text-muted-foreground"
              style={{ marginLeft: `${(depth + 1) * 16 + 12}px` }}
              aria-label={t('channels.querySessionsIn', { name: node.channel_name })}
            >
              <div className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {t('channels.querySessionsCount', { count: queryClients.length })}
              </div>
              {queryClients.map((client) => (
                <ClientEntry key={client.clid} client={client} depth={depth + 1} configId={configId} sid={sid} />
              ))}
              {queryClients.length > 1 && (
                <div className="px-2 pb-1 text-[10px]">{t('channels.multipleQuerySessions')}</div>
              )}
            </div>
          )}
          {node.children.map((child) => (
            <ChannelTreeNode
              key={child.cid}
              node={child}
              depth={depth + 1}
              isAdmin={isAdmin}
              configId={configId}
              sid={sid}
              showQueryClients={showQueryClients}
              clientsByChannel={clientsByChannel}
              onDelete={onDelete}
              onEdit={onEdit}
              onMove={onMove}
              onDrop={onDrop}
              draggedCid={draggedCid}
              setDraggedCid={setDraggedCid}
            />
          ))}
        </>
      )}
    </div>
  );
}

export default function Channels() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { selectedConfigId, selectedSid } = useServerStore();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const storedShowQueryClients = useUiStore((s) => s.showQueryClients);
  const setShowQueryClients = useUiStore((s) => s.setShowQueryClients);
  const showQueryClients = isAdmin && storedShowQueryClients;
  const { data: channelData, isLoading: channelsLoading, error: channelsError, refetch: refetchChannels, isFetching: channelsFetching } = useChannels();
  const {
    data: virtualServers,
    error: virtualServersError,
    isLoading: virtualServersLoading,
    isFetching: virtualServersFetching,
    refetch: refetchVirtualServers,
  } = useVirtualServers();
  const { data: clientData } = useClients();
  const createChannel = useCreateChannel();
  const deleteChannel = useDeleteChannel();
  const editChannel = useEditChannel();
  const moveChannel = useMoveChannel();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ cid: number; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<ChannelNode | null>(null);
  const [editForm, setEditForm] = useState<EditChannelForm>(EMPTY_EDIT_FORM);
  // The form as loaded from the server; saving sends only the fields that differ.
  const [editLoaded, setEditLoaded] = useState<EditChannelForm>(EMPTY_EDIT_FORM);
  const [editLoading, setEditLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [draggedCid, setDraggedCid] = useState<number | null>(null);
  const [dragContext, setDragContext] = useState<{ configId: number; sid: number; cid: number } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ node: ChannelNode; configId: number; sid: number } | null>(null);
  const [moveDestination, setMoveDestination] = useState('');

  const tree = useMemo(() => {
    if (!channelData || !Array.isArray(channelData)) return [];
    return buildTree(channelData);
  }, [channelData]);

  const channelDestinations = useMemo(() => flattenTree(tree), [tree]);
  const validMoveDestinations = useMemo(() => {
    if (!moveTarget) return [];
    const excluded = collectDescendantCids(moveTarget.node);
    excluded.add(moveTarget.node.cid);
    return channelDestinations.filter((destination) => !excluded.has(destination.cid));
  }, [channelDestinations, moveTarget]);

  const clientsByChannel = useMemo(() => {
    const map = new Map<number, ClientInfo[]>();
    if (!clientData || !Array.isArray(clientData)) return map;
    for (const c of clientData) {
      // Include ServerQuery clients (type 1) so leftover query sessions after a
      // restart are visible in the channel they occupy, not only in logs.
      const cid = Number(c.cid);
      const entry: ClientInfo = {
        clid: Number(c.clid),
        cid,
        client_nickname: c.client_nickname || '?',
        client_type: String(c.client_type),
        client_away: Number(c.client_away) || 0,
        client_away_message: String(c.client_away_message || ''),
        client_flag_talking: Number(c.client_flag_talking) || 0,
        client_input_muted: Number(c.client_input_muted) || 0,
        client_output_muted: Number(c.client_output_muted) || 0,
        client_input_hardware: Number(c.client_input_hardware) === 0 ? 0 : 1,
        client_output_hardware: Number(c.client_output_hardware) === 0 ? 0 : 1,
      };
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(entry);
    }
    return map;
  }, [clientData]);

  if (!selectedConfigId || !selectedSid) return <NoServerSelectedState pageTitle={t('channels.title')} icon={Hash} />;
  const hasChannelData = Array.isArray(channelData);
  const gateError = channelsError || virtualServersError;
  const contextIsValid = !!virtualServers?.some((server: any) => Number(server.virtualserver_id) === selectedSid);
  const isFetchingGate = channelsFetching || virtualServersFetching;

  const retryGate = () => {
    void refetchVirtualServers();
    void refetchChannels();
  };

  // Prefer an explicit Query-warming / connection failure over a fake empty live tree.
  if (gateError && !hasChannelData) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Hash}
          title={teamSpeakConnectionTitle(gateError)}
          description={apiErrorMessage(
            gateError,
            isTeamSpeakStarting(gateError)
              ? t('channels.queryStartingLoad')
              : t('channels.loadFailed'),
          )}
        />
        <div className="flex justify-center">
          <Button size="sm" variant="outline" onClick={retryGate} disabled={isFetchingGate}>
            {isFetchingGate ? t('retrying') : tc('action.retry')}
          </Button>
        </div>
      </div>
    );
  }
  if ((channelsLoading || virtualServersLoading || !contextIsValid) && !hasChannelData) {
    return <PageLoader />;
  }

  const handleCreate = () => {
    if (!newName.trim()) return;
    createChannel.mutate({ channel_name: newName, channel_flag_permanent: 1 }, {
      onSuccess: () => { toast.success(t('channels.created')); setShowCreate(false); setNewName(''); },
      onError: () => toast.error(t('channels.createFailed')),
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteChannel.mutate(deleteTarget.cid, {
      onSuccess: () => { toast.success(t('channels.deleted')); setDeleteTarget(null); },
      onError: () => toast.error(t('channels.deleteFailed')),
    });
  };

  const handleEditOpen = async (node: ChannelNode) => {
    setEditTarget(node);
    const fromList: EditChannelForm = {
      channel_name: node.channel_name,
      channel_topic: node.channel_topic || '',
      channel_password: '',
      channel_description: '',
      channel_icon_id: String(node.channel_icon_id || 0),
      channel_banner_gfx_url: node.channel_banner_gfx_url || '',
      channel_banner_mode: String(node.channel_banner_mode || 0),
    };
    setEditForm(fromList);
    setEditLoaded(fromList);
    if (!selectedConfigId || !selectedSid) return;

    setEditLoading(true);
    try {
      const info = await channelsApi.get(selectedConfigId, selectedSid, node.cid);
      const ch = Array.isArray(info) ? info[0] : info;
      if (!ch) return;
      const fromInfo: EditChannelForm = {
        channel_name: ch.channel_name || node.channel_name,
        channel_topic: ch.channel_topic || '',
        channel_password: '',
        channel_description: ch.channel_description || '',
        channel_icon_id: String(ch.channel_icon_id ?? node.channel_icon_id ?? 0),
        channel_banner_gfx_url: ch.channel_banner_gfx_url || '',
        channel_banner_mode: String(ch.channel_banner_mode ?? 0),
      };
      setEditForm(fromInfo);
      setEditLoaded(fromInfo);
    } catch {
      toast.error(t('channels.loadDetailsFailed'));
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditSave = () => {
    if (!editTarget || !editForm.channel_name.trim()) return;
    // TeamSpeak rejects the whole channeledit when any one property is refused,
    // so send only what changed instead of every field in the dialog.
    const data: Record<string, string | number> = {};
    if (editForm.channel_name !== editLoaded.channel_name) data.channel_name = editForm.channel_name;
    if (editForm.channel_topic !== editLoaded.channel_topic) data.channel_topic = editForm.channel_topic;
    if (editForm.channel_description !== editLoaded.channel_description) data.channel_description = editForm.channel_description;
    const bannerUrl = editForm.channel_banner_gfx_url.trim();
    if (bannerUrl !== editLoaded.channel_banner_gfx_url) data.channel_banner_gfx_url = bannerUrl;
    if (editForm.channel_banner_mode !== editLoaded.channel_banner_mode) data.channel_banner_mode = parseInt(editForm.channel_banner_mode, 10) || 0;
    const iconId = parseInt(editForm.channel_icon_id, 10);
    if (Number.isFinite(iconId) && editForm.channel_icon_id !== editLoaded.channel_icon_id) data.channel_icon_id = iconId;
    if (editForm.channel_password) data.channel_password = editForm.channel_password;
    if (Object.keys(data).length === 0) { setEditTarget(null); return; }
    editChannel.mutate({ cid: editTarget.cid, data }, {
      onSuccess: () => { toast.success(t('channels.updated')); setEditTarget(null); },
      onError: (error) => toast.error(apiErrorMessage(error, t('channels.updateFailed'))),
    });
  };

  const handleMoveOpen = (node: ChannelNode) => {
    if (!selectedConfigId || !selectedSid) return;
    moveChannel.reset();
    setMoveDestination('');
    setMoveTarget({ node, configId: selectedConfigId, sid: selectedSid });
  };

  const handleMoveConfirm = () => {
    if (!moveTarget || moveChannel.isPending || moveDestination === '') return;
    const destinationCid = Number(moveDestination);
    if (destinationCid === moveTarget.node.pid) return;
    moveChannel.mutate({
      configId: moveTarget.configId,
      sid: moveTarget.sid,
      cid: moveTarget.node.cid,
      data: { cpid: destinationCid },
    }, {
      onSuccess: () => {
        toast.success(t('channels.moved'));
        setMoveTarget(null);
        setMoveDestination('');
      },
      onError: (error) => toast.error(apiErrorMessage(error, t('channels.moveFailed'))),
    });
  };

  const handleDrop = (draggedCid: number, targetCid: number) => {
    if (!dragContext || dragContext.cid !== draggedCid || moveChannel.isPending) return;
    const source = findChannel(tree, draggedCid);
    if (!source || source.pid === targetCid || collectDescendantCids(source).has(targetCid)) {
      toast.error(t('channels.moveInvalid'));
      return;
    }
    moveChannel.mutate({ ...dragContext, data: { cpid: targetCid } }, {
      onSuccess: () => toast.success(t('channels.moved')),
      onError: (error) => toast.error(apiErrorMessage(error, t('channels.moveFailed'))),
    });
  };

  const allVisibleClients = clientsByChannel.size > 0
    ? Array.from(clientsByChannel.values()).flat()
    : [];
  const totalClients = allVisibleClients.filter((client) => client.client_type !== '1').length;
  const totalQuerySessions = allVisibleClients.filter((client) => client.client_type === '1').length;
  const backgroundError = gateError
    ? apiErrorMessage(
      gateError,
      isTeamSpeakStarting(gateError)
        ? t('channels.queryStartingBackground')
        : t('channels.refreshFailed'),
    )
    : null;
  const refreshTone = teamSpeakRefreshTone(gateError);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('channels.title')}
        icon={Hash}
        description={showQueryClients && totalQuerySessions > 0
          ? t('channels.descriptionWithQuery', {
            channels: formatNumber(hasChannelData ? channelData.length : 0),
            clients: formatNumber(totalClients),
            count: totalQuerySessions,
          })
          : t('channels.description', {
            channels: formatNumber(hasChannelData ? channelData.length : 0),
            clients: formatNumber(totalClients),
          })}
        actions={isAdmin ? (
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> {t('channels.createChannel')}
          </Button>
        ) : undefined}
        metadata={(
          <RefreshStatus
            isRefreshing={isFetchingGate}
            tone={refreshTone}
            idleLabel={t('channels.idleLabel')}
            refreshingLabel={t('channels.refreshingLabel')}
            degradedLabel={t('channels.degradedLabel')}
            startingLabel={t('channels.startingLabel')}
          />
        )}
      />

      {backgroundError && (
        <StaleDataNotice
          message={backgroundError}
          onRetry={retryGate}
          isRetrying={isFetchingGate}
        />
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Volume2 className="h-4 w-4 text-primary" /> {t('channels.channelTree')}
          </CardTitle>
          {isAdmin && (
            <div className="flex min-w-0 items-center gap-2">
              <Label htmlFor="show-query-clients" className="truncate text-xs text-muted-foreground" title={t('channels.showQueryClientsTitle')}>
                {t('channels.showQueryClients')}
              </Label>
              <Switch
                id="show-query-clients"
                checked={showQueryClients}
                onCheckedChange={setShowQueryClients}
                aria-label={t('channels.showQueryClients')}
                title={t('channels.showQueryClientsTitle')}
              />
            </div>
          )}
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[min(600px,calc(100dvh-15rem))] min-h-72">
            <div className="min-w-[22rem] space-y-0 pr-2">
              {tree.map((node) => (
                <ChannelTreeNode
                  key={node.cid}
                  node={node}
                  isAdmin={isAdmin}
                  configId={selectedConfigId!}
                  sid={selectedSid!}
                  showQueryClients={showQueryClients}
                  clientsByChannel={clientsByChannel}
                  onDelete={(cid, name) => setDeleteTarget({ cid, name })}
                  onEdit={handleEditOpen}
                  onMove={handleMoveOpen}
                  onDrop={handleDrop}
                  draggedCid={draggedCid}
                  setDraggedCid={(cid) => {
                    setDraggedCid(cid);
                    setDragContext(cid === null ? null : { configId: selectedConfigId, sid: selectedSid, cid });
                  }}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Move Dialog */}
      <Dialog
        open={!!moveTarget}
        onOpenChange={(open) => {
          if (!open && !moveChannel.isPending) {
            setMoveTarget(null);
            setMoveDestination('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('channels.moveTitle')}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="admin:channels.moveDescription"
                values={{ name: moveTarget?.node.channel_name, cid: moveTarget?.node.cid }}
              />
            </DialogDescription>
          </DialogHeader>
          {moveTarget && (
            <div className="space-y-4">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
                <dt className="text-muted-foreground">{t('channels.source')}</dt>
                <dd className="truncate font-medium">{moveTarget.node.channel_name} (#{moveTarget.node.cid})</dd>
                <dt className="text-muted-foreground">{t('channels.currentParent')}</dt>
                <dd className="truncate">
                  {moveTarget.node.pid === 0
                    ? t('channels.topLevel')
                    : channelDestinations.find((destination) => destination.cid === moveTarget.node.pid)?.label ?? `CID ${moveTarget.node.pid}`}
                </dd>
              </dl>
              <div className="space-y-1.5">
                <Label htmlFor="move-channel-destination">{t('channels.destinationChannel')}</Label>
                <Select value={moveDestination} onValueChange={setMoveDestination} disabled={moveChannel.isPending}>
                  <SelectTrigger id="move-channel-destination" aria-label={t('channels.destinationChannel')}>
                    <SelectValue placeholder={t('channels.selectNewParent')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" disabled={moveTarget.node.pid === 0}>{t('channels.topLevelRoot')}</SelectItem>
                    {validMoveDestinations.map((destination) => (
                      <SelectItem
                        key={destination.cid}
                        value={String(destination.cid)}
                        disabled={destination.cid === moveTarget.node.pid}
                      >
                        {destination.cid === moveTarget.node.pid
                          ? t('channels.destinationOptionCurrent', { label: destination.label })
                          : t('channels.destinationOption', { label: destination.label })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {moveDestination !== '' && Number(moveDestination) === moveTarget.node.pid && (
                  <p className="text-xs text-muted-foreground">{t('channels.alreadyUnderParent')}</p>
                )}
              </div>
              {moveChannel.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {apiErrorMessage(moveChannel.error, t('channels.moveFailed'))}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={moveChannel.isPending}>{tc('action.cancel')}</Button>
            <Button
              onClick={handleMoveConfirm}
              disabled={moveChannel.isPending || moveDestination === '' || Number(moveDestination) === moveTarget?.node.pid}
            >
              {moveChannel.isPending ? t('channels.moving') : t('channels.moveButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('channels.createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('channels.channelName')}</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('channels.newChannelPlaceholder')} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{tc('action.cancel')}</Button>
            <Button onClick={handleCreate} disabled={createChannel.isPending}>{tc('action.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-lg [--dialog-max-height:90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? t('channels.editTitleWithId', { cid: editTarget.cid }) : t('channels.editTitle')}</DialogTitle>
          </DialogHeader>
          {editLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('channels.loadingDetails')}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">{t('channels.channelName')}</Label>
                <Input value={editForm.channel_name} onChange={(e) => setEditForm({ ...editForm, channel_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">{t('channels.topic')}</Label>
                <Input value={editForm.channel_topic} onChange={(e) => setEditForm({ ...editForm, channel_topic: e.target.value })} placeholder={t('channels.optionalPlaceholder')} />
              </div>
              <div>
                <Label className="text-xs">{t('channels.descriptionLabel')}</Label>
                <Textarea
                  value={editForm.channel_description}
                  onChange={(e) => setEditForm({ ...editForm, channel_description: e.target.value })}
                  placeholder={t('channels.descriptionPlaceholder')}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="channel-icon-id" className="text-xs">{t('channels.iconId')}</Label>
                <Input
                  className="font-mono-data"
                  value={editForm.channel_icon_id}
                  onChange={(e) => setEditForm({ ...editForm, channel_icon_id: e.target.value })}
                  id="channel-icon-id"
                  placeholder={t('channels.iconIdPlaceholder')}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  <Trans i18nKey="admin:channels.iconIdHelp" components={{ code: <span className="font-mono" /> }} />
                </p>
                <ServerIconPicker
                  value={(Number.parseInt(editForm.channel_icon_id, 10) || 0) >>> 0}
                  onSelect={(id) => setEditForm((form) => ({ ...form, channel_icon_id: String(id) }))}
                />
              </div>
              <div>
                <Label className="text-xs">{t('channels.bannerUrl')}</Label>
                <Input
                  value={editForm.channel_banner_gfx_url}
                  onChange={(e) => setEditForm({ ...editForm, channel_banner_gfx_url: e.target.value })}
                  placeholder={t('channels.bannerUrlPlaceholder')}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  <Trans i18nKey="admin:channels.bannerUrlHelp" components={{ code: <span className="font-mono" /> }} />
                </p>
                <HostedBannerPicker
                  value={editForm.channel_banner_gfx_url}
                  onSelect={(url) => setEditForm((form) => ({ ...form, channel_banner_gfx_url: url }))}
                />
              </div>
              <div>
                <Label className="text-xs">{t('channels.bannerMode')}</Label>
                <Select
                  value={editForm.channel_banner_mode}
                  onValueChange={(v) => setEditForm({ ...editForm, channel_banner_mode: v })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('channels.bannerStretch')}</SelectItem>
                    <SelectItem value="1">{t('channels.bannerKeepAspect')}</SelectItem>
                    <SelectItem value="2">{t('channels.bannerIgnoreAspect')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('channels.password')}</Label>
                <Input type="password" value={editForm.channel_password} onChange={(e) => setEditForm({ ...editForm, channel_password: e.target.value })} placeholder={t('channels.passwordPlaceholder')} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>{tc('action.cancel')}</Button>
            <Button onClick={handleEditSave} disabled={editLoading || !editForm.channel_name.trim() || editChannel.isPending}>
              {editChannel.isPending ? t('channels.saving') : tc('action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title={t('channels.deleteTitle')}
        description={t('channels.deleteDescription', { name: deleteTarget?.name })}
        confirmLabel={tc('action.delete')}
        destructive
        onConfirm={handleDelete}
        loading={deleteChannel.isPending}
      />
    </div>
  );
}
