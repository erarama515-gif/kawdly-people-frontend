import { pravatar } from '@/features/dashboard/model';

export type PayrollRunStatus = 'draft' | 'calculated' | 'reviewed' | 'approved' | 'paid';
export type PayslipStatus = 'pending' | 'processed' | 'paid';

export interface PayrollRun {
  id: string;
  month: string;
  year: number;
  status: PayrollRunStatus;
  totalGross: number;
  totalNet: number;
  employeeCount: number;
}

export interface PayslipSummary {
  id: string;
  employeeName: string;
  initials: string;
  photo?: string;
  department: string;
  basicSalary: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  status: PayslipStatus;
}

export const currentPayrollRun: PayrollRun = {
  id: 'pr-sep-2026',
  month: 'September',
  year: 2026,
  status: 'reviewed',
  totalGross: 14_800_000,
  totalNet: 12_100_000,
  employeeCount: 1284,
};

export const payrollRuns: PayrollRun[] = [
  currentPayrollRun,
  {
    id: 'pr-aug-2026',
    month: 'August',
    year: 2026,
    status: 'paid',
    totalGross: 14_350_000,
    totalNet: 11_740_000,
    employeeCount: 1271,
  },
  {
    id: 'pr-jul-2026',
    month: 'July',
    year: 2026,
    status: 'paid',
    totalGross: 14_010_000,
    totalNet: 11_440_000,
    employeeCount: 1258,
  },
];

export const recentPayslips: PayslipSummary[] = [
  {
    id: 'ps1',
    employeeName: 'Ahmed Sami',
    initials: 'AS',
    photo: pravatar(53),
    department: 'IT',
    basicSalary: 12_000,
    grossSalary: 14_500,
    deductions: 2_100,
    netSalary: 12_400,
    status: 'processed',
  },
  {
    id: 'ps2',
    employeeName: 'Mona Khaled',
    initials: 'MK',
    photo: pravatar(44),
    department: 'HR',
    basicSalary: 9_500,
    grossSalary: 11_200,
    deductions: 1_680,
    netSalary: 9_520,
    status: 'processed',
  },
  {
    id: 'ps3',
    employeeName: 'Karim Fouad',
    initials: 'KF',
    photo: pravatar(26),
    department: 'Finance',
    basicSalary: 10_800,
    grossSalary: 13_100,
    deductions: 1_965,
    netSalary: 11_135,
    status: 'pending',
  },
  {
    id: 'ps4',
    employeeName: 'Omar Hassan',
    initials: 'OH',
    photo: pravatar(33),
    department: 'Operations',
    basicSalary: 8_200,
    grossSalary: 9_800,
    deductions: 1_470,
    netSalary: 8_330,
    status: 'processed',
  },
  {
    id: 'ps5',
    employeeName: 'Layla Mostafa',
    initials: 'LM',
    photo: pravatar(47),
    department: 'Marketing',
    basicSalary: 7_600,
    grossSalary: 9_100,
    deductions: 1_365,
    netSalary: 7_735,
    status: 'pending',
  },
  {
    id: 'ps6',
    employeeName: 'Tamer Zakaria',
    initials: 'TZ',
    photo: pravatar(13),
    department: 'Admin',
    basicSalary: 6_800,
    grossSalary: 8_200,
    deductions: 1_230,
    netSalary: 6_970,
    status: 'processed',
  },
];

export const payrollStats = {
  totalPayroll: '14.8M',
  netPaid: '12.1M',
  employees: 1284,
  pendingRuns: 1,
};

export const PIPELINE_STEPS: PayrollRunStatus[] = ['draft', 'calculated', 'reviewed', 'approved', 'paid'];
