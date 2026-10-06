/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the API. Empty string = same origin. */
  readonly VITE_API_BASE_URL?: string;
  /** Set to `false` to force real HTTP even in a dev build. */
  readonly VITE_USE_MOCK_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
