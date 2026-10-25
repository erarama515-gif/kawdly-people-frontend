import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { navigation, type NavGroup } from '@/config/navigation';
import { useSessionStore } from '@/auth/session';

type TopNavItem =
  | { kind: 'leaf'; id: string; path: string; icon: LucideIcon }
  | { kind: 'group'; group: NavGroup };

function hasLeafAccess(leaf: { permission?: string | string[] | undefined }, role: string | null, permissions: string[]): boolean {
  if (!leaf.permission || role === 'super_admin') return true;
  if (Array.isArray(leaf.permission)) {
    return leaf.permission.some((p) => permissions.includes(p));
  }
  return permissions.includes(leaf.permission);
}

function isLeafActive(item: Extract<TopNavItem, { kind: 'leaf' }>, pathname: string) {
  return pathname === item.path;
}

function isGroupActive(group: NavGroup, pathname: string) {
  return group.children.some((child) => child.path === pathname);
}

const navButtonClass =
  'group/nav h-full shrink-0 cursor-pointer place-items-center border-0 bg-transparent text-on-navy-muted-75 outline-none focus-visible:outline-2 focus-visible:outline-on-navy focus-visible:outline-offset-[-4px]';

const navLabelClass =
  'inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium transition-colors duration-150 group-hover/nav:text-on-navy';

/**
 * Primary navigation, moved into the top bar per the reference: a flat row of
 * buttons (dashboard + the five groups) with a sliding underline that tracks
 * the active page. Group buttons open a floating panel listing their pages.
 */
export function TopNav({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const role = useSessionStore((state) => state.role);
  const permissions = useSessionStore((state) => state.permissions);

  const items = useMemo(() => {
    const list: TopNavItem[] = [];
    for (const leaf of navigation.primary) {
      if (hasLeafAccess(leaf, role, permissions)) {
        list.push({ kind: 'leaf', id: leaf.id, path: leaf.path, icon: leaf.icon });
      }
    }
    for (const group of navigation.groups) {
      const allowedChildren = group.children.filter((child) => hasLeafAccess(child, role, permissions));
      if (allowedChildren.length > 0) {
        list.push({ kind: 'group', group: { ...group, children: allowedChildren } });
      }
    }
    return list;
  }, [role, permissions]);
  const activeIndex = items.findIndex((item) =>
    item.kind === 'leaf' ? isLeafActive(item, pathname) : isGroupActive(item.group, pathname),
  );

  const [indicator, setIndicator] = useState<{ left: number; right: number } | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Menus close on navigation and on direction changes.
  useEffect(() => {
    setOpenGroupId(null);
  }, [pathname, i18n.language]);

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav || activeIndex < 0) {
      setIndicator(null);
      return;
    }
    const button = buttonRefs.current[activeIndex];
    if (!button) {
      setIndicator(null);
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    // The underline is a physical element, so offsets follow the actual flow.
    setIndicator({
      left: buttonRect.left - navRect.left,
      right: navRect.right - buttonRect.right,
    });
  }, [activeIndex]);

  useEffect(() => {
    measure();
    const schedule = () => window.requestAnimationFrame(measure);
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);
    if (navRef.current) observer.observe(navRef.current);
    if (typeof document.fonts?.ready === 'object') {
      document.fonts.ready.then(schedule).catch(() => undefined);
    }
    return () => {
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, [measure]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  const go = (path: string) => {
    setOpenGroupId(null);
    navigate(path);
  };

  return (
    <nav
      ref={navRef}
      aria-label={t('sidebar.primaryNav')}
      className={cn('rise relative hidden h-full flex-1 shrink-0 items-center gap-6 xl:flex', className)}
      style={{ animationDelay: '60ms' }}
    >
      {items.map((item, index) => {
        const key = item.kind === 'leaf' ? item.path : item.group.id;
        const active = item.kind === 'leaf' ? isLeafActive(item, pathname) : isGroupActive(item.group, pathname);
        const isOpen = item.kind === 'group' && openGroupId === item.group.id;

        if (item.kind === 'leaf') {
          return (
            <button
              key={key}
              ref={(node) => {
                buttonRefs.current[index] = node;
              }}
              type="button"
              className={cn(navButtonClass, 'flex items-center px-0')}
              onClick={() => go(item.path)}
            >
              <span className={cn(navLabelClass, active && 'text-on-navy font-semibold')}>{t(`nav.${item.id}`)}</span>
            </button>
          );
        }

        const group = item.group;
        return (
          <Popover.Root
            key={key}
            open={isOpen}
            onOpenChange={(next) => setOpenGroupId(next ? group.id : null)}
          >
            <Popover.Anchor asChild>
              <button
                ref={(node) => {
                  buttonRefs.current[index] = node;
                }}
                type="button"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls={`topnav-menu-${group.id}`}
                onPointerEnter={() => setOpenGroupId(group.id)}
                onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                className={cn(navButtonClass, 'flex items-center px-0')}
              >
                <span className={cn(navLabelClass, active && 'text-on-navy font-semibold', isOpen && 'text-on-navy')}>
                  <span>{t(`nav.${group.id}`)}</span>
                  <span
                    aria-hidden="true"
                    className={cn('inline-flex transition-transform duration-200', isOpen && 'rotate-180')}
                  >
                    <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
                  </span>
                </span>
              </button>
            </Popover.Anchor>
            <Popover.Portal>
              <Popover.Content
                id={`topnav-menu-${group.id}`}
                align="start"
                side="bottom"
                sideOffset={8}
                collisionPadding={8}
                onCloseAutoFocus={(event) => event.preventDefault()}
                className="z-50 w-[min(300px,calc(100vw-32px))] rounded-[3px] border border-hairline bg-surface p-3 focus:outline-none data-[state=open]:animate-content-in"
              >
                <div className="flex flex-col gap-1" role="menu" aria-label={t(`nav.${group.id}`)}>
                  {group.children.map((child) => {
                    const isItemActive = child.path === pathname;
                    return (
                      <button
                        key={child.path}
                        type="button"
                        role="menuitem"
                        aria-current={isItemActive ? 'page' : undefined}
                        onClick={() => go(child.path)}
                        className={cn(
                          'flex h-12 cursor-pointer items-center rounded-[3px] px-3 text-start text-body font-semibold text-ink transition-colors duration-200 hover:bg-surface-hover outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy',
                          isItemActive && 'bg-surface-hover text-navy',
                        )}
                      >
                        <span className="truncate">{t(`nav.${child.id}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        );
      })}

      {indicator ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 h-[2px] bg-coral"
          style={{
            left: indicator.left,
            right: indicator.right,
            transition:
              'left 300ms cubic-bezier(0.22, 1, 0.36, 1), right 300ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      ) : null}
    </nav>
  );
}