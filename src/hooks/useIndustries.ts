import { useQuery } from '@tanstack/react-query'
import { listRows } from '@/lib/supabase'
import { isPubliclyVisible } from '@/hooks/useJobs'
import { INDUSTRIES, INDUSTRY_FAMILIES, CANONICAL_INDUSTRIES } from '@/lib/industries'
import type { Job } from '@/types'

/**
 * Industry taxonomy — canonical constants live in `src/lib/industries.ts`
 * (single source of truth, matches /home/team/shared/industry-section-spec.md §2).
 * `jobs.industry` stores the canonical EN string exactly.
 */
export { INDUSTRIES, INDUSTRY_FAMILIES, CANONICAL_INDUSTRIES }

export type Industry = (typeof INDUSTRIES)[number]['canonical']

export interface IndustryCount {
  industry: string
  count: number
}

/** Live count of open, publicly-visible jobs per industry, desc by count. */
export async function fetchIndustryCounts(): Promise<IndustryCount[]> {
  const jobs = await listRows<Job>('jobs', {
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
  })
  const counts = new Map<string, number>()
  for (const job of jobs) {
    // Moderation: pending/rejected jobs are hidden from public listings.
    if (!isPubliclyVisible(job)) continue
    const industry = job.industry?.trim()
    if (!industry) continue
    counts.set(industry, (counts.get(industry) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([industry, count]) => ({ industry, count }))
    .sort((a, b) => b.count - a.count || a.industry.localeCompare(b.industry))
}

/**
 * React Query hook — live open-job count per industry.
 * Returns `{ data, isLoading, ... }` where data is `IndustryCount[]`.
 */
export function useIndustryCounts() {
  return useQuery({
    queryKey: ['industryCounts'],
    queryFn: fetchIndustryCounts,
  })
}
