import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { BrandMark } from '@/components/shared/BrandMark';
import { LanguageMenu } from '@/components/shared/LanguageMenu';
import { currentLocale } from '@/i18n';

export default function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    axios.get('/api/setup/status').then((res) => {
      if (!res.data.needsSetup) navigate('/login', { replace: true });
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [navigate]);

  if (checking) {
    return (
      <div className="auth-viewport min-h-screen min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('app:auth.setup.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await axios.post('/api/setup/init', {
        username,
        password,
        displayName: displayName || username,
      }, {
        headers: { 'Accept-Language': currentLocale() },
      });
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || t('app:auth.setup.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-viewport min-h-screen min-h-dvh flex items-center justify-center bg-background grid-bg">
      <div className="fixed right-4 top-4 z-10">
        <LanguageMenu />
      </div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm mx-4 relative">
        <div className="text-center mb-8">
          <BrandMark className="mx-auto mb-4 h-16 w-16 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">TS6 Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('app:auth.setup.subtitle')}</p>
        </div>

        <Card className="border-border/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <h2 className="text-sm font-medium text-center text-muted-foreground">
              {t('app:auth.setup.heading')}
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-xs">{t('app:auth.setup.username')}</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-xs">{t('app:auth.setup.displayName')}</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('app:auth.setup.displayNamePlaceholder')}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs">{t('app:auth.setup.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('app:auth.setup.passwordPlaceholder')}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs">{t('app:auth.setup.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('app:auth.setup.confirmPlaceholder')}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !username || !password || !confirmPassword}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('app:auth.setup.creating')}
                  </>
                ) : (
                  t('app:auth.setup.createAccount')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
