import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { dddevProduction, dddevRecipe, appPermissions } from '@/db/schema';
import {
  getSessionTokenFromCookies,
  verifySessionToken,
} from '@/lib/auth/session';
import { generateProductionLot } from '@/lib/production/lotEncoder';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function notFound(message: string) {
  return NextResponse.json({ error: message }, { status: 404 });
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

// POST /api/recipes/[id]/production/[productionId]/finish
export async function POST(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; productionId: string }>;
  },
) {
  const resolvedParams = await params;
  const recipeId = parseId({ id: resolvedParams.id });
  const productionId = parseId({ id: resolvedParams.productionId });

  if (!recipeId) return badRequest('Invalid recipe id');
  if (!productionId) return badRequest('Invalid production id');

  const userId = await getCurrentUserId();
  if (!userId) return unauthorized('Not authenticated');

  let body;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const { notes }: { notes?: string } = body;

  try {
    // Check if production exists and belongs to recipe
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
      return notFound('Production not found');
    }

    if (production.status !== 'in_progress') {
      return badRequest('Production is not in progress');
    }

    // Get recipe and user information for lot generation
    const [recipe] = await db
      .select()
      .from(dddevRecipe)
      .where(eq(dddevRecipe.id, production.recipeId))
      .limit(1);

    if (!recipe) {
      return notFound('Recipe not found');
    }

    const [user] = await db
      .select()
      .from(appPermissions)
      .where(eq(appPermissions.id, production.userId))
      .limit(1);

    if (!user) {
      return notFound('User not found');
    }

    // Generate production lot automatically
    const startedAtDate = new Date(production.startedAt);
    const finishedAtDate = new Date();
    const productionLot = generateProductionLot({
      recipeName: recipe.name,
      userName: user.displayName || user.username,
      startedAt: startedAtDate,
      finishedAt: finishedAtDate,
    });

    // Update production to finished with generated lot
    const finishedAt = finishedAtDate
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    await db
      .update(dddevProduction)
      .set({
        productionLot,
        finishedAt,
        status: 'completed',
        notes: notes?.trim() || production.notes || null,
      })
      .where(eq(dddevProduction.id, productionId));

    // Fetch updated production
    const [updatedProduction] = await db
      .select()
      .from(dddevProduction)
      .where(eq(dddevProduction.id, productionId))
      .limit(1);

    return NextResponse.json(
      {
        ok: true,
        production: updatedProduction,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error('Finish production failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to finish production', details: errorMessage },
      { status: 500 },
    );
  }
}
