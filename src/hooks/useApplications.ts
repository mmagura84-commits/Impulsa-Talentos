import { fileExtension, uploadContentType } from '@/lib/uploadTypes'
import { requestCvParse } from '@/lib/parseCv'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, listRows, getRow, createRow, updateRow, snakeToCamel } from '@/lib/supabase'
import type { Application, ApplicationStatusHistory } from '@/types'
import { storagePointer } from '@/hooks/useSignedStorageUrl'



// ─── Query key factories ───

export const applicationKeys = {
  all: ['applications'] as const,
  allList: ['applications', 'all'] as const,
  byJob: (jobId: string) => ['applications', 'byJob', jobId] as const,
  byCandidate: (candidateId: string) =>
    ['applications', 'byCandidate', candidateId] as const,
  detail: (id: string) => ['applications', 'detail', id] as const,
}

// ─── Fetch helpers ───

async function fetchApplicationsByJob(jobId: string): Promise<Application[]> {
  return listRows<Application>('applications', {
    where: { jobId },
    orderBy: { createdAt: 'desc' },
  })
}

async function fetchApplicationsByCandidate(
  candidateId: string,
): Promise<Application[]> {
  return listRows<Application>('applications', {
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
  })
}

async function fetchApplicationById(id: string): Promise<Application | null> {
  return getRow<Application>('applications', id)
}

async function fetchAllApplications(): Promise<Application[]> {
  return listRows<Application>('applications', { orderBy: { createdAt: 'desc' } })
}

// ─── Hooks ───

/**
 * List all applications for a specific job (employer view).
 */
export function useApplications(jobId: string | undefined) {
  return useQuery({
    queryKey: applicationKeys.byJob(jobId ?? ''),
    queryFn: () => fetchApplicationsByJob(jobId!),
    enabled: !!jobId,
  })
}

/**
 * List all applications submitted by a specific candidate.
 */
export function useMyApplications(candidateId: string | undefined) {
  return useQuery({
    queryKey: applicationKeys.byCandidate(candidateId ?? ''),
    queryFn: () => fetchApplicationsByCandidate(candidateId!),
    enabled: !!candidateId,
  })
}

/**
 * Fetch a single application by its row id.
 */
export function useApplicationById(id: string | undefined) {
  return useQuery({
    queryKey: applicationKeys.detail(id ?? ''),
    queryFn: () => fetchApplicationById(id!),
    enabled: !!id,
  })
}

/**
 * Submit a new job application.
 *
 * Optionally uploads a resume file to storage first; if a resume link
 * is provided instead, it's stored on the application row directly. The
 * resulting `resumeUrl` is persisted to the `coverLetter` field for
 * backwards compat (the schema reserves coverLetter as free text but
 * the apply flow uses it to carry a URL when the candidate has no
 * uploaded file). The application always stores a meaningful pointer
 * to the candidate's resume, file or link.
 */
export interface ApplyInput {
  jobId: string
  candidateId: string
  /** Cover note — written to the application's `coverLetter` column. */
  coverLetter: string
  /** Optional resume file to upload. */
  resumeFile?: File | null
  /** Optional resume URL (overrides the file when both are set). */
  resumeUrl?: string
}

export function useApply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      jobId,
      candidateId,
      coverLetter,
      resumeFile,
      resumeUrl,
    }: ApplyInput) => {
      // 1) Upload the resume file (if any) to a durable private-bucket pointer.
      //    The cvs bucket is PRIVATE — getPublicUrl would produce a 403 URL, so
      //    store a storage:cvs: pointer that useSignedStorageUrl resolves via
      //    createSignedUrl at render time.
      let finalResumeUrl: string | undefined = resumeUrl?.trim() || undefined
      if (!finalResumeUrl && resumeFile) {
        const ext = fileExtension(resumeFile.name) || 'pdf'
        const path = `resumes/${candidateId}/${jobId}-${Date.now()}.${ext}`
        const { error } = await supabase.storage
          .from('cvs')
          .upload(path, resumeFile, { upsert: true, contentType: uploadContentType(resumeFile) ?? undefined })
        if (error) throw error
        finalResumeUrl = storagePointer(path)
        // The newest CV also feeds the candidate's matching profile.
        void requestCvParse(path)
      }

      // 2) Persist the application. coverLetter carries the resume pointer when
      //    we have one so the employer always gets a link to the resume.
      const resumePointer = finalResumeUrl
        ? `\n\n[Resume] ${finalResumeUrl}`
        : ''
      const fullCover = `${coverLetter.trim()}${resumePointer}`

      return createRow<Application>('applications', {
        jobId,
        candidateId,
        coverLetter: fullCover,
        status: 'applied',
      })
    },
    onSuccess: async (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      queryClient.invalidateQueries({
        queryKey: applicationKeys.byCandidate(variables.candidateId),
      })
      queryClient.invalidateQueries({
        queryKey: applicationKeys.byJob(variables.jobId),
      })
      // jobs@ and the candidate are emailed by sendApplicationNotifications
      // (apply page); the employer team gets an in-app notification from the
      // database (migration 041).
    },
  })
}

