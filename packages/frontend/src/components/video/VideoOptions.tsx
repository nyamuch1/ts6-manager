import type { VideoStreamSettings } from '@ts6/common';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  ENCODER_OPTIONS, NO_VIEWER_TIMEOUT_OPTIONS, QUALITY_OPTIONS, SOURCE_MODE_OPTIONS,
  autoEncoderPreferenceHint, autoEncoderPreferenceLabel, formatTimeout,
} from '@/lib/video-streaming';
import type { VideoStartOptions } from '@/lib/video-options';

/** Timeout option label; the shared helper's "Use server default" fallback is English. */
function noViewerTimeoutLabel(value: string, t: TFunction<'media'>): string {
  if (value === '') return t('videoOptions.useServerDefault');
  return NO_VIEWER_TIMEOUT_OPTIONS.find((o) => o.value === value)?.label
    ?? formatTimeout(Number(value));
}

/**
 * Quality, encoder, no-viewer stop and source type for one console start,
 * folded behind a "Video options" row that shows the current choices. They
 * inherit the bot and server defaults; nothing is saved.
 */
export function VideoOptions({ value, onChange, defaults }: {
  value: VideoStartOptions;
  onChange(v: VideoStartOptions): void;
  defaults?: VideoStreamSettings;
}) {
  const { t } = useTranslation('media');
  const field = 'h-10 w-full rounded-md border bg-background px-2 text-sm';
  // Local translation of the summary: the shared helper is outside this
  // namespace's ownership and keeps its English literals.
  const quality = QUALITY_OPTIONS.find((o) => o.value === value.quality)?.label
    ?? t('videoOptions.defaultQuality');
  const encoder = ENCODER_OPTIONS.find((o) => o.value === value.encoder)?.label
    ?? t('videoOptions.defaultEncoder');
  const summaryParts = [quality, value.encoder === 'auto' ? t('videoOptions.autoEncoder') : encoder];
  if (value.noViewerTimeout !== '') {
    summaryParts.push(value.noViewerTimeout === '0'
      ? t('videoOptions.noAutoStop')
      : t('videoOptions.stopsAfter', { time: noViewerTimeoutLabel(value.noViewerTimeout, t) }));
  } else {
    summaryParts.push(t('videoOptions.defaultAutoStop'));
  }
  summaryParts.push(SOURCE_MODE_OPTIONS.find((o) => o.value === value.sourceMode)?.label ?? value.sourceMode);
  const summary = summaryParts.join(' · ');
  // Preserve any explicit custom timeout alongside the default choice.
  const timeoutOptions = value.noViewerTimeout === '' || NO_VIEWER_TIMEOUT_OPTIONS.some((o) => o.value === value.noViewerTimeout)
    ? NO_VIEWER_TIMEOUT_OPTIONS
    : [{ value: value.noViewerTimeout, label: noViewerTimeoutLabel(value.noViewerTimeout, t) }, ...NO_VIEWER_TIMEOUT_OPTIONS];
  const serverEncoderLabel = !defaults
    ? null
    : defaults.defaultEncoder === 'auto'
      ? autoEncoderPreferenceLabel(defaults.preferHardware)
      : (ENCODER_OPTIONS.find((o) => o.value === defaults.defaultEncoder)?.label ?? defaults.defaultEncoder);
  return (
    <details className="group rounded-md border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 font-medium">{t('videoOptions.title')}</span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{summary}</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <div className="space-y-3 border-t p-3">
        <p className="text-xs text-muted-foreground">{t('videoOptions.forThisStart')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="vo-quality">{t('videoOptions.quality')}</Label>
            <select id="vo-quality" className={field} value={value.quality}
              onChange={(e) => onChange({ ...value, quality: e.target.value as VideoStartOptions['quality'] })}>
              <option value="">{t('videoOptions.useBotDefault')}</option>
              {QUALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="vo-encoder">{t('videoOptions.encoder')}</Label>
            <select id="vo-encoder" className={field} value={value.encoder}
              onChange={(e) => onChange({ ...value, encoder: e.target.value as VideoStartOptions['encoder'] })}>
              <option value="">
                {serverEncoderLabel
                  ? t('videoOptions.useServerDefaultWith', { label: serverEncoderLabel })
                  : t('videoOptions.useServerDefault')}
              </option>
              {ENCODER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value === 'auto' && defaults
                    ? autoEncoderPreferenceLabel(defaults.preferHardware)
                    : o.label}
                </option>
              ))}
            </select>
            {defaults && (
              <p className="text-xs text-muted-foreground">{autoEncoderPreferenceHint(defaults.preferHardware)}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="vo-noviewer">{t('videoOptions.stopNoViewers')}</Label>
            <select id="vo-noviewer" className={field} value={value.noViewerTimeout}
              onChange={(e) => onChange({ ...value, noViewerTimeout: e.target.value })}>
              <option value="">
                {defaults
                  ? t('videoOptions.useServerDefaultWith', {
                    label: noViewerTimeoutLabel(String(defaults.noViewerTimeoutSec), t),
                  })
                  : t('videoOptions.useServerDefault')}
              </option>
              {timeoutOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="vo-source">{t('videoOptions.sourceType')}</Label>
            <select id="vo-source" className={field} value={value.sourceMode}
              onChange={(e) => onChange({ ...value, sourceMode: e.target.value as VideoStartOptions['sourceMode'] })}>
              {SOURCE_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </details>
  );
}
