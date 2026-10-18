import { TeamSpeakFloodError, TSApiError } from '../middleware/error-handler.js';
import { validateTsQueryServerId } from '../utils/validate-ts-host.js';
import {
  DEFAULT_LOCALE,
  translate,
  type MessageKey,
  type SupportedLocale,
} from '../i18n/index.js';

/** Staged WebQuery connection diagnostic stages (#91 Slice 2). */
export const DIAGNOSTIC_STAGE_IDS = [
  'reachability',
  'authentication',
  'permissions',
  'virtual_server',
] as const;

export type DiagnosticStageId = (typeof DIAGNOSTIC_STAGE_IDS)[number];
export type DiagnosticStageStatus = 'ok' | 'fail' | 'skipped';
export type DiagnosticOverall = 'ok' | 'partial' | 'fail';

export interface DiagnosticStageResult {
  id: DiagnosticStageId;
  status: DiagnosticStageStatus;
  /** Operator-safe message — never includes secrets or raw TeamSpeak bodies. */
  message: string;
  /** Stable machine code for UI / logs. */
  code?: string;
}

export interface ConnectionDiagnosticReport {
  /** True only when every required stage is ok (complete admin success). */
  success: boolean;
  /** Some stages ok, but not a complete admin success. */
  partial: boolean;
  overall: DiagnosticOverall;
  stages: DiagnosticStageResult[];
  /** Sanitized version string when known. */
  version?: string;
}

export interface DiagnoseConnectionOptions {
  /** Virtual server id for the final stage (default 1). */
  sid?: number;
  /** Hard deadline for the whole diagnose run (default 20s). */
  overallTimeoutMs?: number;
  /** Response language for stage messages (default English). */
  locale?: SupportedLocale;
}

/** Minimal client surface used by diagnostics (real + demo + mocks). */
export interface DiagnosticWebQueryClient {
  execute(
    sid: number,
    command: string,
    params?: Record<string, unknown>,
    options?: { priority?: 'high' | 'normal' | 'low' },
  ): Promise<unknown>;
}

/** Overall budget across all diagnostic stages. Frontend `test` /
 * `testWebqueryDraft` use CONNECTION_DIAGNOSTICS_TIMEOUT_MS (30s) so the
 * axios client does not abort before this deadline returns a staged report. */
const DEFAULT_OVERALL_TIMEOUT_MS = 20_000;
const STAGE_LABEL_KEY: Record<DiagnosticStageId, MessageKey> = {
  reachability: 'diagnostics.connection.stage.reachability',
  authentication: 'diagnostics.connection.stage.authentication',
  permissions: 'diagnostics.connection.stage.permissions',
  virtual_server: 'diagnostics.connection.stage.virtual_server',
};

const SENSITIVE_SUBSTRINGS = [
  'apikey',
  'api-key',
  'api_key',
  'x-api-key',
  'password',
  'passwd',
  'authorization',
  'bearer ',
];

type ClassifiedKind =
  | 'network'
  | 'timeout'
  | 'flood'
  | 'auth'
  | 'permission'
  | 'unknown';

interface ClassifiedError {
  kind: ClassifiedKind;
  code: string;
  message: string;
}

function isFloodLikeError(error: unknown): boolean {
  if (error instanceof TeamSpeakFloodError) return true;
  const code = tsCode(error);
  if (code === 524 || code === 3329 || code === 3331) return true;
  const msg = tsMessage(error).toLowerCase();
  return msg.includes('flood');
}

function isTimeoutError(error: unknown): boolean {
  const err = error as { code?: string; name?: string; message?: string; cause?: { code?: string } };
  const code = err?.code || err?.cause?.code;
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return true;
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError') return true;
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('timed out');
}

function isNetworkError(error: unknown): boolean {
  if (isTimeoutError(error)) return false;
  const err = error as { code?: string; message?: string; cause?: { code?: string } };
  const code = err?.code || err?.cause?.code;
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === 'EAI_AGAIN' ||
    code === 'ENETUNREACH' ||
    code === 'EPIPE'
  ) {
    return true;
  }
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('socket hang up') ||
    msg.includes('network socket disconnected') ||
    msg.includes('connection failed')
  );
}

function tsCode(error: unknown): number | undefined {
  if (error instanceof TSApiError) return error.code;
  const nested = (error as { response?: { data?: { status?: { code?: number } } } })?.response?.data?.status?.code;
  return typeof nested === 'number' ? nested : undefined;
}

function tsMessage(error: unknown): string {
  if (error instanceof TSApiError) return error.message;
  const nested = (error as { response?: { data?: { status?: { message?: string } } } })?.response?.data?.status?.message;
  if (nested) return String(nested);
  return String((error as { message?: string })?.message || '');
}

