import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMusicBots } from '@/hooks/use-music-bots';
import {
  useSongs,
  useYouTubeDownload,
  useYouTubeInfo,
  useYouTubeDownloadBatch,
  useYouTubeRegister,
  useYouTubeImportPlaylist,
  useYouTubeImportStatus,
} from '@/hooks/use-music-library';
import {
  usePlaylists,
  usePlaylist,
  useCreatePlaylist,
  useUpdatePlaylist,
  useDeletePlaylist,
  useAddSongToPlaylist,
  useAddSongsToPlaylist,
  useAddPlaylistToPlaylist,
  useRemoveSongFromPlaylist,
} from '@/hooks/use-playlists';
import { useServerStore } from '@/stores/server.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Music,
  Plus,
  Trash2,
  Download,
  ListMusic,
  Pencil,
  X,
  Loader2,
  Youtube,
  FileAudio,
  Link,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  MusicBotSummary,
  SongInfo,
  PlaylistSummary,
  PlaylistDetail,
  PlaylistMode,
} from '@ts6/common';
import { settingsApi } from '@/api/settings.api';
import { formatTime, UrlLoadInfo, youtubeInfoErrorMessage, urlInfoPlaylistLabel, urlItemSelectKey, allUrlItemKeys, selectedUrlItems, importJobProgressLabel, importJobCompleteMessage, importCapHint, chunk, REGISTER_BATCH_SIZE, ADD_SONGS_BATCH_SIZE, playlistAddMessage } from './shared';
import { ImportQueueOptions } from './ImportQueueOptions';


// ─── Playlists Tab ───────────────────────────────────────────────────────────

