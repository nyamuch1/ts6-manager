import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { SetupDocLinks } from '@/components/connections/SetupDocLinks';
import {
  CHECKLIST_STORAGE_KEY,
  getChecklistItems,
  getDeploymentScenarios,
  getFeatureMatrix,
  getFieldHelp,
  getTsPrepSteps,
  type ChecklistItemId,
} from '@/content/connection-setup';
import { TS6_SERVER_DOCS } from '@/content/teamspeak-docs';
import { Check, Circle, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ChecklistState = Partial<Record<ChecklistItemId, boolean>>;

function loadChecklist(): ChecklistState {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveChecklist(state: ChecklistState) {
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(state));
}

const QUICK_NETWORK_TIPS: ReadonlyArray<{
  labelKey: string;
  host: string;
  noteKey?: string;
}> = [
  { labelKey: 'settings:connectionHelp.quickTips.thisMachine', host: '127.0.0.1' },
  {
    labelKey: 'settings:connectionHelp.quickTips.bothDocker',
    host: 'teamspeak',
    noteKey: 'settings:connectionHelp.quickTips.bothDockerNote',
  },
  { labelKey: 'settings:connectionHelp.quickTips.windowsWsl', host: 'host.docker.internal' },
];

interface ConnectionSetupHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasConnections: boolean;
  hasSshOnAnyConnection: boolean;
  webqueryTestPassed?: boolean;
  onStartWizard?: () => void;
}

