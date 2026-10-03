import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createAdminClient } from '@/lib/supabase/admin';

type ActivityRow = {
  id: string;
  title: string;
  type: 'qa' | 'file';
  created_at: string;
  group_count: number;
  submission_count: number;
};

async function fetchActivities(): Promise<ActivityRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('activities')
    .select(
      'id, title, type, created_at, activity_group_assignments(count), submissions(count)',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/activities] fetch failed', error);
    return [];
  }

  return (data ?? []).map((row) => {
    const groups = row.activity_group_assignments as
      | Array<{ count: number }>
      | null
      | undefined;
    const subs = row.submissions as
      | Array<{ count: number }>
      | null
      | undefined;
    return {
      id: row.id as string,
      title: row.title as string,
      type: row.type as 'qa' | 'file',
      created_at: row.created_at as string,
      group_count: groups?.[0]?.count ?? 0,
      submission_count: subs?.[0]?.count ?? 0,
    };
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function AdminActivitiesPage() {
  const activities = await fetchActivities();

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            Activities
          </h1>
          <p className="text-slate-400">
            Create Q&amp;A or file-upload activities and assign them to groups.
          </p>
        </div>
        <Link href="/admin/activities/new">
          <Button type="button">New activity</Button>
        </Link>
      </div>

      {activities.length === 0 ? (
        <Card>
          <p className="text-slate-400">
            No activities yet. Create your first one.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {activities.map((activity) => (
            <li key={activity.id}>
              <Link href={`/admin/activities/${activity.id}`} className="block">
                <Card className="transition-colors hover:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-white">
                        {activity.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        <span className="uppercase tracking-wide">
                          {activity.type === 'qa' ? 'Q&A' : 'File upload'}
                        </span>
                        {' · '}
                        {activity.group_count}{' '}
                        {activity.group_count === 1 ? 'group' : 'groups'}
                        {' · '}
                        {activity.submission_count}{' '}
                        {activity.submission_count === 1
                          ? 'submission'
                          : 'submissions'}
                        {' · created '}
                        {formatDate(activity.created_at)}
                      </p>
                    </div>
                    <span className="text-sm text-slate-500">Edit →</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
