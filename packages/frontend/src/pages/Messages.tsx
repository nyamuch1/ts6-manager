import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messagesApi } from '@/api/bans.api';
import { useServerStore } from '@/stores/server.store';
import { DataTable } from '@/components/shared/DataTable';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Mail, Plus, Trash2, Eye } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';

export default function Messages() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { selectedConfigId: c, selectedSid: s } = useServerStore();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['messages', c, s], queryFn: () => messagesApi.list(c!, s!), enabled: !!c && !!s });
  const deleteMutation = useMutation({ mutationFn: (msgid: number) => messagesApi.delete(c!, s!, msgid), onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', c, s] }) });
  const sendMutation = useMutation({ mutationFn: (data: any) => messagesApi.send(c!, s!, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages', c, s] }); toast.success(t('messages.sent')); } });

  const [showCompose, setShowCompose] = useState(false);
  const [showView, setShowView] = useState<any>(null);
  const [toCluid, setToCluid] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const messages = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const columns: ColumnDef<any>[] = useMemo(() => [
    { accessorKey: 'senderName', header: t('messages.from'), cell: ({ getValue }) => <span className="font-medium">{(getValue() as string) || '-'}</span> },
    { accessorKey: 'subject', header: t('messages.subject') },
    { accessorKey: 'timestamp', header: t('messages.date'), cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{timeAgo(getValue() as number)}</span> },
    { accessorKey: 'flag_read', header: t('messages.status'), cell: ({ getValue }) => {
      const read = Number(getValue()) === 1;
      return (
        <span className={`text-xs px-1.5 py-0.5 rounded ${read ? 'bg-muted text-muted-foreground' : 'bg-primary/20 text-primary font-medium'}`}>
          {read ? t('messages.read') : t('messages.unread')}
        </span>
      );
    }},
    {
      id: 'actions', header: () => <span className="sr-only">{t('actions')}</span>,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={t('messages.viewAria', { subject: row.original.subject || '' }).trim()} onClick={() => setShowView(row.original)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label={t('messages.deleteAria', { subject: row.original.subject || '' }).trim()} onClick={() => {
            deleteMutation.mutate(row.original.msgid, { onSuccess: () => toast.success(t('messages.deleted')) });
          }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ], [deleteMutation.mutate, t]);

  if (!c || !s) return <NoServerSelectedState pageTitle={t('messages.title')} icon={Mail} />;
  if (isLoading) return <PageLoader />;

  const handleSend = () => {
    sendMutation.mutate({ cluid: toCluid, subject, message: body }, {
      onSuccess: () => { setShowCompose(false); setToCluid(''); setSubject(''); setBody(''); },
      onError: () => toast.error(t('messages.sendFailed')),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('messages.title')}</h1>
        <Button size="sm" onClick={() => setShowCompose(true)}><Plus className="h-4 w-4 mr-1" /> {t('messages.compose')}</Button>
      </div>

      <DataTable
        columns={columns}
        data={messages}
        searchEnabled
        searchLabel={t('messages.searchLabel')}
        searchPlaceholder={t('messages.searchPlaceholder')}
        tableLabel={t('messages.tableLabel')}
        density="compact"
        stickyHeader
        emptyText={t('messages.empty')}
        filteredEmptyText={t('messages.filteredEmpty')}
      />

      {/* View Message Dialog */}
      <Dialog open={!!showView} onOpenChange={() => setShowView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{showView?.subject || t('messages.fallbackTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t('messages.fromLabel')} <span className="text-foreground font-medium">{showView?.senderName}</span></span>
              <span className="text-border">|</span>
              <span>{showView?.timestamp && timeAgo(showView.timestamp)}</span>
            </div>
            <div className="rounded-md bg-muted/30 border border-border p-3 text-sm min-h-[100px] whitespace-pre-wrap">
              {showView?.message || showView?.subject || t('messages.noContent')}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowView(null)}>{tc('action.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose Dialog */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('messages.composeTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t('messages.recipientUid')}</Label><Input value={toCluid} onChange={(e) => setToCluid(e.target.value)} placeholder={t('messages.recipientUidPlaceholder')} /></div>
            <div><Label className="text-xs">{t('messages.subject')}</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('messages.subjectPlaceholder')} /></div>
            <div><Label className="text-xs">{t('messages.messageLabel')}</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('messages.messagePlaceholder')} rows={5} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompose(false)}>{tc('action.cancel')}</Button>
            <Button onClick={handleSend} disabled={!toCluid || !subject}>{t('messages.send')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
