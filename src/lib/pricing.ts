/**
 * Job-posting plans and credit configuration (monetization).
 *
 * Model adopted from Remote Latinos pricing (owner-directed 2026-09-07):
 *   Pro    $97/mo   (3 job posts/mo, 45-day duration, max 100 applicants/job)
 *   Premium $297/mo (10 job posts/mo, 45-day, unlimited applicants/job)
 *   Talent Hunt     (one-time done-for-you recruiting — no public price; Book a call)
 *   Free trial      (1 job post, 14-day duration, max 20 applicants/job)
 * Yearly (billed up-front, 2 months free): Pro $970/yr, Premium $2,970/yr
 * (captured from the live Remote Latinos page with the Yearly toggle — see
 * /home/team/shared/remotelatinos-yearly-pricing-20260907.md).
 *
 * Job posts map to job credits (1 post = 1 credit — matches
 * CREDITS_PER_POSTING and companies.job_credits).
 *
 * Wompi card payment is NOT wired yet (gated on prod credentials); the /pricing
 * page runs a manual-first checkout: bank transfer + proof reference →
 * manual_payments ledger (append-only) → admin grant_company_credits.
 */

export interface JobPostingPackage {
  id: string
  /** i18n key for the plan name (e.g. pricing.pro.name) */
  nameKey: string
  /** i18n key for the short description under the plan name */
  descKey: string
  /** monthly price in USD (0 for Talent Hunt — contact / Book a call) */
  priceUsd: number
  /** yearly price in USD (billed up-front, 2 months free; 0 when N/A) */
  priceYearlyUsd: number
  /** monthly allowance of job posts (credits granted per purchase cycle) */
  credits: number
  /** active job post duration in days (matches plan) */
  listingDays: number
  /** plan kind — used by the UI to render action + positioning */
  kind: 'pro' | 'premium' | 'talent' | 'free'
  featuresKeys: string[]
  /** Wompi payment link — fill when payment goes live. */
  paymentLink: string
}

export const JOB_PACKAGES: JobPostingPackage[] = [
  {
    id: 'pro',
    nameKey: 'pricing.pro.name',
    descKey: 'pricing.pro.desc',
    priceUsd: 97,
    priceYearlyUsd: 970,
    credits: 3,
    listingDays: 45,
    kind: 'pro',
    featuresKeys: [
      'pricing.feat.pro.posts',
      'pricing.feat.pro.applicants',
      'pricing.feat.pro.talent',
      'pricing.feat.pro.matched',
      'pricing.feat.pro.team',
      'pricing.feat.pro.contact',
      'pricing.feat.pro.support',
      'pricing.feat.pro.cancel',
    ],
    paymentLink: '', // TODO(lead): set Wompi payment link when card payments go live
  },
  {
    id: 'premium',
    nameKey: 'pricing.premium.name',
    descKey: 'pricing.premium.desc',
    priceUsd: 297,
    priceYearlyUsd: 2970,
    credits: 10,
    listingDays: 45,
    kind: 'premium',
    featuresKeys: [
      'pricing.feat.premium.posts',
      'pricing.feat.premium.applicants',
      'pricing.feat.premium.integrations',
      'pricing.feat.premium.support',
      'pricing.feat.premium.team',
      'pricing.feat.premium.contact',
      'pricing.feat.premium.chatbot',
      'pricing.feat.premium.everythingInPro',
    ],
    paymentLink: '',
  },
  {
    id: 'talent',
    nameKey: 'pricing.talent.name',
    descKey: 'pricing.talent.desc',
    priceUsd: 0,
    priceYearlyUsd: 0,
    credits: 0,
    listingDays: 0,
    kind: 'talent',
    featuresKeys: [
      'pricing.feat.talent.recruiter',
      'pricing.feat.talent.posting',
      'pricing.feat.talent.interview',
      'pricing.feat.talent.shortlist',
      'pricing.feat.talent.chat',
      'pricing.feat.talent.replacement',
    ],
    paymentLink: '',
  },
]

/**
 * Free trial plan (for the compare table row only — not purchasable).
 */
export const FREE_TRIAL_PLAN: JobPostingPackage = {
  id: 'free-trial',
  nameKey: 'pricing.free.name',
  descKey: 'pricing.free.desc',
  priceUsd: 0,
  priceYearlyUsd: 0,
  credits: 1,
  listingDays: 14,
  kind: 'free',
  featuresKeys: ['pricing.feat.free.posts', 'pricing.feat.free.duration', 'pricing.feat.free.applicants', 'pricing.feat.free.admin', 'pricing.feat.free.support'],
  paymentLink: '',
}

/** Free posting credits granted to every new company so the marketplace is
 *  usable while payments are pending. NOTE: Must match companies.job_credits DB
 *  default in supabase/migrations/001_schema.sql. */
export const NEW_COMPANY_TRIAL_CREDITS = 2

/** A posting consumes exactly one credit. */
export const CREDITS_PER_POSTING = 1