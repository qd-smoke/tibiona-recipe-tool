import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { appPermissions, appRoles } from '@/db/schema';
import {
  clearSessionCookie,
  getSessionTokenFromCookies,
  verifySessionToken,
} from '@/lib/auth/session';
import { toPermissionProfile } from '@/lib/permissions/transform';

export async function GET() {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Non autenticato' },
      { status: 401 },
    );
  }
  const session = verifySessionToken(token);
  if (!session || !Number.isFinite(session.userId)) {
    const response = NextResponse.json(
      { ok: false, error: 'Sessione non valida' },
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

  if (!record) {
    const response = NextResponse.json(
      { ok: false, error: 'Utente non trovato' },
      { status: 401 },
    );
    clearSessionCookie(response);
    return response;
  }

  // Load role permissions if roleId exists
  let roleRecord = null;
  if (record.roleId) {
    [roleRecord] = await db
      .select()
      .from(appRoles)
      .where(eq(appRoles.id, record.roleId))
      .limit(1);
  }

  return NextResponse.json({
    ok: true,
    data: toPermissionProfile(record, roleRecord),
  });
}
