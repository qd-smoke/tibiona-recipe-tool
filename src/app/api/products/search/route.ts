import { NextResponse } from 'next/server';
import { db } from '@/db';
import { catalogProductFlat1 } from '@/db/schema';
import { and, eq, like, or, sql } from 'drizzle-orm';
import { enrichWithNutrition } from '@/app/api/products/utils';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();

  // Optional: includeNutritionAttributes flag (default true)
  const includeAttrParam = searchParams.get('includeNutritionAttributes');
  const includeNutritionAttributes =
    includeAttrParam === null
      ? true
      : includeAttrParam === '1' || includeAttrParam?.toLowerCase() === 'true';

  // New pagination params
  const pageParam = searchParams.get('page');
  const perPageParam = searchParams.get('perPage');

  let page = 1;
  let perPage = 10;
  if (perPageParam !== null) {
    const p = Number(perPageParam);
    if (Number.isFinite(p)) perPage = Math.max(1, Math.min(Math.trunc(p), 50));
  }
  if (pageParam !== null) {
    const p = Number(pageParam);
    if (Number.isFinite(p)) page = Math.max(1, Math.trunc(p));
  }

  try {
    // Build WHERE clause
    const where = q.length
      ? and(
          or(
            like(catalogProductFlat1.name, `%${q}%`),
            like(catalogProductFlat1.sku, `%${q}%`),
          ),
          eq(catalogProductFlat1.typeId, 'simple'),
        )
      : eq(catalogProductFlat1.typeId, 'simple');

    // Paged mode: total + items
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(catalogProductFlat1)
      .where(where);

    let items = await db
      .select()
      .from(catalogProductFlat1)
      .where(where)
      .orderBy(catalogProductFlat1.name)
      .limit(perPage)
      .offset((page - 1) * perPage);

    if (includeNutritionAttributes && items.length > 0) {
      items = await enrichWithNutrition(items);
    }

    return NextResponse.json(
      { items, total: Number(count) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('Product search failed', e);
    return NextResponse.json(
      { error: 'Search failed' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
