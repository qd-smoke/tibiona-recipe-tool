import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { dddevRecipeVersion } from '@/db/schema';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseId(params: { id?: string }): number | null {
  const id = params.id ? Number(params.id) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

// GET /api/recipes/[id]/versions
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const recipeId = parseId(resolvedParams);
  if (!recipeId) return badRequest('Invalid recipe id');

  try {
    const versions = await db
      .select()
      .from(dddevRecipeVersion)
      .where(eq(dddevRecipeVersion.recipeId, recipeId))
      .orderBy(desc(dddevRecipeVersion.versionNumber));

    return NextResponse.json(
      {
        ok: true,
        versions,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('Get recipe versions failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to get recipe versions', details: errorMessage },
      { status: 500 },
    );
  }
}
