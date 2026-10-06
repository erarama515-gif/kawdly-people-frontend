import { pravatar } from '@/features/dashboard/model';

export type LoanType   = 'loan' | 'advance';
export type LoanStatus = 'active' | 'completed' | 'pending' | 'defaulted';

export interface LoanRecord {
  id: string;
  employeeName: string;
  initials: string;
  photo?: string;
  department: string;
  type: LoanType;
  amount: number;
  installment: number;
  paidInstallments: number;
  totalInstallments: number;
  status: LoanStatus;
  startDate: string;
}

export const loanRecords: LoanRecord[] = [
  {
    id: 'ln1',
    employeeName: 'Ahmed Sami',
    initials: 'AS',
    photo: pravatar(53),
    department: 'IT',
    type: 'loan',
    amount: 50_000,
    installment: 2_500,
    paidInstallments: 12,
    totalInstallments: 24,
    status: 'active',
    startDate: 'Oct 2025',
  },
  {
    id: 'ln2',
    employeeName: 'Mona Khaled',
    initials: 'MK',
    photo: pravatar(44),
    department: 'HR',
    type: 'advance',
    amount: 8_000,
    installment: 2_000,
    paidInstallments: 3,
    totalInstallments: 4,
    status: 'active',
    startDate: 'Jul 2026',
  },
  {
    id: 'ln3',
    employeeName: 'Karim Fouad',
    initials: 'KF',
    photo: pravatar(26),
    department: 'Finance',
    type: 'loan',
    amount: 30_000,
    installment: 1_500,
    paidInstallments: 20,
    totalInstallments: 20,
    status: 'completed',
    startDate: 'Feb 2025',
  },
  {
    id: 'ln4',
    employeeName: 'Omar Hassan',
    initials: 'OH',
    photo: pravatar(33),
    department: 'Operations',
    type: 'loan',
    amount: 75_000,
    installment: 3_125,
    paidInstallments: 2,
    totalInstallments: 36,
    status: 'pending',
    startDate: 'Oct 2026',
  },
  {
    id: 'ln5',
    employeeName: 'Layla Mostafa',
    initials: 'LM',
    photo: pravatar(47),
    department: 'Marketing',
    type: 'advance',
    amount: 5_000,
    installment: 2_500,
    paidInstallments: 1,
    totalInstallments: 2,
    status: 'active',
    startDate: 'Sep 2026',
  },
];

export const loanStats = {
  activeLoans: 42,
  totalDisbursed: '1.2M',
  monthlyCollection: '89K',
  pendingRequests: 3,
};
