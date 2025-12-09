import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  dddevRecipeProcessTracking,
  dddevProcess,
  dddevProduction,
} from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import type { ProcessTracking } from '@/types';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canView, canEdit } from '@/lib/permissions/check';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

// GET /api/recipes/[id]/processes/tracking?productionId=123
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

    if (!canView(profile.capabilities, 'recipe.processes.history')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const productionIdStr = url.searchParams.get('productionId');
    const productionId = productionIdStr ? Number(productionIdStr) : null;

    if (
      productionId !== null &&
      (!Number.isFinite(productionId) || productionId <= 0)
    ) {
      return NextResponse.json(
        { error: 'Invalid production ID' },
        { status: 400 },
      );
    }

    const query = db
      .select({
        id: dddevRecipeProcessTracking.id,
        productionId: dddevRecipeProcessTracking.productionId,
        processId: dddevRecipeProcessTracking.processId,
        startedAt: dddevRecipeProcessTracking.startedAt,
        endedAt: dddevRecipeProcessTracking.endedAt,
        durationSeconds: dddevRecipeProcessTracking.durationSeconds,
        userId: dddevRecipeProcessTracking.userId,
        createdAt: dddevRecipeProcessTracking.createdAt,
        updatedAt: dddevRecipeProcessTracking.updatedAt,
        processName: dddevProcess.name,
        processOrder: dddevProcess.order,
      })
      .from(dddevRecipeProcessTracking)
      .innerJoin(
        dddevProcess,
        eq(dddevRecipeProcessTracking.processId, dddevProcess.id),
      )
      .innerJoin(
        dddevProduction,
        eq(dddevRecipeProcessTracking.productionId, dddevProduction.id),
      )
      .where(
        productionId !== null
          ? and(
              eq(dddevProduction.recipeId, recipeId),
              eq(dddevRecipeProcessTracking.productionId, productionId),
            )
          : eq(dddevProduction.recipeId, recipeId),
      );

    const trackingRecords = await query.orderBy(
      desc(dddevRecipeProcessTracking.startedAt),
    );

    const result: ProcessTracking[] = trackingRecords.map((tr) => ({
      id: tr.id,
      productionId: tr.productionId,
      processId: tr.processId,
      startedAt: tr.startedAt,
      endedAt: tr.endedAt,
      durationSeconds: tr.durationSeconds,
      userId: tr.userId,
      createdAt: tr.createdAt,
      updatedAt: tr.updatedAt,
    }));

    return NextResponse.json({ tracking: result }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/[id]/processes/tracking] GET error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to fetch process tracking', details: errorMessage },
      { status: 500 },
    );
  }
}

// POST /api/recipes/[id]/processes/tracking
// Body: { productionId: number, processId: number, action: 'start' | 'stop' }
export async function POST(
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

    if (!canEdit(profile.capabilities, 'recipe.processes.tracking')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { productionId, processId, action } = body;

    if (
      typeof productionId !== 'number' ||
      !Number.isFinite(productionId) ||
      productionId <= 0
    ) {
      return NextResponse.json(
        { error: 'Invalid production ID' },
        { status: 400 },
      );
    }

    if (
      typeof processId !== 'number' ||
      !Number.isFinite(processId) ||
      processId <= 0
    ) {
      return NextResponse.json(
        { error: 'Invalid process ID' },
        { status: 400 },
      );
    }

    if (action !== 'start' && action !== 'stop') {
      return NextResponse.json(
        { error: "Action must be 'start' or 'stop'" },
        { status: 400 },
      );
    }

    // Verify production belongs to recipe
    const [production] = await db
      .select()
      .from(dddevProduction)
      .where(
        and(
          eq(dddevProduction.id, productionId),
          eq(dddevProduction.recipeId, recipeId),
        ),
      )
      .limit(1);

    if (!production) {
      return NextResponse.json(
        { error: 'Production not found or does not belong to recipe' },
        { status: 404 },
      );
    }

    if (action === 'start') {
      // Check if there's already an active tracking for this process in this production
      const [activeTracking] = await db
        .select()
        .from(dddevRecipeProcessTracking)
        .where(
          and(
            eq(dddevRecipeProcessTracking.productionId, productionId),
            eq(dddevRecipeProcessTracking.processId, processId),
            isNull(dddevRecipeProcessTracking.endedAt),
          ),
        )
        .limit(1);

      if (activeTracking) {
        return NextResponse.json(
          { error: 'Process is already being tracked for this production' },
          { status: 409 },
        );
      }

      // Start tracking
      const [inserted] = await db.insert(dddevRecipeProcessTracking).values({
        productionId,
        processId,
        userId: profile.id,
      });

      const trackingId = Number(inserted.insertId);
      const [newTracking] = await db
        .select()
        .from(dddevRecipeProcessTracking)
        .where(eq(dddevRecipeProcessTracking.id, trackingId))
        .limit(1);

      return NextResponse.json(
        { tracking: newTracking as ProcessTracking },
        { status: 201 },
      );
    } else {
      // Stop tracking - find the active tracking
      const [activeTracking] = await db
        .select()
        .from(dddevRecipeProcessTracking)
        .where(
          and(
            eq(dddevRecipeProcessTracking.productionId, productionId),
            eq(dddevRecipeProcessTracking.processId, processId),
            isNull(dddevRecipeProcessTracking.endedAt),
          ),
        )
        .limit(1);

      if (!activeTracking) {
        return NextResponse.json(
          { error: 'No active tracking found for this process' },
          { status: 404 },
        );
      }

      // Calculate duration
      const startedAt = new Date(activeTracking.startedAt);
      const endedAt = new Date();
      const durationSeconds = Math.floor(
        (endedAt.getTime() - startedAt.getTime()) / 1000,
      );

      // Update tracking
      await db
        .update(dddevRecipeProcessTracking)
        .set({
          endedAt: endedAt.toISOString(),
          durationSeconds,
        })
        .where(eq(dddevRecipeProcessTracking.id, activeTracking.id));

      const [updatedTracking] = await db
        .select()
        .from(dddevRecipeProcessTracking)
        .where(eq(dddevRecipeProcessTracking.id, activeTracking.id))
        .limit(1);

      return NextResponse.json(
        { tracking: updatedTracking as ProcessTracking },
        { status: 200 },
      );
    }
  } catch (e) {
    console.error('[api/recipes/[id]/processes/tracking] POST error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to update process tracking', details: errorMessage },
      { status: 500 },
    );
  }
}
