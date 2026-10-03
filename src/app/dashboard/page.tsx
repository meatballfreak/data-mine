import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type SearchParams = Promise<{ joined?: string; joinError?: string }>;

type MyGroup = { id: string; name: string };

type MyActivity = {
  id: string;
  title: string;
  type: 'qa' | 'file';
  submitted: boolean;
};

async function fetchMyGroups(): Promise<MyGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('group_members')
    .select('groups(id, name)')
    .order('joined_at', { ascending: false });

  if (error) {
    console.error('[dashboard] fetchMyGroups failed', error);
    return [];
  }

  return (data ?? [])
    .map((row) => row.groups as unknown as MyGroup | null)
    .filter((g): g is MyGroup => !!g);
}

async function fetchMyActivities(userId: string): Promise<MyActivity[]> {
  const supabase = await createClient();
  // RLS (activities_select_assigned) already filters to activities whose
  // groups overlap with the trainee's memberships.
  const [{ data: activities, error: aErr }, { data: subs, error: sErr }] =
    await Promise.all([
      supabase
        .from('activities')
        .select('id, title, type, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('submissions')
        .select('activity_id')
        .eq('profile_id', userId),
    ]);

  if (aErr) console.error('[dashboard] fetchMyActivities failed', aErr);
  if (sErr) console.error('[dashboard] fetchMySubmissions failed', sErr);

  const submittedIds = new Set((subs ?? []).map((r) => r.activity_id as string));
  return (activities ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    type: row.type as 'qa' | 'file',
    submitted: submittedIds.has(row.id as string),
  }));
}

function joinErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'invalid':
      return "That join link isn't valid. Ask your admin for a fresh QR code.";
    case 'lookup':
    case 'insert':
      return 'Something went wrong joining that group. Try again or ask your admin.';
    default:
      return null;
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user } = await getCurrentUser();
  if (!user) redirect('/login');

  const [groups, activities, params] = await Promise.all([
    fetchMyGroups(),
    fetchMyActivities(user.id),
    searchParams,
  ]);
  const justJoined = params.joined
    ? groups.find((g) => g.id === params.joined) ?? null
    : null;
  const errorMessage = joinErrorMessage(params.joinError);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Trainee Dashboard
        </h1>
        <p className="text-slate-400">
          Your groups and assigned activities.
        </p>
      </div>

      {justJoined ? (
        <Card className="border-emerald-700 bg-emerald-950/40">
          <p className="text-sm text-emerald-200">
            Joined <span className="font-medium">{justJoined.name}</span>.
          </p>
        </Card>
      ) : null}

      {errorMessage ? (
        <Card className="border-red-800 bg-red-950/40">
          <p className="text-sm text-red-200">{errorMessage}</p>
        </Card>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Activities
        </h2>
        {activities.length === 0 ? (
          <Card>
            <p className="text-slate-400">
              No activities assigned yet. Once your admin assigns one to a
              group you&apos;re in, it will show up here.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {activities.map((activity) => (
              <li key={activity.id}>
                <Link href={`/activities/${activity.id}`} className="block">
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
                        </p>
                      </div>
                      <StatusBadge submitted={activity.submitted} />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Your groups
        </h2>
        {groups.length === 0 ? (
          <Card>
            <p className="text-slate-400">
              You haven&apos;t joined a group yet. Scan a QR code from your
              admin to join one.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Card>
                  <p className="text-base font-medium text-white">
                    {group.name}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ submitted }: { submitted: boolean }) {
  return submitted ? (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
      Submitted
    </span>
  ) : (
    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
      Not started
    </span>
  );
}
