import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getNavEntries, navigation } from '@/config/navigation';
import { useSessionStore } from '@/auth/session';
import { useUiStore } from '@/stores/ui-store';
import { Brand } from './Brand';
import { LanguageSwitcher } from './LanguageSwitcher';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { SearchTrigger } from './SearchTrigger';
import { ThemeToggle } from './ThemeToggle';
import { TopNav } from './TopNav';
import { UserMenu } from './UserMenu';

/** Flat navigation list for the mobile drawer (all routable pages). */
function MobileDrawerBody({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const role = useSessionStore((state) => state.role);
  const permissions = useSessionStore((state) => state.permissions);
  const entries = useMemo(
    () =>
      getNavEntries(navigation).filter((entry) => {
        if (!entry.permission || role === 'super_admin') return true;
        if (Array.isArray(entry.permission)) {
          return entry.permission.some((p) => permissions.includes(p));
        }
        return permissions.includes(entry.permission);
      }),
    [role, permissions],
  );

  return (
    <nav aria-label={t('sidebar.primaryNav')} className="scrollbar-slim flex-1 overflow-y-auto p-2">
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.path}>
            <NavLink
              to={entry.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-2.5 rounded-[3px] px-3 text-body font-medium transition-colors duration-150',
                  'text-ink-muted hover:bg-surface-hover hover:text-ink',
                  isActive && 'bg-surface-hover font-semibold text-navy',
                )
              }
            >
              <entry.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="truncate">{t(`nav.${entry.id}`)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TopBar() {
  const { t } = useTranslation();
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen);
  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);

  return (
    <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-5 bg-navy px-4 md:px-6 lg:gap-7 lg:px-6">
      <button
        type="button"
        onClick={mobileSidebarOpen ? closeMobileSidebar : openMobileSidebar}
        aria-label={mobileSidebarOpen ? t('topbar.closeMenu') : t('topbar.openMenu')}
        aria-expanded={mobileSidebarOpen}
        className="grid h-7 w-7 shrink-0 -ms-1 place-items-center rounded-[2px] text-on-navy-muted-85 transition-colors duration-150 hover:bg-on-navy-fill-12 hover:text-on-navy xl:hidden"
      >
        <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <Brand className="rise" />

      <TopNav />

      <div
        className="rise ms-auto flex shrink-0 items-center gap-2"
        style={{ animationDelay: '120ms' }}
      >
        <SearchTrigger />
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationBell />
        <UserMenu />
      </div>

      <Dialog.Root open={mobileSidebarOpen} onOpenChange={(open) => (open ? undefined : closeMobileSidebar())}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(7,45,74,0.45)]" />
          <Dialog.Content
            className="fixed inset-y-0 start-0 z-50 flex w-[280px] flex-col border-e border-hairline bg-surface focus:outline-none"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <Dialog.Title className="sr-only">{t('brand.name')}</Dialog.Title>
            <Dialog.Description className="sr-only">{t('sidebar.primaryNav')}</Dialog.Description>
            <div className="flex shrink-0 items-center gap-2.5 border-b border-divider px-4 py-3.5">
              <Brand tone="light" />
            </div>
            <MobileDrawerBody onNavigate={closeMobileSidebar} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}