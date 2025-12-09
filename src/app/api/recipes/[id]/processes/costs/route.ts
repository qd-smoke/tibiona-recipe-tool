import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  dddevRecipeProcess,
  dddevProcess,
  dddevRecipeProcessCost,
  dddevRecipeCost,
  dddevCostStandard,
  dddevRecipe,
  dddevStandardParameters,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canView } from '@/lib/permissions/check';
import type { CostType } from '@/types';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function toNumberFields<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly (keyof T)[],
): T {
  const result = { ...obj };
  for (const key of keys) {
    if (result[key] !== null && result[key] !== undefined) {
      result[key] = Number(result[key]) as T[keyof T];
    }
  }
  return result;
}

// GET /api/recipes/[id]/processes/costs
export async function GET(
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
      return NextResponse.json({ error: 'Invalid recipe ID' }, { status: 400 });
    }

    if (!canView(profile.capabilities, 'recipe.processes.view')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    // Fetch recipe processes
    const recipeProcesses = await db
      .select({
        id: dddevRecipeProcess.id,
        processId: dddevRecipeProcess.processId,
        minutes: dddevRecipeProcess.minutes,
        cycles: dddevRecipeProcess.cycles,
        cycleField: dddevRecipeProcess.cycleField,
        processName: dddevProcess.name,
      })
      .from(dddevRecipeProcess)
      .innerJoin(
        dddevProcess,
        eq(dddevRecipeProcess.processId, dddevProcess.id),
      )
      .where(eq(dddevRecipeProcess.recipeId, recipeId));

    // Fetch costs for all recipe processes
    const recipeProcessIds = recipeProcesses.map((rp) => rp.id);
    let processCostRelations: Array<{
      recipeProcessId: number;
      costType: string;
    }> = [];

    if (recipeProcessIds.length > 0) {
      try {
        const fetchedCosts = await db
          .select({
            recipeProcessId: dddevRecipeProcessCost.recipeProcessId,
            costType: dddevRecipeProcessCost.costType,
          })
          .from(dddevRecipeProcessCost)
          .where(
            inArray(dddevRecipeProcessCost.recipeProcessId, recipeProcessIds),
          );
        processCostRelations = fetchedCosts;
      } catch {
        // If table doesn't exist or other error, return empty array
        processCostRelations = [];
      }
    }

    // Group costs by recipe process ID
    const costsByProcessId = new Map<number, CostType[]>();
    for (const cost of processCostRelations) {
      const existing = costsByProcessId.get(cost.recipeProcessId) || [];
      existing.push(cost.costType as CostType);
      costsByProcessId.set(cost.recipeProcessId, existing);
    }

    // Fetch recipe data for cycle field values
    const [recipe] = await db
      .select()
      .from(dddevRecipe)
      .where(eq(dddevRecipe.id, recipeId))
      .limit(1);

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Fetch standard parameters (for consumptions)
    const standardParameters = await db.select().from(dddevStandardParameters);
    const normalizedParams = standardParameters.map((param) =>
      toNumberFields(param, ['value'] as const),
    );
    const paramMap = new Map<string, number>();
    for (const param of normalizedParams) {
      paramMap.set(param.parameterType, param.value as number);
    }

    if (recipeProcesses.length === 0) {
      return NextResponse.json(
        { totalCost: 0, processCosts: [] },
        { status: 200 },
      );
    }

    // Fetch standard costs
    const standardCosts = await db.select().from(dddevCostStandard);
    const normalizedStandard = standardCosts.map((cost) =>
      toNumberFields(cost, ['value'] as const),
    );

    // Fetch recipe-specific costs
    const recipeCosts = await db
      .select()
      .from(dddevRecipeCost)
      .where(eq(dddevRecipeCost.recipeId, recipeId));
    const normalizedRecipe = recipeCosts.map((cost) =>
      toNumberFields(cost, ['value'] as const),
    );

    // Create cost map: recipe costs override standard costs
    const costMap = new Map<CostType, number>();
    for (const standard of normalizedStandard) {
      costMap.set(standard.costType as CostType, standard.value as number);
    }
    for (const recipeCost of normalizedRecipe) {
      costMap.set(recipeCost.costType as CostType, recipeCost.value as number);
    }

    // Calculate costs for each process
    const hourlyLaborCost = costMap.get('hourly_labor') || 0;
    const costoElettricita = costMap.get('costoElettricita') || 0;

    // Helper function to calculate cycles based on cycleField
    const calculateCycles = (
      cycleField: string | null | undefined,
      recipeData: Record<string, unknown>,
    ): number => {
      if (!cycleField || !recipeData) return 1;

      if (cycleField === 'singleCycle') return 1;

      // Direct field access
      const directValue = (recipeData as Record<string, unknown>)[cycleField];
      if (typeof directValue === 'number' && Number.isFinite(directValue)) {
        return directValue;
      }

      // Calculated fields
      const totalQty =
        Number((recipeData as Record<string, unknown>).totalQtyForRecipe) || 0;
      const cookieWeight =
        Number((recipeData as Record<string, unknown>).cookieWeightCookedG) ||
        0;
      const traysCapacity =
        Number((recipeData as Record<string, unknown>).traysCapacityKg) || 0;

      switch (cycleField) {
        case 'numberOfCookies':
          return totalQty > 0 && cookieWeight > 0
            ? Math.round(totalQty / cookieWeight)
            : 1;

        case 'numberOfTrays':
          if (totalQty > 0 && cookieWeight > 0 && traysCapacity > 0) {
            const cookiesCount = Math.round(totalQty / cookieWeight);
            return Math.round(cookiesCount / traysCapacity);
          }
          return 1;

        case 'numberOfMixingCycles': {
          const totalQtyKg = totalQty / 1000;
          const mixerCapacity =
            Number((recipeData as Record<string, unknown>).mixerCapacityKg) ||
            0;
          return totalQtyKg > 0 && mixerCapacity > 0
            ? Math.round(totalQtyKg / mixerCapacity)
            : 1;
        }

        case 'numberOfDepositorCycles': {
          const totalQtyKg = totalQty / 1000;
          const depositorCapacity =
            Number(
              (recipeData as Record<string, unknown>).depositorCapacityKg,
            ) || 0;
          return totalQtyKg > 0 && depositorCapacity > 0
            ? Math.round(totalQtyKg / depositorCapacity)
            : 1;
        }

        case 'numberOfOvenLoads': {
          const traysPerOven =
            Number((recipeData as Record<string, unknown>).traysPerOvenLoad) ||
            0;
          if (
            totalQty > 0 &&
            cookieWeight > 0 &&
            traysCapacity > 0 &&
            traysPerOven > 0
          ) {
            const cookiesCount = Math.round(totalQty / cookieWeight);
            const traysCount = Math.round(cookiesCount / traysCapacity);
            return Math.round(traysCount / traysPerOven);
          }
          return 1;
        }

        case 'numberOfBoxes': {
          const numberOfPackages =
            Number((recipeData as Record<string, unknown>).numberOfPackages) ||
            0;
          const boxCapacity =
            Number((recipeData as Record<string, unknown>).boxCapacity) || 0;
          return numberOfPackages > 0 && boxCapacity > 0
            ? Math.round(numberOfPackages / boxCapacity)
            : 1;
        }

        case 'numberOfCarts': {
          const cartCapacity =
            Number((recipeData as Record<string, unknown>).cartCapacity) || 0;
          if (
            totalQty > 0 &&
            cookieWeight > 0 &&
            traysCapacity > 0 &&
            cartCapacity > 0
          ) {
            const cookiesCount = Math.round(totalQty / cookieWeight);
            const traysCount = Math.round(cookiesCount / traysCapacity);
            return Math.round(traysCount / cartCapacity);
          }
          return 1;
        }

        case 'numberOfPackages': {
          const numberOfPackages =
            Number((recipeData as Record<string, unknown>).numberOfPackages) ||
            0;
          return numberOfPackages > 0 ? numberOfPackages : 1;
        }

        default:
          return 1;
      }
    };

    const processCosts = recipeProcesses.map((rp) => {
      const minutes = Number(rp.minutes) || 0;
      const cycles = rp.cycleField
        ? calculateCycles(rp.cycleField, recipe as Record<string, unknown>)
        : rp.cycles || 1;
      let totalCost = 0;

      // Get all cost types for this process
      const costTypes = costsByProcessId.get(rp.id) || [];

      // If no costs are associated, default to hourly_labor
      if (costTypes.length === 0) {
        // Default: use hourly labor cost
        // Formula: (costo personale / 60) * minuti * cicli
        totalCost = (hourlyLaborCost / 60) * minutes * cycles;
      } else {
        // Calculate cost for each cost type and sum them
        for (const costType of costTypes) {
          let costForType = 0;

          if (costType === 'hourly_labor') {
            // Use hourly labor cost
            // Formula: (costo personale / 60) * minuti * cicli
            costForType = (hourlyLaborCost / 60) * minutes * cycles;
          } else {
            // Use consumption-based calculation
            // Get consumption value from standard parameters
            const consumption = paramMap.get(costType) || 0;
            // Get electricity cost
            // Formula: consumo_kw * (minuti / 60) * costo_elettricita_per_kwh
            // Note: Electricity consumption is per time unit, not per cycle
            costForType = consumption * (minutes / 60) * costoElettricita;
          }

          totalCost += costForType;
        }
      }

      return {
        processId: rp.processId,
        processName: rp.processName,
        minutes,
        cycles,
        cost: Math.round(totalCost * 100) / 100, // Round to 2 decimal places
      };
    });

    const totalCost = processCosts.reduce((sum, pc) => sum + pc.cost, 0);

    return NextResponse.json(
      {
        totalCost: Math.round(totalCost * 100) / 100,
        processCosts,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('[api/recipes/[id]/processes/costs] GET error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to calculate process costs', details: errorMessage },
      { status: 500 },
    );
  }
}
