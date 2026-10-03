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

type ActivityType = 'qa' | 'file';
export type Question = { id: string; prompt: string };

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
    if (typeof prompt !== 'string') return 'invalid';
    const trimmed = prompt.trim();
    if (!trimmed || trimmed.length > MAX_PROMPT) return 'invalid';
    out.push({
      id: typeof id === 'string' && id.length ? id : crypto.randomUUID(),
      prompt: trimmed,
    });
  }
  return out;
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
  if (rawType === 'qa') {
    const parsed = parseQuestions(formData.get('questions'));
    if (parsed === 'invalid') {
      return { ok: false, error: 'Questions are malformed' };
    }
    if (parsed.length === 0) {
      return { ok: false, error: 'Add at least one question' };
    }
    questions = parsed;
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
  if (existing.type === 'qa') {
    const parsed = parseQuestions(formData.get('questions'));
    if (parsed === 'invalid') {
      return { ok: false, error: 'Questions are malformed' };
    }
    if (parsed.length === 0) {
      return { ok: false, error: 'Add at least one question' };
    }
    questions = parsed;
  }

  const { error: updateError } = await supabase
    .from('activities')
    .update({ title, description, questions })
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
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (typeof submissionId !== 'string' || !submissionId.length) {
    return { ok: false, error: 'Invalid submission' };
  }

  const supabase = createAdminClient();
  const { data: updated, error } = await supabase
    .from('submissions')
    .update({
      status: reviewed ? 'reviewed' : 'submitted',
      reviewed_at: reviewed ? new Date().toISOString() : null,
    })
    .eq('id', submissionId)
    .select('activity_id')
    .single();

  if (error || !updated) {
    console.error('[admin/activities] setSubmissionReviewed failed', error);
    return { ok: false, error: 'Could not update submission' };
  }

  revalidatePath(`/admin/activities/${updated.activity_id}`);
  revalidatePath('/admin/trainees');
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
