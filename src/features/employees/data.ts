import { pravatar } from '@/features/dashboard/model';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EmployeeStatus = 'active' | 'on_leave' | 'suspended' | 'terminated';

export interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  nameAr: string;
  email: string;
  department: string;
  position: string;
  status: EmployeeStatus;
  joiningDate: string;
  photo: string;
  initials: string;
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

export const employees: Employee[] = [
  {
    id: 'e1',
    employeeNumber: 'EMP-00043',
    name: 'Ahmed Sami',
    nameAr: 'أحمد سامي',
    email: 'a.sami@kawdly.com',
    department: 'IT',
    position: 'Senior Developer',
    status: 'active',
    joiningDate: '2021-03-15',
    photo: pravatar(53),
    initials: 'AS',
  },
  {
    id: 'e2',
    employeeNumber: 'EMP-00071',
    name: 'Mona Khaled',
    nameAr: 'منى خالد',
    email: 'm.khaled@kawdly.com',
    department: 'Marketing',
    position: 'UX Designer',
    status: 'active',
    joiningDate: '2020-09-01',
    photo: pravatar(44),
    initials: 'MK',
  },
  {
    id: 'e3',
    employeeNumber: 'EMP-00089',
    name: 'Salma Adel',
    nameAr: 'سلمى عادل',
    email: 's.adel@kawdly.com',
    department: 'Finance',
    position: 'Financial Analyst',
    status: 'on_leave',
    joiningDate: '2019-06-10',
    photo: pravatar(9),
    initials: 'SA',
  },
  {
    id: 'e4',
    employeeNumber: 'EMP-00112',
    name: 'Karim Fouad',
    nameAr: 'كريم فؤاد',
    email: 'k.fouad@kawdly.com',
    department: 'IT',
    position: 'DevOps Engineer',
    status: 'active',
    joiningDate: '2022-01-20',
    photo: pravatar(26),
    initials: 'KF',
  },
  {
    id: 'e5',
    employeeNumber: 'EMP-00134',
    name: 'Layla Mostafa',
    nameAr: 'ليلى مصطفى',
    email: 'l.mostafa@kawdly.com',
    department: 'HR',
    position: 'HR Specialist',
    status: 'active',
    joiningDate: '2020-11-03',
    photo: pravatar(47),
    initials: 'LM',
  },
  {
    id: 'e6',
    employeeNumber: 'EMP-00158',
    name: 'Omar Hassan',
    nameAr: 'عمر حسن',
    email: 'o.hassan@kawdly.com',
    department: 'Sales',
    position: 'Sales Executive',
    status: 'suspended',
    joiningDate: '2021-07-14',
    photo: pravatar(33),
    initials: 'OH',
  },
  {
    id: 'e7',
    employeeNumber: 'EMP-00177',
    name: 'Nadia Fahmy',
    nameAr: 'نادية فهمي',
    email: 'n.fahmy@kawdly.com',
    department: 'Legal',
    position: 'Legal Counsel',
    status: 'active',
    joiningDate: '2018-04-22',
    photo: pravatar(21),
    initials: 'NF',
  },
  {
    id: 'e8',
    employeeNumber: 'EMP-00203',
    name: 'Tamer Zakaria',
    nameAr: 'تامر زكريا',
    email: 't.zakaria@kawdly.com',
    department: 'Operations',
    position: 'Operations Manager',
    status: 'terminated',
    joiningDate: '2017-09-05',
    photo: pravatar(13),
    initials: 'TZ',
  },
];

// ─── Summary stats ─────────────────────────────────────────────────────────────

export const employeeStats = {
  total: 1284,
  active: 1241,
  onLeave: 31,
  newThisMonth: 12,
};

// ─── Status label map ─────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<EmployeeStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  suspended: 'Suspended',
  terminated: 'Terminated',
};

export const STATUS_CLASSES: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  on_leave: 'bg-sky-50 text-sky-700',
  suspended: 'bg-amber-50 text-amber-700',
  terminated: 'bg-red-50 text-red-700',
};
