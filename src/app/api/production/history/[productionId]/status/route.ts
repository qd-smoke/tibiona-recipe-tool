import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { dddevProduction } from '@/db/schema';
import { getCurrentProfile } from '@/lib/auth/currentUser';
import { canEdit } from '@/lib/permissions/check';

type Params = {
  params: Promise<{ productionId: string }>;
};

const allowedStatuses = ['completed', 'loaded'];

export async function POST(request: Request, { params }: Params) {
  try {
    const profile = await getCurrentProfile();
    if (
      !profile ||
      !canEdit(profile.capabilities, 'admin.production.history')
    ) {
      return NextResponse.json(
        { ok: false, error: 'Permessi insufficienti' },
        { status: 403 },
      );
    }

    const resolved = await params;
    const productionId = Number(resolved.productionId);
    if (!Number.isFinite(productionId) || productionId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Production ID non valido' },
        { status: 400 },
      );
    }

    const body = (await request.json()) as { status?: string };
    const status = body.status?.trim();
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, error: 'Status non valido' },
        { status: 400 },
      );
    }

    await db
      .update(dddevProduction)
      .set({ status })
      .where(eq(dddevProduction.id, productionId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/production/history/[productionId]/status] POST', error);
    return NextResponse.json(
      { ok: false, error: 'Errore interno' },
      { status: 500 },
    );
  }
}
