import type {
  MediaStopDetailCode,
  MediaStopReason,
  VideoSourceMode,
  VideoSourceModeRequest,
} from '@ts6/common';
import {
  DEFAULT_LOCALE,
  translate,
  type MessageKey,
  type SupportedLocale,
} from '../../i18n/index.js';

/**
 * Human-readable media lifecycle wording (stop reasons, countdowns).
 */

type DurationUnit = 'second' | 'minute' | 'hour';

const UNIT_KEY: Record<DurationUnit, { one: MessageKey; other: MessageKey }> = {
  second: {
    one: 'diagnostics.lifecycle.unit.second_one',
    other: 'diagnostics.lifecycle.unit.second_other',
  },
  minute: {
    one: 'diagnostics.lifecycle.unit.minute_one',
    other: 'diagnostics.lifecycle.unit.minute_other',
  },
  hour: {
    one: 'diagnostics.lifecycle.unit.hour_one',
    other: 'diagnostics.lifecycle.unit.hour_other',
  },
};

function durationPart(count: number, unit: DurationUnit, locale: SupportedLocale): string {
  return translate(locale, 'diagnostics.lifecycle.duration', {
    count,
    unit: translate(locale, UNIT_KEY[unit][count === 1 ? 'one' : 'other']),
  });
}

/** "5 minutes", "1 minute", "45 seconds", "1 minute 30 seconds". */
export function describeDuration(
  totalSec: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return durationPart(sec, 'second', locale);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(durationPart(h, 'hour', locale));
  if (m) parts.push(durationPart(m, 'minute', locale));
  if (s) parts.push(durationPart(s, 'second', locale));
  // Chinese composes units without a space ("1分钟30秒"); English keeps one.
  return parts.join(locale === 'zh-CN' ? '' : ' ');
}

/** Format an auto-stop announcement using whole minutes only when exact. */
export function formatStopDuration(
  seconds: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const sec = Math.max(0, Math.round(seconds));
  if (sec >= 60 && sec % 60 === 0) return durationPart(sec / 60, 'minute', locale);
  return durationPart(sec, 'second', locale);
}

export type AutoStopMedia = 'music' | 'radio' | 'video';

export function autoStopNotice(
  media: AutoStopMedia,
  reason: 'channel_empty' | 'no_viewers',
  seconds: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const duration = formatStopDuration(seconds, locale);
  if (media === 'music') {
    return translate(locale, 'diagnostics.lifecycle.auto_stop_music', { duration });
  }
  if (media === 'radio') {
    return translate(locale, 'diagnostics.lifecycle.auto_stop_radio', { duration });
  }
  if (reason === 'no_viewers') {
    return translate(locale, 'diagnostics.lifecycle.auto_stop_stream_no_viewers', { duration });
  }
  return translate(locale, 'diagnostics.lifecycle.auto_stop_stream_channel_empty', { duration });
}

export function noViewerWarningNotice(locale: SupportedLocale = DEFAULT_LOCALE): string {
  return translate(locale, 'diagnostics.lifecycle.no_viewer_warning');
}

/** Stable fields a language-aware client can use to retranslate a stop detail. */
export interface MediaStopDetailInfo {
  detail: string;
  detailCode: MediaStopDetailCode;
  detailParams: Record<string, string | number>;
}

export function noViewersStopInfo(
  timeoutSec: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): MediaStopDetailInfo {
  return {
    detail: translate(locale, 'diagnostics.lifecycle.stop_no_viewers', {
      duration: describeDuration(timeoutSec, locale),
    }),
    detailCode: 'no_viewers',
    detailParams: { seconds: Math.max(0, Math.round(timeoutSec)) },
  };
}

export function channelEmptyStopInfo(
  graceSec: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): MediaStopDetailInfo {
  return {
    detail: translate(locale, 'diagnostics.lifecycle.stop_channel_empty', {
      duration: describeDuration(graceSec, locale),
    }),
    detailCode: 'channel_empty',
    detailParams: { seconds: Math.max(0, Math.round(graceSec)) },
  };
}

export function noViewersStopDetail(
  timeoutSec: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  return noViewersStopInfo(timeoutSec, locale).detail;
}

