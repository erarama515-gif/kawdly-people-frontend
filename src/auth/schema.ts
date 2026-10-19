import { employeeDecoder } from '@/features/employees/api/schema';
import { array, bool, nullable, num, object, optional, str } from '@/lib/api/decode';

/**
 * Wire schemas for `AuthController` (`backend/app/Http/Controllers/Api/V1/AuthController.php`).
 *
 * `login`/`me` both return the raw `User` model (`$hidden` already strips
 * `password`/`remember_token`/`two_factor_secret` server-side) plus the
 * eager-loaded `employee` relation, `permissions`, and `roles`. The nested
 * employee is the exact same shape the Employees feature already decodes, so
 * `employeeDecoder` is reused rather than duplicated — if that contract ever
 * drifts, both features see the same typed failure.
 */

export const authUserDecoder = object({
  id: num(),
  uuid: optional(str()),
  employee_id: optional(num()),
  name: str(),
  email: str(),
  language: optional(str()),
  timezone: optional(str()),
  two_factor_enabled: optional(bool()),
  is_active: optional(bool()),
  last_login_at: optional(nullable(str())),
  employee: optional(employeeDecoder),
});

export type AuthUserWire = ReturnType<typeof authUserDecoder.decode>;

const authEnvelopeFields = {
  user: authUserDecoder,
  permissions: array(str()),
  roles: array(str()),
};

/** `POST /auth/login` response body. */
export const loginEnvelopeDecoder = object({
  data: object({
    token: str(),
    ...authEnvelopeFields,
  }),
});

export type LoginEnvelopeWire = ReturnType<typeof loginEnvelopeDecoder.decode>;

/** `GET /auth/me` response body — same shape minus the token. */
export const meEnvelopeDecoder = object({
  data: object(authEnvelopeFields),
});

export type MeEnvelopeWire = ReturnType<typeof meEnvelopeDecoder.decode>;
