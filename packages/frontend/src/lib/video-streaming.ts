/**
 * Video streaming labels and formatting shared by the stream controls and IPTV.
 */

import type {
  VideoSourceMode,
  VideoSourceModeRequest,
  VideoStreamHealth,
  MediaStopInfo,
  MediaStopReason,
  VideoEncoderId,
  VideoEncoderRequest,
  VideoQualityRequest,
  VideoStreamEncoderInfo,
  VideoStreamPresetKey,
  VideoStreamQualityInfo,
} from '@ts6/common';
import i18n from '../i18n';

// Label getters are evaluated on access: these modules are imported before
// `initI18n()` runs, so plain constants would capture untranslated keys.
export const QUALITY_OPTIONS: ReadonlyArray<{ value: VideoQualityRequest; label: string; hint: string }> = [
  {
    value: 'auto',
    get label() { return i18n.t('media:quality.auto'); },
    get hint() { return i18n.t('media:quality.autoHint'); },
  },
  { value: '480p', label: '480p', hint: '854×480 · 1 Mbps' },
  { value: '720p', label: '720p', hint: '1280×720 · 2.5 Mbps' },
  { value: '1080p', label: '1080p', hint: '1920×1080 · 4.5 Mbps' },
  { value: '1440p', label: '1440p', hint: '2560×1440 · 8 Mbps' },
  { value: '2160p', label: '2160p', hint: '3840×2160 · 14 Mbps' },
];

export const AUTO_LIMIT_OPTIONS: ReadonlyArray<VideoStreamPresetKey> = ['720p', '1080p', '1440p', '2160p'];

export const ENCODER_LABELS: Record<VideoEncoderId, string> = {
  get vp8() { return i18n.t('media:encoder.vp8Software'); },
  get vp9() { return i18n.t('media:encoder.vp9Software'); },
  get h264() { return i18n.t('media:encoder.h264Software'); },
  get vp8_vaapi() { return i18n.t('media:encoder.vp8Vaapi'); },
  get vp9_vaapi() { return i18n.t('media:encoder.vp9Vaapi'); },
  get h264_vaapi() { return i18n.t('media:encoder.h264Vaapi'); },
  get h264_nvenc() { return i18n.t('media:encoder.h264Nvenc'); },
  get h264_amf() { return i18n.t('media:encoder.h264Amf'); },
  get h264_videotoolbox() { return i18n.t('media:encoder.h264Videotoolbox'); },
};

export const ENCODER_OPTIONS: ReadonlyArray<{ value: VideoEncoderRequest; label: string }> = [
  {
    value: 'auto',
    get label() { return i18n.t('media:encoder.auto'); },
  },
  ...(Object.keys(ENCODER_LABELS) as VideoEncoderId[]).map((id) => ({
    value: id,
    get label() { return ENCODER_LABELS[id]; },
  })),
];

/** Auto menu label from Streaming defaults.preferHardware (default off → software). */
export function autoEncoderPreferenceLabel(preferHardware: boolean): string {
  return i18n.t(preferHardware ? 'media:encoder.autoHardware' : 'media:encoder.autoSoftware');
}

/** Short helper for Video options / Streaming defaults. */
export function autoEncoderPreferenceHint(preferHardware: boolean): string {
  return i18n.t(preferHardware ? 'media:encoder.autoHardwareHint' : 'media:encoder.autoSoftwareHint');
}

/** Per-stream no-viewer timeout choices, in seconds. */
export const NO_VIEWER_TIMEOUT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  '0',
  '60',
  '300',
  '600',
  '1800',
].map((value) => ({
  value,
  get label() { return formatTimeout(Number(value)); },
}));

