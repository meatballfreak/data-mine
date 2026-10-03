import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  driveRedirectUri,
  exchangeCodeForTokens,
  fetchGoogleEmail,
  storeDriveConnection,
} from '@/lib/drive';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');

  const { user, isAdmin } = await getCurrentUser();
  if (!user || !isAdmin) {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (errorParam) {
    console.error('[drive/oauth/callback] google error', errorParam);
    return NextResponse.redirect(`${origin}/admin/drive?error=${errorParam}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/admin/drive?error=missing_code`);
  }

  try {
    const { refreshToken, accessToken, scope } = await exchangeCodeForTokens(
      code,
      driveRedirectUri(origin),
    );
    const email = await fetchGoogleEmail(accessToken);
    await storeDriveConnection({
      adminProfileId: user.id,
      refreshToken,
      scope,
      email,
    });
  } catch (err) {
    console.error('[drive/oauth/callback] exchange/store failed', err);
    return NextResponse.redirect(`${origin}/admin/drive?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}/admin/drive?connected=1`);
}
