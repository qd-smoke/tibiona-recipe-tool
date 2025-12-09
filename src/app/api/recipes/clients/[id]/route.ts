import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevRecipeClient } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { RecipeClient } from '@/types';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

// PUT /api/recipes/clients/[id]
// Body: { name: string }
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canEdit(profile.capabilities, 'admin.permissions')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const resolvedParams = await params;
    const clientId = parseId(resolvedParams);
    if (!clientId) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Client name is required' },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();

    // Check if client exists
    const [existing] = await db
      .select()
      .from(dddevRecipeClient)
      .where(eq(dddevRecipeClient.id, clientId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Check if another client with the same name exists (case-insensitive)
    const allClients = await db.select().from(dddevRecipeClient);

    const normalizedNewName = trimmedName.toLowerCase();
    const duplicate = allClients.find(
      (client) =>
        client.name.toLowerCase() === normalizedNewName &&
        client.id !== clientId,
    );

    if (duplicate) {
      return NextResponse.json(
        { error: 'Un cliente con questo nome esiste già' },
        { status: 409 },
      );
    }

    // Update client
    await db
      .update(dddevRecipeClient)
      .set({ name: trimmedName })
      .where(eq(dddevRecipeClient.id, clientId));

    const [updated] = await db
      .select()
      .from(dddevRecipeClient)
      .where(eq(dddevRecipeClient.id, clientId))
      .limit(1);

    return NextResponse.json(
      { client: updated as RecipeClient },
      { status: 200 },
    );
  } catch (e) {
    console.error('[api/recipes/clients/[id]] PUT error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to update client', details: errorMessage },
      { status: 500 },
    );
  }
}

// DELETE /api/recipes/clients/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canEdit(profile.capabilities, 'admin.permissions')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const resolvedParams = await params;
    const clientId = parseId(resolvedParams);
    if (!clientId) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    // Check if client exists
    const [existing] = await db
      .select()
      .from(dddevRecipeClient)
      .where(eq(dddevRecipeClient.id, clientId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Delete client (cascade will handle relation deletions)
    await db
      .delete(dddevRecipeClient)
      .where(eq(dddevRecipeClient.id, clientId));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/clients/[id]] DELETE error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to delete client', details: errorMessage },
      { status: 500 },
    );
  }
}
