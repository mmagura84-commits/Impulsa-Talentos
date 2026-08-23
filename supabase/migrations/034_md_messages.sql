-- ═══════════════════════════════════════════════════════════════════════════
-- Impulsa Talentos — MD Messages inbox/outbox schema + RPCs [PTL]
--   migration 034  (task ce7615d4, MD Messages rework after QA block)
-- ═══════════════════════════════════════════════════════════════════════════
-- Unblocks PR #149 (MdMessagesPage.tsx): the UI composed against the app-scoped
-- `messages` table (migration 015) which has NO direction/status/recipient_email/
-- subject columns, application_id NOT NULL, app-scoped RLS → always 400 PGRST204.
--
-- This adds a DEDICATED md_messages lane (NOT an ALTER of `messages`), keeping
-- the employer⇄candidate messenger intact and giving the MD a clean frozen-style
-- least-privilege model mirroring migration 032:
--   * md_messages            — append-only audit lane (INSERT+SELECT own; no
--                              UPDATE/DELETE; admin SELECT all)
--   * md_submit_outbox(...)  — SD, MD only → inserts outbound 'queued' row
--   * md_list_messages()     — SD, MD=own / admin=all, masked jsonb array
-- Role guards use coalesce(current_user_role(),'') (NULL-safe, migration-032
-- rule). No cross-table subqueries (NO-RAW-SUBQUERY rule). EMAIL_ENABLED=false
-- until the send pipeline is accepted — status stays 'queued', honest "outbox".
-- Idempotent. Applied via Management API.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

create table if not exists public.md_messages (
  id              uuid primary key default gen_random_uuid(),
  submitter_id    text not null default '',           -- auth.uid()::text (MD)
  direction       text not null default 'outbound'
                    check (direction in ('inbound','outbound')),
  recipient_email text not null default '',           -- outbound: who it goes to
  subject         text not null default '',
  body            text not null default '',
  status          text not null default 'queued'
                    check (status in ('queued','delivered','failed')),
  created_at      timestamptz not null default now()
);

alter table public.md_messages enable row level security;

-- MD may insert a row bound to themselves (the SECURITY DEFINER RPC is the write
-- path; here an authenticated md can also insert their own row directly).
drop policy if exists md_messages_insert_own on public.md_messages;
create policy md_messages_insert_own on public.md_messages
  for insert to authenticated
  with check (
    coalesce(public.current_user_role(),'') = 'md'
    and submitter_id = auth.uid()::text
  );

-- MD sees own rows.
drop policy if exists md_messages_select_own on public.md_messages;
create policy md_messages_select_own on public.md_messages
  for select to authenticated
  using (submitter_id = auth.uid()::text);

-- Admin sees all.
drop policy if exists md_messages_select_admin on public.md_messages;
create policy md_messages_select_admin on public.md_messages
  for select to authenticated
  using (coalesce(public.current_user_role(),'') = 'admin');

-- NO UPDATE / NO DELETE policies: append-only audit lane (business property).
-- Post-apply verification:
--   select polname, cmd from pg_policies where tablename='md_messages';

-- ── md_submit_outbox ────────────────────────────────────────────────────────
create or replace function public.md_submit_outbox(
  p_recipient_email text,
  p_subject         text,
  p_body            text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid  text := auth.uid()::text;
        v_id   uuid;
begin
  if coalesce(public.current_user_role(),'') <> 'md' then
    raise exception 'forbidden: md only';
  end if;
  if v_uid is null or v_uid = '' then
    raise exception 'forbidden: no session';
  end if;
  insert into public.md_messages
    (submitter_id, direction, recipient_email, subject, body, status)
  values
    (v_uid, 'outbound', coalesce(p_recipient_email,''), coalesce(p_subject,''),
     coalesce(p_body,''), 'queued')
  returning id into v_id;
  return v_id;
end $$;

-- ── md_list_messages ───────────────────────────────────────────────────────
create or replace function public.md_list_messages()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_role text := public.current_user_role();
        v_rows jsonb;
begin
  if coalesce(v_role,'') = 'admin' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'direction', direction,
             'recipient_email', recipient_email,
             'subject', subject, 'body', body,
             'status', status, 'created_at', created_at
           ) order by created_at desc), '[]'::jsonb) into v_rows
    from public.md_messages;
  elsif coalesce(v_role,'') = 'md' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'direction', direction,
             'recipient_email', recipient_email,
             'subject', subject, 'body', body,
             'status', status, 'created_at', created_at
           ) order by created_at desc), '[]'::jsonb) into v_rows
    from public.md_messages
    where submitter_id = auth.uid()::text;
  else
    raise exception 'forbidden';
  end if;
  return v_rows;
end $$;

grant execute on function public.md_submit_outbox(text,text,text) to authenticated;
grant execute on function public.md_list_messages() to authenticated;

COMMIT;
