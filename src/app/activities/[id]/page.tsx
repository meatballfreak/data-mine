import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ActivityForm, { type Question } from './ActivityForm';
import FileSubmissionForm, { type FileSubmission } from './FileSubmissionForm';

type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  type: 'qa' | 'file';
  questions: Question[];
  points: number;
};

async function fetchActivity(id: string): Promise<ActivityDetail | null> {
  const supabase = await createClient();
  // RLS filters this: a trainee only sees activities assigned to a group
  // they belong to. maybeSingle returns null for anything else, which the
  // page below turns into a 404.
  const { data, error } = await supabase
    .from('activities')
    .select('id, title, description, type, questions, points')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[activities/:id] fetch failed', error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id as string,
    title: data.title as string,
    description: (data.description as string | null) ?? null,
    type: data.type as 'qa' | 'file',
    questions: Array.isArray(data.questions)
      ? (data.questions as Question[])
      : [],
    points: (data.points as number | null) ?? 0,
  };
}

type MySubmission = {
  answers: Record<string, string> | null;
  file: FileSubmission | null;
  awardedPoints: number;
  status: 'submitted' | 'reviewed' | null;
};

async function fetchMySubmission(
  activityId: string,
  userId: string,
): Promise<MySubmission> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('submissions')
    .select('answers, file_name, file_url, awarded_points, status, created_at')
    .eq('activity_id', activityId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[activities/:id] submission fetch failed', error);
    return { answers: null, file: null, awardedPoints: 0, status: null };
  }
  if (!data) return { answers: null, file: null, awardedPoints: 0, status: null };

  let answers: Record<string, string> | null = null;
  const rawAnswers = data.answers;
  if (rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawAnswers)) {
      if (typeof v === 'string') out[k] = v;
    }
    answers = Object.keys(out).length ? out : null;
  }

  const file =
    data.file_url || data.file_name
      ? {
          fileName: (data.file_name as string | null) ?? null,
          fileUrl: (data.file_url as string | null) ?? null,
          submittedAt: data.created_at as string,
        }
      : null;

  return {
    answers,
    file,
    awardedPoints: (data.awarded_points as number | null) ?? 0,
    status: (data.status as 'submitted' | 'reviewed' | null) ?? null,
  };
}

export default async function TraineeActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const activity = await fetchActivity(id);
  if (!activity) notFound();

  const submission = await fetchMySubmission(activity.id, user.id);
  const locked = submission.status === 'reviewed';
  const showScore = submission.status !== null;

  return (
    <section className="space-y-5">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          {activity.title}
        </h1>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {activity.type === 'qa' ? 'Q&A' : 'File upload'}
          {' · '}Max {activity.points}{' '}
          {activity.points === 1 ? 'point' : 'points'}
        </p>
        {showScore ? (
          <div className="mt-2 flex items-center gap-2">
            {locked ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                Locked · Reviewed
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                Submitted
              </span>
            )}
            <span className="text-sm text-slate-200">
              Score: {submission.awardedPoints} / {activity.points}
            </span>
          </div>
        ) : null}
      </div>

      {activity.description ? (
        <Card>
          <p className="whitespace-pre-wrap text-sm text-slate-300">
            {activity.description}
          </p>
        </Card>
      ) : null}

      {activity.type === 'file' ? (
        <FileSubmissionForm
          activityId={activity.id}
          existing={submission.file}
          locked={locked}
        />
      ) : (
        <ActivityForm
          activityId={activity.id}
          questions={activity.questions}
          initialAnswers={submission.answers}
          locked={locked}
        />
      )}
    </section>
  );
}
