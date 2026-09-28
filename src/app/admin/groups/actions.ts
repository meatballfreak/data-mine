'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export type ActionResult = { ok: true } | { ok: false; error: string };

const MIN_NAME = 1;
const MAX_NAME = 80;

function validateName(raw: unknown): { ok: true; name: string } | ActionResult {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Name is required' };
  }
  const name = raw.trim();
  if (name.length < MIN_NAME) {
    return { ok: false, error: 'Name is required' };
  }
  if (name.length > MAX_NAME) {
    return { ok: false, error: `Name must be ${MAX_NAME} characters or fewer` };
  }
  return { ok: true, name };
}

async function requireAdmin(): Promise<
  { ok: true; userId: string } | ActionResult
> {
  const { user, isAdmin } = await getCurrentUser();
  if (!user || !isAdmin) {
    return { ok: false, error: 'Not authorized' };
  }
  return { ok: true, userId: user.id };
}

export async function createGroup(formData: FormData): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!('userId' in auth)) return auth;

  const validated = validateName(formData.get('name'));
  if (!('name' in validated)) return validated;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('groups')
    .insert({ name: validated.name, created_by: auth.userId });

  if (error) {
    console.error('[admin/groups] createGroup failed', error);
    return { ok: false, error: 'Could not create group' };
  }

  revalidatePath('/admin/groups');
  revalidatePath('/admin');
  return { ok: true };
}

export async function renameGroup(
  id: string,
  name: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!('userId' in auth)) return auth;

  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'Invalid group' };
  }
  const validated = validateName(name);
  if (!('name' in validated)) return validated;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('groups')
    .update({ name: validated.name })
    .eq('id', id);

  if (error) {
    console.error('[admin/groups] renameGroup failed', error);
    return { ok: false, error: 'Could not rename group' };
  }

  revalidatePath('/admin/groups');
  return { ok: true };
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!('userId' in auth)) return auth;

  if (typeof id !== 'string' || id.length === 0) {
    return { ok: false, error: 'Invalid group' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('groups').delete().eq('id', id);

  if (error) {
    console.error('[admin/groups] deleteGroup failed', error);
    return { ok: false, error: 'Could not delete group' };
  }

  revalidatePath('/admin/groups');
  revalidatePath('/admin');
  return { ok: true };
}
