import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type CurrentUser = {
  user: User | null;
  isAdmin: boolean;
};

function parseAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, isAdmin: false };
  }

  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  const email = data.user.email?.toLowerCase();
  const isAdmin = !!email && adminEmails.has(email);

  return { user: data.user, isAdmin };
}
