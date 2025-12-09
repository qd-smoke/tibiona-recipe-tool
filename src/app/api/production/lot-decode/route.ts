import { NextResponse } from 'next/server';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '@/db';
import { dddevProduction, dddevRecipe, appPermissions } from '@/db/schema';
import {
  decodeProductionLot,
  isValidLotFormat,
} from '@/lib/production/lotEncoder';
import { canView } from '@/lib/permissions/check';
import { getCurrentProfile } from '@/lib/auth/currentUser';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

// POST /api/production/lot-decode
export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return unauthorized('Not authenticated');
    }

    // Check permission
    const canDecode = canView(
      profile.capabilities,
      'production.lot.decode',
      false,
      profile.roleLabel === 'operator',
    );

    if (!canDecode) {
      return unauthorized('Insufficient permissions');
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('[api/production/lot-decode] JSON parse error:', e);
      return badRequest('Invalid JSON body');
    }

    const { lot }: { lot?: string } = body;

    if (!lot || !lot.trim()) {
      return badRequest('Lot is required');
    }

    const trimmedLot = lot.trim().toUpperCase();

    if (!isValidLotFormat(trimmedLot)) {
      return badRequest(
        'Invalid lot format. Lot must be 12 alphanumeric characters.',
      );
    }

    const decoded = decodeProductionLot(trimmedLot);
    if (!decoded) {
      return badRequest('Unable to decode lot. Invalid format.');
    }
    // Try to find exact match from production records first
    // This is the most reliable way to get recipe and user names

    // Try to find exact match from production records
    // Search for productions that match the decoded dates (with 1-minute tolerance)
    const startDate = decoded.startedAt;
    const finishDate = decoded.finishedAt;

    // Search with a 1-minute tolerance
    const startDateMin = new Date(startDate.getTime() - 60000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const startDateMax = new Date(startDate.getTime() + 60000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const finishDateMin = new Date(finishDate.getTime() - 60000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const finishDateMax = new Date(finishDate.getTime() + 60000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    let exactProduction: {
      production: typeof dddevProduction.$inferSelect;
      recipe: typeof dddevRecipe.$inferSelect | null;
      user: typeof appPermissions.$inferSelect | null;
    } | null = null;

    try {
      const [result] = await db
        .select({
          production: dddevProduction,
          recipe: dddevRecipe,
          user: appPermissions,
        })
        .from(dddevProduction)
        .leftJoin(dddevRecipe, eq(dddevProduction.recipeId, dddevRecipe.id))
        .leftJoin(appPermissions, eq(dddevProduction.userId, appPermissions.id))
        .where(
          and(
            gte(dddevProduction.startedAt, startDateMin),
            lte(dddevProduction.startedAt, startDateMax),
            // Only search finished productions (finishedAt is not null)
            eq(dddevProduction.status, 'completed'),
            gte(dddevProduction.finishedAt, finishDateMin),
            lte(dddevProduction.finishedAt, finishDateMax),
          ),
        )
        .limit(1);
      exactProduction = result || null;
    } catch (e) {
      console.error(
        '[api/production/lot-decode] Error searching exact production:',
        e,
      );
      // Continue without exact match
    }

    // If exact match not found, search recipes and users with matching initials
    let possibleRecipes: string[] = [];
    let possibleUsers: string[] = [];

    if (!exactProduction?.recipe) {
      const recipeInitials = decoded.recipeName;
      try {
        const recipes = await db.select().from(dddevRecipe).limit(100); // Get more recipes to filter in memory
        // Filter to only those matching initials
        possibleRecipes = recipes
          .filter((r) => {
            const name = (r.name || '').trim();
            if (name.length === 0) return false;
            return (
              name[0].toUpperCase() === recipeInitials[0] &&
              name[name.length - 1].toUpperCase() === recipeInitials[1]
            );
          })
          .map((r) => r.name)
          .slice(0, 10);
      } catch (e) {
        console.error(
          '[api/production/lot-decode] Error searching recipes:',
          e,
        );
        // Continue without possible recipes
      }
    }

    if (!exactProduction?.user) {
      const userInitials = decoded.userName;
      try {
        const users = await db.select().from(appPermissions).limit(100); // Get more users to filter in memory
        // Filter to only those matching initials
        possibleUsers = users
          .filter((u) => {
            const name = (u.displayName || u.username || '').trim();
            if (name.length === 0) return false;
            return (
              name[0].toUpperCase() === userInitials[0] &&
              name[name.length - 1].toUpperCase() === userInitials[1]
            );
          })
          .map((u) => u.displayName || u.username || 'Unknown')
          .slice(0, 10);
      } catch (e) {
        console.error('[api/production/lot-decode] Error searching users:', e);
        // Continue without possible users
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        lot: trimmedLot,
        decoded: {
          recipeInitials: decoded.recipeName,
          userInitials: decoded.userName,
          startedAt: decoded.startedAt.toISOString(),
          finishedAt: decoded.finishedAt.toISOString(),
        },
        // Try to find exact matches
        recipeName: exactProduction?.recipe?.name || null,
        userName:
          exactProduction?.user?.displayName ||
          exactProduction?.user?.username ||
          null,
        // Possible matches (if exact not found)
        possibleRecipes,
        possibleUsers,
      },
    });
  } catch (e) {
    console.error('[api/production/lot-decode] Error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack : undefined;
    console.error('[api/production/lot-decode] Error details:', {
      message: errorMessage,
      stack: errorStack,
      error: e,
    });
    return NextResponse.json(
      { error: 'Failed to decode lot', details: errorMessage },
      { status: 500 },
    );
  }
}
