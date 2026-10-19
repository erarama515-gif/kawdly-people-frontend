import { appHttpClient as http } from '@/lib/api/appHttpClient';
import { loginEnvelopeDecoder, meEnvelopeDecoder } from './schema';
import type { LoginEnvelopeWire, MeEnvelopeWire } from './schema';

/**
 * Thin wrapper around `AuthController` (`routes/api.php`: `auth/login`,
 * `auth/logout`, `auth/me`). Unlike every feature module there is no mock
 * variant here — signing in is the one flow that must always talk to the
 * real backend, mock-API mode or not, otherwise "logging in" would be
 * meaningless.
 */

export interface LoginInput {
  email: string;
  password: string;
}

function requireData<T>(data: T | undefined, endpoint: string): T {
  if (data === undefined) throw new Error(`${endpoint} returned an empty body`);
  return data;
}

export const authApi = {
  async login(input: LoginInput): Promise<LoginEnvelopeWire['data']> {
    const { data } = await http('/auth/login', {
      method: 'POST',
      body: input,
      schema: loginEnvelopeDecoder,
    });
    return requireData(data, 'POST /auth/login').data;
  },

  async me(): Promise<MeEnvelopeWire['data']> {
    const { data } = await http('/auth/me', { schema: meEnvelopeDecoder });
    return requireData(data, 'GET /auth/me').data;
  },

  async logout(): Promise<void> {
    await http('/auth/logout', { method: 'POST', ignoreBody: true });
  },
};
