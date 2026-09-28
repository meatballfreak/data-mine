import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/auth';

export default async function Shell({ children }: { children: ReactNode }) {
  const { user } = await getCurrentUser();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-white sm:text-lg"
          >
            Workshop
          </Link>
          {user ? (
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-slate-400 hover:text-slate-100"
              >
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
