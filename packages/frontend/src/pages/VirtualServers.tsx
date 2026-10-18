import { useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useStartVirtualServer, useStopVirtualServer, useVirtualServers } from '@/hooks/use-servers';
import { useServerStore } from '@/stores/server.store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { PageHeader } from '@/components/shared/PageHeader';
import { RefreshStatus, StaleDataNotice } from '@/components/shared/RefreshStatus';
import { formatUptime } from '@/lib/utils';
import { formatNumber } from '@/lib/formatting';
import { apiErrorMessage } from '@/lib/api-error';
import { Server, Play, Square, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type StopTarget = {
  configId: number;
  sid: number;
  name: string;
};

export default function VirtualServers() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { selectedConfigId } = useServerStore();
  const { data, isLoading, error, refetch, isFetching } = useVirtualServers();
  const startServer = useStartVirtualServer();
  const stopServer = useStopVirtualServer();
  const [startingSid, setStartingSid] = useState<number | null>(null);
  const [stopTarget, setStopTarget] = useState<StopTarget | null>(null);
  const [stopError, setStopError] = useState('');
  const actionGuards = useRef(new Set<string>());
  const stopCancelButton = useRef<HTMLButtonElement>(null);

  if (!selectedConfigId) return <NoServerSelectedState pageTitle={t('virtualServers.title')} icon={Server} />;
  if (isLoading && data === undefined) return <PageLoader />;
  if (error && data === undefined) {
    return (
      <div className="space-y-4">
        <EmptyState icon={Server} title={t('connectionFailed')} description={apiErrorMessage(error, t('virtualServers.loadFailed'))} />
        <div className="flex justify-center">
          <Button size="sm" variant="outline" onClick={() => { void refetch(); }} disabled={isFetching} aria-busy={isFetching}>
            {isFetching ? t('retrying') : tc('action.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const servers = Array.isArray(data) ? data : [];
  const onlineServers = servers.filter((server: any) => server.virtualserver_status === 'online').length;
  const backgroundError = error
    ? apiErrorMessage(error, t('virtualServers.refreshFailed'))
    : null;

  const handleStart = (sid: number, name: string) => {
    const configId = selectedConfigId;
    const guardKey = `start:${configId}:${sid}`;
    if (actionGuards.current.has(guardKey)) return;
    actionGuards.current.add(guardKey);
    setStartingSid(sid);
    startServer.mutate(
      { configId, sid },
      {
        onSuccess: () => toast.success(t('virtualServers.started', { name })),
        onError: (error) => toast.error(t('virtualServers.startFailed', { name, message: apiErrorMessage(error, t('virtualServers.notAccepted')) })),
        onSettled: () => {
          actionGuards.current.delete(guardKey);
          setStartingSid((current) => current === sid ? null : current);
        },
      },
    );
  };

  const closeStopDialog = () => {
    setStopTarget(null);
    setStopError('');
  };

  const handleStop = () => {
    if (!stopTarget) return;
    const target = stopTarget;
    const guardKey = `stop:${target.configId}:${target.sid}`;
    if (actionGuards.current.has(guardKey)) return;
    actionGuards.current.add(guardKey);
    setStopError('');
    stopServer.mutate(
      { configId: target.configId, sid: target.sid },
      {
        onSuccess: () => {
          toast.success(t('virtualServers.stopped', { name: target.name }));
          closeStopDialog();
        },
        onError: (error) => {
          const message = t('virtualServers.stopFailed', { name: target.name, message: apiErrorMessage(error, t('virtualServers.notAccepted')) });
          setStopError(message);
          toast.error(message);
        },
        onSettled: () => { actionGuards.current.delete(guardKey); },
      },
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('virtualServers.title')}
        icon={Server}
        description={t('virtualServers.description', { count: formatNumber(servers.length) })}
        badge={<Badge variant="secondary" className="font-mono-data">{t('virtualServers.onlineCount', { count: formatNumber(onlineServers) })}</Badge>}
        metadata={<RefreshStatus isRefreshing={isFetching} idleLabel={t('virtualServers.idleLabel')} refreshingLabel={t('virtualServers.refreshingLabel')} />}
      />

      {backgroundError && (
        <StaleDataNotice
          message={backgroundError}
          onRetry={() => { void refetch(); }}
          isRetrying={isFetching}
        />
      )}

      <div className="grid gap-3">
        {servers.map((vs: any) => (
          <Card
            key={vs.virtualserver_id}
            role="group"
            aria-label={t('virtualServers.ariaLabel', { name: vs.virtualserver_name })}
            className="hover:border-primary/30 transition-colors"
          >
            <CardContent className="p-4">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Server className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-medium">{vs.virtualserver_name}</span>
                      <Badge variant={vs.virtualserver_status === 'online' ? 'success' : 'secondary'} className="text-[10px]">
                        {vs.virtualserver_status?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono-data">{t('virtualServers.sid', { id: vs.virtualserver_id })}</span>
                      <span className="font-mono-data">{t('virtualServers.port', { port: vs.virtualserver_port })}</span>
                      {vs.virtualserver_status === 'online' && (
                        <>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {vs.virtualserver_clientsonline - (vs.virtualserver_queryclientsonline || 0)}/{vs.virtualserver_maxclients}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatUptime(vs.virtualserver_uptime || 0)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {vs.virtualserver_status === 'online' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStopTarget({ configId: selectedConfigId, sid: Number(vs.virtualserver_id), name: String(vs.virtualserver_name) });
                        setStopError('');
                      }}
                    >
                      <Square className="h-3 w-3 mr-1" /> {tc('action.stop')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleStart(Number(vs.virtualserver_id), String(vs.virtualserver_name))}
                      disabled={startingSid === Number(vs.virtualserver_id)}
                      aria-busy={startingSid === Number(vs.virtualserver_id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      {startingSid === Number(vs.virtualserver_id) ? t('virtualServers.starting') : tc('action.start')}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={!!stopTarget}
        onOpenChange={(open) => { if (!open && !stopServer.isPending) closeStopDialog(); }}
      >
        <DialogContent onOpenAutoFocus={(event) => { event.preventDefault(); stopCancelButton.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{t('virtualServers.stopTitle')}</DialogTitle>
            <DialogDescription>
              <Trans
                i18nKey="admin:virtualServers.stopDescription"
                values={{ name: stopTarget?.name, sid: stopTarget?.sid }}
                components={{ name: <span className="font-medium text-foreground" /> }}
              />
            </DialogDescription>
          </DialogHeader>
          {stopError && <p role="alert" className="text-sm text-destructive">{stopError}</p>}
          <DialogFooter>
            <Button ref={stopCancelButton} className="min-h-10" variant="outline" onClick={closeStopDialog} disabled={stopServer.isPending}>{tc('action.cancel')}</Button>
            <Button
              className="min-h-10"
              variant="destructive"
              onClick={handleStop}
              disabled={stopServer.isPending}
              aria-busy={stopServer.isPending}
            >
              <Square className="h-4 w-4 mr-1" />
              {stopServer.isPending ? t('virtualServers.stopping') : t('virtualServers.stopServer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
