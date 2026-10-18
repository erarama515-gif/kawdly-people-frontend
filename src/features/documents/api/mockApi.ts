import { ApiError } from '@/lib/api/errors';
import type { FetchContext } from '@/lib/query';
import { pravatar } from '@/features/dashboard/model';
import {
  employeeDocumentDecoder,
  employeeDocumentListDecoder,
} from './schema';
import type {
  EmployeeDocumentListWire,
  EmployeeDocumentWire,
  DocumentTypeWire,
} from './schema';
import type {
  EmployeeDocumentApi,
  EmployeeDocumentStatus,
} from './resource';

/**
 * In-process implementation of `EmployeeDocumentApi`, used until the Laravel
 * backend is configured (the default — see `env.useMockApi`).
 *
 * Mirrors `attendance/api/mockApi.ts` exactly: mutable store, simulated
 * latency, AbortSignal support, and every response decoded through the same
 * decoders a real HTTP response would go through.
 *
 * Known mismatch vs. old mock — fixed here:
 *  - `expiring_soon` and `pending` are NOT real backend statuses.
 *    Only `valid | expired | pending_renewal` exist in the real schema.
 *    "Expiring soon" is computed client-side as a visual badge.
 *  - Employee data comes from the `employee` relation, not flat fields.
 *  - `documentType` is resolved from the DocumentType table via FK.
 */

// ─── Mock document types (DEV-ONLY transport seed) ────────────────────────────
//
// Used exclusively by `mockEmployeeDocumentApi` when `env.useMockApi` is true
// (the zero-config dev default). Production builds either point at the real
// `/document-types` endpoint or refuse to boot — see the guard in
// `src/config/env.ts`. Nothing outside this file consumes these rows.

export const MOCK_DOCUMENT_TYPES: DocumentTypeWire[] = [
  { id: 1, name: 'National ID',          category: 'identification', has_expiry: true,  is_required: true,  sort_order: 1 },
  { id: 2, name: 'Passport',             category: 'identification', has_expiry: true,  is_required: true,  sort_order: 2 },
  { id: 3, name: 'Work Permit',          category: 'license',        has_expiry: true,  is_required: true,  sort_order: 3 },
  { id: 4, name: 'Residence Permit',     category: 'identification', has_expiry: true,  is_required: false, sort_order: 4 },
  { id: 5, name: 'Employment Contract',  category: 'contract',       has_expiry: true,  is_required: true,  sort_order: 5 },
  { id: 6, name: 'NDA',                  category: 'contract',       has_expiry: false, is_required: false, sort_order: 6 },
  { id: 7, name: 'Degree Certificate',   category: 'certificate',    has_expiry: false, is_required: false, sort_order: 7 },
  { id: 8, name: 'Driving License',      category: 'license',        has_expiry: true,  is_required: false, sort_order: 8 },
];

// ─── Internal store shape ─────────────────────────────────────────────────────

interface StoredEmployeeDocument {
  id: number;
  employee_id: number;
  document_type_id: number;
  title: string;
  file_path: string;
  file_name: string;
  file_size?: number | undefined;
  mime_type?: string | undefined;
  issue_date?: string | undefined;
  expiry_date?: string | undefined;
  document_number?: string | undefined;
  notes?: string | undefined;
  status?: EmployeeDocumentStatus | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
}

/**
 * A small in-memory roster of employee stubs so the mock can populate the
 * `employee` relation without importing from the employees mock store.
 * Employee IDs match the anchor IDs used in `attendance/api/mockApi.ts`.
 */
interface EmployeeRef {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  photo?: string | undefined;
}

