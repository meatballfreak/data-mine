import LoginForm from './LoginForm';

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;
  const hasError = error === '1';

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
      <LoginForm />
      {hasError ? (
        <p className="text-sm text-slate-400">Sign-in failed. Try again.</p>
      ) : null}
    </div>
  );
}
