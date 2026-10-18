import i18n from '../i18n';

const GENERIC_AXIOS = /^Request failed with status code \d+$/i;

export type ApiErrorPresentation = {
  title: string;
  message: string;
  retryable: boolean;
  action?: string;
};

function interpolateFallback(fallback: string, vars?: Record<string, string | number>): string {
  if (!vars) return fallback;
  return fallback.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, name: string) => {
    const value = vars[name];
    return value == null ? match : String(value);
  });
}

/**
 * Translate an `adminOps` key at call time.
 * Before i18n initializes (unit tests, early boot) the current English copy is returned.
 */
export function adminOpsText(
  key: string,
  fallback: string,
  vars?: Record<string, string | number>,
): string {
  if (!i18n.isInitialized) return interpolateFallback(fallback, vars);
  return i18n.t(`adminOps:${key}`, { defaultValue: fallback, ...vars });
}

type ReasonDefault = {
  title?: { key: string; fallback: string };
  action?: { key: string; fallback: string };
  retryable?: boolean;
};

const REASON_DEFAULTS: Record<string, ReasonDefault> = {
  stream_already_running: {
    title: { key: 'errors.reasons.stream_already_running.title', fallback: 'A video is already streaming' },
    retryable: false,
  },
  stream_not_running: {
    title: { key: 'errors.reasons.stream_not_running.title', fallback: 'No active stream' },
    action: { key: 'errors.reasons.stream_not_running.action', fallback: 'Start a video first.' },
    retryable: false,
  },
  stream_starting: {
    title: { key: 'errors.reasons.stream_starting.title', fallback: 'The stream is still starting' },
    retryable: true,
  },
  stream_stopping: {
    title: { key: 'errors.reasons.stream_stopping.title', fallback: 'The stream is stopping' },
    retryable: true,
  },
  sidecar_unavailable: {
    title: { key: 'errors.reasons.sidecar_unavailable.title', fallback: 'Media sidecar unavailable' },
    action: {
      key: 'errors.reasons.sidecar_unavailable.action',
      fallback: 'Check that the sidecar is running, then retry.',
    },
    retryable: true,
  },
  sidecar_timeout: {
    title: { key: 'errors.reasons.sidecar_timeout.title', fallback: 'Media sidecar timed out' },
    retryable: true,
  },
  request_timeout: {
    title: { key: 'errors.reasons.request_timeout.title', fallback: 'The request timed out' },
    retryable: true,
  },
  source_invalid: {
    title: { key: 'errors.reasons.source_invalid.title', fallback: 'Invalid source' },
    retryable: false,
  },
  source_not_found: {
    title: { key: 'errors.reasons.source_not_found.title', fallback: 'File not found' },
    retryable: false,
  },
  source_refused: {
    title: { key: 'errors.reasons.source_refused.title', fallback: 'This source cannot be used' },
    retryable: false,
  },
  source_timeout: {
    title: { key: 'errors.reasons.source_timeout.title', fallback: 'The source timed out' },
    retryable: true,
  },
  source_unavailable: {
    title: { key: 'errors.reasons.source_unavailable.title', fallback: 'The source could not be played' },
    retryable: true,
  },
  bot_not_connected: {
    title: { key: 'errors.reasons.bot_not_connected.title', fallback: 'Bot is not connected' },
    action: { key: 'errors.reasons.bot_not_connected.action', fallback: 'Start the bot, then try again.' },
    retryable: true,
  },
  bot_already_started: {
    title: { key: 'errors.reasons.bot_already_started.title', fallback: 'This bot is already started' },
    retryable: false,
  },
  unexpected_error: {
    title: { key: 'errors.reasons.unexpected_error.title', fallback: 'Something went wrong' },
    action: {
      key: 'errors.reasons.unexpected_error.action',
      fallback: 'Try again. If it keeps happening, check the server logs.',
    },
    retryable: true,
  },
  ts_query_flood: { retryable: true },
  ts_query_starting: { retryable: true },
  ts_ssh_disconnected: { retryable: true },
};

function axiosData(error: unknown): { status?: number; data?: any; message?: string } {
  const err = error as any;
  return {
    status: err?.response?.status,
    data: err?.response?.data,
    message: err?.message,
  };
}

export function apiErrorPresentation(error: unknown, fallback: string): ApiErrorPresentation {
  const { status, data, message } = axiosData(error);
  const reason = typeof data?.reason === 'string' ? data.reason : undefined;
  const defaults = (reason && REASON_DEFAULTS[reason]) || {};
  const defaultTitle = defaults.title
    ? adminOpsText(defaults.title.key, defaults.title.fallback)
    : undefined;
  const rawTitle = typeof data?.error === 'string' ? data.error : '';
  const title = (rawTitle && !GENERIC_AXIOS.test(rawTitle) ? rawTitle : defaultTitle) || fallback;
  const details = typeof data?.details === 'string' ? data.details : '';
  const axiosMsg = typeof message === 'string' && !GENERIC_AXIOS.test(message) ? message : '';
  const bodyMessage = details || (axiosMsg && axiosMsg !== title ? axiosMsg : '');
  const retryable = typeof data?.retryable === 'boolean'
    ? data.retryable
    : defaults.retryable === true || status === 429 || status === 503;
  const action = defaults.action ? adminOpsText(defaults.action.key, defaults.action.fallback) : undefined;
  return { title, message: bodyMessage, retryable, action };
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const p = apiErrorPresentation(error, fallback);
  if (p.message && p.message !== p.title) {
    return adminOpsText('errors.sentence', '{{title}}. {{message}}', {
      title: p.title,
      message: p.message,
    });
  }
  return p.title || fallback;
}

