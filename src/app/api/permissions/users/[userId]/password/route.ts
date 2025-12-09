import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { appPermissions } from '@/db/schema';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

type Params = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const profile = await getCurrentProfile();
    if (!profile || !canEdit(profile.capabilities, 'admin.permissions')) {
      return NextResponse.json(
        { ok: false, error: 'Permessi insufficienti' },
        { status: 403 },
      );
    }

    const resolved = await params;
    const targetUserId = Number(resolved.userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'User ID non valido' },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { newPassword?: string };
    const newPassword = body.newPassword?.trim() || '';
    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'La nuova password deve avere almeno 6 caratteri' },
        { status: 400 },
      );
    }

    const [userRecord] = await db
      .select()
      .from(appPermissions)
      .where(eq(appPermissions.id, targetUserId))
      .limit(1);

    if (!userRecord) {
      return NextResponse.json(
        { ok: false, error: 'Utente non trovato' },
        { status: 404 },
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await db
      .update(appPermissions)
      .set({ passwordHash: hashed, mustChangePassword: 0 })
      .where(eq(appPermissions.id, targetUserId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/permissions/users/[userId]/password]', error);
    return NextResponse.json(
      { ok: false, error: 'Errore interno' },
      { status: 500 },
    );
  }
}
