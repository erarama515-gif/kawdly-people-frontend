import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { useQuery } from '@/lib/query';

/**
 * First-run setup contract (Sprint A / A1.6).
 *
 * `GET /setup/status` answers two questions: does this workspace still need
 * setting up, and is the signed-in user allowed to do it? The wizard is only
 * offered when both are true, and `complete` is written once for the whole
 * install (single-workspace desktop app).
 */

export interface SetupStatus {
  needs_setup: boolean;
  completed_at: string | null;
  skipped: boolean;
  can_manage: boolean;
  steps: {
    company: boolean;
    structure: boolean;
    team: boolean;
  };
  counts: {
    departments: number;
    active_users: number;
  };
  company: {
    id: number;
    name: string;
    name_ar: string | null;
    email: string | null;
    phone: string | null;
    currency_code: string | null;
    timezone: string | null;
  } | null;
}

export const setupStatusKey = ['setup', 'status'] as const;

export function useSetupStatus(enabled = true) {
  return useQuery<SetupStatus | null>({
    queryKey: setupStatusKey,
    queryFn: async () => {
      const response = await http<{ data: SetupStatus }>('/setup/status', { method: 'GET' });
      return response.data?.data ?? null;
    },
    staleTime: 30_000,
    enabled,
    refetchOnWindowFocus: false,
  });
}

export async function completeSetup(input: { skipped?: boolean } = {}): Promise<SetupStatus | null> {
  const response = await http<{ data: SetupStatus }>('/setup/complete', {
    method: 'POST',
    body: input,
  });

  return response.data?.data ?? null;
}