export function channelEmptyStopDetail(
  graceSec: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  return channelEmptyStopInfo(graceSec, locale).detail;
}

/**
 * `BOT_AUTO_STOP_EMPTY_SECONDS`: the channel-empty grace period. Unset or
 * invalid means 300; `0` (or less) disables the stop and must stay `0`.
 */
export function parseAutoStopEmptySeconds(raw: string | undefined): number {
  const parsed = parseInt(raw ?? '300', 10);
  return Number.isFinite(parsed) ? parsed : 300;
}

/**
 * Whether the channel-empty auto-stop should count the bot's channel as empty.
 * A video stream someone is watching is never "empty": the tracked channel
 * peer count can miss clients (#215), and the no-viewer timer already covers
 * streams nobody watches.
 */
export function isChannelEmptyForAutoStop(
  channelPeerCount: number,
  videoStreaming: boolean,
  videoViewerCount: number,
): boolean {
  if (channelPeerCount > 0) return false;
  if (videoStreaming && videoViewerCount > 0) return false;
  return true;
}


/**
 * Decide the source mode. Local files are always `file`; an explicit request
 * wins for remote sources; otherwise a probe without a duration means live.
 * With no probe (fixed presets never probe) remote sources stay `vod`, the
 * pre-1.9 behaviour. URL suffixes such as `.m3u8` are never used.
 */
export function resolveSourceMode(
  requested: VideoSourceModeRequest | undefined,
  isLocal: boolean,
  probe: { durationSec: number | null } | null,
): VideoSourceMode {
  if (isLocal) return 'file';
  if (requested === 'live' || requested === 'vod') return requested;
  if (probe) return probe.durationSec == null ? 'live' : 'vod';
  return 'vod';
}

const SOURCE_FAILURE =
  /server returned|connection (refused|reset|timed out)|timed out|failed to resolve|name or service|no such file|invalid data found|end of file|http error|\b(?:400\s+Bad Request|401\s+Unauthorized|403\s+Forbidden|404\s+Not Found)\b|i\/o error|matches no streams|stream map|empty segment|skd:\/\/|unable to open key file|fairplay|widevine|playready/i;

/**
 * Turn ffmpeg/sidecar stderr into a short operator-facing line (no pointer
 * addresses, no duplicated HTTP noise).
 */
export function humanizeSourceError(
  raw: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const err = raw.trim();
  if (!err) return translate(locale, 'diagnostics.lifecycle.source_unreachable');
  // FairPlay / Widevine / PlayReady — ffmpeg cannot decrypt skd:// keys.
  if (/skd:\/\/|fairplay|widevine|playready/i.test(err)) {
    return translate(locale, 'diagnostics.lifecycle.drm');
  }
  // Plain HLS AES-128 uses key URIs too: a key that will not load is not DRM.
  if (/unable to open key file/i.test(err)) {
    return translate(locale, 'diagnostics.lifecycle.key_unavailable');
  }
  if (/matches no streams|stream map|empty segment/i.test(err)) {
    return translate(locale, 'diagnostics.lifecycle.no_streams');
  }
  const codeMatch = err.match(/\bHTTP error\s+(\d{3})\b/i)
    ?? err.match(/\bServer returned\s+(\d{3})\b/i)
    ?? err.match(/\b([45]\d{2})\s+(?:Bad Request|Not Found|Forbidden|Unauthorized)\b/i);
  if (codeMatch) {
    const code = codeMatch[1];
    if (code === '400') return translate(locale, 'diagnostics.lifecycle.http_400');
    if (code === '401') return translate(locale, 'diagnostics.lifecycle.http_401');
    if (code === '403') return translate(locale, 'diagnostics.lifecycle.http_403');
    if (code === '404') return translate(locale, 'diagnostics.lifecycle.http_404');
    return translate(locale, 'diagnostics.lifecycle.http_other', { code });
  }
  if (/connection (refused|reset|timed out)|timed out|failed to resolve|name or service/i.test(err)) {
    return translate(locale, 'diagnostics.lifecycle.network');
  }
  // Strip ffmpeg channel tags like `[https @ 0x…]` and `<source>` markers.
  const cleaned = err
    .replace(/\[[^\]]*@\s*0x[0-9a-fA-F]+\]\s*/g, '')
    .replace(/<source>\s*/gi, '')
    .replace(/\s*;\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return translate(locale, 'diagnostics.lifecycle.source_unreachable');
  return cleaned.length > 140 ? `${cleaned.slice(0, 137)}…` : cleaned;
}

