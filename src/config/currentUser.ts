/**
 * The single mock signed-in user for the whole app. TopBar/UserMenu and the
 * dashboard greeting render this one identity — never define another
 * "current user" anywhere else.
 */
export const currentUser = {
  name: { ar: 'إسلام رمضان', en: 'Islam Ramadan' },
  initials: { ar: 'IR', en: 'IR' },
  email: 'alameen@kawdly.com',
  role: 'hr_admin',
  /** Grayscale photo — rendered with `filter: grayscale(1)` across the app. */
  photo: 'https://i.pravatar.cc/80?img=47',
} as const;