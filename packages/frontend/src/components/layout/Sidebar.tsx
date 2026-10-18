import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Server, Hash, Users, Shield, ShieldCheck,
  Lock, Ban, KeyRound, FolderOpen, MessageSquareWarning, Mail,
  ScrollText, Settings, Bot, LayoutGrid, Cpu, ChevronDown, ChevronLeft, ChevronRight, Library, Tv, Github, BookOpen, Menu,
  ClipboardList, NotebookPen, Stethoscope,

  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore, type SidebarSectionId } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { useScrollEdges } from '@/hooks/use-scroll-edges';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { BrandMark } from '@/components/shared/BrandMark';
import { APP_DOCUMENTATION_URL, APP_REPOSITORY_URL, APP_VERSION, APP_VERSION_LABEL } from '@/lib/app-version';

interface NavSection {
  id: SidebarSectionId;
  labelKey: string;
  adminOnly?: boolean;
  items: Array<{
    to: string;
    icon: LucideIcon;
    labelKey: string;
    adminOnly?: boolean;
  }>;
}

const navSections: NavSection[] = [
  {
    id: 'overview',
    labelKey: 'nav.sections.overview',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.items.dashboard' },
      { to: '/servers', icon: Server, labelKey: 'nav.items.virtualServers', adminOnly: true },
    ],
  },
  {
    id: 'management',
    labelKey: 'nav.sections.management',
    items: [
      { to: '/channels', icon: Hash, labelKey: 'nav.items.channels' },
      { to: '/clients', icon: Users, labelKey: 'nav.items.clients' },
      { to: '/server-groups', icon: Shield, labelKey: 'nav.items.serverGroups', adminOnly: true },
      { to: '/channel-groups', icon: ShieldCheck, labelKey: 'nav.items.channelGroups', adminOnly: true },
      { to: '/permissions', icon: Lock, labelKey: 'nav.items.permissions', adminOnly: true },
    ],
  },
  {
    id: 'security',
    labelKey: 'nav.sections.security',
    adminOnly: true,
    items: [
      { to: '/bans', icon: Ban, labelKey: 'nav.items.bans', adminOnly: true },
      { to: '/tokens', icon: KeyRound, labelKey: 'nav.items.tokens', adminOnly: true },
    ],
  },
  {
    id: 'content',
    labelKey: 'nav.sections.content',
    adminOnly: true,
    items: [
      { to: '/files', icon: FolderOpen, labelKey: 'nav.items.files', adminOnly: true },
      { to: '/complaints', icon: MessageSquareWarning, labelKey: 'nav.items.complaints', adminOnly: true },
      { to: '/messages', icon: Mail, labelKey: 'nav.items.messages', adminOnly: true },
    ],
  },
  {
    id: 'system',
    labelKey: 'nav.sections.system',
    adminOnly: true,
    items: [
      { to: '/logs', icon: ScrollText, labelKey: 'nav.items.serverLogs', adminOnly: true },
      { to: '/audit', icon: ClipboardList, labelKey: 'nav.items.adminAudit', adminOnly: true },
      { to: '/activity-journal', icon: NotebookPen, labelKey: 'nav.items.activityJournal', adminOnly: true },

      { to: '/instance', icon: Cpu, labelKey: 'nav.items.instance', adminOnly: true },
      { to: '/diagnostics', icon: Stethoscope, labelKey: 'nav.items.diagnostics', adminOnly: true },
    ],
  },
  {
    id: 'automation',
    labelKey: 'nav.sections.automation',
    adminOnly: true,
    items: [
      { to: '/bot-hub', icon: LayoutGrid, labelKey: 'nav.items.botHub', adminOnly: true },
      { to: '/bots', icon: Bot, labelKey: 'nav.items.botFlows', adminOnly: true },
      { to: '/media-bots', icon: Library, labelKey: 'nav.items.mediaLibrary', adminOnly: true },
      { to: '/iptv', icon: Tv, labelKey: 'nav.items.iptv', adminOnly: true },
    ],
  },
];

