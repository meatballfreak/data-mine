'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type SubmitResult = { ok: true } | { ok: false; error: string };

const MAX_ANSWER = 10_000;

type Question = { id: string; prompt: string };

// Expected shape of a Q&A submission answer map: { [questionId]: text }.
// The DB stores it as a JSON object so admins can render answers per
// question in Phase 6 without caring about array order.
function parseAnswers(
  raw: FormDataEntryValue | null,
): Record<string, string> | 'invalid' {
  if (typeof raw !== 'string') return 'invalid';
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return 'invalid';
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'invalid';
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof key !== 'string' || !key.length) return 'invalid';
    if (typeof value !== 'string') return 'invalid';
    if (value.length > MAX_ANSWER) return 'invalid';
    out[key] = value;
  }
  return out;
}

export async function submitAnswers(
  activityId: string,
  formData: FormData,
): Promise<SubmitResult> {
  const { user } = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  if (typeof activityId !== 'string' || !activityId.length) {
    return { ok: false, error: 'Invalid activity' };
  }

  // Use the user-scoped client so RLS enforces that only assigned trainees
  // can submit (activities_select_assigned limits what they can even see,
  // and submissions_* policies pin profile_id to auth.uid()).
  const supabase = await createClient();
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('id, type, questions')
    .eq('id', activityId)
    .maybeSingle();

  if (activityError) {
    console.error('[activities/submit] fetch failed', activityError);
    return { ok: false, error: 'Could not load activity' };
  }
  if (!activity) {
    return { ok: false, error: 'Activity not available' };
  }

  if (activity.type !== 'qa') {
    // File-upload submissions land in Phase 7 — refuse early so the UI
    // never silently writes a blank submission.
    return { ok: false, error: 'This activity type is not submittable yet' };
  }

  const answers = parseAnswers(formData.get('answers'));
  if (answers === 'invalid') {
    return { ok: false, error: 'Answers are malformed' };
  }

  const questions = Array.isArray(activity.questions)
    ? (activity.questions as Question[])
    : [];
  for (const q of questions) {
    const value = answers[q.id];
    if (!value || !value.trim()) {
      return { ok: false, error: 'Please answer every question' };
    }
  }

  const { error: upsertError } = await supabase
    .from('submissions')
    .upsert(
      {
        activity_id: activityId,
        profile_id: user.id,
        answers,
        status: 'submitted',
      },
      { onConflict: 'activity_id,profile_id' },
    );

  if (upsertError) {
    console.error('[activities/submit] upsert failed', upsertError);
    return { ok: false, error: 'Could not save your submission' };
  }

  revalidatePath(`/activities/${activityId}`);
  revalidatePath('/dashboard');
  return { ok: true };
}