export function PlaylistsTab() {
  const { t } = useTranslation('media');
  const qc = useQueryClient();
  const { selectedConfigId } = useServerStore();
  const { data, isLoading } = usePlaylists(selectedConfigId ?? undefined);
  const createPlaylist = useCreatePlaylist();
  const updatePlaylist = useUpdatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const addSong = useAddSongToPlaylist();
  const addSongs = useAddSongsToPlaylist();
  const addFromPlaylist = useAddPlaylistToPlaylist();
  const removeSong = useRemoveSongFromPlaylist();
  const ytInfo = useYouTubeInfo();
  const ytDownload = useYouTubeDownload();
  const ytBatchDownload = useYouTubeDownloadBatch();
  const ytRegister = useYouTubeRegister();
  const ytImportPlaylist = useYouTubeImportPlaylist();
  const { data: playlistImportLimits } = useQuery({
    queryKey: ['settings-limits'],
    queryFn: settingsApi.getLimits,
    staleTime: 60_000,
  });
  const maxPlaylistImport = playlistImportLimits?.maxPlaylistImport ?? 250;
  const { data: playlistMusicBotsData } = useMusicBots();
  const playlistMusicBots = (Array.isArray(playlistMusicBotsData) ? playlistMusicBotsData : []) as MusicBotSummary[];

  const { data: songs } = useSongs(selectedConfigId);

  const [showCreate, setShowCreate] = useState(false);
  // Page-level Add songs: pick where the songs go, then open the Add dialog for it.
  const [showPickTarget, setShowPickTarget] = useState(false);
  const [addAfterCreate, setAddAfterCreateState] = useState(false);
  // Read by the create callback, which may run after the dialog was closed.
  const addAfterCreateRef = useRef(false);
  // Bumped on cancel so a stale create success ignores Add intent.
  const createRequestIdRef = useRef(0);
  const setAddAfterCreate = (value: boolean) => {
    addAfterCreateRef.current = value;
    setAddAfterCreateState(value);
  };
  const cancelCreate = () => {
    createRequestIdRef.current += 1;
    setAddAfterCreate(false);
    setShowCreate(false);
  };
  const [pendingAddId, setPendingAddId] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<PlaylistMode>('local');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showAddSong, setShowAddSong] = useState(false);
  const [addTab, setAddTab] = useState<'songs' | 'playlists' | 'url'>('songs');
  const [songFilter, setSongFilter] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMode, setEditMode] = useState<PlaylistMode>('local');
  const [addYtUrl, setAddYtUrl] = useState('');
  // Bumped whenever the URL changes so a slow Load for an old URL is ignored.
  const addUrlRequestId = useRef(0);
  const [addUrlInfo, setAddUrlInfo] = useState<UrlLoadInfo | null>(null);
  const [addSelectedUrlIds, setAddSelectedUrlIds] = useState<Set<string>>(new Set());
  const [addBatchProgress, setAddBatchProgress] = useState<string | null>(null);
  const [addImportJobId, setAddImportJobId] = useState<string | null>(null);
  const [importQueueBotId, setImportQueueBotId] = useState('');
  const [importClearQueue, setImportClearQueue] = useState(false);

  const { data: detail } = usePlaylist(selectedId) as { data: PlaylistDetail | undefined };
  const { data: addImportJob } = useYouTubeImportStatus(selectedConfigId, addImportJobId);

  const playlists = (Array.isArray(data) ? data : []) as PlaylistSummary[];
  const songList = (Array.isArray(songs) ? songs : []) as SongInfo[];
  const playlistMode: PlaylistMode = detail?.mode === 'stream' ? 'stream' : 'local';
  const playlistSongIds = new Set((detail?.songs || []).map((s: any) => s.id));
  const isYtLinked = !!detail?.youtubePlaylistId;

  const songMatchesMode = (source: string) =>
    playlistMode === 'local' ? source === 'local' : source === 'youtube' || source === 'url';

  const availableSongs = songList.filter(
    (s) =>
      !playlistSongIds.has(s.id) &&
      songMatchesMode(s.source) &&
      (!songFilter ||
        s.title.toLowerCase().includes(songFilter.toLowerCase()) ||
        (s.artist || '').toLowerCase().includes(songFilter.toLowerCase())),
  );

  const otherPlaylists = playlists.filter((pl) => pl.id !== selectedId);

  const resetAddUrlState = () => {
    addUrlRequestId.current += 1;
    setAddYtUrl('');
    setAddUrlInfo(null);
    setAddSelectedUrlIds(new Set());
    setAddBatchProgress(null);
  };

  // Playlists belong to a server: switching servers closes the old server's
  // playlist and anything open for it.
  const shownConfigId = useRef(selectedConfigId);
  // The server a pending page-level Add was started on.
  const pendingAddConfigId = useRef(selectedConfigId);
  useEffect(() => {
    if (shownConfigId.current === selectedConfigId) return;
    shownConfigId.current = selectedConfigId;
    setSelectedId(null);
    setShowEdit(false);
    setShowAddSong(false);
    setShowPickTarget(false);
    setPendingAddId(null);
    setDeleteId(null);
    setSongFilter('');
    setAddTab('songs');
    setImportQueueBotId('');
    resetAddUrlState();
    setAddImportJobId(null);
  }, [selectedConfigId]);

  /** Open the Add dialog on the tab that suits the playlist's mode. */
  const openAddSongs = (mode: PlaylistMode) => {
    setAddTab(mode === 'stream' ? 'url' : 'songs');
    setSongFilter('');
    resetAddUrlState();
    setShowAddSong(true);
  };

  // A playlist picked from the page-level Add songs button opens its Add dialog
  // once its details (and so its mode) have loaded.
  useEffect(() => {
    if (
      pendingAddId === null ||
      detail?.id !== pendingAddId ||
      pendingAddConfigId.current !== selectedConfigId
    ) return;
    setPendingAddId(null);
    openAddSongs(detail.mode === 'stream' ? 'stream' : 'local');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAddId, detail?.id, detail?.mode, selectedConfigId]);

  /** Select a playlist and open its Add dialog once its details load. */
  const addSongsTo = (id: number) => {
    setShowPickTarget(false);
    setSelectedId(id);
    pendingAddConfigId.current = selectedConfigId;
    setPendingAddId(id);
  };

  const handleCreate = () => {
    if (createPlaylist.isPending || !newName) return;
    const createdOnConfigId = selectedConfigId;
    const requestId = ++createRequestIdRef.current;
    const addAfterCreateForRequest = addAfterCreateRef.current;
    createPlaylist.mutate(
      { name: newName, mode: newMode, serverConfigId: selectedConfigId ?? undefined },
      {
        onSuccess: (created: { id?: number } | undefined) => {
          toast.success(t('playlists.created'));
          if (createRequestIdRef.current !== requestId) return;
          if (addAfterCreateForRequest && created?.id && shownConfigId.current === createdOnConfigId) addSongsTo(created.id);
          setAddAfterCreate(false);
          setShowCreate(false);
          setNewName('');
          setNewMode('local');
        },
        onError: () => toast.error(t('playlists.createFailed')),
      },
    );
  };

  const openEdit = () => {
    if (!detail) return;
    setEditName(detail.name);
    setEditMode(detail.mode === 'stream' ? 'stream' : 'local');
    setShowEdit(true);
  };

  const handleEditSave = () => {
    if (!selectedId || !editName.trim()) return;
    const modeChanging = editMode !== playlistMode && !isYtLinked;
    updatePlaylist.mutate(
      {
        id: selectedId,
        data: {
          name: editName.trim(),
          ...(isYtLinked ? {} : { mode: editMode }),
        },
      },
      {
        onSuccess: () => {
          toast.success(t('playlists.updated'));
          if (modeChanging && (detail?.songs?.length ?? 0) > 0) {
            toast.message(t('playlists.modeChanged'));
          }
          setShowEdit(false);
        },
        onError: (err: any) => toast.error(err?.response?.data?.error || t('playlists.updateFailed')),
      },
    );
  };

  const handleAddLoadUrl = () => {
    if (!addYtUrl.trim() || !selectedConfigId) return;
    const requestId = ++addUrlRequestId.current;
    ytInfo.mutate(
      { configId: selectedConfigId, url: addYtUrl.trim() },
      {
        onSuccess: (data: UrlLoadInfo) => {
          if (requestId !== addUrlRequestId.current) return;
          setAddUrlInfo(data);
          setAddSelectedUrlIds(allUrlItemKeys(data.items.length));
        },
        onError: (err: unknown) => {
          if (requestId !== addUrlRequestId.current) return;
          toast.error(youtubeInfoErrorMessage(err));
        },
      },
    );
  };

  const toggleAddUrlSelect = (index: number) => {
    const key = urlItemSelectKey(index);
    setAddSelectedUrlIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
  const addBusy =
    addBatchProgress !== null ||
    ytDownload.isPending ||
    ytBatchDownload.isPending ||
    ytRegister.isPending ||
    addSongs.isPending;

  /** Link library songs to the open playlist; songs already in it are skipped server-side. */
  const addSongIdsToPlaylist = async (songIds: number[], stream: boolean) => {
    if (!selectedId) return;
    const ids = [...new Set(songIds)];
    let added = 0;
    let alreadyInPlaylist = 0;
    const report = () =>
      toast.success(
        playlistAddMessage({
          added,
          alreadyInPlaylist,
          playlistName: detail?.name || t('playlists.thePlaylist'),
          stream,
        }),
      );
    for (const batch of chunk(ids, ADD_SONGS_BATCH_SIZE)) {
      try {
        const res = await addSongs.mutateAsync({ playlistId: selectedId, songIds: batch });
        added += res.added;
        alreadyInPlaylist += res.alreadyInPlaylist;
      } catch (err: any) {
        // Earlier batches already landed; say so before reporting what is left.
        const handled = added + alreadyInPlaylist;
        if (handled > 0) report();
        const reason = err?.response?.data?.error || err?.message || t('playlists.requestFailed');
        throw new Error(
          handled > 0
            ? t('playlists.tracksNotAdded', { count: ids.length - handled, reason })
            : reason,
        );
      }
    }
    report();
  };

  const addUrlItems = async (items: { id: string; title?: string; artist?: string; duration?: number }[]) => {
    if (!selectedConfigId || !selectedId || items.length === 0) return;
    const songIds: number[] = [];
    const errors: string[] = [];
    try {
      if (playlistMode === 'stream') {
        // Stream playlists save each URL as a library entry; the audio is fetched when it plays.
        for (const [i, batch] of chunk(items, REGISTER_BATCH_SIZE).entries()) {
          setAddBatchProgress(t('playlists.savingProgress', {
            current: i * REGISTER_BATCH_SIZE,
            total: items.length,
          }));
          const data = await ytRegister.mutateAsync({
            configId: selectedConfigId,
            items: batch.map((i) => ({ url: watchUrl(i.id), title: i.title, artist: i.artist, duration: i.duration })),
          });
          for (const song of Array.isArray(data?.results) ? data.results : []) if (song?.id) songIds.push(song.id);
          if (Array.isArray(data?.errors)) errors.push(...data.errors);
        }
      } else if (items.length === 1) {
        setAddBatchProgress(t('playlists.downloading'));
        const song = await ytDownload.mutateAsync({ configId: selectedConfigId, url: watchUrl(items[0].id) });
        if (song?.id) songIds.push(song.id);
      } else {
        setAddBatchProgress(t('playlists.downloading'));
        const data = await ytBatchDownload.mutateAsync({ configId: selectedConfigId, urls: items.map((i) => watchUrl(i.id)) });
        for (const song of Array.isArray(data?.results) ? data.results : []) if (song?.id) songIds.push(song.id);
        if (Array.isArray(data?.errors)) errors.push(...data.errors);
      }
      if (songIds.length > 0) await addSongIdsToPlaylist(songIds, playlistMode === 'stream');
      if (errors.length > 0) {
        toast.error(t('playlists.tracksCouldNotBeAdded', { count: errors.length }), {
          description: errors[0],
        });
      }
      if (songIds.length > 0) resetAddUrlState();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || t('playlists.addTracksFailed'));
    } finally {
      setAddBatchProgress(null);
    }
  };

  const handleAddSelected = () => {
    if (!addUrlInfo) return;
    void addUrlItems(selectedUrlItems(addUrlInfo.items, addSelectedUrlIds));
  };

  const handleSendToQueue = () => {
    if (!selectedConfigId || !addYtUrl.trim()) return;
    if (!importQueueBotId) {
      toast.error(t('playlists.selectRunningBot'));
      return;
    }
    ytImportPlaylist.mutate(
      {
        configId: selectedConfigId,
        url: addYtUrl.trim(),
        musicBotId: parseInt(importQueueBotId, 10),
        clearFirst: importClearQueue,
      },
      {
        onSuccess: (data: any) => {
          setAddImportJobId(data.jobId);
          toast.success(t('playlists.sendingToQueue'), {
            description: t('playlists.keepsGoing', { hint: importCapHint(maxPlaylistImport) }),
          });
        },
        onError: (err: any) =>
          toast.error(err?.response?.data?.error || t('playlists.queueImportFailedToStart')),
      },
    );
  };

  useEffect(() => {
    if (addImportJob?.status === 'completed') {
      toast.success(importJobCompleteMessage(addImportJob));
      qc.invalidateQueries({ queryKey: ['songs', selectedConfigId] });
      qc.invalidateQueries({ queryKey: ['playlist', selectedId] });
      qc.invalidateQueries({ queryKey: ['playlists'] });
      if (addImportJob.musicBotId) {
        qc.invalidateQueries({ queryKey: ['music-bot', addImportJob.musicBotId] });
        qc.invalidateQueries({ queryKey: ['music-bot-state', addImportJob.musicBotId] });
      }
      setAddImportJobId(null);
    } else if (addImportJob?.status === 'failed') {
      toast.error(addImportJob.errors?.[0] || t('playlists.queueImportFailed'));
      setAddImportJobId(null);
    }
  }, [addImportJob?.status, selectedConfigId, selectedId, qc, addImportJob]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('playlists.count', { count: playlists.length })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (playlists.length === 0) {
                setNewName('');
                setNewMode('local');
                setAddAfterCreate(true);
                setShowCreate(true);
              } else {
                setShowPickTarget(true);
              }
            }}
          >
            <Music className="h-4 w-4 mr-1" /> {t('playlists.addSongs')}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setNewName('');
              setNewMode('local');
              setAddAfterCreate(false);
              setShowCreate(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> {t('playlists.newPlaylist')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="space-y-1.5">
          {playlists.length === 0 ? (
            <EmptyState
              icon={ListMusic}
              title={t('playlists.emptyTitle')}
              description={t('playlists.emptyDescription')}
            />
          ) : (
            playlists.map((pl) => (
              <div
                key={pl.id}
                className={`flex items-center gap-2 p-2.5 rounded-md cursor-pointer transition-colors ${
                  selectedId === pl.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted/50 border border-transparent'
                }`}
                onClick={() => {
                  setSelectedId(pl.id);
                  setPendingAddId(null);
                }}
              >
                <ListMusic
                  className={`h-4 w-4 shrink-0 ${selectedId === pl.id ? 'text-primary' : 'text-muted-foreground'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{pl.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      {t(pl.mode === 'stream' ? 'playlists.modeStream' : 'playlists.modeLocal')}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground">
                      {t('playlists.songCount', { count: pl.songCount })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
                  aria-label={t('playlists.deletePlaylistAria', { name: pl.name })}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(pl.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))
          )}
        </div>

        {selectedId && detail ? (
          <Card>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm truncate">{detail.name}</CardTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t(playlistMode === 'local'
                      ? 'playlists.localDescription'
                      : 'playlists.streamDescription')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openEdit}>
                    <Pencil className="h-3 w-3 mr-1" /> {t('playlists.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => openAddSongs(playlistMode)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> {t('playlists.addSongsButton')}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {detail.songs.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {t('playlists.noSongsInPlaylist')}
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  {detail.songs.map((song: any, i: number) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-muted/30 transition-colors border-t border-border/50"
                    >
                      <span className="text-[10px] text-muted-foreground w-5 text-right">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{song.title}</p>
                        {song.artist && (
                          <p className="text-[10px] text-muted-foreground truncate">{song.artist}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                        {song.source}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{formatTime(song.duration)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        aria-label={t('playlists.removeSongAria', { title: song.title })}
                        onClick={() =>
                          removeSong.mutate(
                            { playlistId: selectedId, songId: song.id },
                            { onSuccess: () => toast.success(t('playlists.songRemoved')) },
                          )
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center text-xs text-muted-foreground py-16">
            {t('playlists.selectPlaylist')}
          </div>
        )}
      </div>

      <Dialog
        open={showPickTarget}
        onOpenChange={setShowPickTarget}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('playlists.addSongsTitle')}</DialogTitle>
            <DialogDescription>{t('playlists.addSongsDescription')}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-72">
            <div className="space-y-1">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  onClick={() => addSongsTo(pl.id)}
                >
                  <ListMusic className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{pl.name}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {t('playlists.songCountAndMode', {
                        count: pl.songCount,
                        mode: t(pl.mode === 'stream' ? 'playlists.modeStream' : 'playlists.modeLocal'),
                      })}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPickTarget(false);
                setNewName('');
                setNewMode('local');
                setAddAfterCreate(true);
                setShowCreate(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> {t('playlists.newPlaylistEllipsis')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (open) setShowCreate(true);
          else cancelCreate();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('playlists.newPlaylist')}</DialogTitle>
            <DialogDescription>{t('playlists.newPlaylistDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('playlists.name')}</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('playlists.playlistNamePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <Label className="text-xs">{t('playlists.mode')}</Label>
              <Select value={newMode} onValueChange={(v) => setNewMode(v as PlaylistMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">{t('playlists.modeLocalOnly')}</SelectItem>
                  <SelectItem value="stream">{t('playlists.modeStreamOnly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelCreate}>
              {t('playlists.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!newName || createPlaylist.isPending}>
              {t(addAfterCreate ? 'playlists.createAndAdd' : 'playlists.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('playlists.editPlaylist')}</DialogTitle>
            <DialogDescription>{t('playlists.editPlaylistDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('playlists.name')}</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t('playlists.playlistNamePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && editName.trim() && handleEditSave()}
              />
            </div>
            <div>
              <Label className="text-xs">{t('playlists.mode')}</Label>
              <Select
                value={editMode}
                onValueChange={(v) => setEditMode(v as PlaylistMode)}
                disabled={isYtLinked}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">{t('playlists.modeLocalOnly')}</SelectItem>
                  <SelectItem value="stream">{t('playlists.modeStreamOnly')}</SelectItem>
                </SelectContent>
              </Select>
              {isYtLinked && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('playlists.youtubeStaysStream')}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>
              {t('playlists.cancel')}
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!editName.trim() || updatePlaylist.isPending}
            >
              {t('playlists.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAddSong}
        onOpenChange={(open) => {
          setShowAddSong(open);
          if (!open) {
            setSongFilter('');
            setAddTab('songs');
            resetAddUrlState();
          }
        }}
      >
        <DialogContent className="max-w-lg grid-cols-[minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>{detail?.name
              ? t('playlists.addTo', { playlist: detail.name })
              : t('playlists.addToFallback')}</DialogTitle>
            <DialogDescription>
              {t(playlistMode === 'local'
                ? 'playlists.addDescriptionLocal'
                : 'playlists.addDescriptionStream')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={addTab === 'songs' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAddTab('songs')}
            >
              <FileAudio className="h-3 w-3 mr-1" /> {t('playlists.tabSongs')}
            </Button>
            <Button
              variant={addTab === 'playlists' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAddTab('playlists')}
            >
              <ListMusic className="h-3 w-3 mr-1" /> {t('playlists.tabFromPlaylist')}
            </Button>
            {playlistMode === 'stream' && (
              <Button
                variant={addTab === 'url' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAddTab('url')}
              >
                <Link className="h-3 w-3 mr-1" /> {t('playlists.tabUrl')}
              </Button>
            )}
          </div>

          {addTab === 'songs' ? (
            <>
              <Input
                value={songFilter}
                onChange={(e) => setSongFilter(e.target.value)}
                placeholder={t('playlists.filterSongs')}
              />
              <ScrollArea className="max-h-72">
                {availableSongs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {t('playlists.noMatchingSongs', {
                      mode: t(playlistMode === 'local'
                        ? 'playlists.modeLocal'
                        : 'playlists.modeStream'),
                    })}
                  </p>
                ) : (
                  availableSongs.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center gap-2 py-1.5 hover:bg-muted/30 transition-colors rounded px-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs truncate">{song.title}</p>
                        {song.artist && (
                          <p className="text-[10px] text-muted-foreground truncate">{song.artist}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                        {song.source}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] shrink-0"
                        onClick={() => {
                          if (selectedId)
                            addSong.mutate(
                              { playlistId: selectedId, songId: song.id },
                              {
                                onSuccess: () => toast.success(t('playlists.songAdded')),
                                onError: (err: any) =>
                                  toast.error(err?.response?.data?.error || t('playlists.addSongFailed')),
                              },
                            );
                        }}
                      >
                        <Plus className="h-3 w-3 mr-0.5" /> {t('playlists.add')}
                      </Button>
                    </div>
                  ))
                )}
              </ScrollArea>
            </>
          ) : addTab === 'playlists' ? (
            <ScrollArea className="max-h-72">
              {otherPlaylists.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {t('playlists.noOtherPlaylists')}
                </p>
              ) : (
                otherPlaylists.map((pl) => (
                  <div
                    key={pl.id}
                    className="flex items-center gap-2 py-1.5 hover:bg-muted/30 transition-colors rounded px-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{pl.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t('playlists.songCountAndMode', {
                          count: pl.songCount,
                          mode: t(pl.mode === 'stream'
                            ? 'playlists.modeStream'
                            : 'playlists.modeLocal'),
                        })}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] shrink-0"
                      disabled={addFromPlaylist.isPending}
                      onClick={() => {
                        if (!selectedId) return;
                        addFromPlaylist.mutate(
                          { playlistId: selectedId, sourcePlaylistId: pl.id },
                          {
                            onSuccess: (res: any) => {
                              const added = res?.added ?? 0;
                              toast.success(
                                added > 0
                                  ? t('playlists.addedFromPlaylist', {
                                    count: added,
                                    playlist: pl.name,
                                  })
                                  : t('playlists.nothingNewToAdd'),
                              );
                            },
                            onError: (err: any) =>
                              toast.error(err?.response?.data?.error || t('playlists.playlistImportFailed')),
                          },
                        );
                      }}
                    >
                      <Plus className="h-3 w-3 mr-0.5" /> {t('playlists.addAllMatching')}
                    </Button>
                  </div>
                ))
              )}
            </ScrollArea>
          ) : (
            <div className="min-w-0 space-y-3">
              {!selectedConfigId ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {t('playlists.selectServerForUrl')}
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Link className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={addYtUrl}
                        onChange={(e) => {
                          addUrlRequestId.current += 1;
                          setAddYtUrl(e.target.value);
                          setAddUrlInfo(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddLoadUrl()}
                        placeholder={t('playlists.urlPlaceholder')}
                        aria-label={t('playlists.urlAria')}
                        className="pl-9"
                      />
                    </div>
                    <Button
                      variant={addUrlInfo ? 'outline' : 'default'}
                      size="sm"
                      className="shrink-0"
                      onClick={handleAddLoadUrl}
                      disabled={ytInfo.isPending || !addYtUrl.trim()}
                    >
                      {ytInfo.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Youtube className="h-4 w-4 mr-1" />
                      )}
                      {t('playlists.load')}
                    </Button>
                  </div>
                  {ytInfo.isPending ? (
                    <p className="text-[10px] text-muted-foreground">
                      {t('playlists.loadingTracks')}
                    </p>
                  ) : (
                    !addUrlInfo && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('playlists.urlHelp')}
                      </p>
                    )
                  )}

                  {addUrlInfo && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {urlInfoPlaylistLabel(addUrlInfo)}
                        </Badge>
                        {addUrlInfo.type === 'playlist' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px]"
                              onClick={() => setAddSelectedUrlIds(allUrlItemKeys(addUrlInfo.items.length))}
                            >
                              {t('playlists.selectAll')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px]"
                              onClick={() => setAddSelectedUrlIds(new Set())}
                            >
                              {t('playlists.selectNone')}
                            </Button>
                          </>
                        )}
                      </div>
                      <ScrollArea className="max-h-60 [&>[data-radix-scroll-area-viewport]>div]:!block">
                        {addUrlInfo.items.map((item, index) => (
                          <div
                            key={`${item.id}-${index}`}
                            className={`flex min-w-0 items-center gap-3 px-2 py-1.5 rounded transition-colors ${
                              addUrlInfo.type === 'playlist'
                                ? `cursor-pointer ${addSelectedUrlIds.has(urlItemSelectKey(index)) ? 'bg-primary/10' : 'hover:bg-muted/50'}`
                                : 'hover:bg-muted/50'
                            }`}
                            onClick={() => addUrlInfo.type === 'playlist' && toggleAddUrlSelect(index)}
                          >
                            {addUrlInfo.type === 'playlist' && (
                              <input
                                type="checkbox"
                                checked={addSelectedUrlIds.has(urlItemSelectKey(index))}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleAddUrlSelect(index)}
                                aria-label={t('playlists.selectTrackAria', { title: item.title })}
                                className="shrink-0 accent-primary"
                              />
                            )}
                            {item.thumbnail && (
                              <img src={item.thumbnail} alt="" className="h-8 w-12 rounded object-cover shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{item.title}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {item.artist} - {formatTime(item.duration)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={handleAddSelected}
                        disabled={addBusy || (addUrlInfo.type === 'playlist' && addSelectedUrlIds.size === 0)}
                      >
                        {addBusy ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            {ytDownload.progress || ytBatchDownload.progress || addBatchProgress || t('playlists.adding')}
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            {addUrlInfo.type === 'playlist'
                              ? (detail?.name
                                ? t('playlists.addTracksTo', {
                                  count: addSelectedUrlIds.size,
                                  playlist: detail.name,
                                })
                                : t('playlists.addTracksToFallback', {
                                  count: addSelectedUrlIds.size,
                                }))
                              : (detail?.name
                                ? t('playlists.addTo', { playlist: detail.name })
                                : t('playlists.addToFallback'))}
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-[10px] text-muted-foreground">
                      {t('playlists.queueInstead')}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ImportQueueOptions
                        bots={playlistMusicBots}
                        configId={selectedConfigId}
                        botId={importQueueBotId}
                        onBotIdChange={setImportQueueBotId}
                        clearFirst={importClearQueue}
                        onClearFirstChange={setImportClearQueue}
                      />
                      {importQueueBotId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleSendToQueue}
                          disabled={!addYtUrl.trim() || ytImportPlaylist.isPending || !!addImportJobId}
                        >
                          {addImportJobId ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              {importJobProgressLabel(addImportJob)}
                            </>
                          ) : (
                            <>
                              <ListMusic className="h-3 w-3 mr-1" /> {t('playlists.sendToQueue')}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSong(false);
                setSongFilter('');
                resetAddUrlState();
              }}
            >
              {t('playlists.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title={t('playlists.deletePlaylistTitle')}
        description={t('playlists.deletePlaylistDescription')}
        onConfirm={() => {
          if (deleteId)
            deletePlaylist.mutate(deleteId, {
              onSuccess: () => {
                toast.success(t('playlists.playlistDeleted'));
                if (selectedId === deleteId) setSelectedId(null);
                setDeleteId(null);
              },
            });
        }}
        destructive
      />
    </div>
  );
}

