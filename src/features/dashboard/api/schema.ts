import { ROLES } from '@/auth/session';
import { array, bool, isoDate, literalUnion, num, object, optional, record, str, union } from '@/lib/api/decode';
import type { Decoder } from '@/lib/api/decode';
import { ApiError } from '@/lib/api/errors';

/**
 * Wire schemas for the dashboard. Every response is validated here, so drift
 * between backend and UI surfaces as a typed `decode` error (with a path)
 * instead of an undefined crash three components deep.
 */

export const queueIdDecoder = literalUnion([
  'leave',
  'payroll',
  'contracts',
  'leaveFromTeam',
  'performanceReview',
] as const);

export const alertIdDecoder = literalUnion(['payroll', 'reviewCycle'] as const);
export const roleDecoder = literalUnion(ROLES);

const localeText = object({ ar: str(), en: str() });

/** Interpolation values for a translated alert body ("approve the remaining 3"). */
const params = record(union<string | number>(str(), num()));

const decisionQueueRow = object({
  id: queueIdDecoder,
  kind: literalUnion(['people', 'company'] as const),
  captionKey: str(),
  descriptionKey: str(),
  descriptionParams: optional(params),
  actionKey: str(),
  count: num(),
  sample: optional(array(object({ initials: localeText, photo: optional(str()) }))),
  overflowCount: optional(num()),
  urgent: optional(bool()),
  priority: literalUnion(['primary', 'secondary'] as const),
});

const kpi = object({
  id: str(),
  captionKey: str(),
  value: num(),
  suffix: optional(str()),
  deltaKey: str(),
  deltaSuffixKey: optional(str()),
  up: bool(),
  trend: array(num()),
  path: str(),
});

const attendance = object({
  today: num(),
  weekTrend: array(num()),
  weekLabels: array(localeText),
  totalEmployees: num(),
  present: num(),
  absent: num(),
  late: num(),
});

const upcomingItem = object({
  id: str(),
  kind: literalUnion(['contract', 'birthday'] as const),
  name: localeText,
  meta: localeText,
  when: localeText,
  photo: optional(str()),
  urgent: optional(bool()),
});

/**
 * One alert row. `segments` is an ordered message template so the server owns
 * the wording and which value is emphasised, while `params` supplies the values
 * those segments reference — no English or Arabic sentence structure is hardcoded
 * in the UI.
 *
 * The segment union is hand-decoded rather than built with `union()`, because the
 * two branches have different fields and `object()` cannot express that.
 */
export type AlertSegment = { kind: 'text'; key: string } | { kind: 'value'; name: string };

export const alertSegmentDecoder: Decoder<AlertSegment> = {
  expected: `{ kind: text, key: string } | { kind: value, name: string }`,
  decode(input, path = '') {
    const { kind, key, name } = object({
      kind: str(),
      key: optional(str()),
      name: optional(str()),
    }).decode(input, path);

    if (kind === 'text' && key !== undefined) return { kind: 'text', key };
    if (kind === 'value' && name !== undefined) return { kind: 'value', name };
    throw new ApiError('decode', `Invalid response at "${path || '$'}": expected an alert segment`);
  },
};

export const alertDecoder = object({
  id: alertIdDecoder,
  segments: array(alertSegmentDecoder),
  params: optional(params),
});

const quickAction = object({
  key: str(),
  labelKey: str(),
  to: str(),
  tone: literalUnion(['primary', 'secondary', 'tertiary'] as const),
});

const myLeaveRequest = object({
  id: num(),
  leaveType: str(),
  startDate: isoDate(),
  endDate: isoDate(),
  days: num(),
  status: str(),
});

const myPayslipSummary = object({
  id: num(),
  period: str(),
  net: num(),
  status: str(),
});

/** The full dashboard payload for one role, as served by the API. */
export const dashboardDatasetDecoder = object({
  mode: literalUnion(['admin', 'manager', 'self'] as const),
  queues: array(decisionQueueRow),
  kpis: array(kpi),
  departments: array(object({ name: localeText, count: num() })),
  teamRoster: array(
    object({
      name: localeText,
      title: localeText,
      status: literalUnion(['active', 'leave'] as const),
      photo: optional(str()),
    }),
  ),
  attendance,
  upcoming: array(upcomingItem),
  updatedAt: isoDate(),
  quickActions: optional(array(quickAction)),
  myRequests: optional(array(myLeaveRequest)),
  myPayslip: optional(myPayslipSummary),
});

export type DashboardDatasetWire = ReturnType<typeof dashboardDatasetDecoder.decode>;

/** Response of `POST /dashboard/queue/{id}/resolve`. */
export const resolveQueueItemDecoder = object({
  /** The updated row, so the client can reconcile without a second round-trip. */
  queue: decisionQueueRow,
  /** Queue totals after the mutation, used to drive the decisions sentence. */
  total: num(),
  updatedAt: isoDate(),
});

export type ResolveQueueItemWire = ReturnType<typeof resolveQueueItemDecoder.decode>;

/** Response of `POST /dashboard/alerts/{id}/dismiss`. */
export const dismissAlertDecoder = object({
  id: alertIdDecoder,
  remaining: array(alertIdDecoder),
  updatedAt: isoDate(),
});

export type DismissAlertWire = ReturnType<typeof dismissAlertDecoder.decode>;

export const alertListDecoder = array(alertDecoder);
export const queueListDecoder = array(decisionQueueRow);

export type AlertWire = ReturnType<typeof alertDecoder.decode>;
export type AlertSegmentWire = AlertSegment;

/** Ids of the queue rows the API can resolve. */
export type QueueItemId = DashboardDatasetWire['queues'][number]['id'];
/** Ids of the alert rows the API can dismiss. */
export type AlertItemId = ReturnType<typeof alertIdDecoder.decode>;
