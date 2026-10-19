import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { object, str, num, array } from '@/lib/api/decode';

/**
 * Analytics API client.
 *
 * Aggregation endpoints that return pre-computed data for the 4 chart widgets.
 * All endpoints are company-scoped on the backend via BelongsToCompany /
 * OwnScopedToEmployee global scopes — no client-side company_id param needed.
 */

// ─── Headcounts (existing endpoint) ─────────────────────────────────────────

const departmentHeadcountDecoder = object({
  department_id: num(),
  department_name: str(),
  headcount: num(),
});

const headcountsResponseDecoder = object({
  data: array(departmentHeadcountDecoder),
  total_active: num(),
});

export type DepartmentHeadcount = ReturnType<typeof departmentHeadcountDecoder.decode>;

export interface HeadcountsResponse {
  data: DepartmentHeadcount[];
  total_active: number;
}

export async function fetchHeadcounts(signal?: AbortSignal): Promise<HeadcountsResponse> {
  const { data } = await http('/analytics/headcounts', {
    signal,
    schema: headcountsResponseDecoder,
  });
  if (!data) throw new Error('GET /analytics/headcounts returned an empty body');
  return data;
}

// ─── Headcount Trend ─────────────────────────────────────────────────────────

const headcountTrendItemDecoder = object({
  month: str(),
  headcount: num(),
});

const headcountTrendResponseDecoder = object({
  data: array(headcountTrendItemDecoder),
});

export type HeadcountTrendItem = ReturnType<typeof headcountTrendItemDecoder.decode>;
export type HeadcountTrendResponse = { data: HeadcountTrendItem[] };

export async function fetchHeadcountTrend(signal?: AbortSignal): Promise<HeadcountTrendResponse> {
  const { data } = await http('/analytics/headcount-trend', {
    signal,
    schema: headcountTrendResponseDecoder,
  });
  if (!data) throw new Error('GET /analytics/headcount-trend returned an empty body');
  return data;
}

// ─── Department Distribution ─────────────────────────────────────────────────

const departmentDistItemDecoder = object({
  name: str(),
  value: num(),
});

const departmentDistResponseDecoder = object({
  data: array(departmentDistItemDecoder),
});

export type DepartmentDistItem = ReturnType<typeof departmentDistItemDecoder.decode>;
export type DepartmentDistResponse = { data: DepartmentDistItem[] };

export async function fetchDepartmentDistribution(signal?: AbortSignal): Promise<DepartmentDistResponse> {
  const { data } = await http('/analytics/department-distribution', {
    signal,
    schema: departmentDistResponseDecoder,
  });
  if (!data) throw new Error('GET /analytics/department-distribution returned an empty body');
  return data;
}

// ─── Turnover Rate ───────────────────────────────────────────────────────────

const turnoverItemDecoder = object({
  month: str(),
  departures: num(),
  rate: num(),
});

const turnoverResponseDecoder = object({
  data: array(turnoverItemDecoder),
});

export type TurnoverItem = ReturnType<typeof turnoverItemDecoder.decode>;
export type TurnoverResponse = { data: TurnoverItem[] };

export async function fetchTurnoverRate(signal?: AbortSignal): Promise<TurnoverResponse> {
  const { data } = await http('/analytics/turnover-rate', {
    signal,
    schema: turnoverResponseDecoder,
  });
  if (!data) throw new Error('GET /analytics/turnover-rate returned an empty body');
  return data;
}

// ─── Leave Utilization ───────────────────────────────────────────────────────

const leaveUtilItemDecoder = object({
  leave_type: str(),
  days_used: num(),
});

const leaveUtilResponseDecoder = object({
  data: array(leaveUtilItemDecoder),
});

export type LeaveUtilItem = ReturnType<typeof leaveUtilItemDecoder.decode>;
export type LeaveUtilResponse = { data: LeaveUtilItem[] };

export async function fetchLeaveUtilization(signal?: AbortSignal): Promise<LeaveUtilResponse> {
  const { data } = await http('/analytics/leave-utilization', {
    signal,
    schema: leaveUtilResponseDecoder,
  });
  if (!data) throw new Error('GET /analytics/leave-utilization returned an empty body');
  return data;
}
