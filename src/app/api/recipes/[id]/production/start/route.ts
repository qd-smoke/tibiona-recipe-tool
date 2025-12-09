import { NextResponse } from 'next/server';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/db';
import {
  dddevRecipe,
  dddevProduction,
  dddevRecipeVersion,
  dddevRecipeIngredient,
  dddevRecipeOvenTemperature,
  dddevRecipeMixingTime,
} from '@/db/schema';
import { asc } from 'drizzle-orm';
import {
  getSessionTokenFromCookies,
  verifySessionToken,
} from '@/lib/auth/session';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function parseId(params: { id?: string }): number | null {
  const id = params.id ? Number(params.id) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function getCurrentUserId(): Promise<number | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  const session = verifySessionToken(token);
  if (!session || !Number.isFinite(session.userId)) return null;
  return session.userId;
}

// POST /api/recipes/[id]/production/start
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const recipeId = parseId(resolvedParams);
  if (!recipeId) return badRequest('Invalid recipe id');

  const userId = await getCurrentUserId();
  if (!userId) return unauthorized('Not authenticated');

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { startedAt, notes }: { startedAt?: string; notes?: string } = body;

  // Parse startedAt or use current time
  let startDate: Date;
  if (startedAt) {
    startDate = new Date(startedAt);
    if (isNaN(startDate.getTime())) {
      return badRequest('Invalid startedAt date format');
    }
  } else {
    startDate = new Date();
  }

  try {
    // Check if recipe exists
    const [recipe] = await db
      .select()
      .from(dddevRecipe)
      .where(eq(dddevRecipe.id, recipeId))
      .limit(1);

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Check if there's already an active production for this recipe
    const [activeProduction] = await db
      .select()
      .from(dddevProduction)
      .where(
        and(
          eq(dddevProduction.recipeId, recipeId),
          eq(dddevProduction.status, 'in_progress'),
        ),
      )
      .limit(1);

    if (activeProduction) {
      return badRequest(
        'There is already an active production for this recipe',
      );
    }

    // Get current version number for this recipe
    const [latestVersion] = await db
      .select()
      .from(dddevRecipeVersion)
      .where(eq(dddevRecipeVersion.recipeId, recipeId))
      .orderBy(desc(dddevRecipeVersion.versionNumber))
      .limit(1);

    const nextVersionNumber = latestVersion
      ? latestVersion.versionNumber + 1
      : 1;

    // Get all current ingredients
    const ingredients = await db
      .select()
      .from(dddevRecipeIngredient)
      .where(eq(dddevRecipeIngredient.recipeId, recipeId));

    // Get oven temperatures and mixing times
    const ovenTemperatures = await db
      .select()
      .from(dddevRecipeOvenTemperature)
      .where(eq(dddevRecipeOvenTemperature.recipeId, recipeId))
      .orderBy(asc(dddevRecipeOvenTemperature.order));

    const mixingTimes = await db
      .select()
      .from(dddevRecipeMixingTime)
      .where(eq(dddevRecipeMixingTime.recipeId, recipeId))
      .orderBy(asc(dddevRecipeMixingTime.order));

    // Create snapshot of recipe with oven temperatures and mixing times
    const recipeSnapshot = JSON.stringify({
      ...recipe,
      ovenTemperatures: ovenTemperatures.map((ot) => ({
        temperature: Number(ot.temperature),
        minutes: Number(ot.minutes),
        order: ot.order,
      })),
      mixingTimes: mixingTimes.map((mt) => ({
        minutes: Number(mt.minutes),
        speed: Number(mt.speed),
        order: mt.order,
      })),
    });
    const ingredientsSnapshot = JSON.stringify(ingredients);

    // Create new version
    const [versionResult] = await db.insert(dddevRecipeVersion).values({
      recipeId,
      versionNumber: nextVersionNumber,
      createdByUserId: userId,
      recipeSnapshot,
      ingredientsSnapshot,
    });

    const versionId = versionResult.insertId;

    // Create production record with temporary lot (will be generated on finish)
    // Use placeholder lot for now - will be replaced when production finishes
    const [productionResult] = await db.insert(dddevProduction).values({
      recipeId,
      recipeVersionId: versionId as number,
      userId,
      productionLot: 'TEMP', // Temporary, will be replaced on finish
      startedAt: startDate.toISOString().slice(0, 19).replace('T', ' '),
      status: 'in_progress',
      notes: notes?.trim() || null,
    });

    const productionId = productionResult.insertId;

    // Fetch created production with relations
    const [createdProduction] = await db
      .select()
      .from(dddevProduction)
      .where(eq(dddevProduction.id, productionId as number))
      .limit(1);

    return NextResponse.json(
      {
        ok: true,
        productionId: productionId as number,
        recipeVersionId: versionId as number,
        production: createdProduction,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('Start production failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to start production', details: errorMessage },
      { status: 500 },
    );
  }
}
