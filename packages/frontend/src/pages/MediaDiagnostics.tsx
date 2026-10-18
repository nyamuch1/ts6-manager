import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Copy, RefreshCw, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';
import { redactDiagnosticText, type MediaAdminDiagnosticReport, type MediaDiagnosticCheck, type MediaDiagnosticStatus } from '@ts6/common';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMediaAdminDiagnostics } from '@/hooks/use-media-admin-diagnostics';

function badgeVariant(status: MediaDiagnosticStatus): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'ok') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'fail') return 'destructive';
  return 'outline';
}

function mediaStatusWord(status: MediaDiagnosticStatus, t: TFunction): string {
  if (status === 'ok') return t('mediaDiagnostics.status.green');
  if (status === 'warning') return t('mediaDiagnostics.status.warning');
  if (status === 'fail') return t('mediaDiagnostics.status.failed');
  return t('mediaDiagnostics.status.notChecked');
}

function mediaOverallWord(overall: MediaAdminDiagnosticReport['overall'], t: TFunction): string {
  if (overall === 'ok') return t('mediaDiagnostics.overall.green');
  if (overall === 'partial') return t('mediaDiagnostics.overall.warning');
  return t('mediaDiagnostics.overall.failed');
}

/** Clipboard report, localized in the current UI language (server prose is already localized). */
function formatLocalizedReport(report: MediaAdminDiagnosticReport, t: TFunction): string {
  const statusWord = (status: MediaDiagnosticStatus) => mediaStatusWord(status, t);
  const checks = report.checks.map((check) => {
    const line = check.version
      ? t('mediaDiagnostics.report.checkLineVersion', {
        status: statusWord(check.status),
        label: check.label,
        message: check.message,
        version: check.version,
      })
      : t('mediaDiagnostics.report.checkLine', {
        status: statusWord(check.status),
        label: check.label,
        message: check.message,
      });
    const pathLine = check.path
      ? `\n${t('mediaDiagnostics.report.executable', { path: check.path })}`
      : '';
    const remediation = check.remediation ? `\n  ${check.remediation}` : '';
    return `${line}${pathLine}${remediation}`;
  });
  const sidecarVersion = report.sidecar.version
    ?? t('mediaDiagnostics.notReportedByHealth');
  const encoders = report.encoders.items.map((item) => {
    const kind = item.hardware
      ? t('mediaDiagnostics.encoder.hardware')
      : t('mediaDiagnostics.encoder.software');
    const state = item.available
      ? t('mediaDiagnostics.report.available')
      : item.detail
        ? t('mediaDiagnostics.report.unavailableDetail', { detail: item.detail })
        : t('mediaDiagnostics.report.unavailable');
    return t('mediaDiagnostics.report.encoderItem', {
      id: item.id,
      codec: item.codec,
      kind,
      state,
    });
  });
  const av1 = report.encoders.av1Decode;
  const av1Lines = av1
    ? [
      t('mediaDiagnostics.report.av1', { message: av1.message }),
      ...av1.items.map((item) => t('mediaDiagnostics.report.av1Item', {
        hwaccel: item.hwaccel,
        state: item.available
          ? t('mediaDiagnostics.report.decodesAv1')
          : item.detail
            ? t('mediaDiagnostics.report.doesNotDecodeAv1Detail', { detail: item.detail })
            : t('mediaDiagnostics.report.doesNotDecodeAv1'),
      })),
    ]
    : [];
  const warnings = report.warnings.length
    ? report.warnings.map((warning) => `- ${warning}`)
    : [t('mediaDiagnostics.report.none')];
  return redactDiagnosticText([
    t('mediaDiagnostics.report.title'),
    t('mediaDiagnostics.report.checked', { time: report.checkedAt }),
    t('mediaDiagnostics.report.overall', { overall: mediaOverallWord(report.overall, t) }),
    '',
    t('mediaDiagnostics.report.checks'),
    ...checks,
    '',
    t('mediaDiagnostics.report.sidecar', {
      mode: report.sidecar.mode,
      status: statusWord(report.sidecar.status),
      message: report.sidecar.message,
    }),
    t('mediaDiagnostics.report.version', { version: sidecarVersion }),
    t('mediaDiagnostics.report.health', {
      health: report.sidecar.healthStatus ?? t('mediaDiagnostics.notReported'),
    }),
    t('mediaDiagnostics.report.videoPort', {
      port: report.sidecar.videoPort ?? t('mediaDiagnostics.notReported'),
    }),
    t('mediaDiagnostics.report.audioPort', {
      port: report.sidecar.audioPort ?? t('mediaDiagnostics.notReported'),
    }),
    '',
    t('mediaDiagnostics.report.encoders', {
      status: statusWord(report.encoders.status),
      message: report.encoders.message,
    }),
    ...(encoders.length ? encoders : [t('mediaDiagnostics.report.notLoaded')]),
    ...av1Lines,
    '',
    t('mediaDiagnostics.report.warnings'),
    ...warnings,
  ].join('\n'));
}

function CheckRow({ check }: { readonly check: MediaDiagnosticCheck }) {
  const { t } = useTranslation('adminOps');
  return (
    <li className="rounded-md border border-border px-3 py-2" data-status={check.status}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badgeVariant(check.status)}>{mediaStatusWord(check.status, t)}</Badge>
        <span className="font-medium">{check.label}</span>
        {check.version && <span className="text-xs text-muted-foreground">{check.version}</span>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{check.message}</p>
      {check.path && <p className="mt-1 break-all text-xs text-muted-foreground">{t('mediaDiagnostics.executable', { path: check.path })}</p>}
      {check.remediation && (
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{check.remediation}</p>
      )}
    </li>
  );
}

