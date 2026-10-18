import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServers, useVirtualServers } from '@/hooks/use-servers';
import { useAuthStore } from '@/stores/auth.store';
import { useServerStore } from '@/stores/server.store';

export const CONNECTION_SETUP_PATH = '/settings?tab=connections&wizard=1';

/** `hasNoConnections` is only true once the connection list has loaded and is empty. */
export function useConnectionAvailability() {
  const { data: servers, isSuccess, isPending } = useServers();
  return {
    isPending,
    hasNoConnections: isSuccess && Array.isArray(servers) && servers.length === 0,
  };
}

interface NoServerSelectedStateProps {
  pageTitle: string;
  icon: LucideIcon;
  /** Shown when connections exist but none is selected. */
  selectDescription?: string;
}

/**
 * Keeps the page heading visible and explains how to get past the missing server context,
 * so pages gated on a selected connection never render a bare, title-less dead end.
 */
export function NoServerSelectedState({
  pageTitle,
  icon,
  selectDescription,
}: NoServerSelectedStateProps) {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((state) => state.isAdmin());
  const selectedConfigId = useServerStore((state) => state.selectedConfigId);
  const { isPending: connectionsPending, hasNoConnections } = useConnectionAvailability();
  const {
    data: virtualServers,
    isFetching: virtualServersFetching,
    isError: virtualServersFailed,
  } = useVirtualServers();

  const header = <PageHeader title={pageTitle} />;
  const virtualServersResolved = !virtualServersFetching && (virtualServersFailed || Array.isArray(virtualServers));
  const hasVirtualServers = Array.isArray(virtualServers) && virtualServers.length > 0;
  // The header selector auto-selects a connection and virtual server; avoid flashing guidance meanwhile.
  const resolving = connectionsPending
    || (selectedConfigId !== null && (!virtualServersResolved || hasVirtualServers));
  if (resolving) return <div className="space-y-5">{header}</div>;

  let title = t('common:noServer.selected');
  let description = selectDescription ?? t('common:noServer.chooseConnection');
  let action: ReactNode = null;
  if (hasNoConnections) {
    title = isAdmin ? t('common:noServer.noneConfigured') : t('common:noServer.noneAvailable');
    description = isAdmin
      ? t('common:noServer.setupHint')
      : t('common:noServer.askAdmin');
    if (isAdmin) action = <Link to={CONNECTION_SETUP_PATH}>{t('common:noServer.openSetup')}</Link>;
  } else if (selectedConfigId !== null && virtualServersFailed) {
    title = t('common:noServer.virtualUnavailable');
    description = t('common:noServer.virtualUnavailableHint');
    if (isAdmin) action = <Link to="/servers">{t('common:noServer.viewVirtual')}</Link>;
  } else if (selectedConfigId !== null) {
    title = t('common:noServer.noVirtual');
    description = t('common:noServer.noVirtualHint');
    if (isAdmin) action = <Link to="/servers">{t('common:noServer.viewVirtual')}</Link>;
  }

  return (
    <div className="space-y-5">
      {header}
      <EmptyState icon={icon} title={title} description={description}>
        {action && <Button size="sm" asChild>{action}</Button>}
      </EmptyState>
    </div>
  );
}

/** Explains disabled create actions on pages that still list existing items. */
export function ConnectionRequiredNotice({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((state) => state.isAdmin());
  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <span>{children}</span>
      </p>
      {isAdmin && (
        <Button size="sm" variant="outline" asChild>
          <Link to={CONNECTION_SETUP_PATH}>{t('common:noServer.openSetup')}</Link>
        </Button>
      )}
    </div>
  );
}
