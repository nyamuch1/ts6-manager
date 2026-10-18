import { Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Library,
  ListMusic,
  FileAudio,
  Radio,
  Clock,
  Video,
} from 'lucide-react';
import { RequestsTab } from '@/components/media/RequestsTab';
import { ActiveBotsMenu } from '@/components/media/ActiveBotsMenu';
import { isMediaLibraryTab, mediaLibraryRedirect, type MediaLibraryTab } from '@/lib/media-library-redirect';
import { LibraryTab } from './LibraryTab';
import { PlaylistsTab } from './PlaylistsTab';
import { RadioTab } from './RadioTab';
import { StreamingDefaultsTab } from './StreamingDefaultsTab';


// ─── Main Page ───────────────────────────────────────────────────────────────

/**
 * Media Library (`/media-bots`): media shared by every bot on a server.
 * Bots live in the Bot Hub; old Bots, Queue, Video and Commands links redirect.
 */
export default function MusicBots() {
  const { t } = useTranslation('media');
  const [searchParams, setSearchParams] = useSearchParams();
  const redirect = mediaLibraryRedirect(searchParams);
  const tabParam = searchParams.get('tab');
  const activeTab: MediaLibraryTab = isMediaLibraryTab(tabParam) ? tabParam : 'library';
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'library') next.delete('tab'); else next.set('tab', tab);
    next.delete('bot');
    setSearchParams(next, { replace: true });
  };

  if (redirect) return <Navigate to={redirect} replace />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('page.title')}
        icon={Library}
        description={t('page.description')}
        actions={<ActiveBotsMenu />}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="library"><FileAudio className="h-3.5 w-3.5 mr-1.5" /> {t('page.tabLibrary')}</TabsTrigger>
          <TabsTrigger value="playlists"><ListMusic className="h-3.5 w-3.5 mr-1.5" /> {t('page.tabPlaylists')}</TabsTrigger>
          <TabsTrigger value="radio"><Radio className="h-3.5 w-3.5 mr-1.5" /> {t('page.tabRadio')}</TabsTrigger>
          <TabsTrigger value="requests"><Clock className="h-3.5 w-3.5 mr-1.5" /> {t('page.tabRequests')}</TabsTrigger>
          <TabsTrigger value="streaming"><Video className="h-3.5 w-3.5 mr-1.5" /> {t('page.tabStreaming')}</TabsTrigger>
        </TabsList>

        <TabsContent value="library"><LibraryTab /></TabsContent>
        <TabsContent value="playlists"><PlaylistsTab /></TabsContent>
        <TabsContent value="radio"><RadioTab /></TabsContent>
        <TabsContent value="requests"><RequestsTab /></TabsContent>
        <TabsContent value="streaming"><StreamingDefaultsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
