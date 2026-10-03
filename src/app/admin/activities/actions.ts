'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateActivityResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

const MIN_TITLE = 1;
const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;
const MAX_QUESTIONS = 50;
const MAX_PROMPT = 500;
const MAX_ANSWER_KEY = 1000;
const MAX_POINTS = 100_000;

type ActivityType = 'qa' | 'file';
// Per-question points live in the questions jsonb so admins can weight each
// question independently; the top-level activities.points column is only
// used for file-type activities.
export type Question = {
  id: string;
  prompt: string;
  answerKey: string;
  points: number;
};

function isActivityType(v: unknown): v is ActivityType {
  return v === 'qa' || v === 'file';
}

function trimOrNull(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

function validateTitle(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length < MIN_TITLE || t.length > MAX_TITLE) return null;
  return t;
}

// Questions are only meaningful for 'qa'; other types store null.
// Accepts either a JSON string (from a hidden input) or an array.
function parseQuestions(raw: unknown): Question[] | 'invalid' {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return 'invalid';
    }
  }
  if (!Array.isArray(parsed)) return 'invalid';
  if (parsed.length > MAX_QUESTIONS) return 'invalid';

  const out: Question[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') return 'invalid';
    const prompt = (item as { prompt?: unknown }).prompt;
    const id = (item as { id?: unknown }).id;
    const answerKey = (item as { answerKey?: unknown }).answerKey;
    const points = (item as { points?: unknown }).points;
    if (typeof prompt !== 'string') return 'invalid';
    const trimmed = prompt.trim();
    if (!trimmed || trimmed.length > MAX_PROMPT) return 'invalid';
    const answerKeyStr =
      typeof answerKey === 'string' ? answerKey.trim() : '';
    if (answerKeyStr.length > MAX_ANSWER_KEY) return 'invalid';
    const pointsNum =
      typeof points === 'number' && Number.isFinite(points) ? points : 1;
    if (pointsNum < 0 || pointsNum > MAX_POINTS || !Number.isInteger(pointsNum)) {
      return 'invalid';
    }
    out.push({
      id: typeof id === 'string' && id.length ? id : crypto.randomUUID(),
      prompt: trimmed,
      answerKey: answerKeyStr,
      points: pointsNum,
    });
  }
  return out;
}

function parsePoints(raw: unknown): number | 'invalid' {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 'invalid';
  if (!Number.isInteger(n)) return 'invalid';
  if (n < 0 || n > MAX_POINTS) return 'invalid';
  return n;
}

function parseGroupIds(raw: unknown): string[] | 'invalid' {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.length) return [];
    try {
      parsed = JSON.parse(raw);
    } catch {
      return 'invalid';
    }
  }
  if (!Array.isArray(parsed)) return 'invalid';
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item !== 'string' || !item.length) return 'invalid';
    out.push(item);
  }
  return Array.from(new Set(out));
}

type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

async function requireAdmin(): Promise<AuthResult> {
  const { user, isAdmin } = await getCurrentUser();
  if (!user || !isAdmin) {
    return { ok: false, error: 'Not authorized' };
  }
  return { ok: true, userId: user.id };
}

