/**
 * Slice 6 PR4 — action-local compatibility / permission guidance.
 * Read success (browse, list, diagnostic permissions stage) never implies write authorization.
 */

import { adminOpsText, apiErrorMessage } from './api-error';

export type FileActionKind = 'browse' | 'create' | 'delete';

export type ActionPrerequisiteKind =
  | 'ssh_required'
  | 'ssh_failed'
  | 'permission_denied'
  | 'generic';

/** Shown beside write actions when the user already listed the folder successfully. */
export const FILE_WRITE_READ_DOES_NOT_AUTHORIZE =
  'Browsing this folder does not confirm permission to create or delete files.';

/** Shown under a successful WebQuery permissions diagnostic stage. */
export const DIAGNOSTIC_READ_DOES_NOT_AUTHORIZE_WRITES =
  'Confirms management read access only — not write authorization for kicks, bans, file changes, or settings.';

function errorPayloadText(error: unknown): string {
  const err = error as { response?: { data?: Record<string, unknown> }; message?: string };
  const data = err?.response?.data ?? {};
  return `${data.error || ''} ${data.details || ''} ${data.reason || ''} ${err?.message || ''}`.toLowerCase();
}

export function classifyActionPrerequisite(error: unknown): ActionPrerequisiteKind {
  const err = error as { response?: { data?: Record<string, unknown> } };
  const data = err?.response?.data ?? {};
  const reason = String(data.reason || '');
  const code = Number(data.code);
  const text = errorPayloadText(error);

  // Permission only: reason, TS 2568, or permission-specific wording — not bare "insufficient"
  // (e.g. "insufficient disk space" must stay generic).
  if (
    reason === 'ts_permission_denied'
    || code === 2568
    || /insufficient\s+(?:client\s+|teamspeak\s+)?permissions?/.test(text)
  ) {
    return 'permission_denied';
  }
  // Disconnected session ≠ missing credentials.
  if (reason === 'ts_ssh_disconnected' || text.includes('ssh not connected') || text.includes('ssh is not connected')) {
    return 'ssh_failed';
  }
  // Structured SSH-required reasons (backend); text matching stays for older servers.
  if (
    reason === 'ssh_required'
    || reason === 'ts_ssh_required'
    || reason === 'ssh_credentials_missing'
    || reason === 'ts_ssh_not_configured'
  ) {
    return 'ssh_required';
  }
  if (
    text.includes('ssh credentials not configured')
    || text.includes('webquery http does not support')
  ) {
    return 'ssh_required';
  }
  if (text.includes('ssh')) {
    return 'ssh_failed';
  }
  return 'generic';
}

/** Human-readable prerequisite / permission copy for file browser list failures. */
export function fileBrowseErrorMessage(error: unknown): string {
  const err = error as { response?: { data?: Record<string, unknown> } };
  const reason = String(err?.response?.data?.reason || '');
  switch (classifyActionPrerequisite(error)) {
    case 'ssh_required':
      return adminOpsText(
        'files.browse.sshRequired',
        'File browsing requires SSH access because the TeamSpeak WebQuery HTTP API does not support file transfer commands. Configure SSH credentials (username and password) in server settings.',
      );
    case 'ssh_failed':
      if (reason === 'ts_ssh_disconnected') {
        return adminOpsText(
          'files.browse.sshDisconnected',
          'SSH to TeamSpeak is temporarily disconnected (often after Query flood protection on startup). Wait a moment and retry — credentials are usually fine.',
        );
      }
      return adminOpsText(
        'files.browse.sshFailed',
        'Could not connect to TeamSpeak via SSH. Check the SSH credentials and port in server settings.',
      );
    case 'permission_denied':
      return adminOpsText(
        'files.browse.permissionDenied',
        'The Query identity lacks permission to list files in this channel. WebQuery read success does not grant file-transfer access.',
      );
    default:
      return apiErrorMessage(
        error,
        adminOpsText(
          'files.browse.failed',
          'Failed to load files. Ensure SSH credentials are configured in server settings.',
        ),
      );
  }
}

/** Human-readable errors for mkdir / delete — never treat browse success as write auth. */
export function fileWriteErrorMessage(error: unknown, action: 'create' | 'delete'): string {
  const err = error as { response?: { data?: Record<string, unknown> } };
  const reason = String(err?.response?.data?.reason || '');
  const fallbacks = action === 'create'
    ? {
      sshRequired: 'Cannot create directories: SSH is required for file changes (WebQuery HTTP does not support ft* commands).',
      sshDisconnected: 'Cannot create directories: SSH is temporarily disconnected. Wait for reconnect and retry.',
      sshFailed: 'Cannot create directories: SSH connection failed. Check SSH credentials and port in server settings.',
      permissionDenied: 'Insufficient TeamSpeak permission to create directories. Listing this folder does not authorize writes — grant the Query identity the required file-transfer permissions.',
      failed: 'Failed to create directory',
    }
    : {
      sshRequired: 'Cannot delete files: SSH is required for file changes (WebQuery HTTP does not support ft* commands).',
      sshDisconnected: 'Cannot delete files: SSH is temporarily disconnected. Wait for reconnect and retry.',
      sshFailed: 'Cannot delete files: SSH connection failed. Check SSH credentials and port in server settings.',
      permissionDenied: 'Insufficient TeamSpeak permission to delete files. Listing this folder does not authorize writes — grant the Query identity the required file-transfer permissions.',
      failed: 'Failed to delete file',
    };
  const keyPrefix = `files.write.${action}`;
  switch (classifyActionPrerequisite(error)) {
    case 'ssh_required':
      return adminOpsText(`${keyPrefix}.sshRequired`, fallbacks.sshRequired);
    case 'ssh_failed':
      if (reason === 'ts_ssh_disconnected') {
        return adminOpsText(`${keyPrefix}.sshDisconnected`, fallbacks.sshDisconnected);
      }
      return adminOpsText(`${keyPrefix}.sshFailed`, fallbacks.sshFailed);
    case 'permission_denied':
      return adminOpsText(`${keyPrefix}.permissionDenied`, fallbacks.permissionDenied);
    default:
      return apiErrorMessage(error, adminOpsText(`${keyPrefix}.failed`, fallbacks.failed));
  }
}

export function fileDeleteConfirmDescription(entryName: string, fullPath: string): string {
  return adminOpsText(
    'guidance.deleteConfirm',
    `Are you sure you want to delete "${entryName}" (${fullPath})? This cannot be undone. ${FILE_WRITE_READ_DOES_NOT_AUTHORIZE}`,
    { name: entryName, path: fullPath },
  );
}

/**
 * Success toast for staged WebQuery diagnostics.
 * Must not claim write / admin mutation authorization.
 */
export function diagnosticSuccessToastMessage(version?: string): string {
  return version
    ? adminOpsText(
      'guidance.diagnosticSuccessWithVersion',
      `WebQuery read stages OK (${version}) — write actions still need their own permissions`,
      { version },
    )
    : adminOpsText(
      'guidance.diagnosticSuccessWithoutVersion',
      'WebQuery read stages succeeded — write actions still need their own permissions',
    );
}

export function claimsWriteAuthorization(message: string): boolean {
  const lower = message.toLowerCase();
  if (lower.includes('write')) {
    // Explicit "not write" / "still need" disclaimers are allowed.
    if (
      lower.includes('not write')
      || lower.includes('does not')
      || lower.includes('still need')
      || lower.includes('only')
    ) {
      return false;
    }
    return true;
  }
  return (
    lower.includes('full admin')
    || lower.includes('authorized to modify')
    || lower.includes('write authorization granted')
  );
}
