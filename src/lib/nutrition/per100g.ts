import { IngredientNutritionAttributeUnit } from '@/types';

export const NUTRITION_KEYS = [
  'kcal',
  'kj',
  'protein',
  'carbo',
  'sugar',
  'polioli',
  'fat',
  'saturi',
  'fiber',
  'salt',
] as const;

export type NutritionKey = (typeof NUTRITION_KEYS)[number];

export type NutritionTotals = Partial<Record<NutritionKey, number>>;

export interface PerHundredArgs {
  totals: NutritionTotals;
  totalQuantity: number; // grams
  waterPercent?: number; // percentage of water in raw mix
  overrideDryMass?: number; // optional cooked mass in grams
  energyTolerancePercent?: number; // default 10%
}

export interface PerHundredResult {
  per100g: Record<NutritionKey, number>;
  dryMass: number;
  factor: number;
  kcalCheck: {
    theoretical: number;
    declared: number;
    deltaPercent: number;
    isValid: boolean;
    tolerance: number;
  };
}

const DEFAULT_TOLERANCE = 10;

const DECIMALS = {
  kcal: 2,
  kj: 2,
  default: 3,
};

function roundValue(key: NutritionKey, value: number): number {
  const digits =
    key === 'kcal' || key === 'kj' ? DECIMALS[key] : DECIMALS.default;
  return Number(value.toFixed(digits));
}

function ensureAllKeys(totals: NutritionTotals): Record<NutritionKey, number> {
  const filled = {} as Record<NutritionKey, number>;
  for (const key of NUTRITION_KEYS) {
    filled[key] = Number(totals[key]) || 0;
  }
  return filled;
}

export function computeWaterAdjustedPer100g({
  totals,
  totalQuantity,
  waterPercent = 0,
  overrideDryMass,
  energyTolerancePercent = DEFAULT_TOLERANCE,
}: PerHundredArgs): PerHundredResult {
  const safeTotalQuantity = Math.max(totalQuantity, 0);
  const baseTotals = ensureAllKeys(totals);

  const dryMass = Math.max(
    overrideDryMass ??
      safeTotalQuantity - (safeTotalQuantity * waterPercent) / 100,
    1,
  );

  const factor = 100 / dryMass;
  const per100g: Record<NutritionKey, number> = {} as Record<
    NutritionKey,
    number
  >;

  for (const key of NUTRITION_KEYS) {
    per100g[key] = roundValue(key, baseTotals[key] * factor);
  }

  const theoreticalKcal = roundValue(
    'kcal',
    (per100g.carbo + per100g.protein) * 4 + per100g.fat * 9,
  );

  const declaredKcal = per100g.kcal;
  const deltaPercent = declaredKcal
    ? Number(
        Math.abs(
          ((declaredKcal - theoreticalKcal) / declaredKcal) * 100,
        ).toFixed(2),
      )
    : 0;

  return {
    per100g,
    dryMass: Number(dryMass.toFixed(3)),
    factor: Number(factor.toFixed(6)),
    kcalCheck: {
      theoretical: theoreticalKcal,
      declared: declaredKcal,
      deltaPercent,
      isValid: deltaPercent <= energyTolerancePercent,
      tolerance: energyTolerancePercent,
    },
  };
}

export function formatNutritionLabel(key: NutritionKey): string {
  const unit =
    IngredientNutritionAttributeUnit[
      key as keyof typeof IngredientNutritionAttributeUnit
    ];
  return `${key} (${unit})`;
}
