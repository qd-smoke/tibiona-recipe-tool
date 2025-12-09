import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevColatriceDefaults } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// Default values for colatrice settings
const DEFAULT_COLATRICE_VALUES: Record<string, Record<string, number>> = {
  schermata_1: {
    velocita_passi_percent: 50,
    bordo_teglia_mm: 26,
    ritardo_start_passi_sec: 0.6,
    spazio_biscotto_1_mm: 68,
    spazio_biscotto_2_mm: 0,
    spazio_biscotto_3_mm: 0,
    spazio_biscotto_4_mm: 0,
    ritardo_striscio_sec: 0.0,
    lunghezza_striscio_mm: 0,
    ritorno_striscio_mm: 0,
    altezza_start_passi_mm: 26,
    colaggio_pompa: 0,
    teglia_alta: 0,
    taglio_filo: 0,
    colaggio_senza_tappeto: 0,
    uscita_anteriore: 0,
  },
  schermata_2: {
    altezza_tavola_mm: 26,
    altezza_biscotto_mm: 0,
    velocita_tavola: 5,
    velocita_discesa_tavola: 0,
    altezza_start_colata_mm: 20,
    velocita_colaggio_percent: 10,
    tempo_colaggio_sec: 0.8,
    recupero_colaggio: 0.3,
    spazio_uscita_cm: 73,
    rit1_discesa_tavola: 0.0,
    rit2_discesa_tavola: 0.0,
    ritardo_giro_sec: 0.0,
    ritardo_taglio_sec: 0.0,
    tempo_giro_sec: 0.0,
    velocita_giro_percent: 10,
    altezza_reset_giro_mm: 0,
    lunghezza_teglia_mm: 600,
  },
  schermata_3: {
    altezza_tavola_mm: 26,
    altezza_biscotto_mm: 0,
    velocita_colaggio_percent: 10,
    tempo_colaggio_sec: 0.8,
    recupero_colaggio: 0.3,
    rit1_discesa_tavola: 0.0,
    ritardo_striscio_sec: 0.0,
    lunghezza_striscio_mm: 0,
    ritorno_striscio_mm: 0,
  },
  tower_drop_easy_access: {
    alzata_tavola_mm: 25,
    vel_colaggio_percent: 100,
    tempo_giro_sec: 0.0,
    tempo_colaggio_sec: 0.8,
  },
};

// GET /api/parameters/colatrice-defaults
export async function GET() {
  try {
    // Get all records and find the one that is NOT process defaults (id != 0 and doesn't have processes array)
    const allRecords = await db
      .select()
      .from(dddevColatriceDefaults)
      .orderBy(desc(dddevColatriceDefaults.id));

    // Find the first record that is NOT process defaults
    // Process defaults have id=0 or contain { processes: [...] }
    let colatriceDefaultsRecord = null;
    for (const record of allRecords) {
      if (record.id === 0) {
        // Skip process defaults (id=0)
        continue;
      }
      if (record.settings) {
        try {
          const parsed = JSON.parse(record.settings);
          // If it has a 'processes' array, it's process defaults, skip it
          if (
            parsed &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.processes)
          ) {
            continue;
          }
          // This looks like colatrice defaults
          colatriceDefaultsRecord = record;
          break;
        } catch {
          // Invalid JSON, skip
          continue;
        }
      }
    }

    if (colatriceDefaultsRecord && colatriceDefaultsRecord.settings) {
      try {
        const parsed = JSON.parse(colatriceDefaultsRecord.settings);
        // If parsed is empty or invalid, return hardcoded defaults
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          Object.keys(parsed).length === 0 ||
          Array.isArray(parsed.processes) // Make sure it's not process defaults
        ) {
          return NextResponse.json(
            { defaults: DEFAULT_COLATRICE_VALUES },
            { status: 200 },
          );
        }
        return NextResponse.json({ defaults: parsed }, { status: 200 });
      } catch {
        // Invalid JSON, return hardcoded defaults
        return NextResponse.json(
          { defaults: DEFAULT_COLATRICE_VALUES },
          { status: 200 },
        );
      }
    }

    // No colatrice defaults in database, return hardcoded defaults
    return NextResponse.json(
      { defaults: DEFAULT_COLATRICE_VALUES },
      { status: 200 },
    );
  } catch {
    // Table might not exist yet, return hardcoded defaults
    return NextResponse.json(
      { defaults: DEFAULT_COLATRICE_VALUES },
      { status: 200 },
    );
  }
}

// PUT /api/parameters/colatrice-defaults
// Body: { defaults: Record<string, Record<string, number>> }
export async function PUT(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { defaults }: { defaults: Record<string, Record<string, number>> } =
    body;

  if (!defaults || typeof defaults !== 'object') {
    return NextResponse.json(
      { error: 'Missing or invalid defaults object' },
      { status: 400 },
    );
  }

  try {
    const jsonValue = JSON.stringify(defaults);
    // Get all records and find the colatrice defaults record (not process defaults)
    const allRecords = await db
      .select()
      .from(dddevColatriceDefaults)
      .orderBy(desc(dddevColatriceDefaults.id));

    // Find the colatrice defaults record (not id=0 and not process defaults)
    let colatriceDefaultsRecord = null;
    for (const record of allRecords) {
      if (record.id === 0) {
        // Skip process defaults (id=0)
        continue;
      }
      if (record.settings) {
        try {
          const parsed = JSON.parse(record.settings);
          // If it has a 'processes' array, it's process defaults, skip it
          if (
            parsed &&
            typeof parsed === 'object' &&
            Array.isArray(parsed.processes)
          ) {
            continue;
          }
          // This looks like colatrice defaults
          colatriceDefaultsRecord = record;
          break;
        } catch {
          // Invalid JSON, might be colatrice defaults, use it
          colatriceDefaultsRecord = record;
          break;
        }
      }
    }

    if (colatriceDefaultsRecord) {
      // Update existing colatrice defaults record
      await db
        .update(dddevColatriceDefaults)
        .set({ settings: jsonValue })
        .where(eq(dddevColatriceDefaults.id, colatriceDefaultsRecord.id));
    } else {
      // Insert new colatrice defaults record (use id > 0 to distinguish from process defaults)
      await db.insert(dddevColatriceDefaults).values({
        settings: jsonValue,
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    // Table might not exist yet, try to create it or return error
    return NextResponse.json(
      { error: 'Failed to update colatrice defaults' },
      { status: 500 },
    );
  }
}
