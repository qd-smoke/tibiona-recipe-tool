// WARNING: This module is server-only. Do not import into client components.
// Prefer calling the /api/recipes route from the client.

import { MagentoRecipe, NewIngredientProps, NewRecipeProps } from '@/types';
import { db } from '@/db';
import {
  dddevRecipe,
  dddevRecipeIngredient,
  dddevRecipeCategory,
  dddevRecipeClient,
  dddevRecipeClientRelation,
} from '@/db/schema';
import { eq, like, asc, inArray, sql, and } from 'drizzle-orm';

type getRecipesSearchParams = {
  page?: number | string;
  perPage?: number | string;
  includeIngredients?: string | number | boolean | null;
  query?: string;
  categoryId?: number | string | null;
  clientIds?: string | number[]; // Can be comma-separated string or array
};

type getRecipesResult = {
  items: MagentoRecipe[];
  total: number | string;
  page: number | string;
  perPage: number | string;
  query: string;
};

export async function getRecipes(
  searchParams: getRecipesSearchParams = {},
): Promise<getRecipesResult> {
  const {
    page,
    perPage,
    includeIngredients: includeIngredientsParam,
    query: q = '',
    categoryId: categoryIdParam,
    clientIds: clientIdsParam,
  } = searchParams;

  const includeIngredients =
    typeof includeIngredientsParam === 'string'
      ? includeIngredientsParam === 'true' || includeIngredientsParam === '1'
      : !!includeIngredientsParam;

  // Parse categoryId filter
  const categoryId =
    categoryIdParam !== undefined && categoryIdParam !== null
      ? Number(categoryIdParam)
      : null;
  const hasCategoryFilter =
    categoryId !== null && Number.isFinite(categoryId) && categoryId > 0;

  // Parse clientIds filter
  let clientIds: number[] = [];
  if (clientIdsParam !== undefined) {
    if (Array.isArray(clientIdsParam)) {
      clientIds = clientIdsParam
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);
    } else if (typeof clientIdsParam === 'string') {
      clientIds = clientIdsParam
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isFinite(id) && id > 0);
    } else if (typeof clientIdsParam === 'number') {
      clientIds = [clientIdsParam].filter((id) => id > 0);
    }
  }
  const hasClientFilter = clientIds.length > 0;

  // Build where conditions
  const conditions = [];

  // Apply search only if q length >= 2
  const hasSearch = q.length >= 2;
  if (hasSearch) {
    conditions.push(like(dddevRecipe.name, `%${q}%`));
  }

  // Apply category filter
  if (hasCategoryFilter) {
    conditions.push(eq(dddevRecipe.categoryId, categoryId!));
  }

  // Apply client filter (requires subquery)
  let recipeIdsWithClients: number[] = [];
  if (hasClientFilter) {
    const clientRelations = await db
      .select({ recipeId: dddevRecipeClientRelation.recipeId })
      .from(dddevRecipeClientRelation)
      .where(inArray(dddevRecipeClientRelation.clientId, clientIds));

    recipeIdsWithClients = [
      ...new Set(clientRelations.map((rel) => rel.recipeId)),
    ];

    if (recipeIdsWithClients.length > 0) {
      conditions.push(inArray(dddevRecipe.id, recipeIdsWithClients));
    } else {
      // No recipes match the client filter, return empty result
      return {
        items: [],
        total: 0,
        page: Number.isNaN(Number(page)) ? 1 : Number(page),
        perPage: Number.isNaN(Number(perPage)) ? 10 : Number(perPage),
        query: q,
      };
    }
  }

  const whereCondition =
    conditions.length > 0
      ? conditions.length === 1
        ? conditions[0]
        : and(...conditions)
      : undefined;

  const parsedPage = Number(page);
  const parsedPerPage = Number(perPage);

  try {
    const skip =
      ((Number.isNaN(parsedPage) ? 1 : parsedPage) - 1) *
      (Number.isNaN(parsedPerPage) ? 10 : parsedPerPage);

    // Count total records
    const countQuery = whereCondition
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(dddevRecipe)
          .where(whereCondition)
      : db.select({ count: sql<number>`count(*)` }).from(dddevRecipe);

    const [{ count: total }] = await countQuery;
    console.log(
      '[getRecipes] Total count:',
      total,
      'hasSearch:',
      hasSearch,
      'q:',
      q,
    );

    // Get paginated items
    const baseQuery = db
      .select()
      .from(dddevRecipe)
      .orderBy(asc(dddevRecipe.name), asc(dddevRecipe.id))
      .limit(Number.isNaN(parsedPerPage) ? 10 : parsedPerPage)
      .offset(skip);

    const itemsQuery = whereCondition
      ? baseQuery.where(whereCondition)
      : baseQuery;

    let items = await itemsQuery;
    console.log(
      '[getRecipes] Items fetched:',
      items.length,
      'IDs:',
      items.map((r) => r.id),
    );

    const recipeIds = items.map((item) => item.id);

    // Fetch categories for recipes
    const categoryIds = items
      .map((item) => item.categoryId)
      .filter((id): id is number => id !== null && id !== undefined);
    const categoriesMap = new Map<number, string>();
    if (categoryIds.length > 0) {
      const categories = await db
        .select()
        .from(dddevRecipeCategory)
        .where(inArray(dddevRecipeCategory.id, categoryIds));
      categories.forEach((cat) => {
        categoriesMap.set(cat.id, cat.name);
      });
    }

    // Fetch client relations for recipes
    const clientRelationsMap = new Map<number, number[]>();
    if (recipeIds.length > 0) {
      const clientRelations = await db
        .select()
        .from(dddevRecipeClientRelation)
        .where(inArray(dddevRecipeClientRelation.recipeId, recipeIds));

      clientRelations.forEach((rel) => {
        const existing = clientRelationsMap.get(rel.recipeId) || [];
        existing.push(rel.clientId);
        clientRelationsMap.set(rel.recipeId, existing);
      });
    }

    // Fetch client names
    const allClientIds = [
      ...new Set(Array.from(clientRelationsMap.values()).flat()),
    ];
    const clientsMap = new Map<number, string>();
    if (allClientIds.length > 0) {
      const clients = await db
        .select()
        .from(dddevRecipeClient)
        .where(inArray(dddevRecipeClient.id, allClientIds));
      clients.forEach((client) => {
        clientsMap.set(client.id, client.name);
      });
    }

    // Merge data into items
    items = items.map((item) => {
      const result: typeof item & {
        categoryName?: string | null;
        clientIds?: number[];
        clientNames?: string[];
      } = {
        ...item,
      };

      // Add category name
      if (item.categoryId) {
        result.categoryName = categoriesMap.get(item.categoryId) || null;
      } else {
        result.categoryName = null;
      }

      // Add client IDs and names
      const itemClientIds = clientRelationsMap.get(item.id) || [];
      result.clientIds = itemClientIds;
      result.clientNames = itemClientIds
        .map((id) => clientsMap.get(id))
        .filter((name): name is string => name !== undefined);

      return result;
    });

    // If ingredients are needed, fetch them separately and merge
    if (includeIngredients) {
      if (recipeIds.length > 0) {
        const ingredients = await db
          .select()
          .from(dddevRecipeIngredient)
          .where(inArray(dddevRecipeIngredient.recipeId, recipeIds));

        items = items.map((item) => ({
          ...item,
          dddev_recipe_ingredient: ingredients.filter(
            (ing) => ing.recipeId === item.id,
          ),
        }));
      }
    }

    return {
      items,
      total,
      page: Number.isNaN(parsedPage) ? 1 : parsedPage,
      perPage: Number.isNaN(parsedPerPage) ? 10 : parsedPerPage,
      query: q,
    };
  } catch (e) {
    console.error('List recipes failed', e);
    return {
      items: [],
      total: 0,
      page: page || 0,
      perPage: perPage || 0,
      query: q,
    };
  }
}

