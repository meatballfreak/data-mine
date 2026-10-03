'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Question } from './actions';

type Props = {
  name?: string;
  initial?: Question[];
  disabled?: boolean;
};

// Controlled editor that keeps its list of questions in state and serializes
// them into a hidden input so the server action can read them via FormData.
function newQuestion(): Question {
  return { id: crypto.randomUUID(), prompt: '' };
}

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

  function updatePrompt(id: string, prompt: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, prompt } : q)),
    );
  }

  function removeQuestion(id: string) {
    setQuestions((prev) =>
      prev.length === 1 ? prev : prev.filter((q) => q.id !== id),
    );
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(questions)} />
      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li key={q.id} className="flex items-start gap-2">
            <span className="pt-2 text-xs text-slate-500 min-w-[1.5rem]">
              {i + 1}.
            </span>
            <input
              type="text"
              value={q.prompt}
              maxLength={500}
              required
              disabled={disabled}
              onChange={(e) => updatePrompt(q.id, e.target.value)}
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
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={addQuestion}
      >
        Add question
      </Button>
    </div>
  );
}
