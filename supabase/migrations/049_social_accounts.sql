-- 049 — Social accounts: HQ records the brand's social profiles in one place.
--
-- HQ (role 'admin') creates the accounts on each platform, then saves the
-- handle, profile link and login email here; a password is optional and is
-- stored only encrypted in Vault (fc_encrypt_secret), never in a table.
-- Reuses marketing_channels / marketing_credentials (032). Idempotent and
-- non-destructive.

-- Channels the campaign uses that were missing or switched off.
insert into public.marketing_channels (code, audience, name_en, name_es, sort) values
  ('whatsapp_channel', 'candidate', 'WhatsApp Channel', 'Canal de WhatsApp', 25),
  ('tiktok_ads',       'candidate', 'TikTok Ads Manager', 'TikTok Ads Manager', 26)
on conflict (code) do nothing;
update public.marketing_channels set active = true, updated_at = now()
 where code in ('meta_ads', 'youtube', 'telegram_jobs', 'whatsapp_channel', 'tiktok_ads') and not active;

alter table public.marketing_credentials
  add column if not exists login_email text not null default '';

-- HQ saves or updates one account per channel. A new password replaces the
-- pointer to the old encrypted one (the old Vault entry is kept).
create or replace function public.hq_save_social_account(
  p_channel_code text,
  p_display_name text default '',
  p_handle text default '',
  p_profile_url text default '',
  p_login_email text default '',
  p_secret text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sec uuid;
begin
  if coalesce(public.current_user_role(), '') <> 'admin' then
    raise exception 'forbidden: HQ only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.marketing_channels where code = p_channel_code) then
    raise exception 'unknown channel %', p_channel_code;
  end if;
  if coalesce(p_profile_url, '') <> '' and p_profile_url !~* '^https://' then
    raise exception 'profile link must start with https://';
  end if;
  v_sec := public.fc_encrypt_secret(nullif(p_secret, ''), 'social:' || p_channel_code);
  select id into v_id from public.marketing_credentials where channel_code = p_channel_code;
  if v_id is null then
    insert into public.marketing_credentials
      (channel_code, business_name, account_handle, profile_url, login_email,
       secret_id, secret_last4, submitter_id, status, locked, frozen_at)
    values
      (p_channel_code, left(coalesce(p_display_name, ''), 120), left(coalesce(p_handle, ''), 120),
       left(coalesce(p_profile_url, ''), 500), left(coalesce(p_login_email, ''), 200),
       v_sec, '', auth.uid()::text, 'frozen', true, now())
    returning id into v_id;
  else
    update public.marketing_credentials set
      business_name  = left(coalesce(p_display_name, ''), 120),
      account_handle = left(coalesce(p_handle, ''), 120),
      profile_url    = left(coalesce(p_profile_url, ''), 500),
      login_email    = left(coalesce(p_login_email, ''), 200),
      secret_id      = coalesce(v_sec, secret_id),
      updated_at     = now()
    where id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.hq_save_social_account(text, text, text, text, text, text) from public, anon;
grant execute on function public.hq_save_social_account(text, text, text, text, text, text) to authenticated;
