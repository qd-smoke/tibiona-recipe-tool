import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevRecipeCategory } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { RecipeCategory } from '@/types';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

// GET /api/recipes/categories
export async function GET() {
  try {
    const categories = await db
      .select()
      .from(dddevRecipeCategory)
      .orderBy(asc(dddevRecipeCategory.name));

    return NextResponse.json({ categories }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/categories] GET error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to fetch categories', details: errorMessage },
      { status: 500 },
    );
  }
}

// POST /api/recipes/categories
// Body: { name: string }
export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    if (!canEdit(profile.capabilities, 'admin.permissions')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();

    // Check if category already exists (case-insensitive)
    const allCategories = await db.select().from(dddevRecipeCategory);

    const normalizedNewName = trimmedName.toLowerCase();
    const duplicate = allCategories.find(
      (cat) => cat.name.toLowerCase() === normalizedNewName,
    );

    if (duplicate) {
      return NextResponse.json(
        { error: 'Una categoria con questo nome esiste già' },
        { status: 409 },
      );
    }

    const [inserted] = await db
      .insert(dddevRecipeCategory)
      .values({ name: trimmedName });

    const categoryId = Number(inserted.insertId);
    const [newCategory] = await db
      .select()
      .from(dddevRecipeCategory)
      .where(eq(dddevRecipeCategory.id, categoryId))
      .limit(1);

    return NextResponse.json(
      { category: newCategory as RecipeCategory },
      { status: 201 },
    );
  } catch (e) {
    console.error('[api/recipes/categories] POST error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (errorMessage.includes('Duplicate entry')) {
      return NextResponse.json(
        { error: 'Category already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create category', details: errorMessage },
      { status: 500 },
    );
  }
}
