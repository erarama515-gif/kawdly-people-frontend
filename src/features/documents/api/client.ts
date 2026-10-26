import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import {
  mockEmployeeDocumentApi,
  resetMockEmployeeDocuments,
  setMockDocumentFailureRate,
} from './mockApi';
import {
  documentTypeEnvelopeDecoder,
  documentTypeListDecoder,
  documentTemplateCountDecoder,
  employeeDocumentEnvelopeDecoder,
  employeeDocumentListDecoder,
} from './schema';
import type {
  EmployeeDocumentApi,
  EmployeeDocumentInput,
  EmployeeDocumentListParams,
  EmployeeDocumentUpdateInput,
} from './resource';

/**
 * Real HTTP implementation of `EmployeeDocumentApi`, pointed at
 * `/api/v1/employee-documents` exactly as documented in the Laravel route list:
 *  - `index` returns the app's custom `{ data, meta }` pager
 *  - `show`/`store`/`update` return `{ data: <employeeDocument> }`
 *  - `destroy` returns 204 with an empty body
 *
 * Every response is decoded before it is returned, so a contract drift
 * becomes a typed `decode` error at the boundary instead of a silent
 * `undefined` three components deep.
 */

const BASE = '/employee-documents';
const DOC_TYPES_BASE = '/document-types';
const DOC_TEMPLATES_BASE = '/document-templates';
/** Relations needed to render the list table without a second round-trip. */
const LIST_INCLUDE = 'employee,documentType';

export const httpEmployeeDocumentApi: EmployeeDocumentApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        sort: params.sort,
        direction: params.direction,
        search: params.search || undefined,
        status: params.status,
        employee_id: params.employeeId,
        document_type_id: params.documentTypeId,
        include: LIST_INCLUDE,
      },
      signal,
      schema: employeeDocumentListDecoder,
    });
    return requireData(data, 'GET /employee-documents');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: employeeDocumentEnvelopeDecoder,
    });
    return requireData(data, 'POST /employee-documents').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: employeeDocumentEnvelopeDecoder,
    });
    return requireData(data, `PATCH /employee-documents/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },

  async listDocumentTypes({ signal }, params) {
    // Real Laravel endpoint: `Route::apiResource('document-types', ...)` in
    // `backend/routes/api/document.php` (index → `{ data, meta }`, permission
    // `document.document_type.view`). `category` is one of the controller's
    // `$filterable` fields; sorting by `sort_order` preserves the intended
    // order because the backend defaults to `id DESC`.
    const { data } = await http(DOC_TYPES_BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        search: params.search || undefined,
        category: params.category,
        sort: params.sort,
        direction: params.direction,
      },
      signal,
      schema: documentTypeListDecoder,
    });
    return requireData(data, 'GET /document-types');
  },

  async listAllDocumentTypes({ signal }) {
    // Dropdowns need every type in display order; the settings tab uses the
    // paginated `listDocumentTypes` above instead.
    const { data } = await http(DOC_TYPES_BASE, {
      query: { per_page: 100, sort: 'sort_order', direction: 'asc' },
      signal,
      schema: documentTypeListDecoder,
    });
    return requireData(data, 'GET /document-types').data;
  },

  async createDocumentType({ signal }, input) {
    const { data } = await http(DOC_TYPES_BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: documentTypeEnvelopeDecoder,
    });
    return requireData(data, 'POST /document-types').data;
  },

  async updateDocumentType({ signal }, id, input) {
    const { data } = await http(`${DOC_TYPES_BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: documentTypeEnvelopeDecoder,
    });
    return requireData(data, `PATCH /document-types/${id}`).data;
  },

  async removeDocumentType({ signal }, id) {
    await http(`${DOC_TYPES_BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },

  async countDocumentTemplates({ signal }) {
    const { data } = await http(DOC_TEMPLATES_BASE, {
      query: { per_page: 1 },
      signal,
      schema: documentTemplateCountDecoder,
    });
    return requireData(data, 'GET /document-templates').meta.total;
  },
};

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

/**
 * Chooses the transport once per app, exactly like the Employees feature:
 * mock is the default whenever no API base URL is configured, so the
 * Documents page is fully interactive before the Laravel backend is wired
 * up, and a build pointed at a real backend switches with no code change.
 */
export const employeeDocumentApi: EmployeeDocumentApi = env.useMockApi
  ? mockEmployeeDocumentApi
  : httpEmployeeDocumentApi;

if (env.isDev && env.useMockApi) {
  // Review affordance for loading/error/rollback states:
  //   __documentsMock.setFailureRate(1)  // force every request to fail
  //   __documentsMock.reset()            // restore seed data
  Object.defineProperty(window, '__documentsMock', {
    value: { setFailureRate: setMockDocumentFailureRate, reset: resetMockEmployeeDocuments },
    configurable: true,
  });
}

export type {
  EmployeeDocumentInput,
  EmployeeDocumentUpdateInput,
  EmployeeDocumentListParams,
};
