-- 0004_points.sql
-- Phase 8: points, lock-after-review, leaderboards.
--   * activities.points — for file-type activities, this is the maximum
--     admins can award at review. For qa-type activities the field is
--     ignored because per-question points live inside questions jsonb.
--   * submissions.awarded_points — points earned on this submission. Set
--     automatically on qa submit (sum of correct × points). Set by the
--     admin at review time for file submissions.
-- Idempotent: safe to re-run.

alter table public.activities
  add column if not exists points int not null default 0;

alter table public.submissions
  add column if not exists awarded_points int not null default 0;
