import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  useIptvPlaylists, useCreateIptvPlaylist, useUploadIptvPlaylist, useReplaceIptvPlaylistFile,
  useDeleteIptvPlaylist, useRefreshIptvPlaylist,
  useIptvGroups, useIptvChannels,
} from '@/hooks/use-iptv';
import { useMusicBots } from '@/hooks/use-music-bots';
import { useServers } from '@/hooks/use-servers';
import { useServerStore } from '@/stores/server.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { RefreshStatus, StaleDataNotice } from '@/components/shared/RefreshStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IptvLocalHostsDialog, IptvLocalHostsTrigger } from '@/components/iptv/IptvLocalHostsDialog';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tv, Plus, Trash2, RefreshCw, Play, Search, ChevronLeft, ChevronRight, Loader2, Radio, AlertCircle, Upload, Link2, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import type { IptvPlaylistSummary, IptvChannelInfo, IptvChannelPage, MusicBotSummary } from '@ts6/common';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { iptvConsolePath } from '@/pages/bot-hub/iptv-deep-link';
import { formatLocalDateTime, formatNumber } from '@/lib/formatting';
import { apiErrorMessage } from '@/lib/api-error';
import { RuntimeMediaDiagnostics } from '@/components/media/RuntimeMediaDiagnostics';

const ACCEPT_PLAYLIST = '.m3u,.m3u8,.txt,audio/x-mpegurl,application/vnd.apple.mpegurl,text/plain';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Channel browser ─────────────────────────────────────────────────────────

