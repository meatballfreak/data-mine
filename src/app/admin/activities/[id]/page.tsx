import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Question } from '../actions';
import type { GroupOption } from '../GroupPicker';
import EditActivityForm from './EditActivityForm';

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
  const [activity, groups] = await Promise.all([
    fetchActivity(id),
    fetchGroupOptions(),
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
    </section>
  );
}