/** TeamSpeak `logview` could not open/read its logfile (error 2052 / file I/O). */
export function isTeamSpeakLogviewIo(error: unknown): boolean {
  const err = error as any;
  const data = err?.response?.data;
  if (data?.reason === 'ts_logview_io') return true;
  if (Number(data?.code) === 2052) return true;

  const text = `${data?.error || ''} ${data?.details || ''} ${err?.message || ''}`.toLowerCase();
  return text.includes('file input/output error') || text.includes('log file unavailable');
}

/** TeamSpeak Query still booting / resetting sockets (gated 503, or transport hang-ups). */
export function isTeamSpeakStarting(error: unknown): boolean {
  if (isTeamSpeakLogviewIo(error)) return false;
  if (isTeamSpeakSshDisconnected(error)) return false;

  const err = error as any;
  const status = err?.response?.status;
  const reason = err?.response?.data?.reason;
  // Structured reason first; older servers only expose English text.
  if (reason === 'ts_query_starting') return true;

  const text = `${err?.response?.data?.error || ''} ${err?.response?.data?.details || ''} ${err?.message || ''}`.toLowerCase();

  // Explicit warming copy from TeamSpeakUnavailableError — not every generic 503.
  if (text.includes('query is still starting') || text.includes('still coming up')) return true;

  // Unmapped hang-ups / resets while Query boots (often still HTTP 502).
  if (status === 502 || status === 503) {
    return (
      text.includes('socket hang up')
      || text.includes('econnreset')
      || text.includes('econnrefused')
      || text.includes('etimedout')
      || text.includes('connection lost before handshake')
    );
  }
  return false;
}

/** EventBridge SSH session temporarily down (often Query flood cooldown after redeploy). */
export function isTeamSpeakSshDisconnected(error: unknown): boolean {
  const err = error as any;
  const reason = err?.response?.data?.reason;
  if (reason === 'ts_ssh_disconnected') return true;

  const status = err?.response?.status;
  const text = `${err?.response?.data?.error || ''} ${err?.response?.data?.details || ''} ${err?.message || ''}`.toLowerCase();
  if (status === 503 || status === 502) {
    return text.includes('ssh is not connected') || text.includes('ssh not connected');
  }
  return false;
}

export function teamSpeakConnectionTitle(error: unknown, failedTitle?: string): string {
  if (isTeamSpeakLogviewIo(error)) {
    return adminOpsText('errors.connection.logviewTitle', 'TeamSpeak log file unavailable');
  }
  if (isTeamSpeakSshDisconnected(error)) {
    return adminOpsText('errors.connection.sshTitle', 'SSH reconnecting');
  }
  return isTeamSpeakStarting(error)
    ? adminOpsText('errors.connection.startingTitle', 'TeamSpeak is still starting')
    : failedTitle ?? adminOpsText('errors.connection.failedTitle', 'Connection failed');
}

export function teamSpeakRefreshTone(error: unknown | null | undefined): 'live' | 'degraded' | 'starting' {
  if (!error) return 'live';
  if (isTeamSpeakStarting(error) || isTeamSpeakSshDisconnected(error)) return 'starting';
  return 'degraded';
}

/**
 * Retry Query-backed pages through flood cooldowns and cold-start transport failures.
 * Flood (429): do not stampede. Starting / SSH reconnect only: keep trying a bit longer.
 * Logview I/O (2052): never auto-retry — hammering TeamSpeak can worsen file locks.
 * Ordinary 503 (e.g. refresh-failure fixtures) use the short retry budget.
 */
export function teamSpeakQueryRetry(failureCount: number, error: unknown): boolean {
  if (isTeamSpeakLogviewIo(error)) return false;
  const status = (error as any)?.response?.status;
  if (status === 429) return false;
  if (isTeamSpeakStarting(error) || isTeamSpeakSshDisconnected(error)) return failureCount < 10;
  return failureCount < 3;
}

export function teamSpeakQueryRetryDelay(attempt: number, error: unknown): number {
  if (isTeamSpeakLogviewIo(error)) return 0;

  const retryAfterHeader = Number((error as any)?.response?.headers?.['retry-after']);
  const retryAfterBody = Number((error as any)?.response?.data?.retryAfterSeconds);
  const retryAfter = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
    ? retryAfterHeader
    : (Number.isFinite(retryAfterBody) && retryAfterBody > 0 ? retryAfterBody : 0);
  if (retryAfter > 0) return Math.min(60_000, retryAfter * 1000);

  if (isTeamSpeakStarting(error) || isTeamSpeakSshDisconnected(error)) {
    return Math.min(8_000, 1_000 * 2 ** attempt);
  }
  return Math.min(1_500, 300 * 2 ** attempt);
}
