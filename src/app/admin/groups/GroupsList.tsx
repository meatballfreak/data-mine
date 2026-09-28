'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { deleteGroup, renameGroup } from './actions';

export type GroupRow = {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function GroupsList({ groups }: { groups: GroupRow[] }) {
  if (groups.length === 0) {
    return (
      <Card>
        <p className="text-slate-400">
          No groups yet. Create your first group to start onboarding trainees.
        </p>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {groups.map((group) => (
        <GroupItem key={group.id} group={group} />
      ))}
    </ul>
  );
}

function GroupItem({ group }: { group: GroupRow }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRename() {
    const trimmed = name.trim();
    if (trimmed === group.name) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await renameGroup(group.id, trimmed);
      if (result.ok) {
        setEditing(false);
      } else {
        setError(result.error);
      }
    });
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete group "${group.name}"? This removes all its memberships.`,
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteGroup(group.id);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          {editing ? (
            <div className="space-y-1">
              <input
                type="text"
                value={name}
                maxLength={80}
                autoFocus
                disabled={pending}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRename();
                  } else if (e.key === 'Escape') {
                    setName(group.name);
                    setError(null);
                    setEditing(false);
                  }
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
              {error ? (
                <p className="text-sm text-red-400">{error}</p>
              ) : null}
            </div>
          ) : (
            <div>
              <p className="text-base font-medium text-white">{group.name}</p>
              <p className="text-xs text-slate-500">
                {group.member_count}{' '}
                {group.member_count === 1 ? 'member' : 'members'} · created{' '}
                {formatDate(group.created_at)}
              </p>
              {error ? (
                <p className="mt-1 text-sm text-red-400">{error}</p>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button
                type="button"
                onClick={handleRename}
                disabled={pending}
              >
                {pending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setName(group.name);
                  setError(null);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => setEditing(true)}
              >
                Rename
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={handleDelete}
              >
                {pending ? 'Working…' : 'Delete'}
              </Button>
            </>
          )}
        </div>
      </Card>
    </li>
  );
}
