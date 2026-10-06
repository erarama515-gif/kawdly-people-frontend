import { pathById } from '@/config/navigation';
import type { Role } from '@/auth/session';

export type { Role };

/**
 * Typed domain models for the dashboard. All components consume these shapes;
 * the wire API decodes into them so nothing else ever touches a "raw" backend
 * response. When Laravel lands, only the API adapter and its decoders change.
 */

export interface LocaleText {
  ar: string;
  en: string;
}

export function resolveLocaleText(text: LocaleText, language: 'ar' | 'en'): string {
  return language === 'ar' ? text.ar : text.en;
}

export type QueueId = 'leave' | 'payroll' | 'contracts' | 'leaveFromTeam' | 'performanceReview';
export type QueueKind = 'people' | 'company';

/**
 * Where each queue row's work actually lives, so "View all" sends the reviewer
 * to the queue they were just looking at instead of a hardcoded leave list.
 */
export const QUEUE_DESTINATIONS: Record<QueueId, string> = {
  leave: pathById('leave'),
  payroll: pathById('payroll'),
  contracts: pathById('contracts'),
  leaveFromTeam: pathById('leave'),
  performanceReview: pathById('performance'),
};

export interface PersonAvatar {
  initials: LocaleText;
  photo?: string;
}

export const pravatar = (img: number, size = 100) => `https://i.pravatar.cc/${size}?img=${img}`;

export interface DecisionQueueRow {
  id: QueueId;
  kind: QueueKind;
  captionKey: string;
  descriptionKey: string;
  descriptionParams?: Record<string, string | number>;
  actionKey: string;
  count: number;
  sample?: PersonAvatar[];
  overflowCount?: number;
  urgent?: boolean;
  priority: 'primary' | 'secondary';
}

export interface Kpi {
  id: string;
  captionKey: string;
  value: number;
  suffix?: string;
  deltaKey: string;
  deltaSuffixKey?: string;
  up: boolean;
  trend: number[];
  /** Target page when the number is a gateway link. */
  path: string;
}

export interface AttendanceSummary {
  today: number;
  weekTrend: number[];
  weekLabels: LocaleText[];
  totalEmployees: number;
  present: number;
  absent: number;
  late: number;
}

export type UpcomingKind = 'contract' | 'birthday';

export interface UpcomingItem {
  id: string;
  kind: UpcomingKind;
  name: LocaleText;
  meta: LocaleText;
  when: LocaleText;
  photo?: string;
  urgent?: boolean;
}

export interface DepartmentShare {
  name: LocaleText;
  count: number;
}

export type TeamMemberStatus = 'active' | 'leave';

export interface TeamMember {
  name: LocaleText;
  title: LocaleText;
  status: TeamMemberStatus;
  photo?: string;
}

export interface DashboardDataset {
  queues: DecisionQueueRow[];
  kpis: Kpi[];
  departments: DepartmentShare[];
  teamRoster: TeamMember[];
  updatedAt: string;
  attendance: AttendanceSummary;
  upcoming: UpcomingItem[];
}

export const leave: DecisionQueueRow = {
  id: 'leave',
  kind: 'people',
  captionKey: 'dashboard.queue.leave.caption',
  descriptionKey: 'dashboard.queue.leave.description',
  actionKey: 'dashboard.queue.leave.action',
  count: 17,
  sample: [
    { initials: { ar: 'أح', en: 'Ah' }, photo: pravatar(5) },
    { initials: { ar: 'من', en: 'Mo' }, photo: pravatar(32) },
    { initials: { ar: 'سل', en: 'Sa' }, photo: pravatar(15) },
  ],
  overflowCount: 14,
  priority: 'secondary',
};

export const payroll: DecisionQueueRow = {
  id: 'payroll',
  kind: 'company',
  captionKey: 'dashboard.queue.payroll.caption',
  descriptionKey: 'dashboard.queue.payroll.description',
  descriptionParams: { total: '14.8', employees: 214 },
  actionKey: 'dashboard.queue.payroll.action',
  count: 1,
  priority: 'primary',
};

export const contracts: DecisionQueueRow = {
  id: 'contracts',
  kind: 'people',
  captionKey: 'dashboard.queue.contracts.caption',
  descriptionKey: 'dashboard.queue.contracts.description',
  actionKey: 'dashboard.queue.contracts.action',
  count: 4,
  sample: [
    { initials: { ar: 'أس', en: 'As' }, photo: pravatar(44) },
    { initials: { ar: 'مر', en: 'Ma' }, photo: pravatar(26) },
    { initials: { ar: 'كر', en: 'Ka' }, photo: pravatar(60) },
  ],
  overflowCount: 1,
  urgent: true,
  priority: 'secondary',
};

