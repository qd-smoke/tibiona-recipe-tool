import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SESSION_COOKIE = 'mixlab_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const encoder = new TextEncoder();

const isAsset = (pathname: string) =>
  pathname.startsWith('/_next') ||
  pathname.startsWith('/static') ||
  pathname.startsWith('/public') ||
  pathname.match(/\.(?:.*)$/);

const requiresAuth = (pathname: string) =>
  pathname.startsWith('/permissions') ||
  pathname.startsWith('/admin') ||
  pathname.startsWith('/recipes');

const getSecret = () => {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (!secret) {
    console.warn(
      '[middleware] AUTH_SECRET not configured - authentication will not work',
    );
  }
  return secret;
};

const decodeBase64 = (value: string) => {
  if (typeof atob === 'function') return atob(value);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64').toString('binary');
  }
  throw new Error('Base64 decoder not available');
};

const base64UrlToUint8Array = (input: string) => {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    base64 += '='.repeat(4 - pad);
  }
  const binary = decodeBase64(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const cryptoApi = globalThis.crypto;

const getHmacKey = (() => {
  let keyPromise: Promise<CryptoKey> | null = null;
  return () => {
    if (!cryptoApi?.subtle) return null;
    if (!keyPromise) {
      const secret = getSecret();
      if (!secret) {
        console.warn(
          '[middleware] No secret available, skipping HMAC key creation',
        );
        return null;
      }
      try {
        keyPromise = cryptoApi.subtle.importKey(
          'raw',
          encoder.encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign', 'verify'],
        );
      } catch (error) {
        console.error('[middleware] Failed to import HMAC key:', error);
        return null;
      }
    }
    return keyPromise;
  };
})();

const verifySessionTokenEdge = async (
  token: string,
): Promise<{ userId: number; issuedAt: number } | null> => {
  if (!cryptoApi?.subtle) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userIdStr, issuedAtStr, nonce, signatureB64] = parts;
  const payload = encoder.encode(`${userIdStr}.${issuedAtStr}.${nonce}`);
  const keyPromise = getHmacKey();
  if (!keyPromise) return null;
  const key = await keyPromise;
  const signatureBytes = base64UrlToUint8Array(signatureB64);
  const valid = await cryptoApi.subtle.verify(
    'HMAC',
    key,
    signatureBytes,
    payload,
  );
  if (!valid) return null;
  const userId = Number(userIdStr);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(userId) || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > SESSION_MAX_AGE * 1000) return null;
  return { userId, issuedAt };
};

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;

    if (isAsset(pathname) || pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    const token = request.cookies.get(SESSION_COOKIE)?.value ?? null;
    let session = null;
    if (token) {
      try {
        session = await verifySessionTokenEdge(token);
      } catch (error) {
        // If token verification fails, treat as no session
        console.error('[middleware] token verification error:', error);
        session = null;
      }
    }

    if (requiresAuth(pathname)) {
      if (session) {
        return NextResponse.next();
      }
      // No session and requires auth - redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      if (token) response.cookies.delete(SESSION_COOKIE);
      return response;
    }

    if (pathname === '/login' && session) {
      return NextResponse.redirect(new URL('/recipes', request.url));
    }

    // Redirect root to login if not authenticated
    if (pathname === '/' && !session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Redirect root to recipes if authenticated
    if (pathname === '/' && session) {
      return NextResponse.redirect(new URL('/recipes', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // If middleware fails, log error
    // For auth-required routes, we should still redirect to login to be safe
    console.error('[middleware] unexpected error:', error);
    const { pathname } = request.nextUrl;
    if (requiresAuth(pathname)) {
      console.warn(
        '[middleware] Middleware error on protected route, redirecting to login',
      );
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // For non-protected routes, allow request to proceed
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
