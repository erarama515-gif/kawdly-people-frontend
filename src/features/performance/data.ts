import { pravatar } from '@/features/dashboard/model';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'submitted' | 'completed';

export interface ReviewCycle {
  name: string;
  status: 'active' | 'closed';
  period: string;
  deadline: string;
  completionPercent: number;
}

export interface EmployeeReview {
  id: string;
  employeeName: string;
  initials: string;
  photo: string;
  department: string;
  selfRating: number | null;
  managerRating: number | null;
  status: ReviewStatus;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const currentCycle: ReviewCycle = {
  name: '2026 Annual Review',
  status: 'active',
  period: 'Jan 2026 — Sep 2026',
  deadline: 'Oct 15, 2026',
  completionPercent: 68,
};

export const employeeReviews: EmployeeReview[] = [
  {
    id: 'r1',
    employeeName: 'Ahmed Sami',
    initials: 'AS',
    photo: pravatar(53),
    department: 'IT',
    selfRating: 4.2,
    managerRating: 4.0,
    status: 'completed',
  },
  {
    id: 'r2',
    employeeName: 'Mona Khaled',
    initials: 'MK',
    photo: pravatar(44),
    department: 'Operations',
    selfRating: 3.8,
    managerRating: 4.1,
    status: 'completed',
  },
  {
    id: 'r3',
    employeeName: 'Salma Adel',
    initials: 'SA',
    photo: pravatar(9),
    department: 'Finance',
    selfRating: 4.5,
    managerRating: null,
    status: 'submitted',
  },
  {
    id: 'r4',
    employeeName: 'Karim Fouad',
    initials: 'KF',
    photo: pravatar(26),
    department: 'IT',
    selfRating: null,
    managerRating: null,
    status: 'pending',
  },
  {
    id: 'r5',
    employeeName: 'Layla Mostafa',
    initials: 'LM',
    photo: pravatar(47),
    department: 'HR',
    selfRating: 3.5,
    managerRating: 3.7,
    status: 'completed',
  },
  {
    id: 'r6',
    employeeName: 'Omar Hassan',
    initials: 'OH',
    photo: pravatar(33),
    department: 'Marketing',
    selfRating: null,
    managerRating: null,
    status: 'pending',
  },
];

export const performanceStats = {
  activeCycle: 1,
  reviewsCompletedPct: 68,
  pendingReviews: 42,
  avgRating: 3.8,
};

export { pravatar };
