// Email-domain allowlist used by the group join flow. The source of truth
// is JOIN_ALLOWED_DOMAINS (comma-separated). Empty / unset env means
// anyone-can-join behavior, consistent with the pre-Phase-9 default.

export function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function emailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export function emailMatchesAllowedDomain(
  email: string | null | undefined,
  allowed: string[],
): boolean {
  if (allowed.length === 0) return true; // no restriction configured
  const domain = emailDomain(email);
  if (!domain) return false;
  return allowed.includes(domain);
}
