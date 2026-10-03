import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type SearchParams = Promise<{ joined?: string; joinError?: string }>;

type MyGroup = { id: string; name: string };

async function fetchMyGroups(): Promise<MyGroup[]> {
  const supabase = await createClient();
  // RLS limits group_members rows to the current user; groups is readable
  // to any authenticated user, so this join returns only groups I belong to.
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

  const [groups, params] = await Promise.all([fetchMyGroups(), searchParams]);
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
          Your assigned activities will appear here.
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
