// Shared helper: a `next` query param is only safe to use as a redirect
// target if it points back to our own origin. Reject absolute URLs,
// protocol-relative paths, and anything that isn't a plain pathname.
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  if (raw.startsWith('/\\')) return null;
  return raw;
}
