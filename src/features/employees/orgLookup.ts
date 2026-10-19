/**
 * Static seed fixtures for the **mock API layer only**
 * (`employees/api/mockApi.ts`, `recruitment/api/mockApi.ts`), used to
 * synthesize realistic Employee/JobPosting rows at module-load time when
 * `env.useMockApi` is on.
 *
 * The Organization feature (`@/features/organization`) now has a real,
 * fully-built API client (`useBranchList`, `useDepartmentList`,
 * `useJobPositionList`, `useJobGradeList`, `useJobLevelList`) backed by live
 * HTTP/mock resources, and every real UI component (Employee
 * add/edit/promote/transfer forms, Recruitment job-posting form, convert-to-
 * employee dialog) has been migrated onto it — none of them import from this
 * file anymore.
 *
 * This file survives narrowly as synchronous seed data for the two mock-API
 * generators above, which build fixture rows eagerly at import time and
 * cannot await async query hooks. These ids are still pinned to exactly what
 * `OrganizationSeeder.php` inserts on a fresh `migrate:fresh --seed`
 * (sequential auto-increment, single company), so the generated mock rows
 * stay consistent with the real backend's shape.
 */

export const COMPANY_ID = 1;

export interface LookupOption {
  id: number;
  name: string;
}

export const BRANCHES: LookupOption[] = [
  { id: 1, name: 'Cairo HQ' },
  { id: 2, name: 'Riyadh' },
  { id: 3, name: 'Dubai' },
];

export const DEPARTMENTS: LookupOption[] = [
  { id: 1, name: 'Sales' },
  { id: 2, name: 'Operations' },
  { id: 3, name: 'IT' },
  { id: 4, name: 'Finance' },
  { id: 5, name: 'HR' },
  { id: 6, name: 'Marketing' },
  { id: 7, name: 'Legal' },
  { id: 8, name: 'Admin' },
];

export interface JobPositionOption extends LookupOption {
  departmentId: number;
}

export const JOB_POSITIONS: JobPositionOption[] = [
  { id: 1, departmentId: 1, name: 'Sales Executive' },
  { id: 2, departmentId: 1, name: 'Sales Manager' },
  { id: 3, departmentId: 1, name: 'Sales Associate' },
  { id: 4, departmentId: 3, name: 'Senior Developer' },
  { id: 5, departmentId: 3, name: 'DevOps Engineer' },
  { id: 6, departmentId: 3, name: 'Junior Developer' },
  { id: 7, departmentId: 4, name: 'Financial Analyst' },
  { id: 8, departmentId: 4, name: 'Finance Associate' },
  { id: 9, departmentId: 5, name: 'HR Specialist' },
  { id: 10, departmentId: 6, name: 'UX Designer' },
  { id: 11, departmentId: 6, name: 'Marketing Coordinator' },
  { id: 12, departmentId: 7, name: 'Legal Counsel' },
  { id: 13, departmentId: 2, name: 'Operations Manager' },
  { id: 14, departmentId: 8, name: 'Admin Officer' },
];

export const JOB_GRADES: LookupOption[] = [
  { id: 1, name: 'G1 — Associate' },
  { id: 2, name: 'G2 — Professional' },
  { id: 3, name: 'G3 — Senior Professional' },
  { id: 4, name: 'G4 — Lead / Manager' },
  { id: 5, name: 'G5 — Senior Manager' },
  { id: 6, name: 'G6 — Director' },
];

export const JOB_LEVELS: LookupOption[] = [
  { id: 1, name: 'Junior' },
  { id: 2, name: 'Mid-Level' },
  { id: 3, name: 'Senior' },
  { id: 4, name: 'Lead' },
  { id: 5, name: 'Principal' },
  { id: 6, name: 'Director' },
];

export function positionsForDepartment(departmentId: number | undefined): JobPositionOption[] {
  if (departmentId === undefined) return JOB_POSITIONS;
  return JOB_POSITIONS.filter((position) => position.departmentId === departmentId);
}

export function nameOf(options: LookupOption[], id: number | null | undefined): string {
  return options.find((option) => option.id === id)?.name ?? '—';
}
