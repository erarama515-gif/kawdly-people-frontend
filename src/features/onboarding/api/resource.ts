import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  OnboardingInstanceListWire,
  OnboardingInstanceWire,
  OnboardingTaskListWire,
  OnboardingTaskWire,
  OnboardingTemplateListWire,
  OnboardingTemplateTaskListWire,
  OnboardingTemplateTaskWire,
} from './schema';

/**
 * The Onboarding module's remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpOnboardingInstanceApi`
 * (real Laravel endpoints under `/api/v1/onboarding-instances`) and
 * `mockOnboardingInstanceApi` (in-process, the default until a backend is
 * configured). Mirrors the Attendance feature's exact `api/` pattern.
 *
 * Backend ground truth (from StoreOnboardingInstanceRequest):
 *   employee_id  required FK → employees
 *   template_id  required FK → onboarding_templates
 *   type         required enum: onboarding | offboarding
 *   status       nullable enum: in_progress | completed | cancelled
 *   started_at   required date
 *   completed_at nullable date
 */

export type OnboardingType = 'onboarding' | 'offboarding';
export type OnboardingInstanceStatus = 'in_progress' | 'completed' | 'cancelled';
export type OnboardingTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface OnboardingInstanceListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  status?: OnboardingInstanceStatus | undefined;
  type?: OnboardingType | undefined;
  employeeId?: number | undefined;
}

/** Shape of `StoreOnboardingInstanceRequest`'s validated fields. */
export interface OnboardingInstanceInput {
  employee_id: number;
  template_id: number;
  type: OnboardingType;
  status?: OnboardingInstanceStatus | null;
  started_at: string;
  completed_at?: string | null;
}

/** `UpdateOnboardingInstanceRequest` wraps the same fields in `sometimes`. */
export type OnboardingInstanceUpdateInput = Partial<OnboardingInstanceInput>;

export interface OnboardingInstanceApi {
  list(context: FetchContext, params: OnboardingInstanceListParams): Promise<OnboardingInstanceListWire>;
  create(context: FetchContext, input: OnboardingInstanceInput): Promise<OnboardingInstanceWire>;
  update(context: FetchContext, id: number, input: OnboardingInstanceUpdateInput): Promise<OnboardingInstanceWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

export interface OnboardingTaskListParams {
  instanceId?: number | undefined;
  status?: OnboardingTaskStatus | undefined;
  page?: number;
  perPage?: number;
}

/** PATCH body for status-only update on a task (no /complete action — see queries.ts). */
export interface OnboardingTaskUpdateInput {
  status?: OnboardingTaskStatus | null;
  notes?: string | null;
  completed_at?: string | null;
}

export interface OnboardingTaskApi {
  list(context: FetchContext, params: OnboardingTaskListParams): Promise<OnboardingTaskListWire>;
  update(context: FetchContext, id: number, input: OnboardingTaskUpdateInput): Promise<OnboardingTaskWire>;
}

export interface OnboardingTemplateListParams {
  page?: number;
  perPage?: number;
  type?: OnboardingType | undefined;
}

export interface OnboardingTemplateApi {
  list(context: FetchContext, params: OnboardingTemplateListParams): Promise<OnboardingTemplateListWire>;
}

// ─── OnboardingTemplateTask ───────────────────────────────────────────────────

export type OnboardingOwnerType = 'hr' | 'it' | 'manager' | 'employee' | 'admin' | 'finance';

export interface OnboardingTemplateTaskListParams {
  page?: number;
  perPage?: number;
  templateId?: number | undefined;
  ownerType?: OnboardingOwnerType | undefined;
  isRequired?: boolean | undefined;
}

/** Shape of `StoreOnboardingTemplateTaskRequest`'s validated fields. */
export interface OnboardingTemplateTaskInput {
  template_id: number;
  title: string;
  description?: string | null;
  owner_type: OnboardingOwnerType;
  due_days_offset?: number | null;
  is_required?: boolean | null;
  sort_order?: number | null;
}

/** `UpdateOnboardingTemplateTaskRequest` wraps the same fields in `sometimes`. */
export type OnboardingTemplateTaskUpdateInput = Partial<OnboardingTemplateTaskInput>;

export interface OnboardingTemplateTaskApi {
  list(context: FetchContext, params: OnboardingTemplateTaskListParams): Promise<OnboardingTemplateTaskListWire>;
  create(context: FetchContext, input: OnboardingTemplateTaskInput): Promise<OnboardingTemplateTaskWire>;
  update(context: FetchContext, id: number, input: OnboardingTemplateTaskUpdateInput): Promise<OnboardingTemplateTaskWire>;
  remove(context: FetchContext, id: number): Promise<void>;
}

/** Cache keys. Every onboarding read hangs off `all` so invalidation after a write is total. */
export const onboardingInstanceKeys = {
  all: ['onboardingInstances'] as const satisfies QueryKey,
  list: (params: OnboardingInstanceListParams) =>
    ['onboardingInstances', 'list', params] as const satisfies QueryKey,
};

export const onboardingTaskKeys = {
  all: ['onboardingTasks'] as const satisfies QueryKey,
  list: (params: OnboardingTaskListParams) =>
    ['onboardingTasks', 'list', params] as const satisfies QueryKey,
};

export const onboardingTemplateKeys = {
  all: ['onboardingTemplates'] as const satisfies QueryKey,
  list: (params: OnboardingTemplateListParams) =>
    ['onboardingTemplates', 'list', params] as const satisfies QueryKey,
};

export const onboardingTemplateTaskKeys = {
  all: ['onboardingTemplateTasks'] as const satisfies QueryKey,
  list: (params: OnboardingTemplateTaskListParams) =>
    ['onboardingTemplateTasks', 'list', params] as const satisfies QueryKey,
};
