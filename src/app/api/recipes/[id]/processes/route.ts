import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  dddevRecipeProcess,
  dddevProcess,
  dddevRecipeProcessCost,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { RecipeProcess, CostType } from '@/types';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canView, canEdit } from '@/lib/permissions/check';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

// GET /api/recipes/[id]/processes
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

    // Fetch recipe processes with process names
    const recipeProcesses = await db
      .select({
        id: dddevRecipeProcess.id,
        recipeId: dddevRecipeProcess.recipeId,
        processId: dddevRecipeProcess.processId,
        minutes: dddevRecipeProcess.minutes,
        cycles: dddevRecipeProcess.cycles,
        cycleField: dddevRecipeProcess.cycleField,
        createdAt: dddevRecipeProcess.createdAt,
        updatedAt: dddevRecipeProcess.updatedAt,
        processName: dddevProcess.name,
        processOrder: dddevProcess.order,
      })
      .from(dddevRecipeProcess)
      .innerJoin(
        dddevProcess,
        eq(dddevRecipeProcess.processId, dddevProcess.id),
      )
      .where(eq(dddevRecipeProcess.recipeId, recipeId))
      .orderBy(dddevProcess.order, dddevProcess.name);

    // Fetch costs for all recipe processes
    const recipeProcessIds = recipeProcesses.map((rp) => rp.id);
    const processCosts =
      recipeProcessIds.length > 0
        ? await db
            .select({
              recipeProcessId: dddevRecipeProcessCost.recipeProcessId,
              costType: dddevRecipeProcessCost.costType,
            })
            .from(dddevRecipeProcessCost)
            .where(
              inArray(dddevRecipeProcessCost.recipeProcessId, recipeProcessIds),
            )
        : [];

    // Group costs by recipe process ID
    const costsByProcessId = new Map<number, CostType[]>();
    for (const cost of processCosts) {
      const existing = costsByProcessId.get(cost.recipeProcessId) || [];
      existing.push(cost.costType as CostType);
      costsByProcessId.set(cost.recipeProcessId, existing);
    }

    const processes: RecipeProcess[] = recipeProcesses.map((rp) => ({
      id: rp.id,
      recipeId: rp.recipeId,
      processId: rp.processId,
      minutes: Number(rp.minutes),
      cycles: rp.cycles,
      costTypes: costsByProcessId.get(rp.id) || [],
      cycleField: rp.cycleField || null,
      createdAt: rp.createdAt,
      updatedAt: rp.updatedAt,
      processName: rp.processName,
    }));

    return NextResponse.json({ processes }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/[id]/processes] GET error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to fetch recipe processes', details: errorMessage },
      { status: 500 },
    );
  }
}

