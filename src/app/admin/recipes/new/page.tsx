'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ProductPickerModal from '@/components/ProductPickerModal';
import { NutritionDataRows } from '@/components/NutritionDataRows';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { useSetToast } from '@/state/ToastProvider';
import {
  IngredientNutritionAttributeCode,
  IngredientNutritionAttributes,
  IngredientNutritionAttributeUnit,
  MagentoProductWithNutritionAttributes,
  MagentoRecipe,
  NewIngredientProps,
  NewRecipeProps,
} from '@/types';
import { apiClient } from '@/helpers/api';
import { Section } from '@/components/Section';
import { Button } from '@/components/Button';
import { toNumberStrict } from '@/helpers/utils';
import Checkbox from '@/components/Checkbox';
import { IngredientProductSearch } from '@/components/IngredientProductSearch';
import {
  NUTRITION_KEYS,
  NutritionTotals,
  computeWaterAdjustedPer100g,
} from '@/lib/nutrition/per100g';

const nutritionFields = NUTRITION_KEYS;
const nutritionLabels: Record<(typeof nutritionFields)[number], string> = {
  kcal: 'Kcal',
  kj: 'kJ',
  protein: 'Proteine',
  carbo: 'Carboidrati',
  sugar: 'di cui zuccheri',
  polioli: 'di cui polioli',
  fat: 'Grassi',
  saturi: 'di cui saturi',
  fiber: 'Fibre',
  salt: 'Sale',
};

