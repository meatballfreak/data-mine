'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { removeDriveConnection } from '@/lib/drive';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function disconnectDrive(): Promise<ActionResult> {
  const { user, isAdmin } = await getCurrentUser();
  if (!user || !isAdmin) return { ok: false, error: 'Not authorized' };
  try {
    await removeDriveConnection(user.id);
  } catch (err) {
    console.error('[admin/drive] disconnect failed', err);
    return { ok: false, error: 'Could not disconnect' };
  }
  revalidatePath('/admin/drive');
  return { ok: true };
}
