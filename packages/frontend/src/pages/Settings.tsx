import { useState, useMemo, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/bots.api';
import { authApi } from '@/api/auth.api';
import { serversApi } from '@/api/servers.api';
import { settingsApi } from '@/api/settings.api';
import { useAuthStore } from '@/stores/auth.store';
import {
  ACCENTS, BASE_THEMES, BACKGROUNDS, BACKGROUND_MOTIONS, BACKGROUND_INTENSITIES, useUiStore,
  type Accent, type BaseTheme, type Background, type BackgroundMotion, type BackgroundIntensity,
} from '@/stores/ui.store';
import { useResolvedBackgroundMotion } from '@/hooks/use-resolved-background-motion';
import { CustomCssSection } from '@/components/settings/CustomCssSection';
import { isSafeUiActive } from '@/lib/safe-ui';
import { SAFE_UI_RECOVERY_PATH } from '@/lib/custom-css';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConnectionSetupGuide } from '@/components/connections/ConnectionSetupGuide';
import { ConnectionSetupHelpDialog } from '@/components/connections/ConnectionSetupHelpDialog';
import { ConnectionSetupWizard } from '@/components/connections/ConnectionSetupWizard';
import { ConnectionFormDialog } from '@/components/connections/ConnectionFormDialog';
import {
  ConnectionDiagnosticStages,
  diagnosticToastMessage,
} from '@/components/connections/ConnectionDiagnosticStages';
import { RuntimeMediaDiagnostics } from '@/components/media/RuntimeMediaDiagnostics';
import { DEFAULT_CONNECTION_FORM, type ConnectionFormState } from '@/content/connection-setup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { BrandMark } from '@/components/shared/BrandMark';
import { LanguageSelect } from '@/components/shared/LanguageSelect';
import { LANGUAGE_NATIVE_NAMES, resolveLanguage } from '@/i18n/languages';
import { Settings as SettingsIcon, Users, Server, Plus, Trash2, Pencil, TestTube, Check, X, Lock, KeyRound, Youtube, Upload, FileText, Wand2, Info, Github, Palette, Loader2, ShieldAlert } from 'lucide-react';
import { APP_REPOSITORY_URL, APP_VERSION, APP_VERSION_LABEL } from '@/lib/app-version';
import { apiErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';
import type { ConnectionDiagnosticReport } from '@ts6/common';

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const availableTabs = isAdmin
    ? ['connections', 'account', 'appearance', 'users', 'youtube', 'about']
    : ['account', 'appearance', 'about'];
  const activeTab = tabParam && availableTabs.includes(tabParam) ? tabParam : 'account';

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (tab !== 'connections') next.delete('wizard');
    setSearchParams(next);
  };

  return (
    <div className="min-w-0 space-y-5">
      <h1 className="text-xl font-semibold">{t('settings:page.title')}</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="min-w-0 max-w-full">
        <TabsList className="w-full sm:w-auto">
          {isAdmin && <TabsTrigger value="connections"><Server className="h-3.5 w-3.5 mr-1" /> {t('settings:tabs.connections')}</TabsTrigger>}
          <TabsTrigger value="account"><Lock className="h-3.5 w-3.5 mr-1" /> {t('settings:tabs.account')}</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="h-3.5 w-3.5 mr-1" /> {t('settings:tabs.appearance')}</TabsTrigger>
          {isAdmin && <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1" /> {t('settings:tabs.users')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="youtube"><Youtube className="h-3.5 w-3.5 mr-1" /> {t('settings:tabs.youtube')}</TabsTrigger>}
          <TabsTrigger value="about"><Info className="h-3.5 w-3.5 mr-1" /> {t('settings:tabs.about')}</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="connections" className="mt-4">
            <ConnectionsTab />
          </TabsContent>
        )}

        <TabsContent value="account" className="mt-4">
          <AccountTab />
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <AppearanceTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="youtube" className="mt-4">
            <YouTubeTab />
          </TabsContent>
        )}

        <TabsContent value="about" className="mt-4">
          <AboutTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const BASE_THEME_LABELS: Record<BaseTheme, { labelKey: string; descriptionKey: string }> = {
  light: {
    labelKey: 'settings:appearance.themes.light.label',
    descriptionKey: 'settings:appearance.themes.light.description',
  },
  dark: {
    labelKey: 'settings:appearance.themes.dark.label',
    descriptionKey: 'settings:appearance.themes.dark.description',
  },
  black: {
    labelKey: 'settings:appearance.themes.black.label',
    descriptionKey: 'settings:appearance.themes.black.description',
  },
};