export async function createActivity(
  formData: FormData,
): Promise<CreateActivityResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const title = validateTitle(formData.get('title'));
  if (!title) {
    return { ok: false, error: 'Title is required (1–120 chars)' };
  }
  const description = trimOrNull(formData.get('description'));
  if (description && description.length > MAX_DESCRIPTION) {
    return { ok: false, error: 'Description is too long' };
  }
  const rawType = formData.get('type');
  if (!isActivityType(rawType)) {
    return { ok: false, error: 'Type must be qa or file' };
  }

  let questions: Question[] | null = null;
  let points = 0;
  if (rawType === 'qa') {
    const parsed = parseQuestions(formData.get('questions'));
    if (parsed === 'invalid') {
      return { ok: false, error: 'Questions are malformed' };
    }
    if (parsed.length === 0) {
      return { ok: false, error: 'Add at least one question' };
    }
    questions = parsed;
    // For QA the activities.points column is the sum of per-question
    // points — convenient for leaderboard "X / Y" displays.
    points = parsed.reduce((sum, q) => sum + q.points, 0);
  } else {
    const parsed = parsePoints(formData.get('points'));
    if (parsed === 'invalid') {
      return { ok: false, error: 'Points must be a whole number 0+' };
    }
    points = parsed;
  }

  const groupIds = parseGroupIds(formData.get('group_ids'));
  if (groupIds === 'invalid') {
    return { ok: false, error: 'Group assignment is malformed' };
  }

  const supabase = createAdminClient();
  const { data: inserted, error: insertError } = await supabase
    .from('activities')
    .insert({
      title,
      description,
      type: rawType,
      questions,
      points,
      created_by: auth.userId,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('[admin/activities] createActivity failed', insertError);
    return { ok: false, error: 'Could not create activity' };
  }

  if (groupIds.length > 0) {
    const rows = groupIds.map((group_id) => ({
      activity_id: inserted.id,
      group_id,
    }));
    const { error: assignError } = await supabase
      .from('activity_group_assignments')
      .insert(rows);
    if (assignError) {
      console.error(
        '[admin/activities] createActivity assignment failed',
        assignError,
      );
      // The activity is already created; surface a partial-success error.
      return {
        ok: false,
        error: 'Activity created but group assignment failed',
      };
    }
  }

  revalidatePath('/admin/activities');
  revalidatePath('/admin');
  return { ok: true, id: inserted.id };
}

export async function updateActivity(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (typeof id !== 'string' || !id.length) {
    return { ok: false, error: 'Invalid activity' };
  }

  const title = validateTitle(formData.get('title'));
  if (!title) {
    return { ok: false, error: 'Title is required (1–120 chars)' };
  }
  const description = trimOrNull(formData.get('description'));
  if (description && description.length > MAX_DESCRIPTION) {
    return { ok: false, error: 'Description is too long' };
  }

  const supabase = createAdminClient();
  const { data: existing, error: lookupError } = await supabase
    .from('activities')
    .select('type')
    .eq('id', id)
    .maybeSingle();
  if (lookupError || !existing) {
    console.error('[admin/activities] updateActivity lookup failed', lookupError);
    return { ok: false, error: 'Activity not found' };
  }

  let questions: Question[] | null = null;
  let points = 0;
  if (existing.type === 'qa') {
    const parsed = parseQuestions(formData.get('questions'));
    if (parsed === 'invalid') {
      return { ok: false, error: 'Questions are malformed' };
    }
    if (parsed.length === 0) {
      return { ok: false, error: 'Add at least one question' };
    }
    questions = parsed;
    points = parsed.reduce((sum, q) => sum + q.points, 0);
  } else {
    const parsed = parsePoints(formData.get('points'));
    if (parsed === 'invalid') {
      return { ok: false, error: 'Points must be a whole number 0+' };
    }
    points = parsed;
  }

  const { error: updateError } = await supabase
    .from('activities')
    .update({ title, description, questions, points })
    .eq('id', id);
  if (updateError) {
    console.error('[admin/activities] updateActivity failed', updateError);
    return { ok: false, error: 'Could not update activity' };
  }

  revalidatePath('/admin/activities');
  revalidatePath(`/admin/activities/${id}`);
  return { ok: true };
}

