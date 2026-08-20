/**
 * Home & Care vertical — canonical taxonomies + data shapes.
 *
 * This file is the SINGLE SOURCE OF TRUTH for home & care values. Phase 0
 * (schema, owned by PTL) and Phase 1 (this front-end) both map onto these
 * canonical values — store the canonical EN string in the DB, translate at
 * the edge via the label-key maps below (cf. src/lib/jobEnums.ts).
 *
 * Accepted design decisions reflected here: vacancy-first MVP, household =
 * polymorphic employer (`companies.entity_type = 'household'`), caregiver =
 * candidate role + caregiver_profiles, admin-gated monotonic verification,
 * nursing-assistant certificate REQUIRED for elderly-care roles, Medellín
 * barrio-level location, unscreened caregivers hidden from search.
 */

/* ── Care competency (canonical) ───────────────────────────── */
export const CARE_COMPETENCIES = [
  'nanny',
  'housekeeper',
  'nursing_assistant',
] as const
export type CareCompetency = (typeof CARE_COMPETENCIES)[number]

/** Nursing-assistant certificate is REQUIRED for elderly-care roles. */
export const CERT_REQUIRED_COMPETENCIES: CareCompetency[] = ['nursing_assistant']

/** i18n label keys (care.competency.*). */
export const CARE_COMPETENCY_KEYS: Record<CareCompetency, string> = {
  nanny: 'care.competency.nanny',
  housekeeper: 'care.competency.housekeeper',
  nursing_assistant: 'care.competency.nursing',
}

/* ── Availability / schedule (canonical) ───────────────────── */
export const CARE_SCHEDULES = ['full_time', 'part_time', 'live_in', 'live_out', 'overnight'] as const
export type CareSchedule = (typeof CARE_SCHEDULES)[number]
export const CARE_SCHEDULE_KEYS: Record<CareSchedule, string> = {
  full_time: 'care.schedule.fullTime',
  part_time: 'care.schedule.partTime',
  live_in: 'care.schedule.liveIn',
  live_out: 'care.schedule.liveOut',
  overnight: 'care.schedule.overnight',
}

/* ── Live-in / live-out (canonical) ────────────────────────── */
export const CARE_LIVE_MODES = ['live_in', 'live_out', 'flexible'] as const
export type CareLiveMode = (typeof CARE_LIVE_MODES)[number]
export const CARE_LIVE_MODE_KEYS: Record<CareLiveMode, string> = {
  live_in: 'care.live.liveIn',
  live_out: 'care.live.liveOut',
  flexible: 'care.live.flexible',
}

/* ── Nanny age bands (canonical) ───────────────────────────── */
export const CARE_AGE_BANDS = ['newborn', 'infant', 'toddler', 'preschool', 'primary'] as const
export type CareAgeBand = (typeof CARE_AGE_BANDS)[number]
export const CARE_AGE_BAND_KEYS: Record<CareAgeBand, string> = {
  newborn: 'care.ageBand.newborn',
  infant: 'care.ageBand.infant',
  toddler: 'care.ageBand.toddler',
  preschool: 'care.ageBand.preschool',
  primary: 'care.ageBand.primary',
}

/* ── Certifications (canonical) ────────────────────────────── */
export const CARE_CERTIFICATIONS = [
  'nursing_assistant_certificate',
  'cpr',
  'first_aid',
  'childcare_training',
] as const
export type CareCertification = (typeof CARE_CERTIFICATIONS)[number]
export const CARE_CERTIFICATION_KEYS: Record<CareCertification, string> = {
  nursing_assistant_certificate: 'care.cert.nursingCert',
  cpr: 'care.cert.cpr',
  first_aid: 'care.cert.firstAid',
  childcare_training: 'care.cert.childcare',
}

/* ── Languages (subset used for care match) ────────────────── */
export const CARE_LANGUAGES = ['es', 'en', 'pt', 'fr'] as const
export type CareLanguage = (typeof CARE_LANGUAGES)[number]
export const CARE_LANGUAGE_KEYS: Record<CareLanguage, string> = {
  es: 'care.language.es',
  en: 'care.language.en',
  pt: 'care.language.pt',
  fr: 'care.language.fr',
}

/* ── Verification status (admin-gated + monotonic) ─────────── */
/**
 * ORDER MATTERS — a caregiver can only move FORWARD along this list, and
 * every transition is performed by an admin/PTL via the RPC
 * `set_caregiver_verification_status` (SECURITY DEFINER). Caregivers NEVER
 * self-attest. `rejected` is a terminal state. `verified` is the ONLY
 * status that makes a caregiver visible in the public directory.
 */
