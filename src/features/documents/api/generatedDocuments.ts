import { useMutation, useQuery, useQueryClient } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { getAuthorizationHeader } from '@/auth/token';
import { env } from '@/config/env';
import {
  array,
  bool,
  literalUnion,
  num,
  object,
  optional,
  passthrough,
  record,
  str,
} from '@/lib/api/decode';

/**
 * Wire shapes + hooks for the generated-document engine (A6.3).
 *
 * The backend exposes two surfaces:
 *  - `/document-templates` (the template catalogue + its variable catalogue)
 *  - `/documents` (the generated documents, their lifecycle, and the PDF)
 *
 * The generated-document list endpoint always eager-loads `template`,
 * `employee`, and `generatedBy`, so a single request is enough to render the
 * table without an N+1 round-trip per row.
 */

export const generatedDocumentStatusDecoder = literalUnion([
  'draft',
  'final',
  'revoked',
] as const);

export type GeneratedDocumentStatus = ReturnType<typeof generatedDocumentStatusDecoder.decode>;

const templateRefDecoder = object({
  id: num(),
  name: str(),
});

const employeeRefDecoder = object({
  id: num(),
  first_name: str(),
  last_name: str(),
  first_name_ar: optional(str()),
  last_name_ar: optional(str()),
});

export const generatedDocumentDecoder = object({
  id: num(),
  template_id: num(),
  employee_id: num(),
  title: str(),
  content_html: str(),
  content_data: optional(passthrough<Record<string, unknown>>()),
  reference_number: str(),
  status: generatedDocumentStatusDecoder,
  file_path: optional(str()),
  generated_at: optional(str()),
  finalized_at: optional(str()),
  revoked_at: optional(str()),
  revoke_reason: optional(str()),
  template: optional(templateRefDecoder),
  employee: optional(employeeRefDecoder),
});

export type GeneratedDocumentWire = ReturnType<typeof generatedDocumentDecoder.decode>;

const generatedDocumentListDecoder = object({
  data: array(generatedDocumentDecoder),
  meta: object({
    current_page: num(),
    per_page: num(),
    total: num(),
    last_page: num(),
  }),
});

export type GeneratedDocumentListWire = ReturnType<typeof generatedDocumentListDecoder.decode>;

const generatedDocumentEnvelopeDecoder = object({ data: generatedDocumentDecoder });

export const documentTemplateDecoder = object({
  id: num(),
  name: str(),
  category: optional(str()),
  format: optional(str()),
  is_active: optional(bool()),
});

export type DocumentTemplateWire = ReturnType<typeof documentTemplateDecoder.decode>;

const documentTemplateListDecoder = object({
  data: array(documentTemplateDecoder),
  meta: object({
    current_page: num(),
    per_page: num(),
    total: num(),
    last_page: num(),
  }),
});

const templateVariablesDecoder = object({
  data: record(array(str())),
});

export type TemplateVariablesWire = ReturnType<typeof templateVariablesDecoder.decode>['data'];

const previewDecoder = object({
  data: object({ html: str() }),
});

const GENERATED_ROOT = ['documents', 'generated'] as const;

function isGeneratedKey(key: readonly unknown[]): boolean {
  return key[0] === 'documents' && key[1] === 'generated';
}

export interface UseGeneratedDocumentListResult {
  state: QueryState<GeneratedDocumentListWire>;
  refetch: () => void;
}

export interface GeneratedDocumentListParams {
  page: number;
  perPage: number;
  search?: string | undefined;
  status?: GeneratedDocumentStatus | undefined;
}

export function useGeneratedDocumentList(
  params: GeneratedDocumentListParams,
): UseGeneratedDocumentListResult {
  const { state, refetch } = useQuery<GeneratedDocumentListWire>({
    queryKey: [...GENERATED_ROOT, 'list', params] as const,
    queryFn: async (context) => {
      const { data } = await http('/documents', {
        query: {
          page: params.page,
          per_page: params.perPage,
          search: params.search || undefined,
          status: params.status,
        },
        signal: context.signal,
        schema: generatedDocumentListDecoder,
      });
      if (data === undefined) {
        throw new Error('GET /documents returned an empty body');
      }
      return data;
    },
    staleTime: 15_000,
  });

  return { state, refetch };
}

export interface UseDocumentTemplateOptionsResult {
  state: QueryState<DocumentTemplateWire[]>;
}

