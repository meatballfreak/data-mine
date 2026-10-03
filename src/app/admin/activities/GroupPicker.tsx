'use client';

import { useState } from 'react';

export type GroupOption = { id: string; name: string };

type Props = {
  name?: string;
  options: GroupOption[];
  initialSelected?: string[];
  disabled?: boolean;
  onChange?: (selected: string[]) => void;
};

// Multi-select checkbox list. Serializes selection into a hidden JSON input
// so forms can post it; also exposes an onChange for pages that act on
// changes directly (edit page saves group assignments inline).
export default function GroupPicker({
  name = 'group_ids',
  options,
  initialSelected = [],
  disabled = false,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelected),
  );

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    onChange?.(Array.from(next));
  }

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No groups yet. Create a group first, then come back to assign this
        activity.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(Array.from(selected))}
      />
      <ul className="space-y-1">
        {options.map((opt) => {
          const checked = selected.has(opt.id);
          return (
            <li key={opt.id}>
              <label className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(opt.id)}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span>{opt.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
