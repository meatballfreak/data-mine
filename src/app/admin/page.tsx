import { Card } from '@/components/ui/Card';
import { createAdminClient } from '@/lib/supabase/admin';

async function fetchCount(table: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`[admin/overview] count(${table}) failed`, error);
    return 0;
  }
  return count ?? 0;
}

export default async function AdminOverviewPage() {
  const [groups, trainees, activities] = await Promise.all([
    fetchCount('groups'),
    fetchCount('profiles'),
    fetchCount('activities'),
  ]);

  const stats = [
    { label: 'Groups', value: groups },
    { label: 'Trainees', value: trainees },
    { label: 'Activities', value: activities },
  ];

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Admin Dashboard
        </h1>
        <p className="text-slate-400">Manage groups, activities, and trainees.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm text-slate-400">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold text-white">
              {stat.value}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