export default function AdminRecipeCreatePage() {
  const setToast = useSetToast();
  const [saving, setSaving] = React.useState(false);

  const [recipeData, setRecipeData] = React.useState<NewRecipeProps>({
    createdAt: undefined,
    heightCm: undefined,
    id: undefined,
    lengthCm: undefined,
    name: '',
    notes: undefined,
    numberOfPackages: undefined,
    packageWeight: undefined,
    temperatureCelsius: undefined,
    timeMinutes: undefined,
    totalQtyForRecipe: undefined,
    updatedAt: undefined,
    wastePercent: undefined,
    waterPercent: undefined,
    widthCm: undefined,
  });

  const setRecipeDataByKey = <K extends keyof NewRecipeProps>(
    key: K,
    value: NewRecipeProps[K],
  ) => {
    setRecipeData((prev: NewRecipeProps) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Basic validation
      if (!recipeData.name || recipeData.name.trim().length === 0) {
        setToast('Please provide a recipe name.', { type: 'error' });
        return;
      }

      // Prepare recipe data
      const recipePayload: NewRecipeProps = {
        ...recipeData,
        totalQtyForRecipe,
      };

      // Prepare ingredients data
      const preparedIngredients: NewIngredientProps[] = skus.map((sku) => {
        const nutrition = nutritionData.get(sku) || {};

        return {
          sku,
          name: ingredientName.get(sku) || '',
          qtyForRecipe: qtyForRecipe.get(sku) || 0,
          qtyOriginal: qtyOriginal.get(sku) || 0,
          priceCostPerKg: priceCostPerKg.get(sku) || 0,
          isPowderIngredient: powderIngredients.get(sku) ? 1 : 0,
          supplier: supplier.get(sku) || null,
          warehouseLocation: warehouseLocation.get(sku) || null,
          mpSku: mpSku.get(sku) || null,
          productName: productName.get(sku) || null,
          kcal: nutrition.kcal?.value || 0,
          kj: nutrition.kj?.value || 0,
          protein: nutrition.protein?.value || 0,
          carbo: nutrition.carbo?.value || 0,
          sugar: nutrition.sugar?.value || 0,
          fat: nutrition.fat?.value || 0,
          saturi: nutrition.saturi?.value || 0,
          fiber: nutrition.fiber?.value || 0,
          salt: nutrition.salt?.value || 0,
          polioli: nutrition.polioli?.value || 0,
          lot: null,
          done: 0,
          checkGlutine: 0,
        };
      });

      const { success, createdRecipe, error } = (await apiClient.post(
        '/api/recipes',
        {
          recipeData: recipePayload,
          ingredients: preparedIngredients,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      )) as { success: boolean; createdRecipe: MagentoRecipe; error?: string };

      // Update local state with server response mapping back
      if (success) {
        // redirect to recipe page
        setToast(
          'Recipe saved successfully, redirecting to recipe details...',
          {
            type: 'success',
          },
        );
        setTimeout(() => {
          window.location.href = `/recipes/${createdRecipe.id}`;
        }, 1000);
        return;
      } else {
        setToast(`Failed to save recipe: ${error}`, { type: 'error' });
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error('Error saving recipe', e);
        setToast(`Error saving recipe: ${e.message}`, { type: 'error' });
      } else {
        console.error('Unknown error', e);
        setToast('Unknown error occurred', { type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const [skus, setSkus] = useState<string[]>([]);
  const [ingredientName, setIngredientName] = useState<Map<string, string>>(
    new Map(),
  );

  // This value is set manually
  // It will scale the qtyForRecipe of each ingredient based on their percent on total original qty
  const [totalQtyForRecipe, setTotalQtyForRecipe] = useState<number>(0);

  // This value is set manually
  // It will build up the percent for each ingredient
  const [qtyOriginal, setQtyOriginal] = useState<Map<string, number>>(
    new Map(),
  );

  const handleQtyOriginalChange = useCallback((sku: string, value: number) => {
    setQtyOriginal((prev) => {
      const newQtyOriginal = new Map(prev);
      newQtyOriginal.set(sku, value);
      return newQtyOriginal;
    });
  }, []);

  const totalQtyOriginal = useMemo(() => {
    return Array.from(qtyOriginal.values()).reduce(
      (total, qty) => total + qty,
      0,
    );
  }, [qtyOriginal]);

  const totalWastePercent = useMemo(() => {
    return (recipeData.wastePercent || 0) + (recipeData.waterPercent || 0);
  }, [recipeData.wastePercent, recipeData.waterPercent]);

  useEffect(() => {
    const value =
      (((recipeData.packageWeight || 0) * (recipeData.numberOfPackages || 0)) /
        (100 - totalWastePercent)) *
      100;
    setTotalQtyForRecipe(Number(value.toFixed(2)));
  }, [
    recipeData.packageWeight,
    recipeData.numberOfPackages,
    totalWastePercent,
  ]);

  const cookedWeightGross = useMemo(() => {
    const value = (totalQtyForRecipe * (100 - totalWastePercent)) / 100;
    return Number(value.toFixed(2));
  }, [totalQtyForRecipe, totalWastePercent]);

  const percentOnTotalQtyOriginal = useMemo(() => {
    const percentOnTotalValue = new Map();
    const totalQty = totalQtyOriginal; // Avoid repeated access to the memoized value

    if (totalQty === 0) return percentOnTotalValue; // Handle edge case of totalQty being 0

    for (const [sku, qty] of qtyOriginal) {
      const value = ((qty / totalQty) * 100).toFixed(2);
      percentOnTotalValue.set(sku, Number(value));
    }

    return percentOnTotalValue;
  }, [qtyOriginal, totalQtyOriginal]);

  const qtyForRecipe = useMemo(() => {
    const qtyForRecipeValue = new Map<string, number>();
    for (const [sku, percent] of percentOnTotalQtyOriginal) {
      const value = ((percent / 100) * totalQtyForRecipe).toFixed(2);

      qtyForRecipeValue.set(sku, Number(value));
    }

    return qtyForRecipeValue;
  }, [totalQtyForRecipe, percentOnTotalQtyOriginal]);

  const [powderIngredients, setPowderIngredients] = useState<
    Map<string, boolean>
  >(new Map());

  // Magento product fields
  const [supplier, setSupplier] = useState<Map<string, string>>(new Map());
  const [warehouseLocation, setWarehouseLocation] = useState<
    Map<string, string>
  >(new Map());
  const [mpSku, setMpSku] = useState<Map<string, string>>(new Map());
  const [productName, setProductName] = useState<Map<string, string>>(
    new Map(),
  );

  const handlePowerIngredientsChange = useCallback(
    (sku: string, value: boolean) => {
      setPowderIngredients((prev) => {
        const newPowderIngredients = new Map(prev);
        newPowderIngredients.set(sku, value);
        return newPowderIngredients;
      });
    },
    [],
  );

  const totalOriginalPowderQty = useMemo(() => {
    return powderIngredients.entries().reduce((total, [sku, isPower]) => {
      if (isPower) {
        const qty = qtyOriginal.get(sku) || 0;
        return total + qty;
      }

      return total;
    }, 0);
  }, [powderIngredients, qtyOriginal]);

  const percentOfPowder = useMemo(() => {
    const percentOfPowderValue = new Map<string, number>();
    for (const [sku, isPower] of powderIngredients) {
      if (isPower) {
        const value = (
          (Number(qtyOriginal.get(sku) || 0) / totalOriginalPowderQty) *
          100
        ).toFixed(2);

        percentOfPowderValue.set(sku, Number(value));
      } else {
        percentOfPowderValue.set(sku, 0);
      }
    }

    return percentOfPowderValue;
  }, [qtyOriginal, powderIngredients, totalOriginalPowderQty]);

  const [priceCostPerKg, setPriceCostPerKg] = useState<Map<string, number>>(
    new Map(),
  );

  const _priceCostBasedOnQtyOriginal = useMemo(() => {
    const priceCostBasedOnQtyOriginalValue = new Map<string, number>();
    for (const [sku, qty] of qtyOriginal) {
      const value = (
        (Number(qty) / 1000) *
        Number(priceCostPerKg.get(sku) || 0)
      ).toFixed(2);

      priceCostBasedOnQtyOriginalValue.set(sku, Number(value));
    }

    return priceCostBasedOnQtyOriginalValue;
  }, [qtyOriginal, priceCostPerKg]);

  const priceCostBasedOnQtyForRecipe = useMemo(() => {
    const priceCostBasedOnQtyForRecipeValue = new Map<string, number>();
    for (const [sku, qty] of qtyForRecipe) {
      const value = (
        (Number(qty) / 1000) *
        Number(priceCostPerKg.get(sku) || 0)
      ).toFixed(2);

      priceCostBasedOnQtyForRecipeValue.set(sku, Number(value));
    }

    return priceCostBasedOnQtyForRecipeValue;
  }, [qtyForRecipe, priceCostPerKg]);

  const [nutritionData, setNutritionData] = useState<
    Map<string, IngredientNutritionAttributes>
  >(new Map());

  const [hoveredSku, setHoveredSku] = useState<string | null>(null);
  const [showNutritionData, setShowNutritionData] = useState<boolean>(false);
  const [nutritionView, setNutritionView] = useState<'totals' | 'per100'>(
    'totals',
  );

  const nutritionDataForRecipe = useMemo(() => {
    const nutritionDataForRecipeValue = new Map<
      string,
      IngredientNutritionAttributes
    >();

    for (const [sku, nutrition] of nutritionData) {
      const qty = qtyForRecipe.get(sku) || 0;
      const scaledNutrition: IngredientNutritionAttributes = {};

      for (const field of nutritionFields) {
        const nutritionValue = nutrition[field];
        if (nutritionValue && nutritionValue.value) {
          // Scale nutrition value based on quantity for recipe (qty is in grams, nutrition is per 100g)
          const scaledValue = (nutritionValue.value * qty) / 100;
          scaledNutrition[field] = {
            value: Number(scaledValue.toFixed(3)),
            unit: nutritionValue.unit,
          } as never;
        }
      }

      nutritionDataForRecipeValue.set(sku, scaledNutrition);
    }

    return nutritionDataForRecipeValue;
  }, [nutritionData, qtyForRecipe]);

  const totalNutritionData = useMemo(() => {
    const totalNutritionDataValue = new Map<
      IngredientNutritionAttributeCode,
      number
    >();

    for (const [_sku, nutrition] of nutritionDataForRecipe) {
      for (const field of nutritionFields) {
        const currentTotal = totalNutritionDataValue.get(field) || 0;
        const nutritionValue = Number(nutrition[field]?.value || 0);
        totalNutritionDataValue.set(field, currentTotal + nutritionValue);
      }
    }

    return totalNutritionDataValue;
  }, [nutritionDataForRecipe]);

  const totalNutritionTotals = useMemo(() => {
    const totals: NutritionTotals = {};
    for (const key of nutritionFields) {
      totals[key] = Number(totalNutritionData.get(key) || 0);
    }
    return totals;
  }, [totalNutritionData]);

  const waterAdjustedNutrition = useMemo(
    () =>
      computeWaterAdjustedPer100g({
        totals: totalNutritionTotals,
        totalQuantity: totalQtyForRecipe || 0,
        waterPercent: recipeData.waterPercent || 0,
      }),
    [totalNutritionTotals, totalQtyForRecipe, recipeData.waterPercent],
  );

  const per100Nutrition = waterAdjustedNutrition.per100g;
  const nutritionDryMass = waterAdjustedNutrition.dryMass;
  const nutritionEnergyCheck = waterAdjustedNutrition.kcalCheck;
  const totalRecipeMass = totalQtyForRecipe || 0;
  const nutritionWaterMass = Math.max(totalRecipeMass - nutritionDryMass, 0);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const handlePickMany = (rows: MagentoProductWithNutritionAttributes[]) => {
    const newItems = rows.filter((p) => !skus.includes(p.sku));

    setSkus((prev) => [...prev, ...newItems.map((p) => p.sku)]);

    setIngredientName((prev) => {
      const newIngredientName = new Map(prev);

      for (const { sku, name } of newItems) {
        ingredientName.set(sku, name || '');
      }

      return newIngredientName;
    });

    setQtyOriginal((prev) => {
      const newQtyOriginal = new Map(prev);

      for (const { sku } of newItems) {
        newQtyOriginal.set(sku, 0);
      }

      return newQtyOriginal;
    });

    setPriceCostPerKg((prev) => {
      const newPriceCostPerKg = new Map(prev);

      for (const { sku, price, weight } of newItems) {
        newPriceCostPerKg.set(
          sku,
          toNumberStrict(toNumberStrict(price) / toNumberStrict(weight)),
        );
      }

      return newPriceCostPerKg;
    });

    setNutritionData((prev) => {
      const newNutritionData = new Map(prev);

      for (const { sku, nutritionAttributes } of newItems) {
        if (nutritionAttributes) {
          newNutritionData.set(sku, nutritionAttributes);
        } else {
          newNutritionData.set(sku, {});
        }
      }

      return newNutritionData;
    });
  };

  const handleAddCustomIngredient = () => {
    const timestamp = Date.now();
    const sku = `custom-ingredient-${timestamp}`;
    handlePickMany([{ sku } as MagentoProductWithNutritionAttributes]);
  };

  const handleProductSelect = useCallback(
    (sku: string, product: MagentoProductWithNutritionAttributes) => {
      setMpSku((prev) => {
        const m = new Map(prev);
        m.set(sku, product.sku);
        return m;
      });
      setProductName((prev) => {
        const m = new Map(prev);
        m.set(sku, product.name || '');
        return m;
      });
      if (product.supplier) {
        setSupplier((prev) => {
          const m = new Map(prev);
          m.set(sku, product.supplier!);
          return m;
        });
      }
      if (product.warehouse_location) {
        setWarehouseLocation((prev) => {
          const m = new Map(prev);
          m.set(sku, product.warehouse_location!);
          return m;
        });
      }
    },
    [],
  );

  const handleRemoveIngredient = (sku: string) => {
    setSkus((prev) => prev.filter((s) => s !== sku));
    setSupplier((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setWarehouseLocation((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setMpSku((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setProductName((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
  };

  const toggleShowNutritionData = () => {
    setShowNutritionData((prev) => !prev);
  };

  const handleNutritionChange = useCallback(
    (sku: string, field: string, value: number) => {
      setNutritionData((prev) => {
        const newNutritionData = new Map(prev);
        const currentNutrition = newNutritionData.get(sku) || {};
        newNutritionData.set(sku, {
          ...currentNutrition,
          [field]: { value },
        });
        return newNutritionData;
      });
    },
    [],
  );

  const handleIngredientNameChange = useCallback(
    (sku: string, value: string) => {
      setIngredientName((prev) => {
        const newIngredientName = new Map(prev);
        newIngredientName.set(sku, value);
        return newIngredientName;
      });
    },
    [],
  );

  const handlePriceCostPerKgChange = useCallback(
    (sku: string, value: number) => {
      setPriceCostPerKg((prev) => {
        const newPriceCostPerKg = new Map(prev);
        newPriceCostPerKg.set(sku, value);
        return newPriceCostPerKg;
      });
    },
    [],
  );

  // New UI filter and fields for process/planning/quality sections
  type Visibility = 'frontend' | 'backend' | 'both';
  const showField = useCallback((_visibility: Visibility) => true, []);

  const [processData, setProcessData] = useState({
    // Biscotti & Teglie
    cookiesCount: undefined as number | undefined,
    cookieWeightRawG: undefined as number | undefined,
    cookieWeightCookedG: undefined as number | undefined,
    trayWeightRawG: undefined as number | undefined,
    trayWeightCookedG: undefined as number | undefined,

    // Attrezzature
    mixerCapacityKg: undefined as number | undefined,
    doughBatchesCount: undefined as number | undefined,
    depositorCapacityKg: undefined as number | undefined,
    depositorsCount: undefined as number | undefined,
    traysCapacityKg: undefined as number | undefined,
    traysCount: undefined as number | undefined,

    // Pianificazione
    traysPerBatch: undefined as number | undefined,
    traysPerDepositors: undefined as number | undefined,
    traysPerOvenLoad: undefined as number | undefined,
    ovenLoadsCount: undefined as number | undefined,

    // Qualità & Processo
    glutenTestDone: '' as '' | 'yes' | 'no',
    valveOpenMinutes: undefined as number | undefined,
    lot: '' as string,
  });
  const setProcess = useCallback(
    (key: keyof typeof processData, value: string | number | undefined) => {
      setProcessData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <div className="scrollbar-elegant mx-auto flex h-full flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Create new recipe</h1>
      </div>

      <CollapsibleSection title="Edit recipe" defaultCollapsed>
        <div className="space-y-6">
          <Section title="Basic info">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-sm text-gray-300 md:col-span-2">
                  Recipe Name
                  <input
                    className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                    value={recipeData.name}
                    onChange={(e) => setRecipeDataByKey('name', e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                  Peso confezione (g)
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.001}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                      value={recipeData.packageWeight || ''}
                      onChange={(e) =>
                        setRecipeDataByKey(
                          'packageWeight',
                          Number(e.target.value),
                        )
                      }
                    />

                    <span className="w-28">
                      = {((recipeData.packageWeight || 0) / 1000).toFixed(2)} kg
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                  Numero pacchetti
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={1}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                      value={recipeData.numberOfPackages || ''}
                      onChange={(e) =>
                        setRecipeDataByKey(
                          'numberOfPackages',
                          Math.ceil(Number(e.target.value)),
                        )
                      }
                    />

                    <span className="w-28"></span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                  Waste %
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.01}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                      value={recipeData.wastePercent || ''}
                      onChange={(e) =>
                        setRecipeDataByKey(
                          'wastePercent',
                          Number(e.target.value),
                        )
                      }
                    />

                    <span className="w-28">
                      = {(recipeData.wastePercent || 0).toFixed(2)} %
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                  Water %
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.01}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                      value={recipeData.waterPercent || ''}
                      onChange={(e) =>
                        setRecipeDataByKey(
                          'waterPercent',
                          Number(e.target.value),
                        )
                      }
                    />

                    <span className="w-28">
                      = {(recipeData.waterPercent || 0).toFixed(2)} %
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                  Total waste %
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.01}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                      value={totalWastePercent || ''}
                      disabled
                    />

                    <span className="w-28">= {totalWastePercent} %</span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                  Totale Qty for recipe (g)
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step={0.001}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                      value={totalQtyForRecipe || ''}
                      onChange={(e) =>
                        setTotalQtyForRecipe(Number(e.target.value))
                      }
                    />

                    <span className="w-28">
                      = {(totalQtyForRecipe / 1000).toFixed(2)} kg
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                  Prodotto Cotto (compreso di sfrido) (g)
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                      value={cookedWeightGross}
                      disabled
                    />

                    <span className="w-28">
                      = {(Number(cookedWeightGross) / 1000).toFixed(2)} kg
                    </span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-sm text-gray-300">
                  Solo Polveri (g)
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      disabled
                      step={0.001}
                      className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                      value={totalOriginalPowderQty}
                    />

                    <span className="w-28">
                      = {(totalOriginalPowderQty / 1000).toFixed(2)} kg
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </Section>

          <Section title="Ingredients">
            <div className="mb-6 hidden items-center gap-4 md:flex">
              <Button onClick={toggleShowNutritionData}>
                {showNutritionData
                  ? 'Hide nutrition data'
                  : 'Show nutrition data'}
              </Button>
            </div>
            {/* Desktop table */}
            <div className="hidden rounded-lg border border-gray-800 md:block">
              <table className="min-w-full table-fixed text-left text-sm">
                <thead className="bg-gray-800 text-gray-300">
                  <tr>
                    <th className="sticky left-0 z-10 w-[20%] px-3 py-2">
                      Name
                    </th>
                    <th className="w-[8%] px-3 py-2 text-center">SKU</th>
                    <th className="w-[8%] px-3 py-2 text-center">
                      Qty for recipe (g)
                    </th>
                    <th className="w-[8%] px-3 py-2 text-center">
                      Original qty (g)
                    </th>
                    <th className="w-[8%] px-3 py-2 text-center">% on total</th>
                    <th className="w-[8%] px-3 py-2 text-center">
                      % of powder
                    </th>
                    <th className="w-[8%] px-3 py-2 text-center">€ / kg</th>
                    <th className="w-[8%] px-3 py-2 text-center">€ / recipe</th>
                    <th className="w-[8%] px-3 py-2 text-center">is powder</th>
                    <th className="w-[10%] px-3 py-2 text-center">
                      Materia Prima
                    </th>
                    <th className="w-[8%] px-3 py-2 text-center">Fornitore</th>
                    <th className="w-[8%] px-3 py-2 text-center">
                      Warehouse location
                    </th>
                    <th className="w-[8%] px-3 py-2 text-center">Mp_Sku</th>
                    <th className="w-[8%] px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {skus.map((sku, index) => {
                    const nutrition = nutritionData.get(sku);
                    const isHovered = hoveredSku === sku;
                    return (
                      <React.Fragment key={sku}>
                        {/* Main ingredient row */}
                        <tr
                          className={`${index % 2 === 0 ? 'bg-gray-950/40' : ''} ${isHovered ? '!bg-blue-900/30' : ''}`}
                          onMouseEnter={() => setHoveredSku(sku)}
                          onMouseLeave={() => setHoveredSku(null)}
                        >
                          {/* Name */}
                          <td className="sticky left-0 z-10 w-[20%] px-3 py-2 pt-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={ingredientName.get(sku) || ''}
                                onChange={(e) =>
                                  handleIngredientNameChange(
                                    sku,
                                    e.target.value,
                                  )
                                }
                                className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                              />
                            </div>
                          </td>
                          {/* SKU */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <input
                              type="text"
                              value={sku}
                              disabled
                              className="w-full cursor-pointer rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                            />
                          </td>

                          {/* Qty for recipe */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <span>
                              {(qtyForRecipe.get(sku) || 0)?.toFixed(2)}
                            </span>
                          </td>
                          {/* Original qty */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <input
                              type="number"
                              step={0.001}
                              value={qtyOriginal.get(sku) || ''}
                              onChange={(e) =>
                                handleQtyOriginalChange(
                                  sku,
                                  Number(e.target.value),
                                )
                              }
                              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                            />
                          </td>
                          {/* % on total */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <span>
                              {percentOnTotalQtyOriginal.get(sku) || 0} %
                            </span>
                          </td>
                          {/* % of powder */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <span>
                              {(percentOfPowder.get(sku) || 0).toFixed(2)} %
                            </span>
                          </td>
                          {/* € / kg */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <input
                              type="number"
                              step={0.01}
                              value={priceCostPerKg.get(sku) || ''}
                              onChange={(e) =>
                                handlePriceCostPerKgChange(
                                  sku,
                                  Number(e.target.value),
                                )
                              }
                              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                            />
                          </td>
                          {/* € / recipe */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <span>
                              {(
                                priceCostBasedOnQtyForRecipe.get(sku) || 0
                              ).toFixed(2)}
                            </span>
                          </td>
                          {/* is powder */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <Checkbox
                              checked={!!powderIngredients.get(sku)}
                              onChange={(e) =>
                                handlePowerIngredientsChange(
                                  sku,
                                  e.target.checked,
                                )
                              }
                            />
                          </td>
                          {/* Materia Prima */}
                          <td className="w-[10%] px-3 py-2 pt-4">
                            <IngredientProductSearch
                              value={productName.get(sku) || ''}
                              onSelect={(product) =>
                                handleProductSelect(sku, product)
                              }
                              placeholder="Cerca prodotto..."
                            />
                          </td>
                          {/* Supplier */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <input
                              type="text"
                              value={supplier.get(sku) || ''}
                              onChange={(e) =>
                                setSupplier((prev) => {
                                  const m = new Map(prev);
                                  m.set(sku, e.target.value);
                                  return m;
                                })
                              }
                              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                            />
                          </td>
                          {/* Warehouse location */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <input
                              type="text"
                              value={warehouseLocation.get(sku) || ''}
                              onChange={(e) =>
                                setWarehouseLocation((prev) => {
                                  const m = new Map(prev);
                                  m.set(sku, e.target.value);
                                  return m;
                                })
                              }
                              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                            />
                          </td>
                          {/* Mp_Sku */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <input
                              type="text"
                              value={mpSku.get(sku) || ''}
                              onChange={(e) =>
                                setMpSku((prev) => {
                                  const m = new Map(prev);
                                  m.set(sku, e.target.value);
                                  return m;
                                })
                              }
                              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100"
                            />
                          </td>

                          {/* Remove */}
                          <td className="w-[8%] px-3 py-2 pt-4 text-center">
                            <button
                              onClick={() => handleRemoveIngredient(sku)}
                              className="cursor-pointer rounded-full bg-red-100 p-2 transition-colors hover:bg-red-200"
                              aria-label="Remove ingredient"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 text-red-600"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>

                        {showNutritionData && (
                          <NutritionDataRows
                            sku={sku}
                            index={index}
                            nutrition={nutrition}
                            isHovered={isHovered}
                            onMouseEnter={() => setHoveredSku(sku)}
                            onMouseLeave={() => setHoveredSku(null)}
                            nutritionFields={nutritionFields}
                            onNutritionChange={handleNutritionChange}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden">
              <div className="flex flex-col gap-3">
                {skus.map((sku) => {
                  const nutrition = nutritionData.get(sku);
                  return (
                    <div
                      key={sku}
                      className="rounded-lg border border-gray-800 bg-gray-900 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <input
                          type="text"
                          value={ingredientName.get(sku) || ''}
                          onChange={(e) =>
                            handleIngredientNameChange(sku, e.target.value)
                          }
                          className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          placeholder="Ingredient name"
                        />
                        <button
                          onClick={() => handleRemoveIngredient(sku)}
                          className="ml-2 shrink-0 rounded-full bg-red-100 p-2 hover:bg-red-200"
                          aria-label="Remove ingredient"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4 text-red-600"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="col-span-2 text-xs text-gray-300">
                          SKU
                          <input
                            type="text"
                            value={sku}
                            disabled
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label className="text-xs text-gray-300">
                          Qty for recipe (g)
                          <input
                            type="text"
                            value={(qtyForRecipe.get(sku) || 0).toFixed(2)}
                            disabled
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label className="text-xs text-gray-300">
                          Original qty (g)
                          <input
                            type="number"
                            step={0.001}
                            value={qtyOriginal.get(sku) || ''}
                            onChange={(e) =>
                              handleQtyOriginalChange(
                                sku,
                                Number(e.target.value),
                              )
                            }
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label className="text-xs text-gray-300">
                          % on total
                          <input
                            type="text"
                            value={
                              (
                                percentOnTotalQtyOriginal.get(sku) || 0
                              ).toString() + ' %'
                            }
                            disabled
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label className="text-xs text-gray-300">
                          % of powder
                          <input
                            type="text"
                            value={`${(percentOfPowder.get(sku) || 0).toFixed(2)} %`}
                            disabled
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label className="text-xs text-gray-300">
                          € / kg
                          <input
                            type="number"
                            step={0.01}
                            value={priceCostPerKg.get(sku) || ''}
                            onChange={(e) =>
                              handlePriceCostPerKgChange(
                                sku,
                                Number(e.target.value),
                              )
                            }
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label className="text-xs text-gray-300">
                          € / recipe
                          <input
                            type="text"
                            value={(
                              priceCostBasedOnQtyForRecipe.get(sku) || 0
                            ).toFixed(2)}
                            disabled
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label
                          htmlFor={`powder-ingredient-${sku}`}
                          className="col-span-2 flex items-center gap-2 text-xs text-gray-300"
                        >
                          <Checkbox
                            checked={!!powderIngredients.get(sku)}
                            onChange={(e) =>
                              handlePowerIngredientsChange(
                                sku,
                                e.target.checked,
                              )
                            }
                            id={`powder-ingredient-${sku}`}
                          />
                          <span>Is powder</span>
                        </label>

                        <span className="col-span-2 text-xs text-gray-300">
                          Materia Prima
                          <IngredientProductSearch
                            value={productName.get(sku) || ''}
                            onSelect={(product) =>
                              handleProductSelect(sku, product)
                            }
                            placeholder="Cerca prodotto..."
                          />
                        </span>

                        <label className="text-xs text-gray-300">
                          Supplier
                          <input
                            type="text"
                            value={supplier.get(sku) || ''}
                            onChange={(e) =>
                              setSupplier((prev) => {
                                const m = new Map(prev);
                                m.set(sku, e.target.value);
                                return m;
                              })
                            }
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label className="text-xs text-gray-300">
                          Warehouse location
                          <input
                            type="text"
                            value={warehouseLocation.get(sku) || ''}
                            onChange={(e) =>
                              setWarehouseLocation((prev) => {
                                const m = new Map(prev);
                                m.set(sku, e.target.value);
                                return m;
                              })
                            }
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>

                        <label className="text-xs text-gray-300">
                          Mp_Sku
                          <input
                            type="text"
                            value={mpSku.get(sku) || ''}
                            onChange={(e) =>
                              setMpSku((prev) => {
                                const m = new Map(prev);
                                m.set(sku, e.target.value);
                                return m;
                              })
                            }
                            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          />
                        </label>
                      </div>

                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-200">
                          Nutrition data
                        </summary>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          {nutritionFields.map((field) => (
                            <label
                              key={field}
                              className="text-xs text-gray-300"
                            >
                              {field}
                              <input
                                type="number"
                                step={0.01}
                                className="mt-1 w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-gray-100"
                                value={nutrition?.[field]?.value || 0}
                                onChange={(e) =>
                                  handleNutritionChange(
                                    sku,
                                    field,
                                    Number(e.target.value),
                                  )
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <Button variant="primary" onClick={() => setPickerOpen(true)}>
                + Add ingredients
              </Button>

              <Button variant="secondary" onClick={handleAddCustomIngredient}>
                + Add custom ingredients
              </Button>
            </div>
          </Section>

          <CollapsibleSection title="Nutrition Summary" defaultCollapsed>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-gray-400">View:</span>
              <div className="inline-flex overflow-hidden rounded-md border border-gray-700">
                <button
                  className={`cursor-pointer px-3 py-1 ${nutritionView === 'totals' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}
                  type="button"
                  onClick={() => setNutritionView('totals')}
                >
                  Totali ricetta
                </button>
                <button
                  className={`cursor-pointer px-3 py-1 ${nutritionView === 'per100' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}
                  type="button"
                  onClick={() => setNutritionView('per100')}
                >
                  Per 100 g
                </button>
              </div>
            </div>

            {nutritionView === 'totals' ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-lg border border-gray-800 md:block">
                  <table className="min-w-full table-fixed text-left text-sm">
                    <thead className="bg-gray-800 text-gray-300">
                      <tr>
                        <th className="sticky left-0 z-10 w-72 px-3 py-2">
                          Ingredient
                        </th>
                        {nutritionFields.map((label) => (
                          <th key={label} className="w-20 px-3 py-2 text-right">
                            {`${label} (${IngredientNutritionAttributeUnit[label as keyof typeof IngredientNutritionAttributeUnit]})`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(nutritionDataForRecipe.entries()).map(
                        ([sku, nutrition]) => (
                          <tr key={sku} className="odd:bg-gray-950/40">
                            <td className="px-3 py-2">
                              <span className="inline-block w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100">
                                {ingredientName.get(sku)}
                              </span>
                            </td>
                            {nutritionFields.map((key) => (
                              <td
                                key={key}
                                className="px-3 py-2 text-right text-gray-100"
                              >
                                {nutrition[
                                  key as IngredientNutritionAttributeCode
                                ]?.value || 0}
                              </td>
                            ))}
                          </tr>
                        ),
                      )}

                      <tr className="bg-gray-900/70 font-bold">
                        <td className="px-3 py-2 text-green-400">Totale</td>
                        {nutritionFields.map((key) => (
                          <td
                            key={key}
                            className="px-3 py-2 text-right text-green-400"
                          >
                            {totalNutritionData.get(key) || 0}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mobile list */}
                <div className="md:hidden">
                  <div className="flex flex-col gap-3">
                    {Array.from(nutritionDataForRecipe.entries()).map(
                      ([sku, nutrition]) => (
                        <div
                          key={sku}
                          className="rounded-lg border border-gray-800 bg-gray-900 p-3"
                        >
                          <div className="mb-2 text-sm font-medium text-gray-200">
                            {ingredientName.get(sku) || `<Missing name>`}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {nutritionFields.map((label) => (
                              <div
                                key={label}
                                className="flex items-center justify-between rounded-md border border-gray-800 bg-gray-800/50 px-2 py-1"
                              >
                                <span className="text-gray-300">{`${label} (${IngredientNutritionAttributeUnit[label as keyof typeof IngredientNutritionAttributeUnit]})`}</span>
                                <span className="text-gray-100">
                                  {nutrition[
                                    label as IngredientNutritionAttributeCode
                                  ]?.value || 0}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ),
                    )}

                    {/* Total card */}
                    <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                      <div className="mb-2 text-sm font-semibold text-green-400">
                        Totale
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {nutritionFields.map((key) => (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded-md border border-gray-800 bg-gray-800/50 px-2 py-1"
                          >
                            <span className="text-gray-300">{`${key} (${IngredientNutritionAttributeUnit[key as keyof typeof IngredientNutritionAttributeUnit]})`}</span>
                            <span className="text-green-400">
                              {totalNutritionData.get(key) || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-lg border border-gray-800">
                  <table className="min-w-full table-fixed text-left text-sm text-gray-200">
                    <thead className="bg-gray-800">
                      <tr>
                        <th className="px-3 py-2">Voce</th>
                        <th className="px-3 py-2 text-right">Per ricetta</th>
                        <th className="px-3 py-2 text-right">Per 100 g</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nutritionFields.map((key) => (
                        <tr key={key} className="odd:bg-gray-950/40">
                          <td className="px-3 py-2">{nutritionLabels[key]}</td>
                          <td className="px-3 py-2 text-right">
                            {Number(
                              totalNutritionTotals[key] ?? 0,
                            ).toLocaleString('it-IT', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 3,
                            })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {Number(per100Nutrition[key] ?? 0).toLocaleString(
                              'it-IT',
                              {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 3,
                              },
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded border border-gray-800 bg-gray-900 p-4 text-sm text-gray-200">
                    <div className="font-semibold">Massa di riferimento</div>
                    <div className="mt-2 space-y-1 text-gray-300">
                      <div>
                        Impasto totale:{' '}
                        {totalRecipeMass.toLocaleString('it-IT')} g
                      </div>
                      <div>
                        Acqua sottratta:{' '}
                        {nutritionWaterMass.toLocaleString('it-IT')} g
                        {totalRecipeMass
                          ? ` (${((nutritionWaterMass / totalRecipeMass) * 100).toFixed(2)}%)`
                          : ''}
                      </div>
                      <div>
                        Solidi (dry mass):{' '}
                        {nutritionDryMass.toLocaleString('it-IT')} g
                      </div>
                    </div>
                  </div>

                  <div
                    className={`rounded border border-gray-800 bg-gray-900 p-4 text-sm ${nutritionEnergyCheck.isValid ? 'text-gray-200' : 'text-red-200'}`}
                  >
                    <div className="font-semibold text-gray-100">
                      Controllo energia (≤ {nutritionEnergyCheck.tolerance}% )
                    </div>
                    <div className="mt-2 space-y-1 text-current">
                      <div>
                        Kcal teoriche (4-4-9):{' '}
                        {nutritionEnergyCheck.theoretical.toFixed(2)}
                      </div>
                      <div>
                        Kcal dichiarate:{' '}
                        {nutritionEnergyCheck.declared.toFixed(2)}
                      </div>
                      <div>
                        Delta%: {nutritionEnergyCheck.deltaPercent.toFixed(2)}%{' '}
                        {nutritionEnergyCheck.isValid ? (
                          <span className="text-green-400">OK</span>
                        ) : (
                          <span className="text-red-400">FUORI RANGE</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Process settings" defaultCollapsed>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {/* Biscotti & Teglie */}
              <div className="flex flex-col gap-2 rounded-lg border border-gray-500 p-3">
                <div className="text-base font-semibold text-gray-200">
                  Biscotti & Teglie
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {showField('both') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Numero biscotti
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.cookiesCount ?? ''}
                          onChange={(e) =>
                            setProcess('cookiesCount', Number(e.target.value))
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                  {showField('both') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Peso biscotto crudo
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.cookieWeightRawG ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'cookieWeightRawG',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">g</span>
                      </div>
                    </label>
                  )}
                  {showField('both') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Peso biscotto cotto
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.cookieWeightCookedG ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'cookieWeightCookedG',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">g</span>
                      </div>
                    </label>
                  )}
                  {showField('backend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Peso teglia (crudo)
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.trayWeightRawG ?? ''}
                          onChange={(e) =>
                            setProcess('trayWeightRawG', Number(e.target.value))
                          }
                        />
                        <span className="w-28">g</span>
                      </div>
                    </label>
                  )}
                  {showField('backend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Peso teglia (cotto)
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.trayWeightCookedG ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'trayWeightCookedG',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">g</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Attrezzature */}
              <div className="flex flex-col gap-2 rounded-lg border border-gray-500 p-3">
                <div className="text-base font-semibold text-gray-200">
                  Attrezzature
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {showField('backend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Capienza impastatrice
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.mixerCapacityKg ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'mixerCapacityKg',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">Kg</span>
                      </div>
                    </label>
                  )}
                  {showField('both') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Numero impasti
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.doughBatchesCount ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'doughBatchesCount',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                  {showField('backend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Capienza colatrice
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.depositorCapacityKg ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'depositorCapacityKg',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">Kg</span>
                      </div>
                    </label>
                  )}
                  {showField('backend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Numero colatrici
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.depositorsCount ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'depositorsCount',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                  {showField('backend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Capienza teglie
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.traysCapacityKg ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'traysCapacityKg',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">Kg</span>
                      </div>
                    </label>
                  )}
                  {showField('both') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Numero teglie
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.traysCount ?? ''}
                          onChange={(e) =>
                            setProcess('traysCount', Number(e.target.value))
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Pianificazione */}
              <div className="flex flex-col gap-2 rounded-lg border border-gray-500 p-3">
                <div className="text-base font-semibold text-gray-200">
                  Pianificazione
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {showField('both') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Numero teglie/impasto
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.traysPerBatch ?? ''}
                          onChange={(e) =>
                            setProcess('traysPerBatch', Number(e.target.value))
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                  {showField('both') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Numero teglie/colatrici
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.traysPerDepositors ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'traysPerDepositors',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                  {showField('backend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Teglie/Infornate
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.traysPerOvenLoad ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'traysPerOvenLoad',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                  {showField('backend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Numero infornate
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.ovenLoadsCount ?? ''}
                          onChange={(e) =>
                            setProcess('ovenLoadsCount', Number(e.target.value))
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Qualità & Processo */}
              <div className="flex flex-col gap-2 rounded-lg border border-gray-500 p-3">
                <div className="text-base font-semibold text-gray-200">
                  Qualità & Processo
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {showField('frontend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Test glutine fatto?
                      <div className="flex items-center gap-2">
                        <select
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.glutenTestDone}
                          onChange={(e) =>
                            setProcess(
                              'glutenTestDone',
                              e.target.value as 'yes' | 'no' | '',
                            )
                          }
                        >
                          <option value=""></option>
                          <option value="yes">yes</option>
                          <option value="no">no</option>
                        </select>
                        <span className="w-28">yes/no</span>
                      </div>
                    </label>
                  )}
                  {showField('frontend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Apertura valvola
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.valveOpenMinutes ?? ''}
                          onChange={(e) =>
                            setProcess(
                              'valveOpenMinutes',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">min</span>
                      </div>
                    </label>
                  )}
                  {showField('frontend') && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-gray-300">
                      Lotto
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                          value={processData.lot}
                          onChange={(e) => setProcess('lot', e.target.value)}
                        />
                        <span className="w-28">String</span>
                      </div>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/*<Section title="Cooking">*/}
          {/*  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">*/}
          {/*    <label className="text-sm text-gray-300">*/}
          {/*      Time (minutes)*/}
          {/*      <input*/}
          {/*        type="number"*/}
          {/*        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"*/}
          {/*        value={recipeData.cooking?.time_minutes ?? ''}*/}
          {/*        onChange={(e) =>*/}
          {/*          setRecipeDataByKey('cooking', {*/}
          {/*            ...(recipeData.cooking || {}),*/}
          {/*            time_minutes:*/}
          {/*              e.target.value === '' ? undefined : Number(e.target.value),*/}
          {/*          })*/}
          {/*        }*/}
          {/*      />*/}
          {/*    </label>*/}
          {/*    <label className="text-sm text-gray-300">*/}
          {/*      Temperature (°C)*/}
          {/*      <input*/}
          {/*        type="number"*/}
          {/*        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"*/}
          {/*        value={recipeData.cooking?.temperature_celsius ?? ''}*/}
          {/*        onChange={(e) =>*/}
          {/*          setRecipeDataByKey('cooking', {*/}
          {/*            ...(recipeData.cooking || {}),*/}
          {/*            temperature_celsius:*/}
          {/*              e.target.value === '' ? undefined : Number(e.target.value),*/}
          {/*          })*/}
          {/*        }*/}
          {/*      />*/}
          {/*    </label>*/}
          {/*    <label className="text-sm text-gray-300">*/}
          {/*      Final product weight (kg)*/}
          {/*      <input*/}
          {/*        type="number"*/}
          {/*        step={0.001}*/}
          {/*        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"*/}
          {/*        value={recipeData.cooking?.final_product_weight_kg ?? ''}*/}
          {/*        onChange={(e) =>*/}
          {/*          setRecipeDataByKey('cooking', {*/}
          {/*            ...(recipeData.cooking || {}),*/}
          {/*            final_product_weight_kg:*/}
          {/*              e.target.value === '' ? undefined : Number(e.target.value),*/}
          {/*          })*/}
          {/*        }*/}
          {/*      />*/}
          {/*    </label>*/}
          {/*    <label className="text-sm text-gray-300">*/}
          {/*      Height (cm)*/}
          {/*      <input*/}
          {/*        type="number"*/}
          {/*        step={0.1}*/}
          {/*        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"*/}
          {/*        value={recipeData.cooking?.dimensions?.height_cm ?? ''}*/}
          {/*        onChange={(e) =>*/}
          {/*          setRecipeDataByKey('cooking', {*/}
          {/*            ...(recipeData.cooking || {}),*/}
          {/*            dimensions: {*/}
          {/*              ...((recipeData.cooking && recipeData.cooking.dimensions) ||*/}
          {/*                {}),*/}
          {/*              height_cm:*/}
          {/*                e.target.value === ''*/}
          {/*                  ? undefined*/}
          {/*                  : Number(e.target.value),*/}
          {/*            },*/}
          {/*          })*/}
          {/*        }*/}
          {/*      />*/}
          {/*    </label>*/}
          {/*    <label className="text-sm text-gray-300">*/}
          {/*      Diameter (cm)*/}
          {/*      <input*/}
          {/*        type="number"*/}
          {/*        step={0.1}*/}
          {/*        className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"*/}
          {/*        value={recipeData.cooking?.dimensions?.diameter_cm ?? ''}*/}
          {/*        onChange={(e) =>*/}
          {/*          setRecipeDataByKey('cooking', {*/}
          {/*            ...(recipeData.cooking || {}),*/}
          {/*            dimensions: {*/}
          {/*              ...((recipeData.cooking && recipeData.cooking.dimensions) ||*/}
          {/*                {}),*/}
          {/*              diameter_cm:*/}
          {/*                e.target.value === ''*/}
          {/*                  ? undefined*/}
          {/*                  : Number(e.target.value),*/}
          {/*            },*/}
          {/*          })*/}
          {/*        }*/}
          {/*      />*/}
          {/*    </label>*/}
          {/*  </div>*/}
          {/*</Section>*/}

          <Section title="Notes">
            <textarea
              className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
              rows={3}
              value={recipeData.notes || ''}
              onChange={(e) => setRecipeDataByKey('notes', e.target.value)}
              placeholder="Recipe notes..."
            />
          </Section>
        </div>
      </CollapsibleSection>

      <div className="mb-8 flex items-center justify-end gap-2">
        {saving && <span className="text-sm text-gray-400">Saving...</span>}
        <button
          className="cursor-pointer rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          Save changes
        </button>
      </div>

      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPickMany={handlePickMany}
        existingSkus={new Set(skus)}
      />
    </div>
  );
}
