-- Migration 017: Founder / Managing Director workspace security foundation
-- Phase 0 only: additive company-scoped authorization primitives. This does not
-- add routes or duplicate CRM/application features. Authenticated acceptance and
-- owner ratification remain required before enabling operational workflows.

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('founder','md','employer_admin','recruiter')),
  status text not null default 'invited' check (status in ('invited','active','suspended','removed')),
  invited_by text,
  invited_at timestamptz not null default now(),
  activated_at timestamptz,
  suspended_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists company_memberships_active_user_company_idx
  on public.company_memberships(company_id, user_id) where status in ('invited','active','suspended');
create index if not exists company_memberships_user_status_idx on public.company_memberships(user_id, status);
create index if not exists company_memberships_company_status_idx on public.company_memberships(company_id, status);

create table if not exists public.permission_grants (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.company_memberships(id) on delete cascade,
  permission_key text not null,
  granted_by text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists permission_grants_active_idx
  on public.permission_grants(membership_id, permission_key) where revoked_at is null;
create index if not exists permission_grants_membership_idx on public.permission_grants(membership_id);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requested_by text not null,
  action text not null,
  target_type text not null,
  target_id text,
  requested_change jsonb not null default '{}'::jsonb,
  threshold numeric,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','expired')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists approval_requests_company_status_idx on public.approval_requests(company_id, status, created_at desc);
create index if not exists approval_requests_requester_idx on public.approval_requests(requested_by, created_at desc);

create table if not exists public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests(id) on delete cascade,
  decided_by text not null,
  decision text not null check (decision in ('approved','rejected')),
  reason text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists approval_decisions_request_idx on public.approval_decisions(request_id, created_at desc);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id text not null,
  company_id uuid references public.companies(id) on delete set null,
  target_type text not null,
  target_id text,
  action text not null,
  result text not null default 'success',
  reason text,
  request_id text,
  policy_version text not null default 'phase0-v1',
  before_json jsonb,
  after_json jsonb
);
create index if not exists audit_events_company_time_idx on public.audit_events(company_id, occurred_at desc);
create index if not exists audit_events_actor_time_idx on public.audit_events(actor_user_id, occurred_at desc);

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  require_dual_approval boolean not null default false,
  finance_masking_enabled boolean not null default true,
  approval_threshold numeric,
  policy_version text not null default 'phase0-v1',
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_access_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id text not null,
  granted_by text not null,
  purpose text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists finance_access_grants_active_idx
  on public.finance_access_grants(company_id, user_id, expires_at) where revoked_at is null;

-- Scope and capability helpers. SECURITY DEFINER is deliberately narrow and
-- derives actor identity from auth.uid(); callers cannot supply an actor id.
create or replace function public.has_company_membership(p_company_id uuid, p_roles text[] default null)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.company_memberships m
    where m.company_id = p_company_id and m.user_id = auth.uid()::text
      and m.status = 'active' and (p_roles is null or m.role = any(p_roles))
  )
$$;

create or replace function public.can_company(p_company_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.company_memberships m
    left join public.permission_grants g on g.membership_id = m.id
      and g.permission_key = p_permission and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
    where m.company_id = p_company_id and m.user_id = auth.uid()::text and m.status = 'active'
      and (m.role = 'founder' or g.id is not null)
  )
$$;

create or replace function public.my_company_scopes()
returns table(company_id uuid, membership_id uuid, role text)
language sql stable security definer set search_path = public
as $$
  select m.company_id, m.id, m.role from public.company_memberships m
  where m.user_id = auth.uid()::text and m.status = 'active'
$$;

alter table public.company_memberships enable row level security;
alter table public.permission_grants enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_decisions enable row level security;
alter table public.audit_events enable row level security;
alter table public.company_settings enable row level security;
alter table public.finance_access_grants enable row level security;

-- Memberships and grants: members can see only their own membership/access;
-- Founder/admin management writes are deferred to a server-side workflow.
create policy company_memberships_select_own on public.company_memberships for select
  using (user_id = auth.uid()::text or public.can_company(company_id, 'team.manage'));
create policy permission_grants_select_own on public.permission_grants for select
  using (exists (select 1 from public.company_memberships m where m.id = membership_id and m.user_id = auth.uid()::text));

create policy approval_requests_scope on public.approval_requests for select
  using (public.has_company_membership(company_id));
create policy approval_requests_insert_scope on public.approval_requests for insert
  with check (requested_by = auth.uid()::text and public.has_company_membership(company_id));
create policy approval_decisions_scope on public.approval_decisions for select
  using (exists (select 1 from public.approval_requests r where r.id = request_id and public.has_company_membership(r.company_id)));

create policy audit_events_scope on public.audit_events for select
  using (company_id is not null and public.has_company_membership(company_id));
create policy company_settings_scope on public.company_settings for select
  using (public.has_company_membership(company_id));
create policy finance_grants_scope on public.finance_access_grants for select
  using (user_id = auth.uid()::text or public.can_company(company_id, 'finance.read_detail'));

-- Trusted write paths derive actor identity from auth.uid() and keep audit rows
-- append-only. Direct table writes remain unavailable to client roles.
create or replace function public.record_audit_event(
  p_company_id uuid, p_target_type text, p_target_id text, p_action text,
  p_result text default 'success', p_reason text default null,
  p_request_id text default null, p_before jsonb default null, p_after jsonb default null
) returns uuid language plpgsql security definer set search_path = public
as $$
 declare v_id uuid;
 begin
   if auth.uid() is null or p_company_id is null or not public.has_company_membership(p_company_id) then
     raise exception 'not authorized';
   end if;
   insert into public.audit_events(actor_user_id, company_id, target_type, target_id, action, result, reason, request_id, before_json, after_json)
   values (auth.uid()::text, p_company_id, p_target_type, p_target_id, p_action, p_result, p_reason, p_request_id, p_before, p_after)
   returning id into v_id;
   return v_id;
 end
$$;

create or replace function public.decide_approval(p_request_id uuid, p_decision text, p_reason text default '') returns uuid
language plpgsql security definer set search_path = public
as $$
 declare v_request public.approval_requests%rowtype; v_id uuid;
 begin
   if auth.uid() is null or p_decision not in ('approved','rejected') then raise exception 'invalid request'; end if;
   select * into v_request from public.approval_requests where id = p_request_id for update;
   if not found or v_request.status <> 'pending' or v_request.requested_by = auth.uid()::text then raise exception 'not authorized'; end if;
   if not public.can_company(v_request.company_id, 'approvals.decide') then raise exception 'not authorized'; end if;
   insert into public.approval_decisions(request_id, decided_by, decision, reason)
   values (p_request_id, auth.uid()::text, p_decision, p_reason) returning id into v_id;
   update public.approval_requests set status = p_decision, resolved_at = now() where id = p_request_id;
   perform public.record_audit_event(v_request.company_id, 'approval_request', p_request_id::text, 'approval.' || p_decision, 'success', p_reason);
   return v_id;
 end
$$;

grant execute on function public.record_audit_event(uuid,text,text,text,text,text,text,jsonb,jsonb) to authenticated;
grant execute on function public.decide_approval(uuid,text,text) to authenticated;

-- Audit events are append-only: no update/delete policy is intentionally created.
revoke insert, update, delete on public.audit_events from anon, authenticated;
revoke insert, update, delete on public.approval_decisions from anon, authenticated;
revoke insert, update, delete on public.permission_grants from anon, authenticated;
revoke insert, update, delete on public.finance_access_grants from anon, authenticated;
revoke insert, update, delete on public.company_settings from anon, authenticated;