export interface ClassifiedEncoderExit {
  reason: MediaStopReason;
  detail: string;
  /** Stable machine code for clients that translate on a later language change. */
  detailCode: MediaStopDetailCode;
  detailParams?: Record<string, string | number>;
}

/**
 * Attach the additive code fields without changing the legacy enumerable
 * `{ reason, detail }` shape (existing deep-equality consumers keep working).
 */
function classifiedExit(
  reason: MediaStopReason,
  detail: string,
  detailCode: MediaStopDetailCode,
  detailParams?: Record<string, string | number>,
): ClassifiedEncoderExit {
  const result = { reason, detail } as ClassifiedEncoderExit;
  Object.defineProperties(result, {
    detailCode: { value: detailCode, enumerable: false },
    ...(detailParams
      ? { detailParams: { value: detailParams, enumerable: false } }
      : {}),
  });
  return result;
}

/**
 * Why ffmpeg stopped on its own. `exitError` is the sidecar's URL-redacted
 * stderr summary. A clean exit of a non-looping VOD/file source is its end;
 * a live source should never end, so its exit means the source went away.
 */
export function classifyEncoderExit(
  opts: {
    mode: VideoSourceMode;
    loop: boolean;
    exitError: string | null;
  },
  locale: SupportedLocale = DEFAULT_LOCALE,
): ClassifiedEncoderExit {
  const err = opts.exitError?.trim() || null;
  if (err && SOURCE_FAILURE.test(err)) {
    const detail = humanizeSourceError(err, locale);
    return classifiedExit('source_unreachable', detail, 'source_unreachable', { error: detail });
  }
  if (!err && opts.mode !== 'live' && !opts.loop) {
    return classifiedExit(
      'source_ended',
      translate(locale, 'diagnostics.lifecycle.video_ended'),
      'video_ended',
    );
  }
  if (opts.mode === 'live') {
    if (err) {
      const detail = humanizeSourceError(err, locale);
      return classifiedExit('source_unreachable', detail, 'live_source_ended', { error: detail });
    }
    return classifiedExit(
      'source_unreachable',
      translate(locale, 'diagnostics.lifecycle.live_ended'),
      'live_source_ended',
    );
  }
  if (err) {
    const error = humanizeSourceError(err, locale);
    return classifiedExit(
      'encoder_failure',
      translate(locale, 'diagnostics.lifecycle.encoder_stopped_with_error', { error }),
      'encoder_stopped',
      { error },
    );
  }
  return classifiedExit(
    'encoder_failure',
    translate(locale, 'diagnostics.lifecycle.encoder_stopped'),
    'encoder_stopped',
  );
}

/** "Encoding below realtime (0.62x for 40 s) — …" or null. */
export function belowRealtimeWarning(
  opts: {
    speed: number | null;
    belowSecs: number;
    preset: string;
    encoderLabel: string;
    mode: VideoSourceMode | null;
    rtpDrops: number;
  },
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  const speed = opts.speed != null
    ? `${opts.speed.toFixed(2)}x`
    : translate(locale, 'diagnostics.lifecycle.unknown_speed');
  const drops = opts.rtpDrops > 0
    ? translate(locale, 'diagnostics.lifecycle.rtp_drops', { count: opts.rtpDrops })
    : '';
  const mode = opts.mode
    ? translate(locale, 'diagnostics.lifecycle.from_source', { mode: opts.mode })
    : '';
  return translate(locale, 'diagnostics.lifecycle.below_realtime', {
    speed,
    seconds: Math.round(opts.belowSecs),
    drops,
    preset: opts.preset,
    encoder: opts.encoderLabel,
    mode,
  });
}
