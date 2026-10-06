import { pravatar } from '@/features/dashboard/model';

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = 'open' | 'closed' | 'draft';

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  applicants: number;
  status: JobStatus;
  postedDate: string;
}

export interface PipelineStage {
  label: string;
  count: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const jobPostings: JobPosting[] = [
  {
    id: 'j1',
    title: 'Senior Software Engineer',
    department: 'IT',
    applicants: 84,
    status: 'open',
    postedDate: 'Sep 10, 2026',
  },
  {
    id: 'j2',
    title: 'Product Manager',
    department: 'Operations',
    applicants: 47,
    status: 'open',
    postedDate: 'Sep 14, 2026',
  },
  {
    id: 'j3',
    title: 'Financial Analyst',
    department: 'Finance',
    applicants: 61,
    status: 'open',
    postedDate: 'Sep 2, 2026',
  },
  {
    id: 'j4',
    title: 'UX Designer',
    department: 'Marketing',
    applicants: 38,
    status: 'closed',
    postedDate: 'Aug 18, 2026',
  },
  {
    id: 'j5',
    title: 'HR Business Partner',
    department: 'HR',
    applicants: 0,
    status: 'draft',
    postedDate: '—',
  },
];

export const pipelineStages: PipelineStage[] = [
  { label: 'Applied', count: 124 },
  { label: 'Screening', count: 38 },
  { label: 'Interview', count: 22 },
  { label: 'Offer', count: 8 },
];

export const recruitmentStats = {
  openPositions: 73,
  totalApplicants: 892,
  inInterview: 22,
  offersSent: 8,
};

export { pravatar };
