import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevRecipeCategory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { RecipeCategory } from '@/types';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

// PUT /api/recipes/categories/[id]
// Body: { name: string }
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canEdit(profile.capabilities, 'admin.permissions')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const resolvedParams = await params;
    const categoryId = parseId(resolvedParams);
    if (!categoryId) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 },
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

    // Check if category exists
    const [existing] = await db
      .select()
      .from(dddevRecipeCategory)
      .where(eq(dddevRecipeCategory.id, categoryId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    // Check if another category with the same name exists (case-insensitive)
    const allCategories = await db.select().from(dddevRecipeCategory);

    const normalizedNewName = trimmedName.toLowerCase();
    const duplicate = allCategories.find(
      (cat) =>
        cat.name.toLowerCase() === normalizedNewName && cat.id !== categoryId,
    );

    if (duplicate) {
      return NextResponse.json(
        { error: 'Una categoria con questo nome esiste già' },
        { status: 409 },
      );
    }

    // Update category
    await db
      .update(dddevRecipeCategory)
      .set({ name: trimmedName })
      .where(eq(dddevRecipeCategory.id, categoryId));

    const [updated] = await db
      .select()
      .from(dddevRecipeCategory)
      .where(eq(dddevRecipeCategory.id, categoryId))
      .limit(1);

    return NextResponse.json(
      { category: updated as RecipeCategory },
      { status: 200 },
    );
  } catch (e) {
    console.error('[api/recipes/categories/[id]] PUT error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to update category', details: errorMessage },
      { status: 500 },
    );
  }
}

// DELETE /api/recipes/categories/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canEdit(profile.capabilities, 'admin.permissions')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const resolvedParams = await params;
    const categoryId = parseId(resolvedParams);
    if (!categoryId) {
      return NextResponse.json(
        { error: 'Invalid category ID' },
        { status: 400 },
      );
    }

    // Check if category exists
    const [existing] = await db
      .select()
      .from(dddevRecipeCategory)
      .where(eq(dddevRecipeCategory.id, categoryId))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    // Delete category (cascade will handle recipe updates)
    await db
      .delete(dddevRecipeCategory)
      .where(eq(dddevRecipeCategory.id, categoryId));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/categories/[id]] DELETE error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to delete category', details: errorMessage },
      { status: 500 },
    );
  }
}
