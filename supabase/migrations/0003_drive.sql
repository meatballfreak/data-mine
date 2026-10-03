-- 0003_drive.sql
-- Phase 7: Google Drive integration.
--   * drive_tokens stores one connected Google account per admin profile.
--     The refresh token is AES-256-GCM encrypted with DRIVE_TOKEN_ENC_KEY
--     before insert; the DB sees ciphertext only.
--   * activity_drive_folders caches the per-activity subfolder id so we
--     avoid a Drive API round-trip on every upload.
--   * submissions.file_name is added so admins can display the original
--     filename alongside the drive_file_id/file_url.
-- Idempotent: safe to re-run.

create table if not exists public.drive_tokens (
  admin_profile_id          uuid primary key references public.profiles(id) on delete cascade,
  encrypted_refresh_token   text not null,
  scope                     text not null,
  google_account_email      text,
  connected_at              timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists public.activity_drive_folders (
  activity_id      uuid primary key references public.activities(id) on delete cascade,
  drive_folder_id  text not null,
  created_at       timestamptz not null default now()
);

alter table public.submissions
  add column if not exists file_name     text,
  add column if not exists drive_file_id text;

-- Reassert grants in case a public schema reset wipes them again
-- (same pattern as 0001; cheap no-op otherwise).
grant all on table public.drive_tokens            to postgres, service_role;
grant all on table public.activity_drive_folders  to postgres, service_role;
grant select, insert, update, delete on table public.drive_tokens           to anon, authenticated;
grant select, insert, update, delete on table public.activity_drive_folders to anon, authenticated;

-- RLS: both tables are admin-only writes (via service role). Enable RLS so
-- that no accidental anon/authenticated read path exposes refresh tokens or
-- folder ids. No permissive select policies — only service role can read.
alter table public.drive_tokens            enable row level security;
alter table public.activity_drive_folders  enable row level security;