// PUT /api/recipes/[id]/processes
// Body: { processes: Array<{ processId: number, minutes: number, cycles: number, costTypes?: CostType[], cycleField?: string | null }> }
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
      return NextResponse.json({ error: 'Invalid recipe ID' }, { status: 400 });
    }

    if (!canEdit(profile.capabilities, 'recipe.processes.edit')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { processes } = body;

    if (!Array.isArray(processes)) {
      return NextResponse.json(
        { error: 'Processes must be an array' },
        { status: 400 },
      );
    }

    // Validate each process entry
    for (const proc of processes) {
      if (
        typeof proc.processId !== 'number' ||
        !Number.isFinite(proc.processId) ||
        proc.processId <= 0
      ) {
        return NextResponse.json(
          { error: 'Invalid processId in processes array' },
          { status: 400 },
        );
      }
      if (
        typeof proc.minutes !== 'number' ||
        !Number.isFinite(proc.minutes) ||
        proc.minutes < 0
      ) {
        return NextResponse.json(
          { error: 'Invalid minutes value in processes array' },
          { status: 400 },
        );
      }
      if (
        typeof proc.cycles !== 'number' ||
        !Number.isFinite(proc.cycles) ||
        proc.cycles < 1
      ) {
        return NextResponse.json(
          { error: 'Invalid cycles value in processes array (must be >= 1)' },
          { status: 400 },
        );
      }
    }

    // Update in transaction
    await db.transaction(async (tx) => {
      // Delete existing processes for this recipe (cascade will delete costs)
      await tx
        .delete(dddevRecipeProcess)
        .where(eq(dddevRecipeProcess.recipeId, recipeId));

      // Insert new processes
      if (processes.length > 0) {
        await tx.insert(dddevRecipeProcess).values(
          processes.map(
            (proc: {
              processId: number;
              minutes: number;
              cycles: number;
              costTypes?: CostType[];
              cycleField?: string | null;
            }) => ({
              recipeId,
              processId: proc.processId,
              minutes: proc.minutes,
              cycles: proc.cycles,
              cycleField: proc.cycleField || null,
            }),
          ),
        );

        // Fetch inserted processes to get their IDs
        const insertedProcesses = await tx
          .select({
            id: dddevRecipeProcess.id,
            processId: dddevRecipeProcess.processId,
          })
          .from(dddevRecipeProcess)
          .where(eq(dddevRecipeProcess.recipeId, recipeId));

        // Create a map of processId -> recipeProcessId
        const processIdMap = new Map<number, number>();
        for (const ip of insertedProcesses) {
          processIdMap.set(ip.processId, ip.id);
        }

        // Insert costs for each process
        for (const proc of processes) {
          const recipeProcessId = processIdMap.get(proc.processId);
          if (recipeProcessId && proc.costTypes && proc.costTypes.length > 0) {
            // Remove duplicates and validate
            const uniqueCostTypes = Array.from(
              new Set(
                proc.costTypes.filter(
                  (ct: unknown) =>
                    ct && typeof ct === 'string' && ct.trim() !== '',
                ),
              ),
            ) as CostType[];

            if (uniqueCostTypes.length > 0) {
              await tx.insert(dddevRecipeProcessCost).values(
                uniqueCostTypes.map((costType) => ({
                  recipeProcessId,
                  costType,
                })),
              );
            }
          }
        }
      }
    });

    // Fetch updated processes (same logic as GET)
    const updatedProcesses = await db
      .select({
        id: dddevRecipeProcess.id,
        recipeId: dddevRecipeProcess.recipeId,
        processId: dddevRecipeProcess.processId,
        minutes: dddevRecipeProcess.minutes,
        cycles: dddevRecipeProcess.cycles,
        cycleField: dddevRecipeProcess.cycleField,
        createdAt: dddevRecipeProcess.createdAt,
        updatedAt: dddevRecipeProcess.updatedAt,
        processName: dddevProcess.name,
        processOrder: dddevProcess.order,
      })
      .from(dddevRecipeProcess)
      .innerJoin(
        dddevProcess,
        eq(dddevRecipeProcess.processId, dddevProcess.id),
      )
      .where(eq(dddevRecipeProcess.recipeId, recipeId))
      .orderBy(dddevProcess.order, dddevProcess.name);

    // Fetch costs for updated processes
    const updatedProcessIds = updatedProcesses.map((rp) => rp.id);
    const updatedProcessCosts =
      updatedProcessIds.length > 0
        ? await db
            .select({
              recipeProcessId: dddevRecipeProcessCost.recipeProcessId,
              costType: dddevRecipeProcessCost.costType,
            })
            .from(dddevRecipeProcessCost)
            .where(
              inArray(
                dddevRecipeProcessCost.recipeProcessId,
                updatedProcessIds,
              ),
            )
        : [];

    // Group costs by recipe process ID
    const updatedCostsByProcessId = new Map<number, CostType[]>();
    for (const cost of updatedProcessCosts) {
      const existing = updatedCostsByProcessId.get(cost.recipeProcessId) || [];
      existing.push(cost.costType as CostType);
      updatedCostsByProcessId.set(cost.recipeProcessId, existing);
    }

    const result: RecipeProcess[] = updatedProcesses.map((rp) => ({
      id: rp.id,
      recipeId: rp.recipeId,
      processId: rp.processId,
      minutes: Number(rp.minutes),
      cycles: rp.cycles,
      costTypes: updatedCostsByProcessId.get(rp.id) || [],
      cycleField: rp.cycleField || null,
      createdAt: rp.createdAt,
      updatedAt: rp.updatedAt,
      processName: rp.processName,
    }));

    return NextResponse.json({ processes: result }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/[id]/processes] PUT error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to update recipe processes', details: errorMessage },
      { status: 500 },
    );
  }
}