export function ConnectionSetupHelpDialog({
  open,
  onOpenChange,
  hasConnections,
  hasSshOnAnyConnection,
  webqueryTestPassed,
  onStartWizard,
}: ConnectionSetupHelpDialogProps) {
  const { t } = useTranslation();
  const [checklist, setChecklist] = useState<ChecklistState>(loadChecklist);
  const checklistItems = getChecklistItems(t);
  const deploymentScenarios = getDeploymentScenarios(t);
  const featureMatrix = getFeatureMatrix(t);
  const fieldHelp = getFieldHelp(t);
  const prepSteps = getTsPrepSteps(t);

  const autoChecklist = useMemo<ChecklistState>(() => ({
    'connection-added': hasConnections,
    'webquery-tested': !!webqueryTestPassed,
    'ssh-configured': hasSshOnAnyConnection,
  }), [hasConnections, hasSshOnAnyConnection, webqueryTestPassed]);

  const mergedChecklist = useMemo(
    () => ({ ...checklist, ...autoChecklist }),
    [checklist, autoChecklist],
  );

  const toggleManual = (id: ChecklistItemId) => {
    const item = checklistItems.find((i) => i.id === id);
    if (!item?.manual) return;
    setChecklist((prev) => {
      const next = { ...prev, [id]: !mergedChecklist[id] };
      saveChecklist(next);
      return next;
    });
  };

  const completedCount = checklistItems.filter((item) => mergedChecklist[item.id]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg [--dialog-max-height:85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">{t('settings:connectionHelp.title')}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t('settings:connectionHelp.subtitle')}
          </p>
          <SetupDocLinks
            docs={[{ label: t('content:docLinks.ts6ServerDocs'), url: TS6_SERVER_DOCS.home }]}
            className="flex flex-wrap gap-x-3 gap-y-1"
          />
        </DialogHeader>

        <div className="space-y-4">
          {onStartWizard && (
            <Button size="sm" className="h-7 text-xs" onClick={() => { onOpenChange(false); onStartWizard(); }}>
              <Wand2 className="h-3.5 w-3.5 mr-1" /> {t('settings:connectionHelp.startWizard')}
            </Button>
          )}

          <details className="rounded-md border border-border p-3">
            <summary className="text-xs font-medium cursor-pointer list-none flex items-center justify-between">
              {t('settings:connectionHelp.checklist')}
              <span className="text-muted-foreground font-normal">{completedCount}/{checklistItems.length}</span>
            </summary>
            <ul className="space-y-1.5 mt-3">
              {checklistItems.map((item) => {
                const done = !!mergedChecklist[item.id];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex items-center gap-2 text-xs w-full text-left',
                        item.manual ? 'hover:text-foreground cursor-pointer' : 'cursor-default',
                      )}
                      onClick={() => toggleManual(item.id)}
                      disabled={!item.manual}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className={done ? 'text-muted-foreground line-through' : ''}>{item.label}</span>
                      {item.id === 'ssh-configured' && (
                        <Badge variant="secondary" className="text-[10px] ml-1">{t('settings:connectionHelp.optional')}</Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="what-you-need">
              <AccordionTrigger className="text-xs py-2">{t('settings:connectionHelp.whatYouNeed')}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    <Trans
                      i18nKey="settings:connectionHelp.whatYouNeedWebquery"
                      components={{ strong: <span className="font-medium text-foreground" /> }}
                    />
                  </p>
                  <p>
                    <Trans
                      i18nKey="settings:connectionHelp.whatYouNeedSsh"
                      components={{ strong: <span className="font-medium text-foreground" /> }}
                    />
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="prepare-ts">
              <AccordionTrigger className="text-xs py-2">{t('settings:connectionHelp.prepareTs')}</AccordionTrigger>
              <AccordionContent>
                <ol className="space-y-3 text-xs text-muted-foreground list-decimal list-inside">
                  {prepSteps.map((step) => (
                    <li key={step.id} className="space-y-1">
                      <span className="font-medium text-foreground">{step.title}</span>
                      <p>{step.body}</p>
                      {'code' in step && step.code && (
                        <pre className="rounded bg-muted px-2 py-1.5 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">{step.code}</pre>
                      )}
                      {'docs' in step && step.docs && (
                        <SetupDocLinks docs={step.docs} className="flex flex-wrap gap-x-3 gap-y-1 pt-1" />
                      )}
                    </li>
                  ))}
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="network">
              <AccordionTrigger className="text-xs py-2">{t('settings:connectionHelp.networkHints')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-xs mb-3">
                  {QUICK_NETWORK_TIPS.map((tip) => (
                    <li key={tip.labelKey} className="flex flex-wrap gap-x-2 gap-y-0.5">
                      <span className="text-muted-foreground shrink-0">{t(tip.labelKey)}:</span>
                      <code className="font-mono-data">{tip.host}</code>
                      {tip.noteKey && <span className="text-muted-foreground">({t(tip.noteKey)})</span>}
                    </li>
                  ))}
                </ul>
                <details>
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    {t('settings:connectionHelp.allScenarios')}
                  </summary>
                  <div className="grid gap-2 mt-2">
                    {deploymentScenarios.map((scenario) => (
                      <div key={scenario.id} className="rounded-md border border-border p-2 space-y-1">
                        <p className="text-xs font-medium">{scenario.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t('settings:connectionHelp.hostLabel')} <code className="font-mono-data">{scenario.hostPlaceholder}</code>
                        </p>
                        {scenario.docs && (
                          <SetupDocLinks docs={scenario.docs} className="flex flex-wrap gap-x-3 gap-y-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="form-fields">
              <AccordionTrigger className="text-xs py-2">{t('settings:connectionHelp.formFieldReference')}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {Object.values(fieldHelp).map((field) => (
                    <li key={field.id}>
                      <span className="font-medium text-foreground capitalize">{field.label}: </span>
                      {field.help}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="features">
              <AccordionTrigger className="text-xs py-2">{t('settings:connectionHelp.featureMatrix')}</AccordionTrigger>
              <AccordionContent>
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-2 py-1.5 text-left font-medium">{t('settings:connectionHelp.feature')}</th>
                        <th className="px-2 py-1.5 text-left font-medium">{t('settings:connectionHelp.transport')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {featureMatrix.map((row) => (
                        <tr key={row.feature} className="border-b border-border last:border-0">
                          <td className="px-2 py-1.5">{row.feature}</td>
                          <td className="px-2 py-1.5">
                            <Badge variant="outline" className="text-[10px]">{row.transport}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </DialogContent>
    </Dialog>
  );
}
