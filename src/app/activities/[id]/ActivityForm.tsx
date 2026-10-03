'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { submitAnswers } from '../actions';

export type Question = { id: string; prompt: string };

type Props = {
  activityId: string;
  questions: Question[];
  initialAnswers: Record<string, string> | null;
};

export default function ActivityForm({
  activityId,
  questions,
  initialAnswers,
}: Props) {
  const router = useRouter();
  const alreadySubmitted = initialAnswers !== null;
  // When the trainee has submitted, start in read-only mode. The Edit button
  // flips us back into editable without losing their previous answers.
  const [editing, setEditing] = useState(!alreadySubmitted);
  const [answers, setAnswers] = useState<Record<string, string>>(
    () => initialAnswers ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await submitAnswers(activityId, formData);
      if (result.ok) {
        setEditing(false);
        setStatus('Submitted');
        router.refresh();
        setTimeout(() => setStatus(null), 1500);
      } else {
        setError(result.error);
      }
    });
  }

  if (questions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-400">
          This activity has no questions yet. Ask your admin to add some.
        </p>
      </Card>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      <ul className="space-y-3">
        {questions.map((q, i) => {
          const value = answers[q.id] ?? '';
          return (
            <li key={q.id}>
              <Card className="space-y-2">
                <p className="text-sm text-slate-200">
                  <span className="text-slate-500">{i + 1}. </span>
                  {q.prompt}
                </p>
                {editing ? (
                  <textarea
                    rows={3}
                    required
                    maxLength={10_000}
                    value={value}
                    disabled={pending}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  />
                ) : (
                  <p className="whitespace-pre-wrap rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                    {value || <span className="text-slate-600">(empty)</span>}
                  </p>
                )}
              </Card>
            </li>
          );
        })}
      </ul>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {status ? <p className="text-sm text-emerald-400">{status}</p> : null}

      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Button type="submit" disabled={pending}>
              {pending
                ? 'Submitting…'
                : alreadySubmitted
                  ? 'Resubmit'
                  : 'Submit'}
            </Button>
            {alreadySubmitted ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setAnswers(initialAnswers ?? {});
                  setError(null);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </>
        ) : (
          <>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
              Submitted
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(true);
                setError(null);
                setStatus(null);
              }}
            >
              Edit
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
