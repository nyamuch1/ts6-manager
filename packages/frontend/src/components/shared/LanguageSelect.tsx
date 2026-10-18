import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUiStore } from '@/stores/ui.store';
import {
  LANGUAGE_NATIVE_NAMES,
  SUPPORTED_LOCALES,
  isLanguagePreference,
} from '@/i18n/languages';

/** Full language selector used in Settings → Appearance. */
export function LanguageSelect({ id }: { id?: string }) {
  const { t } = useTranslation();
  const language = useUiStore((state) => state.language);
  const setLanguage = useUiStore((state) => state.setLanguage);

  return (
    <Select
      value={language}
      onValueChange={(value) => {
        if (isLanguagePreference(value)) setLanguage(value);
      }}
    >
      <SelectTrigger id={id} aria-label={t('common:language.label')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system">{t('common:language.system')}</SelectItem>
        {SUPPORTED_LOCALES.map((locale) => (
          <SelectItem key={locale} value={locale}>
            {LANGUAGE_NATIVE_NAMES[locale]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
