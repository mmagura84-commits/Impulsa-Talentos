// ─── Impulsa Talentos — Shared Types ───

export interface Profile {
  id: string
  userId: string
  role: 'candidate' | 'employer' | 'admin' | 'md'
  /** Approval status for managing director accounts. */
  profileStatus?: 'active' | 'pending' | 'rejected'
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
  /** Preferred work mode (e.g. 'Remote', 'Hybrid', 'On-site'). */
  preferredLocationType?: string
  /** Desired monthly salary range (USD). */
  desiredSalaryMin?: number
  desiredSalaryMax?: number
  /** Raw text extracted from the uploaded CV — used for matching, never displayed. */
  parsedCvText?: string
  /** Employer meeting provider preference. */
  meetingProvider?: string
  /** Employer default meeting room URL. */
  meetingLink?: string
  /** How the user heard about Impulsa Talentos. */
  source?: string
  /** User consented to marketing emails at sign-up. */
  emailConsent?: boolean
  /** Social links for MD profile. */
  linkedinUrl?: string
  twitterUrl?: string
  instagramUrl?: string
  whatsappNumber?: string
  tiktokUrl?: string
  youtubeUrl?: string
  /** Candidate enrichment fields (migration 018) */
  headline?: string
  preferredLanguage?: 'es' | 'en' | 'pt'
  timezone?: string
  employmentStatus?: 'employed' | 'unemployed' | 'student' | 'freelance'
  availabilityDate?: string
  employmentPreference?: 'full_time' | 'part_time' | 'contract' | 'freelance' | 'any'
  currencyPreference?: string
  willingToRelocate?: boolean
  workAuthorization?: string
  portfolioUrl?: string
  preferredContactMethod?: 'email' | 'whatsapp' | 'sms' | 'in_app'
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
  /** When the job was paused (migration 024); null = active. */
  pausedAt?: string | null
  /** When the job was archived (migration 024); null = live. */
  archivedAt?: string | null
  /** When the job went live (migration 024). */
  publishedAt?: string | null
  /** When the listing expires (migration 024). */
  expiresAt?: string | null
  /** Assigned team member (team_members.id, migration 024). */
  assigneeId?: string | null
}

export type ApplicationStatus =
  | 'draft'
  | 'applied'
  | 'under_review'
  | 'recruiter_screening'
  | 'interview_scheduled'
  | 'assessment_required'
  | 'assessment_submitted'
  | 'submitted_to_client'
  | 'client_interview'
  | 'final_interview'
  | 'offer'
  | 'hired'
  | 'not_selected'
  | 'position_closed'
  | 'withdrawn'

export interface Application {
  id: string
  jobId: string
  candidateId: string
  status: ApplicationStatus
  coverLetter: string
  createdAt: string
  updatedAt: string
  /** Calendar/video link (Calendly, Google Meet, Zoom) for the interview. */
  interviewLink?: string
  /** ISO datetime when the interview is scheduled. */
  interviewDate?: string
  /** Assigned recruiter */
  recruiterId?: string
  /** Next action the candidate needs to take */
  nextAction?: string
  /** Due date for next action */
  nextActionDue?: string
  /** Feedback for candidate */
  feedback?: string
  /** Reason if withdrawn */
  withdrawnReason?: string
}

/** Status history entry for an application. */
export interface ApplicationStatusHistory {
  id: string
  applicationId: string
  status: ApplicationStatus
  note?: string
  changedBy?: string
  createdAt: string
}


/** Employer ↔ candidate message scoped to an application. */
export interface Message {
  id: string
  applicationId: string
  senderId: string
  body: string
  createdAt: string
}

/** Offer created by an employer for a candidate application. */
export interface Offer {
  id: string
  applicationId: string
  salary: number
  currency: string
  startDate?: string
  notes?: string
  status: 'pending' | 'revised' | 'accepted' | 'declined' | 'withdrawn'
  createdAt: string
  updatedAt: string
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

/** Team member on an employer company. */
export type TeamMemberRole = 'owner' | 'admin' | 'member'
export type TeamMemberStatus = 'active' | 'pending' | 'declined'

export interface TeamMember {
  id: string
  companyId: string
  userId: string
  role: TeamMemberRole
  invitedBy?: string
  inviteEmail?: string
  status: TeamMemberStatus
  createdAt: string
  updatedAt: string
}

/** Employer interview scheduled against a candidate application. */
export type InterviewType = 'phone' | 'screening' | 'technical' | 'cultural' | 'final'
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Interview {
  id: string
  jobId: string
  candidateId: string
  companyId: string
  scheduledAt: string
  durationMinutes: number
  type: InterviewType
  status: InterviewStatus
  locationOrLink?: string
  notes?: string
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export type ScorecardRecommendation = 'strong_yes' | 'yes' | 'maybe' | 'no' | 'strong_no'

/** Internal employer evaluation of an interview (never shown to candidates). */
export interface InterviewScorecard {
  id: string
  interviewId: string
  reviewerId: string
  overallRating: number
  strengths?: string
  concerns?: string
  recommendation: ScorecardRecommendation
  submittedAt?: string
  createdAt: string
}

/** Per-question rating on a scorecard (structured feedback). */
export interface InterviewScorecardQuestion {
  id: string
  scorecardId: string
  question: string
  rating?: number
  answer?: string
  createdAt: string
}

/** Known in-app notification types (action-center routing). */
export type NotificationType =
  | 'application_received'
  | 'status_changed'
  | 'message_received'
  | 'interview_scheduled'
  | 'feedback_added'
  | 'team_invite'

/** In-app notification shown in the action center. */
export interface Notification {
  id: string
  /** Auth user id (profiles.user_id), NOT profiles.id. */
  userId: string
  type: NotificationType
  title: string
  body: string
  /** Opaque routing params (snake_case keys: job_id, application_id, …). */
  data?: Record<string, unknown>
  /** NULL while unread; set once the user acknowledges it. */
  readAt?: string
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

/** Visibility of structured feedback: internal-only or visible to the candidate. */
export type FeedbackVisibility = 'internal' | 'candidate_visible'

/** Structured employer feedback on an application (migration 021). */
export interface ApplicationFeedback {
  id: string
  applicationId: string
  /** profiles.id of the team member who wrote the feedback. */
  authorId: string
  companyId: string
  /** Pipeline stage the feedback was given at (e.g. screening, interview). */
  stage?: string
  /** 1–5 rating, nullable when qualitative feedback only. */
  rating?: number | null
  strengths?: string
  concerns?: string
  nextSteps?: string
  visibility: FeedbackVisibility
  createdAt: string
  updatedAt: string
}
