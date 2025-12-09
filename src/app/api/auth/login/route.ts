import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { appPermissions } from '@/db/schema';
import { createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { toPermissionProfile } from '@/lib/permissions/transform';

const formatMySqlDateTime = (date: Date) =>
  date.toISOString().slice(0, 19).replace('T', ' ');

export async function POST(request: Request) {
  console.log('[API AUTH LOGIN] [DEBUG] POST request received');
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      remember?: boolean;
    };

    console.log('[API AUTH LOGIN] [DEBUG] Request body:', {
      hasUsername: !!body.username,
      hasPassword: !!body.password,
      passwordLength: body.password?.length || 0,
      remember: body.remember,
    });

    const username = body.username?.trim().toLowerCase();
    const password = body.password ?? '';

    console.log('[API AUTH LOGIN] [DEBUG] Processed credentials:', {
      username,
      passwordLength: password.length,
      remember: body.remember,
    });

    if (!username || !password) {
      console.warn('[API AUTH LOGIN] [DEBUG] Missing credentials');
      return NextResponse.json(
        { ok: false, error: 'Username e password sono obbligatori' },
        { status: 400 },
      );
    }

    console.log(
      '[API AUTH LOGIN] [DEBUG] Querying database for user:',
      username,
    );
    const [record] = await db
      .select()
      .from(appPermissions)
      .where(eq(appPermissions.username, username))
      .limit(1);

    console.log('[API AUTH LOGIN] [DEBUG] Database query result:', {
      found: !!record,
      hasId: !!record?.id,
      hasPasswordHash: !!record?.passwordHash,
    });

    if (!record || !record.passwordHash) {
      console.warn(
        '[API AUTH LOGIN] [DEBUG] User not found or missing password hash',
      );
      return NextResponse.json(
        { ok: false, error: 'Credenziali non valide' },
        { status: 401 },
      );
    }

    console.log('[API AUTH LOGIN] [DEBUG] Comparing password hash...');
    const passwordOk = await bcrypt.compare(password, record.passwordHash);
    console.log(
      '[API AUTH LOGIN] [DEBUG] Password comparison result:',
      passwordOk,
    );

    if (!passwordOk) {
      console.warn('[API AUTH LOGIN] [DEBUG] Password mismatch');
      return NextResponse.json(
        { ok: false, error: 'Credenziali non valide' },
        { status: 401 },
      );
    }

    const now = new Date();
    const nowSql = formatMySqlDateTime(now);
    console.log('[API AUTH LOGIN] [DEBUG] Updating lastLoginAt:', nowSql);
    await db
      .update(appPermissions)
      .set({ lastLoginAt: nowSql })
      .where(eq(appPermissions.id, record.id));

    console.log(
      '[API AUTH LOGIN] [DEBUG] Creating session token for user:',
      record.id,
    );
    const token = createSessionToken(record.id);
    console.log('[API AUTH LOGIN] [DEBUG] Session token created');

    const profile = toPermissionProfile({ ...record, lastLoginAt: nowSql });
    console.log('[API AUTH LOGIN] [DEBUG] Profile created:', {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
    });

    const response = NextResponse.json({
      ok: true,
      data: profile,
    });

    console.log(
      '[API AUTH LOGIN] [DEBUG] Setting session cookie, remember:',
      body.remember,
    );
    setSessionCookie(response, token, body.remember);

    console.log(
      '[API AUTH LOGIN] [DEBUG] Login successful, returning response',
    );
    return response;
  } catch (error) {
    console.error('[API AUTH LOGIN] [DEBUG] Error:', error);
    console.error('[api/auth/login]', error);
    return NextResponse.json(
      { ok: false, error: 'Errore durante il login' },
      { status: 500 },
    );
  }
}
