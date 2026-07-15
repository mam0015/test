-- Alert Construction optional Team Code signup and existing-account recovery.
-- Run after the 20260714 foundation and security hardening migrations.

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

-- Self-service setup for a signed-in account that has no profile, or whose
-- previous team access became inactive. A blank code creates a new individual
-- Owner workspace; a supplied code joins a different existing team.
create or replace function public.setup_ac_workspace(p_name text default null, p_team_code text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  user_id uuid := auth.uid();
  existing_profile public.profiles%rowtype;
  target_org uuid;
  target_name text;
  generated_code text;
  requested_code text := upper(trim(coalesce(p_team_code,'')));
begin
  if user_id is null then raise exception 'Authentication required'; end if;
  select * into existing_profile from public.profiles where id = user_id;
  if existing_profile.id is not null and existing_profile.active = true then
    raise exception 'This account already has an active workspace';
  end if;

  if requested_code <> '' then
    select id, name into target_org, target_name from public.organisations where join_code = requested_code;
    if target_org is null then raise exception 'Team code not found'; end if;
    if existing_profile.id is not null and existing_profile.organisation_id = target_org then
      raise exception 'The Owner of that team must restore your previous access';
    end if;
    insert into public.profiles(id, organisation_id, email, full_name, role, active)
    values (user_id, target_org, coalesce(auth.jwt()->>'email',''), '', 'site_supervisor', true)
    on conflict (id) do update set organisation_id = excluded.organisation_id, role = 'site_supervisor', active = true, updated_at = now();
    insert into public.ac_audit_log(organisation_id, action, module, details, actor_id)
    values (target_org, 'member_joined', 'accounts', jsonb_build_object('join_method','account_setup','assigned_role','site_supervisor'), user_id);
    return jsonb_build_object('organisation_id',target_org,'organisation_name',target_name,'role','site_supervisor','mode','team');
  end if;

  insert into public.organisations(name, created_by)
  values (coalesce(nullif(trim(p_name),''), 'My Construction Workspace'), user_id)
  returning id, name, join_code into target_org, target_name, generated_code;
  insert into public.profiles(id, organisation_id, email, full_name, role, active)
  values (user_id, target_org, coalesce(auth.jwt()->>'email',''), '', 'owner', true)
  on conflict (id) do update set organisation_id = excluded.organisation_id, role = 'owner', active = true, updated_at = now();
  insert into public.ac_workspaces(organisation_id, workspace, updated_by)
  values (target_org, jsonb_build_object('projects', '[]'::jsonb, 'updatedAt', now()), user_id);
  insert into public.ac_audit_log(organisation_id, action, module, details, actor_id)
  values (target_org, 'personal_workspace_created', 'accounts', jsonb_build_object('mode','individual'), user_id);
  return jsonb_build_object('organisation_id',target_org,'organisation_name',target_name,'role','owner','mode','individual','team_code',generated_code);
end;
$$;

grant execute on function public.setup_ac_workspace(text,text) to authenticated;

-- Accounts created before the foundation existed receive their own private
-- workspace. They can later join an existing team from Account & Team.
do $$
declare
  existing_user record;
  recovered_org uuid;
begin
  for existing_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p.id is null
  loop
    insert into public.organisations(name, created_by)
    values (coalesce(nullif(existing_user.raw_user_meta_data->>'organisation_name',''), 'Private Workspace'), existing_user.id)
    returning id into recovered_org;
    insert into public.profiles(id, organisation_id, email, full_name, role, active)
    values (existing_user.id, recovered_org, coalesce(existing_user.email,''), coalesce(existing_user.raw_user_meta_data->>'full_name',''), 'owner', true);
    insert into public.ac_workspaces(organisation_id, workspace, updated_by)
    values (recovered_org, jsonb_build_object('projects', '[]'::jsonb, 'updatedAt', now()), existing_user.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
