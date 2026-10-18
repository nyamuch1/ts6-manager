import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokensApi } from '@/api/bans.api';
import { useServerStore } from '@/stores/server.store';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { KeyRound, Trash2, Copy } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

export default function Tokens() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const { data, isLoading } = useQuery({ queryKey: ['tokens', c, s], queryFn: () => tokensApi.list(c!, s!), enabled: !!c && !!s });
  const qc = useQueryClient();
  const deleteToken = useMutation({ mutationFn: (token: string) => tokensApi.delete(c!, s!, token), onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }) });

  const tokens = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: 'token', header: t('tokens.token'), cell: ({ getValue }) => (
      <div className="flex items-center gap-1">
        <span className="font-mono-data text-xs truncate max-w-[200px]">{getValue() as string}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('tokens.copyAria')}
          onClick={() => { void navigator.clipboard.writeText(getValue() as string); toast.success(tc('action.copied')); }}
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    )},
    { accessorKey: 'token_type', header: t('tokens.type'), cell: ({ getValue }) => <span className="text-xs">{(getValue() as number) === 0 ? t('tokens.serverGroup') : t('tokens.channelGroup')}</span> },
    { accessorKey: 'token_id1', header: t('tokens.groupId'), cell: ({ getValue }) => <span className="font-mono-data text-xs">{getValue() as number}</span> },
    { accessorKey: 'token_description', header: t('tokens.description'), cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) || '-'}</span> },
    { id: 'actions', header: () => <span className="sr-only">{t('actions')}</span>, cell: ({ row }) => (
      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={t('tokens.deleteAria')} onClick={() => deleteToken.mutate(row.original.token, { onSuccess: () => toast.success(t('tokens.deleted')) })}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    )},
  ], [deleteToken.mutate, t, tc]);

  if (!c || !s) return <NoServerSelectedState pageTitle={t('tokens.title')} icon={KeyRound} />;
  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t('tokens.title')}</h1>
      <DataTable
        columns={columns}
        data={tokens}
        searchEnabled
        searchLabel={t('tokens.searchLabel')}
        searchPlaceholder={t('tokens.searchPlaceholder')}
        tableLabel={t('tokens.tableLabel')}
        density="compact"
        stickyHeader
        emptyText={t('tokens.empty')}
        filteredEmptyText={t('tokens.filteredEmpty')}
      />
    </div>
  );
}
