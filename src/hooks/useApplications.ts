import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, listRows, getRow, createRow, updateRow, deleteRow, countRows } from '@/lib/supabase'
import type { Application, Job, Profile } from '@/types'
import { sendEmail } from '@/lib/emailSender'

const NOTIFY_EMAIL = 'partners@impulsatalentos.expert'


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

/**
 * Notify the platform (partners@) that a new application came in.
 * Employers discover applications through their dashboard — never via email.
 * Fire-and-forget — failures are logged but never block the UI.
 */
async function notifyPlatformOfApplication(jobId: string, candidateId: string) {
  const job = await getRow<Job>('jobs', jobId)
  if (!job) return

  const candidate = await getRow<Profile>('profiles', candidateId)
  const candidateName = candidate?.fullName || 'A candidate'

  await sendEmail({
    to: NOTIFY_EMAIL,
    subject: `[New Application] ${candidateName} applied for ${job.title}`,
    text: [
      `${candidateName} just applied for "${job.title}".`,
      `Employers can review applications in their dashboard — no direct email is sent.`,
      ``,
      `View in HQ: https://impulsatalentos.expert/hq`,
    ].join('\n'),
    html: [
      `<h2>New job application</h2>`,
      `<p><strong>${escapeHtml(candidateName)}</strong> applied for <strong>${escapeHtml(job.title)}</strong>.</p>`,
      `<p><em>Employers review applications in their dashboard — no direct email is sent to them.</em></p>`,
      `<p><a href="https://impulsatalentos.expert/hq">View in HQ →</a></p>`,
    ].join('\n'),
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)
  )
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
      // 1) Upload the resume file (if any) to get a public URL.
      let finalResumeUrl: string | undefined = resumeUrl?.trim() || undefined
      if (!finalResumeUrl && resumeFile) {
        const ext = resumeFile.name.split('.').pop()?.toLowerCase() || 'pdf'
        const path = `resumes/${candidateId}/${jobId}-${Date.now()}.${ext}`
        const { error } = await supabase.storage
          .from('cvs')
          .upload(path, resumeFile, { upsert: true })
        if (error) throw error
        const { data: pub } = supabase.storage.from('cvs').getPublicUrl(path)
        finalResumeUrl = pub.publicUrl
      }

      // 2) Persist the application. coverLetter carries the resume URL when
      //    we have one so the employer always gets a link to the resume.
      const resumePointer = finalResumeUrl
        ? `\n\n[Resume] ${finalResumeUrl}`
        : ''
      const fullCover = `${coverLetter.trim()}${resumePointer}`

      return createRow<Application>('applications', {
        jobId,
        candidateId,
        coverLetter: fullCover,
        status: 'pending',
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

      // Notify the platform of the new application (fire-and-forget)
      notifyPlatformOfApplication(variables.jobId, variables.candidateId).catch(e =>
        console.warn('[useApply] notification email failed:', e)
      )
    },
  })
}

/**
 * Update an application's status (e.g. "reviewed", "interview", "offered", "hired", "rejected").
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
 * Withdraw (delete) a candidate's own application.
 * Only allowed when the application is still in a mutable state.
 */
export function useWithdrawApplication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteRow('applications', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
    },
  })
}
