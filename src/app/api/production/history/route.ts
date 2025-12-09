import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  dddevProduction,
  dddevRecipeVersion,
  appPermissions,
  dddevRecipe,
} from '@/db/schema';

// GET /api/production/history
// Returns all productions with parsed snapshot data
export async function GET(_req: Request) {
  try {
    // Get all productions with related data
    const productions = await db
      .select({
        production: {
          id: dddevProduction.id,
          recipeId: dddevProduction.recipeId,
          productionLot: dddevProduction.productionLot,
          startedAt: dddevProduction.startedAt,
          finishedAt: dddevProduction.finishedAt,
          status: dddevProduction.status,
          notes: dddevProduction.notes,
          createdAt: dddevProduction.createdAt,
          updatedAt: dddevProduction.updatedAt,
        },
        user: {
          id: appPermissions.id,
          displayName: appPermissions.displayName,
          username: appPermissions.username,
        },
        recipe: {
          id: dddevRecipe.id,
          name: dddevRecipe.name,
        },
        recipeVersion: {
          id: dddevRecipeVersion.id,
          versionNumber: dddevRecipeVersion.versionNumber,
          recipeSnapshot: dddevRecipeVersion.recipeSnapshot,
          ingredientsSnapshot: dddevRecipeVersion.ingredientsSnapshot,
          createdAt: dddevRecipeVersion.createdAt,
        },
      })
      .from(dddevProduction)
      .leftJoin(
        dddevRecipeVersion,
        eq(dddevProduction.recipeVersionId, dddevRecipeVersion.id),
      )
      .leftJoin(appPermissions, eq(dddevProduction.userId, appPermissions.id))
      .leftJoin(dddevRecipe, eq(dddevProduction.recipeId, dddevRecipe.id))
      .orderBy(desc(dddevProduction.startedAt));

    // Parse snapshots for each production
    const history = productions.map((item) => {
      let recipeSnapshot = null;
      let ingredientsSnapshot: unknown[] = [];

      try {
        if (item.recipeVersion?.recipeSnapshot) {
          recipeSnapshot = JSON.parse(
            item.recipeVersion.recipeSnapshot,
          ) as Record<string, unknown>;
        }
      } catch (error) {
        console.error(
          `Failed to parse recipe snapshot for production ${item.production.id}:`,
          error,
        );
      }

      try {
        if (item.recipeVersion?.ingredientsSnapshot) {
          ingredientsSnapshot = JSON.parse(
            item.recipeVersion.ingredientsSnapshot,
          ) as unknown[];
        }
      } catch (error) {
        console.error(
          `Failed to parse ingredients snapshot for production ${item.production.id}:`,
          error,
        );
      }

      return {
        production: item.production,
        user: item.user,
        recipe: item.recipe,
        recipeVersion: item.recipeVersion
          ? {
              id: item.recipeVersion.id,
              versionNumber: item.recipeVersion.versionNumber,
              createdAt: item.recipeVersion.createdAt,
            }
          : null,
        recipeSnapshot,
        ingredients: ingredientsSnapshot,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        history,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('Get production history failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to get production history', details: errorMessage },
      { status: 500 },
    );
  }
}
