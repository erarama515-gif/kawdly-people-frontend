import { useQuery } from '@/lib/query';
import { appHttpClient as http } from '@/lib/api/appHttpClient';

/**
 * Install-level capabilities (Sprint A / A1.1).
 *
 * The desktop build is offline-first, so the login surface has to ask the
 * backend what it can do instead of assuming: email recovery is off on every
 * local install, the founder-only reset exists only when Electron injected the
 * DEV_MODE marker, and the version shown must be the packaged one rather than
 * whatever the client bundle was built from.
 */

export interface SystemCapabilities {
  dev_reset_available: boolean;
  email_configured: boolean;
  version: string;
  company: { id: number | string; name: string } | null;
}

export const systemCapabilitiesKey = ['system', 'capabilities'] as const;

interface CapabilitiesWire {
  dev_reset_available?: unknown;
  email_configured?: unknown;
  version?: unknown;
  company?: unknown;
}

function decodeCompany(value: unknown): SystemCapabilities['company'] {
  if (!value || typeof value !== 'object') return null;
  const company = value as { id?: unknown; name?: unknown };
  if (company.id === undefined || typeof company.name !== 'string') return null;
  return { id: company.id as number | string, name: company.name };
}

/**
 * Tolerant decoder: a malformed or older payload degrades to safe defaults
 * (no reset, no email) instead of throwing on first paint of the login page.
 */
export function decodeCapabilities(body: unknown): SystemCapabilities | null {
  const data = (body as { data?: CapabilitiesWire } | null | undefined)?.data;
  if (!data || typeof data !== 'object') return null;

  return {
    dev_reset_available: data.dev_reset_available === true,
    email_configured: data.email_configured === true,
    version: typeof data.version === 'string' ? data.version : '',
    company: decodeCompany(data.company),
  };
}

export interface SystemCapabilitiesResult {
  capabilities: SystemCapabilities | null;
  /** True until the probe settles, so callers can hold the neutral state. */
  isProbing: boolean;
}

export function useSystemCapabilities(enabled = true): SystemCapabilitiesResult {
  const { state } = useQuery<SystemCapabilities | null>({
    queryKey: systemCapabilitiesKey,
    queryFn: async () => {
      const response = await http<{ data: CapabilitiesWire }>('/system/capabilities', {
        method: 'GET',
      });
      return decodeCapabilities(response.data);
    },
    staleTime: 5 * 60 * 1000,
    enabled,
    refetchOnWindowFocus: false,
  });

  return {
    capabilities: state.data ?? null,
    isProbing: state.status === 'pending',
  };
}
