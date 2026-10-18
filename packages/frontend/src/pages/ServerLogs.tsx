import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ServerLogPage } from '@ts6/common';
import { LOGVIEW_MAX_LINES } from '@ts6/common';
import { logsApi } from '@/api/bans.api';
import { useServerStore } from '@/stores/server.store';
import { useServers, useVirtualServers } from '@/hooks/use-servers';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { PageHeader } from '@/components/shared/PageHeader';
import { RefreshStatus, StaleDataNotice } from '@/components/shared/RefreshStatus';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  apiErrorMessage,
  isTeamSpeakLogviewIo,
  isTeamSpeakStarting,
  teamSpeakConnectionTitle,
  teamSpeakQueryRetry,
  teamSpeakQueryRetryDelay,
  teamSpeakRefreshTone,
} from '@/lib/api-error';
import {
  connectionSidScopeKey,
  historyRefreshPresentation,
  nextScopedCursorStack,
} from '@/lib/history-status-consistency';
import {
  formatLogTimestamp,
  logLevelMatchesFilter,
  parseServerLogLine,
  type ServerLogLevel,
} from '@/lib/server-logs';
import { formatLocalDateTime } from '@/lib/formatting';

const LEVEL_COLORS: Record<ServerLogLevel, string> = {
  ERROR: 'text-destructive bg-destructive/10 border-destructive/20',
  WARNING: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  INFO: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  DEBUG: 'text-muted-foreground bg-muted/50 border-border/50',
  UNKNOWN: 'text-muted-foreground bg-muted/30 border-border/40',
};

const PAGE_SIZE_OPTIONS = ['50', '100'] as const;

const LEVEL_BADGE_KEY: Record<ServerLogLevel, string> = {
  ERROR: 'logs.levelBadge.error',
  WARNING: 'logs.levelBadge.warning',
  INFO: 'logs.levelBadge.info',
  DEBUG: 'logs.levelBadge.debug',
  UNKNOWN: 'logs.levelBadge.unknown',
};

