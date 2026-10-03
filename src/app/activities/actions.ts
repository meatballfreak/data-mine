'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { uploadFile } from '@/lib/drive';

export type SubmitResult = { ok: true } | { ok: false; error: string };

// Vercel serverless body size cap on Hobby is 4.5 MB. We cap at 4 MB on the
// server as a defensive bound; the trainee UI should enforce the same before
// upload. Lift via resumable upload sessions when a bigger ceiling matters.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

const MAX_ANSWER = 10_000;

type Question = {
  id: string;
  prompt: string;
  answerKey?: string;
  points?: number;
};

async function fetchExistingStatus(
  activityId: string,
  userId: string,
): Promise<'submitted' | 'reviewed' | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('submissions')
    .select('status')
    .eq('activity_id', activityId)
    .eq('profile_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[activities] fetchExistingStatus failed', error);
    return null;
  }
  return (data?.status as 'submitted' | 'reviewed' | null) ?? null;
}

function scoreQaSubmission(
  questions: Question[],
  answers: Record<string, string>,
): number {
  let total = 0;
  for (const q of questions) {
    const key = (q.answerKey ?? '').trim();
    if (!key) continue; // no key configured → cannot auto-score
    const given = (answers[q.id] ?? '').trim();
    const pts = typeof q.points === 'number' ? q.points : 1;
    if (given === key) total += pts;
  }
  return total;
}

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

  // Lock check — once an admin reviews a submission, the trainee can't
  // overwrite it. Admin must unmark (reopen) first.
  const existingStatus = await fetchExistingStatus(activityId, user.id);
  if (existingStatus === 'reviewed') {
    return {
      ok: false,
      error: 'This submission is locked by your admin. Ask them to reopen it.',
    };
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

  const awardedPoints = scoreQaSubmission(questions, answers);

  const { error: upsertError } = await supabase
    .from('submissions')
    .upsert(
      {
        activity_id: activityId,
        profile_id: user.id,
        answers,
        awarded_points: awardedPoints,
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
  revalidatePath('/leaderboard');
  return { ok: true };
}

function sanitizeFilename(raw: string): string {
  // Strip path separators and control chars so a hostile filename can't be
  // used to climb directories on any filesystem that eventually sees it.
  const base = raw.split(/[/\\]/).pop() ?? 'upload';
  return base.replace(/[\x00-\x1f]/g, '').slice(0, 200) || 'upload';
}

export async function submitFile(
  activityId: string,
  formData: FormData,
): Promise<SubmitResult> {
  const { user } = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in' };
  if (typeof activityId !== 'string' || !activityId.length) {
    return { ok: false, error: 'Invalid activity' };
  }

  const existingStatus = await fetchExistingStatus(activityId, user.id);
  if (existingStatus === 'reviewed') {
    return {
      ok: false,
      error: 'This submission is locked by your admin. Ask them to reopen it.',
    };
  }

  const supabase = await createClient();
  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .select('id, title, type')
    .eq('id', activityId)
    .maybeSingle();

  if (activityError) {
    console.error('[activities/submitFile] fetch failed', activityError);
    return { ok: false, error: 'Could not load activity' };
  }
  if (!activity) {
    return { ok: false, error: 'Activity not available' };
  }
  if (activity.type !== 'file') {
    return { ok: false, error: 'This activity does not accept file uploads' };
  }

  const raw = formData.get('file');
  if (!(raw instanceof File) || raw.size === 0) {
    return { ok: false, error: 'Choose a file to upload' };
  }
  if (raw.size > MAX_FILE_BYTES) {
    return { ok: false, error: 'File is too large (max 4 MB)' };
  }

  const filename = sanitizeFilename(raw.name || 'upload');
  const mimeType = raw.type || 'application/octet-stream';
  const bytes = new Uint8Array(await raw.arrayBuffer());

  let driveFileId: string;
  let webViewLink: string;
  try {
    const result = await uploadFile({
      activityId: activity.id as string,
      activityTitle: activity.title as string,
      fileName: filename,
      mimeType,
      data: bytes,
    });
    driveFileId = result.driveFileId;
    webViewLink = result.webViewLink;
  } catch (err) {
    console.error('[activities/submitFile] drive upload failed', err);
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return { ok: false, error: msg };
  }

  const { error: upsertError } = await supabase
    .from('submissions')
    .upsert(
      {
        activity_id: activityId,
        profile_id: user.id,
        file_name: filename,
        file_url: webViewLink,
        drive_file_id: driveFileId,
        answers: null,
        status: 'submitted',
      },
      { onConflict: 'activity_id,profile_id' },
    );

  if (upsertError) {
    console.error('[activities/submitFile] upsert failed', upsertError);
    return { ok: false, error: 'Uploaded but could not record submission' };
  }

  revalidatePath(`/activities/${activityId}`);
  revalidatePath('/dashboard');
  revalidatePath('/leaderboard');
  return { ok: true };
}
