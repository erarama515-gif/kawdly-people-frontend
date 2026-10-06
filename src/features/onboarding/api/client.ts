import { env } from '@/config/env';
import { createHttpClient } from '@/lib/api/http';
import type { HttpClient } from '@/lib/api/http';
import {
  mockOnboardingInstanceApi,
  mockOnboardingTaskApi,
  mockOnboardingTemplateApi,
  mockOnboardingTemplateTaskApi,
  resetMockOnboarding,
  setMockFailureRate,
} from './mockApi';
import {
  onboardingInstanceEnvelopeDecoder,
  onboardingInstanceListDecoder,
  onboardingTaskEnvelopeDecoder,
  onboardingTaskListDecoder,
  onboardingTemplateListDecoder,
  onboardingTemplateTaskEnvelopeDecoder,
  onboardingTemplateTaskListDecoder,
} from './schema';
import type {
  OnboardingInstanceApi,
  OnboardingInstanceInput,
  OnboardingInstanceListParams,
  OnboardingInstanceUpdateInput,
  OnboardingTaskApi,
  OnboardingTaskListParams,
  OnboardingTaskUpdateInput,
  OnboardingTemplateApi,
  OnboardingTemplateListParams,
  OnboardingTemplateTaskApi,
  OnboardingTemplateTaskInput,
  OnboardingTemplateTaskListParams,
  OnboardingTemplateTaskUpdateInput,
} from './resource';

/**
 * Real HTTP implementations of the three onboarding APIs, pointed at the real
 * Laravel endpoints. Mirrors `attendance/api/client.ts` — every response is
 * decoded before being returned so contract drift surfaces as a typed error.
 *
 * NOTE on /complete action: `POST /onboarding-tasks/{id}/complete` calls
 * `$request->user()->id` on the server, which requires a real authenticated
 * session. We skip wiring that dedicated action for the mock-first phase and
 * use `PATCH /onboarding-tasks/{id}` with `{ status: 'completed' }` instead —
 * the same precedent as Loans skipping /approve and Payroll-run skipping
 * /calculate+/approve.
 */

const http: HttpClient = createHttpClient({
  baseUrl: env.apiBaseUrl || '/api/v1',
  timeoutMs: env.requestTimeoutMs,
  retries: env.requestRetries,
  backoffMs: env.requestBackoffMs,
});

const INSTANCES_BASE = '/onboarding-instances';
const TASKS_BASE = '/onboarding-tasks';
const TEMPLATES_BASE = '/onboarding-templates';
const TEMPLATE_TASKS_BASE = '/onboarding-template-tasks';
const INSTANCE_LIST_INCLUDE = 'employee';

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

export const httpOnboardingInstanceApi: OnboardingInstanceApi = {
  async list({ signal }, params) {
    const { data } = await http(INSTANCES_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        status: params.status,
        type: params.type,
        employee_id: params.employeeId,
        include: INSTANCE_LIST_INCLUDE,
      },
      signal,
      schema: onboardingInstanceListDecoder,
    });
    return requireData(data, 'GET /onboarding-instances');
  },

  async create({ signal }, input) {
    const { data } = await http(INSTANCES_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: onboardingInstanceEnvelopeDecoder,
    });
    return requireData(data, 'POST /onboarding-instances').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${INSTANCES_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: onboardingInstanceEnvelopeDecoder,
    });
    return requireData(data, `PATCH /onboarding-instances/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${INSTANCES_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

export const httpOnboardingTaskApi: OnboardingTaskApi = {
  async list({ signal }, params) {
    const { data } = await http(TASKS_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        instance_id: params.instanceId,
        status: params.status,
      },
      signal,
      schema: onboardingTaskListDecoder,
    });
    return requireData(data, 'GET /onboarding-tasks');
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${TASKS_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: onboardingTaskEnvelopeDecoder,
    });
    return requireData(data, `PATCH /onboarding-tasks/${id}`).data;
  },
};

export const httpOnboardingTemplateApi: OnboardingTemplateApi = {
  async list({ signal }, params) {
    const { data } = await http(TEMPLATES_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        type: params.type,
      },
      signal,
      schema: onboardingTemplateListDecoder,
    });
    return requireData(data, 'GET /onboarding-templates');
  },
};

export const httpOnboardingTemplateTaskApi: OnboardingTemplateTaskApi = {
  async list({ signal }, params) {
    const { data } = await http(TEMPLATE_TASKS_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        template_id: params.templateId,
        owner_type: params.ownerType,
        is_required: params.isRequired,
      },
      signal,
      schema: onboardingTemplateTaskListDecoder,
    });
    return requireData(data, 'GET /onboarding-template-tasks');
  },

  async create({ signal }, input) {
    const { data } = await http(TEMPLATE_TASKS_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: onboardingTemplateTaskEnvelopeDecoder,
    });
    return requireData(data, 'POST /onboarding-template-tasks').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${TEMPLATE_TASKS_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: onboardingTemplateTaskEnvelopeDecoder,
    });
    return requireData(data, `PATCH /onboarding-template-tasks/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${TEMPLATE_TASKS_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },
};

/**
 * Chooses the transport once per app: mock is the default whenever no API base
 * URL is configured, so the Onboarding page is fully interactive before the
 * Laravel backend is wired up, and a build pointed at a real backend switches
 * with no code change.
 */
export const onboardingInstanceApi: OnboardingInstanceApi = env.useMockApi
  ? mockOnboardingInstanceApi
  : httpOnboardingInstanceApi;

export const onboardingTaskApi: OnboardingTaskApi = env.useMockApi
  ? mockOnboardingTaskApi
  : httpOnboardingTaskApi;

export const onboardingTemplateApi: OnboardingTemplateApi = env.useMockApi
  ? mockOnboardingTemplateApi
  : httpOnboardingTemplateApi;

export const onboardingTemplateTaskApi: OnboardingTemplateTaskApi = env.useMockApi
  ? mockOnboardingTemplateTaskApi
  : httpOnboardingTemplateTaskApi;

if (env.isDev && env.useMockApi) {
  // Review affordance:
  //   __onboardingMock.setFailureRate(1)  // force every request to fail
  //   __onboardingMock.reset()            // restore seed data
  Object.defineProperty(window, '__onboardingMock', {
    value: { setFailureRate: setMockFailureRate, reset: resetMockOnboarding },
    configurable: true,
  });
}

export type { OnboardingInstanceInput, OnboardingInstanceUpdateInput, OnboardingInstanceListParams };
export type { OnboardingTaskUpdateInput, OnboardingTaskListParams };
export type { OnboardingTemplateListParams };
export type { OnboardingTemplateTaskInput, OnboardingTemplateTaskUpdateInput, OnboardingTemplateTaskListParams };