function isAuthError(error: unknown): boolean {
  const msg = tsMessage(error).toLowerCase();
  if (
    msg.includes('invalid apikey') ||
    msg.includes('invalid api key') ||
    msg.includes('invalid api-key') ||
    msg.includes('apikey invalid') ||
    msg.includes('unauthorized') ||
    msg.includes('not authenticated')
  ) {
    return true;
  }
  const code = tsCode(error);
  // Common Query auth / identity failures.
  return code === 512 || code === 520 || code === 1282;
}

function isPermissionError(error: unknown): boolean {
  const code = tsCode(error);
  if (code === 2568 || code === 2567 || code === 1796) return true;
  const msg = tsMessage(error).toLowerCase();
  return msg.includes('insufficient') || msg.includes('permission');
}

/** Map thrown errors to stable operator-safe codes (no secrets / raw bodies). */
export function classifyDiagnosticError(
  error: unknown,
  locale: SupportedLocale = DEFAULT_LOCALE,
): ClassifiedError {
  if (isFloodLikeError(error)) {
    const retry =
      error instanceof TeamSpeakFloodError
        ? error.retryAfterSeconds
        : undefined;
    return {
      kind: 'flood',
      code: 'flood',
      message: retry
        ? translate(locale, 'diagnostics.connection.flood_retry', { seconds: retry })
        : translate(locale, 'diagnostics.connection.flood_wait'),
    };
  }

  if (isTimeoutError(error)) {
    return {
      kind: 'timeout',
      code: 'timeout',
      message: translate(locale, 'diagnostics.connection.timeout'),
    };
  }

  if (isNetworkError(error)) {
    return {
      kind: 'network',
      code: 'unreachable',
      message: translate(locale, 'diagnostics.connection.unreachable'),
    };
  }

  if (isAuthError(error)) {
    return {
      kind: 'auth',
      code: 'invalid_apikey',
      message: translate(locale, 'diagnostics.connection.invalid_apikey'),
    };
  }

  if (isPermissionError(error)) {
    return {
      kind: 'permission',
      code: 'permission_denied',
      message: translate(locale, 'diagnostics.connection.permission_denied'),
    };
  }

  return {
    kind: 'unknown',
    code: 'query_failed',
    message: translate(locale, 'diagnostics.connection.query_failed'),
  };
}

/** Strip anything that could echo credentials from a version string. */
export function sanitizeVersionString(raw: unknown): string | undefined {
  if (raw == null) return undefined;

  let text: string;
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    text = String(raw);
  } else if (Array.isArray(raw)) {
    const first = raw[0] as { version?: unknown; platform?: unknown; build?: unknown } | undefined;
    if (first && typeof first === 'object') {
      const parts = [first.version, first.platform, first.build]
        .filter((part) => part != null && String(part).trim() !== '')
        .map((part) => String(part));
      text = parts.join(' ');
    } else {
      text = '';
    }
  } else if (typeof raw === 'object') {
    const obj = raw as { version?: unknown };
    text = obj.version != null ? String(obj.version) : '';
  } else {
    text = '';
  }

  text = text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120);
  if (!text) return undefined;

  const lower = text.toLowerCase();
  for (const needle of SENSITIVE_SUBSTRINGS) {
    if (lower.includes(needle)) return undefined;
  }
  return text;
}

/** Ensure a report JSON never contains provided secret values or password-like material. */
export function assertReportHasNoSecrets(
  report: ConnectionDiagnosticReport,
  forbidden: string[] = [],
): void {
  const serialized = JSON.stringify(report);
  const lower = serialized.toLowerCase();
  for (const raw of forbidden) {
    if (!raw || raw.length < 4) continue;
    if (serialized.includes(raw) || lower.includes(raw.toLowerCase())) {
      throw new Error('Diagnostic report leaked a forbidden secret value');
    }
  }
  // Heuristic: reject authorization-style header echoes / password fields.
  if (/"password"\s*:/.test(lower) || lower.includes('x-api-key:') || lower.includes('authorization:')) {
    throw new Error('Diagnostic report leaked credential field material');
  }
}

export function buildFloodDiagnosticReport(
  retryAfterSeconds?: number,
  locale: SupportedLocale = DEFAULT_LOCALE,
): ConnectionDiagnosticReport {
  const message = retryAfterSeconds
    ? translate(locale, 'diagnostics.connection.flood_retry', { seconds: retryAfterSeconds })
    : translate(locale, 'diagnostics.connection.flood_wait');
  const skippedMessage = translate(locale, 'diagnostics.connection.skipped_flood');
  const stages: DiagnosticStageResult[] = DIAGNOSTIC_STAGE_IDS.map((id, index) =>
    index === 0
      ? { id, status: 'fail', message, code: 'flood' }
      : { id, status: 'skipped', message: skippedMessage, code: 'skipped' },
  );
  return finalizeReport(stages);
}

