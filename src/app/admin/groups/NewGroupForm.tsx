'use client';

import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { createGroup } from './actions';

export default function NewGroupForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createGroup(formData);
      if (result.ok) {
        formRef.current?.reset();
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>New group</Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-wrap items-start gap-2"
    >
      <div className="flex-1 min-w-[220px]">
        <input
          name="name"
          type="text"
          required
          maxLength={80}
          autoFocus
          placeholder="Group name"
          disabled={pending}
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        />
        {error ? (
          <p className="mt-1 text-sm text-red-400">{error}</p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create'}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          setError(null);
          setOpen(false);
        }}
      >
        Cancel
      </Button>
    </form>
  );
}
