-- 0002_qr_join.sql
-- Phase 3: QR-based group join.
--   * Adds groups.join_token — opaque, unique string embedded in the QR URL.
--     Keeps the raw group id out of URLs and lets admins rotate access by
--     reissuing the token without recreating the group.
-- Idempotent: safe to re-run.

alter table public.groups
  add column if not exists join_token text;

-- Backfill any pre-existing rows before we add the NOT NULL + UNIQUE constraints.
update public.groups
set join_token = replace(gen_random_uuid()::text, '-', '')
where join_token is null;

alter table public.groups
  alter column join_token set not null;

alter table public.groups
  alter column join_token set default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists groups_join_token_key
  on public.groups(join_token);