export const leaveFromTeam: DecisionQueueRow = {
  id: 'leaveFromTeam',
  kind: 'people',
  captionKey: 'dashboard.queue.leaveFromTeam.caption',
  descriptionKey: 'dashboard.queue.leaveFromTeam.description',
  actionKey: 'dashboard.queue.leaveFromTeam.action',
  count: 3,
  sample: [
    { initials: { ar: 'من', en: 'Mo' }, photo: pravatar(15) },
    { initials: { ar: 'سا', en: 'Sa' }, photo: pravatar(32) },
    { initials: { ar: 'هـ', en: 'Hi' }, photo: pravatar(26) },
  ],
  priority: 'primary',
};

export const performanceReview: DecisionQueueRow = {
  id: 'performanceReview',
  kind: 'people',
  captionKey: 'dashboard.queue.performanceReview.caption',
  descriptionKey: 'dashboard.queue.performanceReview.description',
  actionKey: 'dashboard.queue.performanceReview.action',
  count: 1,
  sample: [{ initials: { ar: 'صل', en: 'Sa' }, photo: pravatar(60) }],
  priority: 'secondary',
};

export const adminKpis: Kpi[] = [
  {
    id: 'employees',
    captionKey: 'dashboard.kpi.employees.caption',
    value: 1284,
    deltaKey: 'dashboard.kpi.employees.delta',
    deltaSuffixKey: 'dashboard.kpi.employees.deltaSuffix',
    up: true,
    trend: [1190, 1205, 1221, 1240, 1252, 1268, 1284],
    path: pathById('employees'),
  },
  {
    id: 'attendanceToday',
    captionKey: 'dashboard.kpi.attendanceToday.caption',
    value: 96.2,
    suffix: '%',
    deltaKey: 'dashboard.kpi.attendanceToday.delta',
    deltaSuffixKey: 'dashboard.kpi.attendanceToday.deltaSuffix',
    up: false,
    trend: [97.8, 97.1, 96.9, 97.4, 96.6, 96.9, 96.2],
    path: pathById('attendance'),
  },
  {
    id: 'payrollCostMTD',
    captionKey: 'dashboard.kpi.payrollCostMTD.caption',
    value: 14.8,
    suffix: 'M',
    deltaKey: 'dashboard.kpi.payrollCostMTD.delta',
    deltaSuffixKey: 'dashboard.kpi.payrollCostMTD.deltaSuffix',
    up: true,
    trend: [12.1, 12.6, 13.0, 13.4, 13.9, 14.3, 14.8],
    path: pathById('payroll'),
  },
  {
    id: 'openPositions',
    captionKey: 'dashboard.kpi.openPositions.caption',
    value: 73,
    deltaKey: 'dashboard.kpi.openPositions.delta',
    deltaSuffixKey: 'dashboard.kpi.openPositions.deltaSuffix',
    up: true,
    trend: [58, 61, 63, 65, 68, 70, 73],
    path: pathById('recruitment'),
  },
];

export const managerKpis: Kpi[] = [
  {
    id: 'teamMembers',
    captionKey: 'dashboard.kpi.teamMembers.caption',
    value: 12,
    deltaKey: 'dashboard.kpi.teamMembers.delta',
    deltaSuffixKey: 'dashboard.kpi.teamMembers.deltaSuffix',
    up: true,
    trend: [9, 9, 10, 10, 11, 11, 12],
    path: pathById('attendance'),
  },
  {
    id: 'teamAttendanceToday',
    captionKey: 'dashboard.kpi.teamAttendanceToday.caption',
    value: 91.7,
    suffix: '%',
    deltaKey: 'dashboard.kpi.teamAttendanceToday.delta',
    deltaSuffixKey: 'dashboard.kpi.teamAttendanceToday.deltaSuffix',
    up: true,
    trend: [89, 90, 88, 91, 90, 92, 91.7],
    path: pathById('attendance'),
  },
  {
    id: 'pendingLeave',
    captionKey: 'dashboard.kpi.pendingLeave.caption',
    value: 3,
    deltaKey: 'dashboard.kpi.pendingLeave.delta',
    up: true,
    trend: [3, 3, 4, 3, 3, 3, 3],
    path: pathById('leave'),
  },
  {
    id: 'reviewsDue',
    captionKey: 'dashboard.kpi.reviewsDue.caption',
    value: 1,
    deltaKey: 'dashboard.kpi.reviewsDue.delta',
    up: true,
    trend: [0, 0, 1, 1, 1, 1, 1],
    path: pathById('performance'),
  },
];

