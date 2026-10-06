import { pravatar } from '@/features/dashboard/model';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStatus = 'in_progress' | 'completed' | 'overdue';

export interface OnboardingInstance {
  id: string;
  employeeName: string;
  initials: string;
  photo: string;
  department: string;
  startDate: string;
  progress: number;
  tasksCompleted: number;
  totalTasks: number;
  status: OnboardingStatus;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const onboardingInstances: OnboardingInstance[] = [
  {
    id: 'ob1',
    employeeName: 'Lina Samir',
    initials: 'LS',
    photo: pravatar(47),
    department: 'IT',
    startDate: 'Sep 22, 2026',
    progress: 65,
    tasksCompleted: 13,
    totalTasks: 20,
    status: 'in_progress',
  },
  {
    id: 'ob2',
    employeeName: 'Hassan Gouda',
    initials: 'HG',
    photo: pravatar(13),
    department: 'Finance',
    startDate: 'Sep 29, 2026',
    progress: 30,
    tasksCompleted: 6,
    totalTasks: 20,
    status: 'in_progress',
  },
  {
    id: 'ob3',
    employeeName: 'Rania Fawzi',
    initials: 'RF',
    photo: pravatar(9),
    department: 'Marketing',
    startDate: 'Sep 15, 2026',
    progress: 90,
    tasksCompleted: 18,
    totalTasks: 20,
    status: 'in_progress',
  },
  {
    id: 'ob4',
    employeeName: 'Tarek Mansour',
    initials: 'TM',
    photo: pravatar(33),
    department: 'Sales',
    startDate: 'Sep 8, 2026',
    progress: 45,
    tasksCompleted: 9,
    totalTasks: 20,
    status: 'overdue',
  },
];

export const onboardingStats = {
  inProgress: 6,
  completedThisMonth: 4,
  overdueTasks: 2,
};

export { pravatar };