const ACCENT_LABELS: Record<Accent, string> = {
  cyan: 'settings:appearance.accents.cyan',
  violet: 'settings:appearance.accents.violet',
  red: 'settings:appearance.accents.red',
  blue: 'settings:appearance.accents.blue',
  emerald: 'settings:appearance.accents.emerald',
  amber: 'settings:appearance.accents.amber',
};

const ACCENT_SWATCHES: Record<Accent, string> = {
  cyan: 'hsl(186 72% 45%)',
  violet: 'hsl(267 80% 62%)',
  red: 'hsl(350 78% 56%)',
  blue: 'hsl(217 85% 58%)',
  emerald: 'hsl(160 68% 42%)',
  amber: 'hsl(35 92% 50%)',
};

const BACKGROUND_LABELS: Record<Background, { labelKey: string; descriptionKey: string }> = {
  none: {
    labelKey: 'settings:appearance.backgrounds.none.label',
    descriptionKey: 'settings:appearance.backgrounds.none.description',
  },
  grid: {
    labelKey: 'settings:appearance.backgrounds.grid.label',
    descriptionKey: 'settings:appearance.backgrounds.grid.description',
  },
  dots: {
    labelKey: 'settings:appearance.backgrounds.dots.label',
    descriptionKey: 'settings:appearance.backgrounds.dots.description',
  },
  glow: {
    labelKey: 'settings:appearance.backgrounds.glow.label',
    descriptionKey: 'settings:appearance.backgrounds.glow.description',
  },
  aurora: {
    labelKey: 'settings:appearance.backgrounds.aurora.label',
    descriptionKey: 'settings:appearance.backgrounds.aurora.description',
  },
  noise: {
    labelKey: 'settings:appearance.backgrounds.noise.label',
    descriptionKey: 'settings:appearance.backgrounds.noise.description',
  },
};

const MOTION_LABELS: Record<BackgroundMotion, { labelKey: string; descriptionKey: string }> = {
  system: {
    labelKey: 'settings:appearance.motions.system.label',
    descriptionKey: 'settings:appearance.motions.system.description',
  },
  off: {
    labelKey: 'settings:appearance.motions.off.label',
    descriptionKey: 'settings:appearance.motions.off.description',
  },
  on: {
    labelKey: 'settings:appearance.motions.on.label',
    descriptionKey: 'settings:appearance.motions.on.description',
  },
};

const INTENSITY_LABELS: Record<BackgroundIntensity, string> = {
  subtle: 'settings:appearance.intensities.subtle',
  normal: 'settings:appearance.intensities.normal',
  strong: 'settings:appearance.intensities.strong',
};