// export async function getRecipe(id: number) {}

export async function createRecipe(data: {
  recipeData: NewRecipeProps;
  ingredients: NewIngredientProps[];
  categoryName?: string;
  clientNames?: string[];
}) {
  const { recipeData, ingredients, categoryName, clientNames } = data;

  try {
    // Resolve category ID if categoryName is provided
    let categoryId: number | null = null;
    if (categoryName) {
      const allCategories = await db.select().from(dddevRecipeCategory);
      const category = allCategories.find(
        (cat) => cat.name.toLowerCase() === categoryName.toLowerCase(),
      );
      if (category) {
        categoryId = category.id;
      }
    }

    // Insert the recipe first (with categoryId if resolved)
    const recipeDataToInsert = {
      ...recipeData,
      categoryId: categoryId || recipeData.categoryId || null,
    };
    const [recipeResult] = await db
      .insert(dddevRecipe)
      .values(recipeDataToInsert);

    const recipeId = Number(recipeResult.insertId);

    if (!recipeId || recipeId === 0) {
      return {
        success: false,
        error: 'Failed to get recipe ID after insert' as const,
      };
    }

    if (ingredients.length > 0) {
      const ingredientValues = ingredients.map((ingredient) => ({
        recipeId,
        ...ingredient,
      }));

      await db.insert(dddevRecipeIngredient).values(ingredientValues);
    }

    // Resolve and save clients if provided
    if (clientNames && clientNames.length > 0) {
      const allClients = await db.select().from(dddevRecipeClient);
      const clientIds: number[] = [];
      for (const clientName of clientNames) {
        const client = allClients.find(
          (c) => c.name.toLowerCase() === clientName.toLowerCase(),
        );
        if (client) {
          clientIds.push(client.id);
        }
      }
      if (clientIds.length > 0) {
        const clientRelations = clientIds.map((clientId) => ({
          recipeId,
          clientId,
        }));
        await db.insert(dddevRecipeClientRelation).values(clientRelations);
      }
    }

    // Fetch the inserted ingredients
    const createdIngredients = await db
      .select()
      .from(dddevRecipeIngredient)
      .where(eq(dddevRecipeIngredient.recipeId, recipeId));

    // Fetch the complete recipe
    const [createdRecipe] = await db
      .select()
      .from(dddevRecipe)
      .where(eq(dddevRecipe.id, recipeId));

    if (!createdRecipe) {
      return {
        success: false,
        error: 'Recipe was inserted but could not be retrieved' as const,
      };
    }

    return { success: true, createdRecipe, createdIngredients };
  } catch (e) {
    console.error('Create recipe failed', e);
    if (e instanceof Error) {
      return {
        success: false,
        error: `Failed to create recipe: ${e.message}` as const,
      };
    } else {
      return { success: false, error: 'Failed to create recipe' as const };
    }
  }
}
