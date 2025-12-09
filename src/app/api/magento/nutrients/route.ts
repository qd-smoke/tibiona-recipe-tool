import { NextResponse } from 'next/server';

const DEFAULT_BASE_URL = process.env.DATASHEET_BASE_URL;
const FALLBACK_BASE_URL = process.env.NEXT_PUBLIC_DATASHEET_BASE_URL;

const datasheetBaseUrl =
  DEFAULT_BASE_URL ??
  FALLBACK_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  '';

const NUTRIENT_FIELD_KEYS = [
  'kj',
  'kcal',
  'protein',
  'carbo',
  'sugar',
  'fiber',
  'fat',
  'saturi',
  'salt',
  'polyoli',
] as const;

type NutrientFieldKey = (typeof NUTRIENT_FIELD_KEYS)[number];

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL?.replace(/\/$/, '') ??
  'https://api.openai.com/v1';
const OPENAI_NUTRITION_MODEL =
  process.env.OPENAI_NUTRITION_MODEL ?? 'gpt-4o-mini';
const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID;

function resolveBaseUrl(): URL | null {
  if (!datasheetBaseUrl) {
    return null;
  }
  try {
    return new URL(datasheetBaseUrl);
  } catch {
    return null;
  }
}

type ProxyPayload =
  | {
      action: 'fetch';
      sku: string;
    }
  | {
      action: 'update_attr';
      sku: string;
      attr: string;
      val: string | number | null;
    }
  | {
      action: 'bulk_update';
      sku: string;
      entries: Array<{
        attr: string;
        val: string | number | null;
      }>;
    }
  | {
      action: 'estimate_ai';
      sku: string;
      name?: string;
      description?: string;
      notes?: string;
      context?: Record<string, unknown>;
    };

export async function POST(request: Request) {
  let payload: ProxyPayload;
  try {
    payload = (await request.json()) as ProxyPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!payload?.action || !payload?.sku) {
    return NextResponse.json(
      { ok: false, error: 'Missing required parameters' },
      { status: 400 },
    );
  }

  if (payload.action === 'estimate_ai') {
    try {
      const estimation = await estimateNutritionWithAI(payload);
      return NextResponse.json({ ok: true, data: estimation }, { status: 200 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI estimation failed';
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  const base = resolveBaseUrl();
  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'DATASHEET_BASE_URL env var is not configured' },
      { status: 500 },
    );
  }

  const normalizedBaseHref = base.href.endsWith('/')
    ? base.href
    : `${base.href}/`;
  const target = new URL('./datasheet/nutrienti.php', normalizedBaseHref);

  if (payload.action === 'bulk_update') {
    return handleBulkUpdate(payload, target);
  }

  if (payload.action === 'fetch') {
    target.searchParams.set('api', '1');
  }

  const params = buildDatasheetParams(payload);

  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'no-store',
    });

    const responseText = await upstream.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Upstream response is not valid JSON. Check DATASHEET_BASE_URL target.',
          raw: responseText.slice(0, 200),
        },
        { status: 502 },
      );
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: (parsed as Record<string, unknown>)?.error ?? 'Upstream error',
        },
        { status: upstream.status },
      );
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    console.error('magento nutrients proxy failed', error);
    return NextResponse.json(
      { ok: false, error: 'Proxy request failed' },
      { status: 500 },
    );
  }
}

function buildDatasheetParams(
  payload: Extract<ProxyPayload, { action: string }>,
) {
  const params = new URLSearchParams();
  params.set('action', payload.action);
  params.set('sku', payload.sku);

  if (payload.action === 'update_attr') {
    params.set('attr', payload.attr);
    params.set('val', payload.val?.toString() ?? '');
  }

  return params;
}

