import type { AuthUserWire } from './schema';
import type { SessionUser } from './session';

/**
 * Builds the bilingual `SessionUser` the UI renders (hero greeting, user
 * menu, avatars) from the real `AuthController` payload.
 *
 * The backend `User` model only carries a single `name` string and the
 * `employee` relation is the only place Arabic/English name parts can live
 * (`first_name_ar`/`last_name_ar`). Most accounts (anyone without a linked
 * `Employee` row — e.g. `test@example.com`) have neither, so this is
 * best-effort: when a language-specific name truly isn't available, both
 * `ar` and `en` fall back to the same string rather than leaving a field
 * blank.
 *
 * `photo` is only set when the linked employee actually has one. It used to
 * fall back to a generated avatar-service URL, which meant every session —
 * including `test@example.com`, which has no employee row — fetched an image
 * over the network. That broke the offline-first desktop build and tripped the
 * `img-src 'self' data:` CSP. `initials` is already computed right here, and
 * `<Avatar>` renders it whenever `photo` is absent, so the placeholder was
 * never needed.
 */
export function deriveDisplayIdentity(user: AuthUserWire): SessionUser {
  const employee = user.employee;

  const nameEn =
    employee ? `${employee.first_name} ${employee.last_name}`.trim() : user.name;
  const nameAr =
    employee?.first_name_ar && employee?.last_name_ar
      ? `${employee.first_name_ar} ${employee.last_name_ar}`.trim()
      : nameEn;

  return {
    id: user.id,
    ...(employee ? { companyId: employee.company_id } : {}),
    name: { en: nameEn, ar: nameAr },
    initials: { en: initialsOf(nameEn), ar: initialsOf(nameAr) },
    email: user.email,
    // Conditional spread, not `photo: x ?? undefined`: `exactOptionalPropertyTypes`.
    ...(employee?.photo ? { photo: employee.photo } : {}),
  };
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? '');
  const initials = letters.join('').toUpperCase();
  return initials || '?';
}
