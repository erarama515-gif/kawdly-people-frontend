import { env } from '@/config/env';
import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { mockContractApi, resetMockContracts, setMockContractFailureRate } from './mockApi';
import { contractEnvelopeDecoder, contractListDecoder } from './schema';
import type {
  ContractApi,
  ContractInput,
  ContractListParams,
  ContractTerminateInput,
  ContractUpdateInput,
} from './resource';

/**
 * Real HTTP implementation of `ContractApi`, pointed at
 * `/api/v1/contracts` exactly as documented in the Laravel route list:
 *  - `index` returns the app's custom `{ data, meta }` pager
 *  - `show`/`store`/`update` return `{ data: <contract> }`
 *  - `destroy` returns 204 with an empty body
 */

const BASE = '/contracts';
/** Relations needed to render the list table without a second round-trip. */
const LIST_INCLUDE = 'employee';

export const httpContractApi: ContractApi = {
  async list({ signal }, params) {
    const { data } = await http(BASE, {
      query: {
        page: params.page,
        per_page: params.perPage,
        sort: params.sort,
        direction: params.direction,
        search: params.search || undefined,
        status: params.status,
        employee_id: params.employeeId,
        include: LIST_INCLUDE,
      },
      signal,
      schema: contractListDecoder,
    });
    return requireData(data, 'GET /contracts');
  },

  async create({ signal }, input) {
    const { data } = await http(BASE, {
      method: 'POST',
      body: input,
      signal,
      schema: contractEnvelopeDecoder,
    });
    return requireData(data, 'POST /contracts').data;
  },

  async update({ signal }, id, input) {
    const { data } = await http(`${BASE}/${id}`, {
      method: 'PATCH',
      body: input,
      signal,
      schema: contractEnvelopeDecoder,
    });
    return requireData(data, `PATCH /contracts/${id}`).data;
  },

  async remove({ signal }, id) {
    await http(`${BASE}/${id}`, { method: 'DELETE', signal, ignoreBody: true });
  },

  async terminate({ signal }, id, input: ContractTerminateInput) {
    const { data } = await http(`${BASE}/${id}/terminate`, {
      method: 'POST',
      body: input,
      signal,
      schema: contractEnvelopeDecoder,
    });
    return requireData(data, `POST /contracts/${id}/terminate`).data;
  },
};

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

/**
 * Chooses the transport once per app, exactly like the Employees feature:
 * mock is the default whenever no API base URL is configured, so the
 * Contracts page is fully interactive before the Laravel backend is wired up,
 * and a build pointed at a real backend switches with no code change.
 */
export const contractApi: ContractApi = env.useMockApi ? mockContractApi : httpContractApi;

if (env.isDev && env.useMockApi) {
  Object.defineProperty(window, '__contractsMock', {
    value: { setFailureRate: setMockContractFailureRate, reset: resetMockContracts },
    configurable: true,
  });
}

export type { ContractInput, ContractUpdateInput, ContractListParams };