const EMPLOYEE_STUBS: EmployeeRef[] = [
  { id: 43,   employee_number: 'EMP-00043', first_name: 'Ahmed',  last_name: 'Sami',    photo: pravatar(53) },
  { id: 71,   employee_number: 'EMP-00071', first_name: 'Mona',   last_name: 'Khaled',  photo: pravatar(44) },
  { id: 89,   employee_number: 'EMP-00089', first_name: 'Salma',  last_name: 'Adel',    photo: pravatar(9)  },
  { id: 112,  employee_number: 'EMP-00112', first_name: 'Karim',  last_name: 'Fouad',   photo: pravatar(26) },
  { id: 134,  employee_number: 'EMP-00134', first_name: 'Layla',  last_name: 'Mostafa', photo: pravatar(47) },
  { id: 158,  employee_number: 'EMP-00158', first_name: 'Omar',   last_name: 'Hassan',  photo: pravatar(33) },
  { id: 177,  employee_number: 'EMP-00177', first_name: 'Nadia',  last_name: 'Fahmy',   photo: pravatar(21) },
  { id: 203,  employee_number: 'EMP-00203', first_name: 'Tamer',  last_name: 'Zakaria', photo: pravatar(13) },
];

const EMPLOYEE_IDS = EMPLOYEE_STUBS.map((e) => e.id);

const STATUSES: EmployeeDocumentStatus[] = [
  'valid', 'valid', 'valid', 'valid',
  'expired', 'expired',
  'pending_renewal',
];

const BASE_DATE = '2026-10-06';

