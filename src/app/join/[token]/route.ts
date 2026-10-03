import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

// Loose shape — a token is just a URL-safe string. We cap the length to avoid
// sending wild inputs at the database.
const TOKEN_MAX_LEN = 128;

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const { origin } = new URL(request.url);

  if (!token || token.length > TOKEN_MAX_LEN) {
    return NextResponse.redirect(`${origin}/dashboard?joinError=invalid`);
  }

  const { user } = await getCurrentUser();
  if (!user) {
    const next = `/join/${encodeURIComponent(token)}`;
    return NextResponse.redirect(
      `${origin}/login?next=${encodeURIComponent(next)}`,
    );
  }

  const supabase = createAdminClient();
  const { data: group, error: lookupError } = await supabase
    .from('groups')
    .select('id, name')
    .eq('join_token', token)
    .maybeSingle();

  if (lookupError) {
    console.error('[join] group lookup failed', lookupError);
    return NextResponse.redirect(`${origin}/dashboard?joinError=lookup`);
  }
  if (!group) {
    return NextResponse.redirect(`${origin}/dashboard?joinError=invalid`);
  }

  const { error: insertError } = await supabase
    .from('group_members')
    .upsert(
      { group_id: group.id, profile_id: user.id },
      { onConflict: 'group_id,profile_id', ignoreDuplicates: true },
    );

  if (insertError) {
    console.error('[join] membership insert failed', insertError);
    return NextResponse.redirect(`${origin}/dashboard?joinError=insert`);
  }

  return NextResponse.redirect(
    `${origin}/dashboard?joined=${encodeURIComponent(group.id)}`,
  );
}