export const STOP_REASON_LABELS: Record<MediaStopReason, string> = {
  get manual() { return i18n.t('media:stopReason.manual'); },
  get no_viewers() { return i18n.t('media:stopReason.noViewers'); },
  get channel_empty() { return i18n.t('media:stopReason.channelEmpty'); },
  get source_ended() { return i18n.t('media:stopReason.sourceEnded'); },
  get source_unreachable() { return i18n.t('media:stopReason.sourceUnreachable'); },
  get encoder_failure() { return i18n.t('media:stopReason.encoderFailure'); },
  get sidecar_failure() { return i18n.t('media:stopReason.sidecarFailure'); },
  get replaced_by_music() { return i18n.t('media:stopReason.replacedByMusic'); },
  get replaced_by_video() { return i18n.t('media:stopReason.replacedByVideo'); },
  get server_disconnect() { return i18n.t('media:stopReason.serverDisconnect'); },
  get bot_stopped() { return i18n.t('media:stopReason.botStopped'); },
};

/** "4:59" / "1:02:03" for a countdown or uptime in milliseconds. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/** "Off", "5 min", "90 s", "1 h 30 min". */
export function formatTimeout(sec: number): string {
  if (sec <= 0) return i18n.t('media:time.off');
  if (sec < 60) return i18n.t('media:time.seconds', { seconds: sec });
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h && m && s) {
    return i18n.t('media:time.hoursMinutesSeconds', { hours: h, minutes: m, seconds: s });
  }
  if (h && m) return i18n.t('media:time.hoursMinutes', { hours: h, minutes: m });
  if (h && s) return i18n.t('media:time.hoursSeconds', { hours: h, seconds: s });
  if (m && s) return i18n.t('media:time.minutesSeconds', { minutes: m, seconds: s });
  if (h) return i18n.t('media:time.hours', { hours: h });
  return i18n.t('media:time.minutes', { minutes: m });
}

/** "Auto → 1080p", "Auto → 720p (reduced from 1080p)", or just "1440p" for a fixed preset. */
export function qualityLabel(q: VideoStreamQualityInfo | null | undefined, fallbackPreset?: string): string {
  if (!q) return fallbackPreset ?? '—';
  if (q.requested !== 'auto') return q.actual;
  const ceiling = q.adaptation?.ceiling;
  return ceiling && ceiling !== q.actual
    ? i18n.t('media:quality.autoToReduced', { actual: q.actual, ceiling })
    : i18n.t('media:quality.autoTo', { actual: q.actual });
}

/** How long a finished recovery stays on screen. */
const QUALITY_RESTORED_NOTE_MS = 10 * 60_000;

/**
 * Why Auto is not at the quality it started at, or how it got back:
 * "Auto reduced quality to 720p: Encoding stayed below realtime (0.62x for 30 s) at 1080p · 3 min ago".
 * Null for fixed presets, with no change yet, or once a full recovery is old news.
 */
export function qualityAdaptationNote(
  q: VideoStreamQualityInfo | null | undefined,
  now: number = Date.now(),
): { text: string; reduced: boolean } | null {
  const change = q?.adaptation?.lastChange;
  if (!q || !q.adaptation || !change) return null;
  const reduced = q.actual !== q.adaptation.ceiling;
  if (!reduced && now - change.at > QUALITY_RESTORED_NOTE_MS) return null;
  const ago = relativeTime(now - change.at);
  const key = change.direction === 'down' ? 'media:quality.reducedTo' : 'media:quality.raisedTo';
  return {
    text: i18n.t(key, { quality: change.to, reason: change.reason, ago }),
    reduced,
  };
}

function relativeTime(elapsedMs: number): string {
  const agoMin = Math.floor(Math.max(0, elapsedMs) / 60_000);
  if (agoMin < 1) return i18n.t('media:time.justNow');
  if (agoMin < 60) return i18n.t('media:time.minutesAgo', { count: agoMin });
  return i18n.t('media:time.hoursAgo', { count: Math.floor(agoMin / 60) });
}

