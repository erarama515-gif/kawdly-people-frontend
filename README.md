# Kawdly People — Frontend

React + TypeScript + Vite. Arabic-first (RTL), packaged as an Electron desktop
app against a bundled Laravel backend.

## First-time setup

```bash
npm install
npm run dev
```

`npm run dev` runs `scripts/check-env.mjs --create` first, which copies
`.env.example` to `.env.local` if it is missing and then verifies the required
keys. There is nothing else to do by hand.

To talk to the real backend rather than mock data, start Laravel on **port
8100** in another terminal:

```bash
cd ../backend
php artisan serve --port=8100
```

8100, not Laravel's default 8000 — the Vite dev-server proxy in
`vite.config.ts` forwards `/api` to `127.0.0.1:8100`.

## Why the env check exists

`src/config/env.ts` resolves the API base URL from `VITE_API_BASE_URL`. If it is
empty, the consequences differ sharply by build:

| Build | Missing `VITE_API_BASE_URL` |
|---|---|
| `npm run dev` | **Silently serves fabricated mock data.** Every screen renders, every number is invented, nothing warns you. |
| Production web build | Throws at startup, by design, rather than display invented statistics. |
| Desktop build | Unaffected — `electron/src/desktop-config.ts` injects `__KAWDLY_CONFIG__` at runtime, which takes precedence. |

The dev row is the one worth protecting against: a fresh clone *looks* like it
works. That silence is what the check removes.

## Environment variables

`.env.example` documents all of them with the code defaults.
`VITE_API_BASE_URL` is the only required one; the rest are tuning knobs
(timeouts, retries, dashboard poll interval) that fall back to the values in
`src/config/env.ts`.

`.env.local` is gitignored and must never hold a secret — everything in a Vite
`VITE_`-prefixed variable is compiled into the client bundle and is therefore
public.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server (runs the env check with `--create` first) |
| `npm run typecheck` | `tsc -b` — part of the commit gate |
| `npm run build` | Production web build (runs the env check, validate-only) |
| `npm run build:desktop` | SPA into `../backend/public/app` with `/app/` base |
| `npm run electron:dev` | Build the desktop bundle and launch Electron |
| `npm run package:win` | NSIS installer via electron-builder |

The commit gate for this repo is `npm run typecheck` **and** `npm run build`,
both exiting 0.

## Build-mode env check

`prebuild` validates but never writes. Creating a `.env.local` during a
production build would inject configuration into a release artifact, which is a
change in build behaviour rather than a developer convenience. If
`VITE_API_BASE_URL` is absent in build mode the check prints a warning and exits
0, because the desktop build legitimately supplies its base URL at runtime and
CI may supply it through the environment instead of a file.
