import { useQuery } from '@/lib/query';
import {
  fetchHeadcountTrend,
  fetchDepartmentDistribution,
  fetchTurnoverRate,
  fetchLeaveUtilization,
} from './client';
import type {
  HeadcountTrendResponse,
  DepartmentDistResponse,
  TurnoverResponse,
  LeaveUtilResponse,
} from './client';

/**
 * Query hooks for the four analytics chart widgets.
 *
 * Each hook uses a 60-second staleTime — these aggregates don't need to be
 * refreshed as frequently as transactional data.
 */

export function useHeadcountTrend() {
  return useQuery<HeadcountTrendResponse>({
    queryKey: ['analytics', 'headcount-trend'],
    queryFn: (ctx) => fetchHeadcountTrend(ctx.signal),
    staleTime: 60_000,
  });
}

export function useDepartmentDistribution() {
  return useQuery<DepartmentDistResponse>({
    queryKey: ['analytics', 'department-distribution'],
    queryFn: (ctx) => fetchDepartmentDistribution(ctx.signal),
    staleTime: 60_000,
  });
}

export function useTurnoverRate() {
  return useQuery<TurnoverResponse>({
    queryKey: ['analytics', 'turnover-rate'],
    queryFn: (ctx) => fetchTurnoverRate(ctx.signal),
    staleTime: 60_000,
  });
}

export function useLeaveUtilization() {
  return useQuery<LeaveUtilResponse>({
    queryKey: ['analytics', 'leave-utilization'],
    queryFn: (ctx) => fetchLeaveUtilization(ctx.signal),
    staleTime: 60_000,
  });
}
