-- Migration 018: Candidate Profile Enrichment + Application Tracker Enhancements
-- Adds structured profile fields, expands application statuses, adds status history

BEGIN;

-- 1. Expand application status check constraint
ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status IN (
    'draft',
    'applied',
    'under_review',
    'recruiter_screening',
    'interview_scheduled',
    'assessment_required',
    'assessment_submitted',
    'submitted_to_client',
    'client_interview',
    'final_interview',
    'offer',
    'hired',
    'not_selected',
    'position_closed',
    'withdrawn'
  ));

-- 2. Application status history table
CREATE TABLE IF NOT EXISTS application_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  changed_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_status_history_app ON application_status_history(application_id);

-- 3. Add recruiter assignment to applications
ALTER TABLE applications ADD COLUMN IF NOT EXISTS recruiter_id uuid REFERENCES profiles(id);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS next_action_due timestamptz;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS feedback text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS withdrawn_reason text;

-- 4. Enrich profiles for candidate-specific fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS headline text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'es' CHECK (preferred_language IN ('es', 'en', 'pt'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employment_status text CHECK (employment_status IN ('employed', 'unemployed', 'student', 'freelance'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS availability_date date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employment_preference text CHECK (employment_preference IN ('full_time', 'part_time', 'contract', 'freelance', 'any'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_role text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_salary_min numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS desired_salary_max numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS currency_preference text DEFAULT 'COP';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS willing_to_relocate boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS work_authorization text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_contact_method text DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'whatsapp', 'sms', 'in_app'));

-- 5. Structured work experience
CREATE TABLE IF NOT EXISTS candidate_work_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  job_title text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  is_current boolean DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_exp_profile ON candidate_work_experience(profile_id);

-- 6. Structured education
CREATE TABLE IF NOT EXISTS candidate_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution text NOT NULL,
  degree text NOT NULL,
  field_of_study text,
  start_date date NOT NULL,
  end_date date,
  is_current boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_education_profile ON candidate_education(profile_id);

-- 7. Structured skills (many-to-many)
CREATE TABLE IF NOT EXISTS candidate_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  proficiency_level text DEFAULT 'intermediate' CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'expert', 'native')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_skills_profile ON candidate_skills(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_skills_unique ON candidate_skills(profile_id, skill_name);

-- 8. Structured language proficiencies
CREATE TABLE IF NOT EXISTS candidate_languages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('es', 'en', 'pt', 'fr', 'de', 'it', 'other')),
  proficiency_level text NOT NULL DEFAULT 'intermediate' CHECK (proficiency_level IN ('beginner', 'intermediate', 'advanced', 'fluent', 'native')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_lang_profile ON candidate_languages(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_lang_unique ON candidate_languages(profile_id, language);

-- 9. Document center table
CREATE TABLE IF NOT EXISTS candidate_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('cv', 'cover_letter', 'certification', 'id_document', 'work_authorization', 'reference', 'assessment', 'offer_letter', 'agreement', 'other')),
  filename text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  mime_type text,
  is_private boolean DEFAULT true,
  expires_at date,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_docs_profile ON candidate_documents(profile_id);

-- 10. Notification preferences enhancement
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_contact_method_for_notifications text DEFAULT 'email';

COMMIT;
