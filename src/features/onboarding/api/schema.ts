import { array, bool, isoDate, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Onboarding module, matching the real Laravel contract
 * exactly: field names are DB columns verbatim (snake_case) and the index
 * envelope is the app's custom `{ data, meta }` pager.
 *
 * `employee` relation on OnboardingInstance is optional — only present when the
 * request passes `include=employee`. Same convention as Attendance/Leave.
 */

// ─── Shared ───────────────────────────────────────────────────────────────────

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

// ─── OnboardingInstance ───────────────────────────────────────────────────────

export const onboardingTypeDecoder = literalUnion(['onboarding', 'offboarding'] as const);
export const onboardingInstanceStatusDecoder = literalUnion([
  'in_progress',
  'completed',
  'cancelled',
] as const);

const employeeRefDecoder = object({
  id: num(),
  employee_number: str(),
  first_name: str(),
  last_name: str(),
  photo: optional(str()),
  department: optional(object({ id: num(), name: str() })),
});

export const onboardingInstanceDecoder = object({
  id: num(),
  employee_id: num(),
  template_id: num(),
  type: onboardingTypeDecoder,
  status: optional(onboardingInstanceStatusDecoder),
  started_at: isoDate(),
  completed_at: optional(isoDate()),
  created_at: optional(str()),
  updated_at: optional(str()),
  // Eager-loaded relation (only present with include=employee)
  employee: optional(employeeRefDecoder),
});

export type OnboardingInstanceWire = ReturnType<typeof onboardingInstanceDecoder.decode>;
export type OnboardingEmployeeRef = NonNullable<OnboardingInstanceWire['employee']>;

export const onboardingInstanceListDecoder = object({
  data: array(onboardingInstanceDecoder),
  meta: pageMetaDecoder,
});

export type OnboardingInstanceListWire = ReturnType<typeof onboardingInstanceListDecoder.decode>;

export const onboardingInstanceEnvelopeDecoder = object({ data: onboardingInstanceDecoder });
export type OnboardingInstanceEnvelopeWire = ReturnType<typeof onboardingInstanceEnvelopeDecoder.decode>;

// ─── OnboardingTask ───────────────────────────────────────────────────────────

export const onboardingTaskStatusDecoder = literalUnion([
  'pending',
  'in_progress',
  'completed',
  'skipped',
] as const);

export const onboardingTaskDecoder = object({
  id: num(),
  instance_id: num(),
  template_task_id: num(),
  title: str(),
  assigned_to: num(),
  due_date: isoDate(),
  status: optional(onboardingTaskStatusDecoder),
  completed_at: optional(isoDate()),
  completed_by: optional(num()),
  notes: optional(str()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type OnboardingTaskWire = ReturnType<typeof onboardingTaskDecoder.decode>;

export const onboardingTaskListDecoder = object({
  data: array(onboardingTaskDecoder),
  meta: pageMetaDecoder,
});

export type OnboardingTaskListWire = ReturnType<typeof onboardingTaskListDecoder.decode>;

export const onboardingTaskEnvelopeDecoder = object({ data: onboardingTaskDecoder });
export type OnboardingTaskEnvelopeWire = ReturnType<typeof onboardingTaskEnvelopeDecoder.decode>;

// ─── OnboardingTemplate ───────────────────────────────────────────────────────

export const onboardingTemplateDecoder = object({
  id: num(),
  name: str(),
  type: onboardingTypeDecoder,
  is_default: optional(num()),
  is_active: optional(num()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type OnboardingTemplateWire = ReturnType<typeof onboardingTemplateDecoder.decode>;

export const onboardingTemplateListDecoder = object({
  data: array(onboardingTemplateDecoder),
  meta: pageMetaDecoder,
});

export type OnboardingTemplateListWire = ReturnType<typeof onboardingTemplateListDecoder.decode>;

// ─── OnboardingTemplateTask ───────────────────────────────────────────────────

export const ownerTypeDecoder = literalUnion([
  'hr', 'it', 'manager', 'employee', 'admin', 'finance',
] as const);

export const onboardingTemplateTaskDecoder = object({
  id: num(),
  template_id: num(),
  title: str(),
  description: optional(str()),
  owner_type: ownerTypeDecoder,
  due_days_offset: optional(num()),
  is_required: optional(bool()),
  sort_order: optional(num()),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type OnboardingTemplateTaskWire = ReturnType<typeof onboardingTemplateTaskDecoder.decode>;

export const onboardingTemplateTaskListDecoder = object({
  data: array(onboardingTemplateTaskDecoder),
  meta: pageMetaDecoder,
});

export type OnboardingTemplateTaskListWire = ReturnType<typeof onboardingTemplateTaskListDecoder.decode>;

export const onboardingTemplateTaskEnvelopeDecoder = object({ data: onboardingTemplateTaskDecoder });
export type OnboardingTemplateTaskEnvelopeWire = ReturnType<typeof onboardingTemplateTaskEnvelopeDecoder.decode>;
