import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

import { db } from '@/db';
import { appPermissions, appRoles } from '@/db/schema';
import { PermissionProfileInput } from '@/types';
import { toPermissionProfile } from '@/lib/permissions/transform';

const serializeProfile = (profile: PermissionProfileInput) => {
  return {
    username: profile.username.trim().toLowerCase(),
    displayName: profile.displayName.trim(),
    brand: profile.brand || 'Molino Bongiovanni',
    roleLabel: profile.roleLabel || '',
    roleId: profile.roleId ?? null,
    avatarUrl: profile.avatarUrl || '',
    defaultSection: profile.defaultSection || '',
    // Legacy fields - set default values for backward compatibility
    allowedSections: '[]',
    capabilities: '{}',
    notes:
      profile.notes && profile.notes.trim().length > 0
        ? profile.notes.trim()
        : null,
    mustChangePassword: profile.mustChangePassword ? 1 : 0,
  };
};

const APP_PERMISSIONS_DDL = `CREATE TABLE app_permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  brand VARCHAR(64) NOT NULL DEFAULT 'Molino Bongiovanni',
  role_label VARCHAR(255) NOT NULL DEFAULT '',
  avatar_url VARCHAR(255) NOT NULL DEFAULT '',
  default_section VARCHAR(64) NOT NULL DEFAULT '',
  allowed_sections TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY app_permissions_username_unique (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

type MysqlError = Error & { code?: string };

const handleDbError = (error: unknown) => {
  const mysqlError = error as MysqlError;
  console.error('[api/permissions] error', error);
  console.error('[api/permissions] error details', {
    message: mysqlError?.message,
    code: mysqlError?.code,
    stack: mysqlError?.stack,
  });

  if (mysqlError?.code === 'ER_NO_SUCH_TABLE') {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Database table 'app_permissions' is missing. Execute the provided SQL to create it.",
        hint: APP_PERMISSIONS_DDL,
      },
      { status: 500 },
    );
  }

  const message = mysqlError?.message ?? 'Unexpected server error';
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(appPermissions)
      .orderBy(asc(appPermissions.displayName));

    // Load roles for each user
    const profilesWithRoles = await Promise.all(
      rows.map(async (record) => {
        let roleRecord = null;
        if (record.roleId) {
          [roleRecord] = await db
            .select()
            .from(appRoles)
            .where(eq(appRoles.id, record.roleId))
            .limit(1);
        }
        return toPermissionProfile(record, roleRecord);
      }),
    );

    return NextResponse.json({
      ok: true,
      data: profilesWithRoles,
    });
  } catch (error) {
    return handleDbError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      profile?: PermissionProfileInput;
    };
    const profile = body.profile;
    if (!profile || !profile.username || !profile.displayName) {
      return NextResponse.json(
        { ok: false, error: 'Profilo non valido' },
        { status: 400 },
      );
    }

    const payload = serializeProfile(profile);

    // Handle passwordHash: only set it if we have a new password or creating a new user
    // If updating existing user without new password, don't include passwordHash in payload
    // This preserves the existing password
    let passwordHash: string | undefined;
    let mustChangePassword = payload.mustChangePassword;

    if (profile.newPassword && profile.newPassword.length > 0) {
      // User provided a new password - hash it
      passwordHash = await bcrypt.hash(profile.newPassword, 12);
      mustChangePassword = 1;
    } else if (!profile.id) {
      // Creating new user without password - set empty string (will be required to set password on first login)
      passwordHash = '';
      mustChangePassword = 1;
    }

    const payloadWithPassword = {
      ...payload,
      mustChangePassword,
      ...(passwordHash !== undefined && { passwordHash }),
    };

    if (profile.id) {
      // For updates: if passwordHash is undefined, it won't be in payloadWithPassword
      // Drizzle will preserve existing values for fields not in the update payload
      await db
        .update(appPermissions)
        .set(payloadWithPassword)
        .where(eq(appPermissions.id, profile.id));
      const [updated] = await db
        .select()
        .from(appPermissions)
        .where(eq(appPermissions.id, profile.id))
        .limit(1);

      if (!updated) {
        return NextResponse.json(
          { ok: false, error: 'Utente non trovato' },
          { status: 404 },
        );
      }

      // Load role if exists
      let roleRecord = null;
      if (updated.roleId) {
        [roleRecord] = await db
          .select()
          .from(appRoles)
          .where(eq(appRoles.id, updated.roleId))
          .limit(1);
      }

      return NextResponse.json({
        ok: true,
        data: toPermissionProfile(updated, roleRecord),
      });
    }

    const [result] = await db
      .insert(appPermissions)
      .values(payloadWithPassword);

    const insertedId = Number(result.insertId);

    const [inserted] = await db
      .select()
      .from(appPermissions)
      .where(eq(appPermissions.id, insertedId))
      .limit(1);

    if (!inserted) {
      return NextResponse.json(
        { ok: false, error: "Errore durante la creazione dell'utente" },
        { status: 500 },
      );
    }

    // Load role if exists
    let roleRecord = null;
    if (inserted.roleId) {
      [roleRecord] = await db
        .select()
        .from(appRoles)
        .where(eq(appRoles.id, inserted.roleId))
        .limit(1);
    }

    return NextResponse.json({
      ok: true,
      data: toPermissionProfile(inserted, roleRecord),
    });
  } catch (error) {
    return handleDbError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: number; username?: string };
    if (!body.id && !body.username) {
      return NextResponse.json(
        { ok: false, error: 'ID o username richiesto per cancellare' },
        { status: 400 },
      );
    }

    if (body.id) {
      await db.delete(appPermissions).where(eq(appPermissions.id, body.id));
      return NextResponse.json({ ok: true });
    }

    await db
      .delete(appPermissions)
      .where(eq(appPermissions.username, body.username!.toLowerCase()));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleDbError(error);
  }
}
