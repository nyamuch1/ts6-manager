/**
 * Admin media diagnostics (#300).
 *
 * Reuses diagnoseRuntimeMedia plus the sidecar's existing GET /health and
 * GET /encoders. Those HTTP contracts stay as shipped — native-sidecar T06
 * owns changes. `version` is copied only when health already sends it.
 *
 * No installs, no URL playback, no refresh of encoder test encodes.
 */

import type {
  MediaAdminDiagnosticReport,
  MediaDiagnosticAV1Decode,
  MediaDiagnosticCheck,
  MediaDiagnosticEncoders,
  MediaDiagnosticSidecar,
  MediaDiagnosticStatus,
  RuntimeMediaStageResult,
  VideoEncoderCapabilities,
} from '@ts6/common';
import { redactDiagnosticValue } from '@ts6/common';
import OpusScript from 'opusscript';
import { SidecarClient } from '../streaming/sidecar-client.js';
import { BYTES_PER_FRAME, CHANNELS, FRAME_SIZE, SAMPLE_RATE } from './pipeline.js';
import { getYtDlpPath } from './yt-dlp-path.js';
import {
  diagnoseRuntimeMedia,
  probeCommandVersion,
  resolveBinaryOnPath,
  type CommandProbeResult,
  type DiagnoseRuntimeMediaOptions,
} from './runtime-media-diagnostics.js';
import {
  DEFAULT_LOCALE,
  translate,
  type SupportedLocale,
} from '../../i18n/index.js';

function imageRemediation(locale: SupportedLocale): string {
  return translate(locale, 'diagnostics.media.image_remediation');
}

export const MEDIA_ADMIN_TIMEOUT_MS = 8_000;
const SMOKE_TIMEOUT_MS = 2_000;
const TOOL_TIMEOUT_MS = 1_500;
const ENCODER_WAIT_MS = 2_500;

const FFMPEG_SMOKE_ARGS = [
  '-hide_banner',
  '-nostdin',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  'anullsrc=r=48000:cl=stereo',
  '-t',
  '0.05',
  '-acodec',
  'pcm_s16le',
  '-ar',
  '48000',
  '-ac',
  '2',
  '-f',
  'null',
  '-',
];

export interface SidecarHealthBody {
  status?: string;
  version?: string;
  videoPort?: number;
  audioPort?: number;
}

export interface DiagnoseMediaAdminOptions extends DiagnoseRuntimeMediaOptions {
  probeOpus?: () => { ok: true } | { ok: false; message: string };
  /** Cached GET /encoders only. Callers must not pass refresh. */
  loadEncoders?: (timeoutMs: number) => Promise<VideoEncoderCapabilities>;
}

export function probeMusicOpus(
  locale: SupportedLocale = DEFAULT_LOCALE,
): { ok: true } | { ok: false; message: string } {
  try {
    const encoder = new OpusScript(SAMPLE_RATE, CHANNELS, OpusScript.Application.AUDIO);
    try {
      const encoded = encoder.encode(Buffer.alloc(BYTES_PER_FRAME), FRAME_SIZE);
      if (!encoded?.length) {
        return { ok: false, message: translate(locale, 'diagnostics.media.opus_empty_frame') };
      }
      return { ok: true };
    } finally {
      if (typeof encoder.delete === 'function') encoder.delete();
    }
  } catch (err) {
    const message = err instanceof Error
      ? err.message
      : translate(locale, 'diagnostics.media.opus_failed');
    return { ok: false, message: clip(message, 160) };
  }
}

function pickHealth(raw: unknown): SidecarHealthBody {
  if (!raw || typeof raw !== 'object') return {};
  const body = raw as Record<string, unknown>;
  const out: SidecarHealthBody = {};
  if (typeof body.status === 'string') out.status = clip(body.status, 80);
  if (typeof body.version === 'string') out.version = clip(body.version, 80);
  if (typeof body.videoPort === 'number' && Number.isFinite(body.videoPort)) out.videoPort = body.videoPort;
  if (typeof body.audioPort === 'number' && Number.isFinite(body.audioPort)) out.audioPort = body.audioPort;
  return out;
}

