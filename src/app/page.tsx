import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function HomePage() {
  const { user, isAdmin } = await getCurrentUser();
  if (!user) redirect('/login');
  redirect(isAdmin ? '/admin' : '/dashboard');
}