export function buildFullSuccessReport(
  version = 'Demo mode',
  locale: SupportedLocale = DEFAULT_LOCALE,
): ConnectionDiagnosticReport {
  const confirmed = (id: DiagnosticStageId): DiagnosticStageResult => ({
    id,
    status: 'ok',
    message: translate(locale, 'diagnostics.connection.stage_confirmed', {
      stage: translate(locale, STAGE_LABEL_KEY[id]),
    }),
  });
  const stages: DiagnosticStageResult[] = [
    confirmed('reachability'),
    confirmed('authentication'),
    confirmed('permissions'),
    confirmed('virtual_server'),
  ];
  return finalizeReport(stages, sanitizeVersionString(version) ?? version);
}

export function finalizeReport(
  stages: DiagnosticStageResult[],
  version?: string,
): ConnectionDiagnosticReport {
  const okCount = stages.filter((s) => s.status === 'ok').length;
  const failCount = stages.filter((s) => s.status === 'fail').length;
  const allOk = stages.length === DIAGNOSTIC_STAGE_IDS.length && okCount === stages.length;
  const partial = !allOk && okCount > 0;
  const overall: DiagnosticOverall = allOk ? 'ok' : partial ? 'partial' : 'fail';
  const report: ConnectionDiagnosticReport = {
    success: allOk,
    partial,
    overall,
    stages,
  };
  if (version) report.version = version;
  // failCount unused except for clarity in reviews — kept for future metrics.
  void failCount;
  return report;
}

function skipRemaining(
  fromIndex: number,
  reason: string,
  code = 'skipped',
): DiagnosticStageResult[] {
  return DIAGNOSTIC_STAGE_IDS.slice(fromIndex).map((id) => ({
    id,
    status: 'skipped' as const,
    message: reason,
    code,
  }));
}

async function withDeadline<T>(promise: Promise<T>, deadlineMs: number): Promise<T> {
  const remaining = Math.max(0, deadlineMs - Date.now());
  if (remaining <= 0) {
    const err = new Error('Diagnostic overall timeout');
    err.name = 'TimeoutError';
    throw err;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error('Diagnostic overall timeout');
          err.name = 'TimeoutError';
          reject(err);
        }, remaining);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Run read-only staged WebQuery diagnostics.
 * Does not mutate TeamSpeak state. Does not retry on flood.
 */
