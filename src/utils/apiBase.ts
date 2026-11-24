// Base URLs for the Squid API. VITE_API_BASE_URL includes the `/api` prefix
// (e.g. `https://squid.example.com/api`); VITE_AUTH_BASE_URL is the server root, because the auth
// routes live at `/auth/*` (e.g. `https://squid.example.com`). When a value is empty — or never
// substituted, which leaves `globalThis.import_meta_env` as the placeholder string and every key
// undefined — the SPA is served by the API itself, so both resolve against the same origin.

const API_PATH = '/api'

export function resolveBaseUrl(raw: unknown, sameOriginPath = API_PATH): string {
  const configured = typeof raw === 'string' ? raw.trim() : ''
  if (configured) return configured

  return `${window.location.origin}${sameOriginPath}`
}

export function resolveApiBaseUrl(raw: unknown = import.meta.env.VITE_API_BASE_URL): string {
  return resolveBaseUrl(raw)
}

export function resolveAuthBaseUrl(raw: unknown = import.meta.env.VITE_AUTH_BASE_URL): string {
  return resolveBaseUrl(raw, '')
}
