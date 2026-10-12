/**
 * Turn database refusals (migration 041 guards and row-level security) into
 * messages people can act on. The database raises stable markers
 * (NO_JOB_CREDITS, APPLICANT_LIMIT) or plain sentences; map the ones users can
 * fix to translated copy and pass the rest through.
 */
type T = (key: string, vars?: Record<string, string | number>) => string

export function friendlyDbError(err: unknown, t: T): string {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (/NO_JOB_CREDITS/.test(msg)) return t('errors.noJobCredits')
  if (/delete this jobs/.test(msg)) return t('errors.jobHasApplicants')
  if (/must be verified/i.test(msg)) return t('errors.companyNotVerified')
  if (/APPLICANT_LIMIT/.test(msg)) return t('errors.applicantLimit')
  if (/only be changed by HQ|done by HQ|set by HQ|managed by HQ|Only HQ/i.test(msg)) return t('errors.hqOnly')
  if (/No permission to update|row-level security|permission denied/i.test(msg)) return t('errors.noPermission')
  if (/duplicate key|already exists/i.test(msg)) return t('errors.duplicate')
  return msg
}

/** Strip a leading `NO_JOB_CREDITS:`-style marker for raw display. */
export function isNoCreditsError(err: unknown): boolean {
  return err instanceof Error && /NO_JOB_CREDITS/.test(err.message)
}
