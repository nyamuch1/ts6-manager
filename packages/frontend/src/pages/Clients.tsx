import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useClients, useKickClient, useBanClient, usePokeClient } from '@/hooks/use-clients';
import { useMusicBots, usePlayUrl } from '@/hooks/use-music-bots';
import { useRadioStations, usePlayRadio } from '@/hooks/use-radio-stations';
import { useServerStore } from '@/stores/server.store';
import { useAuthStore } from '@/stores/auth.store';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { PageHeader } from '@/components/shared/PageHeader';
import { RefreshStatus, StaleDataNotice } from '@/components/shared/RefreshStatus';
import { formatUptime } from '@/lib/utils';
import { formatNumber } from '@/lib/formatting';
import { apiErrorMessage, isTeamSpeakStarting, teamSpeakConnectionTitle, teamSpeakRefreshTone } from '@/lib/api-error';
import { Users, MoreHorizontal, LogOut, Ban, Zap, Youtube, Radio, Copy } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import { toastMediaStarted } from '@/lib/media-start-toast';
import type { MusicBotSummary, RadioStationInfo } from '@ts6/common';
import { useVirtualServers } from '@/hooks/use-servers';

type PlayDialogMode = 'youtube' | 'radio' | null;

type ClientActionTarget = {
  configId: number;
  sid: number;
  clid: number;
  name: string;
};

