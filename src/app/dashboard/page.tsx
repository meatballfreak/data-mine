import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function DashboardPage() {
  const { user } = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold text-white sm:text-3xl">
        Trainee Dashboard
      </h1>
      <p className="text-slate-400">
        Your assigned activities will appear here.
      </p>
    </section>
  );
}
