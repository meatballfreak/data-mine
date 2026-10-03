'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { submitFile } from '../actions';

const MAX_BYTES = 4 * 1024 * 1024;

export type FileSubmission = {
  fileName: string | null;
  fileUrl: string | null;
  submittedAt: string;
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function FileSubmissionForm({
  activityId,
  existing,
}: {
  activityId: string;
  existing: FileSubmission | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setStatus(null);
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_BYTES) {
      setError('File is too large (max 4 MB)');
      setPicked(null);
      e.target.value = '';
      return;
    }
    setPicked(file);
  }

  function handleSubmit() {
    if (!picked) {
      setError('Choose a file first');
      return;
    }
    setError(null);
    setStatus(null);
    const fd = new FormData();
    fd.set('file', picked);
    startTransition(async () => {
      const result = await submitFile(activityId, fd);
      if (result.ok) {
        setStatus('Uploaded');
        setPicked(null);
        if (inputRef.current) inputRef.current.value = '';
        router.refresh();
        setTimeout(() => setStatus(null), 1500);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Card className="space-y-3">
      {existing?.fileUrl ? (
        <div>
          <p className="text-sm text-slate-200">
            Current submission:{' '}
            <a
              href={existing.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-300 underline hover:text-emerald-200"
            >
              {existing.fileName ?? 'open in Drive'}
            </a>
          </p>
          <p className="text-xs text-slate-500">
            Uploaded {formatWhen(existing.submittedAt)}. Pick another file
            below to replace it.
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-300">
          Choose a file (max 4 MB). It uploads to the admin&apos;s Google
          Drive.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        onChange={handlePick}
        disabled={pending}
        className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-sm file:text-slate-100 hover:file:bg-slate-700 disabled:opacity-50"
      />

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {status ? <p className="text-sm text-emerald-400">{status}</p> : null}

      <div>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !picked}
        >
          {pending
            ? 'Uploading…'
            : existing?.fileUrl
              ? 'Replace file'
              : 'Upload'}
        </Button>
      </div>
    </Card>
  );
}
