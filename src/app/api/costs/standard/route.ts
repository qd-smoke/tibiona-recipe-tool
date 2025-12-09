import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevCostStandard } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { StandardCost, CostType } from '@/types';
import { toNumberFields } from '@/lib/utils/standard-values';

const standardCostDecimalKeys = ['value'] as const;

// GET /api/costs/standard
export async function GET() {
  try {
    const costs = await db.select().from(dddevCostStandard);
    const normalized = costs.map((cost) =>
      toNumberFields(cost, standardCostDecimalKeys),
    );

    // Se la tabella è vuota o mancano alcuni costi, inizializza tutti i costi standard
    const allCostTypes: CostType[] = [
      'hourly_labor',
      'baking_paper',
      'release_agent',
      'bag',
      'carton',
      'label',
      'depositor_leasing',
      'oven_amortization',
      'tray_amortization',
      'costoElettricita',
      'costoGas',
    ];

    const costMap = new Map<string, StandardCost>();
    normalized.forEach((cost) => {
      costMap.set(cost.costType, cost as StandardCost);
    });

    // Assicurati che tutti i costi siano presenti
    const result: StandardCost[] = allCostTypes.map((costType) => {
      const existing = costMap.get(costType);
      if (existing) return existing;
      // Se non esiste, crealo nel database e restituiscilo
      return {
        id: 0,
        costType,
        value: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as StandardCost;
    });

    // Se mancano costi nel database, inseriscili
    const missingCosts = result.filter((cost) => !costMap.has(cost.costType));
    if (missingCosts.length > 0) {
      try {
        await db.insert(dddevCostStandard).values(
          missingCosts.map((cost) => ({
            costType: cost.costType,
            value: cost.value,
          })),
        );
        // Rifai la query per ottenere tutti i dati con gli ID corretti
        const updatedCosts = await db.select().from(dddevCostStandard);
        const updatedNormalized = updatedCosts.map((cost) =>
          toNumberFields(cost, standardCostDecimalKeys),
        );
        // Ordina per garantire l'ordine corretto
        const sorted = allCostTypes
          .map((costType) =>
            updatedNormalized.find((c) => c.costType === costType),
          )
          .filter((c): c is StandardCost => c !== undefined);
        return NextResponse.json({ costs: sorted }, { status: 200 });
      } catch (insertError) {
        // Se l'inserimento fallisce (es. duplicate key), rifai la query comunque
        console.warn(
          'Failed to insert missing costs, fetching existing',
          insertError,
        );
        const existingCosts = await db.select().from(dddevCostStandard);
        const existingNormalized = existingCosts.map((cost) =>
          toNumberFields(cost, standardCostDecimalKeys),
        );
        // Completa con i costi mancanti
        const complete = allCostTypes.map((costType) => {
          const existing = existingNormalized.find(
            (c) => c.costType === costType,
          );
          return (
            existing ||
            ({
              id: 0,
              costType,
              value: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as StandardCost)
          );
        });
        return NextResponse.json({ costs: complete }, { status: 200 });
      }
    }

    return NextResponse.json({ costs: result }, { status: 200 });
  } catch (e) {
    console.error('Get standard costs failed', e);
    return NextResponse.json(
      { error: 'Failed to fetch standard costs' },
      { status: 500 },
    );
  }
}

// PUT /api/costs/standard
// Body: { costs: Array<{ costType: CostType, value: number }> }
export async function PUT(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { costs }: { costs: Array<{ costType: CostType; value: number }> } =
    body;

  if (!Array.isArray(costs)) {
    return NextResponse.json(
      { error: 'Missing or invalid costs array' },
      { status: 400 },
    );
  }

  try {
    await db.transaction(async (tx) => {
      for (const cost of costs) {
        await tx
          .update(dddevCostStandard)
          .set({ value: cost.value })
          .where(eq(dddevCostStandard.costType, cost.costType));
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('Update standard costs failed', e);
    return NextResponse.json(
      { error: 'Failed to update standard costs' },
      { status: 500 },
    );
  }
}
