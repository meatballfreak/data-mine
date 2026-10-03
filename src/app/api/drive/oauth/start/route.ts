import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { driveAuthUrl, driveRedirectUri } from '@/lib/drive';

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const { user, isAdmin } = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }
  if (!isAdmin) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  // `state` carries the admin's profile id so the callback can store the
  // refresh token against the right admin. Google round-trips it unchanged.
  // Not a secret — anyone can craft one, but the callback also re-checks
  // auth, so a forged state only works for the attacker's own session.
  const state = user.id;
  return NextResponse.redirect(driveAuthUrl(state, driveRedirectUri(origin)));
}
