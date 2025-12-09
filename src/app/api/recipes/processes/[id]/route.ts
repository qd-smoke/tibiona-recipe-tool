import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevProcess } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Process } from '@/types';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

function parseId(params: { id?: string }) {
  const idStr = params.id ?? '';
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

// PUT /api/recipes/processes/[id]
// Body: { name?: string, order?: number }
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canEdit(profile.capabilities, 'admin.processes')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const resolvedParams = await params;
    const processId = parseId(resolvedParams);
    if (!processId) {
      return NextResponse.json(
        { error: 'Invalid process ID' },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { name, order } = body;

    // Check if process exists
    const [existing] = await db
      .select()
      .from(dddevProcess)
      .where(eq(dddevProcess.id, processId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    const updateData: { name?: string; order?: number } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Process name must be a non-empty string' },
          { status: 400 },
        );
      }

      const trimmedName = name.trim();

      // Check if another process with the same name exists (case-insensitive)
      const allProcesses = await db.select().from(dddevProcess);

      const normalizedNewName = trimmedName.toLowerCase();
      const duplicate = allProcesses.find(
        (proc) =>
          proc.name.toLowerCase() === normalizedNewName &&
          proc.id !== processId,
      );

      if (duplicate) {
        return NextResponse.json(
          { error: 'Un processo con questo nome esiste già' },
          { status: 409 },
        );
      }

      updateData.name = trimmedName;
    }

    if (order !== undefined) {
      if (typeof order !== 'number') {
        return NextResponse.json(
          { error: 'Order must be a number' },
          { status: 400 },
        );
      }
      updateData.order = order;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 },
      );
    }

    // Update process
    await db
      .update(dddevProcess)
      .set(updateData)
      .where(eq(dddevProcess.id, processId));

    const [updated] = await db
      .select()
      .from(dddevProcess)
      .where(eq(dddevProcess.id, processId))
      .limit(1);

    return NextResponse.json({ process: updated as Process }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/processes/[id]] PUT error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to update process', details: errorMessage },
      { status: 500 },
    );
  }
}

// DELETE /api/recipes/processes/[id]
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canEdit(profile.capabilities, 'admin.processes')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const resolvedParams = await params;
    const processId = parseId(resolvedParams);
    if (!processId) {
      return NextResponse.json(
        { error: 'Invalid process ID' },
        { status: 400 },
      );
    }

    // Check if process exists
    const [existing] = await db
      .select()
      .from(dddevProcess)
      .where(eq(dddevProcess.id, processId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Process not found' }, { status: 404 });
    }

    // Delete process (cascade will handle recipe_process and tracking deletions)
    await db.delete(dddevProcess).where(eq(dddevProcess.id, processId));

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/processes/[id]] DELETE error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to delete process', details: errorMessage },
      { status: 500 },
    );
  }
}
