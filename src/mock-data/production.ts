// src/mock-data/production.ts

// Data models
export type Unit = 'kg' | 'g' | 'pcs' | string;

export type IngredientNutritionAttributes = {
  kcal?: {
    value?: number;
    unit?: 'kcal' | string;
  };
  kj?: {
    value?: number;
    unit?: 'kJ' | string;
  };
  protein?: {
    value?: number;
    unit?: 'g' | string;
  };
  carbo?: {
    value?: number;
    unit?: 'g' | string;
  };
  sugar?: {
    value?: number;
    unit?: 'g' | string;
  };
  fiber?: {
    value?: number;
    unit?: 'g' | string;
  };
  fat?: {
    value?: number;
    unit?: 'g' | string;
  };
  saturi?: {
    value?: number;
    unit?: 'g' | string;
  };
  salt?: {
    value?: number;
    unit?: 'g' | string;
  };
};

export type Ingredient = {
  id: number;
  recipe_id?: string;
  sku: string;
  name: string;
  qty_required: number;
  unit: Unit;
  nutritionAttributes?: IngredientNutritionAttributes;
};

export type CookingInfo = {
  time_minutes?: number;
  temperature_celsius?: number;
  final_product_weight_kg?: number;
  dimensions?: { height_cm?: number; diameter_cm?: number };
};

export type RecipeData = {
  id: number; // optional on client; numeric ID assigned by server
  name: string;
  base_yield: { value: number; unit: Unit };
  ingredients: Ingredient[];
  cooking?: CookingInfo;
  notes?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export type ProductionOrder = {
  order_id: string;
  recipe_id: string;
  target_production_qty: number;
  target_unit: Unit;
  waste_factor_pct?: number; // optional, applied to required qty
  computed_ingredients: {
    sku: string;
    name: string;
    required_qty: number;
    unit: Unit;
    package_weight?: number;
    packages_needed?: number;
  }[];
};

export type ExecutionInput = {
  sku: string;
  package_sku: string;
  lot_number?: string;
  supplier?: string;
  qty_required?: number;
  unit_required?: Unit;
  qty_used?: number;
  unit_used?: Unit;
};

export type ExecutionLog = {
  done_id: string;
  order_id: string;
  recipe_id: string;
  production_date: string; // ISO
  operator_id: string;
  inputs: ExecutionInput[];
  variations?: {
    sku: string;
    field: string;
    from: number;
    to: number;
    reason?: string;
  }[];
  outputs?: {
    units_produced?: number;
    unit_weight_kg?: number;
    scrap_kg?: number;
  };
  notes?: string;
};

// Some historical execution logs for the recipe
export const executionLogs: ExecutionLog[] = [
  {
    done_id: 'RD-2025-08-18-001',
    order_id: 'PO-2025-08-18-001',
    recipe_id: 'PANETTONE_CANDITI_001',
    production_date: '2025-08-18T08:30:00Z',
    operator_id: 'OPR-012',
    inputs: [
      {
        sku: 'SUGAR-CANE-25KG-MASCOBADO',
        package_sku: 'SUGAR-CANE-25KG-MASCOBADO',
        lot_number: 'LOT2025-123',
        supplier: 'Fornitore A',
        qty_required: 5.1,
        unit_required: 'kg',
        qty_used: 5.2,
        unit_used: 'kg',
      },
      {
        sku: 'FLOUR-WHEAT-50KG',
        package_sku: 'FLOUR-WHEAT-50KG',
        lot_number: 'LOT2025-567',
        supplier: 'Fornitore B',
        qty_required: 10.5,
        unit_required: 'kg',
        qty_used: 9.8,
        unit_used: 'kg',
      },
    ],
    variations: [
      {
        sku: 'FLOUR-WHEAT-50KG',
        field: 'qty_required',
        from: 10.5,
        to: 9.8,
        reason: 'impasto umido',
      },
    ],
    outputs: { units_produced: 100, unit_weight_kg: 1.0, scrap_kg: 0.3 },
    notes: 'Ok impasto, +2 min cottura',
  },
];
