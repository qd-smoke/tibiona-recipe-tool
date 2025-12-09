import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  catalogProductEntity,
  catalogProductEntityVarchar,
  catalogProductEntityDecimal,
} from '@/db/schema';
import {
  IngredientNutritionAttributeCode,
  IngredientNutritionAttributes,
  MagentoProduct,
  MagentoProductWithNutritionAttributes,
} from '@/types';

export const ingredientNutritionAttributeIdMap: Record<
  IngredientNutritionAttributeCode,
  number
> = {
  kcal: 349,
  kj: 350,
  protein: 351,
  carbo: 352,
  sugar: 353,
  fiber: 354,
  fat: 355,
  saturi: 356,
  salt: 357,
  polioli: 409,
};

// Magento custom attribute IDs
export const MAGENTO_ATTRIBUTE_IDS = {
  cost_price_list: 410,
  supplier: 408,
  warehouse_location: 234,
} as const;

const unitByCode: Record<IngredientNutritionAttributeCode, string> = {
  kcal: 'kcal',
  kj: 'kJ',
  protein: 'g',
  carbo: 'g',
  sugar: 'g',
  fiber: 'g',
  fat: 'g',
  saturi: 'g',
  salt: 'g',
  polioli: 'g',
};

// Helper function to enrich products with custom Magento attributes
async function enrichWithProductAttributes(items: MagentoProduct[]): Promise<
  Array<
    MagentoProduct & {
      cost_price_list?: number;
      supplier?: string;
      warehouse_location?: string;
    }
  >
> {
  const entityIds = items.map((i) => i.entityId);
  if (entityIds.length === 0) return items;

  // Fetch string attributes (supplier, warehouse_location) from varchar table
  const stringAttributeIds = [
    MAGENTO_ATTRIBUTE_IDS.supplier,
    MAGENTO_ATTRIBUTE_IDS.warehouse_location,
  ];
  const varcharResults = await db
    .select()
    .from(catalogProductEntityVarchar)
    .where(
      and(
        inArray(catalogProductEntityVarchar.attributeId, stringAttributeIds),
        inArray(catalogProductEntityVarchar.storeId, [0, 1]),
        inArray(catalogProductEntityVarchar.entityId, entityIds),
      ),
    );

  // Fetch numeric attributes (cost_price_list) from decimal table
  const decimalResults = await db
    .select()
    .from(catalogProductEntityDecimal)
    .where(
      and(
        eq(
          catalogProductEntityDecimal.attributeId,
          MAGENTO_ATTRIBUTE_IDS.cost_price_list,
        ),
        inArray(catalogProductEntityDecimal.storeId, [0, 1]),
        inArray(catalogProductEntityDecimal.entityId, entityIds),
      ),
    );

  // Group varchar attributes
  const varcharMap = new Map<
    number,
    {
      entityId: number;
      values: Record<number, { value: string; storeId: number }>;
    }
  >();

  for (const item of varcharResults) {
    const { entityId, attributeId, storeId, value } = item;

    if (!varcharMap.has(entityId)) {
      varcharMap.set(entityId, {
        entityId,
        values: {},
      });
    }

    const entityGroup = varcharMap.get(entityId)!;
    const existing = entityGroup.values[attributeId];

    if (!existing || (existing.storeId !== 0 && storeId === 0)) {
      entityGroup.values[attributeId] = {
        value: value ?? '',
        storeId,
      };
    }
  }

  // Group decimal attributes
  const decimalMap = new Map<
    number,
    {
      entityId: number;
      values: Record<number, { value: number; storeId: number }>;
    }
  >();

  for (const item of decimalResults) {
    const { entityId, attributeId, storeId, value } = item;

    if (!decimalMap.has(entityId)) {
      decimalMap.set(entityId, {
        entityId,
        values: {},
      });
    }

    const entityGroup = decimalMap.get(entityId)!;
    const existing = entityGroup.values[attributeId];

    if (!existing || (existing.storeId !== 0 && storeId === 0)) {
      entityGroup.values[attributeId] = {
        value:
          typeof value === 'number'
            ? value
            : Number.parseFloat(String(value)) || 0,
        storeId,
      };
    }
  }

  return items.map((item) => {
    const varcharAttributes = varcharMap.get(item.entityId);
    const decimalAttributes = decimalMap.get(item.entityId);

    const enriched: typeof item & {
      cost_price_list?: number;
      supplier?: string;
      warehouse_location?: string;
    } = { ...item };

    // Extract cost_price_list from decimal table
    if (decimalAttributes) {
      const costPriceListEntry =
        decimalAttributes.values[MAGENTO_ATTRIBUTE_IDS.cost_price_list];
      if (costPriceListEntry?.value && costPriceListEntry.value > 0) {
        enriched.cost_price_list = costPriceListEntry.value;
      }
    }

    // Extract supplier (string) from varchar table
    if (varcharAttributes) {
      const supplierEntry =
        varcharAttributes.values[MAGENTO_ATTRIBUTE_IDS.supplier];
      if (supplierEntry?.value) {
        enriched.supplier = supplierEntry.value;
      }

      // Extract warehouse_location (string) from varchar table
      const warehouseLocationEntry =
        varcharAttributes.values[MAGENTO_ATTRIBUTE_IDS.warehouse_location];
      if (warehouseLocationEntry?.value) {
        enriched.warehouse_location = warehouseLocationEntry.value;
      }
    }

    return enriched;
  });
}