export const CARE_VERIFICATION_ORDER = [
  'unverified',
  'identity_pending',
  'background_pending',
  'references_pending',
  'verified',
] as const
export type CareVerificationStatus = (typeof CARE_VERIFICATION_ORDER)[number] | 'rejected'
export const TERMINAL_REJECTED: CareVerificationStatus = 'rejected'
export const CARE_VERIFICATION_KEYS: Record<CareVerificationStatus, string> = {
  unverified: 'care.status.unverified',
  identity_pending: 'care.status.identityPending',
  background_pending: 'care.status.backgroundPending',
  references_pending: 'care.status.referencesPending',
  verified: 'care.status.verified',
  rejected: 'care.status.rejected',
}
/** A caregiver is publicly visible only when fully verified. */
export function isPreScreened(status: string | undefined | null): boolean {
  return status === 'verified'
}

/* ── Medellín barrios (barrio-level geodata) ───────────────── */
export interface Barrio {
  /** Comuna / zone label (i18n via care.comuna.label). */
  comuna: string
  name: string
}
export const MEDELLIN_BARRIOS: Barrio[] = [
  { comuna: 'El Poblado', name: 'El Poblado' },
  { comuna: 'El Poblado', name: 'Provenza' },
  { comuna: 'El Poblado', name: 'Manila' },
  { comuna: 'El Poblado', name: 'Castropol' },
  { comuna: 'Laureles - Estadio', name: 'Laureles' },
  { comuna: 'Laureles - Estadio', name: 'Estadio' },
  { comuna: 'Laureles - Estadio', name: 'Florida' },
  { comuna: 'Laureles - Estadio', name: 'Suramericana' },
  { comuna: 'Belén', name: 'Belén' },
  { comuna: 'Belén', name: 'Belén Los Alpes' },
  { comuna: 'Belén', name: 'Belén Rincón' },
  { comuna: 'La América', name: 'La América' },
  { comuna: 'La América', name: 'Santa Lucía' },
  { comuna: 'Robledo', name: 'Robledo' },
  { comuna: 'Robledo', name: 'Aures' },
  { comuna: 'Aranjuez', name: 'Aranjuez' },
  { comuna: 'Castilla', name: 'Castilla' },
  { comuna: 'Doce de Octubre', name: 'Doce de Octubre' },
  { comuna: 'San Javier', name: 'San Javier' },
  { comuna: 'Buenos Aires', name: 'Buenos Aires' },
  { comuna: 'La Candelaria', name: 'La Candelaria' },
  { comuna: 'Manrique', name: 'Manrique' },
  { comuna: 'Villa Hermosa', name: 'Villa Hermosa' },
  { comuna: 'Santa Cruz', name: 'Santa Cruz' },
  { comuna: 'Popular', name: 'Popular' },
  { comuna: 'Guayabal', name: 'Guayabal' },
  { comuna: 'Envigado', name: 'Envigado' },
]
export const MEDELLIN_COMUNAS: string[] = Array.from(
  new Set(MEDELLIN_BARRIOS.map(b => b.comuna)),
)

/* ── Caregiver profile (caregiver_profiles row) ────────────── */
export interface CaregiverProfile {
  id: string
  userId: string
  /** Subset of CARE_COMPETENCIES the caregiver offers. */
  competencies: string[]
  availability: string
  liveInLiveOut: string
  /** Nanny-only age bands. */
  ageBands: string[]
  barrio: string
  city: string
  languages: string[]
  yearsExperience: number
  /** Subset of CARE_CERTIFICATIONS. */
  certifications: string[]
  about: string
  /** Private photo in cvs bucket, `storage:cvs:` pointer. */
  photoPointer?: string | null
  /** Screening document pointers (private cvs bucket) — admin-visible only. */
  identityPointer?: string | null
  backgroundCheckPointer?: string | null
  certificatePointer?: string | null
  /** Free-text professional references provided by the caregiver. */
  references?: string | null
  /** Verification status — ADMIN-GATED, never self-attested. */
  verificationStatus: CareVerificationStatus
  createdAt: string
  updatedAt: string
}

/** Document pointers (private cvs bucket) a caregiver uploads for screening. */
export interface CaregiverScreeningUploads {
  identityPointer?: string | null
  backgroundCheckPointer?: string | null
  certificatePointer?: string | null
  references?: string
}
export const EMPTY_SCREENING_UPLOADS: CaregiverScreeningUploads = {
  identityPointer: null,
  backgroundCheckPointer: null,
  certificatePointer: null,
  references: '',
}

/* ── Household (households extension row — polymorphic company) ─ */
export interface HouseholdProfile {
  id: string
  companyId: string
  contactName: string
  barrio: string
  careCompetency: string
  numChildren: number
  numElderly: number
  liveInAvailable: boolean
  pets: boolean
  languages: string[]
  scheduleNote: string
  createdAt: string
  updatedAt: string
}

/* ── Care vacancy fields (carried on the jobs row) ─────────── */
export interface CareVacancyFields {
  careCompetency: string
  schedule: string
  barrio: string
  liveInLiveOut: string
  careLanguages: string[]
  /** Private care-need/health notes — never public (Law 1581). */
  careDetails: string
  nannyAgeBand?: string | null
  /** Always true when careCompetency === 'nursing_assistant'. */
  nursingCertRequired: boolean
}
