import { NextResponse } from 'next/server';
import { createRecipe, getRecipes } from '@/app/api/recipes/index';

// GET /api/recipes
// Query params:
// - page, perPage (optional pagination)
// - includeIngredients=true|false (default true)
// - q: optional search by name (min length 2 to apply)
// - categoryId: optional filter by category ID
// - clientIds: optional filter by client IDs (comma-separated)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pageParam = searchParams.get('page');
    const perPageParam = searchParams.get('perPage');
    const includeIngredients = searchParams.get('includeIngredients');
    const query = (searchParams.get('q') || '').trim();
    const categoryIdParam = searchParams.get('categoryId');
    const clientIdsParam = searchParams.get('clientIds');

    const data = await getRecipes({
      page: pageParam || 1,
      perPage: perPageParam || 10,
      includeIngredients,
      query,
      categoryId: categoryIdParam || undefined,
      clientIds: clientIdsParam || undefined,
    });
    return NextResponse.json(data, { status: 200 });
  } catch (e) {
    console.error('[api/recipes] GET error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to fetch recipes', details: errorMessage, items: [] },
      { status: 500 },
    );
  }
}

// POST /api/recipes
export async function POST(req: Request) {
  try {
    const result = await createRecipe(await req.json());

    if (result.success) {
      return NextResponse.json(result, { status: 201 });
    } else {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to create recipe' },
        { status: 400 },
      );
    }
  } catch (e) {
    console.error('Create recipe failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { success: false, error: `Failed to create recipe: ${errorMessage}` },
      { status: 500 },
    );
  }
}
