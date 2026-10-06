import { pravatar } from '@/features/dashboard/model';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgramType = 'internal' | 'external' | 'online';
export type ProgramStatus = 'active' | 'scheduled' | 'completed' | 'draft';

export interface TrainingProgram {
  id: string;
  title: string;
  category: string;
  type: ProgramType;
  trainer: string;
  trainerInitials: string;
  trainerPhoto: string;
  startDate: string;
  enrolled: number;
  maxParticipants: number;
  status: ProgramStatus;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const trainingPrograms: TrainingProgram[] = [
  {
    id: 'tp1',
    title: 'Leadership Essentials',
    category: 'Management',
    type: 'internal',
    trainer: 'Layla Mostafa',
    trainerInitials: 'LM',
    trainerPhoto: pravatar(47),
    startDate: 'Oct 5, 2026',
    enrolled: 24,
    maxParticipants: 30,
    status: 'scheduled',
  },
  {
    id: 'tp2',
    title: 'Advanced Excel & Data Analysis',
    category: 'Technical',
    type: 'online',
    trainer: 'External – Coursera',
    trainerInitials: 'EX',
    trainerPhoto: '',
    startDate: 'Oct 1, 2026',
    enrolled: 42,
    maxParticipants: 100,
    status: 'active',
  },
  {
    id: 'tp3',
    title: 'Workplace Safety Certification',
    category: 'Compliance',
    type: 'external',
    trainer: 'SafeWork Institute',
    trainerInitials: 'SW',
    trainerPhoto: '',
    startDate: 'Sep 18, 2026',
    enrolled: 18,
    maxParticipants: 20,
    status: 'active',
  },
  {
    id: 'tp4',
    title: 'Customer Experience Workshop',
    category: 'Sales',
    type: 'internal',
    trainer: 'Ahmed Sami',
    trainerInitials: 'AS',
    trainerPhoto: pravatar(53),
    startDate: 'Oct 12, 2026',
    enrolled: 15,
    maxParticipants: 25,
    status: 'scheduled',
  },
  {
    id: 'tp5',
    title: 'Project Management Professional',
    category: 'Management',
    type: 'external',
    trainer: 'PMI Certified Trainer',
    trainerInitials: 'PM',
    trainerPhoto: '',
    startDate: 'Sep 1, 2026',
    enrolled: 12,
    maxParticipants: 12,
    status: 'completed',
  },
];

export const learningStats = {
  activePrograms: 8,
  enrolled: 156,
  completionRatePct: 78,
  budgetUsedPct: 62,
};

export { pravatar };
