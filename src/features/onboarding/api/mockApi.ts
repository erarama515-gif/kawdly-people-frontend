import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import {
  onboardingInstanceDecoder,
  onboardingInstanceListDecoder,
  onboardingTaskDecoder,
  onboardingTaskListDecoder,
  onboardingTemplateListDecoder,
  onboardingTemplateTaskDecoder,
  onboardingTemplateTaskListDecoder,
} from './schema';
import type {
  OnboardingInstanceListWire,
  OnboardingInstanceWire,
  OnboardingTaskListWire,
  OnboardingTaskWire,
  OnboardingTemplateListWire,
  OnboardingTemplateTaskListWire,
  OnboardingTemplateTaskWire,
} from './schema';
import type {
  OnboardingInstanceApi,
  OnboardingInstanceInput,
  OnboardingInstanceListParams,
  OnboardingInstanceStatus,
  OnboardingInstanceUpdateInput,
  OnboardingOwnerType,
  OnboardingTaskApi,
  OnboardingTaskListParams,
  OnboardingTaskUpdateInput,
  OnboardingTemplateApi,
  OnboardingTemplateListParams,
  OnboardingTemplateTaskApi,
  OnboardingTemplateTaskInput,
  OnboardingTemplateTaskListParams,
  OnboardingTemplateTaskUpdateInput,
  OnboardingType,
} from './resource';

/**
 * In-process implementation of OnboardingInstanceApi, OnboardingTaskApi, and
 * OnboardingTemplateApi. Used until the Laravel backend is configured (the
 * default — see `env.useMockApi`).
 *
 * Mirrors `attendance/api/mockApi.ts`: mutable state, real latency, AbortSignal
 * support, and every response is re-decoded through the same decoders a real
 * HTTP response would go through.
 *
 * Key honesty rules enforced here (per task spec):
 * 1. `progress`/`tasksCompleted`/`totalTasks` are NOT stored on instances —
 *    task counts are computed from the separate `onboardingTasks` store.
 * 2. Employee name / photo are from a stub roster keyed by `employee_id`.
 * 3. `started_at` is an ISO date string; `startDate` is formatted client-side.
 * 4. `overdue` is NOT a real status enum value — it's a client-side badge only.
 */

// ─── Employee stubs (same anchor IDs as employees/api/mockApi.ts) ─────────────

const EMPLOYEE_STUBS = [
  { id: 43,  employee_number: 'EMP-00043', first_name: 'Ahmed',   last_name: 'Sami',    photo: pravatar(53), department: { id: 3, name: 'IT' }        },
  { id: 71,  employee_number: 'EMP-00071', first_name: 'Mona',    last_name: 'Khaled',  photo: pravatar(44), department: { id: 6, name: 'Finance' }    },
  { id: 89,  employee_number: 'EMP-00089', first_name: 'Salma',   last_name: 'Adel',    photo: pravatar(9),  department: { id: 4, name: 'Marketing' }  },
  { id: 112, employee_number: 'EMP-00112', first_name: 'Karim',   last_name: 'Fouad',   photo: pravatar(26), department: { id: 3, name: 'IT' }        },
  { id: 134, employee_number: 'EMP-00134', first_name: 'Layla',   last_name: 'Mostafa', photo: pravatar(47), department: { id: 5, name: 'Sales' }      },
  { id: 158, employee_number: 'EMP-00158', first_name: 'Omar',    last_name: 'Hassan',  photo: pravatar(33), department: { id: 1, name: 'Operations' } },
  { id: 177, employee_number: 'EMP-00177', first_name: 'Nadia',   last_name: 'Fahmy',   photo: pravatar(21), department: { id: 7, name: 'Legal' }      },
  { id: 203, employee_number: 'EMP-00203', first_name: 'Tamer',   last_name: 'Zakaria', photo: pravatar(13), department: { id: 2, name: 'HR' }         },
] as const;

type EmployeeStub = typeof EMPLOYEE_STUBS[number];

// ─── Stored types ─────────────────────────────────────────────────────────────

interface StoredInstance {
  id: number;
  employee_id: number;
  template_id: number;
  type: OnboardingType;
  status?: OnboardingInstanceStatus | undefined;
  started_at: string;
  completed_at?: string | undefined;
  created_at: string;
  updated_at: string;
}

