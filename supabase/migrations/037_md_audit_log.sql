-- ─────────────────────────────────────────────────────────────────────────────
-- 037_md_audit_log.sql — MD action-level audit log (owner "full visibility")
--
-- Owner direction: "build a dedicated MD audit log (actions they take in their
-- dashboard) and surface it in my HQ oversight view."
--
-- Closes the honest gap flagged in PR #176: the MD Activity tab showed only what
-- was already recorded (outbox, credential change requests, MD accounts). This
-- adds the missing ACTION-level audit lane for MD dashboard actions the MD
-- performs in their own workspace.
--
-- Mirrors the proven md_messages pattern (migration 034): append-only ledger,
-- SECURITY DEFINER RPC for MD writes + admin/MD reads, NO update/delete policies.
-- Non-bypassable via RLS.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

create table if not exists public.md_audit_log (
  id           uuid primary key default gen_random_uuid(),
  submitter_id text not null default '',            -- auth.uid()::text (MD)
  action       text not null default '',
  entity_type  text not null default '',            -- e.g. banking|marketing|message|profile
  entity_ref   text not null default '',            -- entity/context id reference
  metadata     jsonb not null default '{}'::jsonb,  -- event-specific detail (masked; never PII)
  created_at   timestamptz not null default now()
);
alter table public.md_audit_log enable row level security;

-- MD may insert a row bound to themselves (SD RPC is the write path; this direct
-- insert policy mirrors md_messages_insert_own for parity/roles).
drop policy if exists md_audit_insert_own on public.md_audit_log;
create policy md_audit_insert_own on public.md_audit_log
  for insert to authenticated
  with check (
    coalesce(public.current_user_role(),'') = 'md'
    and submitter_id = auth.uid()::text
  );
-- MD sees own rows.
drop policy if exists md_audit_select_own on public.md_audit_log;
create policy md_audit_select_own on public.md_audit_log
  for select to authenticated
  using (submitter_id = auth.uid()::text);
-- Admin sees all.
drop policy if exists md_audit_select_admin on public.md_audit_log;
create policy md_audit_select_admin on public.md_audit_log
  for select to authenticated
  using (coalesce(public.current_user_role(),'') = 'admin');
-- NO UPDATE / NO DELETE policies: append-only audit lane (business property).
-- Post-apply verification:
--   select polname, cmd from pg_policies where tablename='md_audit_log';

-- ── md_write_audit ──────────────────────────────────────────────────────────
-- SECURITY DEFINER: MD-only append of an audit event bound to the caller.
create or replace function public.md_write_audit(
  p_action      text,
  p_entity_type text,
  p_entity_ref  text,
  p_metadata    jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_uid text := auth.uid()::text;
        v_id  uuid;
begin
  if coalesce(public.current_user_role(),'') <> 'md' then
    raise exception 'forbidden: md only';
  end if;
  if v_uid is null or v_uid = '' then
    raise exception 'forbidden: no session';
  end if;
  insert into public.md_audit_log
    (submitter_id, action, entity_type, entity_ref, metadata)
  values
    (v_uid, coalesce(p_action,''), coalesce(p_entity_type,''),
     coalesce(p_entity_ref,''), coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

-- ── md_list_audit ───────────────────────────────────────────────────────────
-- SECURITY DEFINER: admin sees all; MD sees own.
create or replace function public.md_list_audit()
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
             'id', id, 'action', action, 'entity_type', entity_type,
             'entity_ref', entity_ref, 'metadata', metadata,
             'created_at', created_at
           ) order by created_at desc), '[]'::jsonb) into v_rows
    from public.md_audit_log;
  elsif coalesce(v_role,'') = 'md' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'action', action, 'entity_type', entity_type,
             'entity_ref', entity_ref, 'metadata', metadata,
             'created_at', created_at
           ) order by created_at desc), '[]'::jsonb) into v_rows
    from public.md_audit_log
    where submitter_id = auth.uid()::text;
  else
    raise exception 'forbidden';
  end if;
  return v_rows;
end $$;

grant execute on function public.md_write_audit(text,text,text,jsonb) to authenticated;
grant execute on function public.md_list_audit() to authenticated;
COMMIT;