export default function MediaDiagnostics() {
  const { t } = useTranslation('adminOps');
  const { report, isFetching, isError, invalidated, notChecked, offlineUnchecked, refresh } = useMediaAdminDiagnostics();

  let statusMessage = '';
  if (isFetching) statusMessage = t('mediaDiagnostics.checking');
  else if (report) {
    statusMessage = t('mediaDiagnostics.lastChecked', {
      time: new Date(report.checkedAt).toLocaleString(),
    });
  }

  const copyReport = async () => {
    if (!report) return;
    if (!navigator.clipboard?.writeText) {
      toast.error(t('mediaDiagnostics.clipboardUnavailable'));
      return;
    }
    try {
      await navigator.clipboard.writeText(formatLocalizedReport(report, t));
      toast.success(t('mediaDiagnostics.copied'));
    } catch {
      toast.error(t('mediaDiagnostics.copyFailed'));
    }
  };

  return (
    <div className="space-y-4" data-testid="media-diagnostics">
      <PageHeader
        title={t('mediaDiagnostics.title')}
        icon={Stethoscope}
        description={t('mediaDiagnostics.description')}
        badge={report && (
          <Badge variant={badgeVariant(report.overall === 'partial' ? 'warning' : report.overall)}>
            {mediaOverallWord(report.overall, t)}
          </Badge>
        )}
        actions={(
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void copyReport()} disabled={!report || isFetching}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {t('mediaDiagnostics.copyReport')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => refresh()} disabled={isFetching}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              {t('common:action.refresh')}
            </Button>
          </>
        )}
      />

      <output className="block text-sm text-muted-foreground">{statusMessage}</output>

      {(notChecked || offlineUnchecked) && !report && (
        <p className="text-sm text-muted-foreground">{t('mediaDiagnostics.notChecked')}</p>
      )}
      {isError && !isFetching && (
        <p className="text-sm text-destructive">{t('mediaDiagnostics.runFailed')}</p>
      )}
      {invalidated && report && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{t('mediaDiagnostics.stale')}</p>
      )}

      {report && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('mediaDiagnostics.toolsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {report.checks.map((check) => <CheckRow key={check.id} check={check} />)}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('mediaDiagnostics.sidecarTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Badge variant={badgeVariant(report.sidecar.status)}>{mediaStatusWord(report.sidecar.status, t)}</Badge>
              <p>{report.sidecar.message}</p>
              <dl className="grid gap-1 text-muted-foreground sm:grid-cols-2">
                <div>{t('mediaDiagnostics.mode', { mode: report.sidecar.mode })}</div>
                <div>{t('mediaDiagnostics.version', {
                  version: report.sidecar.version ?? t('mediaDiagnostics.notReportedByHealth'),
                })}</div>
                <div>{t('mediaDiagnostics.health', {
                  health: report.sidecar.healthStatus ?? t('mediaDiagnostics.notReported'),
                })}</div>
                <div>{t('mediaDiagnostics.ports', {
                  video: report.sidecar.videoPort ?? '—',
                  audio: report.sidecar.audioPort ?? '—',
                })}</div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('mediaDiagnostics.encodersTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge variant={badgeVariant(report.encoders.status)}>{mediaStatusWord(report.encoders.status, t)}</Badge>
              <p className="text-sm text-muted-foreground">{report.encoders.message}</p>
              {report.encoders.items.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {report.encoders.items.map((item) => {
                    let status: MediaDiagnosticStatus = 'fail';
                    if (item.available) status = 'ok';
                    else if (item.hardware) status = 'warning';
                    const summary = t('mediaDiagnostics.encoder.summary', {
                      codec: item.codec,
                      kind: item.hardware
                        ? t('mediaDiagnostics.encoder.hardware')
                        : t('mediaDiagnostics.encoder.software'),
                    });
                    return (
                      <li key={item.id} className="flex flex-wrap items-baseline gap-2">
                        <Badge variant={badgeVariant(status)}>
                          {mediaStatusWord(status, t)}
                        </Badge>
                        <span className="font-medium">{item.id}</span>
                        <span className="text-muted-foreground">
                          {item.detail
                            ? t('mediaDiagnostics.encoder.withDetail', { summary, detail: item.detail })
                            : summary}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {report.encoders.av1Decode && (
                <div className="space-y-1 pt-2 text-sm" role="status" aria-live="polite" aria-label={t('mediaDiagnostics.av1Decoding')}>
                  <p className="font-medium">{t('mediaDiagnostics.av1Decoding')}</p>
                  <p className="text-muted-foreground">{report.encoders.av1Decode.message}</p>
                  {report.encoders.av1Decode.items.length > 0 && (
                    <ul className="space-y-1">
                      {report.encoders.av1Decode.items.map((item) => (
                        <li key={item.hwaccel} className="flex flex-wrap items-baseline gap-2">
                          <Badge variant={badgeVariant(item.available ? 'ok' : 'skipped')}>
                            {item.available
                              ? t('mediaDiagnostics.encoder.decodes')
                              : t('mediaDiagnostics.encoder.no')}
                          </Badge>
                          <span className="font-medium">{item.hwaccel}</span>
                          {item.detail && <span className="text-muted-foreground">{item.detail}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('mediaDiagnostics.warningsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {report.warnings.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('mediaDiagnostics.none')}</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {report.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
