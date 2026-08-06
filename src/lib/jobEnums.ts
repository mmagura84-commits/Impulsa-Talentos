/**
 * Canonical job enums + backward-compatible normalization and bilingual display.
 *
 * Data contract:
 *  - `jobs.locationType` stores EITHER a canonical EN value (`Remote`, `Hybrid`,
 *    `On-site`) OR a legacy Spanish value (`Remoto`, `Hibrido`, `Presencial`) OR
 *    the seed format `"<Modality> · <City>"` (e.g. `Hybrid · Medellín`).
 *  - `jobs.languagesRequired` stores a comma-separated list whose tokens are
 *    canonical EN (`English B2+`, `Spanish Native`) or legacy Spanish
 *    (`Ingles B2+`, `Inglés B2+`).
 *
 * All reads go through the format helpers so legacy rows and the seed format
 * keep rendering correctly in both locales (backward compatibility), while
 * forms write canonical values going forward.
 */

export const LOCATION_TYPES = ['Remote', 'Hybrid', 'On-site'] as const
export type LocationType = (typeof LOCATION_TYPES)[number]

export const LANGUAGE_LEVELS = [
  'English A2',
  'English B1',
  'English B2',
  'English B2+',
  'English C1',
  'English C2',
] as const
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number]

/** Extra canonical values that appear in seed data but aren't form options. */
const OTHER_LANGUAGE_VALUES = ['Spanish Native'] as const

/** Legacy Spanish modality values written by pre-canonical forms. */
const LEGACY_LOCATION: Record<string, LocationType> = {
  Remoto: 'Remote',
  Remota: 'Remote',
  Hibrido: 'Hybrid',
  Híbrido: 'Hybrid',
  Presencial: 'On-site',
}

/** Legacy Spanish language tokens written by pre-canonical forms. */
const LEGACY_LANGUAGE: Record<string, string> = {
  'Ingles A2': 'English A2',
  'Inglés A2': 'English A2',
  'Ingles B1': 'English B1',
  'Inglés B1': 'English B1',
  'Ingles B2': 'English B2',
  'Inglés B2': 'English B2',
  'Ingles B2+': 'English B2+',
  'Inglés B2+': 'English B2+',
  'Ingles C1': 'English C1',
  'Inglés C1': 'English C1',
  'Ingles C2': 'English C2',
  'Inglés C2': 'English C2',
}

/** i18n key per canonical modality — resolved through t() for EN/ES display. */
export const LOCATION_TYPE_KEYS: Record<LocationType, string> = {
  Remote: 'jobEnums.location.remote',
  Hybrid: 'jobEnums.location.hybrid',
  'On-site': 'jobEnums.location.onsite',
}

/** i18n key per canonical language token. */
export const LANGUAGE_LEVEL_KEYS: Record<string, string> = {
  'English A2': 'jobEnums.lang.a2',
  'English B1': 'jobEnums.lang.b1',
  'English B2': 'jobEnums.lang.b2',
  'English B2+': 'jobEnums.lang.b2p',
  'English C1': 'jobEnums.lang.c1',
  'English C2': 'jobEnums.lang.c2',
  'Spanish Native': 'jobEnums.lang.native',
}

const isLocationType = (v: string): v is LocationType =>
  (LOCATION_TYPES as readonly string[]).includes(v)

const isLanguageToken = (v: string): boolean =>
  (LANGUAGE_LEVELS as readonly string[]).includes(v as LanguageLevel) ||
  (OTHER_LANGUAGE_VALUES as readonly string[]).includes(v)

/** Normalize any stored modality (legacy ES or canonical EN) to canonical. */
export function normalizeLocationType(value?: string | null): LocationType | null {
  if (!value) return null
  const prefix = value.split(' · ')[0].trim()
  if (isLocationType(prefix)) return prefix
  const legacy = LEGACY_LOCATION[prefix]
  return legacy ?? null
}

/** Split a stored locationType into canonical modality + optional city. */
export function parseLocationType(
  value?: string | null,
): { modality: LocationType | null; city: string | null } {
  if (!value) return { modality: null, city: null }
  const parts = value.split(' · ')
  const modality = normalizeLocationType(parts[0])
  const city = parts.length > 1 ? parts.slice(1).join(' · ').trim() : null
  return { modality, city }
}

/**
 * Build a store value from canonical modality + optional city.
 * Preserves the seed `"Modality · City"` format so editing existing jobs
 * doesn't drop the city suffix.
 */
export function buildLocationType(modality: LocationType | null, city?: string | null): string {
  if (!modality) return city?.trim() ?? ''
  const c = city?.trim()
  return c ? `${modality} · ${c}` : modality
}

/** Normalize a stored language token (legacy ES or canonical EN) to canonical. */
export function normalizeLanguageToken(token?: string | null): string | null {
  if (!token) return null
  const t0 = token.trim()
  if (isLanguageToken(t0)) return t0
  return LEGACY_LANGUAGE[t0] ?? null
}

/**
 * Localized display of a stored locationType (modality + optional city).
 * `t` is the i18n `t()` function; unknown values pass through untouched so
 * nothing ever renders blank for legacy data we haven't mapped.
 */
export function formatLocationType(
  value: string | null | undefined,
  t: (key: string) => string,
): string {
  const { modality, city } = parseLocationType(value)
  if (!modality) return value ?? ''
  const label = t(LOCATION_TYPE_KEYS[modality])
  return city ? `${label} · ${city}` : label
}

/**
 * Localized display of a stored languages list (comma/pipe separated).
 * Unknown tokens pass through untouched.
 */
export function formatLanguageList(
  value: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!value) return ''
  return value
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((token) => {
      const canonical = normalizeLanguageToken(token) ?? token
      const key = LANGUAGE_LEVEL_KEYS[canonical]
      return key ? t(key) : token
    })
    .join(', ')
}
