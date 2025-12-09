import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { appPermissions } from '@/db/schema';
import {
  clearSessionCookie,
  getSessionTokenFromCookies,
  verifySessionToken,
} from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, error: 'Password correnti e nuove sono obbligatorie' },
        { status: 400 },
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'La nuova password deve avere almeno 6 caratteri' },
        { status: 400 },
      );
    }

    const token = await getSessionTokenFromCookies();
    const session = token ? verifySessionToken(token) : null;
    if (!session || !Number.isFinite(session.userId)) {
      const response = NextResponse.json(
        { ok: false, error: 'Sessione scaduta' },
        { status: 401 },
      );
      clearSessionCookie(response);
      return response;
    }

    const [record] = await db
      .select()
      .from(appPermissions)
      .where(eq(appPermissions.id, session.userId))
      .limit(1);

    if (!record || !record.passwordHash) {
      const response = NextResponse.json(
        { ok: false, error: 'Utente non trovato' },
        { status: 401 },
      );
      clearSessionCookie(response);
      return response;
    }

    const match = await bcrypt.compare(currentPassword, record.passwordHash);
    if (!match) {
      return NextResponse.json(
        { ok: false, error: 'Password corrente errata' },
        { status: 401 },
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await db
      .update(appPermissions)
      .set({ passwordHash: hashed, mustChangePassword: 0 })
      .where(eq(appPermissions.id, record.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/auth/change-password]', error);
    return NextResponse.json(
      { ok: false, error: 'Errore durante il cambio password' },
      { status: 500 },
    );
  }
}
