import { pravatar } from '@/features/dashboard/model';

export type { LocaleText } from '@/features/dashboard/model';

// ─── Companies ────────────────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  nameAr: string;
  registrationNumber: string;
  country: string;
  foundedYear: number;
  status: 'active' | 'inactive';
}

export const companies: Company[] = [
  {
    id: 'c1',
    name: 'Kawdly Tech',
    nameAr: 'كودلي تك',
    registrationNumber: 'CR-2018-00412',
    country: 'Egypt',
    foundedYear: 2018,
    status: 'active',
  },
];

// ─── Branches ─────────────────────────────────────────────────────────────────

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  nameAr: string;
  city: string;
  country: string;
  headCount: number;
  isHeadquarters: boolean;
}

export const branches: Branch[] = [
  {
    id: 'b1',
    companyId: 'c1',
    name: 'Cairo HQ',
    nameAr: 'القاهرة - المقر الرئيسي',
    city: 'Cairo',
    country: 'Egypt',
    headCount: 812,
    isHeadquarters: true,
  },
  {
    id: 'b2',
    companyId: 'c1',
    name: 'Riyadh',
    nameAr: 'الرياض',
    city: 'Riyadh',
    country: 'Saudi Arabia',
    headCount: 309,
    isHeadquarters: false,
  },
  {
    id: 'b3',
    companyId: 'c1',
    name: 'Dubai',
    nameAr: 'دبي',
    city: 'Dubai',
    country: 'UAE',
    headCount: 163,
    isHeadquarters: false,
  },
];

// ─── Departments ──────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  nameAr: string;
  headName: string;
  headPhoto: string;
  headInitials: string;
  employeeCount: number;
  positionCount: number;
  status: 'active' | 'inactive';
}

export const departments: Department[] = [
  {
    id: 'd1',
    name: 'Sales',
    nameAr: 'المبيعات',
    headName: 'Ahmed Sami',
    headPhoto: pravatar(53),
    headInitials: 'AS',
    employeeCount: 312,
    positionCount: 8,
    status: 'active',
  },
  {
    id: 'd2',
    name: 'Operations',
    nameAr: 'العمليات',
    headName: 'Mona Khaled',
    headPhoto: pravatar(44),
    headInitials: 'MK',
    employeeCount: 268,
    positionCount: 6,
    status: 'active',
  },
  {
    id: 'd3',
    name: 'IT',
    nameAr: 'تقنية المعلومات',
    headName: 'Karim Fouad',
    headPhoto: pravatar(26),
    headInitials: 'KF',
    employeeCount: 191,
    positionCount: 7,
    status: 'active',
  },
  {
    id: 'd4',
    name: 'Finance',
    nameAr: 'المالية',
    headName: 'Salma Adel',
    headPhoto: pravatar(9),
    headInitials: 'SA',
    employeeCount: 97,
    positionCount: 5,
    status: 'active',
  },
  {
    id: 'd5',
    name: 'HR',
    nameAr: 'الموارد البشرية',
    headName: 'Layla Mostafa',
    headPhoto: pravatar(47),
    headInitials: 'LM',
    employeeCount: 84,
    positionCount: 4,
    status: 'active',
  },
  {
    id: 'd6',
    name: 'Marketing',
    nameAr: 'التسويق',
    headName: 'Omar Hassan',
    headPhoto: pravatar(33),
    headInitials: 'OH',
    employeeCount: 76,
    positionCount: 5,
    status: 'active',
  },
  {
    id: 'd7',
    name: 'Legal',
    nameAr: 'الشؤون القانونية',
    headName: 'Nadia Fahmy',
    headPhoto: pravatar(21),
    headInitials: 'NF',
    employeeCount: 42,
    positionCount: 3,
    status: 'active',
  },
  {
    id: 'd8',
    name: 'Admin',
    nameAr: 'الإدارة',
    headName: 'Tamer Zakaria',
    headPhoto: pravatar(13),
    headInitials: 'TZ',
    employeeCount: 38,
    positionCount: 3,
    status: 'active',
  },
];

// ─── Job Positions ────────────────────────────────────────────────────────────

export interface JobPosition {
  id: string;
  departmentId: string;
  title: string;
  titleAr: string;
  openings: number;
  filled: number;
}

export const jobPositions: JobPosition[] = [
  { id: 'p1', departmentId: 'd1', title: 'Sales Executive', titleAr: 'مسؤول مبيعات', openings: 12, filled: 10 },
  { id: 'p2', departmentId: 'd1', title: 'Sales Manager', titleAr: 'مدير مبيعات', openings: 5, filled: 5 },
  { id: 'p3', departmentId: 'd3', title: 'Senior Developer', titleAr: 'مطوّر أول', openings: 8, filled: 7 },
  { id: 'p4', departmentId: 'd3', title: 'DevOps Engineer', titleAr: 'مهندس DevOps', openings: 3, filled: 2 },
  { id: 'p5', departmentId: 'd4', title: 'Financial Analyst', titleAr: 'محلل مالي', openings: 4, filled: 4 },
  { id: 'p6', departmentId: 'd5', title: 'HR Specialist', titleAr: 'متخصص موارد بشرية', openings: 3, filled: 3 },
];

// ─── Summary stats ─────────────────────────────────────────────────────────────

export const orgStats = {
  companies: companies.length,
  branches: branches.length,
  departments: departments.length,
  positions: departments.reduce((sum, d) => sum + d.positionCount, 0),
};
