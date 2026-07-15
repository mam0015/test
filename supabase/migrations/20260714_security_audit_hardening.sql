-- Alert Construction security, membership and audit hardening.
-- Safe to run after 20260714_product_foundation.sql and required for this release.

alter table public.profiles add column if not exists active boolean not null default true;
alter table public.organisations add column if not exists join_code_rotated_at timestamptz not null default now();

create index if not exists profiles_org_active_idx on public.profiles(organisation_id, active);

create or replace function public.current_organisation_id()
returns uuid language sql stable security definer set search_path = public
as $$ select organisation_id from public.profiles where id = auth.uid() and active = true $$;

create or replace function public.current_ac_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and active = true $$;

create or replace function public.catalogue_access_probe()
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare p public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into p from public.profiles where id = auth.uid() and active = true;
  if p.id is null then raise exception 'Team access is inactive or unavailable'; end if;
  return jsonb_build_object(
    'authorised', true,
    'organisation_id', p.organisation_id,
    'role', p.role,
    'can_edit', p.role in ('owner','estimator'),
    'checked_at', now()
  );
end;
$$;

create or replace function public.join_organisation(p_code text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  target_org public.organisations%rowtype;
  old_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and active = false) then
    raise exception 'This account was revoked and cannot join a team until an Owner restores it';
  end if;
  select * into target_org from public.organisations where join_code = upper(trim(p_code));
  if target_org.id is null then raise exception 'Team code not found'; end if;
  select organisation_id into old_org from public.profiles where id = auth.uid();
  update public.profiles set organisation_id = target_org.id, role = 'site_supervisor', active = true, updated_at = now() where id = auth.uid();
  if not found then raise exception 'Account profile not found'; end if;
  insert into public.ac_audit_log(organisation_id, action, module, details, actor_id)
  values (target_org.id, 'member_joined', 'accounts', jsonb_build_object('previous_organisation_id',old_org,'assigned_role','site_supervisor'), auth.uid());
  return jsonb_build_object('organisation_id', target_org.id, 'organisation_name', target_org.name, 'role', 'site_supervisor', 'previous_organisation_id', old_org);
end;
$$;

create or replace function public.rotate_ac_join_code()
returns text language plpgsql security definer set search_path = public
as $$
declare next_code text;
begin
  if public.current_ac_role() <> 'owner' then raise exception 'Only an owner can rotate the team code'; end if;
  next_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  update public.organisations set join_code = next_code, join_code_rotated_at = now(), updated_at = now() where id = public.current_organisation_id();
  insert into public.ac_audit_log(organisation_id, action, module, details, actor_id)
  values (public.current_organisation_id(), 'team_code_rotated', 'accounts', jsonb_build_object('rotated_at',now()), auth.uid());
  return next_code;
end;
$$;

create or replace function public.set_ac_member_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare old_role text;
begin
  if public.current_ac_role() <> 'owner' then raise exception 'Only an owner can change team roles'; end if;
  if p_role not in ('owner','estimator','site_supervisor') then raise exception 'Invalid role'; end if;
  if p_user = auth.uid() and p_role <> 'owner' then raise exception 'An owner cannot remove their own owner access'; end if;
  select role into old_role from public.profiles where id = p_user and organisation_id = public.current_organisation_id();
  if old_role is null then raise exception 'Team member not found'; end if;
  update public.profiles set role = p_role, updated_at = now() where id = p_user and organisation_id = public.current_organisation_id();
  insert into public.ac_audit_log(organisation_id, action, module, details, actor_id)
  values (public.current_organisation_id(), 'member_role_changed', 'accounts', jsonb_build_object('member_id',p_user,'from',old_role,'to',p_role), auth.uid());
end;
$$;

create or replace function public.set_ac_member_access(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare target_org uuid;
begin
  if public.current_ac_role() <> 'owner' then raise exception 'Only an owner can change team access'; end if;
  if p_user = auth.uid() and p_active = false then raise exception 'An owner cannot revoke their own access'; end if;
  select organisation_id into target_org from public.profiles where id = p_user and organisation_id = public.current_organisation_id();
  if target_org is null then raise exception 'Team member not found'; end if;
  update public.profiles set active = p_active, updated_at = now() where id = p_user and organisation_id = target_org;
  if p_active = false then
    update public.organisations
    set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)), join_code_rotated_at = now(), updated_at = now()
    where id = target_org;
  end if;
  insert into public.ac_audit_log(organisation_id, action, module, details, actor_id)
  values (target_org, case when p_active then 'member_access_restored' else 'member_access_revoked' end, 'accounts', jsonb_build_object('member_id',p_user,'active',p_active,'team_code_rotated',not p_active), auth.uid());
end;
$$;

create or replace function public.log_ac_project_action(
  p_action text,
  p_project_id text,
  p_record_id text,
  p_module text,
  p_details jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public
as $$
declare org_id uuid;
begin
  org_id := public.current_organisation_id();
  if org_id is null then raise exception 'Active team access required'; end if;
  if p_action not in ('project_record_created','project_record_updated','project_record_deleted','project_deleted','ai_result_corrected') then
    raise exception 'Unsupported audit action';
  end if;
  insert into public.ac_audit_log(organisation_id, project_id, record_id, action, module, details, actor_id)
  values (org_id, p_project_id, p_record_id, p_action, p_module, coalesce(p_details,'{}'::jsonb), auth.uid());
end;
$$;

create or replace function public.audit_workspace_sync()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.ac_audit_log(organisation_id, action, module, details, actor_id)
  values (new.organisation_id, case when tg_op = 'INSERT' then 'workspace_created' else 'workspace_synced' end, 'projects', jsonb_build_object('revision',new.revision), auth.uid());
  return new;
end;
$$;

drop trigger if exists workspace_audit_trigger on public.ac_workspaces;
create trigger workspace_audit_trigger after insert or update on public.ac_workspaces
for each row execute function public.audit_workspace_sync();

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());

grant execute on function public.catalogue_access_probe() to authenticated;
grant execute on function public.rotate_ac_join_code() to authenticated;
grant execute on function public.set_ac_member_access(uuid, boolean) to authenticated;
grant execute on function public.log_ac_project_action(text, text, text, text, jsonb) to authenticated;
grant execute on function public.join_organisation(text) to authenticated;
grant execute on function public.set_ac_member_role(uuid, text) to authenticated;
revoke insert, update, delete on public.ac_audit_log from authenticated;
drop policy if exists audit_team_insert on public.ac_audit_log;
