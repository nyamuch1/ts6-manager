import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { serversApi } from '@/api/servers.api';
import { useServerStore } from '@/stores/server.store';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { NoServerSelectedState } from '@/components/shared/NoServerSelectedState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { shouldClearInstanceDraft, mergeClearedInstanceFields, type InstanceSaveTarget } from '@/lib/action-ownership';
import { Cpu, Save, Server, Globe } from 'lucide-react';
import { formatBytes, formatUptime } from '@/lib/utils';
import { apiErrorMessage, teamSpeakQueryRetry } from '@/lib/api-error';
import { toast } from 'sonner';

const floodAwareRetry = teamSpeakQueryRetry;

export default function Instance() {
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation();
  const { selectedConfigId: c } = useServerStore();
  const qc = useQueryClient();
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [draftConfigId, setDraftConfigId] = useState<number | null>(c ?? null);
  const [ownerGeneration, setOwnerGeneration] = useState(0);
  const draftMetaRef = useRef({ configId: c ?? null, generation: 0 });
  draftMetaRef.current = { configId: draftConfigId, generation: ownerGeneration };

  useEffect(() => {
    setEditFields({});
    setDraftConfigId(c ?? null);
    setOwnerGeneration((g) => g + 1);
  }, [c]);

  const infoQuery = useQuery({
    queryKey: ['instance-info', c],
    queryFn: () => serversApi.instanceInfo(c!),
    enabled: !!c,
    retry: floodAwareRetry,
    refetchInterval: (query) => (query.state.error as any)?.response?.status === 429 ? 15_000 : false,
  });
  const hostQuery = useQuery({
    queryKey: ['host-info', c],
    queryFn: () => serversApi.hostInfo(c!),
    enabled: !!c,
    retry: floodAwareRetry,
    refetchInterval: (query) => (query.state.error as any)?.response?.status === 429 ? 15_000 : false,
  });
  const versionQuery = useQuery({
    queryKey: ['version', c],
    queryFn: () => serversApi.version(c!),
    enabled: !!c,
    retry: floodAwareRetry,
    refetchInterval: (query) => (query.state.error as any)?.response?.status === 429 ? 15_000 : false,
  });

  const { data: info, isLoading: loadingInfo, error: infoError, isFetching: fetchingInfo, refetch: refetchInfo } = infoQuery;
  const { data: host, isLoading: loadingHost, error: hostError, isFetching: fetchingHost, refetch: refetchHost } = hostQuery;
  const { data: version, error: versionError, refetch: refetchVersion } = versionQuery;

  const editMutation = useMutation({
    mutationFn: (target: InstanceSaveTarget) => serversApi.instanceEdit(target.configId, target.data),
    onSuccess: (_data, target) => {
      qc.invalidateQueries({ queryKey: ['instance-info', target.configId] });
      toast.success(t('instance.updated'));
      const live = draftMetaRef.current;
      if (shouldClearInstanceDraft(live.configId, target.configId, live.generation, target.ownerGeneration)) {
        setEditFields((prev) => mergeClearedInstanceFields(prev, Object.keys(target.data)));
      }
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('instance.updateFailed'))),
  });

  if (!c) return <NoServerSelectedState pageTitle={t('instance.title')} icon={Cpu} />;
  if ((loadingInfo || loadingHost) && !info && !host) return <PageLoader />;

  const loadError = infoError || hostError || versionError;
  if (!info && !host && loadError) {
    const detail = apiErrorMessage(loadError, t('instance.loadFailed'));
    return (
      <div className="space-y-4">
        <EmptyState icon={Cpu} title={t('instance.unavailable')} description={detail} />
        <div className="flex justify-center">
          <Button
            size="sm"
            variant="outline"
            disabled={fetchingInfo || fetchingHost}
            onClick={() => {
              void refetchInfo();
              void refetchHost();
              void refetchVersion();
            }}
          >
            {(fetchingInfo || fetchingHost) ? t('retrying') : tc('action.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const instanceData = Array.isArray(info) ? info[0] : info;
  const hostData = Array.isArray(host) ? host[0] : host;
  const versionData = Array.isArray(version) ? version[0] : version;

  const editableFields = [
    { key: 'serverinstance_guest_serverquery_group', labelKey: 'instance.fields.guestServerQueryGroup', type: 'number' },
    { key: 'serverinstance_template_serveradmin_group', labelKey: 'instance.fields.templateServerAdminGroup', type: 'number' },
    { key: 'serverinstance_template_serverdefault_group', labelKey: 'instance.fields.templateServerDefaultGroup', type: 'number' },
    { key: 'serverinstance_template_channeldefault_group', labelKey: 'instance.fields.templateChannelDefaultGroup', type: 'number' },
    { key: 'serverinstance_template_channeladmin_group', labelKey: 'instance.fields.templateChannelAdminGroup', type: 'number' },
    { key: 'serverinstance_filetransfer_port', labelKey: 'instance.fields.fileTransferPort', type: 'number' },
    { key: 'serverinstance_serverquery_flood_commands', labelKey: 'instance.fields.floodCommands', type: 'number' },
    { key: 'serverinstance_serverquery_flood_time', labelKey: 'instance.fields.floodTime', type: 'number' },
    { key: 'serverinstance_serverquery_flood_ban_time', labelKey: 'instance.fields.floodBanTime', type: 'number' },
  ];

  const handleSave = () => {
    if (!c || Object.keys(editFields).length === 0) return;
    const data: Record<string, number> = {};
    for (const [k, v] of Object.entries(editFields)) data[k] = parseInt(v, 10);
    const target: InstanceSaveTarget = {
      configId: c,
      ownerGeneration,
      data,
    };
    setDraftConfigId(c);
    editMutation.mutate(target);
  };

  const backgroundError = loadError
    ? apiErrorMessage(loadError, t('instance.refreshFailed'))
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('instance.title')}</h1>
        {backgroundError && (
          <p className="text-xs text-amber-600 dark:text-amber-400 max-w-xl" role="status">
            {backgroundError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Version Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> {t('instance.version')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label={t('instance.version')} value={versionData?.version} />
            <InfoRow label={t('instance.build')} value={versionData?.build} />
            <InfoRow label={t('instance.platform')} value={versionData?.platform} />
          </CardContent>
        </Card>

        {/* Host Info Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> {t('instance.host')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label={t('instance.uptime')} value={hostData?.instance_uptime ? formatUptime(hostData.instance_uptime) : '-'} />
            <InfoRow label={t('instance.bytesSent')} value={hostData?.connection_bytes_sent_total ? formatBytes(hostData.connection_bytes_sent_total) : '-'} />
            <InfoRow label={t('instance.bytesReceived')} value={hostData?.connection_bytes_received_total ? formatBytes(hostData.connection_bytes_received_total) : '-'} />
            <InfoRow label={t('instance.virtualServers')} value={hostData?.virtualservers_total_maxclients ? `${hostData.virtualservers_total_clients_online || 0} / ${hostData.virtualservers_total_maxclients}` : '-'} />
          </CardContent>
        </Card>

        {/* Database Info Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> {t('instance.database')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label={t('instance.dbPlugin')} value={instanceData?.serverinstance_database_version} />
            <InfoRow label={t('instance.ftPort')} value={instanceData?.serverinstance_filetransfer_port} />
            <InfoRow label={t('instance.permissionsVersion')} value={instanceData?.serverinstance_permissions_version} />
          </CardContent>
        </Card>
      </div>

      {/* Editable Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{t('instance.settings')}</CardTitle>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                Object.keys(editFields).length === 0
                || (editMutation.isPending
                  && editMutation.variables?.configId === c
                  && editMutation.variables?.ownerGeneration === ownerGeneration)
              }
            >
              <Save className="h-4 w-4 mr-1" /> {t('instance.saveChanges')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editableFields.map((field) => {
              const current = instanceData?.[field.key];
              const value = editFields[field.key] ?? (current != null ? String(current) : '');
              return (
                <div key={`${c}-${field.key}`}>
                  <Label className="text-xs text-muted-foreground">{t(field.labelKey)}</Label>
                  <Input
                    type="number"
                    className="h-8 mt-1 font-mono-data text-xs"
                    value={value}
                    onChange={(e) => {
                      setDraftConfigId(c ?? null);
                      setEditFields((prev) => ({ ...prev, [field.key]: e.target.value }));
                    }}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-data font-medium">{value ?? '-'}</span>
    </div>
  );
}
