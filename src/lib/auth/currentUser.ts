import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { appPermissions, appRoles } from '@/db/schema';
import type { PermissionProfile } from '@/types';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';
import { toPermissionProfile } from '@/lib/permissions/transform';

export async function getCurrentProfile(): Promise<PermissionProfile | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value ?? null;
    if (!token) return null;
    const session = verifySessionToken(token);
    if (!session || !Number.isFinite(session.userId)) return null;

    try {
      const [record] = await db
        .select()
        .from(appPermissions)
        .where(eq(appPermissions.id, session.userId))
        .limit(1);

      if (!record) return null;

      // Load role permissions if roleId exists
      let roleRecord = null;
      if (record.roleId) {
        try {
          [roleRecord] = await db
            .select()
            .from(appRoles)
            .where(eq(appRoles.id, record.roleId))
            .limit(1);
        } catch (error) {
          // If role lookup fails, continue without role
          console.warn('[getCurrentProfile] Failed to load role:', error);
          if (error instanceof Error) {
            console.warn('[getCurrentProfile] Role error details:', {
              message: error.message,
              stack: error.stack,
            });
          }
        }
      }

      return toPermissionProfile(record, roleRecord);
    } catch (error) {
      // Database connection error - log but don't crash
      console.error('[getCurrentProfile] Database error:', error);
      if (error instanceof Error) {
        console.error('[getCurrentProfile] Database error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          userId: session.userId,
        });
      }
      return null;
    }
  } catch (error) {
    // Cookie or session verification error
    console.warn('[getCurrentProfile] Session error:', error);
    return null;
  }
}
