import { NextResponse } from 'next/server';
import { db } from '@/db';
import { dddevStandardParameters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { StandardParameter, ParameterType } from '@/types';
import { toNumberFields } from '@/lib/utils/standard-values';

const standardParameterDecimalKeys = ['value'] as const;

// GET /api/parameters/standard
export async function GET() {
  try {
    const parameters = await db.select().from(dddevStandardParameters);
    const normalized = parameters.map((param) =>
      toNumberFields(param, standardParameterDecimalKeys),
    );

    // Se la tabella è vuota o mancano alcuni parametri, inizializza tutti i parametri standard
    const allParameterTypes: ParameterType[] = [
      'mixerCapacityKg',
      'depositorCapacityKg',
      'traysCapacityKg',
      'cookieWeightCookedG',
      'traysPerOvenLoad',
      'wastePercent',
      'waterPercent',
      'consumoForno',
      'consumoColatrice',
      'consumoImpastatrice',
      'consumoSaldatrice',
      'consumoConfezionatrice',
      'consumoBassima',
      'consumoMulino',
      'steamMinutes',
      'valveOpenMinutes',
      'valveCloseMinutes',
      'boxCapacity',
      'cartCapacity',
    ];

    const parameterMap = new Map<string, StandardParameter>();
    normalized.forEach((param) => {
      parameterMap.set(param.parameterType, param as StandardParameter);
    });

    // Assicurati che tutti i parametri siano presenti
    const result: StandardParameter[] = allParameterTypes.map(
      (parameterType) => {
        const existing = parameterMap.get(parameterType);
        if (existing) return existing;
        // Se non esiste, crealo nel database e restituiscilo
        return {
          id: 0,
          parameterType,
          value: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as StandardParameter;
      },
    );

    // Se mancano parametri nel database, inseriscili
    const missingParameters = result.filter(
      (param) => !parameterMap.has(param.parameterType),
    );
    if (missingParameters.length > 0) {
      try {
        await db.insert(dddevStandardParameters).values(
          missingParameters.map((param) => ({
            parameterType: param.parameterType,
            value: param.value,
          })),
        );
        // Rifai la query per ottenere tutti i dati con gli ID corretti
        const updatedParameters = await db
          .select()
          .from(dddevStandardParameters);
        const updatedNormalized = updatedParameters.map((param) =>
          toNumberFields(param, standardParameterDecimalKeys),
        );
        // Ordina per garantire l'ordine corretto
        const sorted = allParameterTypes
          .map((parameterType) =>
            updatedNormalized.find((p) => p.parameterType === parameterType),
          )
          .filter((p): p is StandardParameter => p !== undefined);
        return NextResponse.json({ parameters: sorted }, { status: 200 });
      } catch (insertError) {
        // Se l'inserimento fallisce (es. duplicate key), rifai la query comunque
        console.warn(
          'Failed to insert missing parameters, fetching existing',
          insertError,
        );
        const existingParameters = await db
          .select()
          .from(dddevStandardParameters);
        const existingNormalized = existingParameters.map((param) =>
          toNumberFields(param, standardParameterDecimalKeys),
        );
        // Completa con i parametri mancanti
        const complete = allParameterTypes.map((parameterType) => {
          const existing = existingNormalized.find(
            (p) => p.parameterType === parameterType,
          );
          return (
            existing ||
            ({
              id: 0,
              parameterType,
              value: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as StandardParameter)
          );
        });
        return NextResponse.json({ parameters: complete }, { status: 200 });
      }
    }

    return NextResponse.json({ parameters: result }, { status: 200 });
  } catch (e) {
    console.error('Get standard parameters failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: 'Failed to fetch standard parameters', details: errorMessage },
      { status: 500 },
    );
  }
}

// PUT /api/parameters/standard
// Body: { parameters: Array<{ parameterType: ParameterType, value: number }> }
export async function PUT(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    parameters,
  }: {
    parameters: Array<{ parameterType: ParameterType; value: number }>;
  } = body;

  if (!Array.isArray(parameters)) {
    return NextResponse.json(
      { error: 'Missing or invalid parameters array' },
      { status: 400 },
    );
  }

  try {
    await db.transaction(async (tx) => {
      for (const param of parameters) {
        await tx
          .update(dddevStandardParameters)
          .set({ value: param.value })
          .where(
            eq(dddevStandardParameters.parameterType, param.parameterType),
          );
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error('Update standard parameters failed', e);
    return NextResponse.json(
      { error: 'Failed to update standard parameters' },
      { status: 500 },
    );
  }
}
