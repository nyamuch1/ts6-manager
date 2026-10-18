import axios from 'axios';
import type { YouTubeSearchResult } from '@ts6/common';
import i18n from '../../i18n';


// ─── Helper ──────────────────────────────────────────────────────────────────

export function formatTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}


export interface UrlLoadInfo {
  type: 'video' | 'playlist';
  items: YouTubeSearchResult[];
  title?: string;
  sourceTrackCount?: number;
  matchedCount?: number;
  cappedAt?: number;
}


export function youtubeInfoErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
    return i18n.t('media:shared.matchTimeout');
  }
  if (axios.isAxiosError(err) && err.response?.data?.error) {
    return String(err.response.data.error);
  }
  return i18n.t('media:shared.urlInfoFailed');
}


export function urlInfoPlaylistLabel(info: UrlLoadInfo): string {
  if (info.type !== 'playlist') return i18n.t('media:shared.singleTrack');
  if (info.sourceTrackCount != null && info.matchedCount != null) {
    const cap = info.cappedAt ?? info.items.length;
    return i18n.t('media:shared.matchedOfSource', {
      matched: info.matchedCount,
      source: info.sourceTrackCount,
      cap,
    });
  }
  return trackCount(info.items.length);
}


function trackCount(n: number): string {
  return i18n.t('media:shared.trackCount', { count: n });
}


/** The register endpoint accepts at most this many URLs per request. */
export const REGISTER_BATCH_SIZE = 200;


/** The playlist add endpoint accepts at most this many song IDs per request. */
export const ADD_SONGS_BATCH_SIZE = 1000;


export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}


/** Toast text after adding URL tracks to a playlist. Stream tracks are saved as links and fetched when played. */
export function playlistAddMessage({
  added,
  alreadyInPlaylist,
  playlistName,
  stream,
}: {
  added: number;
  alreadyInPlaylist: number;
  playlistName: string;
  stream: boolean;
}): string {
  if (added === 0) {
    if (alreadyInPlaylist > 0) {
      return i18n.t(
        alreadyInPlaylist === 1 ? 'media:playlistAdd.oneAlready' : 'media:playlistAdd.allAlready',
        { playlist: playlistName },
      );
    }
    return i18n.t('media:playlistAdd.nothingNew');
  }
  const key = stream
    ? (alreadyInPlaylist > 0 ? 'media:playlistAdd.addedAlreadyStream' : 'media:playlistAdd.addedStream')
    : (alreadyInPlaylist > 0 ? 'media:playlistAdd.addedAlready' : 'media:playlistAdd.added');
  return i18n.t(key, {
    count: added,
    playlist: playlistName,
    already: alreadyInPlaylist,
  });
}


export function urlItemSelectKey(index: number): string {
  return String(index);
}


export function allUrlItemKeys(count: number): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < count; i++) keys.add(urlItemSelectKey(i));
  return keys;
}


export function selectedUrlItems(items: YouTubeSearchResult[], selectedKeys: Set<string>): YouTubeSearchResult[] {
  return items.filter((_, i) => selectedKeys.has(urlItemSelectKey(i)));
}


export interface ImportJobStatus {
  phase?: 'matching' | 'importing';
  processed?: number;
  total?: number;
  matchProcessed?: number;
  matchTotal?: number;
  matched?: number;
  sourceTrackCount?: number;
  importCap?: number;
  enqueued?: number;
  musicBotId?: number;
  downloaded?: number;
  registered?: number;
  skipped?: number;
  errors?: string[];
}


export function importJobProgressLabel(job: ImportJobStatus | undefined | null): string {
  if (!job) return '?';
  if (job.phase === 'matching') {
    const ofSource =
      job.sourceTrackCount != null &&
      job.sourceTrackCount > (job.matchTotal ?? 0);
    return i18n.t(ofSource ? 'media:shared.matchingOfSource' : 'media:shared.matching', {
      processed: job.matchProcessed ?? 0,
      total: job.matchTotal ?? '?',
      source: job.sourceTrackCount ?? 0,
      hits: job.matched ?? 0,
    });
  }
  return i18n.t('media:shared.importing', {
    processed: job.processed ?? 0,
    total: job.total ?? '?',
  });
}


export function importJobCompleteMessage(job: ImportJobStatus): string {
  const parts: string[] = [];
  if ((job.registered ?? 0) > 0) {
    parts.push(i18n.t('media:shared.partRegistered', { count: job.registered }));
  }
  if ((job.enqueued ?? 0) > 0) {
    parts.push(i18n.t('media:shared.partEnqueued', { count: job.enqueued }));
  }
  if ((job.downloaded ?? 0) > 0) {
    parts.push(i18n.t('media:shared.partDownloaded', { count: job.downloaded }));
  }
  if ((job.skipped ?? 0) > 0) {
    parts.push(i18n.t('media:shared.partSkipped', { count: job.skipped }));
  }
  const joined = parts.join(i18n.t('media:shared.listSeparator'));
  if (
    job.sourceTrackCount != null &&
    job.sourceTrackCount > (job.total ?? 0)
  ) {
    const cap = job.importCap ?? job.total ?? 0;
    return i18n.t(
      parts.length ? 'media:shared.importCompletePartsCapped' : 'media:shared.importCompleteCapped',
      { parts: joined, cap, source: job.sourceTrackCount },
    );
  }
  return i18n.t(
    parts.length ? 'media:shared.importCompleteParts' : 'media:shared.importComplete',
    { parts: joined },
  );
}


export function importCapHint(maxPlaylistImport: number | undefined): string {
  const cap = maxPlaylistImport ?? 250;
  return i18n.t('media:shared.importCapHint', { cap });
}