async function handleBulkUpdate(
  payload: Extract<ProxyPayload, { action: 'bulk_update' }>,
  target: URL,
) {
  if (!Array.isArray(payload.entries) || payload.entries.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No entries provided for bulk update' },
      { status: 400 },
    );
  }

  const results: Array<{
    attr: string;
    ok: boolean;
    error?: string;
  }> = [];

  for (const entry of payload.entries) {
    const params = new URLSearchParams();
    params.set('action', 'update_attr');
    params.set('sku', payload.sku);
    params.set('attr', entry.attr);
    params.set('val', entry.val?.toString() ?? '');

    try {
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        cache: 'no-store',
      });

      const responseText = await upstream.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        // swallow parse errors, handled below
      }

      const ok =
        upstream.ok && Boolean((parsed as Record<string, unknown>)?.ok);
      if (!ok) {
        results.push({
          attr: entry.attr,
          ok: false,
          error: String(
            (parsed as Record<string, unknown>)?.error ??
              `Upstream error (${upstream.status})`,
          ),
        });
      } else {
        results.push({ attr: entry.attr, ok: true });
      }
    } catch (error) {
      results.push({
        attr: entry.attr,
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unknown bulk update error',
      });
    }
  }

  const hasErrors = results.some((result) => !result.ok);
  return NextResponse.json(
    {
      ok: !hasErrors,
      results,
      error: hasErrors ? 'One or more attributes failed to update' : undefined,
    },
    { status: hasErrors ? 502 : 200 },
  );
}

type NutritionEstimatePayload = Extract<
  ProxyPayload,
  { action: 'estimate_ai' }
>;

async function estimateNutritionWithAI(payload: NutritionEstimatePayload) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const descriptionParts = [
    `SKU: ${payload.sku}`,
    payload.name ? `Nome: ${payload.name}` : null,
    payload.description ? `Descrizione: ${payload.description}` : null,
    payload.notes ? `Note: ${payload.notes}` : null,
    payload.context
      ? `Metadati: ${JSON.stringify(payload.context, null, 2)}`
      : null,
  ].filter(Boolean);

  const systemPrompt =
    'Sei un tecnologo alimentare esperto. Ricevi informazioni su un prodotto alimentare e devi stimare i valori nutrizionali per 100 grammi. Restituisci solo i valori richiesti, senza testo aggiuntivo. Se un valore non è noto fornisci la migliore stima possibile basandoti su prodotti simili.';

  const userPrompt = `Fornisci una stima realistica per 100 g del prodotto seguente.\n\n${descriptionParts.join(
    '\n',
  )}\n\nRestituisci ESCLUSIVAMENTE un JSON con queste chiavi numeriche: ${NUTRIENT_FIELD_KEYS.join(
    ', ',
  )}.`;

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      ...(OPENAI_ORG_ID ? { 'OpenAI-Organization': OPENAI_ORG_ID } : {}),
    },
    body: JSON.stringify({
      model: OPENAI_NUTRITION_MODEL,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'nutrition_estimate',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: NUTRIENT_FIELD_KEYS.reduce<Record<string, unknown>>(
              (acc, key) => ({
                ...acc,
                [key]: {
                  description: `Valore stimato per ${key}`,
                  type: ['number', 'string'],
                },
              }),
              {},
            ),
          },
        },
      },
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI request failed (${response.status}): ${errorText.slice(0, 200)}`,
    );
  }

  const completion = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawContent =
    completion.choices?.[0]?.message?.content?.trim() ?? undefined;

  if (!rawContent) {
    throw new Error('OpenAI response did not include any content');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    throw new Error(
      `Failed to parse OpenAI response as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const normalized: Partial<Record<NutrientFieldKey, string>> = {};

  for (const key of NUTRIENT_FIELD_KEYS) {
    const value = parsed[key];
    if (value === undefined || value === null) {
      continue;
    }
    const numeric =
      typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (!Number.isFinite(numeric)) {
      continue;
    }
    normalized[key] = numeric.toString();
  }

  return {
    source: 'openai',
    nutrients: normalized,
  };
}