export const sharedAttendance: AttendanceSummary = {
  today: 96.2,
  weekTrend: [94, 95, 93, 97, 96, 95, 96.2],
  weekLabels: [
    { ar: 'س', en: 'Sa' },
    { ar: 'ح', en: 'Su' },
    { ar: 'ن', en: 'Mo' },
    { ar: 'ث', en: 'Tu' },
    { ar: 'ر', en: 'We' },
    { ar: 'خ', en: 'Th' },
    { ar: 'ج', en: 'Fr' },
  ],
  totalEmployees: 1284,
  present: 1236,
  absent: 17,
  late: 23,
};

export const sharedUpcoming: UpcomingItem[] = [
  {
    id: 'contract1',
    kind: 'contract',
    name: { ar: 'أحمد سامي', en: 'Ahmed Sami' },
    meta: { ar: 'ينتهي العقد 3 أكتوبر', en: 'Contract ends 3 Oct' },
    when: { ar: 'خلال 3 أيام', en: 'in 3 days' },
    photo: pravatar(53),
    urgent: true,
  },
  {
    id: 'contract2',
    kind: 'contract',
    name: { ar: 'مروة حسن', en: 'Marwa Hassan' },
    meta: { ar: 'ينتهي العقد 6 أكتوبر', en: 'Contract ends 6 Oct' },
    when: { ar: 'خلال 6 أيام', en: 'in 6 days' },
    photo: pravatar(9),
  },
  {
    id: 'birthday1',
    kind: 'birthday',
    name: { ar: 'يوسف طارق', en: 'Youssef Tarek' },
    meta: { ar: 'عيد ميلاد', en: 'Birthday' },
    when: { ar: 'غدًا', en: 'tomorrow' },
    photo: pravatar(68),
  },
];

const nowIso = new Date().toISOString();

export function createDataset(role: Role): DashboardDataset {
  if (role === 'manager') {
    return {
      queues: [leaveFromTeam, performanceReview],
      kpis: managerKpis,
      departments: [],
      teamRoster: [
        { name: { ar: 'أحمد سامي', en: 'Ahmed Sami' }, title: { ar: 'مطوّر أول', en: 'Senior Developer' }, status: 'active', photo: pravatar(53) },
        { name: { ar: 'منى خالد', en: 'Mona Khaled' }, title: { ar: 'مصممة UX', en: 'UX Designer' }, status: 'active', photo: pravatar(44) },
        { name: { ar: 'سلمى عادل', en: 'Salma Adel' }, title: { ar: 'في إجازة', en: 'On leave' }, status: 'leave', photo: pravatar(9) },
        { name: { ar: 'كريم فؤاد', en: 'Karim Fouad' }, title: { ar: 'مطوّر', en: 'Developer' }, status: 'active', photo: pravatar(26) },
      ],
      updatedAt: nowIso,
      attendance: sharedAttendance,
      upcoming: sharedUpcoming,
    };
  }

  return {
    queues: [leave, payroll, contracts],
    kpis: adminKpis,
    departments: [
      { name: { ar: 'المبيعات', en: 'Sales' }, count: 312 },
      { name: { ar: 'العمليات', en: 'Operations' }, count: 268 },
      { name: { ar: 'تقنية المعلومات', en: 'IT' }, count: 191 },
      { name: { ar: 'المالية', en: 'Finance' }, count: 97 },
    ],
    teamRoster: [
      { name: { ar: 'أحمد سامي', en: 'Ahmed Sami' }, title: { ar: 'مطوّر أول', en: 'Senior Developer' }, status: 'active', photo: pravatar(53) },
      { name: { ar: 'منى خالد', en: 'Mona Khaled' }, title: { ar: 'مصممة UX', en: 'UX Designer' }, status: 'active', photo: pravatar(44) },
      { name: { ar: 'سلمى عادل', en: 'Salma Adel' }, title: { ar: 'في إجازة', en: 'On leave' }, status: 'leave', photo: pravatar(9) },
      { name: { ar: 'كريم فؤاد', en: 'Karim Fouad' }, title: { ar: 'مطوّر', en: 'Developer' }, status: 'active', photo: pravatar(26) },
    ],
    updatedAt: nowIso,
    attendance: sharedAttendance,
    upcoming: sharedUpcoming,
  };
}
