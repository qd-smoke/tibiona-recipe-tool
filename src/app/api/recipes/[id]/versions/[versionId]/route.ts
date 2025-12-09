import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { dddevRecipeVersion } from '@/db/schema';
import type { MagentoRecipe, MagentoRecipeIngredient } from '@/types';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
}

function parseId(params: { id?: string }): number | null {
  const id = params.id ? Number(params.id) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parseVersionId(params: { versionId?: string }): number | null {
  const id = params.versionId ? Number(params.versionId) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

// GET /api/recipes/[id]/versions/[versionId]
export async function GET(
  _req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; versionId: string }>;
  },
) {
  const resolvedParams = await params;
  const recipeId = parseId({ id: resolvedParams.id });
  const versionId = parseVersionId({ versionId: resolvedParams.versionId });

  if (!recipeId) {
    return badRequest('Invalid recipe id');
  }

  if (!versionId) {
    return badRequest('Invalid version id');
  }

  try {
    const [version] = await db
      .select()
      .from(dddevRecipeVersion)
      .where(eq(dddevRecipeVersion.id, versionId))
      .limit(1);

    if (!version) {
      return notFound('Version not found');
    }

    if (version.recipeId !== recipeId) {
      return badRequest('Version does not belong to this recipe');
    }

    // Parse JSON snapshots
    let recipeSnapshot: MagentoRecipe;
    let ingredientsSnapshot: MagentoRecipeIngredient[];

    try {
      recipeSnapshot = JSON.parse(version.recipeSnapshot) as MagentoRecipe;
    } catch (error) {
      console.error('Failed to parse recipe snapshot:', error);
      return NextResponse.json(
        {
          error: 'Failed to parse recipe snapshot',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }

    try {
      ingredientsSnapshot = JSON.parse(
        version.ingredientsSnapshot,
      ) as MagentoRecipeIngredient[];
    } catch (error) {
      console.error('Failed to parse ingredients snapshot:', error);
      return NextResponse.json(
        {
          error: 'Failed to parse ingredients snapshot',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      version: {
        id: version.id,
        recipeId: version.recipeId,
        versionNumber: version.versionNumber,
        createdByUserId: version.createdByUserId,
        createdAt: version.createdAt,
      },
      recipe: recipeSnapshot,
      ingredients: ingredientsSnapshot,
    });
  } catch (error) {
    console.error('Get recipe version failed', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to get recipe version',
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
