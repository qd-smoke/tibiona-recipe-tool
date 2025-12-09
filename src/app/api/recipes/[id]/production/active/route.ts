import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { dddevProduction } from '@/db/schema';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseId(params: { id?: string }): number | null {
  const id = params.id ? Number(params.id) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

// GET /api/recipes/[id]/production/active
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const recipeId = parseId(resolvedParams);
  if (!recipeId) return badRequest('Invalid recipe id');

  try {
    // Get active production for this recipe
    const [activeProduction] = await db
      .select()
      .from(dddevProduction)
      .where(
        and(
          eq(dddevProduction.recipeId, recipeId),
          eq(dddevProduction.status, 'in_progress'),
        ),
      )
      .limit(1);

    return NextResponse.json(
      {
        ok: true,
        production: activeProduction || null,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('Get active production failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to get active production', details: errorMessage },
      { status: 500 },
    );
  }
}
