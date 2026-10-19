import { appHttpClient as http } from '@/lib/api/appHttpClient';

/**
 * Shape of the copilot answer returned by POST /copilot/query.
 */
export interface CopilotAnswer {
  answer: string;
  /** "text" | "number" | "table" */
  type: 'text' | 'number' | 'table';
  /** Raw data: null, a number, a string[], or an array of objects. */
  raw: null | number | string[] | Record<string, unknown>[];
}

/**
 * Post a natural-language question to the AI Copilot endpoint.
 *
 * Maps POST /api/v1/copilot/query → { data: { answer, type, raw } }
 */
export async function askCopilot(question: string): Promise<CopilotAnswer> {
  const { data } = await http<{ data: CopilotAnswer }>('/copilot/query', {
    method: 'POST',
    body: { question },
    ignoreBody: false,
  });

  if (!data) {
    throw new Error('POST /copilot/query returned an empty body');
  }

  return data.data;
}
