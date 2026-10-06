import { pravatar } from '@/features/dashboard/model';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContractType = 'initial' | 'renewal';
export type ContractStatus = 'active' | 'expiring_soon' | 'expired' | 'draft';

export interface Contract {
  id: string;
  employeeName: string;
  employeeNameAr: string;
  employeePhoto: string;
  employeeInitials: string;
  employeePosition: string;
  type: ContractType;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  daysUntilExpiry: number | null;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

export const contracts: Contract[] = [
  {
    id: 'ct1',
    employeeName: 'Ahmed Sami',
    employeeNameAr: 'أحمد سامي',
    employeePhoto: pravatar(53),
    employeeInitials: 'AS',
    employeePosition: 'Senior Developer',
    type: 'renewal',
    startDate: '2024-01-01',
    endDate: '2026-12-31',
    status: 'active',
    daysUntilExpiry: 457,
  },
  {
    id: 'ct2',
    employeeName: 'Mona Khaled',
    employeeNameAr: 'منى خالد',
    employeePhoto: pravatar(44),
    employeeInitials: 'MK',
    employeePosition: 'UX Designer',
    type: 'initial',
    startDate: '2025-09-01',
    endDate: '2025-10-14',
    status: 'expiring_soon',
    daysUntilExpiry: 14,
  },
  {
    id: 'ct3',
    employeeName: 'Salma Adel',
    employeeNameAr: 'سلمى عادل',
    employeePhoto: pravatar(9),
    employeeInitials: 'SA',
    employeePosition: 'Financial Analyst',
    type: 'renewal',
    startDate: '2025-07-01',
    endDate: '2025-09-28',
    status: 'expiring_soon',
    daysUntilExpiry: 3,
  },
  {
    id: 'ct4',
    employeeName: 'Karim Fouad',
    employeeNameAr: 'كريم فؤاد',
    employeePhoto: pravatar(26),
    employeeInitials: 'KF',
    employeePosition: 'DevOps Engineer',
    type: 'initial',
    startDate: '2022-01-20',
    endDate: '2025-08-20',
    status: 'expired',
    daysUntilExpiry: null,
  },
  {
    id: 'ct5',
    employeeName: 'Layla Mostafa',
    employeeNameAr: 'ليلى مصطفى',
    employeePhoto: pravatar(47),
    employeeInitials: 'LM',
    employeePosition: 'HR Specialist',
    type: 'renewal',
    startDate: '2025-10-01',
    endDate: '2027-09-30',
    status: 'draft',
    daysUntilExpiry: null,
  },
  {
    id: 'ct6',
    employeeName: 'Omar Hassan',
    employeeNameAr: 'عمر حسن',
    employeePhoto: pravatar(33),
    employeeInitials: 'OH',
    employeePosition: 'Sales Executive',
    type: 'initial',
    startDate: '2024-06-01',
    endDate: '2026-05-31',
    status: 'active',
    daysUntilExpiry: 243,
  },
];

// ─── Summary stats ─────────────────────────────────────────────────────────────

export const contractStats = {
  active: 1108,
  expiringSoon: 23,
  expired: 8,
  draft: 4,
};

// ─── Label / style maps ────────────────────────────────────────────────────────

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  initial: 'Initial',
  renewal: 'Renewal',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: 'Active',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  draft: 'Draft',
};

export const CONTRACT_STATUS_CLASSES: Record<ContractStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  expiring_soon: 'bg-orange-50 text-orange-700',
  expired: 'bg-red-50 text-red-700',
  draft: 'bg-gray-100 text-gray-600',
};
