'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { disconnectDrive } from './actions';

export default function DisconnectButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      'Disconnect Google Drive? Trainees will stop being able to submit files until you reconnect.',
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await disconnectDrive();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={handleClick}
      >
        {pending ? 'Disconnecting…' : 'Disconnect'}
      </Button>
      {error ? <span className="text-sm text-red-400">{error}</span> : null}
    </div>
  );
}
