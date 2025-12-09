import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  dddevRecipe,
  dddevRecipeIngredient,
  dddevRecipeCost,
  dddevStandardParameters,
  dddevCostStandard,
  dddevRecipeCategory,
  dddevRecipeClient,
  dddevRecipeClientRelation,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { toNumberFields } from '@/lib/utils/standard-values';
import type { CostType } from '@/types';
import { COST_TYPE_LABELS } from '@/types';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// GET /api/recipes/[id]/export-json
// Generates JSON for ExcelRx with all recipe fields, parameters, and costs
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = parseId(resolvedParams);
  if (!id) return badRequest('Invalid id');

  try {
    // Fetch recipe
    const [recipe] = await db
      .select()
      .from(dddevRecipe)
      .where(eq(dddevRecipe.id, id))
      .limit(1);

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Fetch ingredients
    const ingredients = await db
      .select()
      .from(dddevRecipeIngredient)
      .where(eq(dddevRecipeIngredient.recipeId, id));

    // Fetch recipe-specific costs
    const recipeCosts = await db
      .select()
      .from(dddevRecipeCost)
      .where(eq(dddevRecipeCost.recipeId, id));

    // Fetch standard parameters (for fallback) - not used in export but kept for future use
    const _standardParameters = await db.select().from(dddevStandardParameters);

    // Fetch standard costs (for fallback)
    const standardCosts = await db.select().from(dddevCostStandard);

    // Normalize recipe
    const recipeDecimalKeys = [
      'totalQtyForRecipe',
      'wastePercent',
      'waterPercent',
      'packageWeight',
      'numberOfPackages',
      'mixerCapacityKg',
      'depositorCapacityKg',
      'traysCapacityKg',
      'cookieWeightCookedG',
      'traysPerOvenLoad',
    ] as const;
    const normalizedRecipe = toNumberFields(recipe, recipeDecimalKeys);

    // Normalize ingredients
    const ingredientDecimalKeys = ['qtyOriginal', 'priceCostPerKg'] as const;
    const normalizedIngredients = ingredients.map((ing) =>
      toNumberFields(ing, ingredientDecimalKeys),
    );

    // Fetch category
    let categoryName: string | null = null;
    if (recipe.categoryId) {
      const [category] = await db
        .select()
        .from(dddevRecipeCategory)
        .where(eq(dddevRecipeCategory.id, recipe.categoryId))
        .limit(1);
      categoryName = category?.name || null;
    }

    // Fetch clients
    const clientRelations = await db
      .select()
      .from(dddevRecipeClientRelation)
      .where(eq(dddevRecipeClientRelation.recipeId, id));

    let clientNames: string[] = [];
    if (clientRelations.length > 0) {
      const clientIds = clientRelations.map((rel) => rel.clientId);
      const clients = await db
        .select()
        .from(dddevRecipeClient)
        .where(inArray(dddevRecipeClient.id, clientIds));
      clientNames = clients.map((c) => c.name);
    }

    // Build JSON object with all fields
    const jsonData: Record<string, unknown> = {
      Ricetta: recipe.name || '',
    };

    // Add SKU if present
    if (recipe.sku) {
      jsonData['SKU'] = recipe.sku;
    }

    // Add category if present
    if (categoryName) {
      jsonData['Categoria'] = categoryName;
    }

    // Add clients if present
    if (clientNames.length > 0) {
      jsonData['Clienti'] = clientNames.join(', ');
    }

    // Add basic recipe fields
    if (normalizedRecipe.packageWeight) {
      jsonData['Peso confezione biscotti'] = normalizedRecipe.packageWeight;
    }
    if (normalizedRecipe.numberOfPackages) {
      jsonData['Numero pacchetti'] = normalizedRecipe.numberOfPackages;
    }
    if (normalizedRecipe.wastePercent) {
      jsonData['Sfrido'] = normalizedRecipe.wastePercent;
    }
    if (normalizedRecipe.waterPercent) {
      jsonData['Acqua in %'] = normalizedRecipe.waterPercent;
    }

    // Add process parameters
    if (normalizedRecipe.mixerCapacityKg) {
      jsonData['Capienza impastatrice'] = normalizedRecipe.mixerCapacityKg;
    }
    if (normalizedRecipe.depositorCapacityKg) {
      jsonData['Capienza colatrice'] = normalizedRecipe.depositorCapacityKg;
    }
    if (normalizedRecipe.traysCapacityKg) {
      jsonData['Capienza teglie'] = normalizedRecipe.traysCapacityKg;
    }
    if (normalizedRecipe.cookieWeightCookedG) {
      jsonData['Peso biscotto cotto'] = normalizedRecipe.cookieWeightCookedG;
    }
    if (normalizedRecipe.traysPerOvenLoad) {
      jsonData['Teglie/Infornate'] = normalizedRecipe.traysPerOvenLoad;
    }

    // Add ingredients
    normalizedIngredients.forEach((ingredient, index) => {
      const num = index + 1;
      jsonData[`Ingrediente ${num}`] = ingredient.name || '';
      jsonData[`Qty Ingrediente ${num}`] = ingredient.qtyOriginal || 0;
      if (ingredient.sku) {
        jsonData[`Codice Ingrediente ${num}`] = ingredient.sku;
      }
    });

    // Add costs (recipe-specific first, then standard as fallback)
    const costMap = new Map<CostType, number>();

    // First add standard costs
    standardCosts.forEach((cost) => {
      const costType = cost.costType as CostType;
      const value = Number(cost.value) || 0;
      costMap.set(costType, value);
    });

    // Override with recipe-specific costs
    recipeCosts.forEach((cost) => {
      const costType = cost.costType as CostType;
      const value = Number(cost.value) || 0;
      costMap.set(costType, value);
    });

    // Add costs to JSON using Italian labels
    costMap.forEach((value, costType) => {
      if (value > 0) {
        const label = COST_TYPE_LABELS[costType];
        jsonData[label] = value;
      }
    });

    return NextResponse.json(jsonData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ricetta-${recipe.name || id}.json"`,
      },
    });
  } catch (e) {
    console.error('Export recipe JSON failed', e);
    return NextResponse.json(
      { error: 'Failed to export recipe JSON' },
      { status: 500 },
    );
  }
}
