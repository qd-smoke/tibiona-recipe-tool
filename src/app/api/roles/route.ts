import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { appRoles } from '@/db/schema';
import { AppRoleInput } from '@/types';
import { serializeCapabilities, toAppRole } from '@/lib/permissions/transform';
import { isAdminRole } from '@/constants/roles';
import { PERMISSION_TREE_LEAF_IDS } from '@/constants/permissionSections';

const applyAdminCapabilities = (
  _capabilities: import('@/types').PermissionCapabilities | undefined | null,
): import('@/types').PermissionCapabilities => {
  return PERMISSION_TREE_LEAF_IDS.reduce<
    import('@/types').PermissionCapabilities
  >((acc, id) => {
    acc[id] = { visible: true, editable: true };
    return acc;
  }, {});
};

const serializeRole = (role: AppRoleInput) => {
  // Validate role label
  const roleLabel = role.roleLabel?.trim() || '';
  if (!roleLabel) {
    throw new Error('Role label is required');
  }

  // If role is Admin, force all capabilities to visible/editable
  let finalCapabilities = role.capabilities ?? {};
  if (isAdminRole(roleLabel)) {
    finalCapabilities = applyAdminCapabilities(finalCapabilities);
  }

  const serializedCapabilities = serializeCapabilities(finalCapabilities);
  const capabilitiesJson = JSON.stringify(serializedCapabilities);

  // Debug logging
  console.log('[api/roles] serializeRole:', {
    roleId: role.id,
    roleLabel,
    inputCapabilitiesCount: Object.keys(role.capabilities ?? {}).length,
    inputCapabilities: role.capabilities,
    inputRecipeCosts: role.capabilities?.['recipe.costs'],
    finalCapabilitiesCount: Object.keys(finalCapabilities).length,
    finalCapabilities,
    finalRecipeCosts: finalCapabilities['recipe.costs'],
    serializedCapabilities,
    serializedRecipeCosts: serializedCapabilities['recipe.costs'],
    capabilitiesJson,
  });

  return {
    roleLabel: roleLabel,
    allowedSections: JSON.stringify(role.allowedSections ?? []),
    capabilities: capabilitiesJson,
  };
};

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(appRoles)
      .orderBy(asc(appRoles.roleLabel));
    return NextResponse.json({
      ok: true,
      data: rows.map(toAppRole),
    });
  } catch (error) {
    console.error('[api/roles] GET error', error);
    return NextResponse.json(
      { ok: false, error: 'Errore durante il caricamento dei ruoli' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      role?: AppRoleInput;
    };
    const role = body.role;
    if (!role || !role.roleLabel) {
      return NextResponse.json(
        { ok: false, error: 'Ruolo non valido' },
        { status: 400 },
      );
    }

    const payload = serializeRole(role);

    const [result] = await db.insert(appRoles).values(payload);

    const insertedId = Number(result.insertId);

    const [inserted] = await db
      .select()
      .from(appRoles)
      .where(eq(appRoles.id, insertedId))
      .limit(1);

    return NextResponse.json({
      ok: true,
      data: inserted ? toAppRole(inserted) : null,
    });
  } catch (error: unknown) {
    const mysqlError = error as { code?: string; message?: string };
    console.error('[api/roles] POST error', error);

    if (mysqlError?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { ok: false, error: 'Un ruolo con questo nome esiste già' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: mysqlError?.message ?? 'Errore durante la creazione del ruolo',
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      role?: AppRoleInput;
    };
    const role = body.role;

    console.log('[api/roles] PUT request received:', {
      body,
      role,
      roleCapabilities: role?.capabilities,
      roleRecipeCosts: role?.capabilities?.['recipe.costs'],
    });

    if (!role || !role.id || !role.roleLabel) {
      return NextResponse.json(
        { ok: false, error: 'Ruolo non valido' },
        { status: 400 },
      );
    }

    const payload = serializeRole(role);

    console.log('[api/roles] PUT payload to save:', {
      roleId: role.id,
      payload,
      capabilitiesString: payload.capabilities,
      capabilitiesParsed: JSON.parse(payload.capabilities),
      recipeCostsInPayload: JSON.parse(payload.capabilities)['recipe.costs'],
    });

    await db.update(appRoles).set(payload).where(eq(appRoles.id, role.id));

    const [updated] = await db
      .select()
      .from(appRoles)
      .where(eq(appRoles.id, role.id))
      .limit(1);

    console.log('[api/roles] PUT database result:', {
      updated,
      updatedCapabilities: updated?.capabilities,
      updatedCapabilitiesParsed: updated?.capabilities
        ? JSON.parse(updated.capabilities)
        : null,
      updatedRecipeCosts: updated?.capabilities
        ? JSON.parse(updated.capabilities)['recipe.costs']
        : null,
    });

    const transformedRole = updated ? toAppRole(updated) : null;

    console.log('[api/roles] PUT transformed role:', {
      transformedRole,
      transformedCapabilities: transformedRole?.capabilities,
      transformedRecipeCosts: transformedRole?.capabilities?.['recipe.costs'],
    });

    return NextResponse.json({
      ok: true,
      data: transformedRole,
    });
  } catch (error: unknown) {
    const mysqlError = error as { code?: string; message?: string };
    console.error('[api/roles] PUT error', error);

    if (mysqlError?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { ok: false, error: 'Un ruolo con questo nome esiste già' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          mysqlError?.message ?? "Errore durante l'aggiornamento del ruolo",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: number;
    };
    const id = body.id;
    if (!id || !Number.isFinite(id)) {
      return NextResponse.json(
        { ok: false, error: 'ID ruolo non valido' },
        { status: 400 },
      );
    }

    // Check if role is in use
    const { appPermissions } = await import('@/db/schema');
    const usersWithRole = await db
      .select()
      .from(appPermissions)
      .where(eq(appPermissions.roleId, id))
      .limit(1);

    if (usersWithRole.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Impossibile eliminare: ci sono utenti assegnati a questo ruolo',
        },
        { status: 400 },
      );
    }

    await db.delete(appRoles).where(eq(appRoles.id, id));

    return NextResponse.json({
      ok: true,
    });
  } catch (error: unknown) {
    console.error('[api/roles] DELETE error', error);
    return NextResponse.json(
      { ok: false, error: "Errore durante l'eliminazione del ruolo" },
      { status: 500 },
    );
  }
}
