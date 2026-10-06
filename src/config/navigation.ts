import { ChartColumn, Clock, LayoutDashboard, Settings, Target, Users, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** A navigable leaf (a real page). */
export interface NavLeaf {
  /** Translation key suffix: `nav.<id>`. Also the i18n key for its page copy. */
  id: string;
  path: string;
  icon: LucideIcon;
}

/** A collapsible group of leaves. Groups have no route of their own. */
export interface NavGroup {
  id: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

export interface NavigationConfig {
  /** Top level items rendered above the groups. */
  primary: NavLeaf[];
  /** Accordion groups, in order. */
  groups: NavGroup[];
  /** Items pinned to the bottom of the sidebar. */
  pinned: NavLeaf[];
}

export const navigation: NavigationConfig = {
  primary: [
    { id: 'dashboard', path: '/', icon: LayoutDashboard },
  ],
  groups: [
    {
      id: 'people',
      icon: Users,
      children: [
        { id: 'organization', path: '/people/organization', icon: Users },
        { id: 'employees', path: '/people/employees', icon: Users },
        { id: 'contracts', path: '/people/contracts', icon: Users },
        { id: 'documents', path: '/people/documents', icon: Users },
      ],
    },
    {
      id: 'workforce',
      icon: Clock,
      children: [
        { id: 'attendance', path: '/workforce/attendance', icon: Clock },
        { id: 'leave', path: '/workforce/leave', icon: Clock },
      ],
    },
    {
      id: 'finance',
      icon: Wallet,
      children: [
        { id: 'payroll', path: '/finance/payroll', icon: Wallet },
        { id: 'compensation', path: '/finance/compensation', icon: Wallet },
        { id: 'loans', path: '/finance/loans', icon: Wallet },
      ],
    },
    {
      id: 'talent',
      icon: Target,
      children: [
        { id: 'recruitment', path: '/talent/recruitment', icon: Target },
        { id: 'onboarding', path: '/talent/onboarding', icon: Target },
        { id: 'performance', path: '/talent/performance', icon: Target },
        { id: 'learning', path: '/talent/learning', icon: Target },
        { id: 'career', path: '/talent/career', icon: Target },
      ],
    },
    {
      id: 'intelligence',
      icon: ChartColumn,
      children: [
        { id: 'analytics', path: '/intelligence/analytics', icon: ChartColumn },
        { id: 'copilot', path: '/intelligence/copilot', icon: ChartColumn },
      ],
    },
  ],
  pinned: [{ id: 'settings', path: '/settings', icon: Settings }],
};

/** A leaf together with the group it belongs to (null for top level/pinned items). */
export interface NavEntry {
  id: string;
  path: string;
  icon: LucideIcon;
  groupId: string | null;
}

export interface NavBreadcrumb {
  group: NavGroup | null;
  leaf: NavEntry;
}

function toEntry(leaf: NavLeaf, groupId: string | null): NavEntry {
  return { id: leaf.id, path: leaf.path, icon: leaf.icon, groupId };
}

/** Every routable page, in navigation order. Used by routes, breadcrumbs and the command palette. */
export function getNavEntries(config: NavigationConfig = navigation): NavEntry[] {
  return [
    ...config.primary.map((leaf) => toEntry(leaf, null)),
    ...config.groups.flatMap((group) => group.children.map((leaf) => toEntry(leaf, group.id))),
    ...config.pinned.map((leaf) => toEntry(leaf, null)),
  ];
}

export function findEntryByPath(pathname: string, config: NavigationConfig = navigation): NavEntry | undefined {
  return getNavEntries(config).find((entry) => entry.path === pathname);
}

export function findGroupById(groupId: string, config: NavigationConfig = navigation): NavGroup | undefined {
  return config.groups.find((group) => group.id === groupId);
}

/** Path of a nav item by id — keeps callers free of hard coded route strings. */
export function pathById(id: string, config: NavigationConfig = navigation): string {
  const entry = getNavEntries(config).find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`Unknown navigation id: ${id}`);
  }
  return entry.path;
}

/** Group + leaf for the given path, used by the breadcrumb. */
export function findBreadcrumb(pathname: string, config: NavigationConfig = navigation): NavBreadcrumb | null {
  const leaf = findEntryByPath(pathname, config);
  if (!leaf) return null;
  const group = leaf.groupId ? findGroupById(leaf.groupId, config) ?? null : null;
  return { group, leaf };
}
