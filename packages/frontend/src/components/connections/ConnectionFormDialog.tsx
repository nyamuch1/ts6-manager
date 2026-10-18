import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFieldHelp, type ConnectionFormState } from '@/content/connection-setup';

interface ConnectionFormDialogProps {
  open: boolean;
  editId: number | null;
  form: ConnectionFormState;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (form: ConnectionFormState) => void;
  onSave: () => void;
}

function FieldLabel({
  label,
  help,
  htmlFor,
  tooltipAlign = 'center',
}: {
  label: string;
  help: string;
  htmlFor: string;
  tooltipAlign?: 'start' | 'center' | 'end';
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1 min-w-0">
      <Label htmlFor={htmlFor} className="text-xs truncate">{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={t('settings:connectionForm.aboutField', { label })} className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <HelpCircle className="h-3 w-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align={tooltipAlign}>
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ConnectionFormDialog({
  open,
  editId,
  form,
  saving,
  onOpenChange,
  onChange,
  onSave,
}: ConnectionFormDialogProps) {
  const { t } = useTranslation();
  const canSave = !!form.name && !!form.host && (!!form.apiKey || !!editId);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fieldHelp = getFieldHelp(t);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md [--dialog-max-height:90vh] overflow-y-auto"
        onOpenAutoFocus={(event) => {
          // The first focusable node is a help icon; opening its tooltip would cover the section copy.
          event.preventDefault();
          nameInputRef.current?.focus();
        }}
      >
        <TooltipProvider delayDuration={200}>
          <DialogHeader>
            <DialogTitle>{editId ? t('settings:connectionForm.editTitle') : t('settings:connectionForm.addTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-medium text-foreground">{t('settings:connectionForm.webquerySection')}</p>
              <p className="text-[11px] text-muted-foreground -mt-2">
                {t('settings:connectionForm.webquerySectionDescription')}
              </p>

              <div>
                <FieldLabel label={t('settings:connectionForm.name')} htmlFor="connection-name" help={fieldHelp.name.help} />
                <Input
                  id="connection-name"
                  ref={nameInputRef}
                  value={form.name}
                  onChange={(e) => onChange({ ...form, name: e.target.value })}
                  placeholder={t('settings:connectionForm.namePlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label={t('settings:connectionForm.host')} htmlFor="connection-host" help={fieldHelp.host.help} />
                  <Input
                    id="connection-host"
                    value={form.host}
                    onChange={(e) => onChange({ ...form, host: e.target.value })}
                    placeholder="127.0.0.1"
                  />
                </div>
                <div>
                  <FieldLabel label={t('settings:connectionForm.webqueryPort')} htmlFor="connection-webquery-port" help={fieldHelp.webqueryPort.help} tooltipAlign="end" />
                  <Input
                    type="number"
                    id="connection-webquery-port"
                    value={form.webqueryPort}
                    onChange={(e) => onChange({ ...form, webqueryPort: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <FieldLabel label={t('settings:connectionForm.apiKey')} htmlFor="connection-api-key" help={fieldHelp.apiKey.help} />
                <Input
                  id="connection-api-key"
                  value={form.apiKey}
                  onChange={(e) => onChange({ ...form, apiKey: e.target.value })}
                  placeholder={editId ? t('settings:connectionForm.apiKeyEditPlaceholder') : t('settings:connectionForm.apiKeyPlaceholder')}
                  type="password"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="connection-use-https"
                  checked={form.useHttps}
                  onCheckedChange={(v) => onChange({ ...form, useHttps: v })}
                />
                <FieldLabel label={t('settings:connectionForm.useHttps')} htmlFor="connection-use-https" help={fieldHelp.useHttps.help} />
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-foreground">{t('settings:connectionForm.sshSection')}</p>
              <p className="text-[11px] text-muted-foreground -mt-2">
                {t('settings:connectionForm.sshSectionDescription')}
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel label={t('settings:connectionForm.sshPort')} htmlFor="connection-ssh-port" help={fieldHelp.sshPort.help} />
                  <Input
                    type="number"
                    id="connection-ssh-port"
                    value={form.sshPort}
                    onChange={(e) => onChange({ ...form, sshPort: e.target.value })}
                  />
                </div>
                <div>
                  <FieldLabel label={t('settings:connectionForm.sshUser')} htmlFor="connection-ssh-user" help={fieldHelp.sshUsername.help} tooltipAlign="center" />
                  <Input
                    id="connection-ssh-user"
                    value={form.sshUsername}
                    onChange={(e) => onChange({ ...form, sshUsername: e.target.value })}
                    placeholder="serveradmin"
                  />
                </div>
                <div>
                  <FieldLabel label={t('settings:connectionForm.sshPassword')} htmlFor="connection-ssh-password" help={fieldHelp.sshPassword.help} tooltipAlign="end" />
                  <Input
                    type="password"
                    id="connection-ssh-password"
                    value={form.sshPassword}
                    onChange={(e) => onChange({ ...form, sshPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-medium text-foreground">{t('settings:connectionForm.metricsSection')}</p>
              <p className="text-[11px] text-muted-foreground -mt-2">
                {t('settings:connectionForm.metricsSectionDescription')}
              </p>

              <div className="flex items-center gap-2">
                <Switch
                  id="connection-metrics-enabled"
                  checked={form.metricsEnabled}
                  onCheckedChange={(v) => onChange({ ...form, metricsEnabled: v })}
                />
                <FieldLabel label={t('settings:connectionForm.metricsEnabled')} htmlFor="connection-metrics-enabled" help={fieldHelp.metricsEnabled.help} />
              </div>

              {form.metricsEnabled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel label={t('settings:connectionForm.metricsPort')} htmlFor="connection-metrics-port" help={fieldHelp.metricsPort.help} />
                    <Input
                      type="number"
                      id="connection-metrics-port"
                      value={form.metricsPort}
                      onChange={(e) => onChange({ ...form, metricsPort: e.target.value })}
                    />
                  </div>
                  <div>
                    <FieldLabel label={t('settings:connectionForm.metricsHost')} htmlFor="connection-metrics-host" help={fieldHelp.metricsHost.help} tooltipAlign="end" />
                    <Input
                      id="connection-metrics-host"
                      value={form.metricsHost}
                      onChange={(e) => onChange({ ...form, metricsHost: e.target.value })}
                      placeholder={t('settings:connectionForm.metricsHostPlaceholder')}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('settings:connectionForm.cancel')}</Button>
            <Button onClick={onSave} disabled={!canSave || saving}>
              {saving ? t('settings:connectionForm.saving') : editId ? t('settings:connectionForm.update') : t('settings:connectionForm.add')}
            </Button>
          </DialogFooter>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