interface NavigationContentProps {
  collapsed?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}

function NavigationContent({ collapsed = false, mobile = false, onNavigate }: NavigationContentProps) {
  const { t } = useTranslation('app');
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const location = useLocation();
  const sidebarSections = useUiStore((s) => s.sidebarSections);
  const toggleSidebarSection = useUiStore((s) => s.toggleSidebarSection);
  const settingsActive = location.pathname.startsWith('/settings');
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const scrollEdges = useScrollEdges(scrollRootRef);
  const settingsLink = (
    <NavLink
      to="/settings"
      onClick={onNavigate}
      aria-label={collapsed ? t('nav.items.settings') : undefined}
      aria-current={settingsActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        mobile ? 'min-h-10 px-2.5 py-2' : 'px-2.5 py-1',
        collapsed && 'justify-center px-0 py-2',
        settingsActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
      )}
    >
      <Settings className="h-4 w-4" />
      {!collapsed && <span>{t('nav.items.settings')}</span>}
    </NavLink>
  );

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col" data-nav-scroll-container>
        <ScrollArea ref={scrollRootRef} type="auto" className="h-full py-2">
          <nav className="space-y-1 px-2" aria-label={mobile ? t('nav.mobile') : t('nav.primary')}>
            {navSections
              .filter((section) => !section.adminOnly || isAdmin)
              .map((section, si) => {
                const visibleItems = section.items.filter((item) => !item.adminOnly || isAdmin);
                if (visibleItems.length === 0) return null;
                const expanded = sidebarSections[section.id];
                const activeItem = visibleItems.find(item => location.pathname === item.to || location.pathname.startsWith(item.to + '/'));
                const contentId = `${mobile ? 'mobile' : 'desktop'}-${section.id}-navigation`;
                const renderItem = (item: (typeof visibleItems)[number]) => {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                  const link = (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onNavigate}
                      aria-label={collapsed ? t(item.labelKey) : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        mobile ? 'min-h-10 px-2.5 py-2' : 'px-2.5 py-1',
                        collapsed && 'justify-center px-0 py-2',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                      )}
                    >
                      <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-primary')} />
                      {!collapsed && <span>{t(item.labelKey)}</span>}
                    </NavLink>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={item.to}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {t(item.labelKey)}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  return link;
                };

                return (
                  <div key={section.id} className={cn(si > 0 && !collapsed && !mobile && 'pt-1.5')}>
                    {si > 0 && collapsed && <Separator className="my-2 bg-sidebar-border" />}
                    {!collapsed && (
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={contentId}
                        aria-label={t(expanded ? 'nav.collapseSection' : 'nav.expandSection', { section: t(section.labelKey) })}
                        onClick={() => toggleSidebarSection(section.id)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          mobile && 'min-h-9',
                        )}
                      >
                        <span>{t(section.labelKey)}</span>
                        <span className="flex items-center gap-1.5">
                          {!expanded && (
                            <span aria-hidden="true" data-section-count className="rounded bg-sidebar-accent px-1.5 font-mono-data text-[10px] font-medium tracking-normal text-sidebar-foreground/75">
                              {visibleItems.length}
                            </span>
                          )}
                          {expanded
                            ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                        </span>
                      </button>
                    )}
                    <div id={contentId} hidden={!collapsed && !expanded} className="space-y-1">
                      {(collapsed || expanded) && visibleItems.map(renderItem)}
                    </div>
                    {!collapsed && !expanded && activeItem && (
                      <div className="space-y-1" data-active-section-destination={section.id}>
                        {renderItem(activeItem)}
                      </div>
                    )}
                  </div>
                );
              })}
          </nav>
        </ScrollArea>
        {scrollEdges.top && (
          <div aria-hidden="true" data-nav-scroll-edge="top" className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-sidebar to-transparent" />
        )}
        {scrollEdges.bottom && (
          <div aria-hidden="true" data-nav-scroll-edge="bottom" className="pointer-events-none absolute inset-x-0 bottom-0 flex h-12 items-end justify-center bg-gradient-to-t from-sidebar via-sidebar/85 to-transparent pb-1">
            <ChevronDown className="h-4 w-4 text-sidebar-foreground/60" />
          </div>
        )}
      </div>

      <div className="border-t border-sidebar-border p-2 space-y-1">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{settingsLink}</TooltipTrigger>
            <TooltipContent side="right" className="font-medium">{t('nav.items.settings')}</TooltipContent>
          </Tooltip>
        ) : settingsLink}

        {!mobile && <DesktopSidebarFooter collapsed={collapsed} />}
        {mobile && <VersionLinks collapsed={false} />}
      </div>
    </>
  );
}

