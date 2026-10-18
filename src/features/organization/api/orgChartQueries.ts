import { useQuery } from '@/lib/query';
import type { QueryState } from '@/lib/query';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schema for the org-chart endpoint:
 * GET /api/v1/organization/org-chart
 *
 * Returns a nested tree of departments rooted at the user's company.
 */

// ─── Decoders ────────────────────────────────────────────────────────────────

const orgChartHeadDecoder = object({
  id: num(),
  name: str(),
  title: optional(str()),
});

// Declared lazily below — department nodes can be nested recursively.
// We break the cycle by using a function-based lazy decoder.

export interface OrgChartHead {
  id: number;
  name: string;
  title?: string;
}

export interface OrgChartDepartmentNode {
  id: number;
  name: string;
  type: 'department';
  head: OrgChartHead | null;
  employee_count: number;
  children: OrgChartDepartmentNode[];
}

export interface OrgChartRoot {
  id: number | null;
  name: string;
  children: OrgChartDepartmentNode[];
}

export interface OrgChartWire {
  data: OrgChartRoot;
}

/**
 * Decodes a single department node plus its `children` array recursively.
 * We use a plain function decoder that calls itself — avoids circular-
 * reference issues with the `object()` combinator at module-init time.
 */
function decodeDeptNode(input: unknown, path = ''): OrgChartDepartmentNode {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error(`Expected object at "${path}", got ${typeof input}`);
  }
  const src = input as Record<string, unknown>;

  const idVal = src['id'];
  const nameVal = src['name'];
  const headVal = src['head'];
  const countVal = src['employee_count'];
  const childrenVal = src['children'];

  return {
    id: typeof idVal === 'number' ? idVal : 0,
    name: typeof nameVal === 'string' ? nameVal : '',
    type: 'department',
    head: headVal !== null && headVal !== undefined
      ? orgChartHeadDecoder.decode(headVal, `${path}.head`)
      : null,
    employee_count: typeof countVal === 'number' ? countVal : 0,
    children: Array.isArray(childrenVal)
      ? childrenVal.map((child, i) => decodeDeptNode(child, `${path}.children[${i}]`))
      : [],
  };
}

const orgChartRootDecoder = object({
  id: optional(num()),
  name: str(),
  // children decoded manually via the recursive helper
});

function decodeOrgChart(input: unknown): OrgChartWire {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Expected object at root');
  }
  const src = input as Record<string, unknown>;
  const dataVal = src['data'];

  if (typeof dataVal !== 'object' || dataVal === null) {
    throw new Error('Expected object at "data"');
  }
  const dataSrc = dataVal as Record<string, unknown>;

  const rootMeta = orgChartRootDecoder.decode(dataVal, 'data');
  const childrenRaw = dataSrc['children'];

  return {
    data: {
      id: rootMeta.id ?? null,
      name: rootMeta.name,
      children: Array.isArray(childrenRaw)
        ? childrenRaw.map((c, i) => decodeDeptNode(c, `data.children[${i}]`))
        : [],
    },
  };
}

// ─── Query key ───────────────────────────────────────────────────────────────

export const orgChartKeys = {
  all: ['org-chart'] as const,
  root: () => ['org-chart', 'root'] as const,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface UseOrgChartResult {
  state: QueryState<OrgChartWire>;
  refetch: () => void;
}

export function useOrgChart(): UseOrgChartResult {
  const { state, refetch } = useQuery<OrgChartWire>({
    queryKey: orgChartKeys.root(),
    queryFn: async ({ signal }) => {
      const { data } = await http('/org-chart', { signal });
      return decodeOrgChart(data);
    },
    staleTime: 30_000,
  });

  return { state, refetch };
}
