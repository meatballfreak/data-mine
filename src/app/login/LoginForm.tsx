'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export default function LoginForm({ next }: { next: string | null }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    setPending(true);
    setFailed(false);
    try {
      const supabase = createClient();
      const callback = new URL('/auth/callback', window.location.origin);
      if (next) callback.searchParams.set('next', next);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callback.toString(),
        },
      });
      if (error) {
        setFailed(true);
        setPending(false);
      }
      // On success the browser is redirected to Google.
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <Button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="w-full"
      >
        {pending ? 'Redirecting…' : 'Sign in with Google'}
      </Button>
      {failed ? (
        <p className="text-sm text-slate-400">Sign-in failed. Try again.</p>
      ) : null}
    </div>
  );
}