export async function diagnoseConnection(
  client: DiagnosticWebQueryClient,
  options: DiagnoseConnectionOptions = {},
): Promise<ConnectionDiagnosticReport> {
  // Default virtual server 1. Callers (routes) must not pass request-body sid —
  // that re-taints the WebQuery path for CodeQL request-forgery.
  const virtualSid = options.sid === undefined
    ? 1
    : (() => {
        const parsed = validateTsQueryServerId(options.sid);
        return parsed > 0 ? parsed : 1;
      })();
  const deadline = Date.now() + (options.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS);
  const locale = options.locale ?? DEFAULT_LOCALE;
  const t = (key: MessageKey, variables?: Record<string, string | number>) =>
    translate(locale, key, variables);
  const stages: DiagnosticStageResult[] = [];
  let version: string | undefined;

  const pushFailAndSkip = (
    id: DiagnosticStageId,
    classified: ClassifiedError,
    skipReason: string,
  ): ConnectionDiagnosticReport => {
    const index = DIAGNOSTIC_STAGE_IDS.indexOf(id);
    stages.push({
      id,
      status: 'fail',
      message: classified.message,
      code: classified.code,
    });
    stages.push(...skipRemaining(index + 1, skipReason, 'skipped'));
    return finalizeReport(stages, version);
  };

  // --- Stage 1: reachability (version) ---
  try {
    const body = await withDeadline(
      client.execute(0, 'version', undefined, { priority: 'high' }),
      deadline,
    );
    version = sanitizeVersionString(body);
    stages.push({
      id: 'reachability',
      status: 'ok',
      message: version
        ? t('diagnostics.connection.endpoint_reachable_version', { version })
        : t('diagnostics.connection.endpoint_reachable'),
    });
  } catch (error) {
    const classified = classifyDiagnosticError(error, locale);

    // Auth rejection still proves the HTTP endpoint is reachable.
    if (classified.kind === 'auth') {
      stages.push({
        id: 'reachability',
        status: 'ok',
        message: t('diagnostics.connection.endpoint_reachable_auth_rejected'),
      });
      return pushFailAndSkip(
        'authentication',
        classified,
        t('diagnostics.connection.skipped_auth'),
      );
    }

    if (classified.kind === 'flood') {
      return pushFailAndSkip(
        'reachability',
        classified,
        t('diagnostics.connection.skipped_flood'),
      );
    }

    return pushFailAndSkip(
      'reachability',
      classified.kind === 'timeout'
        ? classified
        : classified.kind === 'network'
          ? classified
          : {
              kind: 'network',
              code: classified.code === 'query_failed' ? 'unreachable' : classified.code,
              message: classified.kind === 'unknown'
                ? t('diagnostics.connection.reachability_probe_failed')
                : classified.message,
            },
      t('diagnostics.connection.skipped_reachability'),
    );
  }

  // --- Stage 2: authentication (whoami) ---
  try {
    await withDeadline(
      client.execute(0, 'whoami', undefined, { priority: 'high' }),
      deadline,
    );
    stages.push({
      id: 'authentication',
      status: 'ok',
      message: t('diagnostics.connection.authenticated'),
    });
  } catch (error) {
    const classified = classifyDiagnosticError(error, locale);
    if (classified.kind === 'flood') {
      return pushFailAndSkip('authentication', classified, t('diagnostics.connection.skipped_flood'));
    }
    if (classified.kind === 'timeout' || classified.kind === 'network') {
      return pushFailAndSkip(
        'authentication',
        classified,
        t('diagnostics.connection.skipped_auth_probe'),
      );
    }
    return pushFailAndSkip(
      'authentication',
      classified.kind === 'auth'
        ? classified
        : {
            kind: 'auth',
            code: classified.kind === 'permission' ? 'permission_denied' : 'invalid_apikey',
            message: classified.kind === 'permission'
              ? classified.message
              : t('diagnostics.connection.authenticated_identity_unconfirmed'),
          },
      t('diagnostics.connection.skipped_auth'),
    );
  }

  // --- Stage 3: permissions (serverlist — guest/version alone must not pass) ---
  try {
    await withDeadline(
      client.execute(0, 'serverlist', undefined, { priority: 'high' }),
      deadline,
    );
    stages.push({
      id: 'permissions',
      status: 'ok',
      message: t('diagnostics.connection.permissions_confirmed'),
    });
  } catch (error) {
    const classified = classifyDiagnosticError(error, locale);
    if (classified.kind === 'flood') {
      return pushFailAndSkip('permissions', classified, t('diagnostics.connection.skipped_flood'));
    }
    if (classified.kind === 'auth') {
      return pushFailAndSkip('permissions', {
        kind: 'auth',
        code: 'invalid_apikey',
        message: classified.message,
      }, t('diagnostics.connection.skipped_auth'));
    }
    if (classified.kind === 'timeout' || classified.kind === 'network') {
      return pushFailAndSkip(
        'permissions',
        classified,
        t('diagnostics.connection.skipped_permissions_probe'),
      );
    }
    return pushFailAndSkip(
      'permissions',
      classified.kind === 'permission'
        ? classified
        : {
            kind: 'permission',
            code: 'permission_denied',
            message: t('diagnostics.connection.permissions_missing'),
          },
      t('diagnostics.connection.skipped_permissions'),
    );
  }

  // --- Stage 4: virtual server (serverinfo on selected sid) ---
  try {
    await withDeadline(
      client.execute(virtualSid, 'serverinfo', undefined, { priority: 'high' }),
      deadline,
    );
    stages.push({
      id: 'virtual_server',
      status: 'ok',
      message: t('diagnostics.connection.virtual_server_accessible', { sid: virtualSid }),
    });
  } catch (error) {
    const classified = classifyDiagnosticError(error, locale);
    if (classified.kind === 'flood') {
      return pushFailAndSkip('virtual_server', classified, t('diagnostics.connection.skipped_flood'));
    }
    stages.push({
      id: 'virtual_server',
      status: 'fail',
      message: classified.kind === 'permission' || classified.kind === 'unknown'
        ? t('diagnostics.connection.virtual_server_inaccessible', { sid: virtualSid })
        : classified.message,
      code: classified.kind === 'timeout'
        ? 'timeout'
        : classified.kind === 'network'
          ? 'unreachable'
          : classified.kind === 'auth'
            ? 'invalid_apikey'
            : 'virtual_server_inaccessible',
    });
  }

  return finalizeReport(stages, version);
}

/** Toast / UI helper shared with route tests. */
export function summarizeDiagnosticToast(
  report: ConnectionDiagnosticReport,
  locale: SupportedLocale = DEFAULT_LOCALE,
): string {
  if (report.success) {
    return report.version
      ? translate(locale, 'diagnostics.connection.toast_success_version', { version: report.version })
      : translate(locale, 'diagnostics.connection.toast_success');
  }
  const failed = report.stages.find((s) => s.status === 'fail');
  if (report.partial && failed) {
    return translate(locale, 'diagnostics.connection.toast_partial', { message: failed.message });
  }
  if (failed) {
    return failed.message;
  }
  return translate(locale, 'diagnostics.connection.toast_failed');
}
