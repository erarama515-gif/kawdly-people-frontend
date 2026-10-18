import { cn } from '@/lib/cn';

const AVATAR_SIZES = {
  20: 'h-5 w-5 text-[10px]',
  24: 'h-6 w-6 text-[11px]',
  26: 'h-[26px] w-[26px] text-[11px]',
  28: 'h-7 w-7 text-[12px]',
  30: 'h-[30px] w-[30px] text-[12px]',
  32: 'h-8 w-8 text-[12px]',
  36: 'h-9 w-9 text-[13px]',
  40: 'h-10 w-10 text-[14px]',
} as const;

export type AvatarSize = keyof typeof AVATAR_SIZES;

export interface AvatarProps {
  /** Short initials rendered inside the circle (e.g. "أح"), or the `alt`. */
  initials: string;
  /** Grayscale photo source; when absent the initials fallback is shown. */
  photo?: string | undefined;
  size?: AvatarSize;
  className?: string;
}

export function Avatar({ initials, photo, size = 26, className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={initials}
      className={cn(
        'grid shrink-0 select-none place-items-center overflow-hidden rounded-full bg-avatar-fallback font-semibold leading-none text-ink',
        AVATAR_SIZES[size],
        className,
      )}
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover [filter:grayscale(1)]"
        />
      ) : (
        <span className="grid h-full w-full place-items-center">{initials}</span>
      )}
    </span>
  );
}

/** White separator ring drawn around a stack avatar. */
const RING_CLASS = 'rounded-full ring-2 ring-surface';

export interface AvatarStackProps {
  /** Ordered from front to back; rendered with descending z-index. */
  avatars: AvatarProps[];
  size?: AvatarSize;
  className?: string;
}

/** Overlapping avatars (−8px inline-end overlap). The "+N" is rendered by callers as mono text. */
export function AvatarStack({ avatars, size = 26, className }: AvatarStackProps) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      {avatars.map((avatar, index) => (
        <span
          key={`${avatar.initials}-${index}`}
          className={cn(RING_CLASS, index === 0 ? 'ms-0' : '-me-2')}
          style={{ zIndex: avatars.length - index }}
        >
          <Avatar {...avatar} size={size} />
        </span>
      ))}
    </span>
  );
}