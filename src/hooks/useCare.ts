/**
 * Home & Care vertical — data-access hooks.
 *
 * Phase-0 schema (PTL) is applied to the live DB separately; until then the
 * tables below do not exist. Every reader here therefore guards against a
 * missing relation (`PGRST205` / "does not exist") and returns an empty
 * result + logs once, so the Phase-1 UI ships gracefully and lights up the
 * moment the schema lands. Writers surface a clear, honest error toast.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, throwIfError } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { storagePointer } from '@/hooks/useSignedStorageUrl'
import type {
  CaregiverProfile,
  CaregiverScreeningUploads,
  CareVerificationStatus,
} from '@/lib/care'

const CVS_BUCKET = 'cvs'

/** True when the error is a missing table (PGRST205) or similar. */
function isMissingRelation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /does not exist|PGRST205|relation/i.test(msg)
}

/** True when the RPC does not exist yet (Phase 0 schema not applied). */
function isMissingFunction(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /does not exist|PGRST202|function/i.test(msg)
}

function snakeToCamel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    out[camel] = v
  }
  return out as T
}

/* ── Own caregiver profile ─────────────────────────────────── */
export async function fetchCaregiverProfileByUser(
  userId: string | undefined,
): Promise<CaregiverProfile | null> {
  if (!userId) return null
  const { data, error } = await supabase
    .from('caregiver_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (isMissingRelation(error)) return null
    throwIfError(error, 'caregiver_profiles')
  }
  return data ? snakeToCamel<CaregiverProfile>(data as Record<string, unknown>) : null
}

export function useCaregiverProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['care', 'profile', userId ?? ''],
    queryFn: () => fetchCaregiverProfileByUser(userId),
    enabled: !!userId,
    retry: false,
  })
}

/** Upsert the caregiver's own profile (self-attested attributes only). */
export function useSaveCaregiverProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      profile,
    }: {
      userId: string
      profile: Omit<
        CaregiverProfile,
        'id' | 'userId' | 'createdAt' | 'updatedAt' | 'verificationStatus'
      >
    }) => {
      const { data: existing } = await supabase
        .from('caregiver_profiles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()
      void existing
      // Upsert preserving the admin-gated verification_status (never overwritten here).
      const { data, error } = await supabase
        .from('caregiver_profiles')
        .upsert(
          {
            user_id: userId,
            competencies: profile.competencies,
            availability: profile.availability,
            live_in_live_out: profile.liveInLiveOut,
            age_bands: profile.ageBands,
            barrio: profile.barrio,
            city: profile.city,
            languages: profile.languages,
            years_experience: profile.yearsExperience,
            certifications: profile.certifications,
            about: profile.about,
            photo_pointer: profile.photoPointer ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
        .select()
        .single()
      throwIfError(error, 'caregiver_profiles')
      return snakeToCamel<CaregiverProfile>(data as Record<string, unknown>)
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: ['care', 'profile', vars.userId] })
    },
  })
}

