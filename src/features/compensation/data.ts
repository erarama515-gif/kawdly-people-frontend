export interface SalaryBand {
  id: string;
  grade: string;
  title: string;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
  employeeCount: number;
  avgActual: number;
}

export interface CompensationReviewEntry {
  id: string;
  employeeName: string;
  initials: string;
  photo?: string;
  department: string;
  grade: string;
  currentSalary: number;
  proposedSalary: number;
  compaRatio: number;
  dueDate: string;
}

export const salaryBands: SalaryBand[] = [
  {
    id: 'g1',
    grade: 'G1',
    title: 'Associate',
    minSalary: 4_000,
    midSalary: 5_500,
    maxSalary: 7_000,
    employeeCount: 312,
    avgActual: 5_280,
  },
  {
    id: 'g2',
    grade: 'G2',
    title: 'Professional',
    minSalary: 6_500,
    midSalary: 8_500,
    maxSalary: 10_500,
    employeeCount: 408,
    avgActual: 8_100,
  },
  {
    id: 'g3',
    grade: 'G3',
    title: 'Senior Professional',
    minSalary: 9_500,
    midSalary: 12_500,
    maxSalary: 15_500,
    employeeCount: 287,
    avgActual: 12_200,
  },
  {
    id: 'g4',
    grade: 'G4',
    title: 'Lead / Manager',
    minSalary: 14_000,
    midSalary: 18_000,
    maxSalary: 22_000,
    employeeCount: 163,
    avgActual: 17_400,
  },
  {
    id: 'g5',
    grade: 'G5',
    title: 'Senior Manager',
    minSalary: 20_000,
    midSalary: 26_000,
    maxSalary: 32_000,
    employeeCount: 84,
    avgActual: 25_600,
  },
  {
    id: 'g6',
    grade: 'G6',
    title: 'Director',
    minSalary: 30_000,
    midSalary: 38_000,
    maxSalary: 46_000,
    employeeCount: 30,
    avgActual: 37_200,
  },
];

export const compensationStats = {
  avgSalary: 8_450,
  salaryBudget: '183M',
  compaRatio: 0.94,
  reviewsDue: 12,
};