async function fetchSidecarHealth(baseUrl: string, timeoutMs: number): Promise<SidecarHealthBody> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = pickHealth(await res.json());
    if (!body.status) throw new Error('Invalid sidecar health response');
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function clip(value: string, max = 180): string {
  const flat = redactDiagnosticValue(value).replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function stageCheck(
  stage: RuntimeMediaStageResult | undefined,
  label: string,
  remediation: string,
  locale: SupportedLocale,
): MediaDiagnosticCheck {
  if (!stage) {
    return {
      id: label,
      label,
      status: 'fail',
      message: translate(locale, 'diagnostics.media.not_reported'),
      remediation,
    };
  }
  const status: MediaDiagnosticStatus = stage.status === 'skipped' ? 'warning' : stage.status;
  return {
    id: stage.id,
    label,
    status,
    message: clip(stage.message),
    ...(stage.version ? { version: clip(stage.version, 120) } : {}),
    ...(status === 'fail' ? { remediation } : {}),
  };
}

function checkFromProbe(
  id: string,
  label: string,
  result: CommandProbeResult | undefined,
  okMessage: string,
  remediation: string,
  locale: SupportedLocale,
): MediaDiagnosticCheck {
  if (!result) {
    return skipped(id, label, translate(locale, 'diagnostics.media.skipped_deadline'));
  }
  if (result.ok) {
    return {
      id,
      label,
      status: 'ok',
      message: okMessage,
      ...(result.version && result.version !== 'unknown' ? { version: clip(result.version, 120) } : {}),
    };
  }
  return {
    id,
    label,
    status: 'fail',
    message: clip(result.message),
    remediation,
  };
}

function skipped(id: string, label: string, message: string): MediaDiagnosticCheck {
  return { id, label, status: 'skipped', message };
}

async function boundedProbe(
  remainingMs: () => number,
  timeoutMs: number,
  probe: DiagnoseRuntimeMediaOptions['probeCommand'],
  command: string,
  args: string[],
): Promise<CommandProbeResult | undefined> {
  const run = probe ?? probeCommandVersion;
  const budget = Math.min(timeoutMs, Math.max(0, remainingMs()));
  if (budget < 200) {
    return undefined;
  }
  return run(command, args, budget);
}

function encoderSummary(
  caps: VideoEncoderCapabilities,
  locale: SupportedLocale,
): MediaDiagnosticEncoders {
  const items = caps.encoders.map((encoder) => ({
    id: encoder.id,
    codec: encoder.codec,
    hardware: encoder.hardware,
    available: encoder.available,
    ...(!encoder.available && (encoder.error || encoder.skipped)
      ? { detail: clip(encoder.error || encoder.skipped || '', 160) }
      : {}),
  }));
  const software = items.filter((item) => !item.hardware);
  const softwareOk = software.some((item) => item.available);
  return {
    status: softwareOk ? 'ok' : 'warning',
    message: softwareOk
      ? translate(locale, 'diagnostics.media.encoders_ok')
      : translate(locale, 'diagnostics.media.encoders_unavailable'),
    checkedAt: caps.checkedAt,
    items,
    av1Decode: av1DecodeSummary(caps, locale),
  };
}

/**
 * Where AV1 sources decode. AV1 decodes on the GPU only when a test decode on
 * that GPU passed and VIDEO_HW_DECODE=1; otherwise libdav1d decodes it on the
 * CPU, which always works.
 */
export function av1DecodeSummary(
  caps: VideoEncoderCapabilities,
  locale: SupportedLocale = DEFAULT_LOCALE,
): MediaDiagnosticAV1Decode {
  if (!Array.isArray(caps.av1Decode)) {
    return {
      decodesOn: 'unknown',
      message: translate(locale, 'diagnostics.media.av1_not_reported'),
      items: [],
    };
  }
  const items = caps.av1Decode.map((probe) => ({
    hwaccel: probe.hwaccel,
    available: probe.available,
    ...(!probe.available && probe.error ? { detail: clip(probe.error, 160) } : {}),
  }));
  const cpu = translate(locale, 'diagnostics.media.av1_cpu');
  if (!caps.hwDecode) {
    // The sidecar runs no AV1 test decode then: nothing decodes on the GPU.
    return {
      decodesOn: 'cpu',
      message: translate(locale, 'diagnostics.media.av1_hw_decode_off', { cpu }),
      items,
    };
  }
  if (items.length === 0) {
    return {
      decodesOn: 'cpu',
      message: translate(locale, 'diagnostics.media.av1_no_gpu', { cpu }),
      items,
    };
  }
  const passed = items.filter((item) => item.available).map((item) => item.hwaccel);
  if (passed.length === 0) {
    const intel = items.some((item) => item.hwaccel === 'vaapi')
      ? translate(locale, 'diagnostics.media.av1_intel_hint')
      : '';
    return {
      decodesOn: 'cpu',
      message: translate(locale, 'diagnostics.media.av1_gpu_failed', { cpu, intel }),
      items,
    };
  }
  return {
    decodesOn: 'gpu',
    message: translate(locale, 'diagnostics.media.av1_gpu', { accelerators: passed.join(', ') }),
    items,
  };
}

function overallOf(report: Pick<MediaAdminDiagnosticReport, 'checks' | 'sidecar' | 'encoders'>): MediaAdminDiagnosticReport['overall'] {
  const statuses = [
    ...report.checks.map((check) => check.status),
    report.sidecar.status,
    report.encoders.status,
  ].filter((status) => status !== 'skipped');
  if (statuses.length === 0) return 'fail';
  if (statuses.every((status) => status === 'fail')) return 'fail';
  if (statuses.some((status) => status === 'fail' || status === 'warning')) return 'partial';
  return 'ok';
}

function warningsOf(report: Pick<MediaAdminDiagnosticReport, 'checks' | 'sidecar' | 'encoders'>): string[] {
  const lines: string[] = [];
  for (const check of report.checks) {
    if (check.status !== 'warning' && check.status !== 'fail') continue;
    lines.push(check.remediation ? `${check.label}: ${check.message} ${check.remediation}` : `${check.label}: ${check.message}`);
  }
  if (report.sidecar.status === 'warning' || report.sidecar.status === 'fail') {
    lines.push(report.sidecar.message);
  }
  if (report.encoders.status === 'warning' || report.encoders.status === 'fail') {
    lines.push(report.encoders.message);
  }
  return lines;
}

async function defaultLoadEncoders(env: NodeJS.ProcessEnv, timeoutMs: number): Promise<VideoEncoderCapabilities> {
  const url = (env.SIDECAR_URL || '').trim();
  const client = new SidecarClient(url || Number(env.SIDECAR_PORT) || 9800, env.SIDECAR_SECRET);
  return client.getEncoders(false, timeoutMs);
}

function sidecarSummary(
  stage: RuntimeMediaStageResult | undefined,
  mode: MediaDiagnosticSidecar['mode'],
  locale: SupportedLocale,
  health?: SidecarHealthBody,
): MediaDiagnosticSidecar {
  let status: MediaDiagnosticStatus = 'fail';
  if (stage?.status === 'ok') status = 'ok';
  if (stage?.code === 'version_mismatch' || stage?.status === 'skipped') status = 'warning';
  return {
    mode,
    status,
    message: clip(stage?.message || translate(locale, 'diagnostics.media.sidecar_not_checked')),
    ...(health?.version ? { version: health.version } : {}),
    ...(health?.status ? { healthStatus: health.status } : {}),
    ...(health?.videoPort != null ? { videoPort: health.videoPort } : {}),
    ...(health?.audioPort != null ? { audioPort: health.audioPort } : {}),
  };
}

async function loadEncoderReport(
  sidecarHealthy: boolean,
  remainingMs: () => number,
  load: NonNullable<DiagnoseMediaAdminOptions['loadEncoders']>,
  locale: SupportedLocale,
): Promise<MediaDiagnosticEncoders> {
  if (!sidecarHealthy) {
    return {
      status: 'warning',
      message: translate(locale, 'diagnostics.media.encoders_not_loaded'),
      items: [],
    };
  }
  const budget = Math.min(ENCODER_WAIT_MS, Math.max(0, remainingMs()));
  if (budget < 200) {
    return {
      status: 'warning',
      message: translate(locale, 'diagnostics.media.encoders_skipped_deadline'),
      items: [],
    };
  }
  try {
    return encoderSummary(await load(budget), locale);
  } catch {
    return {
      status: 'warning',
      message: translate(locale, 'diagnostics.media.encoders_timeout'),
      items: [],
    };
  }
}

export async function diagnoseMediaAdmin(
  options: DiagnoseMediaAdminOptions = {},
): Promise<MediaAdminDiagnosticReport> {
  const overallTimeoutMs = options.overallTimeoutMs ?? MEDIA_ADMIN_TIMEOUT_MS;
  const env = options.env ?? process.env;
  const locale = options.locale ?? DEFAULT_LOCALE;
  const started = Date.now();
  const deadline = started + overallTimeoutMs;
  const remainingMs = () => deadline - Date.now();

  let healthBody: SidecarHealthBody | undefined;
  const probeSidecarHealth = async (baseUrl: string, timeoutMs: number) => {
    const raw = options.probeSidecarHealth
      ? await options.probeSidecarHealth(baseUrl, timeoutMs)
      : await fetchSidecarHealth(baseUrl, timeoutMs);
    healthBody = pickHealth(raw);
    if (healthBody.status && !['ok', 'healthy'].includes(healthBody.status)) {
      throw new Error('Sidecar reported an unhealthy status');
    }
    return healthBody;
  };

  const runtimeBudget = Math.min(4_000, Math.max(0, remainingMs()));
  const runtime = await diagnoseRuntimeMedia({
    ...options,
    env,
    overallTimeoutMs: runtimeBudget,
    probeSidecarHealth,
  });
  const stage = (id: RuntimeMediaStageResult['id']) => runtime.stages.find((item) => item.id === id);

  const checks: MediaDiagnosticCheck[] = [
    stageCheck(
      stage('ffmpeg'),
      translate(locale, 'diagnostics.media.label.ffmpeg'),
      translate(locale, 'diagnostics.media.ffmpeg_remediation', {
        image: imageRemediation(locale),
      }),
      locale,
    ),
    stageCheck(
      stage('ffprobe'),
      translate(locale, 'diagnostics.media.label.ffprobe'),
      translate(locale, 'diagnostics.media.ffprobe_remediation', {
        image: imageRemediation(locale),
      }),
      locale,
    ),
  ];

  const ffmpegOk = stage('ffmpeg')?.status === 'ok';
  if (!ffmpegOk) {
    checks.push(skipped(
      'ffmpeg-smoke',
      translate(locale, 'diagnostics.media.label.ffmpeg_smoke'),
      translate(locale, 'diagnostics.media.ffmpeg_smoke_skipped'),
    ));
  } else {
    const smoke = await boundedProbe(
      remainingMs,
      SMOKE_TIMEOUT_MS,
      options.probeCommand,
      'ffmpeg',
      FFMPEG_SMOKE_ARGS,
    );
    checks.push(checkFromProbe(
      'ffmpeg-smoke',
      translate(locale, 'diagnostics.media.label.ffmpeg_smoke'),
      smoke,
      translate(locale, 'diagnostics.media.ffmpeg_smoke_ok'),
      translate(locale, 'diagnostics.media.ffmpeg_smoke_remediation'),
      locale,
    ));
  }

  const opus = options.probeOpus ? options.probeOpus() : probeMusicOpus(locale);
  checks.push(
    opus.ok
      ? {
          id: 'opus',
          label: translate(locale, 'diagnostics.media.label.opus'),
          status: 'ok',
          message: translate(locale, 'diagnostics.media.opus_ok'),
        }
      : {
        id: 'opus',
        label: translate(locale, 'diagnostics.media.label.opus'),
        status: 'fail',
        message: clip(opus.message),
        remediation: translate(locale, 'diagnostics.media.opus_remediation'),
      },
    stageCheck(
      stage('yt-dlp'),
      translate(locale, 'diagnostics.media.label.yt_dlp'),
      translate(locale, 'diagnostics.media.yt_dlp_remediation', {
        image: imageRemediation(locale),
      }),
      locale,
    ),
  );

  const ytOk = stage('yt-dlp')?.status === 'ok';
  if (!ytOk) {
    checks.push(skipped(
      'yt-dlp-extractors',
      translate(locale, 'diagnostics.media.label.yt_dlp_extractors'),
      translate(locale, 'diagnostics.media.yt_dlp_extractors_skipped'),
    ));
  } else {
    const listed = await boundedProbe(
      remainingMs,
      SMOKE_TIMEOUT_MS,
      options.probeCommand,
      getYtDlpPath(env),
      ['--ignore-config', '--list-extractors'],
    );
    checks.push(checkFromProbe(
      'yt-dlp-extractors',
      translate(locale, 'diagnostics.media.label.yt_dlp_extractors'),
      listed,
      translate(locale, 'diagnostics.media.yt_dlp_extractors_ok'),
      translate(locale, 'diagnostics.media.yt_dlp_extractors_remediation'),
      locale,
    ));
  }

  const denoProbe = await boundedProbe(
    remainingMs,
    TOOL_TIMEOUT_MS,
    options.probeCommand,
    'deno',
    ['--version'],
  );
  const denoCheck = checkFromProbe(
    'deno',
    translate(locale, 'diagnostics.media.label.deno'),
    denoProbe,
    translate(locale, 'diagnostics.media.deno_ok'),
    translate(locale, 'diagnostics.media.deno_remediation', {
      image: imageRemediation(locale),
    }),
    locale,
  );
  if (denoProbe && !denoProbe.ok && denoProbe.code === 'binary_missing') denoCheck.status = 'warning';
  checks.push(denoCheck);

  const tools: Record<string, string> = { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', deno: 'deno' };
  if (stage('yt-dlp')?.code !== 'misconfigured') tools['yt-dlp'] = getYtDlpPath(env);
  for (const check of checks) {
    const command = tools[check.id];
    if (command) check.path = resolveBinaryOnPath(command, env) ?? command;
  }

  const sidecarStage = stage('sidecar');
  const sidecar = sidecarSummary(sidecarStage, runtime.meta.sidecarMode, locale, healthBody);
  const encoders = await loadEncoderReport(
    sidecarStage?.status === 'ok',
    remainingMs,
    options.loadEncoders ?? ((timeoutMs) => defaultLoadEncoders(env, timeoutMs)),
    locale,
  );

  const draft: MediaAdminDiagnosticReport = {
    checkedAt: new Date().toISOString(),
    overall: 'ok',
    checks,
    sidecar,
    encoders,
    warnings: [] as string[],
  };
  draft.overall = overallOf(draft);
  draft.warnings = warningsOf(draft);
  return redactDiagnosticValue(draft);
}
