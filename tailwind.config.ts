import type { Config } from 'tailwindcss';

/**
 * Bold Editorial / Ledger — design tokens live in `src/styles/globals.css` as
 * CSS custom properties so they stay the single source of truth. Values map
 * 1:1 to `public/tokens.json` (light theme only; no dark values defined).
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Surfaces */
        page: 'var(--color-page)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        /* Ink */
        ink: 'var(--color-ink)',
        'ink-muted': 'var(--color-ink-muted)',
        'ink-faint': 'var(--color-ink-faint)',
        /* Ledger columns */
        navy: 'var(--color-navy)',
        'navy-deep': 'var(--color-navy-deep)',
        'navy-glow': 'var(--color-navy-glow)',
        /* Coral accent */
        coral: 'var(--color-coral)',
        'coral-hover': 'var(--color-coral-hover)',
        /* Lines */
        hairline: 'var(--color-hairline)',
        divider: 'var(--color-divider)',
        /* Avatar fallbacks */
        'avatar-fallback': 'var(--color-avatar-fallback)',
        'avatar-fallback-header': 'var(--color-avatar-fallback-header)',
        /* On-navy overlays */
        'on-navy': 'var(--color-on-navy)',
        'on-navy-muted-70': 'var(--color-on-navy-muted-70)',
        'on-navy-muted-75': 'var(--color-on-navy-muted-75)',
        'on-navy-muted-85': 'var(--color-on-navy-muted-85)',
        'on-navy-faint-28': 'var(--color-on-navy-faint-28)',
        'on-navy-border-18': 'var(--color-on-navy-border-18)',
        'on-navy-border-35': 'var(--color-on-navy-border-35)',
        'on-navy-border-50': 'var(--color-on-navy-border-50)',
        'on-navy-border-60': 'var(--color-on-navy-border-60)',
        'on-navy-fill-12': 'var(--color-on-navy-fill-12)',
      },
      fontFamily: {
        /* System stack only — see --font-sans in src/styles/globals.css for why
           the webfont was dropped. Keeping the list in CSS (not here) means the
           inline `font-family: var(--font-sans)` call sites cannot drift. */
        sans: ['var(--font-sans)'],
        /* Data numerals read as mono with tabular figures. */
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        /* Ledger type scale */
        greeting: ['clamp(40px, 7vw, 80px)', { lineHeight: '0.95', fontWeight: '700', letterSpacing: '-0.045em' }],
        'heading-lg': ['30px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.03em' }],
        'heading-md': ['26px', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.03em' }],
        'body-md': ['18px', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.02em' }],
        body: ['15px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '1.3', fontWeight: '500' }],
        'caption-sm': ['11px', { lineHeight: '1.3', fontWeight: '500' }],
        /* Data numerals (font-mono) */
        'data-xl': ['60px', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.06em' }],
        'data-lg': ['44px', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.05em' }],
        'data-md': ['26px', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.04em' }],
        'data-sm': ['17px', { lineHeight: '1', fontWeight: '700', letterSpacing: '-0.04em' }],
        'data-xs': ['13px', { lineHeight: '1', fontWeight: '600' }],
        'data-2xs': ['12px', { lineHeight: '1', fontWeight: '700' }],
        'data-3xs': ['10px', { lineHeight: '1', fontWeight: '400' }],
        /* Retired legacy (migration scaffolding) */
        'page-title': ['26px', { lineHeight: '1.3', fontWeight: '700' }],
        'section-title': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
      },
      borderColor: {
        DEFAULT: 'var(--color-hairline)',
      },
      borderRadius: {
        /* Sharp by default — pills (rounded-full) only for tags/chips/search/CTA. */
        DEFAULT: '3px',
        card: '3px',
        modal: '3px',
      },
      boxShadow: {},
      spacing: {
        topbar: '64px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        200: '200ms',
      },
      keyframes: {
        'content-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /**
         * Same entrance as `content-in`, but for elements that are also
         * centered via `-translate-x-1/2 -translate-y-1/2` (i.e. `Dialog`'s
         * `RadixDialog.Content`). A keyframe's `transform` fully replaces —
         * never composes with — the element's own `transform` declaration
         * while the animation applies, so `content-in`'s plain
         * `translateY(...)` would silently drop the centering offset and
         * push the dialog down/right by half its own box size. Baking the
         * centering into both keyframe stops keeps it correct throughout.
         */
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) translateY(8px)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) translateY(0)' },
        },
        'content-rise': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'bar-rise': {
          from: { opacity: '0', transform: 'scaleY(0.2)' },
          to: { opacity: '1', transform: 'scaleY(1)' },
        },
      },
      animation: {
        'content-in': 'content-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'dialog-in': 'dialog-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'content-rise': 'content-rise 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        'bar-rise': 'bar-rise 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;