/**
 * Minimal Node `process` typing for server-only modules (e.g. server
 * functions that read env vars). The app targets browsers/ES2020 — no
 * @types/node — so declare just the shape we use.
 */
declare const process: {
  env: Record<string, string | undefined>
}
