import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SkipForward, Trash2 } from 'lucide-react';
import type { VideoQueueItemInfo, VideoQueueState } from '@ts6/common';
import { Button } from '@/components/ui/button';
import {
  useClearVideoQueue, useMoveQueuedVideo, usePlayQueuedVideo, usePlayVideoQueue, useRemoveQueuedVideo, useSkipVideo,
} from '@/hooks/use-music-bots';
import { apiErrorMessage } from '@/lib/api-error';
import { droppedMove, moveUpNext, rowKeys, videoRowDetail } from './console-queue';
import { Row, useUpNextSensors } from './UpNextQueue';

const NO_ITEMS: VideoQueueItemInfo[] = [];

/** The dashed strip for a video queue that is waiting, with its Play queue button. */
function KeptStrip({ text, label, disabled, starting, onPlay }: {
  text: string; label?: string; disabled: boolean; starting: boolean; onPlay(): void;
}) {
  const { t } = useTranslation('bots');
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-2 text-sm text-muted-foreground">
      <span>{text}</span>
      <Button variant="outline" size="sm" className="h-9" disabled={disabled} aria-label={label} onClick={onPlay}>
        {starting ? t('videoQueue.starting') : t('queue.playQueue')}
      </Button>
    </div>
  );
}

/** Up next before the video queue has loaded, or when it could not be. */
function QueueNotLoaded({ loadError }: { loadError: unknown }) {
  const { t } = useTranslation('bots');
  return (
    <section aria-labelledby="up-next" className="space-y-3 border-t pt-4">
      <h2 id="up-next" className="text-sm font-semibold">{t('queue.heading')}</h2>
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('videoQueue.loadError', { detail: apiErrorMessage(loadError, t('queue.tryAgain')) })}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('queue.loading')}</p>
      )}
    </section>
  );
}

/**
 * The bot's queued videos. Positions in this list are the upcoming indexes the
 * queue routes take; the playing video is not in it and changes with Skip.
 */
export function VideoUpNext({ botId, state, streaming, loadError, stripOnly = false }: {
  botId: number;
  state: VideoQueueState | undefined;
  /** A video is streaming on this bot. */
  streaming: boolean;
  /** The last queue request failed; shown when there is no queue to show instead. */
  loadError: unknown;
  /** The music lane owns Up next: show this queue as its one-line kept strip only. */
  stripOnly?: boolean;
}) {
  const { t } = useTranslation('bots');
  const move = useMoveQueuedVideo();
  const remove = useRemoveQueuedVideo();
  const playAt = usePlayQueuedVideo();
  const playQueue = usePlayVideoQueue();
  const skip = useSkipVideo();
  const clear = useClearVideoQueue();

  const serverItems = state?.upNext ?? NO_ITEMS;
  // Optimistic order while a move is in flight, as in the music lane.
  const [localItems, setLocalItems] = useState<VideoQueueItemInfo[] | null>(null);
  useEffect(() => {
    if (!move.isPending) setLocalItems(null);
  }, [serverItems, move.isPending]);
  const items = localItems ?? serverItems;
  const keys = useMemo(() => rowKeys(items), [items]);
  const starting = playAt.isPending || playQueue.isPending || skip.isPending;
  const busy = move.isPending || remove.isPending || clear.isPending || starting;
  const failed = [skip, playAt, playQueue, move, remove, clear].find((m) => m.isError)?.error;

  const sensors = useUpNextSensors();
  const startQueue = () => playQueue.mutate({ botId });

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    // One move at a time: a second drop would send indexes from the unsaved order.
    const moved = move.isPending ? null : droppedMove(keys, active.id, over?.id);
    if (!moved) return;
    setLocalItems(moveUpNext(items, moved.from, moved.to));
    move.mutate({ botId, ...moved });
  };

  if (stripOnly) {
    if (items.length === 0) return null;
    return (
      <KeptStrip text={t('videoQueue.kept', { count: items.length })}
        label={t('videoQueue.playAria')} disabled={busy} starting={playQueue.isPending} onPlay={startQueue} />
    );
  }

  if (!state) {
    // Nothing to manage on an idle bot until the queue has loaded.
    return streaming || loadError ? <QueueNotLoaded loadError={loadError} /> : null;
  }

  if (!streaming && items.length === 0) return null;

  return (
    <section aria-labelledby="up-next" className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 id="up-next" className="text-sm font-semibold">{t('queue.headingCount', { count: items.length })}</h2>
          {items.length > 1 && <span className="text-xs text-muted-foreground">{t('queue.dragHint')}</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" className="h-9" disabled={!streaming || busy}
            aria-label={t('videoQueue.skipAria')} onClick={() => skip.mutate({ botId })}>
            <SkipForward className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> {skip.isPending ? t('videoQueue.skipping') : t('common:action.skip')}
          </Button>
          <Button variant="ghost" size="sm" className="h-9" disabled={items.length === 0 || busy}
            onClick={() => clear.mutate({ botId })}>
            <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> {t('common:action.clear')}
          </Button>
        </div>
      </div>

      {loadError != null && (
        <p role="alert" className="text-sm text-destructive">
          {t('videoQueue.refreshError', { detail: apiErrorMessage(loadError, t('queue.tryAgain')) })}
        </p>
      )}
      {failed != null && (
        <p role="alert" className="text-sm text-destructive">
          {apiErrorMessage(failed, t('videoQueue.changeFailed'))}
        </p>
      )}

      {state.kept && items.length > 0 && (
        <KeptStrip text={t('videoQueue.keptIdle', { count: items.length })}
          disabled={busy} starting={playQueue.isPending} onPlay={startQueue} />
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('videoQueue.empty')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={keys} strategy={verticalListSortingStrategy}>
            <ol aria-label={t('queue.heading')} className="max-h-[28rem] space-y-1.5 overflow-y-auto">
              {items.map((item, i) => (
                <Row key={keys[i]} rowKey={keys[i]} item={{ title: item.title, artist: videoRowDetail(item, t) }}
                  disabled={busy} dragDisabled={move.isPending}
                  onPlay={() => playAt.mutate({ botId, index: i })}
                  onRemove={() => remove.mutate({ botId, index: i })} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
