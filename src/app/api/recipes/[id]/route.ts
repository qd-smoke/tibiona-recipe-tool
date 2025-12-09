import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  dddevRecipe,
  dddevRecipeIngredient,
  dddevRecipeCost,
  dddevRecipeOvenTemperature,
  dddevRecipeMixingTime,
  dddevProduction,
  dddevRecipeVersion,
  dddevRecipeHistory,
  dddevProductionIngredient,
  dddevIngredientLots,
} from '@/db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import {
  MagentoRecipe,
  MagentoRecipeIngredient,
  CostType,
  ChangeType,
} from '@/types';
import {
  getSessionTokenFromCookies,
  verifySessionToken,
} from '@/lib/auth/session';
import { toNumberFields } from '@/lib/utils/standard-values';

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

async function getCurrentUserId(): Promise<number | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session || !Number.isFinite(session.userId)) return null;
  return session.userId;
}

// Helper to compare values and detect changes
function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const sanitized = value.trim().replace(',', '.');
    if (!sanitized) return null;
    const parsed = Number(sanitized);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function hasChanged(oldVal: unknown, newVal: unknown): boolean {
  if (oldVal === newVal) return false;
  if (oldVal === null || oldVal === undefined) {
    return newVal !== null && newVal !== undefined;
  }
  if (newVal === null || newVal === undefined) return true;

  const oldNum = parseNumber(oldVal);
  const newNum = parseNumber(newVal);
  if (oldNum !== null && newNum !== null) {
    return Math.abs(oldNum - newNum) > 0.0001;
  }

  return String(oldVal).trim() !== String(newVal).trim();
}

// Drizzle returns DECIMAL as string at runtime on some drivers; normalize to number
// toNumberFields is now imported from @/lib/utils/standard-values

const recipeDecimalKeys = [
  'marginPercent',
  'sellingPrice',
  'totalQtyForRecipe',
  'wastePercent',
  'waterPercent',
  'packageWeight',
  'numberOfPackages',
  'timeMinutes',
  'temperatureCelsius',
  'heightCm',
  'widthCm',
  'lengthCm',
  'cookieWeightCookedG',
  'mixerCapacityKg',
  'traysCapacityKg',
  'depositorCapacityKg',
  'traysPerOvenLoad',
  'boxCapacity',
  'cartCapacity',
  'laboratoryHumidityPercent',
  'externalTemperatureC',
] as const;

const ingredientDecimalKeys = [
  'qtyOriginal',
  'priceCostPerKg',
  'kcal',
  'kj',
  'protein',
  'carbo',
  'sugar',
  'fat',
  'saturi',
  'fiber',
  'salt',
  'polioli',
] as const;

