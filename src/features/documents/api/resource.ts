import type { FetchContext, QueryKey } from '@/lib/query';
import type {
  EmployeeDocumentListWire,
  EmployeeDocumentWire,
  DocumentTypeListWire,
  DocumentTypeWire,
} from './schema';

/**
 * The Documents module's remote resource contract.
 *
 * Components never call this directly — they go through the query hooks in
 * `queries.ts`. Two implementations satisfy it: `httpEmployeeDocumentApi`
 * (real Laravel endpoints under `/api/v1/employee-documents`) and
 * `mockEmployeeDocumentApi` (in-process, the default until a backend is
 * configured). Mirrors the Attendance feature's exact `api/` pattern.
 */

/**
 * Real backend values from `StoreEmployeeDocumentRequest`:
 *   valid | expired | pending_renewal
 *
 * The old UI mock used `expiring_soon` and `pending` — these do NOT exist
 * in the real schema. `pending` → `pending_renewal`. `expiring_soon` is a
 * client-side visual annotation (status=valid + expiry_date within 30 days).
 */
export type EmployeeDocumentStatus = 'valid' | 'expired' | 'pending_renewal';

export type DocumentTypeCategory =
  | 'identification'
  | 'contract'
  | 'certificate'
  | 'license'
  | 'other';

export interface EmployeeDocumentListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  status?: EmployeeDocumentStatus | undefined;
  employeeId?: number | undefined;
  documentTypeId?: number | undefined;
}

/** Shape of `StoreEmployeeDocumentRequest`'s validated fields. */
export interface EmployeeDocumentInput {
  employee_id: number;
  document_type_id: number;
  title: string;
  file_path: string;
  file_name: string;
  file_size?: number | null;
  mime_type?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  document_number?: string | null;
  notes?: string | null;
  status?: EmployeeDocumentStatus | null;
}

/** `UpdateEmployeeDocumentRequest` wraps the same fields in `sometimes` — any subset is valid. */
export type EmployeeDocumentUpdateInput = Partial<EmployeeDocumentInput>;

export interface EmployeeDocumentApi {
  list(context: FetchContext, params: EmployeeDocumentListParams): Promise<EmployeeDocumentListWire>;
  create(context: FetchContext, input: EmployeeDocumentInput): Promise<EmployeeDocumentWire>;
  update(context: FetchContext, id: number, input: EmployeeDocumentUpdateInput): Promise<EmployeeDocumentWire>;
  remove(context: FetchContext, id: number): Promise<void>;
  /** Fetch the full document-type reference table (small, perPage:100). */
  listDocumentTypes(context: FetchContext): Promise<DocumentTypeWire[]>;
  /** Fetch meta.total only for document-templates stat card (perPage:1). */
  countDocumentTemplates(context: FetchContext): Promise<number>;
}

/**
 * Cache keys. Every employee-documents read hangs off `all` so invalidation
 * after a write is total. Document types live under their own stable key.
 */
export const employeeDocumentKeys = {
  all: ['employeeDocuments'] as const satisfies QueryKey,
  list: (params: EmployeeDocumentListParams) =>
    ['employeeDocuments', 'list', params] as const satisfies QueryKey,
  documentTypes: ['employeeDocuments', 'documentTypes'] as const satisfies QueryKey,
  templateCount: ['employeeDocuments', 'templateCount'] as const satisfies QueryKey,
};

/** Narrow DocumentTypeListWire type so the queries file can reference it. */
export type { EmployeeDocumentListWire, EmployeeDocumentWire, DocumentTypeListWire, DocumentTypeWire };
