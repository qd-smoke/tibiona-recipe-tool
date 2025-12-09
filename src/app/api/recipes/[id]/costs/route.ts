import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevRecipeCost, dddevCostStandard } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import type { CostType, RecipeCostWithStandard } from '@/types';
import { COST_TYPE_LABELS } from '@/types';
import { toNumberFields } from '@/lib/utils/standard-values';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

const recipeCostDecimalKeys = ['value'] as const;

// GET /api/recipes/[id]/costs
// Returns merged standard costs + recipe-specific costs
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = parseId(resolvedParams);
  if (!id) return badRequest('Invalid id');

  try {
    // Fetch standard costs
    const standardCosts = await db.select().from(dddevCostStandard);
    const normalizedStandard = standardCosts.map((cost) =>
      toNumberFields(cost, recipeCostDecimalKeys),
    );

    // Fetch recipe-specific costs
    const recipeCosts = await db
      .select()
      .from(dddevRecipeCost)
      .where(eq(dddevRecipeCost.recipeId, id));
    const normalizedRecipe = recipeCosts.map((cost) =>
      toNumberFields(cost, recipeCostDecimalKeys),
    );

    // Merge: recipe costs override standard costs
    const costMap = new Map<CostType, RecipeCostWithStandard>();
    const allCostTypes: CostType[] = Object.keys(
      COST_TYPE_LABELS,
    ) as CostType[];

    // First, add all standard costs
    for (const standard of normalizedStandard) {
      costMap.set(standard.costType as CostType, {
        costType: standard.costType as CostType,
        value: standard.value as number,
        isStandard: true,
        standardValue: standard.value as number,
      });
    }

    // Then override with recipe-specific costs
    for (const recipeCost of normalizedRecipe) {
      const standard = normalizedStandard.find(
        (s) => s.costType === recipeCost.costType,
      );
      costMap.set(recipeCost.costType as CostType, {
        costType: recipeCost.costType as CostType,
        value: recipeCost.value as number,
        isStandard: false,
        standardValue: (standard?.value as number) ?? 0,
      });
    }

    // Ensure all cost types are present
    const result: RecipeCostWithStandard[] = allCostTypes.map((costType) => {
      const existing = costMap.get(costType);
      if (existing) return existing;
      return {
        costType,
        value: 0,
        isStandard: true,
        standardValue: 0,
      };
    });

    return NextResponse.json({ costs: result }, { status: 200 });
  } catch (e) {
    console.error('Get recipe costs failed', e);
    return NextResponse.json(
      { error: 'Failed to fetch recipe costs' },
      { status: 500 },
    );
  }
}

// PUT /api/recipes/[id]/costs
// Body: { costs: Array<{ costType: CostType, value: number }> }
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

  const { costs }: { costs: Array<{ costType: CostType; value: number }> } =
    body;

  if (!Array.isArray(costs)) {
    return badRequest('Missing or invalid costs array');
  }

  try {
    await db.transaction(async (tx) => {
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
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('Update recipe costs failed', e);
    return NextResponse.json(
      { error: 'Failed to update recipe costs' },
      { status: 500 },
    );
  }
}