export async function setActivityGroups(
  id: string,
  groupIds: string[],
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (typeof id !== 'string' || !id.length) {
    return { ok: false, error: 'Invalid activity' };
  }
  const parsed = parseGroupIds(groupIds);
  if (parsed === 'invalid') {
    return { ok: false, error: 'Group assignment is malformed' };
  }

  const supabase = createAdminClient();
  // Replace strategy: delete all existing assignments, insert the new set.
  // Keeps the server action simple at the cost of churn — fine for the
  // handful of groups per activity we expect.
  const { error: deleteError } = await supabase
    .from('activity_group_assignments')
    .delete()
    .eq('activity_id', id);
  if (deleteError) {
    console.error(
      '[admin/activities] setActivityGroups delete failed',
      deleteError,
    );
    return { ok: false, error: 'Could not update group assignments' };
  }

  if (parsed.length > 0) {
    const rows = parsed.map((group_id) => ({ activity_id: id, group_id }));
    const { error: insertError } = await supabase
      .from('activity_group_assignments')
      .insert(rows);
    if (insertError) {
      console.error(
        '[admin/activities] setActivityGroups insert failed',
        insertError,
      );
      return { ok: false, error: 'Could not update group assignments' };
    }
  }

  revalidatePath('/admin/activities');
  revalidatePath(`/admin/activities/${id}`);
  return { ok: true };
}

export async function setSubmissionReviewed(
  submissionId: string,
  reviewed: boolean,
  awardedPoints?: number,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (typeof submissionId !== 'string' || !submissionId.length) {
    return { ok: false, error: 'Invalid submission' };
  }

  const supabase = createAdminClient();
  // Look up the submission to find its activity type + max possible points.
  // File-type reviews need an admin-chosen awardedPoints; QA keeps whatever
  // was auto-scored at submission time.
  const { data: subRow, error: subErr } = await supabase
    .from('submissions')
    .select('activity_id, activities(type, points)')
    .eq('id', submissionId)
    .maybeSingle();
  if (subErr || !subRow) {
    console.error('[admin/activities] setSubmissionReviewed lookup failed', subErr);
    return { ok: false, error: 'Submission not found' };
  }
  const activityRaw = subRow.activities as unknown;
  const activity = Array.isArray(activityRaw)
    ? (activityRaw[0] as { type: string; points: number } | undefined) ?? null
    : (activityRaw as { type: string; points: number } | null);
  if (!activity) {
    return { ok: false, error: 'Submission activity missing' };
  }

  const update: Record<string, unknown> = {
    status: reviewed ? 'reviewed' : 'submitted',
    reviewed_at: reviewed ? new Date().toISOString() : null,
  };

  if (activity.type === 'file') {
    if (reviewed) {
      // Admin may pass any value from 0 to the activity's max.
      let pts = typeof awardedPoints === 'number' ? awardedPoints : activity.points;
      if (!Number.isFinite(pts) || !Number.isInteger(pts)) {
        return { ok: false, error: 'Points must be a whole number' };
      }
      if (pts < 0) pts = 0;
      if (pts > activity.points) pts = activity.points;
      update.awarded_points = pts;
    } else {
      // Reopening a file submission clears any awarded points.
      update.awarded_points = 0;
    }
  }
  // For QA: awarded_points was set at submit time and stays as-is through
  // reviewing. Reopening a QA submission doesn't change points either —
  // the trainee can only earn new points by resubmitting new answers.

  const { data: updated, error } = await supabase
    .from('submissions')
    .update(update)
    .eq('id', submissionId)
    .select('activity_id')
    .single();

  if (error || !updated) {
    console.error('[admin/activities] setSubmissionReviewed failed', error);
    return { ok: false, error: 'Could not update submission' };
  }

  revalidatePath(`/admin/activities/${updated.activity_id}`);
  revalidatePath('/admin/trainees');
  revalidatePath('/leaderboard');
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (typeof id !== 'string' || !id.length) {
    return { ok: false, error: 'Invalid activity' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('activities').delete().eq('id', id);
  if (error) {
    console.error('[admin/activities] deleteActivity failed', error);
    return { ok: false, error: 'Could not delete activity' };
  }

  revalidatePath('/admin/activities');
  revalidatePath('/admin');
  return { ok: true };
}