// GET /api/recipes/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = parseId(resolvedParams);
  if (!id) {
    console.error('[GET /api/recipes/[id]] Invalid id:', resolvedParams);
    return badRequest('Invalid id');
  }
  console.log('[GET /api/recipes/[id]] Fetching recipe:', id);

  try {
    let recipe;
    try {
      const rows = await db
        .select()
        .from(dddevRecipe)
        .where(eq(dddevRecipe.id, id));

      recipe = rows[0] || null;
      if (!recipe) {
        return notFound();
      }
    } catch (dbError) {
      throw dbError;
    }

    const ingredients = await db
      .select()
      .from(dddevRecipeIngredient)
      .where(eq(dddevRecipeIngredient.recipeId, id));

    // Fetch oven temperatures and mixing times (may not exist if tables not created yet)
    let ovenTemperatures: Array<{
      id: number;
      temperature: number;
      minutes: number;
      order: number;
    }> = [];
    let mixingTimes: Array<{
      id: number;
      minutes: number;
      speed: number;
      order: number;
    }> = [];

    try {
      const ovenTemps = await db
        .select()
        .from(dddevRecipeOvenTemperature)
        .where(eq(dddevRecipeOvenTemperature.recipeId, id))
        .orderBy(asc(dddevRecipeOvenTemperature.order));
      ovenTemperatures = ovenTemps.map((ot) => ({
        id: ot.id,
        temperature: Number(ot.temperature),
        minutes: Number(ot.minutes),
        order: ot.order,
      }));
    } catch {
      // Table doesn't exist yet, return empty array
    }

    try {
      const mixingTms = await db
        .select()
        .from(dddevRecipeMixingTime)
        .where(eq(dddevRecipeMixingTime.recipeId, id))
        .orderBy(asc(dddevRecipeMixingTime.order));
      mixingTimes = mixingTms.map((mt) => ({
        id: mt.id,
        minutes: Number(mt.minutes),
        speed: Number(mt.speed),
        order: mt.order,
      }));
    } catch {
      // Table doesn't exist yet, return empty array
    }

    // Parse colatrice settings JSON if present
    let colatriceSettings: Record<string, unknown> | null = null;
    try {
      if (
        recipe.colatriceSettings &&
        typeof recipe.colatriceSettings === 'string'
      ) {
        colatriceSettings = JSON.parse(recipe.colatriceSettings) as Record<
          string,
          unknown
        >;
      }
    } catch {
      // Invalid JSON, leave as null
    }

    // Normalize recipe data
    const normalizedRecipe = toNumberFields(recipe, recipeDecimalKeys);
    // Ensure cartCapacity is always a number (default to 0 if missing/null/undefined)
    const recipeData = {
      ...normalizedRecipe,
      cartCapacity:
        typeof (normalizedRecipe as Record<string, unknown>).cartCapacity ===
        'number'
          ? ((normalizedRecipe as Record<string, unknown>)
              .cartCapacity as number)
          : 0,
    };

    const payload = {
      recipe: recipeData,
      ingredients: ingredients.map((ing) =>
        toNumberFields(ing, ingredientDecimalKeys),
      ),
      ovenTemperatures,
      mixingTimes,
      colatriceSettings,
    };

    const res = NextResponse.json(payload, { status: 200 });
    res.headers.set(
      'Cache-Control',
      'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
    );
    return res;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to fetch recipe', details: errorMessage },
      { status: 500 },
    );
  }
}