/** Upload a screening document to the private cvs bucket → durable pointer. */
export function useUploadCareDocument() {
  return useMutation({
    mutationFn: async ({
      userId,
      kind,
      file,
    }: {
      userId: string
      kind: 'identity' | 'backgroundCheck' | 'certificate' | 'photo'
      file: File
    }) => {
      const ext = file.name.includes('.') ? (file.name.split('.').pop() ?? 'bin') : 'bin'
      const safe = kind.replace(/[^a-z]/gi, '')
      const path = `care/${userId}/${safe}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from(CVS_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })
      throwIfError(error, 'care-upload')
      return storagePointer(path)
    },
  })
}

/* ── Public directory (pre-screened only) ──────────────────── */
/**
 * Family-facing caregiver search. Per PTL feasibility + Phase 0 contract
 * (`home-care-vertical-phase0-signatures.md`), the screening filter is
 * NON-BYPASSABLE and lives at the DATA LAYER: this hook ONLY calls the
 * SECURITY DEFINER `search_vetted_caregivers` RPC, which returns ONLY rows
 * whose `verification_status='verified'` and only SAFE public fields
 * (no document pointers, references, or health/PII).
 *
 * There is deliberately NO direct `caregiver_profiles` SELECT here and no
 * client-side screening toggle — the client simply renders whatever the RPC
 * returns. If Phase 0 has not been applied yet the RPC is absent and we
 * return an empty directory (graceful) rather than ever reading the table
 * directly, so unscreened rows can never leak through a client filter.
 */
export function useCaregiversDirectory(filters?: {
  competency?: string
  barrio?: string
  liveInLiveOut?: string
  certifications?: string
}) {
  return useQuery({
    queryKey: ['care', 'directory', filters ?? {}],
    queryFn: async () => {
      // Sole source of family-visible caregivers: SD RPC (Phase 0).
      // Non-bypassable — filtering + safe-field projection happen inside the
      // SECURITY DEFINER function, not in the client.
      const { data: rpcRows, error: rpcError } = await supabase.rpc(
        'search_vetted_caregivers',
        {
          p_competency: filters?.competency ?? null,
          p_barrio: filters?.barrio ?? null,
          p_live_in_live_out: filters?.liveInLiveOut ?? null,
          p_certification: filters?.certifications ?? null,
        },
      )
      if (!rpcError) {
        return (rpcRows ?? []).map(r =>
          snakeToCamel<CaregiverProfile>(r as Record<string, unknown>),
        )
      }
      // RPC absent (Phase 0 not yet applied) → empty directory, never a raw read.
      if (isMissingFunction(rpcError)) return [] as CaregiverProfile[]
      // Any other error is a real fault — surface it (do not silently hide).
      throwIfError(rpcError, 'search_vetted_caregivers')
      return [] as CaregiverProfile[]
    },
    retry: false,
    staleTime: 60_000,
  })
}

/* ── Admin screening (HQ) ──────────────────────────────────── */
/**
 * List caregiver profiles for the HQ screening tab (any verification status,
 * including document pointers so an admin can build signed URLs).
 *
 * Per the Phase 0 contract, this goes through the SECURITY DEFINER
 * `admin_list_caregivers(p_admin_uid, p_limit)` RPC, which internally asserts
 * the caller is an admin. Non-admins get 0 rows. It never reads the table via
 * a broad authenticated SELECT.
 */
export function useAllCaregiverProfiles() {
  const { user } = useAuth()
  const adminUid = user?.id ?? undefined
  return useQuery({
    queryKey: ['care', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_caregivers', {
        p_admin_uid: adminUid ?? '',
        p_limit: 200,
      })
      if (!error) {
        return (data ?? []).map(r =>
          snakeToCamel<CaregiverProfile>(r as Record<string, unknown>),
        )
      }
      if (isMissingFunction(error)) return [] as CaregiverProfile[]
      throwIfError(error, 'admin_list_caregivers')
      return [] as CaregiverProfile[]
    },
    enabled: !!adminUid,
    retry: false,
  })
}

/** Admin sets the verification status via the SECURITY DEFINER RPC (monotonic). */
export function useSetCaregiverVerificationStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      profileId,
      to,
      note,
    }: {
      profileId: string
      to: CareVerificationStatus
      note?: string
    }) => {
      const { data, error } = await supabase.rpc('set_caregiver_verification_status', {
        target_profile_id: profileId,
        new_status: to,
        admin_note: note ?? null,
      })
      throwIfError(error, 'care-verify')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care', 'all'] })
      queryClient.invalidateQueries({ queryKey: ['care', 'directory'] })
    },
  })
}

/** Store/update the caregiver's screening upload pointers (admin-view source). */
export function useSaveCaregiverUploads() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      uploads,
    }: {
      userId: string
      uploads: CaregiverScreeningUploads
    }) => {
      const { data, error } = await supabase
        .from('caregiver_profiles')
        .update({
          identity_pointer: uploads.identityPointer ?? null,
          background_check_pointer: uploads.backgroundCheckPointer ?? null,
          certificate_pointer: uploads.certificatePointer ?? null,
          references: uploads.references ?? '',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single()
      throwIfError(error, 'care-uploads')
      return snakeToCamel<CaregiverProfile>(data as Record<string, unknown>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care'] })
    },
  })
}

/* ── Household (polymorphic employer extension) ────────────── */
export async function fetchHouseholdByCompany(
  companyId: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (!companyId) return null
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()
  if (error) {
    if (isMissingRelation(error)) return null
    throwIfError(error, 'households')
  }
  return data ?? null
}

export function useHousehold(companyId: string | undefined) {
  return useQuery({
    queryKey: ['care', 'household', companyId ?? ''],
    queryFn: () => fetchHouseholdByCompany(companyId),
    enabled: !!companyId,
    retry: false,
  })
}