export async function enrichWithNutrition(
  items: MagentoProduct[],
): Promise<MagentoProductWithNutritionAttributes[]> {
  const entityIds = items.map((i) => i.entityId);
  if (entityIds.length === 0) return items;

  const results = await db
    .select()
    .from(catalogProductEntityVarchar)
    .where(
      and(
        inArray(
          catalogProductEntityVarchar.attributeId,
          Object.values(ingredientNutritionAttributeIdMap),
        ),
        inArray(catalogProductEntityVarchar.storeId, [0, 1]),
        inArray(catalogProductEntityVarchar.entityId, entityIds),
      ),
    );

  const groupedMap = new Map<
    number,
    {
      entityId: number;
      values: Record<number, { value: string; storeId: number }>;
    }
  >();

  for (const item of results) {
    const { entityId, attributeId, storeId, value } = item;

    if (!groupedMap.has(entityId)) {
      groupedMap.set(entityId, {
        entityId,
        values: {},
      });
    }

    const entityGroup = groupedMap.get(entityId)!;
    const existing = entityGroup.values[attributeId];

    if (!existing || (existing.storeId !== 0 && storeId === 0)) {
      entityGroup.values[attributeId] = {
        value: value ?? '',
        storeId,
      };
    }
  }

  // Enrich with product attributes (cost_price_list, supplier, warehouse_location)
  const enrichedWithAttributes = await enrichWithProductAttributes(items);

  return enrichedWithAttributes.map((item) => {
    const nutrition = groupedMap.get(item.entityId);
    if (!nutrition) return item;

    const nutritionAttributes: IngredientNutritionAttributes = {};
    const typedAttributes = nutritionAttributes as Partial<
      Record<IngredientNutritionAttributeCode, { value: number; unit: string }>
    >;

    for (const [code, attributeId] of Object.entries(
      ingredientNutritionAttributeIdMap,
    ) as [IngredientNutritionAttributeCode, number][]) {
      const rawEntry = nutrition.values[attributeId];
      const rawValue = rawEntry?.value;
      const numericValue = Number.parseFloat(rawValue ?? '');

      if (!Number.isNaN(numericValue)) {
        typedAttributes[code] = {
          value: numericValue,
          unit: unitByCode[code],
        };
      }
    }

    return {
      ...item,
      nutritionAttributes,
    };
  });
}

