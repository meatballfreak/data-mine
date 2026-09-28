import { createAdminClient } from '@/lib/supabase/admin';
import GroupsList, { type GroupRow } from './GroupsList';
import NewGroupForm from './NewGroupForm';

async function fetchGroups(): Promise<GroupRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, created_at, group_members(count)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/groups] fetch failed', error);
    return [];
  }

  // group_members(count) returns [{ count: N }] per row.
  return (data ?? []).map((row) => {
    const members = row.group_members as
      | Array<{ count: number }>
      | null
      | undefined;
    const memberCount = members?.[0]?.count ?? 0;
    return {
      id: row.id as string,
      name: row.name as string,
      created_at: row.created_at as string,
      member_count: memberCount,
    };
  });
}

export default async function AdminGroupsPage() {
  const groups = await fetchGroups();

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            Groups
          </h1>
          <p className="text-slate-400">
            Groups are what trainees join when they scan a QR code.
          </p>
        </div>
        <NewGroupForm />
      </div>
      <GroupsList groups={groups} />
    </section>
  );
}