function VersionLinks({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 pt-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="px-1 text-center text-[9px] font-mono-data text-sidebar-foreground/35 truncate cursor-default">v{APP_VERSION}</p>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-mono-data text-xs">{APP_VERSION_LABEL}</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-1">
          <ExternalNavLinks compact />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2.5 pt-1 pb-0.5">
      <p className="min-w-0 flex-1 truncate text-[10px] font-mono-data text-sidebar-foreground/40" title={APP_VERSION_LABEL}>{APP_VERSION_LABEL}</p>
      <ExternalNavLinks />
    </div>
  );
}

function ExternalNavLinks({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation('app');
  const linkClass = cn(
    'shrink-0 rounded text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    compact ? 'p-1' : 'p-2 md:p-1',
  );
  return (
    <>
      <a href={APP_REPOSITORY_URL} target="_blank" rel="noopener noreferrer" aria-label={t('nav.repository')} title={t('nav.repositoryTitle')} className={linkClass}>
        <Github className="h-3.5 w-3.5" />
      </a>
      <a href={APP_DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer" aria-label={t('nav.documentation')} title={t('nav.documentationTitle')} className={linkClass}>
        <BookOpen className="h-3.5 w-3.5" />
      </a>
    </>
  );
}

function DesktopSidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation('app');
  const { toggleSidebar } = useUiStore();
  return (
    <>
      <button
        onClick={toggleSidebar}
        aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
        className={cn(
          'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed && 'justify-center px-0 py-2',
        )}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {!collapsed && <span>{t('nav.collapse')}</span>}
      </button>
      <VersionLinks collapsed={collapsed} />
    </>
  );
}

function Logo({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation('app');
  return (
    <NavLink
      to="/dashboard"
      onClick={onNavigate}
      aria-label={t('nav.dashboardLabel')}
      title={compact ? t('nav.dashboardLabel') : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact && 'justify-center',
      )}
    >
      <BrandMark className="h-7 w-7 text-primary" />
      {!compact && (
        <div>
          <span className="text-sm font-semibold text-sidebar-accent-foreground">TS6</span>
          <span className="text-sm text-sidebar-foreground ml-1">Manager</span>
        </div>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'relative hidden pb-[env(safe-area-inset-bottom)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:flex',
          sidebarCollapsed ? 'w-16' : 'w-56',
        )}
      >
        <div className={cn('flex items-center h-14 px-4 border-b border-sidebar-border', sidebarCollapsed && 'justify-center px-0')}>
          <Logo compact={sidebarCollapsed} />
        </div>
        <NavigationContent collapsed={sidebarCollapsed} />
      </aside>
    </TooltipProvider>
  );
}

export function MobileNavigation() {
  const { t } = useTranslation('app');
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 lg:hidden" aria-label={t('nav.openMenu')} title={t('nav.openMenu')}>
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="sr-only">{t('nav.navigation')}</SheetTitle>
        <SheetDescription className="sr-only">{t('nav.navigationDescription')}</SheetDescription>
        <div className="flex min-h-14 items-center border-b border-sidebar-border px-4 pr-14 pt-[env(safe-area-inset-top)]">
          <Logo onNavigate={() => setOpen(false)} />
        </div>
        <TooltipProvider delayDuration={0}>
          <NavigationContent mobile onNavigate={() => setOpen(false)} />
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
