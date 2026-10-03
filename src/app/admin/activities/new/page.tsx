import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import type { GroupOption } from '../GroupPicker';
import NewActivityForm from './NewActivityForm';

async function fetchGroupOptions(): Promise<GroupOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('groups')
    .select('id, name')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[admin/activities/new] fetch groups failed', error);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

export default async function NewActivityPage() {
  const groups = await fetchGroupOptions();

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
          New activity
        </h1>
      </div>
      <NewActivityForm groups={groups} />
    </section>
  );
}
