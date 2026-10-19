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
 * blank. `photo` is always a real string — `HeroHeader` renders it directly
 * as an `<img src>` with no further fallback, so an employee photo is used
 * when present and a deterministic placeholder otherwise (same placeholder
 * service already used throughout the dashboard's mock data).
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
    photo: employee?.photo ?? placeholderPhoto(user.email),
  };
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0] ?? '');
  const initials = letters.join('').toUpperCase();
  return initials || '?';
}

/** Deterministic per-user placeholder avatar — same service used by dashboard mock data. */
function placeholderPhoto(email: string): string {
  return `https://i.pravatar.cc/200?u=${encodeURIComponent(email)}`;
}
