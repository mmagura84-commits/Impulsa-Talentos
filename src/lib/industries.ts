/**
 * Industry taxonomy — canonical constants for the "Industries We Serve" section.
 * Single source of truth (see /home/team/shared/industry-section-spec.md §2).
 *
 * Data contract: `jobs.industry` stores the **canonical EN string** exactly as
 * listed below. The frontend maps canonical → slug → i18n label, and filters
 * jobs with `j.industry === canonical`.
 */
export const INDUSTRIES: { canonical: string; slug: string }[] = [
  { canonical: 'Technology', slug: 'technology' },
  { canonical: 'Telecommunications', slug: 'telecommunications' },
  { canonical: 'Engineering & Design', slug: 'engineering-design' },
  { canonical: 'Advanced Manufacturing', slug: 'advanced-manufacturing' },
  { canonical: 'Aerospace', slug: 'aerospace' },
  { canonical: 'Automotive', slug: 'automotive' },
  { canonical: 'Accounting & Finance', slug: 'accounting-finance' },
  { canonical: 'Finance & Insurance', slug: 'finance-insurance' },
  { canonical: 'Business Administration & Operations', slug: 'business-admin-ops' },
  { canonical: 'Human Resources & Legal', slug: 'hr-legal' },
  { canonical: 'Customer Service', slug: 'customer-service' },
  { canonical: 'Sales & Marketing', slug: 'sales-marketing' },
  { canonical: 'Retail', slug: 'retail' },
  { canonical: 'Hospitality', slug: 'hospitality' },
  { canonical: 'Catering & Hospitality', slug: 'catering-hospitality' },
  { canonical: 'Food & Beverage', slug: 'food-beverage' },
  { canonical: 'Logistics & Distribution', slug: 'logistics-distribution' },
  { canonical: 'Manufacturing', slug: 'manufacturing' },
  { canonical: 'Construction', slug: 'construction' },
  { canonical: 'Energy', slug: 'energy' },
  { canonical: 'Skilled Trades & Industrial Management', slug: 'skilled-trades' },
  { canonical: 'Healthcare', slug: 'healthcare' },
  { canonical: 'Life Sciences', slug: 'life-sciences' },
  { canonical: 'Medical Device', slug: 'medical-device' },
  { canonical: 'Government', slug: 'government' },
  { canonical: 'Public Services & Administration', slug: 'public-services-admin' },
]

export const INDUSTRY_FAMILIES: { slug: string; icon: string; members: string[] }[] = [
  { slug: 'tech-engineering', icon: 'Code2', members: ['Technology','Telecommunications','Engineering & Design','Advanced Manufacturing','Aerospace','Automotive'] },
  { slug: 'finance-business', icon: 'Landmark', members: ['Accounting & Finance','Finance & Insurance','Business Administration & Operations','Human Resources & Legal'] },
  { slug: 'customer-hospitality', icon: 'Headphones', members: ['Customer Service','Sales & Marketing','Retail','Hospitality','Catering & Hospitality','Food & Beverage'] },
  { slug: 'operations-industrial', icon: 'Truck', members: ['Logistics & Distribution','Manufacturing','Construction','Energy','Skilled Trades & Industrial Management'] },
  { slug: 'healthcare-public', icon: 'HeartPulse', members: ['Healthcare','Life Sciences','Medical Device','Government','Public Services & Administration'] },
]

/** Convenience: canonical strings in canonical order. */
export const CANONICAL_INDUSTRIES: string[] = INDUSTRIES.map((i) => i.canonical)

const INDUSTRY_KEY_BY_CANONICAL: Record<string, string> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.canonical, `industry.${i.slug}`]),
)

/** i18n key for a canonical industry label (resolved through t()). */
export function industryLabelKey(canonical: string): string | null {
  return INDUSTRY_KEY_BY_CANONICAL[canonical] ?? null
}

/**
 * Backward-compatible matching: maps a stored free-text industry value to a
 * canonical industry when it contains a known canonical name (case-insensitive).
 * Returns null when no match — callers should fall back to a blank select.
 */
export function matchIndustry(value?: string | null): string | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  const exact = CANONICAL_INDUSTRIES.find(
    (c) => c.toLowerCase() === v || c.toLowerCase().includes(v) || v.includes(c.toLowerCase()),
  )
  return exact ?? null
}
