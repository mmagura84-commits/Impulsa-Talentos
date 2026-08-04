import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow, deleteRow, countRows } from '@/lib/supabase'
import type { Job } from '@/types'


/** Number of jobs fetched per page by the infinite jobs listing. */
export const JOBS_PAGE_SIZE = 24

// ─── Query key factories ───

export const jobKeys = {
  all: ['jobs'] as const,
  allList: ['jobs', 'all'] as const,
  lists: () => ['jobs', 'list'] as const,
  list: (filters: Record<string, string | undefined>) =>
    ['jobs', 'list', filters] as const,
  infinite: (filters: Record<string, string | undefined>) =>
    ['jobs', 'infinite', filters] as const,
  detail: (id: string) => ['jobs', 'detail', id] as const,
}

// ─── Fetch helpers ───

export interface JobFilters {
  search?: string
  location?: string
  level?: string
}

/** A page of jobs returned by the server-backed listing. */
export interface JobPage {
  jobs: Job[]
  /** Full public result set used for truthful client-side filter totals. */
  allJobs: Job[]
  total: number
  offset: number
  hasMore: boolean
  nextOffset: number
}

/**
 * Fetch one page of open jobs directly from the DB.
 *
 * Filters pushed to the database layer:
 *   - status = 'open'                     (always)
 *   - level (exact match)                 (when provided)
 * Partial-text filters (search, location) are applied in JS by the caller
 * because PostgREST `where` clauses only support simple equality — see
 * fetchOpenJobs below. Pagination is server-side via limit/offset.
 */
/** Fetch one page of open jobs (also used by route loaders for SSR/prerender). */
export async function fetchJobsPage(
  filters: JobFilters,
  offset: number,
  pageSize = JOBS_PAGE_SIZE,
): Promise<JobPage> {
  const conditions: Record<string, string>[] = [{ status: 'open' }]
  if (filters?.level) conditions.push({ level: filters.level })

  const results = await listRows<Job>('jobs', {
    where: Object.assign({}, ...conditions) as Record<string, unknown>,
    orderBy: { createdAt: 'desc' },
  })

  // Keep total authoritative instead of deriving it from loaded page.
  const visible = results.filter(isPubliclyVisible)
  const page = visible.slice(offset, offset + pageSize)

  return {
    jobs: page,
    allJobs: visible,
    total: visible.length,
    offset,
    hasMore: offset + page.length < visible.length,
    nextOffset: offset + page.length,
  }
}

async function fetchOpenJobs(
  filters?: { search?: string; location?: string; level?: string },
): Promise<Job[]> {
  const conditions: Record<string, string>[] = [{ status: 'open' }]
  if (filters?.level) conditions.push({ level: filters.level })

  // PostgREST supports simple equality — for partial-text matching we
  // post-filter after fetching all open jobs.

  const results = await listRows<Job>('jobs', {
    where: Object.assign({}, ...conditions) as Record<string, unknown>,
    orderBy: { createdAt: 'desc' },
  })

  // Apply optional post-filters (LIKE semantics)
  let filtered = results
  if (filters?.search) {
    const s = filters.search.toLowerCase()
    filtered = filtered.filter(
      (j) =>
        j.title.toLowerCase().includes(s) ||
        j.description.toLowerCase().includes(s),
    )
  }
  if (filters?.location) {
    const loc = filters.location.toLowerCase()
    filtered = filtered.filter((j) => j.locationType.toLowerCase().includes(loc))
  }
  // Moderation: pending/rejected jobs are hidden from public listings.
  return filtered.filter(isPubliclyVisible)
}

/**
 * A job is visible to the public when it hasn't been pulled from listings
 * by moderation. Legacy rows without `moderationStatus` are treated as
 * approved (default), so existing jobs stay live.
 */
export function isPubliclyVisible(job: Job): boolean {
  return (
    job.moderationStatus !== 'pending' && job.moderationStatus !== 'rejected'
  )
}

/** Fetch every job (also used by route loaders for SSR/prerender). */
export async function fetchAllJobs(): Promise<Job[]> {
  return listRows<Job>('jobs', { orderBy: { createdAt: 'desc' } })
}

/** Fetch one job by id (also used by route loaders for SSR/prerender). */
export async function fetchJob(id: string): Promise<Job | null> {
  return getRow<Job>('jobs', id)
}

// ─── Hooks ───

/**
 * List open jobs, optionally filtered by search text, location, or level.
 */
export function useJobs(filters?: {
  search?: string
  location?: string
  level?: string
}) {
  const filterKey = {
    search: filters?.search,
    location: filters?.location,
    level: filters?.level,
  }

  return useQuery({
    queryKey: jobKeys.list(filterKey),
    queryFn: () => fetchOpenJobs(filters),
  })
}

/**
 * Infinite (paginated) listing of open jobs for the public jobs page.
 *
 * Server-side pagination via limit/offset; `level` is pushed to the DB as an
 * exact-match condition. Partial-text filters (search, location) are applied
 * by the caller over the accumulated pages (JS fallback — the DB `where`
 * clause only supports simple equality). Use `fetchNextPage` / `hasNextPage`
 * to drive a "Load more" button or infinite scroll.
 */
export function useInfiniteJobs(filters?: JobFilters) {
  const filterKey = {
    level: filters?.level,
  }

  return useInfiniteQuery({
    queryKey: jobKeys.infinite(filterKey),
    queryFn: ({ pageParam }) => fetchJobsPage(filters ?? {}, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage: JobPage) =>
      lastPage.hasMore ? lastPage.nextOffset : undefined,
  })
}

/**
 * Fetch a single job by its row id.
 */
export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: jobKeys.detail(id ?? ''),
    queryFn: () => fetchJob(id!),
    enabled: !!id,
  })
}

/**
 * Create a new job (employers only — RLS should gate this server-side).
 */
export function useCreateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      data: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>,
    ) => createRow<Job>('jobs', data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: ['jobs', 'company', variables.companyId],
      })
    },
  })
}

/**
 * Update an existing job (e.g. change status, edit fields).
 */
export function useUpdateJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Job, 'id' | 'createdAt' | 'updatedAt'>>
    }) => updateRow('jobs', id, { ...data, updatedAt: new Date().toISOString() }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: ['jobs', 'company'] })
    },
  })
}

/**
 * Delete a job permanently. Invalidates the jobs list cache so the
 * dashboard + jobs pages reflect the change immediately.
 */
export function useDeleteJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteRow('jobs', id),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() })
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: ['jobs', 'company'] })
    },
  })
}

/** List ALL jobs regardless of status (HQ admin view). */
export function useAllJobs() {
  return useQuery({
    queryKey: jobKeys.allList,
    queryFn: fetchAllJobs,
  })
}

/**
 * All jobs for one company, INCLUDING jobs held by moderation
 * (pending/rejected). Used by the employer dashboard so employers always
 * see their own jobs and their moderation state.
 */
export function useCompanyJobs(companyId: string | undefined) {
  return useQuery({
    queryKey: ['jobs', 'company', companyId ?? ''] as const,
    queryFn: () =>
      listRows<Job>('jobs', {
        where: { companyId: companyId! } as any,
        orderBy: { createdAt: 'desc' },
      }),
    enabled: !!companyId,
  })
}
