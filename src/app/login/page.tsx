import { safeNext } from '@/lib/safeNext';
import LoginForm from './LoginForm';

type SearchParams = Promise<{ error?: string; next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, next } = await searchParams;
  const hasError = error === '1';
  const nextPath = safeNext(next);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          Sign in to Workshop
        </h1>
        <p className="text-sm text-slate-400">
          Use your Google account to continue.
        </p>
      </div>
      <LoginForm next={nextPath} />
      {hasError ? (
        <p className="text-sm text-slate-400">Sign-in failed. Try again.</p>
      ) : null}
    </div>
  );
}
