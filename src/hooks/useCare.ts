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

async function listCaregivers(verifiedOnly: boolean): Promise<CaregiverProfile[]> {
  let q = supabase.from('caregiver_profiles').select('*')
  if (verifiedOnly) q = q.eq('verification_status', 'verified')
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) {
    if (isMissingRelation(error)) return []
    throwIfError(error, 'caregiver_profiles')
  }
  return (data ?? []).map(r => snakeToCamel(r))
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
      profile: Omit<CaregiverProfile, 'id' | 'createdAt' | 'updatedAt' | 'verificationStatus'>
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
export function useCaregiversDirectory(filters?: {
  competency?: string
  barrio?: string
  liveInLiveOut?: string
  certifications?: string
}) {
  return useQuery({
    queryKey: ['care', 'directory', filters ?? {}],
    queryFn: async () => {
      let q = supabase
        .from('caregiver_profiles')
        .select('*')
        .eq('verification_status', 'verified')
      if (filters?.barrio) q = q.eq('barrio', filters.barrio)
      if (filters?.liveInLiveOut) q = q.eq('live_in_live_out', filters.liveInLiveOut)
      const { data, error } = await q.order('created_at', { ascending: false })
      if (error) {
        if (isMissingRelation(error)) return [] as CaregiverProfile[]
        throwIfError(error, 'caregiver_profiles')
      }
      let rows = (data ?? []).map(r => snakeToCamel<CaregiverProfile>(r as Record<string, unknown>))
      // Filter arrays client-side (competency + certification) — the RPC/JSONB
      // operator varies by Phase-0 DDL, so keep it portable at the edge.
      if (filters?.competency) {
        rows = rows.filter(p => (p.competencies ?? []).includes(filters.competency as string))
      }
      if (filters?.certifications) {
        rows = rows.filter(p =>
          (p.certifications ?? []).includes(filters.certifications as string),
        )
      }
      return rows
    },
    retry: false,
    staleTime: 60_000,
  })
}

/* ── Admin screening (HQ) ──────────────────────────────────── */
/** List ALL caregiver profiles (any verification status) — admin-only read. */
export function useAllCaregiverProfiles() {
  return useQuery({
    queryKey: ['care', 'all'],
    queryFn: () => listCaregivers(false),
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
