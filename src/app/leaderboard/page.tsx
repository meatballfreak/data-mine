import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

type LeaderboardEntry = {
  profileId: string;
  fullName: string;
  points: number;
};

type GroupLeaderboard = {
  groupId: string;
  groupName: string;
  entries: LeaderboardEntry[];
  totalMembers: number;
};

// Leaderboards cross user boundaries (every trainee sees other trainees'
// totals), so the aggregation runs through the service-role client. We only
// expose aggregate point totals + display names — no individual submission
// contents leak out.
async function fetchGroupLeaderboard(
  groupId: string,
  groupName: string,
): Promise<GroupLeaderboard> {
  const supabase = createAdminClient();

  // Members of this group with their display names.
  const { data: memberRows, error: memberErr } = await supabase
    .from('group_members')
    .select('profile_id, profiles(full_name)')
    .eq('group_id', groupId);
  if (memberErr) {
    console.error('[leaderboard] members fetch failed', memberErr);
  }

  // Activities assigned to this group. The leaderboard only counts points
  // earned on activities actually assigned to this group — if an activity is
  // assigned elsewhere, those points don't bleed into this leaderboard.
  const { data: activityRows, error: activityErr } = await supabase
    .from('activity_group_assignments')
    .select('activity_id')
    .eq('group_id', groupId);
  if (activityErr) {
    console.error('[leaderboard] activity assignments fetch failed', activityErr);
  }
  const activityIds = (activityRows ?? []).map(
    (r) => r.activity_id as string,
  );

  // Member totals, keyed by profile id. Even if the member hasn't submitted
  // anything, they still appear (with 0 points).
  const nameById = new Map<string, string>();
  for (const row of memberRows ?? []) {
    const profileRaw = row.profiles as unknown;
    const profile = Array.isArray(profileRaw)
      ? (profileRaw[0] as { full_name: string | null } | undefined) ?? null
      : (profileRaw as { full_name: string | null } | null);
    nameById.set(
      row.profile_id as string,
      profile?.full_name ?? 'Unnamed trainee',
    );
  }

  const pointsById = new Map<string, number>();
  if (activityIds.length > 0 && nameById.size > 0) {
    const { data: subRows, error: subErr } = await supabase
      .from('submissions')
      .select('profile_id, awarded_points')
      .in('activity_id', activityIds)
      .in('profile_id', Array.from(nameById.keys()));
    if (subErr) {
      console.error('[leaderboard] submissions fetch failed', subErr);
    }
    for (const row of subRows ?? []) {
      const pid = row.profile_id as string;
      const pts = (row.awarded_points as number | null) ?? 0;
      pointsById.set(pid, (pointsById.get(pid) ?? 0) + pts);
    }
  }

  const entries: LeaderboardEntry[] = Array.from(nameById.entries())
    .map(([profileId, fullName]) => ({
      profileId,
      fullName,
      points: pointsById.get(profileId) ?? 0,
    }))
    // Highest points first; stable alphabetical tie-breaker so ranks are
    // deterministic across renders.
    .sort((a, b) => b.points - a.points || a.fullName.localeCompare(b.fullName));

  return {
    groupId,
    groupName,
    entries,
    totalMembers: entries.length,
  };
}

async function fetchGroupsForUser(args: {
  userId: string;
  isAdmin: boolean;
}): Promise<Array<{ id: string; name: string }>> {
  const supabase = createAdminClient();
  if (args.isAdmin) {
    const { data, error } = await supabase
      .from('groups')
      .select('id, name')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[leaderboard] groups fetch failed', error);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      name: r.name as string,
    }));
  }
  const { data, error } = await supabase
    .from('group_members')
    .select('groups(id, name)')
    .eq('profile_id', args.userId);
  if (error) {
    console.error('[leaderboard] trainee groups fetch failed', error);
    return [];
  }
  const out: Array<{ id: string; name: string }> = [];
  for (const row of data ?? []) {
    const g = row.groups as unknown;
    const group = Array.isArray(g)
      ? (g[0] as { id: string; name: string } | undefined) ?? null
      : (g as { id: string; name: string } | null);
    if (group) out.push({ id: group.id, name: group.name });
  }
  return out;
}

export default async function LeaderboardPage() {
  const { user, isAdmin } = await getCurrentUser();
  if (!user) redirect('/login');

  const groups = await fetchGroupsForUser({ userId: user.id, isAdmin });
  const leaderboards = await Promise.all(
    groups.map((g) => fetchGroupLeaderboard(g.id, g.name)),
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            Leaderboards
          </h1>
          <p className="text-slate-400">
            Totals across every activity assigned to each group.
            {isAdmin ? ' Showing all groups.' : ' Showing the groups you’re in.'}
          </p>
        </div>
        <Link
          href={isAdmin ? '/admin' : '/dashboard'}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Back
        </Link>
      </div>

      {leaderboards.length === 0 ? (
        <Card>
          <p className="text-slate-400">
            {isAdmin
              ? 'No groups yet. Create one from /admin/groups.'
              : "You haven't joined a group yet. Scan a QR code from your admin."}
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {leaderboards.map((board) => (
            <div key={board.groupId} className="space-y-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">
                {board.groupName}
              </h2>
              {board.entries.length === 0 ? (
                <Card>
                  <p className="text-sm text-slate-400">
                    No members in this group yet.
                  </p>
                </Card>
              ) : (
                <Card className="divide-y divide-slate-800">
                  {board.entries.map((entry, idx) => (
                    <div
                      key={entry.profileId}
                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-right text-sm font-mono text-slate-500">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-slate-100">
                          {entry.fullName}
                          {entry.profileId === user.id ? (
                            <span className="ml-2 text-xs text-emerald-300">
                              (you)
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-white">
                        {entry.points}{' '}
                        <span className="text-xs text-slate-500">
                          {entry.points === 1 ? 'pt' : 'pts'}
                        </span>
                      </span>
                    </div>
                  ))}
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
