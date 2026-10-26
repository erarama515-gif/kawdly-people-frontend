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

/** Query params accepted by `GET /document-types` (see `DocumentTypeController::$filterable`). */
export interface DocumentTypeListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  category?: DocumentTypeCategory | undefined;
  sort?: 'id' | 'name' | 'sort_order' | 'created_at' | undefined;
  direction?: 'asc' | 'desc' | undefined;
}

/** Shape of `StoreDocumentTypeRequest`'s validated fields. */
export interface DocumentTypeInput {
  company_id: number;
  name: string;
  category: DocumentTypeCategory;
  has_expiry?: boolean;
  is_required?: boolean;
  sort_order?: number | null;
}

/** `UpdateDocumentTypeRequest` omits `company_id`: the trait keeps the existing value. */
export type DocumentTypeUpdateInput = Partial<Omit<DocumentTypeInput, 'company_id'>>;

export interface EmployeeDocumentListParams {
  page?: number;
  perPage?: number;
  search?: string | undefined;
  sort?: string | undefined;
  direction?: 'asc' | 'desc' | undefined;
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
  /** Paginated document-type listing for the settings CRUD tab. */
  listDocumentTypes(context: FetchContext, params: DocumentTypeListParams): Promise<DocumentTypeListWire>;
  /** Fetch the full document-type reference table for dropdowns (small, perPage:100). */
  listAllDocumentTypes(context: FetchContext): Promise<DocumentTypeWire[]>;
  createDocumentType(context: FetchContext, input: DocumentTypeInput): Promise<DocumentTypeWire>;
  updateDocumentType(context: FetchContext, id: number, input: DocumentTypeUpdateInput): Promise<DocumentTypeWire>;
  removeDocumentType(context: FetchContext, id: number): Promise<void>;
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
  templateCount: ['employeeDocuments', 'templateCount'] as const satisfies QueryKey,
};

/** Document types have their own root so mutations can invalidate them independently. */
export const documentTypeKeys = {
  all: ['documentTypes'] as const satisfies QueryKey,
  list: (params: DocumentTypeListParams) =>
    ['documentTypes', 'list', params] as const satisfies QueryKey,
  dropdown: ['documentTypes', 'dropdown'] as const satisfies QueryKey,
};

/** Narrow DocumentTypeListWire type so the queries file can reference it. */
export type { EmployeeDocumentListWire, EmployeeDocumentWire, DocumentTypeListWire, DocumentTypeWire };