export async function fetchProductsBySkus(
  skus: string[],
  opts: { includeNutritionAttributes?: boolean } = {},
) {
  const normalizedSkus = skus
    .map((sku) => (typeof sku === 'string' ? sku.trim().toLowerCase() : ''))
    .filter((sku) => sku.length > 0);

  if (normalizedSkus.length === 0) {
    return { items: [] as MagentoProductWithNutritionAttributes[] };
  }

  // Search directly in catalog_product_entity table (like Excel query does)
  // This is the base table that contains all products with SKU as a direct column
  // DO NOT use catalog_product_flat_1 - it may not contain all products
  const skuConditions =
    normalizedSkus.length === 1
      ? sql`LOWER(TRIM(${catalogProductEntity.sku})) = ${normalizedSkus[0]}`
      : or(
          ...normalizedSkus.map(
            (sku) => sql`LOWER(TRIM(${catalogProductEntity.sku})) = ${sku}`,
          ),
        )!;

  // Find entity_ids by SKU from catalog_product_entity (base table)
  const skuResults = await db
    .select({
      entityId: catalogProductEntity.entityId,
      sku: catalogProductEntity.sku,
    })
    .from(catalogProductEntity)
    .where(and(eq(catalogProductEntity.typeId, 'simple'), skuConditions));

  if (skuResults.length === 0) {
    return { items: [] as MagentoProductWithNutritionAttributes[] };
  }

  const entityIds = skuResults.map((r) => r.entityId);

  // Fetch product names from catalog_product_entity_varchar (attribute_id = 73 for 'name')
  const NAME_ATTRIBUTE_ID = 73;
  const nameResults = await db
    .select({
      entityId: catalogProductEntityVarchar.entityId,
      storeId: catalogProductEntityVarchar.storeId,
      name: catalogProductEntityVarchar.value,
    })
    .from(catalogProductEntityVarchar)
    .where(
      and(
        eq(catalogProductEntityVarchar.attributeId, NAME_ATTRIBUTE_ID),
        inArray(catalogProductEntityVarchar.storeId, [0, 1]),
        inArray(catalogProductEntityVarchar.entityId, entityIds),
      ),
    );

  // Create a map of entityId -> name, preferring store_id = 0 (default store) over store_id = 1
  // Sort results to process store_id = 0 first
  const sortedNameResults = [...nameResults].sort(
    (a, b) => a.storeId - b.storeId,
  );
  const nameMap = new Map<number, string>();
  for (const nameResult of sortedNameResults) {
    // Only set if not already set (store_id = 0 will be processed first)
    if (!nameMap.has(nameResult.entityId) && nameResult.name) {
      nameMap.set(nameResult.entityId, nameResult.name);
    }
  }

  // Fetch product weights from catalog_product_entity_decimal (attribute_id = 82 for 'weight')
  const WEIGHT_ATTRIBUTE_ID = 82;
  const weightResults = await db
    .select({
      entityId: catalogProductEntityDecimal.entityId,
      storeId: catalogProductEntityDecimal.storeId,
      weight: catalogProductEntityDecimal.value,
    })
    .from(catalogProductEntityDecimal)
    .where(
      and(
        eq(catalogProductEntityDecimal.attributeId, WEIGHT_ATTRIBUTE_ID),
        inArray(catalogProductEntityDecimal.storeId, [0, 1]),
        inArray(catalogProductEntityDecimal.entityId, entityIds),
      ),
    );

  // Create a map of entityId -> weight, preferring store_id = 0 (default store) over store_id = 1
  // Sort results to process store_id = 0 first
  const sortedWeightResults = [...weightResults].sort(
    (a, b) => a.storeId - b.storeId,
  );
  const weightMap = new Map<number, number>();
  for (const weightResult of sortedWeightResults) {
    // Only set if not already set (store_id = 0 will be processed first)
    if (!weightMap.has(weightResult.entityId) && weightResult.weight !== null) {
      const weightValue = Number(weightResult.weight);
      if (!Number.isNaN(weightValue) && weightValue > 0) {
        weightMap.set(weightResult.entityId, weightValue);
      }
    }
  }

  // Build products from base tables (catalog_product_entity + attribute tables)
  // Using catalog_product_flat_1 would miss products not indexed in flat table
  const products: MagentoProduct[] = [];

  for (const skuResult of skuResults) {
    const productName = nameMap.get(skuResult.entityId) || null;
    const productWeight = weightMap.get(skuResult.entityId) || 0;
    // Create a product object with name and weight from attribute tables
    // Additional attributes will be fetched by enrichWithNutrition if needed
    const product: MagentoProduct = {
      entityId: skuResult.entityId,
      typeId: 'simple',
      sku: skuResult.sku,
      name: productName,
      description: null,
      shortDescription: null,
      price: 0,
      weight: productWeight,
      image: null,
      smallImage: null,
      thumbnail: null,
    };
    products.push(product);
  }

  if (!opts.includeNutritionAttributes || products.length === 0) {
    return { items: products };
  }

  const enriched = await enrichWithNutrition(products);
  return { items: enriched };
}
