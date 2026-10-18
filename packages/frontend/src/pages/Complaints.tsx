import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { complaintsApi } from '@/api/bans.api';
import { useServerStore } from '@/stores/server.store';
import { DataTable } from '@/components/shared/DataTable';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { MessageSquareWarning } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { timeAgo } from '@/lib/utils';

export default function Complaints() {
  const { t } = useTranslation('admin');
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const { data, isLoading } = useQuery({ queryKey: ['complaints', c, s], queryFn: () => complaintsApi.list(c!, s!), enabled: !!c && !!s });

  const complaints = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: 'fname', header: t('complaints.from') },
    { accessorKey: 'tname', header: t('complaints.about') },
    { accessorKey: 'message', header: t('complaints.message') },
    { accessorKey: 'timestamp', header: t('complaints.when'), cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{timeAgo(getValue() as number)}</span> },
  ], [t]);

  if (!c || !s) return <NoServerSelectedState pageTitle={t('complaints.title')} icon={MessageSquareWarning} />;
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t('complaints.title')}</h1>
      <DataTable
        columns={columns}
        data={complaints}
        searchEnabled
        searchLabel={t('complaints.searchLabel')}
        searchPlaceholder={t('complaints.searchPlaceholder')}
        tableLabel={t('complaints.tableLabel')}
        density="comfortable"
        emptyText={t('complaints.empty')}
        filteredEmptyText={t('complaints.filteredEmpty')}
      />
    </div>
  );
}
