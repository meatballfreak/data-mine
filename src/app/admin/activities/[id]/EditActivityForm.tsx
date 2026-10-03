'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  deleteActivity,
  setActivityGroups,
  updateActivity,
  type Question,
} from '../actions';
import GroupPicker, { type GroupOption } from '../GroupPicker';
import QuestionsEditor from '../QuestionsEditor';

type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  type: 'qa' | 'file';
  questions: Question[];
  points: number;
  assignedGroupIds: string[];
};

export default function EditActivityForm({
  activity,
  groups,
}: {
  activity: ActivityDetail;
  groups: GroupOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupStatus, setGroupStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [groupPending, startGroupTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();

  function handleSave(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateActivity(activity.id, formData);
      if (!result.ok) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleGroupsChange(selected: string[]) {
    setGroupError(null);
    setGroupStatus(null);
    startGroupTransition(async () => {
      const result = await setActivityGroups(activity.id, selected);
      if (result.ok) {
        setGroupStatus('Saved');
        setTimeout(() => setGroupStatus(null), 1500);
      } else {
        setGroupError(result.error);
      }
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${activity.title}"? This also removes all its submissions.`,
    );
    if (!confirmed) return;
    startDeleteTransition(async () => {
      const result = await deleteActivity(activity.id);
      if (result.ok) {
        router.push('/admin/activities');
      } else {
        setError(result.error);
      }
    });
  }

  const anyPending = pending || groupPending || deletePending;

  return (
    <div className="space-y-4">
      <form action={handleSave} className="space-y-4">
        <Card className="space-y-4">
          <Field label="Title">
            <input
              name="title"
              type="text"
              required
              maxLength={120}
              defaultValue={activity.title}
              disabled={anyPending}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            />
          </Field>

          <Field label="Description" hint="Optional">
            <textarea
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={activity.description ?? ''}
              disabled={anyPending}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            />
          </Field>
        </Card>

        {activity.type === 'qa' ? (
          <Card>
            <Field label="Questions">
              <QuestionsEditor
                initial={activity.questions}
                disabled={anyPending}
              />
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
                defaultValue={activity.points}
                required
                disabled={anyPending}
                className="w-32 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </Field>
          </Card>
        )}

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={anyPending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={anyPending}
            onClick={() => router.push('/admin/activities')}
          >
            Done
          </Button>
        </div>
      </form>

      <Card className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-slate-200">
            Assigned groups
          </h2>
          {groupStatus ? (
            <span className="text-xs text-emerald-400">{groupStatus}</span>
          ) : groupPending ? (
            <span className="text-xs text-slate-500">Saving…</span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          Changes save automatically as you toggle groups.
        </p>
        <GroupPicker
          options={groups}
          initialSelected={activity.assignedGroupIds}
          disabled={anyPending}
          onChange={handleGroupsChange}
        />
        {groupError ? (
          <p className="text-sm text-red-400">{groupError}</p>
        ) : null}
      </Card>

      <Card className="border-red-900/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-white">Delete activity</p>
            <p className="text-xs text-slate-500">
              Removes the activity and every submission on it.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={anyPending}
            onClick={handleDelete}
          >
            {deletePending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Card>
    </div>
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
