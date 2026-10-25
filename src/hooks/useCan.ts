import { useSessionStore } from '@/auth/session';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'approve' | 'manage';

export interface ServerCanEnvelope {
  create?: boolean;
  update?: boolean;
  delete?: boolean;
  export?: boolean;
}

/**
 * Standard mapping from friendly resource shorthand to Spatie permission resource slug.
 */
const RESOURCE_MAP: Record<string, string> = {
  employee: 'employee.list',
  'employee.list': 'employee.list',
  'employee.profile': 'employee.profile',
  'employee.salary': 'employee.salary',
  organization: 'organization.department',
  department: 'organization.department',
  branch: 'organization.branch',
  company: 'organization.company',
  job_position: 'organization.job_position',
  job_grade: 'organization.job_grade',
  job_level: 'organization.job_level',
  cost_center: 'organization.cost_center',
  attendance: 'attendance.daily_attendance',
  'attendance.record': 'attendance.daily_attendance',
  work_schedule: 'attendance.work_schedule',
  shift_rotation: 'attendance.shift_rotation',
  leave: 'leave.request',
  'leave.request': 'leave.request',
  leave_balance: 'leave.balance',
  leave_type: 'leave.type',
  contract: 'contract.contract',
  payroll: 'payroll.run',
  payroll_run: 'payroll.run',
  payslip: 'payroll.payslip',
  salary_structure: 'payroll.salary_structure',
  salary_component: 'payroll.salary_component',
  employee_salary: 'payroll.employee_salary',
  performance: 'performance.review',
  goal: 'performance.goal',
  recruitment: 'recruitment.job_posting',
  job_posting: 'recruitment.job_posting',
  candidate: 'recruitment.candidate',
  job_offer: 'recruitment.job_offer',
  document: 'document.employee_document',
  document_type: 'document.document_type',
  document_template: 'document.document_template',
  onboarding: 'onboarding.instance',
  learning: 'learning.training_program',
  career: 'career.career_path',
  loan: 'payroll.loan',
  roles: 'platform.roles_permissions',
  users: 'users',
};

/**
 * Hook to check if the current user has permission to perform an action on a resource (A4.2).
 * If a serverCan object is provided from the list endpoint envelope (A4.1), it takes precedence.
 * Otherwise, checks the authenticated session permissions with super_admin wildcard support.
 */
export function useCan(
  resource: string,
  action: PermissionAction,
  serverCan?: ServerCanEnvelope | null,
): boolean {
  return useSessionStore((state) => {
    // 1. super_admin has unconditional permission across the app
    if (state.role === 'super_admin') return true;

    // 2. Authoritative server-side can envelope from list endpoints
    if (serverCan) {
      if (action === 'create' && typeof serverCan.create === 'boolean') return serverCan.create;
      if (action === 'edit' && typeof serverCan.update === 'boolean') return serverCan.update;
      if (action === 'delete' && typeof serverCan.delete === 'boolean') return serverCan.delete;
      if (action === 'export' && typeof serverCan.export === 'boolean') return serverCan.export;
    }

    // 3. Client session Spatie permission lookup
    const base = RESOURCE_MAP[resource] ?? resource;
    const directPermission = `${base}.${action}`;
    if (state.permissions.includes(directPermission)) {
      return true;
    }

    // Manage permission acts as wildcard for CRUD within that resource/module
    const segments = base.split('.');
    if (segments.length >= 2) {
      const resourceManage = `${segments[0]}.${segments[1]}.manage`;
      if (state.permissions.includes(resourceManage)) {
        return true;
      }
    }

    return false;
  });
}