function AppearanceTab() {
  const { t } = useTranslation();
  const {
    baseTheme, accent, setBaseTheme, setAccent,
    background, setBackground, backgroundMotion, setBackgroundMotion, backgroundIntensity, setBackgroundIntensity,
    language,
  } = useUiStore();
  const resolvedLanguage = resolveLanguage(language);
  const resolvedMotion = useResolvedBackgroundMotion(backgroundMotion);
  const safeUi = isSafeUiActive();
  const [searchParams] = useSearchParams();
  const landedViaSafeUi = searchParams.get('safe-ui') === '1' || safeUi;
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((state) => state.isAdmin());
  const botLanguageQuery = useQuery({
    queryKey: ['bot-chat-language'],
    queryFn: settingsApi.getBotChatLanguage,
    enabled: isAdmin,
  });
  const updateBotLanguage = useMutation({
    mutationFn: settingsApi.updateBotChatLanguage,
    onSuccess: () => {
      toast.success(t('settings:language.botSaved'));
      void queryClient.invalidateQueries({ queryKey: ['bot-chat-language'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('settings:language.botSaveFailed'))),
  });

  return (
    <div className="min-w-0 space-y-4">
      {safeUi && (
        <div
          role="status"
          className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-3 text-sm text-warning"
          data-testid="safe-ui-banner"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">{t('settings:appearance.safeModeTitle')}</p>
            <p className="text-xs text-warning/90">
              <Trans
                i18nKey="settings:appearance.safeModeDescription"
                values={{ path: SAFE_UI_RECOVERY_PATH }}
                components={{
                  code: <span className="font-mono-data" />,
                  recovery: <span className="break-all font-mono-data" />,
                }}
              />
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base font-medium">
            <BrandMark className="h-8 w-8 text-primary" />
            {t('settings:appearance.title')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t('settings:appearance.description')}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset className="space-y-2" data-testid="appearance-language">
            <legend className="text-sm font-medium">{t('settings:language.title')}</legend>
            <p className="text-xs text-muted-foreground">{t('settings:language.description')}</p>
            <div className="max-w-xs">
              <LanguageSelect id="appearance-language" />
            </div>
            {language === 'system' && (
              <p className="text-xs text-muted-foreground" data-testid="language-resolved">
                {t('common:language.systemHint', { language: LANGUAGE_NATIVE_NAMES[resolvedLanguage] })}
              </p>
            )}
          </fieldset>

          {isAdmin && (
            <fieldset className="space-y-2" data-testid="appearance-bot-language">
              <legend className="text-sm font-medium">{t('settings:language.botTitle')}</legend>
              <p className="text-xs text-muted-foreground">{t('settings:language.botDescription')}</p>
              <div className="max-w-xs">
                <Select
                  value={botLanguageQuery.data?.language ?? 'en'}
                  onValueChange={(value) => updateBotLanguage.mutate(value as 'en' | 'zh-CN')}
                  disabled={botLanguageQuery.isLoading || updateBotLanguage.isPending}
                >
                  <SelectTrigger aria-label={t('settings:language.botTitle')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{LANGUAGE_NATIVE_NAMES.en}</SelectItem>
                    <SelectItem value="zh-CN">{LANGUAGE_NATIVE_NAMES['zh-CN']}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">{t('settings:language.botHint')}</p>
            </fieldset>
          )}

          <div className="grid min-w-0 gap-6 xl:grid-cols-2 xl:gap-x-10" data-testid="appearance-columns">
          <div className="min-w-0 space-y-6" data-testid="appearance-column-theme">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('settings:appearance.baseTheme')}</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BASE_THEMES.map(value => {
                const selected = value === baseTheme;
                const option = BASE_THEME_LABELS[value];
                const optionLabel = t(option.labelKey);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={t('settings:appearance.baseThemeOption', { label: optionLabel })}
                    aria-pressed={selected}
                    onClick={() => setBaseTheme(value)}
                    className={`min-w-0 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'}`}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      {optionLabel}
                      {selected && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{t(option.descriptionKey)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('settings:appearance.accent')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACCENTS.map(value => {
                const selected = value === accent;
                const label = t(ACCENT_LABELS[value]);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={t('settings:appearance.accentOption', { label })}
                    aria-pressed={selected}
                    onClick={() => setAccent(value)}
                    className={`flex min-w-0 items-center gap-2 rounded-md border p-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'}`}
                  >
                    <span className="h-4 w-4 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: ACCENT_SWATCHES[value] }} aria-hidden="true" />
                    <span className="truncate">{label}</span>
                    {selected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </fieldset>


          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('settings:appearance.motion')}</legend>
            <p className="text-xs text-muted-foreground">
              {t('settings:appearance.motionDescription')}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BACKGROUND_MOTIONS.map(value => {
                const selected = value === backgroundMotion;
                const option = MOTION_LABELS[value];
                const optionLabel = t(option.labelKey);
                const showResolvedHint = value === 'system';
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={t('settings:appearance.motionOption', { label: optionLabel })}
                    aria-pressed={selected}
                    onClick={() => setBackgroundMotion(value)}
                    className={`min-w-0 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'}`}
                  >
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      {optionLabel}
                      {selected && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t(option.descriptionKey)}
                      {showResolvedHint
                        ? t('settings:appearance.motionCurrently', {
                          motion: t(`settings:appearance.resolvedMotion.${resolvedMotion}`),
                        })
                        : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          </div>

          <div className="min-w-0 space-y-6" data-testid="appearance-column-background">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('settings:appearance.background')}</legend>
            <p className="text-xs text-muted-foreground">
              {t('settings:appearance.backgroundDescription')}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BACKGROUNDS.map(value => {
                const selected = value === background;
                const option = BACKGROUND_LABELS[value];
                const optionLabel = t(option.labelKey);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={t('settings:appearance.backgroundOption', { label: optionLabel })}
                    aria-pressed={selected}
                    onClick={() => setBackground(value)}
                    className={`min-w-0 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'}`}
                  >
                    <span
                      aria-hidden="true"
                      className="app-background-surface mb-2 block h-8 w-full rounded border border-border/60"
                      data-background={value}
                      data-intensity="normal"
                      data-motion-resolved="off"
                    />
                    <span className="flex items-center justify-between gap-2 text-sm font-medium">
                      {optionLabel}
                      {selected && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{t(option.descriptionKey)}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {background !== 'none' && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('settings:appearance.backgroundIntensity')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {BACKGROUND_INTENSITIES.map(value => {
                  const selected = value === backgroundIntensity;
                  const label = t(INTENSITY_LABELS[value]);
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={t('settings:appearance.intensityOption', { label })}
                      aria-pressed={selected}
                      onClick={() => setBackgroundIntensity(value)}
                      className={`min-w-0 rounded-md border p-2 text-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent'}`}
                    >
                      <span className="flex items-center justify-center gap-1.5">
                        {label}
                        {selected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t('settings:appearance.semanticColours')}</p>
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <span className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">{t('settings:appearance.semanticDestructive')}</span>
              <span className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-success">{t('settings:appearance.semanticSuccess')}</span>
              <span className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-warning">{t('settings:appearance.semanticWarning')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <CustomCssSection forceAdvancedOpen={landedViaSafeUi} />
    </div>
  );
}

function AboutTab() {
  const { t } = useTranslation();
  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-base font-medium">
          <BrandMark className="h-8 w-8 text-primary" />
          TS6 Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground">{t('settings:about.version')}</span>
          <Badge variant="secondary" className="font-mono-data">{APP_VERSION}</Badge>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{t('settings:about.source')}</span>
          <a
            href={APP_REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            <Github className="h-4 w-4" />
            {t('settings:about.githubRepository')}
          </a>
        </div>
        <p className="text-xs text-muted-foreground font-mono-data">{APP_VERSION_LABEL}</p>
      </CardContent>
    </Card>
  );
}

function AccountTab() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
  });

  const handleSubmit = () => {
    if (newPassword.length < 8) {
      toast.error(t('settings:account.newPasswordInvalid'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settings:account.passwordsDoNotMatch'));
      return;
    }
    changePassword.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('settings:account.passwordChanged'));
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || t('settings:account.changePasswordFailed');
        toast.error(msg);
      },
    });
  };

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('settings:account.changePasswordTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">{t('settings:account.currentPassword')}</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder={t('settings:account.currentPasswordPlaceholder')} />
          </div>
          <div>
            <Label className="text-xs">{t('settings:account.newPassword')}</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('settings:account.newPasswordPlaceholder')} />
          </div>
          <div>
            <Label className="text-xs">{t('settings:account.confirmNewPassword')}</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('settings:account.confirmNewPasswordPlaceholder')} />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!currentPassword || !newPassword || !confirmPassword || changePassword.isPending}
            className="w-full mt-1"
          >
            {changePassword.isPending ? t('settings:account.changing') : t('settings:account.changePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionsTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: servers, isLoading } = useQuery({ queryKey: ['servers'], queryFn: serversApi.list });
  const createServer = useMutation({ mutationFn: (data: any) => serversApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const updateServer = useMutation({ mutationFn: ({ id, data }: any) => serversApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const deleteServer = useMutation({ mutationFn: (id: number) => serversApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['servers'] }) });
  const testServer = useMutation({ mutationFn: (id: number) => serversApi.test(id) });
  const testSshServer = useMutation({ mutationFn: (id: number) => serversApi.testSsh(id) });

  const [showAdd, setShowAdd] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [webqueryTestPassed, setWebqueryTestPassed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [form, setForm] = useState<ConnectionFormState>(DEFAULT_CONNECTION_FORM);
  const [diagnosticByServer, setDiagnosticByServer] = useState<Record<number, ConnectionDiagnosticReport>>({});
  const [testingServerId, setTestingServerId] = useState<number | null>(null);

  const serverList = useMemo(() => (Array.isArray(servers) ? servers : []), [servers]);
  const hasSshOnAnyConnection = serverList.some((s: any) => s.hasSshCredentials);

  useEffect(() => {
    if (searchParams.get('wizard') !== '1' || isLoading) return;
    const next = new URLSearchParams(searchParams);
    next.delete('wizard');
    setSearchParams(next, { replace: true });
    if (serverList.length === 0) {
      setShowWizard(true);
    }
  }, [searchParams, setSearchParams, isLoading, serverList.length]);

  if (isLoading) return <PageLoader />;

  const resetForm = () => setForm(DEFAULT_CONNECTION_FORM);

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      host: form.host,
      webqueryPort: parseInt(form.webqueryPort, 10),
      useHttps: form.useHttps,
      sshPort: parseInt(form.sshPort, 10),
      metricsEnabled: form.metricsEnabled,
      metricsPort: parseInt(form.metricsPort, 10) || 9187,
      metricsHost: form.metricsHost.trim() ? form.metricsHost.trim() : null,
    };
    if (form.apiKey) payload.apiKey = form.apiKey;
    if (form.sshUsername) payload.sshUsername = form.sshUsername;
    if (form.sshPassword) payload.sshPassword = form.sshPassword;

    if (editId) {
      updateServer.mutate({ id: editId, data: payload }, {
        onSuccess: () => { toast.success(t('settings:connections.connectionUpdated')); setEditId(null); setShowAdd(false); resetForm(); },
        onError: () => toast.error(t('settings:connections.updateFailed')),
      });
    } else {
      if (!form.apiKey) {
        toast.error(t('settings:connections.apiKeyRequired'));
        return;
      }
      payload.apiKey = form.apiKey;
      createServer.mutate(payload, {
        onSuccess: () => { toast.success(t('settings:connections.connectionAdded')); setShowAdd(false); resetForm(); },
        onError: () => toast.error(t('settings:connections.createFailed')),
      });
    }
  };

  const openEdit = (server: any) => {
    setForm({
      name: server.name || '',
      host: server.host || '',
      webqueryPort: String(server.webqueryPort || 10080),
      apiKey: '',
      useHttps: server.useHttps || false,
      sshPort: String(server.sshPort || 10022),
      sshUsername: '',
      sshPassword: '',
      metricsEnabled: Boolean(server.metricsEnabled),
      metricsPort: String(server.metricsPort || 9187),
      metricsHost: server.metricsHost || '',
    });
    setEditId(server.id);
    setShowAdd(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setShowAdd(false);
      setEditId(null);
      resetForm();
    } else {
      setShowAdd(true);
    }
  };

  return (
    <div className="space-y-4">
      <ConnectionSetupGuide
        hasConnections={serverList.length > 0}
        hasSshOnAnyConnection={hasSshOnAnyConnection}
        webqueryTestPassed={webqueryTestPassed}
        onStartWizard={() => setShowWizard(true)}
      />

      {serverList.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t('settings:connections.manageDescription')}</p>
          <Button size="sm" onClick={() => { resetForm(); setEditId(null); setShowAdd(true); }}>
            <Plus className="h-4 w-4 mr-1" /> {t('settings:connections.addConnection')}
          </Button>
        </div>
      )}

      {serverList.length === 0 ? (
        <EmptyState
          icon={Server}
          title={t('settings:connections.emptyTitle')}
          description={t('settings:connections.emptyDescription')}
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={() => setShowWizard(true)}>
              <Wand2 className="h-4 w-4 mr-1" /> {t('settings:connections.startWizard')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setEditId(null); setShowAdd(true); }}>
              {t('settings:connections.addManually')}
            </Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setHelpOpen(true)}>
              {t('settings:connections.needHelp')}
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {serverList.map((server: any) => (
            <Card key={server.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="min-w-0 break-words text-sm font-medium">{server.name}</CardTitle>
                  <div className="flex flex-wrap items-center gap-1">
                    {server.isDemo ? (
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">{t('settings:connections.demoData')}</Badge>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-[10px]">WebQuery</Badge>
                        <Badge variant={server.hasSshCredentials ? 'default' : 'secondary'} className="text-[10px]">
                          {server.hasSshCredentials ? t('settings:connections.sshConfigured') : t('settings:connections.sshNotConfigured')}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">{server.isDemo ? t('settings:connections.source') : t('settings:connections.host')}</span>
                  <span className={server.isDemo ? 'text-right' : 'break-all font-mono-data text-right'}>
                    {server.isDemo ? t('settings:connections.syntheticLocalFixtures') : `${server.host}:${server.webqueryPort}`}
                  </span>
                  <span className="text-muted-foreground">{t('settings:connections.protocol')}</span>
                  <span>{server.isDemo ? t('settings:connections.simulated') : (server.useHttps ? 'HTTPS' : 'HTTP')}</span>
                  <span className="text-muted-foreground">{t('settings:connections.ssh')}</span>
                  <span className={server.isDemo ? '' : 'font-mono-data'}>{server.isDemo ? t('settings:connections.notUsed') : (server.sshPort || '-')}</span>
                  <span className="text-muted-foreground">{t('settings:connections.status')}</span>
                  <span>
                    <Badge variant={server.enabled ? 'default' : 'secondary'} className="text-[10px]">
                      {server.enabled ? t('common:state.enabled') : t('common:state.disabled')}
                    </Badge>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1 pt-2">
                  {server.isDemo ? (
                    <span className="mr-auto text-[11px] text-muted-foreground">
                      {t('settings:connections.noRealConnection')}
                    </span>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={testingServerId === server.id || testServer.isPending}
                        onClick={() => {
                          setTestingServerId(server.id);
                          testServer.mutate(server.id, {
                            onSuccess: (data: ConnectionDiagnosticReport) => {
                              setDiagnosticByServer((prev) => ({ ...prev, [server.id]: data }));
                              if (data?.success === true) {
                                setWebqueryTestPassed(true);
                                toast.success(diagnosticToastMessage(data));
                              } else if (data?.partial) {
                                toast.message(diagnosticToastMessage(data));
                              } else {
                                toast.error(diagnosticToastMessage(data));
                              }
                            },
                            onError: (err: any) => toast.error(apiErrorMessage(err, t('settings:connections.webqueryTestFailed'))),
                            onSettled: () => setTestingServerId((current) => (current === server.id ? null : current)),
                          });
                        }}
                      >
                        {testingServerId === server.id
                          ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          : <TestTube className="h-3 w-3 mr-1" />}
                        {t('settings:connections.testWebquery')}
                      </Button>
                      {server.hasSshCredentials && (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => testSshServer.mutate(server.id, {
                          onSuccess: () => toast.success(t('settings:connections.sshTestSuccessful')),
                          onError: (err: any) => toast.error(apiErrorMessage(err, t('settings:connections.sshTestFailed'))),
                        })}>
                          <TestTube className="h-3 w-3 mr-1" /> {t('settings:connections.testSsh')}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(server)}>
                        <Pencil className="h-3 w-3 mr-1" /> {t('settings:connections.edit')}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(server.id)} aria-label={t('settings:connections.deleteConnectionFor', { name: server.name })} title={t('settings:connections.deleteConnection')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {(diagnosticByServer[server.id] || testingServerId === server.id) && (
                  <ConnectionDiagnosticStages
                    className="pt-1"
                    compact
                    pending={testingServerId === server.id}
                    report={diagnosticByServer[server.id]}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConnectionFormDialog
        open={showAdd}
        editId={editId}
        form={form}
        saving={createServer.isPending || updateServer.isPending}
        onOpenChange={handleDialogOpenChange}
        onChange={setForm}
        onSave={handleSave}
      />

      <ConnectionSetupWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onComplete={() => setWebqueryTestPassed(true)}
      />

      <ConnectionSetupHelpDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        hasConnections={serverList.length > 0}
        hasSshOnAnyConnection={hasSshOnAnyConnection}
        webqueryTestPassed={webqueryTestPassed}
        onStartWizard={() => { setHelpOpen(false); setShowWizard(true); }}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title={t('settings:connections.deleteConnectionTitle')}
        description={t('settings:connections.deleteConnectionDescription')}
        onConfirm={() => { if (deleteId) deleteServer.mutate(deleteId, { onSuccess: () => { toast.success(t('settings:connections.connectionDeleted')); setDeleteId(null); } }); }}
        destructive
      />
    </div>
  );
}

function UsersTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const createUser = useMutation({ mutationFn: (data: any) => usersApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const updateUser = useMutation({ mutationFn: ({ id, data }: { id: number; data: any }) => usersApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const deleteUser = useMutation({ mutationFn: (id: number) => usersApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });

  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [resetPwUserId, setResetPwUserId] = useState<number | null>(null);
  const [resetPwValue, setResetPwValue] = useState('');
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'viewer' });

  const userList = useMemo(() => (Array.isArray(users) ? users : []), [users]);

  if (isLoading) return <PageLoader />;

  const handleCreate = () => {
    createUser.mutate(form, {
      onSuccess: () => { toast.success(t('settings:users.userCreated')); setShowAdd(false); setForm({ username: '', password: '', displayName: '', role: 'viewer' }); },
      onError: () => toast.error(t('settings:users.createUserFailed')),
    });
  };

  const handleRoleChange = (userId: number, role: string) => {
    updateUser.mutate({ id: userId, data: { role } }, {
      onSuccess: () => toast.success(t('settings:users.roleUpdated')),
      onError: () => toast.error(t('settings:users.updateRoleFailed')),
    });
  };

  const handleToggleEnabled = (userId: number, enabled: boolean) => {
    updateUser.mutate({ id: userId, data: { enabled } }, {
      onSuccess: () => toast.success(enabled ? t('settings:users.userEnabled') : t('settings:users.userDisabled')),
      onError: () => toast.error(t('settings:users.updateStatusFailed')),
    });
  };

  const handleResetPassword = () => {
    if (!resetPwUserId || resetPwValue.length < 6) {
      toast.error(t('settings:users.passwordMinLength'));
      return;
    }
    updateUser.mutate({ id: resetPwUserId, data: { password: resetPwValue } }, {
      onSuccess: () => { toast.success(t('settings:users.passwordReset')); setResetPwUserId(null); setResetPwValue(''); },
      onError: () => toast.error(t('settings:users.resetPasswordFailed')),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('settings:users.manageDescription')}</p>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> {t('settings:users.addUser')}</Button>
      </div>

      <div className="max-w-full overflow-x-auto rounded-md border border-border" tabIndex={0} role="region" aria-label={t('settings:users.tableLabel')}>
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings:users.username')}</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings:users.displayName')}</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings:users.role')}</th>
              <th className="h-10 px-3 text-left font-medium text-muted-foreground">{t('settings:users.status')}</th>
              <th className="h-10 px-3 text-right font-medium text-muted-foreground">{t('settings:users.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((u: any) => {
              const isProtected = u.username === 'admin';
              return (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-mono-data text-xs">{u.username}</td>
                  <td className="px-3 py-2.5">{u.displayName}</td>
                  <td className="px-3 py-2.5">
                    {isProtected ? (
                      <Badge variant="default" className="text-[10px] capitalize">{u.role}</Badge>
                    ) : (
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t('settings:users.admin')}</SelectItem>
                          <SelectItem value="viewer">{t('settings:users.viewer')}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isProtected ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <Check className="h-3 w-3" /> {t('settings:users.active')}
                      </span>
                    ) : (
                      <Switch
                        checked={u.enabled}
                        onCheckedChange={(v) => handleToggleEnabled(u.id, v)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t('settings:users.resetPassword')} aria-label={t('settings:users.resetPasswordFor', { username: u.username })} onClick={() => { setResetPwUserId(u.id); setResetPwValue(''); }}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)} disabled={isProtected} aria-label={t('settings:users.deleteUserFor', { username: u.username })} title={t('settings:users.deleteUser')}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('settings:users.addUserTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">{t('settings:users.username')}</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder={t('settings:users.usernamePlaceholder')} /></div>
            <div><Label className="text-xs">{t('settings:users.displayName')}</Label><Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder={t('settings:users.displayNamePlaceholder')} /></div>
            <div><Label className="text-xs">{t('settings:users.password')}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('settings:users.passwordPlaceholder')} /></div>
            <div>
              <Label className="text-xs">{t('settings:users.role')}</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('settings:users.admin')}</SelectItem>
                  <SelectItem value="viewer">{t('settings:users.viewer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t('settings:users.cancel')}</Button>
            <Button onClick={handleCreate} disabled={!form.username || !form.password}>{t('settings:users.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPwUserId !== null} onOpenChange={(v) => { if (!v) { setResetPwUserId(null); setResetPwValue(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{t('settings:users.resetPasswordTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              <Trans
                i18nKey="settings:users.resetPasswordForUser"
                values={{ username: userList.find((u: any) => u.id === resetPwUserId)?.username }}
                components={{ strong: <span className="font-medium text-foreground" /> }}
              />
            </p>
            <div>
              <Label className="text-xs">{t('settings:users.newPassword')}</Label>
              <Input type="password" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} placeholder={t('settings:users.newPasswordPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPwUserId(null); setResetPwValue(''); }}>{t('settings:users.cancel')}</Button>
            <Button onClick={handleResetPassword} disabled={resetPwValue.length < 6 || updateUser.isPending}>
              {updateUser.isPending ? t('settings:users.resetting') : t('settings:users.resetPasswordTitle')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title={t('settings:users.deleteUserTitle')}
        description={t('settings:users.deleteUserDescription')}
        onConfirm={() => { if (deleteId) deleteUser.mutate(deleteId, { onSuccess: () => { toast.success(t('settings:users.userDeleted')); setDeleteId(null); } }); }}
        destructive
      />
    </div>
  );
}

function YouTubeTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pasteMode, setPasteMode] = useState(false);
  const [cookieText, setCookieText] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['yt-cookie-status'],
    queryFn: settingsApi.getYtCookieStatus,
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => settingsApi.uploadYtCookieFile(file),
    onSuccess: () => {
      toast.success(t('settings:youtube.cookieFileUploaded'));
      qc.invalidateQueries({ queryKey: ['yt-cookie-status'] });
    },
    onError: () => toast.error(t('settings:youtube.cookieFileUploadFailed')),
  });

  const uploadText = useMutation({
    mutationFn: (text: string) => settingsApi.uploadYtCookieText(text),
    onSuccess: () => {
      toast.success(t('settings:youtube.cookiesSaved'));
      setCookieText('');
      setPasteMode(false);
      qc.invalidateQueries({ queryKey: ['yt-cookie-status'] });
    },
    onError: () => toast.error(t('settings:youtube.saveCookiesFailed')),
  });

  const deleteCookies = useMutation({
    mutationFn: () => settingsApi.deleteYtCookies(),
    onSuccess: () => {
      toast.success(t('settings:youtube.cookieFileRemoved'));
      qc.invalidateQueries({ queryKey: ['yt-cookie-status'] });
    },
    onError: () => toast.error(t('settings:youtube.removeCookiesFailed')),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile.mutate(file);
    e.target.value = '';
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2" data-testid="youtube-columns">
      <div className="min-w-0 space-y-4" data-testid="youtube-column-sources">
      <RuntimeMediaDiagnostics focus={['yt-dlp', 'ffmpeg', 'ffprobe']} />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t('settings:youtube.cookiesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            <Trans
              i18nKey="settings:youtube.cookiesDescription"
              components={{ strong: <span className="font-medium" /> }}
            />
          </p>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${status?.active ? 'bg-green-500' : 'bg-zinc-500'}`} />
            <span className="text-sm">
              {isLoading ? t('settings:youtube.loading') : status?.active
                ? t('settings:youtube.cookiesActive', { size: formatSize(status.size) })
                : t('settings:youtube.noCookies')}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <input
              type="file"
              accept=".txt,.cookies"
              className="hidden"
              id="cookie-file-input"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('cookie-file-input')?.click()}
              disabled={uploadFile.isPending}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {uploadFile.isPending ? t('settings:youtube.uploading') : t('settings:youtube.uploadCookies')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPasteMode(!pasteMode)}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              {t('settings:youtube.pasteCookies')}
            </Button>
            {status?.active && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteCookies.mutate()}
                disabled={deleteCookies.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t('settings:youtube.remove')}
              </Button>
            )}
          </div>

          {/* Paste mode */}
          {pasteMode && (
            <div className="space-y-2">
              <textarea
                className="w-full h-32 rounded-md border border-border bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;0&#9;COOKIE_NAME&#9;COOKIE_VALUE"
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => uploadText.mutate(cookieText)}
                  disabled={!cookieText.trim() || uploadText.isPending}
                >
                  {uploadText.isPending ? t('settings:youtube.saving') : t('settings:youtube.save')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPasteMode(false); setCookieText(''); }}>
                  {t('common:action.cancel')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <div className="min-w-0" data-testid="youtube-column-limits">
        <LimitsCard />
      </div>
    </div>
  );
}

function LimitsCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: limits, isLoading } = useQuery({
    queryKey: ['settings-limits'],
    queryFn: settingsApi.getLimits,
  });
  const [maxVideoDuration, setMaxVideoDuration] = useState('');
  const [maxPlaylistImport, setMaxPlaylistImport] = useState('');
  const [youtubeDirectStream, setYoutubeDirectStream] = useState(false);

  useEffect(() => {
    if (limits) {
      setMaxVideoDuration(String(limits.maxVideoDuration ?? 900));
      setMaxPlaylistImport(String(limits.maxPlaylistImport ?? 250));
      setYoutubeDirectStream(limits.youtubeDirectStream === true);
    }
  }, [limits]);

  const saveLimits = useMutation({
    mutationFn: () => settingsApi.updateLimits({
      maxVideoDuration: parseInt(maxVideoDuration, 10),
      maxPlaylistImport: parseInt(maxPlaylistImport, 10),
      youtubeDirectStream,
    }),
    onSuccess: () => {
      toast.success(t('settings:youtube.limitsSaved'));
      qc.invalidateQueries({ queryKey: ['settings-limits'] });
    },
    onError: () => toast.error(t('settings:youtube.saveLimitsFailed')),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{t('settings:youtube.limitsTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {t('settings:youtube.limitsDescription')}
        </p>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">{t('settings:youtube.loading')}</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="youtube-direct-stream" className="text-xs">{t('settings:youtube.streamDirectly')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('settings:youtube.streamDirectlyDescription')}
                </p>
              </div>
              <Switch
                id="youtube-direct-stream"
                checked={youtubeDirectStream}
                onCheckedChange={setYoutubeDirectStream}
              />
            </div>
            <div>
              <Label className="text-xs">{t('settings:youtube.maxVideoDuration')}</Label>
              <Input
                type="number"
                min={0}
                value={maxVideoDuration}
                onChange={(e) => setMaxVideoDuration(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings:youtube.maxVideoDurationHint')}
              </p>
            </div>
            <div>
              <Label className="text-xs">{t('settings:youtube.maxPlaylistImport')}</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={maxPlaylistImport}
                onChange={(e) => setMaxPlaylistImport(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => saveLimits.mutate()}
              disabled={saveLimits.isPending}
            >
              {saveLimits.isPending ? t('settings:youtube.savingLimits') : t('settings:youtube.saveLimits')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