/**
 * Update an application's status to any of the 15 defined ApplicationStatus values:
 * draft, applied, under_review, recruiter_screening, interview_scheduled,
 * assessment_required, assessment_submitted, submitted_to_client, client_interview,
 * final_interview, offer, hired, not_selected, position_closed, withdrawn.
 */
export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string
      status: Application['status']
    }) =>
      updateRow('applications', id, {
        status,
        updatedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    },
  })
}

/** Update arbitrary application fields (e.g. interview link/date). */
export function useUpdateApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Application, 'id' | 'createdAt' | 'candidateId' | 'jobId'>>
    }) =>
      updateRow('applications', id, {
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    },
  })
}
/** List ALL applications across all jobs (HQ admin view). */
export function useAllApplications() {
  return useQuery({
    queryKey: applicationKeys.allList,
    queryFn: fetchAllApplications,
  })
}

/**
 * Fetch applications for a specific company's jobs (employer view).
 * Accepts an array of job IDs belonging to the company.
 */
export function useApplicationsByCompany(jobIds: string[] | undefined) {
  return useQuery({
    queryKey: ['applications', 'byCompany', jobIds ?? []],
    queryFn: async (): Promise<Application[]> => {
      if (!jobIds || jobIds.length === 0) return []
      const { data, error } = await supabase
        .from('applications')
        .select('*')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []).map(r => snakeToCamel<Application>(r as Record<string, unknown>))
    },
    enabled: !!(jobIds && jobIds.length > 0),
  })
}

/**
 * Soft-withdraw a candidate's own application.
 * Sets status='withdrawn' and optionally records a reason instead of hard-deleting.
 * Only allowed when the application is still in a mutable state.
 */
export function useWithdrawApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    // Candidates have no direct UPDATE right on applications; the database
    // function checks ownership and state (migration 041).
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { error } = await supabase.rpc('withdraw_application', {
        p_application_id: id,
        p_reason: reason ?? null,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    },
  })
}

// ─── Status history ───

async function fetchApplicationStatusHistory(applicationId: string): Promise<ApplicationStatusHistory[]> {
  return listRows<ApplicationStatusHistory>('application_status_history', {
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Fetch the status change history for a specific application.
 */
export function useApplicationStatusHistory(applicationId: string | undefined) {
  return useQuery({
    queryKey: ['applicationStatusHistory', applicationId ?? ''],
    queryFn: () => fetchApplicationStatusHistory(applicationId!),
    enabled: !!applicationId,
  })
}

// ─── Employer-private review data (migration 041: application_private) ───
// Notes / shortlist / internal feedback live outside the application row so
// the candidate can never read them.

export interface ApplicationPrivate {
  applicationId: string
  shortlisted: boolean
  notes: string | null
  feedback: string | null
  updatedAt?: string
}

export function useApplicationPrivate(applicationId: string | undefined) {
  return useQuery({
    queryKey: ['application_private', applicationId ?? ''],
    enabled: !!applicationId,
    queryFn: async (): Promise<ApplicationPrivate> => {
      const { data, error } = await supabase
        .from('application_private')
        .select('*')
        .eq('application_id', applicationId!)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
        ? (snakeToCamel<ApplicationPrivate>(data as Record<string, unknown>))
        : { applicationId: applicationId!, shortlisted: false, notes: null, feedback: null }
    },
  })
}

export function useSaveApplicationPrivate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (v: { applicationId: string; shortlisted?: boolean; notes?: string | null }) => {
      const row: Record<string, unknown> = { application_id: v.applicationId, updated_at: new Date().toISOString() }
      if (v.shortlisted !== undefined) row.shortlisted = v.shortlisted
      if (v.notes !== undefined) row.notes = v.notes
      const { error } = await supabase.from('application_private').upsert(row, { onConflict: 'application_id' })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ['application_private', v.applicationId] })
      queryClient.invalidateQueries({ queryKey: ['application_private_list'] })
    },
  })
}
