import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { QueryClient } from './queryClient';

/**
 * App-scoped `QueryClient`. Defaults are deliberately dashboard-ish: dashboard
 * stats are the hottest read in the product (`02-System-Architecture.md` caches
 * them in Redis for 5-60min), so a 30s staleness window avoids hammering the
 * API while still letting a poll notice new approvals quickly.
 */

const QueryClientContext = createContext<QueryClient | null>(null);

export function QueryClientProvider({
  client,
  children,
}: {
  client?: QueryClient;
  children: ReactNode;
}) {
  const value = useMemo(() => client ?? new QueryClient(), [client]);
  return <QueryClientContext.Provider value={value}>{children}</QueryClientContext.Provider>;
}

export function useQueryClient(): QueryClient {
  const client = useContext(QueryClientContext);
  if (!client) throw new Error('useQueryClient must be used inside <QueryClientProvider>');
  return client;
}
