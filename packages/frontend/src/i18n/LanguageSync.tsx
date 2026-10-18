import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/stores/ui.store';
import { changeAppLanguage } from './index';

/**
 * Keeps i18next and <html lang> in sync with the persisted UI preference.
 * Mounted once near the app root.
 */
export function LanguageSync() {
  const language = useUiStore((state) => state.language);
  const queryClient = useQueryClient();
  const mounted = useRef(false);

  useEffect(() => {
    changeAppLanguage(language);
    // Server-authored text in successful responses (diagnostics, statuses)
    // is localized from Accept-Language, so cached data must refetch after a
    // language change. The initial mount is already fetching in the right one.
    if (mounted.current) {
      void queryClient.invalidateQueries();
    } else {
      mounted.current = true;
    }
  }, [language, queryClient]);

  return null;
}
