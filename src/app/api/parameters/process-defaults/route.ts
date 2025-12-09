import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevColatriceDefaults } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/parameters/process-defaults
export async function GET() {
  try {
    // Get all records and find the one with process defaults
    const allRecords = await db
      .select()
      .from(dddevColatriceDefaults)
      .orderBy(desc(dddevColatriceDefaults.id));

    // Check each record to find process defaults
    for (const record of allRecords) {
      if (record.settings) {
        try {
          const parsed = JSON.parse(record.settings);
          // Check if it's process defaults (has processes array)
          if (parsed.processes && Array.isArray(parsed.processes)) {
            return NextResponse.json({ defaults: parsed }, { status: 200 });
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    // No defaults in database, return empty
    return NextResponse.json({ defaults: { processes: [] } }, { status: 200 });
  } catch {
    // Table might not exist yet, return empty
    return NextResponse.json({ defaults: { processes: [] } }, { status: 200 });
  }
}

// PUT /api/parameters/process-defaults
// Body: { defaults: { processes: Array<{ processId: number, minutes: number, cycles: number, costTypes?: string[], cycleField?: string | null }> } }
export async function PUT(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    defaults,
  }: {
    defaults: {
      processes: Array<{
        processId: number;
        minutes: number;
        cycles: number;
        costTypes?: string[];
        cycleField?: string | null;
      }>;
    };
  } = body;

  if (!defaults || !defaults.processes || !Array.isArray(defaults.processes)) {
    return NextResponse.json(
      { error: 'Missing or invalid defaults object' },
      { status: 400 },
    );
  }

  try {
    const jsonValue = JSON.stringify(defaults);

    // Find existing process defaults record (we'll use id=0 as marker or check content)
    // For simplicity, we'll always update/create the first record if it's process defaults
    // or create a new one

    // Check if there's already a process defaults record
    const allRecords = await db
      .select()
      .from(dddevColatriceDefaults)
      .orderBy(desc(dddevColatriceDefaults.id));

    let processDefaultsRecord = null;
    for (const record of allRecords) {
      if (record.settings) {
        try {
          const parsed = JSON.parse(record.settings);
          if (parsed.processes && Array.isArray(parsed.processes)) {
            processDefaultsRecord = record;
            break;
          }
        } catch {
          // Not process defaults
        }
      }
    }

    if (processDefaultsRecord) {
      await db
        .update(dddevColatriceDefaults)
        .set({ settings: jsonValue })
        .where(eq(dddevColatriceDefaults.id, processDefaultsRecord.id));
    } else {
      await db.insert(dddevColatriceDefaults).values({
        settings: jsonValue,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to update process defaults' },
      { status: 500 },
    );
  }
}
