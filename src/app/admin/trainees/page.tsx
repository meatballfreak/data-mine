import { Card } from '@/components/ui/Card';
import { createAdminClient } from '@/lib/supabase/admin';

type TraineeRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  groupCount: number;
  submissionCount: number;
  createdAt: string;
};

async function fetchTrainees(): Promise<TraineeRow[]> {
  const supabase = createAdminClient();
  const [profilesRes, authRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, created_at, group_members(count), submissions(count)')
      .order('created_at', { ascending: false }),
    // auth.admin.listUsers lets us surface the email alongside the profile.
    // Pagination page size of 1000 covers the project for the foreseeable
    // future; revisit if trainee count ever grows past that.
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesRes.error) {
    console.error('[admin/trainees] fetch profiles failed', profilesRes.error);
    return [];
  }
  if (authRes.error) {
    console.error('[admin/trainees] listUsers failed', authRes.error);
  }

  const emailById = new Map<string, string | null>();
  for (const user of authRes.data?.users ?? []) {
    emailById.set(user.id, user.email ?? null);
  }

  return (profilesRes.data ?? []).map((row) => {
    const groups = row.group_members as
      | Array<{ count: number }>
      | null
      | undefined;
    const subs = row.submissions as
      | Array<{ count: number }>
      | null
      | undefined;
    return {
      id: row.id as string,
      fullName: (row.full_name as string | null) ?? null,
      email: emailById.get(row.id as string) ?? null,
      groupCount: groups?.[0]?.count ?? 0,
      submissionCount: subs?.[0]?.count ?? 0,
      createdAt: row.created_at as string,
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

export default async function AdminTraineesPage() {
  const trainees = await fetchTrainees();

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Trainees
        </h1>
        <p className="text-slate-400">
          Everyone who has signed in. Includes admins (they get a profile row
          too).
        </p>
      </div>

      {trainees.length === 0 ? (
        <Card>
          <p className="text-slate-400">
            No one has signed in yet. Share a QR code and come back here.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {trainees.map((trainee) => (
            <li key={trainee.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-medium text-white">
                      {trainee.fullName ?? 'Unnamed trainee'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {trainee.email ?? 'no email on file'}
                      {' · joined '}
                      {formatDate(trainee.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <Stat label="Groups" value={trainee.groupCount} />
                    <Stat label="Submissions" value={trainee.submissionCount} />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="text-base font-semibold text-white">{value}</div>
      <div className="uppercase tracking-wide">{label}</div>
    </div>
  );
}
