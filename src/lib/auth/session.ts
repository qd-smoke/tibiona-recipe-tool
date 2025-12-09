import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'mixlab_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const getSecret = () => {
  const secret =
    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || undefined;
  if (!secret) {
    throw new Error(
      'Missing AUTH_SECRET (or NEXTAUTH_SECRET) env var for auth sessions',
    );
  }
  return secret;
};

const sign = (payload: string) => {
  const secret = getSecret();
  return createHmac('sha256', secret).update(payload).digest('base64url');
};

export const createSessionToken = (userId: number) => {
  const issuedAt = Date.now();
  const nonce = randomBytes(6).toString('hex');
  const payload = `${userId}.${issuedAt}.${nonce}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
};

export const verifySessionToken = (
  token: string,
): { userId: number; issuedAt: number } | null => {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userIdStr, issuedAtStr, nonce, signature] = parts;
  const payload = `${userIdStr}.${issuedAtStr}.${nonce}`;
  const expectedSignature = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const userId = Number(userIdStr);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(userId) || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_MAX_AGE * 1000) return null;
  return { userId, issuedAt };
};

export const setSessionCookie = (
  response: NextResponse,
  token: string,
  remember?: boolean,
) => {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: remember ? SESSION_MAX_AGE : 60 * 60 * 12, // 12h default
  });
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    maxAge: 0,
    path: '/',
  });
};

export const getSessionTokenFromCookies = async () => {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
};
