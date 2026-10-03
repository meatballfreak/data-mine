import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Question } from '../actions';
import type { GroupOption } from '../GroupPicker';
import EditActivityForm from './EditActivityForm';
import SubmissionsList, { type SubmissionRow } from './SubmissionsList';

type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  type: 'qa' | 'file';
  questions: Question[];
  assignedGroupIds: string[];
};

async function fetchActivity(id: string): Promise<ActivityDetail | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, title, description, type, questions, activity_group_assignments(group_id)',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin/activities/:id] fetch failed', error);
    return null;
  }
  if (!data) return null;

  const assignments = data.activity_group_assignments as
    | Array<{ group_id: string }>
    | null
    | undefined;

  return {
    id: data.id as string,
    title: data.title as string,
    description: (data.description as string | null) ?? null,
    type: data.type as 'qa' | 'file',
    questions: Array.isArray(data.questions)
      ? (data.questions as Question[])
      : [],
    assignedGroupIds: (assignments ?? []).map((a) => a.group_id),
  };
}

async function fetchSubmissions(activityId: string): Promise<SubmissionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('submissions')
    .select(
      'id, profile_id, answers, status, created_at, reviewed_at, profiles(full_name)',
    )
    .eq('activity_id', activityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/activities/:id] fetch submissions failed', error);
    return [];
  }

  return (data ?? []).map((row) => {
    // Supabase typegen infers an embedded FK as an array even when the
    // relationship is one-to-one; at runtime it's a single object. Cast
    // through unknown to accept either shape.
    const profileRaw = row.profiles as unknown;
    const profile = Array.isArray(profileRaw)
      ? (profileRaw[0] as { full_name: string | null } | undefined) ?? null
      : (profileRaw as { full_name: string | null } | null);
    const rawAnswers = row.answers;
    const answers: Record<string, string> = {};
    if (rawAnswers && typeof rawAnswers === 'object' && !Array.isArray(rawAnswers)) {
      for (const [k, v] of Object.entries(rawAnswers)) {
        if (typeof v === 'string') answers[k] = v;
      }
    }
    return {
      id: row.id as string,
      profileId: row.profile_id as string,
      fullName: profile?.full_name ?? null,
      answers,
      status: row.status as 'submitted' | 'reviewed',
      createdAt: row.created_at as string,
      reviewedAt: (row.reviewed_at as string | null) ?? null,
    };
  });
}

async function fetchGroupOptions(): Promise<GroupOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('groups')
    .select('id, name')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[admin/activities/:id] fetch groups failed', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

export default async function EditActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [activity, groups, submissions] = await Promise.all([
    fetchActivity(id),
    fetchGroupOptions(),
    fetchSubmissions(id),
  ]);
  if (!activity) notFound();

  return (
    <section className="space-y-5">
      <div>
        <Link
          href="/admin/activities"
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Activities
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
          Edit activity
        </h1>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {activity.type === 'qa' ? 'Q&A' : 'File upload'}
        </p>
      </div>
      <EditActivityForm activity={activity} groups={groups} />
      {activity.type === 'qa' ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Submissions ({submissions.length})
          </h2>
          <SubmissionsList
            questions={activity.questions}
            submissions={submissions}
          />
        </div>
      ) : null}
    </section>
  );
}
