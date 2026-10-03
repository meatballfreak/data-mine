'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Question } from './actions';

type Props = {
  name?: string;
  initial?: Question[];
  disabled?: boolean;
};

function newQuestion(): Question {
  return {
    id: crypto.randomUUID(),
    prompt: '',
    answerKey: '',
    points: 1,
  };
}

// Controlled editor: holds the list of questions in state and serializes it
// into a hidden input so the server action reads it via FormData.
export default function QuestionsEditor({
  name = 'questions',
  initial = [],
  disabled = false,
}: Props) {
  const [questions, setQuestions] = useState<Question[]>(() =>
    initial.length ? initial : [newQuestion()],
  );

  function addQuestion() {
    setQuestions((prev) => [...prev, newQuestion()]);
  }

  function updateField<K extends keyof Question>(
    id: string,
    key: K,
    value: Question[K],
  ) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [key]: value } : q)),
    );
  }

  function removeQuestion(id: string) {
    setQuestions((prev) =>
      prev.length === 1 ? prev : prev.filter((q) => q.id !== id),
    );
  }

  const total = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(questions)} />
      <ul className="space-y-3">
        {questions.map((q, i) => (
          <li
            key={q.id}
            className="space-y-2 rounded-md border border-slate-800 bg-slate-950 p-3"
          >
            <div className="flex items-start gap-2">
              <span className="pt-2 text-xs text-slate-500 min-w-[1.5rem]">
                {i + 1}.
              </span>
              <input
                type="text"
                value={q.prompt}
                maxLength={500}
                required
                disabled={disabled}
                onChange={(e) => updateField(q.id, 'prompt', e.target.value)}
                placeholder="Question prompt"
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={disabled || questions.length === 1}
                onClick={() => removeQuestion(q.id)}
              >
                Remove
              </Button>
            </div>
            <div className="flex items-start gap-2 pl-[1.75rem]">
              <input
                type="text"
                value={q.answerKey}
                maxLength={1000}
                disabled={disabled}
                onChange={(e) =>
                  updateField(q.id, 'answerKey', e.target.value)
                }
                placeholder="Answer key (exact match, case-sensitive; leave blank to disable auto-score)"
                className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
              <input
                type="number"
                min={0}
                max={100000}
                step={1}
                value={q.points}
                disabled={disabled}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateField(
                    q.id,
                    'points',
                    Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0,
                  );
                }}
                className="w-24 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                aria-label="Points"
              />
              <span className="pt-2 text-xs text-slate-500">pts</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={addQuestion}
        >
          Add question
        </Button>
        <span className="text-xs text-slate-500">
          Total: {total} {total === 1 ? 'point' : 'points'}
        </span>
      </div>
    </div>
  );
}
