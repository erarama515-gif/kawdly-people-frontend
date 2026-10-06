import { array, isoDate, literalUnion, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for the Learning / TrainingProgram module, matching the real
 * Laravel contract exactly: field names are the DB columns verbatim
 * (snake_case), and the `index` envelope is the app's custom `{ data, meta }`
 * pager.
 *
 * `duration_hours` is cast to `decimal:1` by the model — the API returns it
 * as a string ("4.0") so we decode it as `str()` (same pattern as
 * `regular_hours` in the Attendance module).
 *
 * Status enum: `planned | ongoing | completed | cancelled` — the old mock's
 * `active | scheduled | draft` are not real backend values and are dropped here.
 */

export const trainingProgramStatusDecoder = literalUnion([
  'planned',
  'ongoing',
  'completed',
  'cancelled',
] as const);

export const trainingProgramTypeDecoder = literalUnion([
  'internal',
  'external',
  'online',
] as const);

export const trainingProgramDecoder = object({
  id: num(),
  company_id: num(),
  title: str(),
  description: optional(str()),
  category: optional(str()),
  type: trainingProgramTypeDecoder,
  /** Plain name string — no employee FK, no initials/photo columns. */
  trainer_name: optional(str()),
  /** decimal:1 cast → returned as a string by the API, e.g. "4.0". */
  duration_hours: optional(str()),
  cost: optional(num()),
  max_participants: optional(num()),
  start_date: isoDate(),
  end_date: isoDate(),
  location: optional(str()),
  status: optional(trainingProgramStatusDecoder),
  created_at: optional(str()),
  updated_at: optional(str()),
});

export type TrainingProgramWire = ReturnType<typeof trainingProgramDecoder.decode>;

export const pageMetaDecoder = object({
  current_page: num(),
  per_page: num(),
  total: num(),
  last_page: num(),
});

export type PageMetaWire = ReturnType<typeof pageMetaDecoder.decode>;

export const trainingProgramListDecoder = object({
  data: array(trainingProgramDecoder),
  meta: pageMetaDecoder,
});

export type TrainingProgramListWire = ReturnType<typeof trainingProgramListDecoder.decode>;

export const trainingProgramEnvelopeDecoder = object({ data: trainingProgramDecoder });
export type TrainingProgramEnvelopeWire = ReturnType<typeof trainingProgramEnvelopeDecoder.decode>;