function ChannelBrowser({ playlist, bots }: {
  playlist: IptvPlaylistSummary;
  bots: MusicBotSummary[];
}) {
  const { t } = useTranslation('media');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 24;

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: groups } = useIptvGroups(playlist.id);
  const groupList: string[] = Array.isArray(groups) ? groups : [];
  const { data, isFetching } = useIptvChannels(playlist.id, {
    search: debounced || undefined,
    group: group || undefined,
    page,
    pageSize,
  }) as { data: IptvChannelPage | undefined; isFetching: boolean };

  // Any bot on this playlist's server can stream it; the console starts a stopped bot.
  const serverBots = bots.filter((b) => b.serverConfigId === playlist.serverConfigId);

  const channels: IptvChannelInfo[] = data?.channels ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      <RuntimeMediaDiagnostics
        focus={['sidecar', 'ffmpeg', 'yt-dlp']}
        showPrerequisite
      />
      {serverBots.length === 0 ? (
        <p className="text-[11px] text-amber-500 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>
            <Trans
              i18nKey="iptv.noBotHint"
              ns="media"
              components={{
                hub: <Link to="/bot-hub" className="underline underline-offset-2" />,
              }}
            >
              Create a media bot on this server in the <Link to="/bot-hub" className="underline underline-offset-2">Bot Hub</Link> to stream.
            </Trans>
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground px-0.5">
          {t('iptv.streamOnHint')}
        </p>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            aria-label={t('iptv.searchAria')}
            placeholder={t('iptv.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
        {groupList.length > 0 && (
          <Select value={group || '__all__'} onValueChange={(v) => { setGroup(v === '__all__' ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-10 w-full text-xs sm:h-8 sm:w-52"><SelectValue placeholder={t('iptv.allGroups')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('iptv.allGroups')}</SelectItem>
              {groupList.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Channel grid */}
      {channels.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">
          {t(isFetching ? 'iptv.loading' : 'iptv.noChannels')}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md border p-2 group hover:border-primary/40 transition-colors">
              <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {c.logo
                  ? <img src={c.logo} alt="" className="h-full w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  : <Radio className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{c.name}</p>
                {c.groupTitle && <p className="text-[10px] text-muted-foreground truncate">{c.groupTitle}</p>}
              </div>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 shrink-0 px-2 text-xs"
                    disabled={serverBots.length === 0}
                    aria-label={t('iptv.streamOnAria', { channel: c.name })}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> {t('iptv.streamOn')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t('iptv.openInConsole')}</DropdownMenuLabel>
                  {serverBots.map((b) => (
                    <DropdownMenuItem key={b.id} onSelect={() => navigate(iptvConsolePath(b.id, playlist.id, c))}>
                      {b.name}
                      <span className="ml-2 text-[10px] text-muted-foreground">{t(`status.${b.status}`)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {t(isFetching ? 'iptv.channelCountUpdating' : 'iptv.channelCount', {
            count: total,
            formatted: formatNumber(total),
          })}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" aria-label={t('iptv.previousPage')} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="tabular-nums">{page} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-7 w-7" aria-label={t('iptv.nextPage')} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add playlist dialog ─────────────────────────────────────────────────────

function AddPlaylistDialog({ open, onClose, serverConfigId }: { open: boolean; onClose: () => void; serverConfigId: number | null }) {
  const { t } = useTranslation('media');
  const create = useCreateIptvPlaylist();
  const upload = useUploadIptvPlaylist();
  const [source, setSource] = useState<'url' | 'upload'>('url');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [refresh, setRefresh] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pending = create.isPending || upload.isPending;

  const reset = () => {
    setName('');
    setUrl('');
    setRefresh('0');
    setFile(null);
    setSource('url');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = () => {
    if (!serverConfigId) { toast.error(t('iptv.selectServerFirst')); return; }
    if (!name.trim()) { toast.error(t('iptv.nameRequired')); return; }

    if (source === 'url') {
      if (!url.trim()) { toast.error(t('iptv.m3uUrlRequired')); return; }
      create.mutate(
        { name: name.trim(), url: url.trim(), serverConfigId, autoRefreshMinutes: parseInt(refresh) || 0 },
        {
          onSuccess: (res: any) => {
            const count = Number(res?.channelCount ?? 0);
            if (res?.refreshError) {
              toast.warning(t('iptv.playlistAddedRefreshFailed', { error: res.refreshError }));
            } else {
              toast.success(t('iptv.playlistAdded', { count, formatted: formatNumber(count) }));
            }
            reset();
            onClose();
          },
          onError: (e: any) => toast.error(e?.response?.data?.error || t('iptv.playlistAddFailed')),
        },
      );
      return;
    }

    if (!file) { toast.error(t('iptv.chooseFile')); return; }
    upload.mutate(
      { name: name.trim(), serverConfigId, file },
      {
        onSuccess: (res: any) => {
          const count = Number(res?.channelCount ?? 0);
          toast.success(t('iptv.playlistUploaded', { count, formatted: formatNumber(count) }));
          reset();
          onClose();
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || t('iptv.playlistUploadFailed')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('iptv.addTitle')}</DialogTitle>
          <DialogDescription>
            {t('iptv.addDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <Tabs value={source} onValueChange={(v) => setSource(v as 'url' | 'upload')}>
            <TabsList className="w-full">
              <TabsTrigger value="url" className="flex-1">
                <Link2 className="h-3.5 w-3.5 mr-1.5" /> {t('iptv.playlistUrl')}
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex-1">
                <Upload className="h-3.5 w-3.5 mr-1.5" /> {t('iptv.uploadFile')}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-1.5">
            <Label htmlFor="iptv-playlist-name" className="text-xs">{t('iptv.name')}</Label>
            <Input id="iptv-playlist-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('iptv.namePlaceholder')} autoFocus />
          </div>

          {source === 'url' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="iptv-playlist-url" className="text-xs">{t('iptv.m3uUrl')}</Label>
                <Input id="iptv-playlist-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://provider/get.php?...&type=m3u_plus" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="iptv-playlist-refresh" className="text-xs">{t('iptv.autoRefresh')}</Label>
                <Input id="iptv-playlist-refresh" type="number" min={0} value={refresh} onChange={(e) => setRefresh(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="iptv-playlist-file" className="text-xs">{t('iptv.playlistFile')}</Label>
              <Input
                id="iptv-playlist-file"
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_PLAYLIST}
                className="cursor-pointer text-xs file:mr-3"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t('iptv.fileHelp')}
              </p>
              {file && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {t('iptv.selectedFile', { file: file.name, size: formatFileSize(file.size) })}
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>{t('iptv.cancel')}</Button>
          <Button onClick={submit} disabled={pending} aria-busy={pending}>
            {pending
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t(source === 'upload' ? 'iptv.uploading' : 'iptv.adding')}</>
              : t(source === 'upload' ? 'iptv.uploadAndLoad' : 'iptv.addAndLoad')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Replace uploaded file dialog ────────────────────────────────────────────

function ReplaceFileDialog({
  playlist,
  open,
  onClose,
}: {
  playlist: IptvPlaylistSummary | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('media');
  const replace = useReplaceIptvPlaylistFile();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = () => {
    if (!playlist || !file) { toast.error(t('iptv.chooseFileRequired')); return; }
    replace.mutate(
      { id: playlist.id, file },
      {
        onSuccess: (res: any) => {
          const count = Number(res?.channelCount ?? 0);
          toast.success(t('iptv.fileReplaced', { count, formatted: formatNumber(count) }));
          reset();
          onClose();
        },
        onError: (e: any) => toast.error(e?.response?.data?.error || t('iptv.replaceFailed')),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('iptv.replaceTitle')}</DialogTitle>
          <DialogDescription>
            {t('iptv.replaceDescription', { playlist: playlist?.name })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          <Label htmlFor="iptv-replace-file" className="text-xs">{t('iptv.newPlaylistFile')}</Label>
          <Input
            id="iptv-replace-file"
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_PLAYLIST}
            className="cursor-pointer text-xs file:mr-3"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="text-[11px] text-muted-foreground truncate">
              {t('iptv.selectedFile', { file: file.name, size: formatFileSize(file.size) })}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>{t('iptv.cancel')}</Button>
          <Button onClick={submit} disabled={!file || replace.isPending} aria-busy={replace.isPending}>
            {replace.isPending
              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('iptv.replacing')}</>
              : t('iptv.replaceAndRefresh')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Iptv() {
  const { t } = useTranslation('media');
  const [searchParams] = useSearchParams();
  const linkedServer = Number(searchParams.get('server')) || null;
  const { data: servers } = useServers();
  const serverList = Array.isArray(servers) ? servers : [];
  const { selectedConfigId, setServer } = useServerStore();
  const isAdmin = useAuthStore((state) => state.isAdmin());

  // Prefer ?server= from Media Bot Play, else default to the first server.
  useEffect(() => {
    if (linkedServer) {
      setServer(linkedServer);
      return;
    }
    if (!selectedConfigId && serverList.length > 0) setServer(serverList[0].id);
  }, [serverList, selectedConfigId, setServer, linkedServer]);

  const { data: playlists, isLoading, error, refetch, isFetching } = useIptvPlaylists(selectedConfigId ?? undefined);
  const { data: bots } = useMusicBots();
  const botList: MusicBotSummary[] = Array.isArray(bots) ? bots : [];

  const deletePlaylist = useDeleteIptvPlaylist();
  const refreshPlaylist = useRefreshIptvPlaylist();

  const [addOpen, setAddOpen] = useState(false);
  const [hostsOpen, setHostsOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<IptvPlaylistSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IptvPlaylistSummary | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);

  if (isLoading && playlists === undefined) return <PageLoader />;
  if (error && playlists === undefined) {
    return (
      <div className="space-y-4">
        <EmptyState icon={Tv} title={t('iptv.loadFailed')} description={apiErrorMessage(error, t('iptv.checkConnection'))} />
        <div className="flex justify-center">
          <Button size="sm" variant="outline" onClick={() => { void refetch(); }} disabled={isFetching} aria-busy={isFetching}>
            {t(isFetching ? 'iptv.retrying' : 'iptv.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const playlistList: IptvPlaylistSummary[] = Array.isArray(playlists) ? playlists : [];
  const selectedPlaylist = playlistList.find((p) => p.id === selectedPlaylistId) ?? playlistList[0] ?? null;
  const backgroundError = error
    ? apiErrorMessage(error, t('iptv.refreshFailed'))
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('iptv.title')}
        icon={Tv}
        description={t('iptv.description')}
        actions={(
          <>
            <Select value={selectedConfigId ? String(selectedConfigId) : ''} onValueChange={(v) => { setServer(parseInt(v)); setSelectedPlaylistId(null); }}>
              <SelectTrigger aria-label={t('iptv.serverAria')} className="h-10 min-w-0 flex-1 sm:h-9 sm:w-48 sm:flex-none"><SelectValue placeholder={t('iptv.selectServer')} /></SelectTrigger>
              <SelectContent>
                {serverList.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && <IptvLocalHostsTrigger onClick={() => setHostsOpen(true)} />}
            <Button onClick={() => setAddOpen(true)} disabled={!selectedConfigId}>
              <Plus className="h-4 w-4 mr-1.5" /> {t('iptv.addPlaylist')}
            </Button>
          </>
        )}
        metadata={<RefreshStatus isRefreshing={isFetching} idleLabel={t('iptv.upToDate')} refreshingLabel={t('iptv.refreshing')} />}
      />

      {backgroundError && (
        <StaleDataNotice message={backgroundError} onRetry={() => { void refetch(); }} isRetrying={isFetching} />
      )}

      {playlistList.length === 0 ? (
        <EmptyState
          icon={Tv}
          title={t('iptv.emptyTitle')}
          description={t('iptv.emptyDescription')}
        >
          <div className="flex flex-col items-center gap-3">
            <Button onClick={() => setAddOpen(true)} disabled={!selectedConfigId}>
              <Plus className="h-4 w-4 mr-1.5" /> {t('iptv.addPlaylist')}
            </Button>
            {isAdmin && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setHostsOpen(true)}
              >
                {t('iptv.localHostsHint')}
              </button>
            )}
          </div>
        </EmptyState>
      ) : (
        <>
          {/* Playlist cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playlistList.map((p) => {
              const isUpload = p.sourceType === 'upload';
              return (
              <Card
                key={p.id}
                className={`cursor-pointer transition-colors ${selectedPlaylist?.id === p.id ? 'border-primary/50' : 'hover:border-primary/30'}`}
                onClick={() => setSelectedPlaylistId(p.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                  event.preventDefault();
                  setSelectedPlaylistId(p.id);
                }}
                role="button"
                tabIndex={0}
                aria-label={t('iptv.viewChannelsAria', { name: p.name })}
                aria-pressed={selectedPlaylist?.id === p.id}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm truncate">{p.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {isUpload && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setReplaceTarget(p); }}
                          aria-label={t('iptv.replaceFileAria', { name: p.name })}
                          title={t('iptv.replaceFile')}
                        >
                          <FileUp className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); refreshPlaylist.mutate(p.id, {
                          onSuccess: (r: any) => toast.success(t('iptv.refreshed', {
                            count: Number(r.channelCount),
                            formatted: formatNumber(Number(r.channelCount)),
                          })),
                          onError: (err: any) => toast.error(err?.response?.data?.error || t('iptv.refreshFailedShort')),
                        }); }}
                        disabled={refreshPlaylist.isPending}
                        aria-label={t('iptv.refreshAria', { name: p.name })}
                        title={t(isUpload ? 'iptv.reparseStored' : 'iptv.refetchUrl')}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${refreshPlaylist.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                        aria-label={t('iptv.deleteAria', { name: p.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      {t('iptv.channelCountBadge', { count: p.channelCount, formatted: formatNumber(p.channelCount) })}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {t(isUpload ? 'iptv.uploadedFile' : 'iptv.url')}
                    </Badge>
                    {isUpload && p.originalFilename && (
                      <Badge variant="outline" className="text-[10px] max-w-[10rem] truncate" title={p.originalFilename}>
                        {p.originalFilename}
                      </Badge>
                    )}
                    {!isUpload && p.autoRefreshMinutes > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {t('iptv.autoRefreshBadge', { minutes: p.autoRefreshMinutes })}
                      </Badge>
                    )}
                  </div>
                  {p.lastError
                    ? <p className="text-[10px] text-destructive truncate flex items-center gap-1"><AlertCircle className="h-3 w-3 shrink-0" /> {p.lastError}</p>
                    : <p className="text-[10px] text-muted-foreground">{p.lastRefreshedAt
                      ? t('iptv.updated', { time: formatLocalDateTime(p.lastRefreshedAt) })
                      : t('iptv.notRefreshed')}</p>}
                </CardContent>
              </Card>
              );
            })}
          </div>

          {/* Channel browser for selected playlist */}
          {selectedPlaylist && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Radio className="h-4 w-4" /> {t('iptv.channelsTitle', { name: selectedPlaylist.name })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChannelBrowser playlist={selectedPlaylist} bots={botList} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {isAdmin && <IptvLocalHostsDialog open={hostsOpen} onOpenChange={setHostsOpen} />}

      <AddPlaylistDialog open={addOpen} onClose={() => setAddOpen(false)} serverConfigId={selectedConfigId} />
      <ReplaceFileDialog
        playlist={replaceTarget}
        open={!!replaceTarget}
        onClose={() => setReplaceTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteError(''); } }}
        title={t('iptv.deleteTitle')}
        description={t(
          deleteTarget?.sourceType === 'upload' ? 'iptv.deleteDescriptionUpload' : 'iptv.deleteDescription',
          { name: deleteTarget?.name },
        )}
        confirmLabel={t('iptv.delete')}
        destructive
        loading={deletePlaylist.isPending}
        error={deleteError}
        onConfirm={() => {
          if (deleteTarget) {
            setDeleteError('');
            deletePlaylist.mutate(deleteTarget.id, {
              onSuccess: () => {
                toast.success(t('iptv.deleted'));
                setDeleteError('');
                setDeleteTarget(null);
              },
              onError: (e: unknown) => {
                const message = apiErrorMessage(e, t('iptv.deleteFailed'));
                setDeleteError(message);
                toast.error(message);
              },
            });
          }
        }}
      />
    </div>
  );
}
