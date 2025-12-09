import { NextResponse } from 'next/server';
import { eq, and, like, desc } from 'drizzle-orm';
import { db } from '@/db';
import { dddevIngredientLots } from '@/db/schema';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { isAdminRole } from '@/constants/roles';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

// GET /api/ingredient-lots?sku=<sku>&q=<query>
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const query = searchParams.get('q');

    if (!sku) {
      return badRequest('SKU parameter is required');
    }

    const conditions = [eq(dddevIngredientLots.sku, sku)];
    if (query && query.trim()) {
      conditions.push(like(dddevIngredientLots.lot, `%${query.trim()}%`));
    }

    const lots = await db
      .select({
        lot: dddevIngredientLots.lot,
        lastUsedAt: dddevIngredientLots.lastUsedAt,
      })
      .from(dddevIngredientLots)
      .where(and(...conditions))
      .orderBy(desc(dddevIngredientLots.lastUsedAt))
      .limit(20);

    return NextResponse.json({
      ok: true,
      lots: lots.map((l) => ({
        lot: l.lot,
        lastUsedAt: l.lastUsedAt,
      })),
    });
  } catch (error) {
    console.error('[api/ingredient-lots] GET error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch lots', details: errorMessage },
      { status: 500 },
    );
  }
}

// POST /api/ingredient-lots
export async function POST(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return unauthorized('Not authenticated');
    }

    const body = (await request.json()) as {
      sku?: string;
      lot?: string;
    };

    const { sku, lot } = body;

    if (!sku || !lot) {
      return badRequest('SKU and lot are required');
    }

    const trimmedSku = sku.trim();
    const trimmedLot = lot.trim();

    if (!trimmedSku || !trimmedLot) {
      return badRequest('SKU and lot cannot be empty');
    }

    // Check if lot already exists for this SKU
    const [existing] = await db
      .select()
      .from(dddevIngredientLots)
      .where(
        and(
          eq(dddevIngredientLots.sku, trimmedSku),
          eq(dddevIngredientLots.lot, trimmedLot),
        ),
      )
      .limit(1);

    if (existing) {
      // Update last_used_at
      await db
        .update(dddevIngredientLots)
        .set({
          lastUsedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        })
        .where(eq(dddevIngredientLots.id, existing.id));

      return NextResponse.json({
        ok: true,
        lot: {
          id: existing.id,
          sku: existing.sku,
          lot: existing.lot,
          lastUsedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
        },
      });
    }

    // Create new lot
    const [result] = await db.insert(dddevIngredientLots).values({
      sku: trimmedSku,
      lot: trimmedLot,
    });

    const insertId = Number(result.insertId);

    const [newLot] = await db
      .select()
      .from(dddevIngredientLots)
      .where(eq(dddevIngredientLots.id, insertId))
      .limit(1);

    if (!newLot) {
      return NextResponse.json(
        { error: 'Failed to retrieve created lot' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      lot: newLot,
    });
  } catch (error) {
    console.error('[api/ingredient-lots] POST error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to save lot', details: errorMessage },
      { status: 500 },
    );
  }
}

// DELETE /api/ingredient-lots?sku=<sku>&lot=<lot>
export async function DELETE(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return unauthorized('Not authenticated');
    }

    // Only admins can delete lots
    if (!isAdminRole(profile.roleLabel)) {
      return NextResponse.json(
        { error: 'Only admins can delete lots' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');
    const lot = searchParams.get('lot');

    if (!sku || !lot) {
      return badRequest('SKU and lot parameters are required');
    }

    const trimmedSku = sku.trim();
    const trimmedLot = lot.trim();

    // Check if lot exists
    const [existing] = await db
      .select()
      .from(dddevIngredientLots)
      .where(
        and(
          eq(dddevIngredientLots.sku, trimmedSku),
          eq(dddevIngredientLots.lot, trimmedLot),
        ),
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    // Delete the lot
    await db
      .delete(dddevIngredientLots)
      .where(eq(dddevIngredientLots.id, existing.id));

    return NextResponse.json({
      ok: true,
      message: 'Lot deleted successfully',
    });
  } catch (error) {
    console.error('[api/ingredient-lots] DELETE error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete lot', details: errorMessage },
      { status: 500 },
    );
  }
}
