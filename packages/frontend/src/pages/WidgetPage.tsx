import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import type { WidgetData } from '@ts6/common';
import { WidgetRenderer } from '@/components/widget/WidgetRenderer';
import { LanguageMenu } from '@/components/shared/LanguageMenu';
import i18n, { currentLocale } from '@/i18n';
import { isSupportedLocale } from '@/i18n/languages';

/** Compact language switcher; the global menu persists a visitor's explicit choice. */
function WidgetLanguageMenu() {
  return (
    <div style={{ position: 'fixed', right: '8px', bottom: '8px', zIndex: 10 }}>
      <LanguageMenu className="bg-background/80 backdrop-blur-sm" />
    </div>
  );
}

export default function WidgetPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const requestedLang = searchParams.get('lang');
  const { t } = useTranslation('public');

  // `?lang=` applies to this page only and must not overwrite the saved preference.
  useEffect(() => {
    if (!isSupportedLocale(requestedLang)) return;
    if (i18n.resolvedLanguage !== requestedLang) void i18n.changeLanguage(requestedLang);
    document.documentElement.lang = requestedLang;
  }, [requestedLang]);

  useEffect(() => {
    document.title = t('widget.pageTitle');
  }, [t]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  const { data, isLoading, error } = useQuery<WidgetData>({
    queryKey: ['widget', token],
    queryFn: () => axios.get(`/api/widget/${token}/data`, {
      headers: { 'Accept-Language': currentLocale() },
    }).then((r) => r.data),
    enabled: !!token,
    refetchInterval: 30_000,
    retry: 3,
  });

  if (isLoading) {
    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0f1117', color: '#8b949e',
          fontFamily: "'Segoe UI', sans-serif", fontSize: '13px',
        }}>
          {t('widget.loading')}
        </div>
        <WidgetLanguageMenu />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0f1117', color: '#8b949e',
          fontFamily: "'Segoe UI', sans-serif", fontSize: '13px',
        }}>
          {t('widget.unavailable')}
        </div>
        <WidgetLanguageMenu />
      </>
    );
  }

  return (
    <>
      <WidgetRenderer data={data} />
      <WidgetLanguageMenu />
    </>
  );
}
