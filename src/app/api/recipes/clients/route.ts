import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevRecipeClient } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { RecipeClient } from '@/types';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

// GET /api/recipes/clients
export async function GET() {
  try {
    const clients = await db
      .select()
      .from(dddevRecipeClient)
      .orderBy(asc(dddevRecipeClient.name));

    return NextResponse.json({ clients }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/clients] GET error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to fetch clients', details: errorMessage },
      { status: 500 },
    );
  }
}

// POST /api/recipes/clients
// Body: { name: string }
export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    if (!canEdit(profile.capabilities, 'admin.permissions')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
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

    // Check if client already exists (case-insensitive)
    const allClients = await db.select().from(dddevRecipeClient);

    const normalizedNewName = trimmedName.toLowerCase();
    const duplicate = allClients.find(
      (client) => client.name.toLowerCase() === normalizedNewName,
    );

    if (duplicate) {
      return NextResponse.json(
        { error: 'Un cliente con questo nome esiste già' },
        { status: 409 },
      );
    }

    const [inserted] = await db
      .insert(dddevRecipeClient)
      .values({ name: trimmedName });

    const clientId = Number(inserted.insertId);
    const [newClient] = await db
      .select()
      .from(dddevRecipeClient)
      .where(eq(dddevRecipeClient.id, clientId))
      .limit(1);

    return NextResponse.json(
      { client: newClient as RecipeClient },
      { status: 201 },
    );
  } catch (e) {
    console.error('[api/recipes/clients] POST error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (errorMessage.includes('Duplicate entry')) {
      return NextResponse.json(
        { error: 'Client already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create client', details: errorMessage },
      { status: 500 },
    );
  }
}