export default function ServerLogs() {
  const { t } = useTranslation('adminOps');
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const { data: servers } = useServers();
  const { data: virtualServers, isLoading: virtualServersLoading, error: virtualServersError, refetch: refetchVirtualServers, isFetching: virtualServersFetching } = useVirtualServers();

  const [lines, setLines] = useState<string>('100');
  const [instanceMode, setInstanceMode] = useState(false);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  /** Scope for paging: connection/SID + page size + instance vs VS logfile. */
  const pageScopeKey = `${connectionSidScopeKey(c, s)}:${lines}:${instanceMode ? 'i' : 'v'}`;
  const [pageState, setPageState] = useState<{ scopeKey: string; cursorStack: string[] }>({
    scopeKey: pageScopeKey,
    cursorStack: [],
  });
  const [filterScopeKey, setFilterScopeKey] = useState(pageScopeKey);

  const scopedPage = nextScopedCursorStack(pageState, pageScopeKey, []);
  if (scopedPage !== pageState) {
    setPageState(scopedPage);
  }
  if (filterScopeKey !== pageScopeKey) {
    setFilterScopeKey(pageScopeKey);
    setFilter('');
    setLevelFilter('ALL');
  }

  const cursorStack = scopedPage.cursorStack;
  const beginPos = cursorStack.length ? cursorStack[cursorStack.length - 1] : null;

  const pageSize = Math.min(LOGVIEW_MAX_LINES, Math.max(1, parseInt(lines, 10) || 100));
  const contextIsValid = !!virtualServers?.some((server: any) => Number(server.virtualserver_id) === s);

  const query = useQuery({
    queryKey: ['logs', c, s, pageSize, instanceMode, beginPos],
    queryFn: () => logsApi.getPage(c!, s!, {
      lines: pageSize,
      reverse: 1,
      instance: instanceMode ? 1 : 0,
      beginPos,
    }),
    // Gate on a confirmed virtual-server context (same as clients/channels/dashboard).
    enabled: !!c && !!s && contextIsValid,
    retry: teamSpeakQueryRetry,
    retryDelay: teamSpeakQueryRetryDelay,
  });

  const page = query.data as ServerLogPage | undefined;
  const parsedEntries = useMemo(
    () => (page?.entries ?? []).map((entry) => ({
      ...entry,
      parsed: parseServerLogLine(entry.sourceText),
    })),
    [page],
  );

  const filtered = useMemo(() => {
    return parsedEntries.filter((entry) => {
      if (!logLevelMatchesFilter(entry.parsed.level, levelFilter)) return false;
      if (filter && !entry.sourceText.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [parsedEntries, filter, levelFilter]);

  const connection = servers?.find((server: any) => Number(server.id) === c);
  const virtualServer = virtualServers?.find((server: any) => Number(server.virtualserver_id) === s);
  const hasPage = !!page;
  const gateError = query.error || virtualServersError;
  const isFetchingGate = query.isFetching || virtualServersFetching;

  const retryGate = () => {
    void refetchVirtualServers();
    void query.refetch();
  };

  const refreshNewest = () => {
    if (cursorStack.length > 0) {
      setPageState({ scopeKey: pageScopeKey, cursorStack: [] });
      return;
    }
    void query.refetch();
  };

  const goOlder = () => {
    if (!page?.nextBeginPos) return;
    setPageState((prev) => ({
      scopeKey: pageScopeKey,
      cursorStack: prev.scopeKey === pageScopeKey ? [...prev.cursorStack, page.nextBeginPos!] : [page.nextBeginPos!],
    }));
  };

  const goPrevious = () => {
    setPageState((prev) => ({
      scopeKey: pageScopeKey,
      cursorStack: prev.scopeKey === pageScopeKey ? prev.cursorStack.slice(0, -1) : [],
    }));
  };

  if (!c || !s) return <NoServerSelectedState pageTitle={t('logs.title')} icon={ScrollText} />;

  if (gateError && !hasPage) {
    const logviewIo = isTeamSpeakLogviewIo(gateError);
    return (
      <div className="space-y-4">
        <EmptyState
          icon={ScrollText}
          title={teamSpeakConnectionTitle(gateError)}
          description={apiErrorMessage(
            gateError,
            logviewIo
              ? t('logs.errors.logviewIo')
              : isTeamSpeakStarting(gateError)
                ? t('logs.errors.starting')
                : t('logs.errors.loadFailed'),
          )}
        />
        <div className="flex justify-center">
          <Button size="sm" variant="outline" onClick={retryGate} disabled={isFetchingGate}>
            {isFetchingGate ? t('common:refresh.retrying') : t('common:action.retry')}
          </Button>
        </div>
      </div>
    );
  }

  if ((query.isLoading || virtualServersLoading || !contextIsValid) && !hasPage) {
    return <PageLoader />;
  }

  const backgroundError = gateError
    ? apiErrorMessage(
      gateError,
      isTeamSpeakLogviewIo(gateError)
        ? t('logs.errors.logviewIoBackground')
        : isTeamSpeakStarting(gateError)
          ? t('logs.errors.startingBackground')
          : t('logs.errors.refreshFailed'),
    )
    : null;
  const refreshTone = !contextIsValid && !gateError
    ? 'starting'
    : teamSpeakRefreshTone(gateError);
  const onNewestPage = cursorStack.length === 0;
  const refreshPresentation = historyRefreshPresentation({
    isFetching: isFetchingGate,
    hasError: !!gateError,
    livePolling: false,
    idleStaticLabel: onNewestPage ? t('logs.refresh.idleNewest') : t('logs.refresh.idleOlder'),
    refreshingLabel: t('logs.refresh.refreshing'),
    degradedLabel: t('logs.refresh.degraded'),
  });

  const filtersActive = filter.length > 0 || levelFilter !== 'ALL';
  const scopeMismatch = hasPage && page.context.instance !== instanceMode;
  const emptyMessage = (() => {
    if (filtered.length > 0) return null;
    if (parsedEntries.length === 0) {
      if (beginPos) {
        return t('logs.empty.noOlder');
      }
      if (instanceMode) {
        return t('logs.empty.instanceEmpty');
      }
      return t('logs.empty.virtualServerEmpty');
    }
    if (filtersActive) return t('logs.empty.noMatches');
    return null;
  })();

  const scopeLabel = instanceMode
    ? t('logs.scope.instance')
    : virtualServer?.virtualserver_name
      ? t('logs.scope.virtualServerNamed', { sid: s, name: virtualServer.virtualserver_name })
      : t('logs.scope.virtualServer', { sid: s });

  return (
    <div className="space-y-4" data-testid="server-logs-page">
      <PageHeader
        title={t('logs.title')}
        icon={ScrollText}
        description={(
          <div className="space-y-1">
            <p>
              {t('logs.connection', {
                name: connection?.name ?? t('logs.configFallback', { id: c }),
              })}
            </p>
            <p data-testid="logs-scope-label">{scopeLabel}</p>
            {page?.fetchedAt && (
              <p className="text-xs">{t('logs.fetched', { time: formatLocalDateTime(page.fetchedAt) })}</p>
            )}
          </div>
        )}
        actions={(
          <Button size="sm" variant="outline" onClick={refreshNewest} disabled={isFetchingGate} aria-busy={isFetchingGate}>
            <RefreshCw className={cn('h-4 w-4 mr-1', query.isFetching && 'animate-spin')} /> {t('common:action.refresh')}
          </Button>
        )}
        metadata={(
          <RefreshStatus
            isRefreshing={isFetchingGate}
            tone={refreshTone === 'live' ? refreshPresentation.tone : refreshTone}
            idleLabel={refreshPresentation.idleLabel}
            refreshingLabel={refreshPresentation.refreshingLabel}
            degradedLabel={refreshPresentation.degradedLabel}
            startingLabel={t('common:refresh.waiting')}
          />
        )}
      />

      {backgroundError && (
        <StaleDataNotice
          message={backgroundError}
          onRetry={retryGate}
          isRetrying={isFetchingGate}
        />
      )}

      {scopeMismatch && (
        <StaleDataNotice
          message={t('logs.errors.scopeMismatch')}
          onRetry={retryGate}
          isRetrying={isFetchingGate}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('logs.filterPlaceholder')}
            aria-label={t('logs.filterLabel')}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] min-w-28 flex-1 text-xs sm:w-[150px] sm:flex-none" aria-label={t('logs.levelFilterLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('logs.level.all')}</SelectItem>
            <SelectItem value="ERROR">{t('logs.level.error')}</SelectItem>
            <SelectItem value="WARNING">{t('logs.level.warning')}</SelectItem>
            <SelectItem value="INFO">{t('logs.level.info')}</SelectItem>
            <SelectItem value="DEBUG">{t('logs.level.debug')}</SelectItem>
            <SelectItem value="UNKNOWN">{t('logs.level.unknown')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={lines} onValueChange={setLines}>
          <SelectTrigger className="h-9 w-[calc(50%-0.25rem)] min-w-28 flex-1 text-xs sm:w-[130px] sm:flex-none" aria-label={t('logs.pageSizeLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((value) => (
              <SelectItem key={value} value={value}>{t('logs.lines', { count: Number(value) })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={instanceMode ? 'instance' : 'vs'} onValueChange={(v) => setInstanceMode(v === 'instance')}>
          <SelectTrigger className="h-9 w-full min-w-40 flex-1 text-xs sm:w-[200px] sm:flex-none" aria-label={t('logs.sourceScopeLabel')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vs">{t('logs.sourceVirtualServer')}</SelectItem>
            <SelectItem value="instance">{t('logs.sourceInstance')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="logs-filter-hint">
        {t('logs.filterHint')}
      </p>
      <p className="text-xs text-muted-foreground" data-testid="logs-timezone-hint">
        {t('logs.timezoneHint')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={goPrevious}
          disabled={cursorStack.length === 0 || query.isFetching}
          data-testid="logs-previous"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> {t('logs.previous')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={goOlder}
          disabled={!page?.nextBeginPos || query.isFetching}
          data-testid="logs-older"
        >
          {t('logs.older')} <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        <span className="text-xs text-muted-foreground" data-testid="logs-page-meta">
          {cursorStack.length === 0
            ? (page?.nextBeginPos ? t('logs.pageMeta.newest') : t('logs.pageMeta.newestEnd'))
            : (page?.nextBeginPos
              ? t('logs.pageMeta.older', { count: cursorStack.length })
              : t('logs.pageMeta.olderEnd', { count: cursorStack.length }))}
        </span>
      </div>

      <div className="min-w-0 rounded-md border border-border bg-card overflow-hidden shadow-sm">
        <ScrollArea className="h-[max(18rem,calc(100dvh-22rem))] sm:h-[calc(100dvh-300px)]">
          <div className="p-3 space-y-0.5 min-w-0">
            {emptyMessage ? (
              <p className="text-center text-muted-foreground text-sm py-10" data-testid="logs-empty">
                {emptyMessage}
              </p>
            ) : (
              filtered.map((entry, i) => {
                const { text: tsText } = formatLogTimestamp(entry.parsed);
                return (
                  <div
                    key={`${entry.lastPos ?? 'row'}-${i}`}
                    className="flex min-w-0 items-start gap-2 py-0.5 group hover:bg-muted/10 rounded px-1"
                    data-testid="log-row"
                  >
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded border shrink-0 font-mono-data uppercase tracking-wider mt-0.5',
                        LEVEL_COLORS[entry.parsed.level],
                      )}
                    >
                      {t(LEVEL_BADGE_KEY[entry.parsed.level])}
                    </span>
                    <div className="min-w-0 flex-1">
                      {tsText && (
                        <div className="text-[10px] text-muted-foreground font-mono-data mb-0.5 break-all">
                          {tsText}
                        </div>
                      )}
                      <p className="text-xs font-mono-data text-muted-foreground leading-relaxed whitespace-pre-wrap break-all [overflow-wrap:anywhere]">
                        {entry.sourceText}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="logs-count">
        {instanceMode
          ? t('logs.countInstance', { filtered: filtered.length, total: parsedEntries.length })
          : t('logs.countVirtualServer', { filtered: filtered.length, total: parsedEntries.length, sid: s })}
      </p>
    </div>
  );
}
