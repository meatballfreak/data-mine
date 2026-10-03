'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { setSubmissionReviewed, type Question } from '../actions';

export type SubmissionRow = {
  id: string;
  profileId: string;
  fullName: string | null;
  answers: Record<string, string>;
  status: 'submitted' | 'reviewed';
  createdAt: string;
  reviewedAt: string | null;
};

type Props = {
  questions: Question[];
  submissions: SubmissionRow[];
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

export default function SubmissionsList({ questions, submissions }: Props) {
  if (submissions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-400">
          No submissions yet. Once trainees in assigned groups submit, they
          show up here.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {submissions.map((submission) => (
        <li key={submission.id}>
          <SubmissionCard submission={submission} questions={questions} />
        </li>
      ))}
    </ul>
  );
}

function SubmissionCard({
  submission,
  questions,
}: {
  submission: SubmissionRow;
  questions: Question[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reviewed = submission.status === 'reviewed';

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const result = await setSubmissionReviewed(submission.id, !reviewed);
      if (!result.ok) setError(result.error);
    });
  }

  const displayName = submission.fullName ?? 'Unnamed trainee';

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">{displayName}</p>
          <p className="text-xs text-slate-500">
            Submitted {formatWhen(submission.createdAt)}
            {reviewed && submission.reviewedAt
              ? ` · Reviewed ${formatWhen(submission.reviewedAt)}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge reviewed={reviewed} />
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={handleToggle}
          >
            {pending
              ? 'Saving…'
              : reviewed
                ? 'Mark pending'
                : 'Mark reviewed'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide answers' : 'Show answers'}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {open ? (
        <ol className="space-y-2 pt-2">
          {questions.map((q, i) => {
            const answer = submission.answers[q.id] ?? '';
            return (
              <li
                key={q.id}
                className="rounded-md border border-slate-800 bg-slate-950 p-3"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Question {i + 1}
                </p>
                <p className="text-sm text-slate-200">{q.prompt}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">
                  {answer || (
                    <span className="text-slate-500">(no answer)</span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      ) : null}
    </Card>
  );
}

function StatusBadge({ reviewed }: { reviewed: boolean }) {
  return reviewed ? (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
      Reviewed
    </span>
  ) : (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
      Submitted
    </span>
  );
}
