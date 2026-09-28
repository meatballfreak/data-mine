import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5',
        className,
      )}
      {...props}
    />
  );
}

export default Card;
