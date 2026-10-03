'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleClick}>
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  );
}