export default function Clients() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { selectedConfigId, selectedSid } = useServerStore();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const { data, isLoading, error, refetch, isFetching } = useClients();
  const {
    data: virtualServers,
    error: virtualServersError,
    isLoading: virtualServersLoading,
    isFetching: virtualServersFetching,
    refetch: refetchVirtualServers,
  } = useVirtualServers();
  const kickClient = useKickClient();
  const banClient = useBanClient();
  const pokeClient = usePokeClient();
  const copyIp = (ip: string) => {
    void navigator.clipboard.writeText(ip).then(() => toast.success(t('clients.ipCopied')));
  };
  const { data: bots } = useMusicBots();
  const { data: stations } = useRadioStations(selectedConfigId);
  const playUrl = usePlayUrl();
  const playRadio = usePlayRadio();

  const [kickTarget, setKickTarget] = useState<ClientActionTarget | null>(null);
  const [kickReason, setKickReason] = useState(() => t('clients.kickDefaultReason'));
  const [kickError, setKickError] = useState('');
  const [banTarget, setBanTarget] = useState<ClientActionTarget | null>(null);
  const [banDuration, setBanDuration] = useState('3600');
  const [banReason, setBanReason] = useState(() => t('clients.banDefaultReason'));
  const [banError, setBanError] = useState('');
  const [pokeTarget, setPokeTarget] = useState<ClientActionTarget | null>(null);
  const [pokeMsg, setPokeMsg] = useState('');
  const [pokeError, setPokeError] = useState('');
  const kickSubmitting = useRef(false);
  const banSubmitting = useRef(false);
  const pokeSubmitting = useRef(false);
  const kickReasonInput = useRef<HTMLInputElement>(null);
  const banReasonInput = useRef<HTMLInputElement>(null);
  const pokeMessageInput = useRef<HTMLInputElement>(null);
  const [playMode, setPlayMode] = useState<PlayDialogMode>(null);
  const [playClientName, setPlayClientName] = useState('');
  const [selectedBotId, setSelectedBotId] = useState<string>('');
  const [ytUrl, setYtUrl] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string>('');

  const clients = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.filter((c: any) => String(c.client_type) === '0');
  }, [data]);

  const runningBots = useMemo(() => {
    const list = (Array.isArray(bots) ? bots : []) as MusicBotSummary[];
    return list.filter(
      (b) =>
        b.status !== 'stopped' &&
        b.status !== 'error' &&
        (!selectedConfigId || b.serverConfigId === selectedConfigId),
    );
  }, [bots, selectedConfigId]);

  const stationList = (Array.isArray(stations) ? stations : []) as RadioStationInfo[];

  useEffect(() => {
    if (!playMode) return;
    if (selectedBotId && runningBots.some((b) => String(b.id) === selectedBotId)) return;
    setSelectedBotId(runningBots[0] ? String(runningBots[0].id) : '');
  }, [playMode, runningBots, selectedBotId]);

  useEffect(() => {
    if (playMode !== 'radio') return;
    if (selectedStationId && stationList.some((s) => String(s.id) === selectedStationId)) return;
    setSelectedStationId(stationList[0] ? String(stationList[0].id) : '');
  }, [playMode, stationList, selectedStationId]);

  const openPlayDialog = (mode: Exclude<PlayDialogMode, null>, clientName: string) => {
    setPlayClientName(clientName);
    setYtUrl('');
    setPlayMode(mode);
  };

  const closePlayDialog = () => {
    setPlayMode(null);
    setPlayClientName('');
    setYtUrl('');
  };

  const closeKickDialog = () => {
    setKickTarget(null);
    setKickReason(t('clients.kickDefaultReason'));
    setKickError('');
  };

  const closeBanDialog = () => {
    setBanTarget(null);
    setBanDuration('3600');
    setBanReason(t('clients.banDefaultReason'));
    setBanError('');
  };

  const closePokeDialog = () => {
    setPokeTarget(null);
    setPokeMsg('');
    setPokeError('');
  };

  const handleKick = () => {
    if (!kickTarget || kickSubmitting.current) return;
    const target = kickTarget;
    kickSubmitting.current = true;
    setKickError('');
    kickClient.mutate(
      {
        configId: target.configId,
        sid: target.sid,
        clid: target.clid,
        reasonid: 5,
        reasonmsg: kickReason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t('clients.kicked', { name: target.name }));
          closeKickDialog();
        },
        onError: (error) => {
          const message = t('clients.kickFailed', { name: target.name, message: apiErrorMessage(error, t('clients.requestRefused')) });
          setKickError(message);
          toast.error(message);
        },
        onSettled: () => { kickSubmitting.current = false; },
      },
    );
  };

  const handleBan = () => {
    if (!banTarget || banSubmitting.current) return;
    const target = banTarget;
    banSubmitting.current = true;
    setBanError('');
    banClient.mutate(
      {
        configId: target.configId,
        sid: target.sid,
        clid: target.clid,
        time: Number(banDuration),
        banreason: banReason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t('clients.banned', { name: target.name }));
          closeBanDialog();
        },
        onError: (error) => {
          const message = t('clients.banFailed', { name: target.name, message: apiErrorMessage(error, t('clients.requestRefused')) });
          setBanError(message);
          toast.error(message);
        },
        onSettled: () => { banSubmitting.current = false; },
      },
    );
  };

  const handlePoke = () => {
    if (!pokeTarget || !pokeMsg.trim() || pokeSubmitting.current) return;
    const target = pokeTarget;
    const messageText = pokeMsg.trim();
    pokeSubmitting.current = true;
    setPokeError('');
    pokeClient.mutate(
      { configId: target.configId, sid: target.sid, clid: target.clid, msg: messageText },
      {
        onSuccess: () => {
          toast.success(t('clients.poked', { name: target.name }));
          closePokeDialog();
        },
        onError: (error) => {
          const message = t('clients.pokeFailed', { name: target.name, message: apiErrorMessage(error, t('clients.requestRefused')) });
          setPokeError(message);
          toast.error(message);
        },
        onSettled: () => { pokeSubmitting.current = false; },
      },
    );
  };

  const handlePlayYouTube = () => {
    const botId = parseInt(selectedBotId, 10);
    const url = ytUrl.trim();
    if (!botId || !url) {
      toast.error(t('clients.selectBotAndUrl'));
      return;
    }
    playUrl.mutate(
      { botId, url },
      {
        onSuccess: (res: any) => {
          const count = res?.queued ?? 1;
          toastMediaStarted(
            res?.playlist
              ? t('clients.playingPlaylist', { count })
              : t('clients.playing'),
          );
          closePlayDialog();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.error || err?.message || t('clients.playUrlFailed'));
        },
      },
    );
  };

  const handlePlayRadio = () => {
    const botId = parseInt(selectedBotId, 10);
    const stationId = parseInt(selectedStationId, 10);
    if (!botId || !stationId) {
      toast.error(t('clients.selectBotAndStation'));
      return;
    }
    playRadio.mutate(
      { botId, stationId },
      {
        onSuccess: () => {
          toastMediaStarted(t('clients.playingRadio'));
          closePlayDialog();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.error || err?.message || t('clients.playRadioFailed'));
        },
      },
    );
  };

  const columns: ColumnDef<any>[] = useMemo(() => {
    const cols: ColumnDef<any>[] = [
      {
        accessorKey: 'client_nickname',
        header: t('clients.columns.nickname'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-mono-data text-primary">
              {row.original.client_nickname?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="font-medium">{row.original.client_nickname}</span>
          </div>
        ),
      },
      {
        accessorKey: 'client_country',
        header: t('clients.columns.country'),
        cell: ({ getValue }) => <span className="font-mono-data text-xs">{(getValue() as string) || '-'}</span>,
      },
      ...(isAdmin
        ? [{
            accessorKey: 'connection_client_ip',
            header: t('clients.columns.ip'),
            cell: ({ row }: { row: { original: Record<string, unknown> } }) => {
              const ip = String(row.original.connection_client_ip || '-');
              return (
                <div className="flex items-center gap-1 font-mono-data text-xs">
                  <span>{ip}</span>
                  {ip !== '-' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('clients.copyIpAria', { ip })}
                      onClick={() => copyIp(ip)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            },
          } as ColumnDef<any>]
        : []),
      {
        accessorKey: 'client_idle_time',
        header: t('clients.columns.idle'),
        cell: ({ getValue }) => <span className="font-mono-data text-xs text-muted-foreground">{formatUptime(Math.floor((getValue() as number) / 1000))}</span>,
      },
      {
        accessorKey: 'client_away',
        header: t('clients.columns.status'),
        cell: ({ row }) => {
          const o = row.original;
          if (Number(o.client_output_muted) === 1 && Number(o.client_away) === 1) {
            return <Badge className="bg-orange-500/15 text-orange-700 text-[10px]">{t('clients.statuses.speakerAway')}</Badge>;
          }
          if (Number(o.client_output_muted) === 1 && Number(o.client_input_muted) === 1) {
            return <Badge className="bg-orange-500/15 text-orange-700 text-[10px]">{t('clients.statuses.speakerMicMuted')}</Badge>;
          }
          if (Number(o.client_output_muted) === 1) {
            return <Badge className="bg-orange-500/15 text-orange-700 text-[10px]">{t('clients.statuses.speakerMuted')}</Badge>;
          }
          if (Number(o.client_away) === 1) return <Badge variant="warning" className="text-[10px]">{t('clients.statuses.away')}</Badge>;
          if (Number(o.client_input_muted) === 1) return <Badge variant="secondary" className="text-[10px]">{t('clients.statuses.micMuted')}</Badge>;
          return <Badge variant="success" className="text-[10px]">{t('clients.statuses.active')}</Badge>;
        },
      },
    ];
    if (isAdmin) {
      cols.push({
        id: 'actions',
        header: () => <span className="sr-only">{t('actions')}</span>,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="cursor-pointer" aria-label={t('clients.actionsAria', { name: c.client_nickname })}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    if (!selectedConfigId || !selectedSid) return;
                    setPokeTarget({ configId: selectedConfigId, sid: selectedSid, clid: c.clid, name: c.client_nickname });
                    setPokeMsg('');
                    setPokeError('');
                  }}
                >
                  <Zap className="mr-2 h-4 w-4" /> {t('clients.poke')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => openPlayDialog('youtube', c.client_nickname)}
                >
                  <Youtube className="mr-2 h-4 w-4" /> {t('clients.playMedia')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => openPlayDialog('radio', c.client_nickname)}
                >
                  <Radio className="mr-2 h-4 w-4" /> {t('clients.playRadio')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    if (!selectedConfigId || !selectedSid) return;
                    setKickTarget({ configId: selectedConfigId, sid: selectedSid, clid: c.clid, name: c.client_nickname });
                    setKickReason(t('clients.kickDefaultReason'));
                    setKickError('');
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> {t('clients.kick')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer"
                  onClick={() => {
                    if (!selectedConfigId || !selectedSid) return;
                    setBanTarget({ configId: selectedConfigId, sid: selectedSid, clid: c.clid, name: c.client_nickname });
                    setBanDuration('3600');
                    setBanReason(t('clients.banDefaultReason'));
                    setBanError('');
                  }}
                >
                  <Ban className="mr-2 h-4 w-4" /> {t('clients.ban')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      });
    }
    return cols;
  }, [isAdmin, selectedConfigId, selectedSid, t]);

  const hasClientData = Array.isArray(data);
  const gateError = error || virtualServersError;
  const contextIsValid = !!virtualServers?.some((server: any) => Number(server.virtualserver_id) === selectedSid);
  const isFetchingGate = isFetching || virtualServersFetching;
  const retryGate = () => {
    void refetchVirtualServers();
    void refetch();
  };

  if (!selectedConfigId || !selectedSid) return <NoServerSelectedState pageTitle={t('clients.title')} icon={Users} />;
  if (gateError && !hasClientData) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={Users}
          title={teamSpeakConnectionTitle(gateError)}
          description={apiErrorMessage(
            gateError,
            isTeamSpeakStarting(gateError)
              ? t('clients.queryStartingLoad')
              : t('clients.loadFailed'),
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
  // Match Channels: invalid/unknown selected sid is not-ready, not an empty Live table.
  if ((isLoading || virtualServersLoading || !contextIsValid) && !hasClientData) {
    return <PageLoader />;
  }
  const backgroundError = gateError
    ? apiErrorMessage(
      gateError,
      isTeamSpeakStarting(gateError)
        ? t('clients.queryStartingBackground')
        : t('clients.refreshFailed'),
    )
    : null;
  const refreshTone = !contextIsValid && !gateError
    ? 'starting'
    : teamSpeakRefreshTone(gateError);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('clients.title')}
        icon={Users}
        description={t('clients.description', { count: formatNumber(clients.length) })}
        metadata={(
          <RefreshStatus
            isRefreshing={isFetchingGate}
            tone={refreshTone}
            idleLabel={t('clients.idleLabel')}
            refreshingLabel={t('clients.refreshingLabel')}
            degradedLabel={t('clients.degradedLabel')}
            startingLabel={t('clients.startingLabel')}
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

      <DataTable
        columns={columns}
        data={clients}
        searchEnabled
        searchLabel={t('clients.searchLabel')}
        searchPlaceholder={t('clients.searchPlaceholder')}
        tableLabel={t('clients.tableLabel')}
        density="compact"
        stickyHeader
        emptyText={t('clients.empty')}
        filteredEmptyText={t('clients.filteredEmpty')}
      />

      {/* Kick confirmation */}
      <Dialog
        open={!!kickTarget}
        onOpenChange={(open) => { if (!open && !kickClient.isPending) closeKickDialog(); }}
      >
        <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); kickReasonInput.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{t('clients.kickTitle')}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="admin:clients.kickDescription"
                values={{ name: kickTarget?.name }}
                components={{ name: <span className="font-medium text-foreground" /> }}
              />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kick-reason">{t('clients.reason')}</Label>
            <Input
              id="kick-reason"
              ref={kickReasonInput}
              value={kickReason}
              onChange={(event) => setKickReason(event.target.value)}
              autoFocus
              disabled={kickClient.isPending}
            />
          </div>
          {kickError && <p role="alert" className="text-sm text-destructive">{kickError}</p>}
          <DialogFooter>
            <Button className="min-h-10" variant="outline" onClick={closeKickDialog} disabled={kickClient.isPending}>{tc('action.cancel')}</Button>
            <Button
              className="min-h-10"
              variant="destructive"
              onClick={handleKick}
              disabled={kickClient.isPending}
              aria-busy={kickClient.isPending}
            >
              <LogOut className="h-4 w-4 mr-1" />
              {kickClient.isPending ? t('clients.kicking') : t('clients.kick')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban confirmation */}
      <Dialog
        open={!!banTarget}
        onOpenChange={(open) => { if (!open && !banClient.isPending) closeBanDialog(); }}
      >
        <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); banReasonInput.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{t('clients.banTitle')}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="admin:clients.banDescription"
                values={{ name: banTarget?.name }}
                components={{ name: <span className="font-medium text-foreground" /> }}
              />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ban-duration">{t('clients.duration')}</Label>
              <Select value={banDuration} onValueChange={setBanDuration} disabled={banClient.isPending}>
                <SelectTrigger id="ban-duration" aria-label={t('clients.duration')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">{t('clients.duration1h')}</SelectItem>
                  <SelectItem value="86400">{t('clients.duration1d')}</SelectItem>
                  <SelectItem value="604800">{t('clients.duration1w')}</SelectItem>
                  <SelectItem value="2592000">{t('clients.duration30d')}</SelectItem>
                  <SelectItem value="0">{t('clients.permanent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ban-reason">{t('clients.reason')}</Label>
              <Input
                id="ban-reason"
                ref={banReasonInput}
                value={banReason}
                onChange={(event) => setBanReason(event.target.value)}
                autoFocus
                disabled={banClient.isPending}
              />
            </div>
          </div>
          {banError && <p role="alert" className="text-sm text-destructive">{banError}</p>}
          <DialogFooter>
            <Button className="min-h-10" variant="outline" onClick={closeBanDialog} disabled={banClient.isPending}>{tc('action.cancel')}</Button>
            <Button
              className="min-h-10"
              variant="destructive"
              onClick={handleBan}
              disabled={banClient.isPending}
              aria-busy={banClient.isPending}
            >
              <Ban className="h-4 w-4 mr-1" />
              {banClient.isPending ? t('clients.banning') : t('clients.ban')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Poke Dialog */}
      <Dialog
        open={!!pokeTarget}
        onOpenChange={(open) => { if (!open && !pokeClient.isPending) closePokeDialog(); }}
      >
        <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); pokeMessageInput.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{t('clients.pokeTitle', { name: pokeTarget?.name })}</DialogTitle>
            <DialogDescription>
              {t('clients.pokeDescription', { name: pokeTarget?.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="poke-message">{t('clients.message')}</Label>
            <Input
              id="poke-message"
              ref={pokeMessageInput}
              value={pokeMsg}
              onChange={(e) => setPokeMsg(e.target.value)}
              placeholder={t('clients.pokePlaceholder')}
              autoFocus
              disabled={pokeClient.isPending}
            />
          </div>
          {pokeError && <p role="alert" className="text-sm text-destructive">{pokeError}</p>}
          <DialogFooter>
            <Button className="min-h-10" variant="outline" onClick={closePokeDialog} disabled={pokeClient.isPending}>{tc('action.cancel')}</Button>
            <Button
              className="min-h-10"
              onClick={handlePoke}
              disabled={!pokeMsg.trim() || pokeClient.isPending}
              aria-busy={pokeClient.isPending}
            >
              <Zap className="h-4 w-4 mr-1" />
              {pokeClient.isPending ? t('clients.sending') : t('clients.pokeSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Play YouTube / Playlist */}
      <Dialog open={playMode === 'youtube'} onOpenChange={(open) => !open && closePlayDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{playClientName ? t('clients.playUrlTitleFrom', { name: playClientName }) : t('clients.playUrlTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t('clients.playUrlDescription')}
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('clients.mediaBot')}</Label>
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder={runningBots.length === 0 ? t('clients.noRunningBots') : t('clients.selectBot')} />
                </SelectTrigger>
                <SelectContent>
                  {runningBots.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)} className="cursor-pointer">
                      {b.name} — {b.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('clients.mediaUrlLabel')}</Label>
              <Input
                value={ytUrl}
                onChange={(e) => setYtUrl(e.target.value)}
                placeholder={t('clients.mediaUrlPlaceholder')}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePlayDialog}>{tc('action.cancel')}</Button>
            <Button
              onClick={handlePlayYouTube}
              disabled={!selectedBotId || !ytUrl.trim() || playUrl.isPending || runningBots.length === 0}
            >
              <Youtube className="h-4 w-4 mr-1" />
              {playUrl.isPending ? t('clients.starting') : tc('action.play')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Play Radio */}
      <Dialog open={playMode === 'radio'} onOpenChange={(open) => !open && closePlayDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{playClientName ? t('clients.radioTitleFrom', { name: playClientName }) : t('clients.radioTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            {t('clients.radioDescription')}
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('clients.mediaBot')}</Label>
              <Select value={selectedBotId} onValueChange={setSelectedBotId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder={runningBots.length === 0 ? t('clients.noRunningBots') : t('clients.selectBot')} />
                </SelectTrigger>
                <SelectContent>
                  {runningBots.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)} className="cursor-pointer">
                      {b.name} — {b.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t('clients.station')}</Label>
              <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder={stationList.length === 0 ? t('clients.noStations') : t('clients.selectStation')} />
                </SelectTrigger>
                <SelectContent>
                  {stationList.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)} className="cursor-pointer">
                      {s.name}{s.genre ? ` (${s.genre})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closePlayDialog}>{tc('action.cancel')}</Button>
            <Button
              onClick={handlePlayRadio}
              disabled={!selectedBotId || !selectedStationId || playRadio.isPending || runningBots.length === 0 || stationList.length === 0}
            >
              <Radio className="h-4 w-4 mr-1" />
              {playRadio.isPending ? t('clients.starting') : tc('action.play')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
