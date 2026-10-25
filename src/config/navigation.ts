import {
  BriefcaseBusiness,
  CalendarCheck,
  ChartColumn,
  Clock,
  CreditCard,
  FileText,
  FolderOpen,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  Network,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** A navigable leaf (a real page). */
export interface NavLeaf {
  /** Translation key suffix: `nav.<id>`. Also the i18n key for its page copy. */
  id: string;
  path: string;
  icon: LucideIcon;
  /** Permission(s) required to view this nav item (A4.4). */
  permission?: string | string[] | undefined;
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
        { id: 'organization', path: '/people/organization', icon: Network, permission: 'organization.department.view' },
        { id: 'employees', path: '/people/employees', icon: Users, permission: 'employee.list.view' },
        { id: 'contracts', path: '/people/contracts', icon: FileText, permission: 'contract.contract.view' },
        { id: 'documents', path: '/people/documents', icon: FolderOpen, permission: 'document.employee_document.view' },
      ],
    },
    {
      id: 'workforce',
      icon: Clock,
      children: [
        { id: 'attendance', path: '/workforce/attendance', icon: Clock, permission: 'attendance.daily_attendance.view' },
        { id: 'leave', path: '/workforce/leave', icon: CalendarCheck, permission: 'leave.request.view' },
      ],
    },
    {
      id: 'finance',
      icon: Wallet,
      children: [
        { id: 'payroll', path: '/finance/payroll', icon: Wallet, permission: 'payroll.run.view' },
        { id: 'compensation', path: '/finance/compensation', icon: TrendingUp, permission: 'payroll.salary_structure.view' },
        { id: 'loans', path: '/finance/loans', icon: CreditCard, permission: 'payroll.loan.view' },
      ],
    },
    {
      id: 'talent',
      icon: Target,
      children: [
        { id: 'recruitment', path: '/talent/recruitment', icon: Handshake, permission: 'recruitment.job_posting.view' },
        { id: 'onboarding', path: '/talent/onboarding', icon: UserPlus, permission: 'onboarding.instance.view' },
        { id: 'performance', path: '/talent/performance', icon: Target, permission: 'performance.review.view' },
        { id: 'learning', path: '/talent/learning', icon: GraduationCap, permission: 'learning.training_program.view' },
        { id: 'career', path: '/talent/career', icon: BriefcaseBusiness, permission: 'career.career_path.view' },
      ],
    },
    {
      id: 'intelligence',
      icon: ChartColumn,
      children: [
        { id: 'analytics', path: '/intelligence/analytics', icon: ChartColumn, permission: 'analytics.dashboard.view' },
        { id: 'copilot', path: '/intelligence/copilot', icon: Sparkles },
      ],
    },
  ],
  pinned: [
    {
      id: 'settings',
      path: '/settings',
      icon: Settings,
      permission: [
        'platform.roles_permissions.view',
        'platform.roles_permissions.manage',
        'users.manage',
        'organization.company.edit',
      ],
    },
  ],
};

/** A leaf together with the group it belongs to (null for top level/pinned items). */
export interface NavEntry {
  id: string;
  path: string;
  icon: LucideIcon;
  groupId: string | null;
  permission?: string | string[] | undefined;
}

export interface NavBreadcrumb {
  group: NavGroup | null;
  leaf: NavEntry;
}

function toEntry(leaf: NavLeaf, groupId: string | null): NavEntry {
  return { id: leaf.id, path: leaf.path, icon: leaf.icon, groupId, permission: leaf.permission };
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
