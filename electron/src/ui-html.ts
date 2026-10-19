/**
 * Kawdly People — chrome-less HTML for the startup splash (T3).
 *
 * Inlined as a string and loaded through a `data:` URL rather than shipped as a
 * file, for one reason: the splash must be paintable before anything else exists.
 * A file would have to be copied into `electron/dist/` by a build step that `tsc`
 * does not perform, so a missing copy step would turn the splash — the component
 * whose entire job is to report startup problems — into its own startup problem.
 *
 * No CSP header is injected for `data:` documents (the session filter matches the
 * backend origin only), and the markup loads nothing external, so the inline
 * `<style>` here is contained: it cannot be reached by any app content.
 *
 * Arabic copy is intentional — this is the product's UI language.
 */

/** Status line id, shared with the `executeJavaScript` updater in main.ts. */
export const SPLASH_STATUS_ELEMENT_ID = 'kawdly-splash-status';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function splashHtml(version: string, initialStatus: string): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>Kawdly People</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 18px;
    background: #0b1220;
    color: #e2e8f0;
    font-family: "Segoe UI", "Tahoma", sans-serif;
    user-select: none;
    -webkit-app-region: drag;
  }
  .mark { font-size: 26px; font-weight: 700; letter-spacing: .5px; color: #f8fafc; }
  .mark span { color: #38bdf8; }
  .bar {
    width: 220px; height: 3px; border-radius: 999px; overflow: hidden;
    background: rgba(148, 163, 184, .22);
  }
  .bar i {
    display: block; height: 100%; width: 40%; border-radius: 999px;
    background: linear-gradient(90deg, transparent, #38bdf8, transparent);
    animation: slide 1.15s ease-in-out infinite;
  }
  @keyframes slide { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
  .status { margin: 0; font-size: 13px; color: #94a3b8; min-height: 1.2em; }
  .version { position: absolute; bottom: 10px; font-size: 11px; color: #475569; }
</style>
</head>
<body>
  <div class="mark">KAWDLY <span>PEOPLE</span></div>
  <div class="bar"><i></i></div>
  <p class="status" id="${SPLASH_STATUS_ELEMENT_ID}">${escapeHtml(initialStatus)}</p>
  <div class="version">v${escapeHtml(version)}</div>
</body>
</html>`;
}

/** Wraps HTML in a `data:` URL. `encodeURIComponent` keeps `#` and `%` intact. */
export function toDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}
