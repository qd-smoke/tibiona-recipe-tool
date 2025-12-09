import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevRecipe } from '@/db/schema';
import { inArray } from 'drizzle-orm';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

// POST /api/recipes/bulk-delete
// Body: { ids: number[] }
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const arr = (body as { ids?: unknown[] } | null | undefined)?.ids;
  const ids = Array.isArray(arr)
    ? arr
        .map((x: unknown) => Number(x))
        .filter((n: number) => Number.isFinite(n) && n > 0)
    : null;

  if (!ids || ids.length === 0) {
    return badRequest('ids must be a non-empty array of numbers');
  }

  try {
    const result = await db
      .delete(dddevRecipe)
      .where(inArray(dddevRecipe.id, ids));
    // Drizzle's mysql2 delete returns ResultSetHeader; try to read affected rows if present
    const deletedCount = (result as unknown as { affectedRows?: number })
      ?.affectedRows;
    return NextResponse.json(
      { success: true, deletedCount: deletedCount ?? null },
      { status: 200 },
    );
  } catch (e) {
    console.error('Bulk delete recipes failed', e);
    return NextResponse.json(
      { error: 'Failed to bulk delete recipes' },
      { status: 500 },
    );
  }
}
