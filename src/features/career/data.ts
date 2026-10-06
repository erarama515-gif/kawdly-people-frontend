import { pravatar } from '@/features/dashboard/model';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Readiness = 'Ready Now' | '1-2 Years' | '3+ Years';

export interface CareerPath {
  id: string;
  name: string;
  jobFamily: string;
  levelsCount: number;
  description: string;
}

export interface Successor {
  name: string;
  initials: string;
  photo: string;
  readiness: Readiness;
  score: number;
}

export interface SuccessionPlan {
  id: string;
  position: string;
  department: string;
  currentHolder: string;
  currentHolderInitials: string;
  currentHolderPhoto: string;
  successors: Successor[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const careerPaths: CareerPath[] = [
  {
    id: 'cp1',
    name: 'Software Engineering',
    jobFamily: 'Technology',
    levelsCount: 6,
    description: 'Junior → Mid → Senior → Staff → Principal → VP Engineering',
  },
  {
    id: 'cp2',
    name: 'Sales & Business Development',
    jobFamily: 'Commercial',
    levelsCount: 5,
    description: 'Sales Rep → Executive → Senior Executive → Manager → Director',
  },
  {
    id: 'cp3',
    name: 'Finance & Accounting',
    jobFamily: 'Finance',
    levelsCount: 5,
    description: 'Analyst → Senior Analyst → Controller → Manager → CFO',
  },
  {
    id: 'cp4',
    name: 'People & HR',
    jobFamily: 'Human Resources',
    levelsCount: 4,
    description: 'HR Coordinator → Specialist → Business Partner → CHRO',
  },
];

export const successionPlans: SuccessionPlan[] = [
  {
    id: 'sp1',
    position: 'VP Engineering',
    department: 'IT',
    currentHolder: 'Ahmed Sami',
    currentHolderInitials: 'AS',
    currentHolderPhoto: pravatar(53),
    successors: [
      { name: 'Karim Fouad', initials: 'KF', photo: pravatar(26), readiness: 'Ready Now', score: 92 },
      { name: 'Nadia Fahmy', initials: 'NF', photo: pravatar(21), readiness: '1-2 Years', score: 78 },
    ],
  },
  {
    id: 'sp2',
    position: 'Chief Financial Officer',
    department: 'Finance',
    currentHolder: 'Salma Adel',
    currentHolderInitials: 'SA',
    currentHolderPhoto: pravatar(9),
    successors: [
      { name: 'Tamer Zakaria', initials: 'TZ', photo: pravatar(13), readiness: '1-2 Years', score: 84 },
    ],
  },
  {
    id: 'sp3',
    position: 'Head of Marketing',
    department: 'Marketing',
    currentHolder: 'Omar Hassan',
    currentHolderInitials: 'OH',
    currentHolderPhoto: pravatar(33),
    successors: [
      { name: 'Rania Fawzi', initials: 'RF', photo: pravatar(47), readiness: 'Ready Now', score: 88 },
      { name: 'Lina Samir', initials: 'LS', photo: pravatar(60), readiness: '3+ Years', score: 65 },
    ],
  },
];

export const careerStats = {
  careerPaths: 4,
  successionPlans: 12,
  readyNow: 8,
};

export { pravatar };
