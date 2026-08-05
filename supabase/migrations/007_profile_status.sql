-- MD approval status for profile records.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_status text NOT NULL DEFAULT 'active';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_status_check CHECK (profile_status IN ('active','pending','rejected'));
