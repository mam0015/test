-- Alert Construction product foundation
-- Run this migration in the Supabase SQL editor before enabling team sync.

create extension if not exists pgcrypto;

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete restrict,
  email text not null default '',
  full_name text not null default '',
  role text not null default 'site_supervisor' check (role in ('owner','estimator','site_supervisor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ac_workspaces (
  organisation_id uuid primary key references public.organisations(id) on delete cascade,
  workspace jsonb not null default '{"projects":[],"updatedAt":null}'::jsonb,
  revision bigint not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.ac_workspace_versions (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  revision bigint not null,
  workspace jsonb not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.price_catalogue (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  item_key text not null,
  trade text not null check (trade in ('electrical','plumbing','cladding','carpentry','cabinetry','tiling','painting','flooring','demolition','waterproofing','plastering','fixtures','benchtops','exterior','professional','roofing','windows_doors','landscaping','concreting','hvac','general')),
  item_name text not null,
  unit text not null default 'each',
  builder_rate numeric(12,2) not null check (builder_rate >= 0),
  margin_percent numeric(6,2) not null default 20 check (margin_percent >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  source text not null default 'Office catalogue',
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, item_key)
);

create table if not exists public.price_catalogue_history (
  id bigint generated always as identity primary key,
  catalogue_id uuid,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  item_key text not null,
  action text not null check (action in ('insert','update','delete')),
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ac_audit_log (
  id bigint generated always as identity primary key,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_id text,
  record_id text,
  action text not null,
  module text,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists price_catalogue_org_trade_idx on public.price_catalogue(organisation_id, trade, sort_order);
create index if not exists workspace_versions_org_idx on public.ac_workspace_versions(organisation_id, created_at desc);
create index if not exists audit_log_org_idx on public.ac_audit_log(organisation_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organisations_set_updated_at on public.organisations;
create trigger organisations_set_updated_at before update on public.organisations
for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists catalogue_set_updated_at on public.price_catalogue;
create trigger catalogue_set_updated_at before update on public.price_catalogue
for each row execute function public.set_updated_at();

create or replace function public.current_organisation_id()
returns uuid language sql stable security definer set search_path = public
as $$ select organisation_id from public.profiles where id = auth.uid() $$;

create or replace function public.current_ac_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.handle_new_ac_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  new_org uuid;
  invited_org uuid;
  requested_code text;
begin
  requested_code := upper(trim(coalesce(new.raw_user_meta_data->>'team_code','')));
  if requested_code <> '' then
    select id into invited_org from public.organisations where join_code = requested_code;
    if invited_org is null then
      raise exception 'Team code not found. Check the code or leave it blank to create your own workspace.';
    end if;
    insert into public.profiles(id, organisation_id, email, full_name, role)
    values (new.id, invited_org, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''), 'site_supervisor');
    insert into public.ac_audit_log(organisation_id, action, module, details, actor_id)
    values (invited_org, 'member_joined', 'accounts', jsonb_build_object('join_method','signup_team_code','assigned_role','site_supervisor'), new.id);
  else
    insert into public.organisations(name, created_by)
    values (coalesce(nullif(new.raw_user_meta_data->>'organisation_name',''), 'Private Workspace'), new.id)
    returning id into new_org;
    insert into public.profiles(id, organisation_id, email, full_name, role)
    values (new.id, new_org, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''), 'owner');
    insert into public.ac_workspaces(organisation_id, workspace, updated_by)
    values (new_org, jsonb_build_object('projects', '[]'::jsonb, 'updatedAt', now()), new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_ac on auth.users;
create trigger on_auth_user_created_ac after insert on auth.users
for each row execute function public.handle_new_ac_user();

create or replace function public.join_organisation(p_code text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  target_org public.organisations%rowtype;
  old_org uuid;
begin
  select * into target_org from public.organisations where join_code = upper(trim(p_code));
  if target_org.id is null then raise exception 'Team code not found'; end if;
  select organisation_id into old_org from public.profiles where id = auth.uid();
  update public.profiles
  set organisation_id = target_org.id, role = 'site_supervisor', updated_at = now()
  where id = auth.uid();
  return jsonb_build_object('organisation_id', target_org.id, 'organisation_name', target_org.name, 'role', 'site_supervisor', 'previous_organisation_id', old_org);
end;
$$;

create or replace function public.set_ac_member_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if public.current_ac_role() <> 'owner' then raise exception 'Only an owner can change team roles'; end if;
  if p_role not in ('owner','estimator','site_supervisor') then raise exception 'Invalid role'; end if;
  if p_user = auth.uid() and p_role <> 'owner' then raise exception 'An owner cannot remove their own owner access'; end if;
  update public.profiles set role = p_role, updated_at = now()
  where id = p_user and organisation_id = public.current_organisation_id();
  if not found then raise exception 'Team member not found'; end if;
end;
$$;

create or replace function public.version_workspace()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.revision = old.revision + 1;
  end if;
  new.updated_at = now();
  insert into public.ac_workspace_versions(organisation_id, revision, workspace, changed_by)
  values (new.organisation_id, new.revision, new.workspace, auth.uid());
  return new;
end;
$$;

drop trigger if exists workspace_version_trigger on public.ac_workspaces;
create trigger workspace_version_trigger before insert or update on public.ac_workspaces
for each row execute function public.version_workspace();

create or replace function public.audit_catalogue_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.price_catalogue_history(catalogue_id, organisation_id, item_key, action, old_value, new_value, changed_by)
  values (
    coalesce(new.id, old.id), coalesce(new.organisation_id, old.organisation_id),
    coalesce(new.item_key, old.item_key), lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    auth.uid()
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists catalogue_history_trigger on public.price_catalogue;
create trigger catalogue_history_trigger after insert or update or delete on public.price_catalogue
for each row execute function public.audit_catalogue_change();

alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.ac_workspaces enable row level security;
alter table public.ac_workspace_versions enable row level security;
alter table public.price_catalogue enable row level security;
alter table public.price_catalogue_history enable row level security;
alter table public.ac_audit_log enable row level security;

drop policy if exists organisations_member_select on public.organisations;
create policy organisations_member_select on public.organisations for select to authenticated
using (id = public.current_organisation_id());
drop policy if exists organisations_owner_update on public.organisations;
create policy organisations_owner_update on public.organisations for update to authenticated
using (id = public.current_organisation_id() and public.current_ac_role() = 'owner')
with check (id = public.current_organisation_id());

drop policy if exists profiles_team_select on public.profiles;
create policy profiles_team_select on public.profiles for select to authenticated
using (organisation_id = public.current_organisation_id());

drop policy if exists workspaces_team_select on public.ac_workspaces;
create policy workspaces_team_select on public.ac_workspaces for select to authenticated
using (organisation_id = public.current_organisation_id());
drop policy if exists workspaces_team_insert on public.ac_workspaces;
create policy workspaces_team_insert on public.ac_workspaces for insert to authenticated
with check (organisation_id = public.current_organisation_id());
drop policy if exists workspaces_team_update on public.ac_workspaces;
create policy workspaces_team_update on public.ac_workspaces for update to authenticated
using (organisation_id = public.current_organisation_id()) with check (organisation_id = public.current_organisation_id());

drop policy if exists versions_team_select on public.ac_workspace_versions;
create policy versions_team_select on public.ac_workspace_versions for select to authenticated
using (organisation_id = public.current_organisation_id());

drop policy if exists catalogue_team_select on public.price_catalogue;
create policy catalogue_team_select on public.price_catalogue for select to authenticated
using (organisation_id = public.current_organisation_id());
drop policy if exists catalogue_office_insert on public.price_catalogue;
create policy catalogue_office_insert on public.price_catalogue for insert to authenticated
with check (organisation_id = public.current_organisation_id() and public.current_ac_role() in ('owner','estimator'));
drop policy if exists catalogue_office_update on public.price_catalogue;
create policy catalogue_office_update on public.price_catalogue for update to authenticated
using (organisation_id = public.current_organisation_id() and public.current_ac_role() in ('owner','estimator'))
with check (organisation_id = public.current_organisation_id());
drop policy if exists catalogue_owner_delete on public.price_catalogue;
create policy catalogue_owner_delete on public.price_catalogue for delete to authenticated
using (organisation_id = public.current_organisation_id() and public.current_ac_role() = 'owner');

drop policy if exists catalogue_history_team_select on public.price_catalogue_history;
create policy catalogue_history_team_select on public.price_catalogue_history for select to authenticated
using (organisation_id = public.current_organisation_id());

drop policy if exists audit_team_select on public.ac_audit_log;
create policy audit_team_select on public.ac_audit_log for select to authenticated
using (organisation_id = public.current_organisation_id());
drop policy if exists audit_team_insert on public.ac_audit_log;
create policy audit_team_insert on public.ac_audit_log for insert to authenticated
with check (organisation_id = public.current_organisation_id() and actor_id = auth.uid());

grant execute on function public.join_organisation(text) to authenticated;
grant execute on function public.set_ac_member_role(uuid, text) to authenticated;
grant select, update on public.organisations to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.ac_workspaces to authenticated;
grant select on public.ac_workspace_versions to authenticated;
grant select, insert, update, delete on public.price_catalogue to authenticated;
grant select on public.price_catalogue_history to authenticated;
grant select, insert on public.ac_audit_log to authenticated;
