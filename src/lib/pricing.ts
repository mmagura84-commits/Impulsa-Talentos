/**
 * Job-posting packages and credit configuration (monetization, Gap 4).
 *
 * Stripe Connect is NOT wired yet. When it is, the lead will create
 * products/payment links in the platform and paste the URLs into
 * `paymentLink` below — the /pricing page buttons will then redirect
 * to Stripe automatically. Until then the buttons show a "coming soon"
 * toast and credits are only granted by the welcome trial.
 */

export interface JobPostingPackage {
  id: string
  nameKey: string
  descKey: string
  priceUsd: number
  credits: number
  listingDays: number
  featuredDays?: number
  featuresKeys: string[]
  /** Stripe payment link — fill when Connect is live. */
  paymentLink: string
}

export const JOB_PACKAGES: JobPostingPackage[] = [
  {
    id: 'single',
    nameKey: 'pricing.single.name',
    descKey: 'pricing.single.desc',
    priceUsd: 49,
    credits: 1,
    listingDays: 30,
    featuresKeys: ['pricing.feat.1listing', 'pricing.feat.30days', 'pricing.feat.support'],
    paymentLink: '', // TODO(lead): set Stripe payment link once Connect is live
  },
  {
    id: 'five',
    nameKey: 'pricing.five.name',
    descKey: 'pricing.five.desc',
    priceUsd: 199,
    credits: 5,
    listingDays: 30,
    featuresKeys: ['pricing.feat.5listing', 'pricing.feat.save', 'pricing.feat.priority'],
    paymentLink: '',
  },
  {
    id: 'featured',
    nameKey: 'pricing.featured.name',
    descKey: 'pricing.featured.desc',
    priceUsd: 29,
    credits: 0,
    listingDays: 0,
    featuredDays: 7,
    featuresKeys: ['pricing.feat.featured7', 'pricing.feat.top', 'pricing.feat.more'],
    paymentLink: '',
  },
]

/**
 * Free posting credits granted to every new company so the marketplace is
 * usable while Stripe is pending. Set to 0 when payments go live to make
 * every posting require a purchase. NOTE: Must match companies.job_credits DB
 * default in supabase/migrations/001_schema.sql:44.
 */
 export const NEW_COMPANY_TRIAL_CREDITS = 2

/** A posting consumes exactly one credit. */
export const CREDITS_PER_POSTING = 1
