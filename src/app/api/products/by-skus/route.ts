import { NextResponse } from 'next/server';
import { fetchProductsBySkus } from '@/app/api/products/utils';

type RequestPayload = {
  skus?: string[];
  includeNutritionAttributes?: boolean;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let payload: RequestPayload;
  try {
    payload = (await request.json()) as RequestPayload;
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!payload?.skus || !Array.isArray(payload.skus)) {
    return badRequest('Missing "skus" array in request body');
  }

  try {
    const result = await fetchProductsBySkus(payload.skus, {
      includeNutritionAttributes: payload.includeNutritionAttributes ?? true,
    });
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('fetchProductsBySkus failed', error);
    return NextResponse.json(
      { error: 'Failed to fetch products by SKU' },
      { status: 500 },
    );
  }
}
