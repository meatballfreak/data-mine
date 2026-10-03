import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { safeNext } from '@/lib/safeNext';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=1`);
  }

  if (next) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const { isAdmin } = await getCurrentUser();
  return NextResponse.redirect(`${origin}${isAdmin ? '/admin' : '/dashboard'}`);
}