/** Active templates for the generator's template picker, alphabetical. */
export function useDocumentTemplateOptions(): UseDocumentTemplateOptionsResult {
  const { state } = useQuery<DocumentTemplateWire[]>({
    queryKey: [...GENERATED_ROOT, 'templates'] as const,
    queryFn: async (context) => {
      const { data } = await http('/document-templates', {
        query: { per_page: 200, is_active: 1, sort: 'name', direction: 'asc' },
        signal: context.signal,
        schema: documentTemplateListDecoder,
      });
      if (data === undefined) {
        throw new Error('GET /document-templates returned an empty body');
      }
      return data.data;
    },
    staleTime: 300_000,
  });

  return { state };
}

/** The variable names the template engine understands, grouped by category. */
export function useTemplateVariables(): QueryState<TemplateVariablesWire> {
  const { state } = useQuery<TemplateVariablesWire>({
    queryKey: [...GENERATED_ROOT, 'variables'] as const,
    queryFn: async (context) => {
      const { data } = await http('/document-templates/variables', {
        signal: context.signal,
        schema: templateVariablesDecoder,
      });
      if (data === undefined) {
        throw new Error('GET /document-templates/variables returned an empty body');
      }
      return data.data;
    },
    staleTime: 300_000,
  });

  return state;
}

export interface PreviewDocumentInput {
  templateId: number;
  employeeId: number;
  extraData?: Record<string, string> | undefined;
}

/** Renders the template with the employee's live data and returns the HTML. */
export function usePreviewDocument() {
  return useMutation<PreviewDocumentInput, string>({
    mutationFn: async ({ templateId, employeeId, extraData }, { signal }) => {
      const { data } = await http(`/document-templates/${templateId}/preview`, {
        method: 'POST',
        body: { employee_id: employeeId, extra_data: extraData ?? {} },
        signal,
        schema: previewDecoder,
      });
      if (data === undefined) {
        throw new Error(`POST /document-templates/${templateId}/preview returned an empty body`);
      }
      return data.data.html;
    },
  });
}

export interface GenerateDocumentInput {
  template_id: number;
  employee_id: number;
  extra_data?: Record<string, string> | undefined;
}

export function useGenerateDocument() {
  const client = useQueryClient();

  return useMutation<GenerateDocumentInput, GeneratedDocumentWire>({
    mutationFn: async (input, { signal }) => {
      const { data } = await http('/documents/generate', {
        method: 'POST',
        body: input,
        signal,
        schema: generatedDocumentEnvelopeDecoder,
      });
      if (data === undefined) {
        throw new Error('POST /documents/generate returned an empty body');
      }
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isGeneratedKey });
    },
  });
}

export function useFinalizeGeneratedDocument() {
  const client = useQueryClient();

  return useMutation<number, GeneratedDocumentWire>({
    mutationFn: async (id, { signal }) => {
      const { data } = await http(`/documents/${id}/finalize`, {
        method: 'POST',
        signal,
        schema: generatedDocumentEnvelopeDecoder,
      });
      if (data === undefined) {
        throw new Error(`POST /documents/${id}/finalize returned an empty body`);
      }
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isGeneratedKey });
    },
  });
}

export interface RevokeDocumentInput {
  id: number;
  reason: string;
}

export function useRevokeGeneratedDocument() {
  const client = useQueryClient();

  return useMutation<RevokeDocumentInput, GeneratedDocumentWire>({
    mutationFn: async ({ id, reason }, { signal }) => {
      const { data } = await http(`/documents/${id}/revoke`, {
        method: 'POST',
        body: { reason },
        signal,
        schema: generatedDocumentEnvelopeDecoder,
      });
      if (data === undefined) {
        throw new Error(`POST /documents/${id}/revoke returned an empty body`);
      }
      return data.data;
    },
    onSuccess: () => {
      void client.invalidate({ predicate: isGeneratedKey });
    },
  });
}

/**
 * Downloads the finalized PDF through the authenticated transport.
 *
 * The shared JSON client cannot be used here (it always parses a JSON body), so
 * this builds the same URL and attaches the bearer token by hand, then hands
 * the blob to a temporary anchor.
 */
export async function downloadGeneratedDocument(document: GeneratedDocumentWire): Promise<void> {
  const base = env.apiBaseUrl || '/api/v1';
  const authorization = getAuthorizationHeader();
  const response = await fetch(`${base}/documents/${document.id}/download`, {
    method: 'GET',
    headers: {
      Accept: 'application/pdf',
      ...(authorization ? { Authorization: authorization } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.download = `${document.reference_number}.pdf`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
