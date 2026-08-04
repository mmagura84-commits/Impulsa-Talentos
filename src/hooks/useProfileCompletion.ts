import { useMemo } from 'react'
import type { Profile } from '@/types'

export interface CompletionField {
  key: string
  label: string
  filled: boolean
}

export interface ProfileCompletion {
  /** Overall completion percentage (0-100) */
  percent: number
  /** Individual field statuses */
  fields: CompletionField[]
  /** Names of fields that are still empty */
  missingLabels: string[]
  /** How many fields are complete */
  completed: number
  /** Total number of tracked fields */
  total: number
}

/**
 * Parse career preferences stored as JSON inside the profile's bio field.
 * Format: `---career\n${JSON.stringify(careerPrefs)}\n---\n${actualBio}`
 */
export interface CareerPrefs {
  positionTitle?: string
  yearsOfExperience?: string
  desiredSalaryMin?: string
  desiredSalaryMax?: string
  preferredLocationType?: string
}

export function parseCareerPrefs(bio: string | undefined | null): CareerPrefs {
  if (!bio) return {}
  const match = bio.match(/---career\n([\s\S]*?)\n---/)
  if (!match) return {}
  try {
    return JSON.parse(match[1])
  } catch {
    return {}
  }
}

/**
 * Hook: compute profile completion from a Profile object.
 *
 * Tracks these fields:
 * - Basic: fullName, bio, languages, location, phone, avatarUrl
 * - Documents: cvUrl
 * - Career: positionTitle, yearsOfExperience, desiredSalary, preferredLocationType
 *   (career fields are parsed from a JSON block inside `bio`)
 */
export function useProfileCompletion(profile: Profile | undefined | null): ProfileCompletion {
  return useMemo(() => {
    if (!profile) {
      return { percent: 0, fields: [], missingLabels: [], completed: 0, total: 0 }
    }

    const career = parseCareerPrefs(profile.bio)

    // Extract the real bio text (strip the career JSON block)
    const realBio = profile.bio?.replace(/---career\n[\s\S]*?\n---\n?/, '').trim() ?? ''

    const fields: CompletionField[] = [
      { key: 'fullName', label: 'Full name', filled: !!(profile.fullName?.trim()) },
      { key: 'bio', label: 'Professional bio', filled: !!(realBio) },
      { key: 'languages', label: 'Languages', filled: !!(profile.languages?.trim()) },
      { key: 'location', label: 'Location', filled: !!(profile.location?.trim()) },
      { key: 'phone', label: 'Phone', filled: !!(profile.phone?.trim()) },
      { key: 'cvUrl', label: 'CV / Resume', filled: !!(profile.cvUrl?.trim()) },
      { key: 'avatarUrl', label: 'Profile photo', filled: !!(profile.avatarUrl?.trim()) },
      { key: 'positionTitle', label: 'Target role', filled: !!(career.positionTitle?.trim()) },
      { key: 'yearsOfExperience', label: 'Years of experience', filled: !!(career.yearsOfExperience?.trim()) },
      { key: 'desiredSalary', label: 'Desired salary', filled: !!(career.desiredSalaryMin || career.desiredSalaryMax) },
      { key: 'preferredLocationType', label: 'Work mode preference', filled: !!(career.preferredLocationType?.trim()) },
    ]

    const completed = fields.filter(f => f.filled).length
    const total = fields.length
    const percent = Math.round((completed / total) * 100)
    const missingLabels = fields.filter(f => !f.filled).map(f => f.label)

    return { percent, fields, missingLabels, completed, total }
  }, [profile])
}
