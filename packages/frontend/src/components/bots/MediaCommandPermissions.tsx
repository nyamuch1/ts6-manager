import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MEDIA_COMMAND_GROUPS, type MediaCommandGroup, type MediaCommandPermissions } from '@ts6/common';
import { useServerStore } from '@/stores/server.store';
import { useServerGroups } from '@/hooks/use-groups';
import { useMediaCommandPermissions, useSaveMediaCommandPermissions } from '@/hooks/use-chat-commands';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const descriptionKeys: Record<MediaCommandGroup, string> = {
  playback: 'mediaPermissions.descriptions.playback',
  queue: 'mediaPermissions.descriptions.queue',
  video: 'mediaPermissions.descriptions.video',
};

export function MediaCommandPermissions() {
  const { t } = useTranslation('bots');
  const { selectedConfigId, selectedSid } = useServerStore();
  const policy = useMediaCommandPermissions(selectedConfigId, selectedSid);
  const groups = useServerGroups();
  const serverGroups = (Array.isArray(groups.data) ? groups.data : []) as Array<{ sgid: number | string; name: string }>;

  if (!selectedConfigId || !selectedSid) return <p className="text-sm text-muted-foreground">{t('mediaPermissions.selectServer')}</p>;
  if (policy.isPending) return <p className="text-sm text-muted-foreground">{t('mediaPermissions.loading')}</p>;
  if (policy.isError || !policy.data) return <p role="alert" className="text-sm text-destructive">{t('mediaPermissions.loadError')}</p>;

  return <PermissionEditor key={`${selectedConfigId}:${selectedSid}`} configId={selectedConfigId} sid={selectedSid}
    policy={policy.data} groups={serverGroups} groupsPending={groups.isPending} groupsError={groups.isError} />;
}

function PermissionEditor({ configId, sid, policy, groups, groupsPending, groupsError }: {
  configId: number; sid: number; policy: MediaCommandPermissions;
  groups: Array<{ sgid: number | string; name: string }>; groupsPending: boolean; groupsError: boolean;
}) {
  const { t } = useTranslation('bots');
  const [draft, setDraft] = useState<MediaCommandPermissions | null>(null);
  const save = useSaveMediaCommandPermissions();
  const current = draft ?? policy;
  const update = (group: MediaCommandGroup, access: MediaCommandPermissions[MediaCommandGroup]) =>
    setDraft({ ...current, [group]: access });

  return (
    <Card className="mb-5">
      <CardHeader><CardTitle className="text-base">{t('mediaPermissions.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-3xl text-sm text-muted-foreground">{t('mediaPermissions.intro', { sid })}</p>
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-3" data-testid="media-permission-groups">
        {MEDIA_COMMAND_GROUPS.map((group) => {
          const access = current[group];
          const ids = access.mode === 'server_groups' ? access.serverGroupIds : [];
          const available = groups.map((g) => ({ id: Number(g.sgid), name: g.name })).filter((g) => Number.isSafeInteger(g.id) && g.id > 0);
          for (const id of ids) {
            if (!available.some((g) => g.id === id)) available.push({ id, name: t('mediaPermissions.unavailableGroup', { id }) });
          }
          return (
            <fieldset key={group} disabled={save.isPending} className="min-w-0 space-y-2 rounded-md border p-3">
              <legend className="px-1 text-sm font-medium">{t(descriptionKeys[group])}</legend>
              <label htmlFor={`media-access-${group}`} className="block text-sm">{t('mediaPermissions.whoCanUse')}</label>
              <Select value={access.mode} onValueChange={(mode) => update(group, mode === 'everyone' ? { mode: 'everyone' } : { mode: 'server_groups', serverGroupIds: [] })}>
                <SelectTrigger id={`media-access-${group}`} className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="everyone">{t('mediaPermissions.everyone')}</SelectItem><SelectItem value="server_groups">{t('mediaPermissions.selectedGroups')}</SelectItem></SelectContent>
              </Select>
              {access.mode === 'server_groups' && (
                <div className="space-y-2">
                  {groupsPending && <p className="text-xs text-muted-foreground">{t('mediaPermissions.loadingGroups')}</p>}
                  {groupsError && <p role="alert" className="text-xs text-destructive">{t('mediaPermissions.groupsError')}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {available.map(({ id, name }) => (
                      <label key={id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={ids.includes(id)} onChange={(event) => update(group, {
                          mode: 'server_groups', serverGroupIds: event.target.checked ? [...ids, id] : ids.filter((value) => value !== id),
                        })} />
                        {name} <span className="text-xs text-muted-foreground">#{id}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('mediaPermissions.membershipHint')}</p>
                </div>
              )}
            </fieldset>
          );
        })}
        </div>
        <Button disabled={!draft || save.isPending} onClick={() => save.mutate({ configId, sid, policy: current }, {
          onSuccess: () => { setDraft(null); toast.success(t('mediaPermissions.saved')); },
          onError: () => toast.error(t('mediaPermissions.saveFailed')),
        })}>{save.isPending ? t('common:action.saving') : t('mediaPermissions.save')}</Button>
      </CardContent>
    </Card>
  );
}
