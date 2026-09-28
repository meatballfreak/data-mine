-- 0001_init.sql
-- Phase 2: core schema, RLS policies, and auth->profiles auto-provisioning.
-- Idempotent: safe to re-run.

-- Extensions used for gen_random_uuid().
create extension if not exists "pgcrypto";

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  full_name  text,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.group_members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  type        text not null check (type in ('qa','file')),
  questions   jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null
);

create table if not exists public.activity_group_assignments (
  activity_id uuid not null references public.activities(id) on delete cascade,
  group_id    uuid not null references public.groups(id) on delete cascade,
  primary key (activity_id, group_id)
);

create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  activity_id  uuid not null references public.activities(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  answers      jsonb,
  file_url     text,
  status       text not null default 'submitted' check (status in ('submitted','reviewed')),
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  unique (activity_id, profile_id)
);

------------------------------------------------------------------------------
-- Indexes
------------------------------------------------------------------------------

create index if not exists idx_group_members_profile
  on public.group_members(profile_id);

create index if not exists idx_activity_group_assignments_group
  on public.activity_group_assignments(group_id);

create index if not exists idx_submissions_profile
  on public.submissions(profile_id);

create index if not exists idx_submissions_activity
  on public.submissions(activity_id);

------------------------------------------------------------------------------
-- Auto-provision profile on new auth.users insert
------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Google returns the display name under 'full_name' or 'name' depending on account.
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------
-- Row-Level Security
------------------------------------------------------------------------------

alter table public.profiles                   enable row level security;
alter table public.groups                     enable row level security;
alter table public.group_members              enable row level security;
alter table public.activities                 enable row level security;
alter table public.activity_group_assignments enable row level security;
alter table public.submissions                enable row level security;

-- profiles: self-read, self-update. Insert via trigger; delete via cascade.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- groups: any signed-in user can read. Mutations are service-role only.
drop policy if exists groups_select_all on public.groups;
create policy groups_select_all on public.groups
  for select to authenticated
  using (true);

-- group_members: user sees only their own memberships.
drop policy if exists group_members_select_self on public.group_members;
create policy group_members_select_self on public.group_members
  for select to authenticated
  using (profile_id = auth.uid());

-- activities: user sees activities assigned to a group they belong to.
drop policy if exists activities_select_assigned on public.activities;
create policy activities_select_assigned on public.activities
  for select to authenticated
  using (
    exists (
      select 1
      from public.activity_group_assignments aga
      join public.group_members gm on gm.group_id = aga.group_id
      where aga.activity_id = activities.id
        and gm.profile_id = auth.uid()
    )
  );

-- activity_group_assignments: user sees rows for groups they belong to.
drop policy if exists aga_select_own_groups on public.activity_group_assignments;
create policy aga_select_own_groups on public.activity_group_assignments
  for select to authenticated
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = activity_group_assignments.group_id
        and gm.profile_id = auth.uid()
    )
  );

-- submissions: user manages only their own rows (no delete).
drop policy if exists submissions_select_self on public.submissions;
create policy submissions_select_self on public.submissions
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists submissions_insert_self on public.submissions;
create policy submissions_insert_self on public.submissions
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists submissions_update_self on public.submissions;
create policy submissions_update_self on public.submissions
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
