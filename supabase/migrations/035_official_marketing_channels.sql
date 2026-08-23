-- ═══════════════════════════════════════════════════════════════════════════
-- Impulsa Talentos — OFFICIAL marketing_channels catalog [PTL]
--   migration 035  (task 5a2e8ca4, owner-approved platform research)
-- ═══════════════════════════════════════════════════════════════════════════
-- Reference: /home/team/shared/marketing-platform-recommendation.md (QA-approved
-- shortlist, 2026-08-23). Migration 032 (PR #150) seeded a broad "sensible default"
-- catalog of 24 channels. The MD frozen-credentials dashboard now lands the
-- OFFICIAL owner-approved set on top of that seed, per the recommendation:
--
--   * ADD the care-vertical channel `sitly` (candidate/demand-facing,
--     sitly.com/co — nearest reachable Colombian care marketplace). Care.com
--     has NO CO page; this is the one reachable care marketplace.
--   * Apply the official audience split: brand/social/care-funnel channels
--     (Facebook, Instagram, WhatsApp Business, TikTok) become EMPLOYER-facing
--     (where the Impulsa brand + families live); corporate bilingual job boards
--     stay CANDIDATE-facing.
--   * Keep the healthy core set ACTIVE (the recommendation's essentials +
--     task-listed codes) so the MD provisions credentials for them.
--   * Clearly mark the non-core / non-care channels INACTIVE: they remain in the
--     catalog for the owner to widen later, but are hidden from the MD dashboard
--     (the page filters active=true) AND rejected by submit_marketing_credential
--     (032 line 279: 'unknown or disabled channel'). This is the non-bypassable
--     "mark genuinely non-care candidates clearly" requirement.
--
-- 032 already applied live + immutable (PR #150) ⇒ this is a NEW seed-parity
-- migration, idempotent, applied via Management API. No schema/RLS change —
-- RLS stays non-bypassable exactly as 032 (select any-auth / write admin-only
-- via public.current_user_role()).
-- ─────────────────────────────────────────────────────────────────────────────
begin;

-- 1. ADD the care-vertical channel (insert-once; idempotent).
insert into public.marketing_channels (code, audience, name_en, name_es, sort, active)
values ('sitly', 'candidate', 'Sitly (care marketplace)', 'Sitly (mercado de cuidado)', 25, true)
on conflict (code) do nothing;

-- 2. Apply the official audience split (recommendation table rows 7-10):
--    brand/social/care-funnel channels are employer-facing.
update public.marketing_channels
   set audience = 'employer'
 where code in ('facebook', 'instagram', 'whatsapp_business', 'tiktok');

-- 3. Healthy official/core set stays ACTIVE (owner-approved + task-listed codes
--    incl. the care channel just added). Explicit, idempotent.
update public.marketing_channels set active = true where code in (
  'linkedin_company', 'linkedin_jobs', 'instagram', 'computrabajo', 'elempleo',
  'magneto365', 'indeed_colombia', 'facebook', 'facebook_employer_groups',
  'facebook_regional', 'whatsapp_business', 'tiktok', 'google_business', 'sitly'
);

-- 4. Genuinely non-care / non-core channels clearly marked INACTIVE (dropped from
--    the recommendation shortlist or non-care corporate-only; remain catalogued).
update public.marketing_channels set active = false where code in (
  'twitter_company', 'youtube', 'email_marketing', 'google_ads', 'meta_ads',
  'twitter_employer', 'torre', 'konzerta', 'bumeran', 'telegram_jobs', 'glassdoor'
);

commit;
