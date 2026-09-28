import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

const tabs = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/groups', label: 'Groups' },
  { href: '/admin/activities', label: 'Activities' },
  { href: '/admin/trainees', label: 'Trainees' },
  { href: '/admin/qr-codes', label: 'QR Codes' },
] as const;

export default async function AdminLayout({
  children,
}: LayoutProps<'/admin'>) {
  const { user, isAdmin } = await getCurrentUser();
  if (!user) redirect('/login');
  if (!isAdmin) redirect('/dashboard');

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-1 border-b border-slate-800">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-900 hover:text-slate-100"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
