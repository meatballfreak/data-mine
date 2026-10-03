import { headers } from 'next/headers';

// Derive the public origin for building absolute URLs (QR codes, emails).
// Prefer x-forwarded-* (Vercel sets these) and fall back to Host.
export async function getSiteOrigin(): Promise<string> {
  const h = await headers();
  const forwardedHost = h.get('x-forwarded-host');
  const host = forwardedHost ?? h.get('host') ?? 'localhost:3000';
  const forwardedProto = h.get('x-forwarded-proto');
  const proto =
    forwardedProto ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