// PUT /api/recipes/[id]
// Body similar to POST. Replaces ingredients with provided array (transactional).
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = parseId(resolvedParams);
  if (!id) return badRequest('Invalid id');

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  try {
    const {
      recipeData,
      ingredientsToRemove = [],
      ingredientsToAdd = [],
      ingredientsToUpdate = [],
      costs = [],
      ovenTemperatures = [],
      mixingTimes = [],
      colatriceSettings,
      isProduction = false,
      productionId,
      ingredientOverrides = [],
    }: {
      recipeData: MagentoRecipe;
      ingredientsToRemove: MagentoRecipeIngredient[];
      ingredientsToAdd: Omit<MagentoRecipeIngredient, 'id' | 'recipeId'>[];
      ingredientsToUpdate: MagentoRecipeIngredient[];
      costs?: Array<{ costType: CostType; value: number }>;
      ovenTemperatures?: Array<{
        id?: number;
        temperature: number;
        minutes: number;
        order: number;
      }>;
      mixingTimes?: Array<{
        id?: number;
        minutes: number;
        speed: number;
        order: number;
      }>;
      colatriceSettings?: Record<string, unknown> | null;
      isProduction?: boolean;
      productionId?: number;
      ingredientOverrides?: Array<{
        ingredientId: number;
        lot?: string;
        productNameOverride?: string;
        mpSkuOverride?: string;
        supplierOverride?: string;
        warehouseLocationOverride?: string;
      }>;
    } = body;

    // Basic validation
    if (!recipeData || typeof recipeData !== 'object') {
      return badRequest('Missing recipeData');
    }

    // Enforce id consistency if provided
    if (
      (recipeData as { id?: number } | null | undefined)?.id &&
      recipeData.id !== id
    ) {
      return badRequest('Body id does not match route id');
    }

    // Get current user ID for history tracking
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Validate production if isProduction is true
    let activeProduction = null;
    let _recipeVersionId: number | null = null;
    if (isProduction && productionId) {
      const [prod] = await db
        .select()
        .from(dddevProduction)
        .where(
          and(
            eq(dddevProduction.id, productionId),
            eq(dddevProduction.recipeId, id),
            eq(dddevProduction.status, 'in_progress'),
          ),
        )
        .limit(1);
      if (!prod) {
        return badRequest('Invalid or inactive production');
      }
      activeProduction = prod;
      _recipeVersionId = prod.recipeVersionId;
    }

    // Perform transactional update
    const updated = await db.transaction(async (tx) => {
      // Ensure recipe exists and get current state
      const existing = await tx
        .select()
        .from(dddevRecipe)
        .where(eq(dddevRecipe.id, id));
      if (!existing[0]) {
        throw new Error('NOT_FOUND');
      }
      const oldRecipe = existing[0];

      // Get current ingredients for comparison
      const oldIngredients = await tx
        .select()
        .from(dddevRecipeIngredient)
        .where(eq(dddevRecipeIngredient.recipeId, id));

      // Get current oven temperatures and mixing times
      let oldOvenTemps: Array<{
        id: number;
        temperature: number;
        minutes: number;
        order: number;
      }> = [];
      let oldMixingTimes: Array<{
        id: number;
        minutes: number;
        speed: number;
        order: number;
      }> = [];

      try {
        const ovenTemps = await tx
          .select()
          .from(dddevRecipeOvenTemperature)
          .where(eq(dddevRecipeOvenTemperature.recipeId, id))
          .orderBy(asc(dddevRecipeOvenTemperature.order));
        oldOvenTemps = ovenTemps.map((ot) => ({
          id: ot.id,
          temperature: Number(ot.temperature),
          minutes: Number(ot.minutes),
          order: ot.order,
        }));
      } catch {
        // Table may not exist
      }

      try {
        const mixingTms = await tx
          .select()
          .from(dddevRecipeMixingTime)
          .where(eq(dddevRecipeMixingTime.recipeId, id))
          .orderBy(asc(dddevRecipeMixingTime.order));
        oldMixingTimes = mixingTms.map((mt) => ({
          id: mt.id,
          minutes: Number(mt.minutes),
          speed: Number(mt.speed),
          order: mt.order,
        }));
      } catch {
        // Table may not exist
      }

      // Prepare recipe update data with colatrice settings
      const recipeUpdateData = {
        ...recipeData,
        colatriceSettings:
          colatriceSettings !== undefined && colatriceSettings !== null
            ? JSON.stringify(colatriceSettings)
            : null,
      };

      // Update recipe
      await tx
        .update(dddevRecipe)
        .set(recipeUpdateData)
        .where(eq(dddevRecipe.id, id));

      // Delete ingredients to remove
      for (const ing of ingredientsToRemove) {
        await tx
          .delete(dddevRecipeIngredient)
          .where(eq(dddevRecipeIngredient.id, ing.id));
      }

      // Insert ingredients to add
      if (ingredientsToAdd.length > 0) {
        const addValues = ingredientsToAdd.map((ing) => {
          const cleanIng = {
            ...ing,
            recipeId: id,
            // Ensure lot is null if empty string
            lot: ing.lot && ing.lot.trim() ? ing.lot.trim() : null,
            // Ensure done is 0 or 1
            done: ing.done ? 1 : 0,
            // Ensure checkGlutine is 0 or 1
            checkGlutine: ing.checkGlutine ? 1 : 0,
          };
          return cleanIng;
        }) as Omit<MagentoRecipeIngredient, 'id'>[];
        await tx.insert(dddevRecipeIngredient).values(addValues);

        // Save lots to dddev_ingredient_lots table
        for (const ing of ingredientsToAdd) {
          if (ing.lot && ing.lot.trim() && ing.sku) {
            const trimmedLot = ing.lot.trim();
            const trimmedSku = ing.sku.trim();
            try {
              // Check if lot already exists
              const [existing] = await tx
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
                await tx
                  .update(dddevIngredientLots)
                  .set({
                    lastUsedAt: new Date()
                      .toISOString()
                      .slice(0, 19)
                      .replace('T', ' '),
                  })
                  .where(eq(dddevIngredientLots.id, existing.id));
              } else {
                // Create new lot
                await tx.insert(dddevIngredientLots).values({
                  sku: trimmedSku,
                  lot: trimmedLot,
                });
              }
            } catch (error) {
              // Log error but don't fail the transaction
              console.error(
                `Failed to save lot ${trimmedLot} for SKU ${trimmedSku}:`,
                error,
              );
            }
          }
        }
      }

      // Update existing ingredients (match by recipeId + sku to avoid missing id issues)
      for (const ing of ingredientsToUpdate) {
        const ingTyped = ing as MagentoRecipeIngredient;

        // Build update data explicitly with all fields
        const updateData = {
          sku: ingTyped.sku,
          name: ingTyped.name,
          qtyOriginal: ingTyped.qtyOriginal,
          priceCostPerKg: ingTyped.priceCostPerKg,
          isPowderIngredient: ingTyped.isPowderIngredient,
          supplier: ingTyped.supplier || null,
          warehouseLocation: ingTyped.warehouseLocation || null,
          mpSku: ingTyped.mpSku || null,
          productName: ingTyped.productName || null,
          lot: (ingTyped.lot as string | null | undefined)?.trim() || null,
          done: ingTyped.done ? 1 : 0,
          checkGlutine: ingTyped.checkGlutine ? 1 : 0,
          kcal: ingTyped.kcal || 0,
          kj: ingTyped.kj || 0,
          protein: ingTyped.protein || 0,
          carbo: ingTyped.carbo || 0,
          sugar: ingTyped.sugar || 0,
          fat: ingTyped.fat || 0,
          saturi: ingTyped.saturi || 0,
          fiber: ingTyped.fiber || 0,
          salt: ingTyped.salt || 0,
          polioli: ingTyped.polioli || 0,
        };

        await tx
          .update(dddevRecipeIngredient)
          .set(updateData)
          .where(
            and(
              eq(dddevRecipeIngredient.recipeId, id),
              eq(dddevRecipeIngredient.sku, ingTyped.sku),
            ),
          );

        // Save lot to dddev_ingredient_lots table
        if (updateData.lot && ingTyped.sku) {
          const trimmedSku = ingTyped.sku.trim();
          try {
            // Check if lot already exists
            const [existing] = await tx
              .select()
              .from(dddevIngredientLots)
              .where(
                and(
                  eq(dddevIngredientLots.sku, trimmedSku),
                  eq(dddevIngredientLots.lot, updateData.lot),
                ),
              )
              .limit(1);

            if (existing) {
              // Update last_used_at
              await tx
                .update(dddevIngredientLots)
                .set({
                  lastUsedAt: new Date()
                    .toISOString()
                    .slice(0, 19)
                    .replace('T', ' '),
                })
                .where(eq(dddevIngredientLots.id, existing.id));
            } else {
              // Create new lot
              await tx.insert(dddevIngredientLots).values({
                sku: trimmedSku,
                lot: updateData.lot,
              });
            }
          } catch (error) {
            // Log error but don't fail the transaction
            console.error(
              `Failed to save lot ${updateData.lot} for SKU ${trimmedSku}:`,
              error,
            );
          }
        }
      }

      // Save oven temperatures (replace all) - only if tables exist
      if (Array.isArray(ovenTemperatures)) {
        try {
          await tx
            .delete(dddevRecipeOvenTemperature)
            .where(eq(dddevRecipeOvenTemperature.recipeId, id));
          if (ovenTemperatures.length > 0) {
            await tx.insert(dddevRecipeOvenTemperature).values(
              ovenTemperatures.map((ot) => ({
                recipeId: id,
                temperature: ot.temperature,
                minutes: ot.minutes,
                order: ot.order,
              })),
            );
          }
        } catch (e) {
          console.warn(
            'Failed to save oven temperatures (table may not exist):',
            e,
          );
          // Table doesn't exist yet, skip
        }
      }

      // Save mixing times (replace all) - only if tables exist
      if (Array.isArray(mixingTimes)) {
        try {
          await tx
            .delete(dddevRecipeMixingTime)
            .where(eq(dddevRecipeMixingTime.recipeId, id));
          if (mixingTimes.length > 0) {
            await tx.insert(dddevRecipeMixingTime).values(
              mixingTimes.map((mt) => ({
                recipeId: id,
                minutes: mt.minutes,
                speed: mt.speed,
                order: mt.order,
              })),
            );
          }
        } catch (e) {
          console.warn('Failed to save mixing times (table may not exist):', e);
          // Table doesn't exist yet, skip
        }
      }

      // Save recipe costs
      if (Array.isArray(costs) && costs.length > 0) {
        for (const cost of costs) {
          // Check if recipe-specific cost exists
          const existing = await tx
            .select()
            .from(dddevRecipeCost)
            .where(
              and(
                eq(dddevRecipeCost.recipeId, id),
                eq(dddevRecipeCost.costType, cost.costType),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            // Update existing
            await tx
              .update(dddevRecipeCost)
              .set({ value: cost.value })
              .where(
                and(
                  eq(dddevRecipeCost.recipeId, id),
                  eq(dddevRecipeCost.costType, cost.costType),
                ),
              );
          } else {
            // Insert new
            await tx.insert(dddevRecipeCost).values({
              recipeId: id,
              costType: cost.costType,
              value: cost.value,
            });
          }
        }
      }

      // Get updated recipe and ingredients for comparison
      const after = await tx
        .select()
        .from(dddevRecipe)
        .where(eq(dddevRecipe.id, id));
      const newRecipe = after[0] as MagentoRecipe;

      const newIngredients = await tx
        .select()
        .from(dddevRecipeIngredient)
        .where(eq(dddevRecipeIngredient.recipeId, id));

      // Track changes and create history entries
      const changeType: ChangeType = isProduction ? 'production' : 'admin';
      const historyEntries: Array<{
        recipeId: number;
        recipeVersionId: number | null;
        productionId: number | null;
        userId: number;
        changeType: ChangeType;
        fieldName: string | null;
        oldValue: string | null;
        newValue: string | null;
        changeDescription: string;
      }> = [];

      // Track recipe field changes
      const recipeFields: Array<keyof typeof oldRecipe> = [
        'name',
        'notes',
        'totalQtyForRecipe',
        'wastePercent',
        'waterPercent',
        'packageWeight',
        'numberOfPackages',
        'timeMinutes',
        'temperatureCelsius',
        'heightCm',
        'widthCm',
        'lengthCm',
        'cookieWeightCookedG',
        'mixerCapacityKg',
        'traysCapacityKg',
        'depositorCapacityKg',
        'traysPerOvenLoad',
        'steamMinutes',
        'valveOpenMinutes',
        'valveCloseMinutes',
        'glutenTestDone',
      ];

      for (const field of recipeFields) {
        const oldVal = oldRecipe[field];
        const newVal = newRecipe[field];
        if (hasChanged(oldVal, newVal)) {
          historyEntries.push({
            recipeId: id,
            recipeVersionId: null, // Will be set if version is created
            productionId: isProduction && productionId ? productionId : null,
            userId,
            changeType,
            fieldName: field,
            oldValue:
              oldVal !== null && oldVal !== undefined ? String(oldVal) : null,
            newValue:
              newVal !== null && newVal !== undefined ? String(newVal) : null,
            changeDescription: `Changed ${field} from ${oldVal ?? 'null'} to ${newVal ?? 'null'}`,
          });
        }
      }

      // Track ingredient changes
      if (ingredientsToRemove.length > 0) {
        for (const ing of ingredientsToRemove) {
          historyEntries.push({
            recipeId: id,
            recipeVersionId: null,
            productionId: isProduction && productionId ? productionId : null,
            userId,
            changeType,
            fieldName: 'ingredient',
            oldValue: JSON.stringify(ing),
            newValue: null,
            changeDescription: `Removed ingredient: ${ing.name} (SKU: ${ing.sku})`,
          });
        }
      }

      if (ingredientsToAdd.length > 0) {
        for (const ing of ingredientsToAdd) {
          historyEntries.push({
            recipeId: id,
            recipeVersionId: null,
            productionId: isProduction && productionId ? productionId : null,
            userId,
            changeType,
            fieldName: 'ingredient',
            oldValue: null,
            newValue: JSON.stringify(ing),
            changeDescription: `Added ingredient: ${ing.name} (SKU: ${ing.sku})`,
          });
        }
      }

      // Track ingredient updates
      for (const newIng of ingredientsToUpdate) {
        const oldIng = oldIngredients.find((ing) => ing.sku === newIng.sku);
        if (oldIng) {
          // Check for changes in ingredient fields
          const ingFields: Array<keyof typeof oldIng> = [
            'name',
            'qtyOriginal',
            'priceCostPerKg',
            'isPowderIngredient',
            'supplier',
            'warehouseLocation',
            'mpSku',
            'productName',
            'lot',
            'done',
            'checkGlutine',
          ];
          for (const field of ingFields) {
            const oldVal = oldIng[field];
            const newVal = newIng[field];
            if (hasChanged(oldVal, newVal)) {
              historyEntries.push({
                recipeId: id,
                recipeVersionId: null,
                productionId:
                  isProduction && productionId ? productionId : null,
                userId,
                changeType,
                fieldName: `ingredient.${field}`,
                oldValue:
                  oldVal !== null && oldVal !== undefined
                    ? String(oldVal)
                    : null,
                newValue:
                  newVal !== null && newVal !== undefined
                    ? String(newVal)
                    : null,
                changeDescription: `Updated ingredient ${oldIng.name} (SKU: ${oldIng.sku}): ${field} from ${oldVal ?? 'null'} to ${newVal ?? 'null'}`,
              });
            }
          }
        }
      }

      // Track oven temperature changes
      const ovenTempsChanged =
        JSON.stringify(oldOvenTemps) !== JSON.stringify(ovenTemperatures);
      if (ovenTempsChanged) {
        historyEntries.push({
          recipeId: id,
          recipeVersionId: null,
          productionId: isProduction && productionId ? productionId : null,
          userId,
          changeType,
          fieldName: 'ovenTemperatures',
          oldValue: JSON.stringify(oldOvenTemps),
          newValue: JSON.stringify(ovenTemperatures),
          changeDescription: 'Updated oven temperatures',
        });
      }

      // Track mixing time changes
      const mixingTimesChanged =
        JSON.stringify(oldMixingTimes) !== JSON.stringify(mixingTimes);
      if (mixingTimesChanged) {
        historyEntries.push({
          recipeId: id,
          recipeVersionId: null,
          productionId: isProduction && productionId ? productionId : null,
          userId,
          changeType,
          fieldName: 'mixingTimes',
          oldValue: JSON.stringify(oldMixingTimes),
          newValue: JSON.stringify(mixingTimes),
          changeDescription: 'Updated mixing times',
        });
      }

      // If production and there are changes, create new version
      let newVersionId: number | null = null;
      if (isProduction && activeProduction && historyEntries.length > 0) {
        // Get next version number
        const [latestVersion] = await tx
          .select()
          .from(dddevRecipeVersion)
          .where(eq(dddevRecipeVersion.recipeId, id))
          .orderBy(desc(dddevRecipeVersion.versionNumber))
          .limit(1);

        const nextVersionNumber = latestVersion
          ? latestVersion.versionNumber + 1
          : 1;

        // Get current oven temperatures and mixing times from saved data
        const currentOvenTemps = ovenTemperatures.map((ot) => ({
          temperature: ot.temperature,
          minutes: ot.minutes,
          order: ot.order,
        }));
        const currentMixingTimes = mixingTimes.map((mt) => ({
          minutes: mt.minutes,
          speed: mt.speed,
          order: mt.order,
        }));

        // Create snapshot with oven temperatures and mixing times
        const recipeSnapshot = JSON.stringify({
          ...newRecipe,
          ovenTemperatures: currentOvenTemps,
          mixingTimes: currentMixingTimes,
        });
        const ingredientsSnapshot = JSON.stringify(newIngredients);

        // Create new version
        const [versionResult] = await tx.insert(dddevRecipeVersion).values({
          recipeId: id,
          versionNumber: nextVersionNumber,
          createdByUserId: userId,
          recipeSnapshot,
          ingredientsSnapshot,
        });

        newVersionId = versionResult.insertId as number;

        // Add version_created history entry
        historyEntries.push({
          recipeId: id,
          recipeVersionId: newVersionId,
          productionId: productionId || null,
          userId,
          changeType: 'version_created',
          fieldName: null,
          oldValue: null,
          newValue: null,
          changeDescription: `Created new recipe version ${nextVersionNumber} during production`,
        });

        // Update all history entries with version ID
        for (const entry of historyEntries) {
          entry.recipeVersionId = newVersionId;
        }
      }

      // Save history entries
      if (historyEntries.length > 0) {
        await tx.insert(dddevRecipeHistory).values(historyEntries);
      }

      // Save ingredient overrides if production
      if (isProduction && productionId && ingredientOverrides.length > 0) {
        for (const override of ingredientOverrides) {
          // Check if override already exists
          const [existing] = await tx
            .select()
            .from(dddevProductionIngredient)
            .where(
              and(
                eq(dddevProductionIngredient.productionId, productionId),
                eq(
                  dddevProductionIngredient.ingredientId,
                  override.ingredientId,
                ),
              ),
            )
            .limit(1);

          if (existing) {
            // Update existing
            await tx
              .update(dddevProductionIngredient)
              .set({
                lot: override.lot?.trim() || null,
                productNameOverride:
                  override.productNameOverride?.trim() || null,
                mpSkuOverride: override.mpSkuOverride?.trim() || null,
                supplierOverride: override.supplierOverride?.trim() || null,
                warehouseLocationOverride:
                  override.warehouseLocationOverride?.trim() || null,
              })
              .where(eq(dddevProductionIngredient.id, existing.id));
          } else {
            // Insert new
            await tx.insert(dddevProductionIngredient).values({
              productionId,
              ingredientId: override.ingredientId,
              lot: override.lot?.trim() || null,
              productNameOverride: override.productNameOverride?.trim() || null,
              mpSkuOverride: override.mpSkuOverride?.trim() || null,
              supplierOverride: override.supplierOverride?.trim() || null,
              warehouseLocationOverride:
                override.warehouseLocationOverride?.trim() || null,
            });
          }
        }
      }

      return {
        recipe: newRecipe,
        versionId: newVersionId,
        historyCount: historyEntries.length,
      };
    });

    const normalized = toNumberFields(updated.recipe, recipeDecimalKeys);
    return NextResponse.json(
      {
        createdRecipe: normalized,
        versionId: updated.versionId,
        historyCount: updated.historyCount,
      },
      { status: 200 },
    );
  } catch (e: unknown) {
    if ((e as { message?: string } | null | undefined)?.message === 'NOT_FOUND')
      return notFound();
    console.error('Update recipe failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack, error: e });
    return NextResponse.json(
      { error: 'Failed to update recipe', details: errorMessage },
      { status: 500 },
    );
  }
}

// DELETE /api/recipes/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = parseId(resolvedParams);
  if (!id) return badRequest('Invalid id');

  try {
    await db.delete(dddevRecipe).where(eq(dddevRecipe.id, id));

    // onDelete: Cascade will remove ingredients
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: unknown) {
    if ((e as { code?: string } | null | undefined)?.code === 'P2025')
      return notFound();
    console.error('Delete recipe failed', e);
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 },
    );
  }
}
