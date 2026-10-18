import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityJournalApi } from '@/api/activity-journal.api';
import { useServerStore } from '@/stores/server.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { RefreshStatus, StaleDataNotice } from '@/components/shared/RefreshStatus';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotebookPen, RefreshCw } from 'lucide-react';
import {
  activityJournalHistoryRefetchInterval,
  activityJournalStatusRefetchInterval,
} from '@/lib/activity-journal-live';
import {
  shouldApplyJournalToggleResult,
  sameJournalTarget,
  type JournalTargetToggle,
} from '@/lib/action-ownership';
import {
  connectionSidScopeKey,
  historyRefreshPresentation,
  nextScopedCursorStack,
  resolveCaptureStatusDisplay,
  type CaptureStatusDisplay,
} from '@/lib/history-status-consistency';
import { apiErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import type {
  ActivityCaptureStatus,
  ActivityClassification,
  ActivityJournalStatus,
  ClientActivityEntry,
} from '@ts6/common';

const STATUS_CLASS: Record<ActivityCaptureStatus | 'unknown', string> = {
  unknown: 'text-muted-foreground',
  disabled: 'text-muted-foreground',
  connecting: 'text-amber-600',
  capturing: 'text-emerald-600',
  interrupted: 'text-amber-600',
  persistence_error: 'text-destructive',
};

function classLabel(c: ActivityClassification, t: TFunction): string {
  switch (c) {
    case 'known_bot':
      return t('journal.classification.knownBot');
    case 'query':
      return t('journal.classification.query');
    case 'voice':
      return t('journal.classification.voice');
    default:
      return t('journal.classification.unknown');
  }
}

function captureStatusText(
  display: CaptureStatusDisplay,
  reconnectAttempt: number | undefined,
  t: TFunction,
): string {
  if (display.kind === 'unknown') return t('journal.captureStatus.unknown');
  let base = display.status === 'persistence_error'
    ? t('journal.captureStatus.persistenceError')
    : t(`journal.captureStatus.${display.status}`);
  if (display.status === 'interrupted' && (reconnectAttempt ?? 0) > 0) {
    base = t('journal.captureStatus.reconnecting');
  }
  return display.kind === 'stale'
    ? t('journal.captureStatus.stale', { status: base })
    : base;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ActivityJournal() {
  const { t } = useTranslation('adminOps');
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const queryClient = useQueryClient();
  const scopeKey = connectionSidScopeKey(c, s);
  const [kindFilter, setKindFilter] = useState<'ALL' | 'join' | 'leave'>('ALL');
  const [classFilter, setClassFilter] = useState<'ALL' | ActivityClassification>('ALL');
  const [filterScopeKey, setFilterScopeKey] = useState(scopeKey);
  const [pageState, setPageState] = useState<{ scopeKey: string; cursorStack: (string | null)[] }>({
    scopeKey,
    cursorStack: [null],
  });
  const [ownerGeneration, setOwnerGeneration] = useState(0);
  const liveRef = useRef({ configId: c ?? null, sid: s ?? null, ownerGeneration: 0 });
  liveRef.current = { configId: c ?? null, sid: s ?? null, ownerGeneration };

  // Synchronous scope reset — avoid one render that fetches the new pair with an old cursor.
  const scopedPage = nextScopedCursorStack(pageState, scopeKey, [null]);
  if (scopedPage !== pageState) {
    setPageState(scopedPage);
    setOwnerGeneration((g) => g + 1);
  }
  if (filterScopeKey !== scopeKey) {
    setFilterScopeKey(scopeKey);
    setKindFilter('ALL');
    setClassFilter('ALL');
  }

  const cursorStack = scopedPage.cursorStack;
  const cursor = cursorStack[cursorStack.length - 1];

  const statusQuery = useQuery({
    queryKey: ['activity-journal-status'],
    queryFn: () => activityJournalApi.getStatus(),
    refetchInterval: (query) => {
      const rows = query.state.data?.statuses;
      const pair =
        c && s && rows
          ? rows.find((row) => row.serverConfigId === c && row.virtualServerId === s)
          : undefined;
      return activityJournalStatusRefetchInterval({
        enabled: pair?.enabled === true,
        status: pair?.status ?? 'unknown',
      });
    },
  });

  const pairStatus = useMemo((): ActivityJournalStatus | null => {
    if (!c || !s || !statusQuery.data) return null;
    return (
      statusQuery.data.statuses.find(
        (row: ActivityJournalStatus) => row.serverConfigId === c && row.virtualServerId === s,
      ) || null
    );
  }, [c, s, statusQuery.data]);

  const captureDisplay = resolveCaptureStatusDisplay({
    configId: c,
    sid: s,
    statuses: statusQuery.data?.statuses,
    statusQueryStatus: statusQuery.status,
    hasStatusData: !!statusQuery.data,
  });
  const captureStatusForLive: ActivityCaptureStatus =
    captureDisplay.kind === 'unknown' ? 'disabled' : captureDisplay.status;
  const enabled = pairStatus?.enabled === true;
  const onNewestPage = cursor == null;
  const historyRefetchInterval = activityJournalHistoryRefetchInterval({
    enabled: enabled && captureDisplay.kind === 'current',
    status: captureStatusForLive,
    onNewestPage,
  });
  const historyLive = historyRefetchInterval !== false;

  const historyQuery = useQuery({
    queryKey: ['activity-journal-history', c, s, cursor],
    queryFn: () =>
      activityJournalApi.getHistory({
        serverConfigId: c!,
        virtualServerId: s!,
        cursor: cursor || undefined,
        limit: 50,
      }),
    enabled: !!c && !!s,
    refetchInterval: historyRefetchInterval,
  });

  const targetMutation = useMutation({
    mutationFn: (target: JournalTargetToggle) =>
      activityJournalApi.setTarget(target.configId, target.sid, target.enabled),
    onSuccess: (_data, target) => {
      void queryClient.invalidateQueries({ queryKey: ['activity-journal-status'] });
      void queryClient.invalidateQueries({
        queryKey: ['activity-journal-history', target.configId, target.sid],
      });
      if (shouldApplyJournalToggleResult(liveRef.current, target)) {
        setPageState({ scopeKey, cursorStack: [null] });
      }
    },
  });
  const items = useMemo((): ClientActivityEntry[] => {
    const raw = historyQuery.data?.items || [];
    return raw.filter((entry: ClientActivityEntry) => {
      if (kindFilter !== 'ALL' && entry.eventKind !== kindFilter) return false;
      if (classFilter !== 'ALL' && entry.classification !== classFilter) return false;
      return true;
    });
  }, [historyQuery.data, kindFilter, classFilter]);

  const statusError = statusQuery.isError
    ? apiErrorMessage(statusQuery.error, t('journal.statusError'))
    : null;
  const historyError = historyQuery.isError
    ? apiErrorMessage(
      historyQuery.error,
      historyQuery.data
        ? t('journal.historyRefreshError')
        : t('journal.historyError'),
    )
    : null;
  const backgroundError = statusError || historyError;
  const isFetchingGate = statusQuery.isFetching || historyQuery.isFetching;
  const refreshPresentation = historyRefreshPresentation({
    isFetching: isFetchingGate,
    hasError: !!backgroundError,
    livePolling: historyLive,
    idleLiveLabel: t('journal.refresh.idleLive'),
    idleStaticLabel: onNewestPage
      ? captureStatusForLive === 'connecting'
        ? t('journal.refresh.idleConnecting')
        : captureStatusForLive === 'interrupted'
          ? ((pairStatus?.reconnectAttempt ?? 0) > 0
            ? t('journal.refresh.idleInterruptedReconnecting')
            : t('journal.refresh.idleInterrupted'))
          : t('journal.refresh.idleUpToDate')
      : t('journal.refresh.idleOlder'),
    refreshingLabel: t('journal.refresh.refreshing'),
    degradedLabel: t('journal.refresh.degraded'),
  });

  const retryRefresh = () => {
    void statusQuery.refetch();
    void historyQuery.refetch();
  };

  if (!c || !s) {
    return (
      <NoServerSelectedState
        pageTitle={t('journal.title')}
        icon={NotebookPen}
        selectDescription={t('journal.selectDescription')}
      />
    );
  }

  if (statusQuery.isLoading && historyQuery.isLoading) return <PageLoader />;

  if (historyQuery.isError && !historyQuery.data) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={NotebookPen}
          title={t('journal.loadFailedTitle')}
          description={historyError ?? t('journal.historyError')}
        />
        <div className="flex justify-center">
          <Button size="sm" variant="outline" onClick={retryRefresh} disabled={isFetchingGate}>
            {isFetchingGate ? t('common:refresh.retrying') : t('common:action.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const statusClassKey = captureDisplay.kind === 'unknown' ? 'unknown' : captureDisplay.status;

  return (
    <div className="space-y-4" data-testid="activity-journal-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('journal.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t('journal.description', {
              days: statusQuery.data?.retention.days ?? 7,
              perSid: (statusQuery.data?.retention.perConnectionSid ?? 10000).toLocaleString(),
              global: (statusQuery.data?.retention.global ?? 100000).toLocaleString(),
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RefreshStatus
            isRefreshing={isFetchingGate}
            tone={refreshPresentation.tone}
            idleLabel={refreshPresentation.idleLabel}
            refreshingLabel={refreshPresentation.refreshingLabel}
            degradedLabel={refreshPresentation.degradedLabel}
          />
          {refreshPresentation.showLiveBadge && (
            <span className="text-xs font-medium text-emerald-600" title={t('journal.liveTitle')} data-testid="journal-live-badge">
              {t('journal.live')}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={retryRefresh}
            disabled={isFetchingGate}
            aria-busy={isFetchingGate}
          >
            <RefreshCw
              className={cn(
                'h-4 w-4 mr-1',
                isFetchingGate && 'animate-spin',
              )}
            />
            {t('common:action.refresh')}
          </Button>
        </div>
      </div>

      {backgroundError && historyQuery.data && (
        <StaleDataNotice
          message={backgroundError}
          onRetry={retryRefresh}
          isRetrying={isFetchingGate}
        />
      )}

      <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={enabled}
            disabled={
              !c
              || !s
              || captureDisplay.kind === 'unknown'
              || (targetMutation.isPending && sameJournalTarget({ configId: c, sid: s }, targetMutation.variables))
            }
            onCheckedChange={(v) => {
              if (!c || !s) return;
              targetMutation.mutate({
                configId: c,
                sid: s,
                enabled: v,
                ownerGeneration,
              });
            }}
            id="journal-capture"
          />
          <label htmlFor="journal-capture" className="text-sm font-medium">
            {t('journal.captureFor', { config: c, sid: s })}
          </label>
        </div>
        <div className="text-sm" data-testid="journal-capture-status">
          {t('journal.status')}{' '}
          <span className={cn('font-medium', STATUS_CLASS[statusClassKey], captureDisplay.kind === 'stale' && 'text-amber-600')}>
            {captureStatusText(captureDisplay, pairStatus?.reconnectAttempt, t)}
          </span>
        </div>
        {pairStatus && pairStatus.droppedEvents > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-500/40">
            {t('journal.gaps', { count: pairStatus.droppedEvents })}
          </Badge>
        )}
        {pairStatus?.lastError && (
          <span className="text-xs text-destructive">{pairStatus.lastError}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as typeof kindFilter)}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('journal.filters.allEvents')}</SelectItem>
            <SelectItem value="join">{t('journal.filters.joins')}</SelectItem>
            <SelectItem value="leave">{t('journal.filters.leaves')}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={classFilter}
          onValueChange={(v) => setClassFilter(v as typeof classFilter)}
        >
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('journal.filters.allClassifications')}</SelectItem>
            <SelectItem value="voice">{t('journal.classification.voice')}</SelectItem>
            <SelectItem value="known_bot">{t('journal.classification.knownBot')}</SelectItem>
            <SelectItem value="query">{t('journal.classification.query')}</SelectItem>
            <SelectItem value="unknown">{t('journal.classification.unknown')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 rounded-md border border-border bg-card overflow-hidden shadow-sm">
        <ScrollArea className="h-[max(18rem,calc(100dvh-22rem))] sm:h-[calc(100dvh-300px)]">
          <div className="min-w-0">
            <div
              className="sticky top-0 z-10 grid min-w-[36rem] grid-cols-[10rem_4.5rem_minmax(7rem,1fr)_5.5rem_minmax(8rem,1.25fr)] gap-x-3 border-b border-border bg-card/95 px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur-sm"
              role="row"
            >
              <span>{t('journal.table.dateTime')}</span>
              <span>{t('journal.table.event')}</span>
              <span>{t('journal.table.user')}</span>
              <span>{t('journal.table.type')}</span>
              <span>{t('journal.table.identity')}</span>
            </div>
            <div className="min-w-0 divide-y divide-border/60">
              {historyQuery.isLoading ? (
                <p className="text-center text-muted-foreground text-sm py-10">{t('common:action.loading')}</p>
              ) : items.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-10">
                  {captureDisplay.kind === 'unknown'
                    ? t('journal.empty.unknown')
                    : enabled
                      ? t('journal.empty.enabled')
                      : t('journal.empty.disabled')}
                </p>
              ) : (
                items.map((entry: ClientActivityEntry) => {
                  const identityBits = [
                    entry.databaseId != null
                      ? t('journal.identity.databaseId', { id: entry.databaseId })
                      : null,
                    entry.uniqueId || null,
                    entry.identityProvenance !== 'event' && entry.identityProvenance !== 'none'
                      ? t('journal.identity.via', { value: entry.identityProvenance })
                      : null,
                  ].filter(Boolean);
                  const identityLine = identityBits.join(' · ') || '—';
                  return (
                    <div
                      key={entry.id}
                      role="row"
                      className="grid min-w-[36rem] w-full grid-cols-[10rem_4.5rem_minmax(7rem,1fr)_5.5rem_minmax(8rem,1.25fr)] items-baseline gap-x-3 px-3 py-2 text-sm"
                    >
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatWhen(entry.observedAt)}
                      </span>
                      <span>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {entry.eventKind}
                        </Badge>
                      </span>
                      <span className="min-w-0 truncate font-medium" title={entry.nickname || undefined}>
                        {entry.nickname || t('journal.identity.clientId', { id: entry.clientId })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {classLabel(entry.classification, t)}
                      </span>
                      <span
                        className="min-w-0 truncate text-xs text-muted-foreground font-mono-data"
                        title={entry.uniqueId || identityLine}
                      >
                        {identityLine}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={cursorStack.length <= 1}
          onClick={() => setPageState((prev) => ({
            scopeKey,
            cursorStack: prev.scopeKey === scopeKey ? prev.cursorStack.slice(0, -1) : [null],
          }))}
        >
          {t('journal.newer')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!historyQuery.data?.nextCursor}
          onClick={() => {
            const next = historyQuery.data?.nextCursor;
            if (next) {
              setPageState((prev) => ({
                scopeKey,
                cursorStack: prev.scopeKey === scopeKey ? [...prev.cursorStack, next] : [null, next],
              }));
            }
          }}
        >
          {t('journal.older')}
        </Button>
      </div>
    </div>
  );
}
