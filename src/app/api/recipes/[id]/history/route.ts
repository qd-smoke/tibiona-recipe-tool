import { NextResponse } from 'next/server';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/db';
import { dddevRecipeHistory } from '@/db/schema';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseId(params: { id?: string }): number | null {
  const id = params.id ? Number(params.id) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

// GET /api/recipes/[id]/history?type=all|production|admin
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const recipeId = parseId(resolvedParams);
  if (!recipeId) return badRequest('Invalid recipe id');

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';

    let whereCondition = eq(dddevRecipeHistory.recipeId, recipeId);

    if (type === 'production') {
      whereCondition = and(
        eq(dddevRecipeHistory.recipeId, recipeId),
        eq(dddevRecipeHistory.changeType, 'production'),
      ) as typeof whereCondition;
    } else if (type === 'admin') {
      whereCondition = and(
        eq(dddevRecipeHistory.recipeId, recipeId),
        eq(dddevRecipeHistory.changeType, 'admin'),
      ) as typeof whereCondition;
    }

    const history = await db
      .select()
      .from(dddevRecipeHistory)
      .where(whereCondition)
      .orderBy(desc(dddevRecipeHistory.createdAt));

    return NextResponse.json(
      {
        ok: true,
        history,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('Get recipe history failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to get recipe history', details: errorMessage },
      { status: 500 },
    );
  }
}
