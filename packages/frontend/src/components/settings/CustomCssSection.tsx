import { useEffect, useId, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { FileUp, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  CUSTOM_CSS_MAX_BYTES,
  SAFE_UI_RECOVERY_PATH,
  isCustomCssWithinLimit,
  utf8ByteLength,
} from '@/lib/custom-css';
import { isSafeUiActive } from '@/lib/safe-ui';
import { useUiStore } from '@/stores/ui.store';
import { toast } from 'sonner';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KiB`;
}

export function CustomCssSection({ forceAdvancedOpen = false }: { forceAdvancedOpen?: boolean }) {
  const { t } = useTranslation();
  const customCssText = useUiStore((s) => s.customCssText);
  const customCssEnabled = useUiStore((s) => s.customCssEnabled);
  const setCustomCssText = useUiStore((s) => s.setCustomCssText);
  const setCustomCssEnabled = useUiStore((s) => s.setCustomCssEnabled);
  const resetCustomCss = useUiStore((s) => s.resetCustomCss);

  const [draft, setDraft] = useState(customCssText);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [accordionValue, setAccordionValue] = useState<string | undefined>(
    forceAdvancedOpen || customCssEnabled ? 'custom-css' : undefined,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const enableId = useId();
  const safeUi = isSafeUiActive();

  useEffect(() => {
    setDraft(customCssText);
    setDraftError(null);
  }, [customCssText]);

  useEffect(() => {
    if (forceAdvancedOpen || safeUi) {
      setAccordionValue('custom-css');
    }
  }, [forceAdvancedOpen, safeUi]);

  const draftDirty = draft !== customCssText;
  const draftBytes = utf8ByteLength(draft);
  const limitLabel = formatBytes(CUSTOM_CSS_MAX_BYTES);

  const handleDraftChange = (value: string) => {
    setDraft(value);
    if (!isCustomCssWithinLimit(value)) {
      setDraftError(t('settings:customCss.sizeError', {
        limit: limitLabel,
        size: formatBytes(utf8ByteLength(value)),
      }));
    } else {
      setDraftError(null);
    }
  };

  const handleSave = () => {
    if (!isCustomCssWithinLimit(draft)) {
      setDraftError(t('settings:customCss.sizeError', {
        limit: limitLabel,
        size: formatBytes(utf8ByteLength(draft)),
      }));
      toast.error(t('settings:customCss.exceedsLimit', { limit: limitLabel }));
      return;
    }
    const result = setCustomCssText(draft);
    if (!result.ok) {
      setDraftError(t('settings:customCss.sizeErrorShort', { limit: limitLabel }));
      toast.error(t('settings:customCss.exceedsLimit', { limit: limitLabel }));
      return;
    }
    setDraftError(null);
    toast.success(customCssEnabled ? t('settings:customCss.savedAndApplied') : t('settings:customCss.saved'));
  };

  const handleEnableChange = (next: boolean) => {
    if (next && safeUi) {
      toast.error(t('settings:customCss.safeUiEnableBlocked'));
      return;
    }
    if (next && customCssText.length === 0) {
      toast.error(t('settings:customCss.saveBeforeEnable'));
      return;
    }
    setCustomCssEnabled(next);
    toast.success(next ? t('settings:customCss.enabled') : t('settings:customCss.disabled'));
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.css') && file.type !== 'text/css') {
      toast.error(t('settings:customCss.chooseCssFile'));
      return;
    }
    try {
      const text = await file.text();
      if (!isCustomCssWithinLimit(text)) {
        setDraftError(t('settings:customCss.importedTooLarge', {
          size: formatBytes(utf8ByteLength(text)),
          limit: limitLabel,
        }));
        toast.error(t('settings:customCss.importedExceeds', { limit: limitLabel }));
        return;
      }
      handleDraftChange(text);
      toast.success(t('settings:customCss.importedDraft'));
    } catch {
      toast.error(t('settings:customCss.readFailed'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetConfirm = () => {
    resetCustomCss();
    setDraft('');
    setDraftError(null);
    setResetOpen(false);
    toast.success(t('settings:customCss.cleared'));
  };

  return (
    <>
      <Accordion
        type="single"
        collapsible
        value={accordionValue}
        onValueChange={(v) => setAccordionValue(v || undefined)}
        className="w-full rounded-md border border-border px-3"
      >
        <AccordionItem value="custom-css" className="border-0">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            {t('settings:customCss.advancedTitle')}
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {safeUi && (
              <div
                role="status"
                className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium">{t('settings:customCss.safeUiTitle')}</p>
                  <p className="text-warning/90">
                    <Trans
                      i18nKey="settings:customCss.safeUiDescription"
                      components={{ code: <span className="font-mono-data" /> }}
                    />
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                {t('settings:customCss.description1')}
              </p>
              <p>
                <Trans
                  i18nKey="settings:customCss.description2"
                  components={{ code: <span className="font-mono-data" /> }}
                />
              </p>
              <p>
                <Trans
                  i18nKey="settings:customCss.recoveryHint"
                  values={{ path: SAFE_UI_RECOVERY_PATH }}
                  components={{ code: <span className="break-all font-mono-data text-foreground" /> }}
                />
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id={enableId}
                  checked={customCssEnabled}
                  disabled={!customCssEnabled && (safeUi || customCssText.length === 0)}
                  onCheckedChange={handleEnableChange}
                  aria-label={t('settings:customCss.enableAria')}
                />
                <Label htmlFor={enableId} className="text-sm font-medium">
                  {t('settings:customCss.enable')}
                </Label>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {t(draftDirty ? 'settings:customCss.sizeDirty' : 'settings:customCss.size', {
                  size: formatBytes(draftBytes),
                  limit: limitLabel,
                })}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-css-editor" className="text-xs">
                {t('settings:customCss.editorLabel')}
              </Label>
              <Textarea
                id="custom-css-editor"
                aria-label={t('settings:customCss.editorAria')}
                spellCheck={false}
                className="min-h-[10rem] font-mono text-xs leading-relaxed"
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                placeholder={':root {\n  /* your overrides */\n}'}
              />
              {draftError && (
                <p role="alert" className="text-xs text-destructive">{draftError}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {t('settings:customCss.editorHint')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={handleSave} disabled={!draftDirty && !draftError}>
                {t('settings:customCss.saveCss')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".css,text/css"
                className="hidden"
                aria-hidden="true"
                onChange={(e) => void handleImport(e.target.files?.[0])}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                {t('settings:customCss.importCss')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!customCssEnabled}
                onClick={() => handleEnableChange(false)}
              >
                {t('settings:customCss.disable')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={customCssText.length === 0 && !customCssEnabled && draft.length === 0}
                onClick={() => setResetOpen(true)}
              >
                {t('settings:customCss.reset')}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t('settings:customCss.resetTitle')}
        description={t('settings:customCss.resetDescription')}
        confirmLabel={t('settings:customCss.resetConfirm')}
        onConfirm={handleResetConfirm}
        destructive
      />
    </>
  );
}
