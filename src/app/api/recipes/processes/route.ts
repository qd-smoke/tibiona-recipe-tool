import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevProcess } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import type { Process } from '@/types';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

// GET /api/recipes/processes
export async function GET() {
  try {
    const processes = await db
      .select()
      .from(dddevProcess)
      .orderBy(asc(dddevProcess.order), asc(dddevProcess.name));

    return NextResponse.json({ processes }, { status: 200 });
  } catch (e) {
    console.error('[api/recipes/processes] GET error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to fetch processes', details: errorMessage },
      { status: 500 },
    );
  }
}

// POST /api/recipes/processes
// Body: { name: string, order?: number }
export async function POST(req: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin permission
    if (!canEdit(profile.capabilities, 'admin.processes')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { name, order } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Process name is required' },
        { status: 400 },
      );
    }

    const trimmedName = name.trim();
    const processOrder = typeof order === 'number' ? order : 0;

    // Check if process already exists (case-insensitive)
    const allProcesses = await db.select().from(dddevProcess);

    const normalizedNewName = trimmedName.toLowerCase();
    const duplicate = allProcesses.find(
      (proc) => proc.name.toLowerCase() === normalizedNewName,
    );

    if (duplicate) {
      return NextResponse.json(
        { error: 'Un processo con questo nome esiste già' },
        { status: 409 },
      );
    }

    const [inserted] = await db
      .insert(dddevProcess)
      .values({ name: trimmedName, order: processOrder });

    const processId = Number(inserted.insertId);
    const [newProcess] = await db
      .select()
      .from(dddevProcess)
      .where(eq(dddevProcess.id, processId))
      .limit(1);

    return NextResponse.json(
      { process: newProcess as Process },
      { status: 201 },
    );
  } catch (e) {
    console.error('[api/recipes/processes] POST error:', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (errorMessage.includes('Duplicate entry')) {
      return NextResponse.json(
        { error: 'Process already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create process', details: errorMessage },
      { status: 500 },
    );
  }
}
