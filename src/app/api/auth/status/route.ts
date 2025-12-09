import { NextResponse } from 'next/server';

import { getCurrentProfile } from '@/lib/auth/currentUser';

export async function GET(_request: Request) {
  console.log('[API AUTH STATUS] [DEBUG] GET request received');
  try {
    console.log('[API AUTH STATUS] [DEBUG] Getting current profile...');
    const profile = await getCurrentProfile();

    console.log('[API AUTH STATUS] [DEBUG] Profile result:', {
      found: !!profile,
      id: profile?.id,
      username: profile?.username,
    });

    if (!profile) {
      console.log(
        '[API AUTH STATUS] [DEBUG] No profile found, returning unauthenticated',
      );
      return NextResponse.json({
        ok: true,
        authenticated: false,
        data: null,
      });
    }

    console.log(
      '[API AUTH STATUS] [DEBUG] Profile found, returning authenticated',
    );
    return NextResponse.json({
      ok: true,
      authenticated: true,
      data: {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        brand: profile.brand,
        mustChangePassword: profile.mustChangePassword,
      },
    });
  } catch (error) {
    console.error('[API AUTH STATUS] [DEBUG] Error:', error);
    console.error('[api/auth/status]', error);
    return NextResponse.json(
      { ok: false, error: 'Impossibile verificare la sessione' },
      { status: 500 },
    );
  }
}
