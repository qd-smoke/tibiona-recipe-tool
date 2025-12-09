import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  dddevRecipe,
  dddevRecipeClientRelation,
  dddevRecipeCategory,
  dddevRecipeClient,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { RecipeMetadataUpdate } from '@/types';

import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// PUT /api/recipes/[id]/metadata
// Body: { name?: string, categoryId?: number | null, clientIds?: number[] }
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const recipeId = parseId(resolvedParams);
    if (!recipeId) {
      return badRequest('Invalid recipe ID');
    }

    // Check if recipe exists
    const [recipe] = await db
      .select()
      .from(dddevRecipe)
      .where(eq(dddevRecipe.id, recipeId))
      .limit(1);

    if (!recipe) {
      return notFound();
    }

    // Check permissions for each field
    const body = (await req.json()) as RecipeMetadataUpdate;
    const { name, sku, categoryId, clientIds } = body;

    const updates: Partial<typeof recipe> = {};

    // Update name if provided and user has permission
    if (name !== undefined) {
      if (!canEdit(profile.capabilities, 'recipe.basic.name')) {
        return NextResponse.json(
          { error: 'Insufficient permissions to edit recipe name' },
          { status: 403 },
        );
      }
      if (typeof name !== 'string' || name.trim().length === 0) {
        return badRequest('Recipe name cannot be empty');
      }
      updates.name = name.trim();
    }

    // Update SKU if provided and user has permission
    if (sku !== undefined) {
      if (!canEdit(profile.capabilities, 'recipe.basic.name')) {
        return NextResponse.json(
          { error: 'Insufficient permissions to edit recipe SKU' },
          { status: 403 },
        );
      }
      if (sku !== null && typeof sku !== 'string') {
        return badRequest('SKU must be a string or null');
      }
      updates.sku = sku === null || sku === '' ? null : sku.trim() || null;
    }

    // Update category if provided and user has permission
    if (categoryId !== undefined) {
      if (!canEdit(profile.capabilities, 'recipe.metadata.category')) {
        return NextResponse.json(
          { error: 'Insufficient permissions to edit category' },
          { status: 403 },
        );
      }

      if (categoryId !== null) {
        // Verify category exists
        const [category] = await db
          .select()
          .from(dddevRecipeCategory)
          .where(eq(dddevRecipeCategory.id, categoryId))
          .limit(1);

        if (!category) {
          return badRequest('Category not found');
        }
        updates.categoryId = categoryId;
      } else {
        updates.categoryId = null;
      }
    }

    // Update clients if provided and user has permission
    if (clientIds !== undefined) {
      if (!canEdit(profile.capabilities, 'recipe.metadata.clients')) {
        return NextResponse.json(
          { error: 'Insufficient permissions to edit clients' },
          { status: 403 },
        );
      }

      if (!Array.isArray(clientIds)) {
        return badRequest('clientIds must be an array');
      }

      // Verify all clients exist
      if (clientIds.length > 0) {
        const validClientIds = clientIds.filter(
          (id): id is number =>
            typeof id === 'number' && Number.isFinite(id) && id > 0,
        );

        if (validClientIds.length !== clientIds.length) {
          return badRequest('Invalid client IDs');
        }

        const existingClients = await db
          .select()
          .from(dddevRecipeClient)
          .where(inArray(dddevRecipeClient.id, validClientIds));

        if (existingClients.length !== validClientIds.length) {
          return badRequest('One or more clients not found');
        }
      }
    }

    // Perform updates in a transaction
    await db.transaction(async (tx) => {
      // Update recipe fields
      if (Object.keys(updates).length > 0) {
        await tx
          .update(dddevRecipe)
          .set(updates)
          .where(eq(dddevRecipe.id, recipeId));
      }

      // Update client relations if provided
      if (clientIds !== undefined) {
        // Delete existing relations
        await tx
          .delete(dddevRecipeClientRelation)
          .where(eq(dddevRecipeClientRelation.recipeId, recipeId));

        // Insert new relations
        if (clientIds.length > 0) {
          const validClientIds = clientIds.filter(
            (id): id is number =>
              typeof id === 'number' && Number.isFinite(id) && id > 0,
          );

          if (validClientIds.length > 0) {
            await tx.insert(dddevRecipeClientRelation).values(
              validClientIds.map((clientId) => ({
                recipeId,
                clientId,
              })),
            );
          }
        }
      }
    });

    // Fetch updated recipe with relations
    const [updatedRecipe] = await db
      .select()
      .from(dddevRecipe)
      .where(eq(dddevRecipe.id, recipeId))
      .limit(1);

    const clientRelations = await db
      .select()
      .from(dddevRecipeClientRelation)
      .where(eq(dddevRecipeClientRelation.recipeId, recipeId));

    const clientIdsResult =
      clientRelations.length > 0
        ? clientRelations.map((rel) => rel.clientId)
        : [];

    // Fetch client names if needed
    let clientNames: string[] = [];
    if (clientIdsResult.length > 0) {
      const clients = await db
        .select()
        .from(dddevRecipeClient)
        .where(inArray(dddevRecipeClient.id, clientIdsResult));
      clientNames = clients.map((c) => c.name);
    }

    // Fetch category name if needed
    let categoryName: string | null = null;
    if (updatedRecipe.categoryId) {
      const [category] = await db
        .select()
        .from(dddevRecipeCategory)
        .where(eq(dddevRecipeCategory.id, updatedRecipe.categoryId))
        .limit(1);
      categoryName = category?.name ?? null;
    }

    return NextResponse.json(
      {
        recipe: {
          id: updatedRecipe.id,
          name: updatedRecipe.name,
          sku: updatedRecipe.sku,
          categoryId: updatedRecipe.categoryId,
          categoryName,
          clientIds: clientIdsResult,
          clientNames,
        },
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('[api/recipes/[id]/metadata] PUT error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to update recipe metadata', details: errorMessage },
      { status: 500 },
    );
  }
}