/** Deterministic filler so pagination has something to page through. */
function generateFiller(count: number, startId: number): StoredEmployeeDocument[] {
  const rows: StoredEmployeeDocument[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = startId + index;
    const empId = EMPLOYEE_IDS[index % EMPLOYEE_IDS.length];
    const docTypeId = (index % MOCK_DOCUMENT_TYPES.length) + 1;
    const docType = MOCK_DOCUMENT_TYPES[docTypeId - 1];
    const status = STATUSES[index % STATUSES.length];

    // Spread issue dates around the past 3 years
    const yearsAgo = 1 + Math.floor(index / 20);
    const issueYear = 2026 - yearsAgo;
    const issueMonth = String(1 + (index % 12)).padStart(2, '0');
    const issueDate = `${issueYear}-${issueMonth}-01`;

    const expiryDate = docType?.has_expiry
      ? `${issueYear + 5}-${issueMonth}-01`
      : undefined;

    const stamp = `${BASE_DATE}T00:00:00.000Z`;

    rows.push({
      id,
      employee_id: empId,
      document_type_id: docTypeId,
      title: `${docType?.name ?? 'Document'} - EMP-${String(empId).padStart(5, '0')}`,
      file_path: `/uploads/documents/emp-${empId}-doc-${id}.pdf`,
      file_name: `document-${id}.pdf`,
      file_size: 512_000 + index * 1024,
      mime_type: 'application/pdf',
      issue_date: issueDate,
      expiry_date: expiryDate,
      document_number: `DOC-${String(id).padStart(6, '0')}`,
      status,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  return rows;
}

/** The original anchor rows drawn from the static `data.ts` mock, mapped to real schema. */
function makeAnchors(): StoredEmployeeDocument[] {
  const stamp = `${BASE_DATE}T00:00:00.000Z`;
  return [
    {
      id: 1, employee_id: 43,  document_type_id: 2, title: 'Ahmed Sami Passport',
      file_path: '/uploads/docs/ahmed-passport.pdf', file_name: 'ahmed-passport.pdf',
      file_size: 1_024_000, mime_type: 'application/pdf',
      issue_date: '2021-04-10', expiry_date: '2031-04-09',
      document_number: 'A12345678', status: 'valid',
      created_at: stamp, updated_at: stamp,
    },
    {
      id: 2, employee_id: 71, document_type_id: 4, title: 'Mona Khaled Residence Permit',
      file_path: '/uploads/docs/mona-residence.pdf', file_name: 'mona-residence.pdf',
      file_size: 768_000, mime_type: 'application/pdf',
      issue_date: '2021-09-15', expiry_date: '2025-10-08',
      document_number: 'RP-2021-003412',
      // old mock had `expiring_soon` — real backend has `valid` or `expired`; this one is past its date so `expired`
      status: 'expired',
      created_at: stamp, updated_at: stamp,
    },
    {
      id: 3, employee_id: 89, document_type_id: 3, title: 'Salma Adel Work Permit',
      file_path: '/uploads/docs/salma-work-permit.pdf', file_name: 'salma-work-permit.pdf',
      file_size: 640_000, mime_type: 'application/pdf',
      issue_date: '2022-06-01', expiry_date: '2025-08-31',
      document_number: 'WP-EGY-2022-0087', status: 'expired',
      created_at: stamp, updated_at: stamp,
    },
    {
      id: 4, employee_id: 112, document_type_id: 1, title: 'Karim Fouad National ID',
      file_path: '/uploads/docs/karim-national-id.pdf', file_name: 'karim-national-id.pdf',
      file_size: 256_000, mime_type: 'application/pdf',
      issue_date: '2019-01-02', expiry_date: '2029-01-01',
      document_number: '29901012301234', status: 'valid',
      created_at: stamp, updated_at: stamp,
    },
    {
      id: 5, employee_id: 134, document_type_id: 6, title: 'Layla Mostafa NDA',
      file_path: '/uploads/docs/layla-nda.pdf', file_name: 'layla-nda.pdf',
      file_size: 128_000, mime_type: 'application/pdf',
      issue_date: '2025-10-01', expiry_date: undefined,
      document_number: 'NDA-2025-0112',
      // old mock had `pending` — maps to `pending_renewal` in real schema
      status: 'pending_renewal',
      created_at: stamp, updated_at: stamp,
    },
    {
      id: 6, employee_id: 158, document_type_id: 5, title: 'Omar Hassan Employment Contract',
      file_path: '/uploads/docs/omar-contract.pdf', file_name: 'omar-contract.pdf',
      file_size: 512_000, mime_type: 'application/pdf',
      issue_date: '2024-06-01', expiry_date: '2026-05-31',
      document_number: 'EC-2024-0603', status: 'valid',
      created_at: stamp, updated_at: stamp,
    },
  ];
}

function seed(): StoredEmployeeDocument[] {
  return [...makeAnchors(), ...generateFiller(36, 100)];
}

let store: StoredEmployeeDocument[] = seed();
let nextId = 1000;

export function resetMockEmployeeDocuments(): void {
  store = seed();
  nextId = 1000;
}

/** Failure injection for reviewing error/rollback UI. */
const FAILURE_RATE_KEY = 'kawdly.employeeDocumentsMockFailureRate';

function readFailureRate(): number {
  const raw = sessionStorage.getItem(FAILURE_RATE_KEY);
  const parsed = Number(raw);
  return raw !== null && Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
}

let failureRate = readFailureRate();

export function setMockDocumentFailureRate(rate: number): void {
  failureRate = Math.min(Math.max(rate, 0), 1);
  sessionStorage.setItem(FAILURE_RATE_KEY, String(failureRate));
}

const READ_LATENCY_MS = 220;
const WRITE_LATENCY_MS = 420;

export const mockEmployeeDocumentApi: EmployeeDocumentApi = {
  async list(context, params) {
    await simulate(context, READ_LATENCY_MS);

    const search = params.search?.trim().toLowerCase();
    const filtered = store.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.employeeId && row.employee_id !== params.employeeId) return false;
      if (params.documentTypeId && row.document_type_id !== params.documentTypeId) return false;
      if (!search) return true;
      const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id);
      const docType = MOCK_DOCUMENT_TYPES.find((dt) => dt.id === row.document_type_id);
      const haystack = [
        emp ? `${emp.first_name} ${emp.last_name} ${emp.employee_number}` : '',
        docType?.name ?? '',
        row.title,
        row.document_number ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });

    const perPage = params.perPage && params.perPage > 0 ? Math.min(params.perPage, 200) : 25;
    const currentPage = params.page && params.page > 0 ? params.page : 1;
    const total = filtered.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(currentPage, lastPage);
    const start = (safePage - 1) * perPage;
    const page = filtered.slice(start, start + perPage);

    const wire: EmployeeDocumentListWire = {
      data: page.map(toWire),
      meta: { current_page: safePage, per_page: perPage, total, last_page: lastPage },
    };
    return employeeDocumentListDecoder.decode(structuredClone(wire));
  },

  async create(context, input) {
    await simulate(context, WRITE_LATENCY_MS);

    const id = nextId;
    nextId += 1;
    const stamp = new Date().toISOString();
    const row: StoredEmployeeDocument = {
      id,
      employee_id: input.employee_id,
      document_type_id: input.document_type_id,
      title: input.title,
      file_path: input.file_path,
      file_name: input.file_name,
      file_size: input.file_size ?? undefined,
      mime_type: input.mime_type ?? undefined,
      issue_date: input.issue_date ?? undefined,
      expiry_date: input.expiry_date ?? undefined,
      document_number: input.document_number ?? undefined,
      notes: input.notes ?? undefined,
      status: (input.status as EmployeeDocumentStatus | null | undefined) ?? undefined,
      created_at: stamp,
      updated_at: stamp,
    };
    store = [row, ...store];
    return employeeDocumentDecoder.decode(structuredClone(toWire(row)));
  },

  async update(context, id, input) {
    await simulate(context, WRITE_LATENCY_MS);
    const row = findOrThrow(id);

    const updated: StoredEmployeeDocument = {
      id: row.id,
      created_at: row.created_at,
      updated_at: new Date().toISOString(),
      employee_id: input.employee_id ?? row.employee_id,
      document_type_id: input.document_type_id ?? row.document_type_id,
      title: input.title ?? row.title,
      file_path: input.file_path ?? row.file_path,
      file_name: input.file_name ?? row.file_name,
      file_size: input.file_size === null ? undefined : (input.file_size ?? row.file_size),
      mime_type: input.mime_type === null ? undefined : (input.mime_type ?? row.mime_type),
      issue_date: input.issue_date === null ? undefined : (input.issue_date ?? row.issue_date),
      expiry_date: input.expiry_date === null ? undefined : (input.expiry_date ?? row.expiry_date),
      document_number: input.document_number === null ? undefined : (input.document_number ?? row.document_number),
      notes: input.notes === null ? undefined : (input.notes ?? row.notes),
      status: input.status === null
        ? undefined
        : ((input.status as EmployeeDocumentStatus | undefined) ?? row.status),
    };
    store = store.map((item) => (item.id === id ? updated : item));
    return employeeDocumentDecoder.decode(structuredClone(toWire(updated)));
  },

  async remove(context, id) {
    await simulate(context, WRITE_LATENCY_MS);
    findOrThrow(id);
    store = store.filter((item) => item.id !== id);
  },

  async listDocumentTypes(context) {
    await simulate(context, READ_LATENCY_MS);
    return structuredClone(MOCK_DOCUMENT_TYPES);
  },

  async countDocumentTemplates(context) {
    await simulate(context, READ_LATENCY_MS);
    // Mock: 12 templates
    return 12;
  },
};

function toWire(row: StoredEmployeeDocument): EmployeeDocumentWire {
  const emp = EMPLOYEE_STUBS.find((e) => e.id === row.employee_id);
  const docType = MOCK_DOCUMENT_TYPES.find((dt) => dt.id === row.document_type_id);
  return {
    ...row,
    employee: emp ? { ...emp } : undefined,
    document_type: docType
      ? { id: docType.id, name: docType.name, category: docType.category }
      : undefined,
  } as unknown as EmployeeDocumentWire;
}

function findOrThrow(id: number): StoredEmployeeDocument {
  const row = store.find((item) => item.id === id);
  if (!row) throw new ApiError('http', `EmployeeDocument ${id} not found`, { status: 404 });
  return row;
}

/** Simulated network delay that rejects promptly when the caller aborts. */
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