interface StoredTask {
  id: number;
  instance_id: number;
  template_task_id: number;
  title: string;
  assigned_to: number;
  due_date: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'skipped' | undefined;
  completed_at?: string | undefined;
  completed_by?: number | undefined;
  notes?: string | undefined;
  created_at: string;
  updated_at: string;
}

interface StoredTemplate {
  id: number;
  name: string;
  type: OnboardingType;
  is_default: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface StoredTemplateTask {
  id: number;
  template_id: number;
  title: string;
  description?: string | undefined;
  owner_type: OnboardingOwnerType;
  due_days_offset?: number | undefined;
  is_required?: boolean | undefined;
  sort_order?: number | undefined;
  created_at: string;
  updated_at: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_TEMPLATES: StoredTemplate[] = [
  { id: 1, name: 'Standard Onboarding',    type: 'onboarding',  is_default: 1, is_active: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'Engineering Onboarding', type: 'onboarding',  is_default: 0, is_active: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'Sales Onboarding',       type: 'onboarding',  is_default: 0, is_active: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 4, name: 'Standard Offboarding',   type: 'offboarding', is_default: 1, is_active: 1, created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];

/**
 * Seed template tasks spread across all 4 templates (ids 1–4).
 * IDs 1–20 are used so the existing SEED_TASKS (which reference template_task_id 1–20)
 * are coherent with template 1 (Standard Onboarding) holding ids 1–7, template 2
 * (Engineering Onboarding) ids 8–13, template 3 (Sales Onboarding) ids 14–17, and
 * template 4 (Standard Offboarding) ids 18–20.
 */
const SEED_TEMPLATE_TASKS: StoredTemplateTask[] = [
  // Template 1 — Standard Onboarding (7 tasks, ids 1–7)
  { id:  1, template_id: 1, title: 'Complete paperwork & contracts',        owner_type: 'hr',       due_days_offset:  1, is_required: true,  sort_order:  1, description: 'Sign offer letter, NDA, and HR forms.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id:  2, template_id: 1, title: 'Provision workstation & accounts',      owner_type: 'it',       due_days_offset:  1, is_required: true,  sort_order:  2, description: 'Set up laptop, email, and system access.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id:  3, template_id: 1, title: 'Office orientation tour',               owner_type: 'hr',       due_days_offset:  1, is_required: true,  sort_order:  3, description: 'Walk the new hire through the office and introduce key contacts.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id:  4, template_id: 1, title: 'Meet the team & manager',               owner_type: 'manager',  due_days_offset:  2, is_required: true,  sort_order:  4, description: 'Schedule intro meetings with direct team members.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id:  5, template_id: 1, title: 'Benefits enrollment',                   owner_type: 'hr',       due_days_offset:  7, is_required: true,  sort_order:  5, description: 'Enroll in health insurance, pension, and other benefits.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id:  6, template_id: 1, title: 'Complete compliance training',           owner_type: 'employee', due_days_offset: 14, is_required: true,  sort_order:  6, description: 'Finish mandatory e-learning modules on GDPR, security, and ethics.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id:  7, template_id: 1, title: '30-day check-in with manager',          owner_type: 'manager',  due_days_offset: 30, is_required: false, sort_order:  7, description: 'Review progress and address any questions.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  // Template 2 — Engineering Onboarding (6 tasks, ids 8–13)
  { id:  8, template_id: 2, title: 'Set up development environment',        owner_type: 'it',       due_days_offset:  1, is_required: true,  sort_order:  1, description: 'Install IDE, clone repos, run local stack.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id:  9, template_id: 2, title: 'Review architecture docs & ADRs',       owner_type: 'employee', due_days_offset:  3, is_required: true,  sort_order:  2, description: 'Read the system design wiki and key architectural decision records.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 10, template_id: 2, title: 'Complete first code review',            owner_type: 'employee', due_days_offset:  7, is_required: true,  sort_order:  3, description: 'Submit and have a small PR reviewed by a senior engineer.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 11, template_id: 2, title: 'Shadow on-call rotation',               owner_type: 'employee', due_days_offset: 14, is_required: false, sort_order:  4, description: 'Join the on-call engineer for one week as an observer.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 12, template_id: 2, title: 'Security & access review with IT',      owner_type: 'it',       due_days_offset:  5, is_required: true,  sort_order:  5, description: 'Confirm VPN, 2FA, and repo access are correctly scoped.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 13, template_id: 2, title: '60-day engineering goals set',          owner_type: 'manager',  due_days_offset: 60, is_required: true,  sort_order:  6, description: 'Agree on OKRs and a 60-day technical ramp-up plan.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  // Template 3 — Sales Onboarding (4 tasks, ids 14–17)
  { id: 14, template_id: 3, title: 'CRM access & training',                 owner_type: 'it',       due_days_offset:  1, is_required: true,  sort_order:  1, description: 'Provision Salesforce account and complete the basics training.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 15, template_id: 3, title: 'Product & pricing deep-dive',           owner_type: 'manager',  due_days_offset:  3, is_required: true,  sort_order:  2, description: 'Shadow AE demos and review the current pricing sheet.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 16, template_id: 3, title: 'First solo discovery call',             owner_type: 'employee', due_days_offset: 21, is_required: true,  sort_order:  3, description: 'Conduct a recorded discovery call for manager review.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 17, template_id: 3, title: 'Commission & quota plan acknowledgement', owner_type: 'finance', due_days_offset:  7, is_required: true,  sort_order:  4, description: 'Sign and return the approved compensation plan.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  // Template 4 — Standard Offboarding (3 tasks, ids 18–20)
  { id: 18, template_id: 4, title: 'Return equipment & badges',             owner_type: 'it',       due_days_offset: -1, is_required: true,  sort_order:  1, description: 'Collect laptop, phone, key card, and any other company assets.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 19, template_id: 4, title: 'Revoke all system access',              owner_type: 'it',       due_days_offset:  0, is_required: true,  sort_order:  2, description: 'Disable accounts, VPN, email, and all SaaS tool access on last day.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  { id: 20, template_id: 4, title: 'Final payroll & benefits settlement',   owner_type: 'finance',  due_days_offset:  7, is_required: true,  sort_order:  3, description: 'Process final salary, accrued leave payout, and pension closure.', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
];

/**
 * Seed instances that match the OLD mock's four onboarding cards.
 * Statuses are real backend values: in_progress | completed | cancelled.
 * "overdue" is NOT stored here — it is derived client-side from task due dates.
 */
const SEED_INSTANCES: StoredInstance[] = [
  { id: 1, employee_id: 89,  template_id: 1, type: 'onboarding', status: 'in_progress', started_at: '2026-09-22', created_at: '2026-09-22T08:00:00Z', updated_at: '2026-09-22T08:00:00Z' },
  { id: 2, employee_id: 203, template_id: 1, type: 'onboarding', status: 'in_progress', started_at: '2026-09-29', created_at: '2026-09-29T08:00:00Z', updated_at: '2026-09-29T08:00:00Z' },
  { id: 3, employee_id: 43,  template_id: 2, type: 'onboarding', status: 'in_progress', started_at: '2026-09-15', created_at: '2026-09-15T08:00:00Z', updated_at: '2026-09-15T08:00:00Z' },
  { id: 4, employee_id: 134, template_id: 3, type: 'onboarding', status: 'in_progress', started_at: '2026-09-08', created_at: '2026-09-08T08:00:00Z', updated_at: '2026-09-08T08:00:00Z' },
  { id: 5, employee_id: 71,  template_id: 1, type: 'onboarding', status: 'completed',   started_at: '2026-08-01', completed_at: '2026-08-31', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-31T08:00:00Z' },
  { id: 6, employee_id: 112, template_id: 2, type: 'onboarding', status: 'completed',   started_at: '2026-09-01', completed_at: '2026-09-28', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-28T08:00:00Z' },
  { id: 7, employee_id: 158, template_id: 4, type: 'offboarding', status: 'in_progress', started_at: '2026-09-20', created_at: '2026-09-20T08:00:00Z', updated_at: '2026-09-20T08:00:00Z' },
];

/**
 * Seed tasks spread across instances.
 * Task 4 for instance 4 has a past due_date and status != 'completed' — so the
 * client-side "overdue" badge will activate for it.
 */
const SEED_TASKS: StoredTask[] = [
  // Instance 1 (Salma — 13/20 done ≈ 65%)
  ...Array.from({ length: 13 }, (_, i) => ({
    id: 100 + i, instance_id: 1, template_task_id: i + 1,
    title: `Task ${i + 1}`, assigned_to: 1, due_date: '2026-10-01',
    status: 'completed' as const,
    completed_at: '2026-09-30', created_at: '2026-09-22T08:00:00Z', updated_at: '2026-09-30T08:00:00Z',
  })),
  ...Array.from({ length: 7 }, (_, i) => ({
    id: 113 + i, instance_id: 1, template_task_id: 14 + i,
    title: `Task ${14 + i}`, assigned_to: 1,
    due_date: i < 3 ? '2026-09-25' : '2026-10-15',
    status: i < 3 ? ('pending' as const) : ('pending' as const),
    created_at: '2026-09-22T08:00:00Z', updated_at: '2026-09-22T08:00:00Z',
  })),
  // Instance 2 (Tamer — 6/20 done = 30%)
  ...Array.from({ length: 6 }, (_, i) => ({
    id: 200 + i, instance_id: 2, template_task_id: i + 1,
    title: `Task ${i + 1}`, assigned_to: 1, due_date: '2026-10-05',
    status: 'completed' as const,
    completed_at: '2026-10-04', created_at: '2026-09-29T08:00:00Z', updated_at: '2026-10-04T08:00:00Z',
  })),
  ...Array.from({ length: 14 }, (_, i) => ({
    id: 206 + i, instance_id: 2, template_task_id: 7 + i,
    title: `Task ${7 + i}`, assigned_to: 1, due_date: '2026-10-15',
    status: 'pending' as const,
    created_at: '2026-09-29T08:00:00Z', updated_at: '2026-09-29T08:00:00Z',
  })),
  // Instance 3 (Ahmed — 18/20 done = 90%)
  ...Array.from({ length: 18 }, (_, i) => ({
    id: 300 + i, instance_id: 3, template_task_id: i + 1,
    title: `Task ${i + 1}`, assigned_to: 1, due_date: '2026-09-28',
    status: 'completed' as const,
    completed_at: '2026-09-28', created_at: '2026-09-15T08:00:00Z', updated_at: '2026-09-28T08:00:00Z',
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: 318 + i, instance_id: 3, template_task_id: 19 + i,
    title: `Task ${19 + i}`, assigned_to: 1, due_date: '2026-10-10',
    status: 'pending' as const,
    created_at: '2026-09-15T08:00:00Z', updated_at: '2026-09-15T08:00:00Z',
  })),
  // Instance 4 (Layla — 9/20 done = 45%, some tasks overdue past due_date)
  ...Array.from({ length: 9 }, (_, i) => ({
    id: 400 + i, instance_id: 4, template_task_id: i + 1,
    title: `Task ${i + 1}`, assigned_to: 1, due_date: '2026-09-20',
    status: 'completed' as const,
    completed_at: '2026-09-20', created_at: '2026-09-08T08:00:00Z', updated_at: '2026-09-20T08:00:00Z',
  })),
  ...Array.from({ length: 11 }, (_, i) => ({
    id: 409 + i, instance_id: 4, template_task_id: 10 + i,
    title: `Task ${10 + i}`, assigned_to: 1,
    // Past due dates (2026-09-15) and status pending → triggers overdue client-side badge
    due_date: '2026-09-15',
    status: 'pending' as const,
    created_at: '2026-09-08T08:00:00Z', updated_at: '2026-09-08T08:00:00Z',
  })),
  // Instance 5 & 6 (completed)
  ...Array.from({ length: 20 }, (_, i) => ({
    id: 500 + i, instance_id: 5, template_task_id: i + 1,
    title: `Task ${i + 1}`, assigned_to: 1, due_date: '2026-08-28',
    status: 'completed' as const,
    completed_at: '2026-08-27', created_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-27T08:00:00Z',
  })),
  ...Array.from({ length: 20 }, (_, i) => ({
    id: 600 + i, instance_id: 6, template_task_id: i + 1,
    title: `Task ${i + 1}`, assigned_to: 1, due_date: '2026-09-25',
    status: 'completed' as const,
    completed_at: '2026-09-25', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-25T08:00:00Z',
  })),
];

function seedInstances(): StoredInstance[] {
  return SEED_INSTANCES.map((r) => ({ ...r }));
}
function seedTasks(): StoredTask[] {
  return SEED_TASKS.map((r) => ({ ...r }));
}
function seedTemplateTasks(): StoredTemplateTask[] {
  return SEED_TEMPLATE_TASKS.map((r) => ({ ...r }));
}

let instanceStore: StoredInstance[] = seedInstances();
let taskStore: StoredTask[] = seedTasks();
let templateTaskStore: StoredTemplateTask[] = seedTemplateTasks();
let nextInstanceId = 100;
let nextTaskId = 900;
let nextTemplateTaskId = 200;

export function resetMockOnboarding(): void {
  instanceStore = seedInstances();
  taskStore = seedTasks();
  templateTaskStore = seedTemplateTasks();
  nextInstanceId = 100;
  nextTaskId = 900;
  nextTemplateTaskId = 200;
}

// ─── Failure injection ────────────────────────────────────────────────────────

const FAILURE_RATE_KEY = 'kawdly.onboardingMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

// ─── OnboardingInstance mock ──────────────────────────────────────────────────

export const mockOnboardingInstanceApi: OnboardingInstanceApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = instanceStore.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.type && row.type !== params.type) return false;
      if (params.employeeId && row.employee_id !== params.employeeId) return false;
      if (!search) return true;
      const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id);
      if (!emp) return false;
      const haystack = `${emp.first_name} ${emp.last_name} ${emp.employee_number}`.toLowerCase();
      return haystack.includes(search);
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: OnboardingInstanceListWire = {
      data: page.map(instanceToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return onboardingInstanceListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextInstanceId;
    nextInstanceId += 1;
    const stamp = new Date().toISOString();
    const row: StoredInstance = {
      id,
      employee_id: input.employee_id,
      template_id: input.template_id,
      type: input.type,
      status: input.status ?? undefined,
      started_at: input.started_at,
      completed_at: input.completed_at ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    instanceStore = [row, ...instanceStore];
    return onboardingInstanceDecoder.decode(structuredClone(instanceToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findInstanceOrThrow(id);
    const stamp = new Date().toISOString();
    const updated: StoredInstance = {
      ...row,
      employee_id: input.employee_id ?? row.employee_id,
      template_id: input.template_id ?? row.template_id,
      type: input.type ?? row.type,
      status: input.status === null ? undefined : (input.status ?? row.status),
      started_at: input.started_at ?? row.started_at,
      completed_at: input.completed_at === null ? undefined : (input.completed_at ?? row.completed_at),
      updated_at: stamp,
    };
    instanceStore = instanceStore.map((item) => (item.id === id ? updated : item));
    return onboardingInstanceDecoder.decode(structuredClone(instanceToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findInstanceOrThrow(id);
    instanceStore = instanceStore.filter((item) => item.id !== id);
    // Also clean up tasks for removed instance
    taskStore = taskStore.filter((item) => item.instance_id !== id);
  },
};

// ─── OnboardingTask mock ──────────────────────────────────────────────────────

export const mockOnboardingTaskApi: OnboardingTaskApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = taskStore.filter((row) => {
      if (params.instanceId !== undefined && row.instance_id !== params.instanceId) return false;
      if (params.status && row.status !== params.status) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 100;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: OnboardingTaskListWire = {
      data: page.map(taskToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return onboardingTaskListDecoder.decode(structuredClone(wire));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findTaskOrThrow(id);
    const stamp = new Date().toISOString();
    const updated: StoredTask = {
      ...row,
      status: input.status === null ? undefined : (input.status ?? row.status),
      notes: input.notes === null ? undefined : (input.notes ?? row.notes),
      completed_at: input.completed_at === null ? undefined : (input.completed_at ?? row.completed_at),
      updated_at: stamp,
    };
    taskStore = taskStore.map((item) => (item.id === id ? updated : item));
    return onboardingTaskDecoder.decode(structuredClone(taskToWire(updated)));
  },
};

// ─── OnboardingTemplateTask mock ──────────────────────────────────────────────

export const mockOnboardingTemplateTaskApi: OnboardingTemplateTaskApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = templateTaskStore.filter((row) => {
      if (params.templateId !== undefined && row.template_id !== params.templateId) return false;
      if (params.ownerType && row.owner_type !== params.ownerType) return false;
      if (params.isRequired !== undefined && row.is_required !== params.isRequired) return false;
      return true;
    });

    // Sort by sort_order ascending (nulls last), then id
    const sorted = [...filtered].sort((a, b) => {
      const aSortOrder = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const bSortOrder = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (aSortOrder !== bSortOrder) return aSortOrder - bSortOrder;
      return a.id - b.id;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = sorted.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = sorted.slice(start, start + perPage);

    const wire: OnboardingTemplateTaskListWire = {
      data: page.map(templateTaskToWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return onboardingTemplateTaskListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextTemplateTaskId;
    nextTemplateTaskId += 1;
    const stamp = new Date().toISOString();
    const row: StoredTemplateTask = {
      id,
      template_id: input.template_id,
      title: input.title,
      description: input.description ?? undefined,
      owner_type: input.owner_type,
      due_days_offset: input.due_days_offset ?? undefined,
      is_required: input.is_required ?? undefined,
      sort_order: input.sort_order ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    templateTaskStore = [row, ...templateTaskStore];
    return onboardingTemplateTaskDecoder.decode(structuredClone(templateTaskToWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findTemplateTaskOrThrow(id);
    const stamp = new Date().toISOString();
    const updated: StoredTemplateTask = {
      ...row,
      title: input.title ?? row.title,
      description: input.description === null ? undefined : (input.description ?? row.description),
      owner_type: input.owner_type ?? row.owner_type,
      due_days_offset: input.due_days_offset === null ? undefined : (input.due_days_offset ?? row.due_days_offset),
      is_required: input.is_required === null ? undefined : (input.is_required ?? row.is_required),
      sort_order: input.sort_order === null ? undefined : (input.sort_order ?? row.sort_order),
      updated_at: stamp,
    };
    templateTaskStore = templateTaskStore.map((item) => (item.id === id ? updated : item));
    return onboardingTemplateTaskDecoder.decode(structuredClone(templateTaskToWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findTemplateTaskOrThrow(id);
    templateTaskStore = templateTaskStore.filter((item) => item.id !== id);
  },
};

// ─── OnboardingTemplate mock ──────────────────────────────────────────────────

export const mockOnboardingTemplateApi: OnboardingTemplateApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const filtered = SEED_TEMPLATES.filter((row) => {
      if (params.type && row.type !== params.type) return false;
      return true;
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 100;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: OnboardingTemplateListWire = {
      data: page,
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return onboardingTemplateListDecoder.decode(structuredClone(wire));
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function instanceToWire(row: StoredInstance): OnboardingInstanceWire {
  const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id) as EmployeeStub | undefined;
  return {
    ...row,
    employee: emp
      ? {
          id: emp.id,
          employee_number: emp.employee_number,
          first_name: emp.first_name,
          last_name: emp.last_name,
          photo: emp.photo,
          department: emp.department,
        }
      : undefined,
  } as unknown as OnboardingInstanceWire;
}

function taskToWire(row: StoredTask): OnboardingTaskWire {
  return { ...row } as unknown as OnboardingTaskWire;
}

function findInstanceOrThrow(id: number): StoredInstance {
  const row = instanceStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `OnboardingInstance ${id} not found`, { status: 404 });
  return row;
}

function findTaskOrThrow(id: number): StoredTask {
  const row = taskStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `OnboardingTask ${id} not found`, { status: 404 });
  return row;
}

function templateTaskToWire(row: StoredTemplateTask): OnboardingTemplateTaskWire {
  return { ...row } as unknown as OnboardingTemplateTaskWire;
}

function findTemplateTaskOrThrow(id: number): StoredTemplateTask {
  const row = templateTaskStore.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `OnboardingTemplateTask ${id} not found`, { status: 404 });
  return row;
}

async function simulate(context: FetchContext, baseMs: number): Promise<void> {
  if (context.signal.aborted) throw new ApiError('aborted', 'Request aborted');
  if (failureRate > 0 && Math.random() < failureRate) {
    throw new ApiError('network', 'Simulated transport failure');
  }

  const jittered = baseMs + Math.random() * baseMs * 0.4;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      context.signal.removeEventListener('abort', onAbort);
      resolve();
    }, jittered);
    function onAbort() {
      clearTimeout(timer);
      reject(new ApiError('aborted', 'Request aborted'));
    }
    context.signal.addEventListener('abort', onAbort, { once: true });
  });
}
