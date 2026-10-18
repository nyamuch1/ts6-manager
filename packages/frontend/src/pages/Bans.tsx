import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useBans, useAddBan, useDeleteBan } from '@/hooks/use-bans';
import { useServerStore } from '@/stores/server.store';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { formatDuration, timeAgo } from '@/lib/utils';
import { Ban, Plus, Trash2 } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';

export default function Bans() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { selectedConfigId, selectedSid } = useServerStore();
  const { data, isLoading } = useBans();
  const addBan = useAddBan();
  const deleteBan = useDeleteBan();
  const [showAdd, setShowAdd] = useState(false);
  const [banType, setBanType] = useState<'ip' | 'name' | 'uid'>('ip');
  const [banValue, setBanValue] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('3600');

  const bans = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: 'lastnickname', header: t('bans.lastNickname'), cell: ({ getValue }) => <span className="font-medium">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'ip', header: t('bans.ip'), cell: ({ getValue }) => <span className="font-mono-data text-xs">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'uid', header: t('bans.uid'), cell: ({ getValue }) => <span className="font-mono-data text-xs truncate max-w-[120px] block">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'reason', header: t('bans.reason'), cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'duration', header: t('bans.duration'), cell: ({ getValue }) => <span className="font-mono-data text-xs">{getValue() === 0 ? t('bans.permanent') : formatDuration(getValue() as number)}</span> },
    { accessorKey: 'created', header: t('bans.created'), cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{timeAgo(getValue() as number)}</span> },
    { accessorKey: 'invokername', header: t('bans.by'), cell: ({ getValue }) => <span className="text-xs">{(getValue() as string) || '-'}</span> },
    {
      id: 'actions', header: () => <span className="sr-only">{t('actions')}</span>,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          aria-label={t('bans.removeAria', { name: row.original.lastnickname || row.original.ip || t('bans.entry') })}
          onClick={() => {
          deleteBan.mutate(row.original.banid, { onSuccess: () => toast.success(t('bans.removed')) });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ], [deleteBan.mutate, t]);

  if (!selectedConfigId || !selectedSid) return <NoServerSelectedState pageTitle={t('bans.title')} icon={Ban} />;
  if (isLoading) return <PageLoader />;

  const handleAdd = () => {
    const params: any = { time: parseInt(banDuration), banreason: banReason };
    params[banType] = banValue;
    addBan.mutate(params, {
      onSuccess: () => { toast.success(t('bans.added')); setShowAdd(false); setBanValue(''); setBanReason(''); },
      onError: () => toast.error(t('bans.addFailed')),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('bans.title')}</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> {t('bans.addBan')}</Button>
      </div>

      <DataTable
        columns={columns}
        data={bans}
        searchEnabled
        searchLabel={t('bans.searchLabel')}
        searchPlaceholder={t('bans.searchPlaceholder')}
        tableLabel={t('bans.tableLabel')}
        density="compact"
        stickyHeader
        emptyText={t('bans.empty')}
        filteredEmptyText={t('bans.filteredEmpty')}
      />

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('bans.addBan')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t('bans.banType')}</Label>
              <Select value={banType} onValueChange={(v: any) => setBanType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip">{t('bans.ipAddress')}</SelectItem>
                  <SelectItem value="name">{t('bans.nameRegex')}</SelectItem>
                  <SelectItem value="uid">{t('bans.uniqueId')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t('bans.value')}</Label><Input value={banValue} onChange={(e) => setBanValue(e.target.value)} placeholder={banType === 'ip' ? '192.168.1.*' : banType === 'name' ? '.*bad.*' : 'unique-id'} /></div>
            <div><Label className="text-xs">{t('bans.reason')}</Label><Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder={t('bans.reasonPlaceholder')} /></div>
            <div>
              <Label className="text-xs">{t('bans.duration')}</Label>
              <Select value={banDuration} onValueChange={setBanDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3600">{t('bans.hour1')}</SelectItem>
                  <SelectItem value="86400">{t('bans.day1')}</SelectItem>
                  <SelectItem value="604800">{t('bans.week1')}</SelectItem>
                  <SelectItem value="2592000">{t('bans.days30')}</SelectItem>
                  <SelectItem value="0">{t('bans.permanent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{tc('action.cancel')}</Button>
            <Button onClick={handleAdd} disabled={!banValue}>{t('bans.addBan')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
