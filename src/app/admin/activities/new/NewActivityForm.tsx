'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createActivity } from '../actions';
import GroupPicker, { type GroupOption } from '../GroupPicker';
import QuestionsEditor from '../QuestionsEditor';

type ActivityType = 'qa' | 'file';

export default function NewActivityForm({ groups }: { groups: GroupOption[] }) {
  const router = useRouter();
  const [type, setType] = useState<ActivityType>('qa');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createActivity(formData);
      if (result.ok) {
        router.push(`/admin/activities/${result.id}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Card className="space-y-4">
        <Field label="Title">
          <input
            name="title"
            type="text"
            required
            maxLength={120}
            disabled={pending}
            autoFocus
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          />
        </Field>

        <Field label="Description" hint="Optional">
          <textarea
            name="description"
            rows={3}
            maxLength={2000}
            disabled={pending}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          />
        </Field>

        <Field label="Type">
          <div className="flex gap-3">
            <TypeRadio
              value="qa"
              label="Q&A"
              hint="Trainees answer written questions"
              checked={type === 'qa'}
              disabled={pending}
              onChange={() => setType('qa')}
            />
            <TypeRadio
              value="file"
              label="File upload"
              hint="Trainees upload a file (Phase 7)"
              checked={type === 'file'}
              disabled={pending}
              onChange={() => setType('file')}
            />
          </div>
          <input type="hidden" name="type" value={type} />
        </Field>
      </Card>

      {type === 'qa' ? (
        <Card>
          <Field label="Questions">
            <QuestionsEditor disabled={pending} />
          </Field>
        </Card>
      ) : (
        <Card>
          <Field
            label="Points"
            hint="Max points admins can award on review"
          >
            <input
              name="points"
              type="number"
              min={0}
              max={100000}
              step={1}
              defaultValue={10}
              required
              disabled={pending}
              className="w-32 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            />
          </Field>
        </Card>
      )}

      <Card>
        <Field
          label="Assign to groups"
          hint="Optional — can be changed after creation"
        >
          <GroupPicker options={groups} disabled={pending} />
        </Field>
      </Card>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create activity'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => router.push('/admin/activities')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-200">
        {label}
        {hint ? (
          <span className="ml-2 font-normal text-slate-500">{hint}</span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function TypeRadio({
  value,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  value: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm ${
        checked
          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-100'
          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
      }`}
    >
      <input
        type="radio"
        name="type-radio"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <span className="block font-medium">{label}</span>
      <span className="block text-xs text-slate-500">{hint}</span>
    </label>
  );
}
