// ─── Impulsa Talentos — Shared Types ───

export interface Profile {
  id: string
  userId: string
  role: 'candidate' | 'employer' | 'admin'
  fullName: string
  email: string
  phone: string
  location: string
  bio: string
  languages: string
  avatarUrl: string
  cvUrl: string
  createdAt: string
  updatedAt: string
  /** Email notification preferences. Absent ⇒ DEFAULT_NOTIFICATION_PREFS. */
  notificationPrefs?: NotificationPrefs
  /** Structured skills array (e.g. ['React', 'TypeScript', 'Customer Service']). */
  skills?: string[]
  /** Role the candidate is targeting (e.g. 'Senior Frontend Engineer'). */
  desiredRole?: string
  /** Years of professional experience. */
  experienceYears?: number
  /** Desired monthly salary range (USD). */
  desiredSalaryMin?: number
  desiredSalaryMax?: number
  /** Raw text extracted from the uploaded CV — used for matching, never displayed. */
  parsedCvText?: string
}

/** Per-user email notification preferences. */
export interface NotificationPrefs {
  /** Status changes + interview invites for jobs the user applied to. */
  applicationUpdates: boolean
  /** Digest of new jobs matching the user's profile. */
  newJobs: boolean
  /** Product news / marketing emails. */
  marketingEmails: boolean
}

/** Defaults applied whenever a profile has no stored notificationPrefs. */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  applicationUpdates: true,
  newJobs: true,
  marketingEmails: false,
}

export interface Company {
  id: string
  employerId: string
  name: string
  industry: string
  size: string
  location: string
  website: string
  description: string
  logoUrl: string
  /** Optional dedicated inbox that receives new-application notifications. */
  contactEmail?: string
  /** Job-posting credits remaining for this company (monetization). */
  jobCredits?: number
  /** Trust badge: verified companies are marked by HQ admins. */
  verified?: boolean
  /** Employer asked HQ to verify their company. */
  verificationRequested?: boolean
  createdAt: string
}

export interface Job {
  id: string
  companyId: string
  title: string
  description: string
  level: string
  locationType: string
  salaryMin: number
  salaryMax: number
  currency: string
  skillsRequired: string
  languagesRequired: string
  status: 'open' | 'closed' | 'draft'
  createdAt: string
  updatedAt: string
  /** Moderation state — 'pending'/'rejected' jobs are hidden from public listings. */
  moderationStatus?: 'pending' | 'approved' | 'rejected'
  /** Optional admin note recorded when a job is rejected. */
  moderationReason?: string
  /** Industry tag from the canonical list (see src/hooks/useIndustries.ts), e.g. 'Technology'. */
  industry?: string
}

export interface Application {
  id: string
  jobId: string
  candidateId: string
  status: 'pending' | 'reviewed' | 'interview' | 'offered' | 'hired' | 'rejected'
  coverLetter: string
  createdAt: string
  updatedAt: string
  /** Calendar/video link (Calendly, Google Meet, Zoom) for the interview. */
  interviewLink?: string
  /** ISO datetime when the interview is scheduled. */
  interviewDate?: string
}

export interface SavedJob {
  id: string
  candidateId: string
  jobId: string
  createdAt: string
}

export interface CompanyReview {
  id: string
  companyId: string
  reviewerId: string
  rating: number
  title: string
  body: string
  createdAt: string
}

/** A user-submitted abuse report against a job listing. */
export interface JobReport {
  id: string
  jobId: string
  /** Blink auth userId of the reporter ('anonymous' when signed out). */
  reporterId: string
  /** Short reason key: 'scam' | 'inappropriate' | 'inaccurate' | 'other'. */
  reason: string
  /** Free-form detail the reporter wrote. */
  note: string
  createdAt: string
}

/** Employer lead captured from gated pricing page or other acquisition channels. */
export interface Lead {
  id: string
  email: string
  phone?: string
  name?: string
  company?: string
  source: string
  status: 'new' | 'contacted' | 'converted' | 'closed'
  notes?: string
  createdAt: string
  updatedAt: string
}
