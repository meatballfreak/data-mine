import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ActivityForm, { type Question } from './ActivityForm';

type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  type: 'qa' | 'file';
  questions: Question[];
};

async function fetchActivity(id: string): Promise<ActivityDetail | null> {
  const supabase = await createClient();
  // RLS filters this: a trainee only sees activities assigned to a group
  // they belong to. maybeSingle returns null for anything else, which the
  // page below turns into a 404.
  const { data, error } = await supabase
    .from('activities')
    .select('id, title, description, type, questions')
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
  };
}

async function fetchMySubmission(
  activityId: string,
  userId: string,
): Promise<Record<string, string> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('submissions')
    .select('answers')
    .eq('activity_id', activityId)
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[activities/:id] submission fetch failed', error);
    return null;
  }
  if (!data) return null;
  const answers = data.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
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

  const existingAnswers = await fetchMySubmission(activity.id, user.id);

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
        </p>
      </div>

      {activity.description ? (
        <Card>
          <p className="whitespace-pre-wrap text-sm text-slate-300">
            {activity.description}
          </p>
        </Card>
      ) : null}

      {activity.type === 'file' ? (
        <Card>
          <p className="text-sm text-slate-400">
            File-upload activities land in a later phase. Check back soon.
          </p>
        </Card>
      ) : (
        <ActivityForm
          activityId={activity.id}
          questions={activity.questions}
          initialAnswers={existingAnswers}
        />
      )}
    </section>
  );
}