/** "H.264 (VAAPI)", "Auto → VP8 (software)", or "H.264 (VAAPI) → H.264 (software)" after a fallback. */
export function encoderLabel(e: VideoStreamEncoderInfo | null | undefined): string {
  if (!e) return '—';
  const active = ENCODER_LABELS[e.active] ?? e.active;
  if (e.selected !== e.active) {
    return i18n.t('media:encoder.fallback', {
      selected: ENCODER_LABELS[e.selected] ?? e.selected,
      active,
    });
  }
  if (e.requested === 'auto') return i18n.t('media:encoder.autoTo', { encoder: active });
  return active;
}

interface StopDetailCodeFields {
  detailCode?: unknown;
  detailParams?: unknown;
}

/** "5 minutes", "1 minute 30 seconds" — the backend's lifecycle duration wording. */
function formatDurationLong(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec < 60) return i18n.t('media:time.durationSeconds', { count: sec });
  const parts: string[] = [];
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) parts.push(i18n.t('media:time.durationHours', { count: h }));
  if (m) parts.push(i18n.t('media:time.durationMinutes', { count: m }));
  if (s) parts.push(i18n.t('media:time.durationSeconds', { count: s }));
  return parts.join(i18n.resolvedLanguage?.startsWith('zh') ? '' : ' ');
}

/** Translate a stored stop detail code when the backend provides one. */
function translatedStopDetail(stop: MediaStopInfo): string | null {
  const { detailCode, detailParams } = stop as MediaStopInfo & StopDetailCodeFields;
  if (typeof detailCode !== 'string' || !detailCode) return null;
  const params = detailParams && typeof detailParams === 'object' && !Array.isArray(detailParams)
    ? (detailParams as Record<string, unknown>)
    : {};
  const camelCode = detailCode.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  const baseKey = `media:stopDetail.${camelCode}`;
  const hasError = params.error != null && params.error !== '';
  const withErrorKey = `${baseKey}WithError`;
  if (hasError && i18n.exists(withErrorKey)) return i18n.t(withErrorKey, params);
  if (i18n.exists(baseKey)) {
    if (detailCode === 'no_viewers' || detailCode === 'channel_empty') {
      const raw = params.seconds;
      const seconds = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(seconds)) return null;
      return i18n.t(baseKey, { ...params, duration: formatDurationLong(seconds) });
    }
    return i18n.t(baseKey, params);
  }
  // Legacy fallback: map a snake_case code onto the camelCase reason label.
  const reasonKey = `media:stopReason.${camelCode}`;
  if (i18n.exists(reasonKey)) return i18n.t(reasonKey, params);
  return null;
}

/** "No viewers — Stopped after 5 minutes with no viewers · 8 min ago". */
export function lastStopLabel(stop: MediaStopInfo | null | undefined, now: number = Date.now()): string | null {
  if (!stop) return null;
  const base = translatedStopDetail(stop) || stop.detail || STOP_REASON_LABELS[stop.reason] || stop.reason;
  const ago = relativeTime(now - stop.at);
  return i18n.t('media:time.lastStop', { detail: base, ago });
}

export const SOURCE_MODE_OPTIONS: ReadonlyArray<{ value: VideoSourceModeRequest; label: string }> = [
  { value: 'auto', get label() { return i18n.t('media:sourceMode.detect'); } },
  { value: 'live', get label() { return i18n.t('media:sourceMode.live'); } },
  { value: 'vod', get label() { return i18n.t('media:sourceMode.onDemand'); } },
];

export const SOURCE_MODE_LABELS: Record<VideoSourceMode, string> = {
  get live() { return i18n.t('media:sourceMode.live'); },
  get vod() { return i18n.t('media:sourceMode.onDemand'); },
  get file() { return i18n.t('media:sourceMode.localFile'); },
};

/** "1.01x · 30 fps" or "—" before the first sample. */
export function healthLabel(h: VideoStreamHealth | null | undefined): string {
  if (!h || h.speed == null) return '—';
  const fps = h.fps != null ? ` · ${Math.round(h.fps)} fps` : '';
  return `${h.speed.toFixed(2)}x${fps}`;
}
