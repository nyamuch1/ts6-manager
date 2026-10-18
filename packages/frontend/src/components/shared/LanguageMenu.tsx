import { useTranslation } from 'react-i18next';
import { Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUiStore } from '@/stores/ui.store';
import {
  LANGUAGE_NATIVE_NAMES,
  SUPPORTED_LOCALES,
  resolveLanguage,
  type LanguagePreference,
} from '@/i18n/languages';
import { cn } from '@/lib/utils';

/** Compact language switcher for surfaces without the full Settings UI. */
export function LanguageMenu({ className }: { className?: string }) {
  const { t } = useTranslation();
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);
  const resolved = resolveLanguage(language);

  const item = (value: LanguagePreference, label: string) => (
    <DropdownMenuItem
      key={value}
      onSelect={() => setLanguage(value)}
      className="gap-2"
    >
      <Check className={cn('h-4 w-4', language === value ? 'opacity-100' : 'opacity-0')} />
      {label}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('gap-1.5', className)}
          aria-label={t('common:language.label')}
          title={t('common:language.label')}
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs">{LANGUAGE_NATIVE_NAMES[resolved]}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common:language.label')}</DropdownMenuLabel>
        {item('system', t('common:language.system'))}
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((locale) => item(locale, LANGUAGE_NATIVE_NAMES[locale]))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
