'use client';

import React, {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  startTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import ProductPickerModal from '@/components/ProductPickerModal';
import { NutritionDataRows } from '@/components/NutritionDataRows';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { useSetToast } from '@/state/ToastProvider';
import { IngredientNutritionModal } from '@/components/IngredientNutritionModal';
import {
  IngredientNutritionAttributes,
  IngredientNutritionAttributeUnit,
  MagentoProductWithNutritionAttributes,
  MagentoRecipe,
  MagentoRecipeIngredient,
  NewIngredientProps,
  NewRecipeProps,
  Production,
  RecipeVersion,
} from '@/types';
import { apiClient } from '@/helpers/api';
import { Section } from '@/components/Section';
import { Button } from '@/components/Button';
import { toNumberStrict } from '@/helpers/utils';
import Checkbox from '@/components/Checkbox';
import NutritionInsightsPanel from '@/components/NutritionInsightsPanel';
import { RecipeCostsSection } from '@/components/RecipeCostsSection';
import { MAGENTO_NUTRIENT_FIELDS } from '@/constants/magentoNutrientFields';
import { NUTRITION_KEYS } from '@/lib/nutrition/per100g';
import { canEdit, canView } from '@/lib/permissions/check';
import { useOperatorView } from '@/contexts/OperatorViewContext';
import { useProfile } from '@/contexts/ProfileContext';
import { isAdminRole } from '@/constants/roles';
import type { RecipeCostWithStandard, CostType } from '@/types';
import { IngredientProductSearch } from '@/components/IngredientProductSearch';
import { ProductionModal } from '@/components/ProductionModal';
import { RecipeHistoryPanel } from '@/components/RecipeHistoryPanel';
import { LotAutocompleteInput } from '@/components/LotAutocompleteInput';
import { RecipeVersionSelector } from '@/components/RecipeVersionSelector';
import { RecipeProcessesWidget } from '@/components/RecipeProcessesWidget';
import {
  useIngredientTableColumns,
  type IngredientColumnId,
  INGREDIENT_COLUMN_IDS,
} from '@/hooks/useIngredientTableColumns';
import { IngredientTableColumnManager } from '@/components/IngredientTableColumnManager';

const nutritionFields = NUTRITION_KEYS;
type NutritionField = (typeof nutritionFields)[number];
type NutritionMap = Partial<
  Record<NutritionField, { value: number; unit?: string }>
>;

const BASIC_CAPABILITIES = {
  name: 'recipe.basic.name',
  packageWeight: 'recipe.basic.packageWeight',
  numberOfPackages: 'recipe.basic.numberOfPackages',
  wastePercent: 'recipe.basic.wastePercent',
  waterPercent: 'recipe.basic.waterPercent',
} as const;

const PROCESS_CAPABILITIES = {
  cookiesCount: 'recipe.process.cookiesCount',
  cookieWeightRawG: 'recipe.process.cookieWeightRawG',
  cookieWeightCookedG: 'recipe.process.cookieWeightCookedG',
  trayWeightRawG: 'recipe.process.trayWeightRawG',
  trayWeightCookedG: 'recipe.process.trayWeightCookedG',
  mixerCapacityKg: 'recipe.process.mixerCapacityKg',
  doughBatchesCount: 'recipe.process.doughBatchesCount',
  depositorCapacityKg: 'recipe.process.depositorCapacityKg',
  depositorsCount: 'recipe.process.depositorsCount',
  traysCapacityKg: 'recipe.process.traysCapacityKg',
  traysCount: 'recipe.process.traysCount',
  traysPerBatch: 'recipe.process.traysPerBatch',
  traysPerDepositors: 'recipe.process.traysPerDepositors',
  traysPerOvenLoad: 'recipe.process.traysPerOvenLoad',
  ovenLoadsCount: 'recipe.process.ovenLoadsCount',
  boxCapacity: 'recipe.process.boxCapacity',
  numberOfBoxes: 'recipe.process.numberOfBoxes',
  cartCapacity: 'recipe.process.cartCapacity',
  numberOfCarts: 'recipe.process.numberOfCarts',
  glutenTestDone: 'recipe.process.glutenTestDone',
  valveOpenMinutes: 'recipe.process.valveOpenMinutes',
  lot: 'recipe.process.lot',
  laboratoryHumidityPercent: 'recipe.process.laboratoryHumidityPercent',
  externalTemperatureC: 'recipe.process.externalTemperatureC',
  waterTemperatureC: 'recipe.process.waterTemperatureC',
  finalDoughTemperatureC: 'recipe.process.finalDoughTemperatureC',
} as const;

const INGREDIENT_CAPABILITIES = {
  table: 'recipe.ingredients.table',
  editing: 'recipe.ingredients.editing',
  actions: 'recipe.ingredients.actions',
  nutrition: 'recipe.ingredients.nutrition',
  automatch: 'recipe.ingredients.automatch',
} as const;

const HEADER_CAPABILITY = 'recipe.header.meta';
const CALCULATED_CAPABILITY = 'recipe.calculated.panel';
const NOTES_CAPABILITY = 'recipe.notes.body';
const NUTRITION_PANEL_CAPABILITY = 'recipe.nutrition.panel';
const SAVE_CAPABILITY = 'recipe.actions.save';
const HISTORY_CAPABILITY = 'recipe.history.panel';
const NUTRITION_TOGGLE_CAPABILITY = 'recipe.actions.nutritionToggle';

// Default values for colatrice settings
const COLATRICE_DEFAULTS: Record<string, Record<string, number>> = {
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

export default function AdminRecipeEditorPage({
  params,
}: {
  params: Promise<{ id: string | number }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const idNum = Number(id);
  const invalidId = !Number.isFinite(idNum) || idNum <= 0;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialRecipe, setInitialRecipe] = useState<MagentoRecipe | null>(
    null,
  );
  const [initialIngredients, setInitialIngredients] = useState<
    MagentoRecipeIngredient[]
  >([]);
  const [recipeCosts, setRecipeCosts] = useState<RecipeCostWithStandard[]>([]);

  // Initial state tracking for detecting changes
  const [initialRecipeData, setInitialRecipeData] =
    useState<NewRecipeProps | null>(null);
  const [initialProcessData, setInitialProcessData] = useState<
    typeof processData | null
  >(null);
  const [initialOvenTemperatures, setInitialOvenTemperatures] = useState<
    Array<{ id?: number; temperature: number; minutes: number; order: number }>
  >([]);
  const [initialMixingTimes, setInitialMixingTimes] = useState<
    Array<{ id?: number; minutes: number; speed: number; order: number }>
  >([]);
  const [initialRecipeCosts, setInitialRecipeCosts] = useState<
    RecipeCostWithStandard[]
  >([]);
  const [initialSkus, setInitialSkus] = useState<string[]>([]);
  const [initialIngredientData, setInitialIngredientData] = useState<{
    names: Map<string, string>;
    qtyOriginal: Map<string, number>;
    powderIngredients: Map<string, boolean>;
    supplier: Map<string, string>;
    warehouseLocation: Map<string, string>;
    mpSku: Map<string, string>;
    productName: Map<string, string>;
    lot: Map<string, string>;
    done: Map<string, boolean>;
    checkGlutine: Map<string, boolean>;
  } | null>(null);

  // Move all hooks to the top before any early returns
  const setToast = useSetToast();
  const [saving, setSaving] = useState(false);

  // Recipe data mirrors NewRecipeProps as in create page
  const [recipeData, setRecipeData] = useState<NewRecipeProps>({
    id: initialRecipe?.id || 0,
    name: initialRecipe?.name || '',
    notes: initialRecipe?.notes || undefined,
    packageWeight: initialRecipe?.packageWeight || 0,
    numberOfPackages: initialRecipe?.numberOfPackages || 0,
    wastePercent: initialRecipe?.wastePercent || 0,
    waterPercent: initialRecipe?.waterPercent || 0,
    timeMinutes: initialRecipe?.timeMinutes || 0,
    temperatureCelsius: initialRecipe?.temperatureCelsius || 0,
    heightCm: initialRecipe?.heightCm || 0,
    widthCm: initialRecipe?.widthCm || 0,
    lengthCm: initialRecipe?.lengthCm || 0,
    createdAt: initialRecipe?.createdAt || '',
    updatedAt: initialRecipe?.updatedAt || '',
    totalQtyForRecipe: initialRecipe?.totalQtyForRecipe || 0,
  });

  // Ingredients state (map based) — same pattern as create page
  const [skus, setSkus] = useState<string[]>([]);

  const [ingredientName, setIngredientName] = useState<Map<string, string>>(
    new Map(),
  );

  const [qtyOriginal, setQtyOriginal] = useState<Map<string, number>>(
    new Map(),
  );

  const [_priceCostPerKg, setPriceCostPerKg] = useState<Map<string, number>>(
    new Map(),
  );

  // Store cost_price_list and weight for each ingredient (from Magento)
  const [costPriceList, setCostPriceList] = useState<Map<string, number>>(
    new Map(),
  );
  const [ingredientWeight, setIngredientWeight] = useState<Map<string, number>>(
    new Map(),
  );

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

  // Ingredient lot, done flag, and gluten check
  const [ingredientLot, setIngredientLot] = useState<Map<string, string>>(
    new Map(),
  );
  const [done, setDone] = useState<Map<string, boolean>>(new Map());
  const [checkGlutine, setCheckGlutine] = useState<Map<string, boolean>>(
    new Map(),
  );

  const [nutritionData, setNutritionData] = useState<
    Map<string, IngredientNutritionAttributes>
  >(new Map());

  const [hoveredSku, setHoveredSku] = useState<string | null>(null);
  const [nutritionModalSku, setNutritionModalSku] = useState<string | null>(
    null,
  );
  const [showNutritionData, setShowNutritionData] = useState<boolean>(false);
  const [showCalculatedData, setShowCalculatedData] = useState(false);
  const [showColumnManager, setShowColumnManager] = useState(false);
  const { profile } = useProfile();

  // Production state
  const [activeProduction, setActiveProduction] = useState<Production | null>(
    null,
  );
  const [_recipeVersion, _setRecipeVersion] = useState<RecipeVersion | null>(
    null,
  );
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showHistory] = useState(false);

  // Derived totals and helpers — copied from create page
  const totalWastePercent = useMemo(() => {
    return (recipeData.wastePercent || 0) + (recipeData.waterPercent || 0);
  }, [recipeData.wastePercent, recipeData.waterPercent]);

  const doughCookedKgAuto = useMemo(() => {
    const computed =
      ((recipeData.packageWeight || 0) * (recipeData.numberOfPackages || 0)) /
      1000;
    if (!Number.isFinite(computed)) return 0;
    return Number(computed.toFixed(3));
  }, [recipeData.packageWeight, recipeData.numberOfPackages]);

  const [totalQtyForRecipe, setTotalQtyForRecipe] = useState<number>(0);

  const totalQtyOriginal = useMemo(() => {
    return Array.from(qtyOriginal.values()).reduce(
      (total, qty) => total + qty,
      0,
    );
  }, [qtyOriginal]);

  const cookedWeightGross = useMemo(() => {
    const value = doughCookedKgAuto * 1000;
    return Number(value.toFixed(2));
  }, [doughCookedKgAuto]);

  const percentOnTotalQtyOriginal = useMemo(() => {
    const percentOnTotalValue = new Map<string, number>();
    const totalQty = totalQtyOriginal;
    if (totalQty === 0) return percentOnTotalValue;
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

  const totalOriginalPowderQty = useMemo(() => {
    return Array.from(powderIngredients.entries()).reduce(
      (total, [sku, isPower]) => {
        if (isPower) {
          const qty = qtyOriginal.get(sku) || 0;
          return total + qty;
        }
        return total;
      },
      0,
    );
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

  // Calculate €/kg automatically from cost_price_list / weight
  // Tries to calculate from Magento data (costPriceList / ingredientWeight)
  // Falls back to stored priceCostPerKg from database if Magento data not available
  const priceCostPerKgAuto = useMemo(() => {
    const map = new Map<string, number>();
    for (const sku of skus) {
      // Try to get cost_price_list and weight from Magento data
      // These can be available even without mpSku (e.g., when loaded from database using ingredient SKU)
      const costPrice = costPriceList.get(sku) || 0;
      const weight = ingredientWeight.get(sku) || 0;

      // Calculate from Magento data if both cost_price_list and weight are available
      if (weight > 0 && costPrice > 0) {
        const calculated = costPrice / weight;
        const result = Number(calculated.toFixed(2));
        map.set(sku, result);
      } else {
        // Fallback to stored priceCostPerKg from database if available
        const storedPrice = _priceCostPerKg.get(sku) || 0;
        if (storedPrice > 0) {
          map.set(sku, storedPrice);
        } else {
          map.set(sku, 0);
        }
      }
    }
    return map;
  }, [skus, costPriceList, ingredientWeight, _priceCostPerKg]);

  // Track errors: when to show red background (no data available at all)
  const priceCostPerKgError = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const sku of skus) {
      const costPrice = costPriceList.get(sku) || 0;
      const weight = ingredientWeight.get(sku) || 0;
      const storedPrice = _priceCostPerKg.get(sku) || 0;
      const calculatedPrice = priceCostPerKgAuto.get(sku) || 0;

      // Error only if no data is available at all (no Magento data, no stored price)
      const _hasMagentoData = weight > 0 && costPrice > 0;
      const _hasStoredPrice = storedPrice > 0;
      const hasAnyPrice = calculatedPrice > 0;

      // Show error if no price is available at all
      map.set(sku, !hasAnyPrice);
    }
    return map;
  }, [
    skus,
    costPriceList,
    ingredientWeight,
    _priceCostPerKg,
    priceCostPerKgAuto,
  ]);

  const _priceCostBasedOnQtyOriginal = useMemo(() => {
    const map = new Map<string, number>();
    for (const [sku, qty] of qtyOriginal) {
      const costPerKg = priceCostPerKgAuto.get(sku) || 0;
      const value = ((Number(qty) / 1000) * costPerKg).toFixed(2);
      map.set(sku, Number(value));
    }
    return map;
  }, [qtyOriginal, priceCostPerKgAuto]);

  const priceCostBasedOnQtyForRecipe = useMemo(() => {
    const map = new Map<string, number>();
    for (const [sku, qty] of qtyForRecipe) {
      const costPerKg = priceCostPerKgAuto.get(sku) || 0;
      const value = ((Number(qty) / 1000) * costPerKg).toFixed(2);
      map.set(sku, Number(value));
    }
    return map;
  }, [qtyForRecipe, priceCostPerKgAuto]);

  const normalizeLocalNutritionKey = (key: string) =>
    key === 'polyoli' ? 'polioli' : key;

  const selectedNutritionModalData = useMemo(() => {
    if (!nutritionModalSku) return null;
    return {
      sku: nutritionModalSku,
      name: ingredientName.get(nutritionModalSku) || nutritionModalSku,
      qtyForRecipe: qtyForRecipe.get(nutritionModalSku) || 0,
      qtyOriginal: qtyOriginal.get(nutritionModalSku) || 0,
      isPowderIngredient: !!powderIngredients.get(nutritionModalSku),
    };
  }, [
    ingredientName,
    nutritionModalSku,
    powderIngredients,
    qtyForRecipe,
    qtyOriginal,
  ]);

  const selectedNutritionModalValues = useMemo(() => {
    if (!nutritionModalSku) return undefined;
    const entry = nutritionData.get(nutritionModalSku);
    if (!entry) return undefined;
    const values: Record<string, string> = {};
    for (const field of MAGENTO_NUTRIENT_FIELDS) {
      const localKey = normalizeLocalNutritionKey(field.key);
      const data = (entry as Record<string, { value: number }>)[localKey];
      if (data?.value === undefined || data?.value === null) continue;
      values[field.key] = data.value.toString();
    }
    return values;
  }, [nutritionData, nutritionModalSku]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    null,
  );
  const [selectedVersionData, setSelectedVersionData] = useState<{
    recipe: MagentoRecipe;
    ingredients: MagentoRecipeIngredient[];
  } | null>(null);
  const [, setLoadingVersion] = useState(false);

  const selectedVersionIngredientMap = useMemo(() => {
    if (!selectedVersionData) return new Map<string, MagentoRecipeIngredient>();
    return new Map(
      selectedVersionData.ingredients.map((ingredient) => [
        ingredient.sku,
        ingredient,
      ]),
    );
  }, [selectedVersionData]);

  const formatInlineValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') {
      return value.toLocaleString('it-IT', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      });
    }
    if (typeof value === 'boolean') {
      return value ? 'Sì' : 'No';
    }
    return String(value);
  };

  const parseInlineNumber = (value: unknown): number | null => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const sanitized = value.trim().replace(',', '.');
      if (!sanitized) return null;
      const parsed = Number(sanitized);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  };

  const valuesDiffer = (previous: unknown, current: unknown) => {
    if (!selectedVersionId) return false;
    if (previous === undefined || previous === null) return false;
    const prevNum = parseInlineNumber(previous);
    const currNum = parseInlineNumber(current);
    if (prevNum !== null && currNum !== null) {
      return Math.abs(prevNum - currNum) > 0.0001;
    }
    const prevStr = String(previous).trim();
    const currStr =
      current === undefined || current === null ? '' : String(current).trim();
    if (!prevStr && !currStr) return false;
    return prevStr !== currStr;
  };

  const renderInlineDiffHint = (previous: unknown, current: unknown) => {
    if (!valuesDiffer(previous, current)) return null;
    return (
      <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
        Versione selezionata: {formatInlineValue(previous)}
      </div>
    );
  };

  const handleNutritionChange = useCallback(
    (sku: string, field: NutritionField, value: number) => {
      setNutritionData((prev) => {
        const newNutritionData = new Map(prev);
        const currentNutrition =
          (newNutritionData.get(sku) as unknown as NutritionMap) || {};
        newNutritionData.set(sku, {
          ...currentNutrition,
          [field]: { value },
        } as IngredientNutritionAttributes);
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

  const fetchData = async (idNum: number) => {
    try {
      setLoading(true);
      const {
        recipe,
        ingredients,
        ovenTemperatures,
        mixingTimes,
        colatriceSettings,
      } = (await apiClient.get(`/api/recipes/${idNum}?t=${Date.now()}`)) as {
        recipe: MagentoRecipe;
        ingredients: MagentoRecipeIngredient[];
        ovenTemperatures?: Array<{
          id?: number;
          temperature: number;
          minutes: number;
          order: number;
        }>;
        mixingTimes?: Array<{
          id?: number;
          minutes: number;
          speed: number;
          order: number;
        }>;
        colatriceSettings?: Record<string, unknown> | null;
      };

      setInitialRecipe(recipe);
      setInitialIngredients(ingredients);
      // Store initial margin for change detection
      const initialMargin =
        recipe.marginPercent !== undefined && recipe.marginPercent !== null
          ? recipe.marginPercent.toString()
          : '';
      if (typeof window !== 'undefined') {
        (
          window as unknown as { initialRecipeMargin?: string }
        ).initialRecipeMargin = initialMargin;
      }
      setOvenTemperatures(ovenTemperatures || []);
      setMixingTimes(mixingTimes || []);

      // Update initial states for change detection
      setInitialOvenTemperatures(ovenTemperatures || []);
      setInitialMixingTimes(mixingTimes || []);

      // Initialize colatrice settings
      if (colatriceSettings && typeof colatriceSettings === 'object') {
        const parsed = colatriceSettings as Record<
          string,
          Record<string, number>
        >;
        // Ensure all pages exist
        const defaultSettings: Record<string, Record<string, number>> = {
          schermata_1: parsed.schermata_1 || {},
          schermata_2: parsed.schermata_2 || {},
          schermata_3: parsed.schermata_3 || {},
          tower_drop_easy_access: parsed.tower_drop_easy_access || {},
        };
        setColatriceSettings(defaultSettings);
        setInitialColatriceSettings(
          JSON.parse(JSON.stringify(defaultSettings)),
        );
      }
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invalidId) {
      router.replace('/404');
      return;
    }

    let cancelled = false;
    if (cancelled) return;
    setLoading(true);
    setError(null);

    fetchData(idNum).catch((e) => console.error(e));

    return () => {
      cancelled = true;
    };
  }, [idNum, invalidId, router]);

  useEffect(() => {
    if (invalidId) router.replace('/404');
  }, [invalidId, router]);

  // Load active production
  useEffect(() => {
    if (invalidId || !idNum) return;

    const loadActiveProduction = async () => {
      try {
        const response = (await apiClient.get(
          `/api/recipes/${idNum}/production/active`,
        )) as { ok?: boolean; production?: Production | null };
        if (response?.ok && response.production) {
          setActiveProduction(response.production);
          if (response.production.recipeVersionId) {
            // Optionally load version details if needed
            _setRecipeVersion(null); // Can be loaded separately if needed
          }
        } else {
          setActiveProduction(null);
        }
      } catch (e) {
        console.error('Failed to load active production', e);
        setActiveProduction(null);
      }
    };

    loadActiveProduction();
  }, [idNum, invalidId]);

  // Update recipe data when initialRecipe changes
  useEffect(() => {
    if (initialRecipe) {
      setRecipeData({
        id: initialRecipe.id,
        name: initialRecipe.name || '',
        notes: initialRecipe.notes || undefined,
        packageWeight: initialRecipe.packageWeight,
        numberOfPackages: initialRecipe.numberOfPackages,
        wastePercent: initialRecipe.wastePercent,
        waterPercent: initialRecipe.waterPercent,
        timeMinutes: initialRecipe.timeMinutes,
        temperatureCelsius: initialRecipe.temperatureCelsius,
        heightCm: initialRecipe.heightCm,
        widthCm: initialRecipe.widthCm,
        lengthCm: initialRecipe.lengthCm,
        createdAt: initialRecipe.createdAt,
        updatedAt: initialRecipe.updatedAt,
        totalQtyForRecipe: initialRecipe.totalQtyForRecipe,
        cookieWeightCookedG: initialRecipe.cookieWeightCookedG,
        mixerCapacityKg: initialRecipe.mixerCapacityKg,
        traysCapacityKg: initialRecipe.traysCapacityKg,
        depositorCapacityKg: initialRecipe.depositorCapacityKg,
        traysPerOvenLoad: initialRecipe.traysPerOvenLoad,
      });
      setTotalQtyForRecipe(Number(initialRecipe.totalQtyForRecipe || 0));
      // Load process fields
      const newProcessData = {
        cookiesCount: undefined as number | undefined,
        cookieWeightRawG: undefined as number | undefined,
        cookieWeightCookedG: initialRecipe.cookieWeightCookedG ?? undefined,
        trayWeightRawG: undefined as number | undefined,
        trayWeightCookedG: undefined as number | undefined,
        mixerCapacityKg: initialRecipe.mixerCapacityKg ?? undefined,
        doughBatchesCount: undefined as number | undefined,
        depositorCapacityKg: initialRecipe.depositorCapacityKg ?? undefined,
        depositorsCount: undefined as number | undefined,
        traysCapacityKg: initialRecipe.traysCapacityKg ?? undefined,
        traysCount: undefined as number | undefined,
        traysPerBatch: undefined as number | undefined,
        traysPerDepositors: undefined as number | undefined,
        traysPerOvenLoad: initialRecipe.traysPerOvenLoad ?? undefined,
        ovenLoadsCount: undefined as number | undefined,
        glutenTestDone: ((
          initialRecipe as unknown as { glutenTestDone?: number | string }
        ).glutenTestDone
          ? (initialRecipe as unknown as { glutenTestDone?: number | string })
              .glutenTestDone === 1 ||
            (initialRecipe as unknown as { glutenTestDone?: number | string })
              .glutenTestDone === 'yes'
            ? 'yes'
            : 'no'
          : '') as '' | 'yes' | 'no',
        steamMinutes:
          (initialRecipe as unknown as { steamMinutes?: number })
            .steamMinutes ?? undefined,
        valveOpenMinutes:
          (initialRecipe as unknown as { valveOpenMinutes?: number })
            .valveOpenMinutes ?? undefined,
        valveCloseMinutes:
          (initialRecipe as unknown as { valveCloseMinutes?: number })
            .valveCloseMinutes ?? undefined,
        lot: (initialRecipe as unknown as { lot?: string }).lot ?? undefined,
        laboratoryHumidityPercent:
          (initialRecipe as unknown as { laboratoryHumidityPercent?: number })
            .laboratoryHumidityPercent ?? undefined,
        externalTemperatureC:
          (initialRecipe as unknown as { externalTemperatureC?: number })
            .externalTemperatureC ?? undefined,
        waterTemperatureC:
          (initialRecipe as unknown as { waterTemperatureC?: number })
            .waterTemperatureC ?? undefined,
        finalDoughTemperatureC:
          (initialRecipe as unknown as { finalDoughTemperatureC?: number })
            .finalDoughTemperatureC ?? undefined,
        boxCapacity:
          (initialRecipe as unknown as { boxCapacity?: number }).boxCapacity ??
          undefined,
        numberOfBoxes: undefined as number | undefined,
        cartCapacity:
          (initialRecipe as unknown as { cartCapacity?: number })
            .cartCapacity ?? undefined,
        numberOfCarts: undefined as number | undefined,
      };
      setProcessData((prev) => ({ ...prev, ...newProcessData }));

      // Update initial states for change detection
      setInitialRecipeData({
        id: initialRecipe.id,
        name: initialRecipe.name || '',
        notes: initialRecipe.notes || undefined,
        packageWeight: initialRecipe.packageWeight,
        numberOfPackages: initialRecipe.numberOfPackages,
        wastePercent: initialRecipe.wastePercent,
        waterPercent: initialRecipe.waterPercent,
        timeMinutes: initialRecipe.timeMinutes,
        temperatureCelsius: initialRecipe.temperatureCelsius,
        heightCm: initialRecipe.heightCm,
        widthCm: initialRecipe.widthCm,
        lengthCm: initialRecipe.lengthCm,
        createdAt: initialRecipe.createdAt,
        updatedAt: initialRecipe.updatedAt,
        totalQtyForRecipe: initialRecipe.totalQtyForRecipe,
        cookieWeightCookedG: initialRecipe.cookieWeightCookedG,
        mixerCapacityKg: initialRecipe.mixerCapacityKg,
        traysCapacityKg: initialRecipe.traysCapacityKg,
        depositorCapacityKg: initialRecipe.depositorCapacityKg,
        traysPerOvenLoad: initialRecipe.traysPerOvenLoad,
      });
      setInitialProcessData(newProcessData);
    }
  }, [initialRecipe]);

  // Update ingredients data when initialIngredients changes
  useEffect(() => {
    if (initialIngredients.length > 0) {
      // Critical updates - keep synchronous for immediate use
      const newSkus = initialIngredients.map((i) => i.sku);
      const newIngredientName = new Map(
        initialIngredients.map((i) => [i.sku, i.name || '']),
      );
      const newQtyOriginal = new Map(
        initialIngredients.map((i) => [i.sku, Number(i.qtyOriginal) || 0]),
      );
      const newPowderIngredients = new Map(
        initialIngredients.map((i) => [i.sku, !!i.isPowderIngredient]),
      );

      setSkus(newSkus);
      setIngredientName(newIngredientName);
      setQtyOriginal(newQtyOriginal);
      setPriceCostPerKg(
        new Map(
          initialIngredients.map((i) => [i.sku, Number(i.priceCostPerKg) || 0]),
        ),
      );
      setPowderIngredients(newPowderIngredients);

      // Update initial states for change detection
      setInitialSkus(newSkus);

      // Non-critical updates - defer to reduce blocking
      startTransition(() => {
        // Initialize cost_price_list and weight from stored priceCostPerKg if available
        // Note: We don't have cost_price_list and weight in the database, so we'll need to fetch them from Magento
        // For now, we'll use the stored priceCostPerKg as fallback
        setCostPriceList(new Map());
        setIngredientWeight(new Map());
        setSupplier(
          new Map(
            initialIngredients.map((i) => [
              i.sku,
              (i.supplier as string | null | undefined) || '',
            ]),
          ),
        );
        setWarehouseLocation(
          new Map(
            initialIngredients.map((i) => [
              i.sku,
              (i.warehouseLocation as string | null | undefined) || '',
            ]),
          ),
        );
        setMpSku(
          new Map(
            initialIngredients.map((i) => [
              i.sku,
              (i.mpSku as string | null | undefined) || '',
            ]),
          ),
        );
        setProductName(
          new Map(
            initialIngredients.map((i) => [
              i.sku,
              (i.productName as string | null | undefined) || '',
            ]),
          ),
        );
        setIngredientLot(
          new Map(
            initialIngredients.map((i) => [
              i.sku,
              ((i as unknown as { lot?: string | null }).lot as
                | string
                | null
                | undefined) || '',
            ]),
          ),
        );
        const newDone = new Map(
          initialIngredients.map((i) => [
            i.sku,
            !!(i as unknown as { done?: number | boolean | null }).done,
          ]),
        );
        setDone(newDone);
        const newCheckGlutine = new Map(
          initialIngredients.map((i) => [
            i.sku,
            !!(i as unknown as { checkGlutine?: number | boolean | null })
              .checkGlutine,
          ]),
        );
        setCheckGlutine(newCheckGlutine);

        const newSupplier = new Map(
          initialIngredients.map((i) => [
            i.sku,
            (i.supplier as string | null | undefined) || '',
          ]),
        );
        const newWarehouseLocation = new Map(
          initialIngredients.map((i) => [
            i.sku,
            (i.warehouseLocation as string | null | undefined) || '',
          ]),
        );
        const newMpSku = new Map(
          initialIngredients.map((i) => [
            i.sku,
            (i.mpSku as string | null | undefined) || '',
          ]),
        );
        const newProductName = new Map(
          initialIngredients.map((i) => [
            i.sku,
            (i.productName as string | null | undefined) || '',
          ]),
        );
        const newIngredientLot = new Map(
          initialIngredients.map((i) => [
            i.sku,
            ((i as unknown as { lot?: string | null }).lot as
              | string
              | null
              | undefined) || '',
          ]),
        );

        setSupplier(newSupplier);
        setWarehouseLocation(newWarehouseLocation);
        setMpSku(newMpSku);
        setProductName(newProductName);
        setIngredientLot(newIngredientLot);

        // Update initial ingredient data for change detection
        setInitialIngredientData({
          names: newIngredientName,
          qtyOriginal: newQtyOriginal,
          powderIngredients: newPowderIngredients,
          supplier: newSupplier,
          warehouseLocation: newWarehouseLocation,
          mpSku: newMpSku,
          productName: newProductName,
          lot: newIngredientLot,
          done: newDone,
          checkGlutine: newCheckGlutine,
        });

        const nutritionMap = new Map(
          initialIngredients.map((i) => {
            const attrs: NutritionMap = {};
            const rec = i as unknown as Partial<Record<NutritionField, number>>;
            for (const field of nutritionFields) {
              const val = Number(rec[field]);
              if (Number.isFinite(val)) {
                attrs[field] = { value: val };
              }
            }
            return [i.sku, attrs as IngredientNutritionAttributes] as const;
          }),
        );
        setNutritionData(nutritionMap);
      });

      // Recupera cost_price_list e weight da Magento per gli ingredienti esistenti
      const fetchMagentoAttributes = async () => {
        // Use mpSku if available, otherwise fallback to ingredient sku
        const skusToFetch = initialIngredients
          .map((i) => (i.mpSku as string | null | undefined) || i.sku)
          .filter((sku): sku is string => Boolean(sku));

        if (skusToFetch.length === 0) {
          return;
        }

        try {
          const response = await fetch('/api/products/by-skus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              skus: skusToFetch,
              includeNutritionAttributes: true,
            }),
          });
          const data = await response.json();
          if (data?.items && Array.isArray(data.items)) {
            const costPriceMap = new Map<string, number>();
            const weightMap = new Map<string, number>();

            // Create a map from Magento SKU to ingredient SKU
            const magentoSkuToIngredientSku = new Map<string, string>();
            for (const ingredient of initialIngredients) {
              const magentoSku =
                (ingredient.mpSku as string | null | undefined) ||
                ingredient.sku;
              if (magentoSku) {
                magentoSkuToIngredientSku.set(magentoSku, ingredient.sku);
              }
            }

            for (const product of data.items) {
              // Find the ingredient SKU that corresponds to this Magento product SKU
              let ingredientSku = magentoSkuToIngredientSku.get(product.sku);

              // Fallback: if not found in map, try direct match with ingredient SKU
              // This handles the case where ingredient SKU matches Magento SKU directly
              if (!ingredientSku) {
                // Check if product.sku matches any ingredient SKU directly
                const matchingIngredient = initialIngredients.find(
                  (i) => i.sku === product.sku,
                );
                if (matchingIngredient) {
                  ingredientSku = matchingIngredient.sku;
                } else {
                  continue; // Skip if no matching ingredient found
                }
              }

              if (
                product.cost_price_list !== undefined &&
                product.cost_price_list > 0
              ) {
                costPriceMap.set(ingredientSku, product.cost_price_list);
              }
              if (
                product.weight !== undefined &&
                product.weight !== null &&
                product.weight > 0
              ) {
                const weightValue = toNumberStrict(product.weight);
                weightMap.set(ingredientSku, weightValue);
              }
            }

            setCostPriceList(costPriceMap);
            setIngredientWeight(weightMap);
          }
        } catch (error) {
          console.error('Failed to fetch Magento attributes:', error);
        }
      };

      fetchMagentoAttributes();
    }
  }, [initialIngredients]);

  // Reload Magento attributes when mpSku changes
  // Convert Map to string for dependency tracking
  const mpSkuString = useMemo(
    () => JSON.stringify(Array.from(mpSku.entries()).sort()),
    [mpSku],
  );

  useEffect(() => {
    if (skus.length === 0 || initialIngredients.length === 0) return;

    const fetchMagentoAttributes = async () => {
      // Use current mpSku values from state, only fetch if mpSku is set
      const skusToFetch: string[] = [];
      const magentoSkuToIngredientSku = new Map<string, string>();

      for (const sku of skus) {
        const currentMpSku = mpSku.get(sku);
        if (currentMpSku && currentMpSku.trim() !== '') {
          skusToFetch.push(currentMpSku);
          magentoSkuToIngredientSku.set(currentMpSku, sku);
        }
      }

      if (skusToFetch.length === 0) {
        // Don't clear maps if no mpSku values are set - data might have been loaded using ingredient SKU
        // Only clear if mpSku was previously set and now removed
        return;
      }

      try {
        const response = await fetch('/api/products/by-skus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skus: skusToFetch,
            includeNutritionAttributes: true,
          }),
        });
        const data = await response.json();
        if (data?.items && Array.isArray(data.items)) {
          const costPriceMap = new Map<string, number>();
          const weightMap = new Map<string, number>();

          for (const product of data.items) {
            // Find the ingredient SKU that corresponds to this Magento product SKU
            const ingredientSku = magentoSkuToIngredientSku.get(product.sku);
            if (!ingredientSku) {
              continue; // Skip if no matching ingredient found
            }

            if (
              product.cost_price_list !== undefined &&
              product.cost_price_list > 0
            ) {
              costPriceMap.set(ingredientSku, product.cost_price_list);
            }
            if (
              product.weight !== undefined &&
              product.weight !== null &&
              product.weight > 0
            ) {
              const weightValue = toNumberStrict(product.weight);
              weightMap.set(ingredientSku, weightValue);
            }
          }

          // Update maps, but only for SKUs that have mpSku set
          setCostPriceList((prev) => {
            const updated = new Map(prev);
            // Clear old values for SKUs that no longer have mpSku
            for (const sku of skus) {
              if (!mpSku.get(sku) || mpSku.get(sku)?.trim() === '') {
                updated.delete(sku);
              }
            }
            // Add new values
            for (const [sku, value] of costPriceMap) {
              updated.set(sku, value);
            }
            return updated;
          });
          setIngredientWeight((prev) => {
            const updated = new Map(prev);
            // Clear old values for SKUs that no longer have mpSku
            for (const sku of skus) {
              if (!mpSku.get(sku) || mpSku.get(sku)?.trim() === '') {
                updated.delete(sku);
              }
            }
            // Add new values
            for (const [sku, value] of weightMap) {
              updated.set(sku, value);
            }
            return updated;
          });
        }
      } catch (error) {
        console.error('Failed to fetch Magento attributes:', error);
      }
    };

    // Debounce to avoid too many requests
    const timeoutId = setTimeout(() => {
      fetchMagentoAttributes();
    }, 500);

    return () => clearTimeout(timeoutId);
    // mpSku is intentionally excluded - we only want to recalculate when skus/mpSkuString change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skus, mpSkuString, initialIngredients.length]);

  useEffect(() => {
    const value =
      (((recipeData.packageWeight || 0) * (recipeData.numberOfPackages || 0)) /
        (100 - totalWastePercent)) *
      100;
    if (Number.isFinite(value)) {
      setTotalQtyForRecipe(Number(value.toFixed(2)));
    }
  }, [
    recipeData.packageWeight,
    recipeData.numberOfPackages,
    totalWastePercent,
  ]);

  // Profile is now loaded from ProfileProvider in layout
  useEffect(() => {
    if (!profile) {
      // Redirect to login if no profile (middleware should handle this, but this is a fallback)
      router.replace('/login');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]); // router.replace is stable, no need to include router in deps

  // --- Begin inlined AdminRecipeEditorClient code ---

  const setRecipeDataByKey = <K extends keyof NewRecipeProps>(
    key: K,
    value: NewRecipeProps[K],
  ) => {
    setRecipeData((prev: NewRecipeProps) => ({ ...prev, [key]: value }));
  };

  const handlePickMany = (rows: MagentoProductWithNutritionAttributes[]) => {
    const newItems = rows.filter((p) => !skus.includes(p.sku));

    setSkus((prev) => [...prev, ...newItems.map((p) => p.sku)]);

    setIngredientName((prev) => {
      const newIngredientName = new Map(prev);
      for (const { sku, name } of newItems) {
        newIngredientName.set(sku, name || '');
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

    // Store cost_price_list and weight from Magento
    setCostPriceList((prev) => {
      const newCostPriceList = new Map(prev);
      for (const item of newItems) {
        const sku = item.sku;
        // cost_price_list is a custom Magento attribute, access it via type assertion
        const costPrice =
          ((item as unknown as { cost_price_list?: number }).cost_price_list as
            | number
            | undefined) || 0;
        newCostPriceList.set(sku, costPrice);
      }
      return newCostPriceList;
    });

    setIngredientWeight((prev) => {
      const newIngredientWeight = new Map(prev);
      for (const { sku, weight } of newItems) {
        const weightValue = toNumberStrict(weight || 0);
        newIngredientWeight.set(sku, weightValue);
      }
      return newIngredientWeight;
    });

    // Calculate and store priceCostPerKg for backward compatibility (will be calculated automatically)
    setPriceCostPerKg((prev) => {
      const newPriceCostPerKg = new Map(prev);
      for (const item of newItems) {
        const sku = item.sku;
        // cost_price_list is a custom Magento attribute, access it via type assertion
        const costPrice =
          ((item as unknown as { cost_price_list?: number }).cost_price_list as
            | number
            | undefined) || 0;
        const weightValue = toNumberStrict(item.weight || 0);
        if (weightValue > 0 && costPrice > 0) {
          newPriceCostPerKg.set(sku, toNumberStrict(costPrice / weightValue));
        } else {
          newPriceCostPerKg.set(sku, 0);
        }
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
    async (sku: string, product: MagentoProductWithNutritionAttributes) => {
      // Update mpSku with product SKU
      setMpSku((prev) => {
        const m = new Map(prev);
        m.set(sku, product.sku);
        return m;
      });

      // Update productName with product name
      setProductName((prev) => {
        const m = new Map(prev);
        m.set(sku, product.name || '');
        return m;
      });

      // Update supplier from Magento
      if (product.supplier) {
        setSupplier((prev) => {
          const m = new Map(prev);
          m.set(sku, product.supplier!);
          return m;
        });
      }

      // Update warehouseLocation from Magento
      if (product.warehouse_location) {
        setWarehouseLocation((prev) => {
          const m = new Map(prev);
          m.set(sku, product.warehouse_location!);
          return m;
        });
      }

      // If cost_price_list is not available in the search result, fetch the complete product data
      let finalProduct = product;
      if (
        product.cost_price_list === undefined ||
        product.cost_price_list === null
      ) {
        try {
          const response = await fetch('/api/products/by-skus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              skus: [product.sku],
              includeNutritionAttributes: true,
            }),
          });
          const data = await response.json();
          if (data?.items && data.items.length > 0) {
            finalProduct = data.items[0];
          }
        } catch {
          // Silently fail - will use product from search result
        }
      }

      // Update cost_price_list and weight if available
      if (
        finalProduct.cost_price_list !== undefined &&
        finalProduct.cost_price_list !== null
      ) {
        setCostPriceList((prev) => {
          const m = new Map(prev);
          m.set(sku, finalProduct.cost_price_list!);
          return m;
        });
      }

      if (finalProduct.weight !== undefined && finalProduct.weight !== null) {
        const weightValue = toNumberStrict(finalProduct.weight);
        setIngredientWeight((prev) => {
          const m = new Map(prev);
          m.set(sku, weightValue);
          return m;
        });
      }

      // Update priceCostPerKg if cost_price_list and weight are available
      if (
        finalProduct.cost_price_list !== undefined &&
        finalProduct.cost_price_list !== null &&
        finalProduct.cost_price_list > 0 &&
        finalProduct.weight !== undefined &&
        finalProduct.weight !== null &&
        finalProduct.weight > 0
      ) {
        const weightNum =
          typeof finalProduct.weight === 'string'
            ? toNumberStrict(finalProduct.weight)
            : finalProduct.weight;
        const calculated = finalProduct.cost_price_list / weightNum;
        setPriceCostPerKg((prev) => {
          const m = new Map(prev);
          m.set(sku, toNumberStrict(calculated));
          return m;
        });
      }
    },
    [],
  );

  const handleAutoMatch = useCallback(async () => {
    if (skus.length === 0) {
      setToast('Nessun ingrediente da matchare', { type: 'info' });
      return;
    }

    try {
      setToast('Ricerca prodotti in corso...', { type: 'info' });

      const response = (await apiClient.post('/api/products/by-skus', {
        skus: skus,
        includeNutritionAttributes: true,
      })) as {
        items?: MagentoProductWithNutritionAttributes[];
        error?: string;
      };

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.items || !Array.isArray(response.items)) {
        throw new Error('Risposta API non valida');
      }

      // Create a map with normalized SKUs (trim + lowercase) for case-insensitive matching
      const productsBySku = new Map(
        response.items
          .filter((product) => product.sku && typeof product.sku === 'string')
          .map((product) => [product.sku.trim().toLowerCase(), product]),
      );

      const matchedSkus: string[] = [];
      const notFoundSkus: string[] = [];

      for (const sku of skus) {
        if (!sku || typeof sku !== 'string') {
          notFoundSkus.push(sku || '');
          continue;
        }
        const normalizedSku = sku.trim().toLowerCase();
        const product = productsBySku.get(normalizedSku);
        if (product) {
          await handleProductSelect(sku, product);
          matchedSkus.push(sku);
        } else {
          notFoundSkus.push(sku);
        }
      }

      if (matchedSkus.length > 0) {
        setToast(
          `Matchati ${matchedSkus.length} di ${skus.length} ingredienti`,
          { type: 'success' },
        );
      }

      if (notFoundSkus.length > 0) {
        setToast(`SKU non trovati: ${notFoundSkus.join(', ')}`, {
          type: 'warning',
        });
      }
    } catch (error) {
      console.error('[handleAutoMatch] Failed to match ingredients:', error);
      setToast(
        error instanceof Error
          ? `Errore durante il match: ${error.message}`
          : 'Errore durante il match degli ingredienti',
        { type: 'error' },
      );
    }
  }, [skus, handleProductSelect, setToast]);

  const handleRemoveIngredient = (sku: string) => {
    setSkus((prev) => prev.filter((s) => s !== sku));
    setIngredientName((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setQtyOriginal((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setPriceCostPerKg((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setIngredientLot((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setDone((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setCheckGlutine((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setCostPriceList((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setIngredientWeight((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
    setPowderIngredients((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
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
    setNutritionData((prev) => {
      const m = new Map(prev);
      m.delete(sku);
      return m;
    });
  };

  const toggleShowNutritionData = () => {
    setShowNutritionData((prev) => !prev);
  };

  const handleNutritionModalValuesApplied = useCallback(
    (values: Record<string, string>) => {
      if (!nutritionModalSku) return;
      setNutritionData((prev) => {
        const next = new Map(prev);
        const existing =
          (next.get(nutritionModalSku) as IngredientNutritionAttributes) || {};
        const updated: IngredientNutritionAttributes = { ...existing };
        for (const field of MAGENTO_NUTRIENT_FIELDS) {
          const raw = values[field.key];
          if (raw === undefined || raw === null || raw === '') continue;
          const numeric = Number.parseFloat(String(raw));
          if (!Number.isFinite(numeric)) continue;
          const localKey = normalizeLocalNutritionKey(
            field.key,
          ) as keyof IngredientNutritionAttributes;
          const unit =
            existing[localKey]?.unit ??
            IngredientNutritionAttributeUnit[
              localKey as keyof typeof IngredientNutritionAttributeUnit
            ] ??
            field.unit;
          (
            updated as Record<
              keyof IngredientNutritionAttributes,
              { value: number; unit: string }
            >
          )[localKey] = {
            value: numeric,
            unit,
          };
        }
        next.set(nutritionModalSku, updated);
        return next;
      });
      setToast(
        `Valori nutrizionali aggiornati per ${
          ingredientName.get(nutritionModalSku) || nutritionModalSku
        }.`,
        { type: 'success' },
      );
    },
    [ingredientName, nutritionModalSku, setToast],
  );

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!recipeData.name || recipeData.name.trim().length === 0) {
        setToast('Please provide a recipe name.', { type: 'error' });
        return;
      }

      const recipePayload: NewRecipeProps = {
        ...recipeData,
        totalQtyForRecipe,
        cookieWeightCookedG: processData.cookieWeightCookedG ?? 0,
        mixerCapacityKg: processData.mixerCapacityKg ?? 0,
        traysCapacityKg: processData.traysCapacityKg ?? 0,
        depositorCapacityKg: processData.depositorCapacityKg ?? 0,
        traysPerOvenLoad: processData.traysPerOvenLoad ?? 0,
        boxCapacity: processData.boxCapacity ?? 0,
        cartCapacity: processData.cartCapacity ?? 0,
        marginPercent:
          typeof window !== 'undefined' &&
          (window as unknown as { recipeMargin?: string }).recipeMargin
            ? parseFloat(
                (window as unknown as { recipeMargin?: string }).recipeMargin ||
                  '0',
              )
            : undefined,
        sellingPrice:
          typeof window !== 'undefined' &&
          (window as unknown as { recipeSellingPrice?: number })
            .recipeSellingPrice
            ? (window as unknown as { recipeSellingPrice?: number })
                .recipeSellingPrice || 0
            : undefined,
        steamMinutes: processData.steamMinutes ?? 0,
        valveOpenMinutes: processData.valveOpenMinutes ?? 0,
        valveCloseMinutes: processData.valveCloseMinutes ?? 0,
        glutenTestDone:
          processData.glutenTestDone === 'yes'
            ? 1
            : processData.glutenTestDone === 'no'
              ? 0
              : undefined,
        lot: processData.lot ?? undefined,
        laboratoryHumidityPercent:
          processData.laboratoryHumidityPercent ?? undefined,
        externalTemperatureC: processData.externalTemperatureC ?? undefined,
        waterTemperatureC: processData.waterTemperatureC ?? undefined,
        finalDoughTemperatureC: processData.finalDoughTemperatureC ?? undefined,
      } as NewRecipeProps;

      const preparedIngredients: NewIngredientProps[] = skus.map((sku) => {
        const nutrition = (nutritionData.get(sku) || {}) as unknown as Record<
          NutritionField,
          { value: number; unit?: string }
        >;
        return {
          sku,
          name: ingredientName.get(sku) || '',
          qtyForRecipe: qtyForRecipe.get(sku) || 0,
          qtyOriginal: qtyOriginal.get(sku) || 0,
          priceCostPerKg: priceCostPerKgAuto.get(sku) || 0,
          isPowderIngredient: powderIngredients.get(sku) ? 1 : 0,
          supplier: supplier.get(sku) || null,
          warehouseLocation: warehouseLocation.get(sku) || null,
          mpSku: mpSku.get(sku) || null,
          productName: productName.get(sku) || null,
          lot: (ingredientLot.get(sku)?.trim() || null) as string | null,
          done: done.get(sku) ? 1 : 0,
          checkGlutine: checkGlutine.get(sku) ? 1 : 0,
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
        };
      });

      // Determine changes vs initialIngredients
      const currentSkus = new Set(skus);
      const initialSkus = new Set(initialIngredients.map((i) => i.sku));

      const ingredientsToRemove = initialIngredients.filter(
        (i) => !currentSkus.has(i.sku),
      );
      const ingredientsToAdd = preparedIngredients.filter(
        (i) => !initialSkus.has(i.sku),
      );
      const ingredientsToUpdate = preparedIngredients
        .filter((i) => initialSkus.has(i.sku))
        .map((ing) => {
          const existing = initialIngredients.find((i) => i.sku === ing.sku);
          return {
            ...ing,
            id: existing?.id || 0,
            recipeId: initialRecipe?.id || 0,
          };
        });

      // Prepara i costi da salvare (solo quelli personalizzati, non quelli standard)
      const costsToSave = recipeCosts
        .filter((cost) => !cost.isStandard && cost.value !== cost.standardValue)
        .map(({ costType, value }) => ({
          costType: costType as CostType,
          value,
        }));

      // Prepare oven temperatures and mixing times with order
      const ovenTempsToSave = ovenTemperatures.map((ot, index) => ({
        ...ot,
        order: index,
      }));
      const mixingTimesToSave = mixingTimes.map((mt, index) => ({
        ...mt,
        order: index,
      }));

      // Prepare ingredient overrides if production
      const ingredientOverrides = activeProduction
        ? skus
            .map((sku) => {
              const ing = initialIngredients.find((i) => i.sku === sku);
              if (!ing) return null;
              const lot = ingredientLot.get(sku)?.trim();
              const productNameOverride = productName.get(sku)?.trim();
              const mpSkuOverride = mpSku.get(sku)?.trim();
              const supplierOverride = supplier.get(sku)?.trim();
              const warehouseLocationOverride = warehouseLocation
                .get(sku)
                ?.trim();

              // Only include if at least one override is present
              if (
                !lot &&
                !productNameOverride &&
                !mpSkuOverride &&
                !supplierOverride &&
                !warehouseLocationOverride
              ) {
                return null;
              }

              return {
                ingredientId: ing.id,
                ...(lot ? { lot } : {}),
                ...(productNameOverride ? { productNameOverride } : {}),
                ...(mpSkuOverride ? { mpSkuOverride } : {}),
                ...(supplierOverride ? { supplierOverride } : {}),
                ...(warehouseLocationOverride
                  ? { warehouseLocationOverride }
                  : {}),
              };
            })
            .filter((o): o is NonNullable<typeof o> => o !== null)
        : [];

      const putBody = {
        recipeData: recipePayload,
        ingredientsToRemove,
        ingredientsToAdd,
        ingredientsToUpdate,
        costs: costsToSave,
        ovenTemperatures: ovenTempsToSave,
        mixingTimes: mixingTimesToSave,
        colatriceSettings,
        isProduction: !!activeProduction,
        ...(activeProduction?.id ? { productionId: activeProduction.id } : {}),
        ...(ingredientOverrides.length > 0 ? { ingredientOverrides } : {}),
      };

      // Save processes if the function is available
      const saveProcessesFn = (
        window as unknown as { saveRecipeProcesses?: () => Promise<void> }
      ).saveRecipeProcesses;
      if (typeof saveProcessesFn === 'function') {
        try {
          await saveProcessesFn();
        } catch (e) {
          console.error('Failed to save processes:', e);
          // Don't fail the entire save if processes fail
        }
      }

      const {
        createdRecipe,
        error,
        versionId,
        historyCount: _historyCount,
      } = (await apiClient.put('/api/recipes/' + initialRecipe?.id, putBody, {
        headers: { 'Content-Type': 'application/json' },
      })) as {
        createdRecipe: MagentoRecipe;
        error?: string;
        versionId?: number | null;
        historyCount?: number;
      };

      if (createdRecipe?.id) {
        const message =
          activeProduction && versionId
            ? `Ricetta salvata. Creata nuova versione ${versionId} durante la produzione.`
            : 'Ricetta salvata con successo.';
        setToast(message, {
          type: 'success',
        });

        // Update initial margin after save
        if (typeof window !== 'undefined') {
          const currentMargin =
            (window as unknown as { recipeMargin?: string }).recipeMargin || '';
          (
            window as unknown as { initialRecipeMargin?: string }
          ).initialRecipeMargin = currentMargin;
        }

        // Reload active production to get updated version
        if (activeProduction) {
          try {
            const prodResponse = (await apiClient.get(
              `/api/recipes/${idNum}/production/active`,
            )) as { ok?: boolean; production?: Production | null };
            if (prodResponse?.ok && prodResponse.production) {
              setActiveProduction(prodResponse.production);
            }
          } catch (e) {
            console.error('Failed to reload production', e);
          }
        }

        // Reload data instead of redirecting to update initial state
        if (!activeProduction) {
          // Reload data to update initial state
          await fetchData(idNum);
          // Update initial states after reload
          setInitialRecipeCosts([...recipeCosts]);
          // Reset colatrice settings initial state will be set in fetchData
        }
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

  // Legacy visibility filter removed: keep helper for compatibility (always true)
  type Visibility = 'frontend' | 'backend' | 'both';
  const { getEffectiveCapabilities, isOperatorView } = useOperatorView();
  const effectiveCapabilities = getEffectiveCapabilities(profile?.capabilities);

  // Check role property first (most reliable), then roleLabel as fallback
  // The role property is derived from roleLabel and validated, so it's more reliable
  const isAdmin = profile?.role === 'admin' || isAdminRole(profile?.roleLabel);

  const _showField = useCallback((_visibility: Visibility) => true, []);

  const canViewField = useCallback(
    (capabilityId: string) => {
      const isOperator = profile?.roleLabel === 'operator';

      // Admin always sees everything (unless in operator view)
      if (isAdmin && !isOperatorView) {
        return true;
      }

      // Check if capability is explicitly denied (for non-admin users)
      // First check the specific capability, then check parent nodes
      if (effectiveCapabilities) {
        // First, check if the specific capability is explicitly denied
        const specificRule = effectiveCapabilities[capabilityId];
        // Check if the specific capability exists and is explicitly set to visible: false
        // Use strict equality check for false to ensure we catch explicit false values
        if (
          specificRule &&
          typeof specificRule === 'object' &&
          'visible' in specificRule &&
          specificRule.visible === false
        ) {
          // Only log for automatch and actions
          if (
            capabilityId === INGREDIENT_CAPABILITIES.automatch ||
            capabilityId === INGREDIENT_CAPABILITIES.actions
          ) {
            console.log(
              `[canViewField] ${capabilityId}: DENIED (explicit false)`,
              {
                key: capabilityId,
                rule: specificRule,
                ruleType: typeof specificRule,
                visibleValue: specificRule.visible,
                visibleType: typeof specificRule.visible,
                effectiveCapabilitiesKeys: Object.keys(effectiveCapabilities),
              },
            );
          }
          return false;
        }
        // Then check parent nodes for explicit denial
        let key: string | null = capabilityId;
        while (key) {
          const idx = key.lastIndexOf('.');
          if (idx === -1) break;
          key = key.slice(0, idx);
          const rule = effectiveCapabilities[key];
          if (
            rule &&
            typeof rule === 'object' &&
            'visible' in rule &&
            rule.visible === false
          ) {
            // Only log for automatch and actions
            if (
              capabilityId === INGREDIENT_CAPABILITIES.automatch ||
              capabilityId === INGREDIENT_CAPABILITIES.actions
            ) {
              console.log(
                `[canViewField] ${capabilityId}: DENIED (parent ${key})`,
                { key, rule },
              );
            }
            return false;
          }
        }
      }
      // Call canView to get the result based on opt-in logic
      // canView handles:
      // - If capability is not found and capabilities are configured -> deny (opt-in)
      // - If capability is found -> use its visible value
      // - If capabilities are empty and user is operator -> deny (deny-by-default for operators)
      // - If capabilities are empty and user is not operator -> allow (default)
      const result = canView(
        effectiveCapabilities,
        capabilityId,
        isOperatorView,
        isOperator,
      );
      return result;
    },
    [effectiveCapabilities, isOperatorView, profile?.roleLabel, isAdmin],
  );
  const canEditField = useCallback(
    (capabilityId: string) => {
      // Admin should be able to edit everything when not in operator view
      if (isAdmin && !isOperatorView) {
        return true;
      }
      return canEdit(effectiveCapabilities, capabilityId);
    },
    [effectiveCapabilities, isAdmin, isOperatorView],
  );

  // Column visibility and sizing with localStorage
  const { getColumn } = useIngredientTableColumns();

  // Helper to check if an ingredient column is visible (combines permissions + localStorage)
  const canViewIngredientColumn = useCallback(
    (columnId: IngredientColumnId) => {
      const capabilityId = `recipe.ingredients.column.${columnId}`;
      const hasPermission = canViewField(capabilityId);
      if (!hasPermission) {
        return false;
      }
      // For action column, also check recipe.ingredients.actions capability
      if (columnId === 'action') {
        const hasActionsPermission = canViewField(
          INGREDIENT_CAPABILITIES.actions,
        );
        if (!hasActionsPermission) {
          return false;
        }
      }
      const columnConfig = getColumn(columnId);
      return columnConfig?.visible ?? true;
    },
    [canViewField, getColumn],
  );

  // Get column width from config
  const getColumnWidth = useCallback(
    (columnId: IngredientColumnId): string => {
      const columnConfig = getColumn(columnId);
      return `${columnConfig?.width ?? 8}%`;
    },
    [getColumn],
  );
  const allowedIngredientColumnIds = useMemo(
    () =>
      INGREDIENT_COLUMN_IDS.filter((columnId) =>
        canViewField(`recipe.ingredients.column.${columnId}`),
      ),
    [canViewField],
  );
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
    boxCapacity: undefined as number | undefined,
    numberOfBoxes: undefined as number | undefined,
    cartCapacity: undefined as number | undefined,
    numberOfCarts: undefined as number | undefined,

    // Pianificazione
    traysPerBatch: undefined as number | undefined,
    traysPerDepositors: undefined as number | undefined,
    traysPerOvenLoad: undefined as number | undefined,
    ovenLoadsCount: undefined as number | undefined,

    // Qualità & Processo
    glutenTestDone: '' as '' | 'yes' | 'no',
    steamMinutes: undefined as number | undefined,
    valveOpenMinutes: undefined as number | undefined,
    valveCloseMinutes: undefined as number | undefined,
    lot: undefined as string | undefined,
    laboratoryHumidityPercent: undefined as number | undefined,
    externalTemperatureC: undefined as number | undefined,
    waterTemperatureC: undefined as number | undefined,
    finalDoughTemperatureC: undefined as number | undefined,
  });

  // Oven temperatures (multiple entries)
  const [ovenTemperatures, setOvenTemperatures] = useState<
    Array<{ id?: number; temperature: number; minutes: number; order: number }>
  >([]);

  // Mixing times (multiple entries)
  const [mixingTimes, setMixingTimes] = useState<
    Array<{ id?: number; minutes: number; speed: number; order: number }>
  >([]);

  // Colatrice settings (JSON structure with 4 pages)
  const [colatriceSettings, setColatriceSettings] = useState<
    Record<string, Record<string, number>>
  >({
    schermata_1: {},
    schermata_2: {},
    schermata_3: {},
    tower_drop_easy_access: {},
  });

  const [initialColatriceSettings, setInitialColatriceSettings] = useState<
    Record<string, Record<string, number>>
  >({
    schermata_1: {},
    schermata_2: {},
    schermata_3: {},
    tower_drop_easy_access: {},
  });

  const [colatriceActiveTab, setColatriceActiveTab] = useState<
    'home' | 'page1' | 'page2' | 'page3'
  >('home');

  // Calculate raw cookie weight: cooked weight / (1 - water percentage)
  // The water percentage is part of the raw weight, so cooked = raw × (1 - water%)
  // Therefore: raw = cooked / (1 - water%)
  const cookieWeightRawGAuto = useMemo(() => {
    const cooked = processData.cookieWeightCookedG ?? 0;
    const waterPercent = recipeData.waterPercent ?? 0;
    if (cooked === 0 || waterPercent === 0 || waterPercent >= 100)
      return undefined;
    const value = cooked / (1 - waterPercent / 100);
    return Number.isFinite(value) && value > 0
      ? Number(value.toFixed(2))
      : undefined;
  }, [processData.cookieWeightCookedG, recipeData.waterPercent]);

  // Calculate number of dough batches: round(totalQtyForRecipe (kg) / mixerCapacityKg, 1)
  const doughBatchesCountAuto = useMemo(() => {
    const totalQtyKg = totalQtyForRecipe / 1000; // Convert grams to kg
    const mixerCapacity = processData.mixerCapacityKg ?? 0;
    if (totalQtyKg === 0 || mixerCapacity === 0) return undefined;
    const value = totalQtyKg / mixerCapacity;
    if (!Number.isFinite(value) || value <= 0) return undefined;
    // Round to nearest integer
    return Math.round(value);
  }, [totalQtyForRecipe, processData.mixerCapacityKg]);

  // Calculate number of depositors: round(totalQtyForRecipe (kg) / depositorCapacityKg, 1)
  const depositorsCountAuto = useMemo(() => {
    const totalQtyKg = totalQtyForRecipe / 1000; // Convert grams to kg
    const depositorCapacity = processData.depositorCapacityKg ?? 0;
    if (totalQtyKg === 0 || depositorCapacity === 0) return undefined;
    const value = totalQtyKg / depositorCapacity;
    if (!Number.isFinite(value) || value <= 0) return undefined;
    // Round to nearest integer
    return Math.round(value);
  }, [totalQtyForRecipe, processData.depositorCapacityKg]);

  // Calculate number of cookies: totalQtyForRecipe / cookieWeightRawG
  const cookiesCountAuto = useMemo(() => {
    const totalQty = totalQtyForRecipe;
    const rawWeight = cookieWeightRawGAuto ?? processData.cookieWeightRawG ?? 0;
    if (totalQty === 0 || rawWeight === 0) return undefined;
    const value = totalQty / rawWeight;
    if (!Number.isFinite(value) || value <= 0) return undefined;
    // Round to nearest integer
    return Math.round(value);
  }, [totalQtyForRecipe, cookieWeightRawGAuto, processData.cookieWeightRawG]);

  // Calculate number of trays: cookiesCount / traysCapacityKg
  const traysCountAuto = useMemo(() => {
    const cookies = cookiesCountAuto ?? processData.cookiesCount ?? 0;
    const traysCapacity = processData.traysCapacityKg ?? 0;
    if (cookies === 0 || traysCapacity === 0) return undefined;
    const value = cookies / traysCapacity;
    if (!Number.isFinite(value) || value <= 0) return undefined;
    // Round to nearest integer
    return Math.round(value);
  }, [cookiesCountAuto, processData.cookiesCount, processData.traysCapacityKg]);

  // Calculate number of oven loads: traysCount / traysPerOvenLoad
  const ovenLoadsCountAuto = useMemo(() => {
    // Use calculated traysCount if available, otherwise fall back to manual input
    const trays =
      traysCountAuto !== undefined
        ? traysCountAuto
        : (processData.traysCount ?? undefined);
    const traysPerLoad = processData.traysPerOvenLoad ?? undefined;

    // If either value is missing or zero, cannot calculate
    if (
      trays === undefined ||
      trays === 0 ||
      traysPerLoad === undefined ||
      traysPerLoad === 0
    ) {
      return undefined;
    }

    const value = trays / traysPerLoad;
    if (!Number.isFinite(value) || value <= 0) return undefined;

    // Round up to nearest integer (arrotondamento per eccesso)
    // Always return at least 1
    return Math.max(1, Math.ceil(value));
  }, [traysCountAuto, processData.traysCount, processData.traysPerOvenLoad]);

  // Calculate number of trays per batch: totalQtyForRecipe / (cookieWeightRawG * traysCapacityKg)
  const traysPerBatchAuto = useMemo(() => {
    const totalQty = totalQtyForRecipe; // in grams
    const rawWeight =
      cookieWeightRawGAuto ?? processData.cookieWeightRawG ?? undefined; // in grams
    const traysCapacity = processData.traysCapacityKg ?? undefined; // number

    // If any value is missing or zero, cannot calculate
    if (
      totalQty === 0 ||
      rawWeight === undefined ||
      rawWeight === 0 ||
      traysCapacity === undefined ||
      traysCapacity === 0
    ) {
      return undefined;
    }

    // Formula: Totale qty per ricetta / (Peso biscotto crudo * Capienza teglie)
    const denominator = rawWeight * traysCapacity;
    if (denominator === 0) return undefined;

    const value = totalQty / denominator;
    if (!Number.isFinite(value) || value <= 0) return undefined;

    // Round to nearest integer
    return Math.round(value);
  }, [
    totalQtyForRecipe,
    cookieWeightRawGAuto,
    processData.cookieWeightRawG,
    processData.traysCapacityKg,
  ]);

  // Calculate number of trays per depositor: depositorCapacityKg / (traysCapacityKg * cookieWeightRawG)
  const traysPerDepositorsAuto = useMemo(() => {
    const depositorCapacity = processData.depositorCapacityKg ?? undefined; // in kg
    const traysCapacity = processData.traysCapacityKg ?? undefined; // number
    const rawWeight =
      cookieWeightRawGAuto ?? processData.cookieWeightRawG ?? undefined; // in grams

    // If any value is missing or zero, cannot calculate
    if (
      depositorCapacity === undefined ||
      depositorCapacity === 0 ||
      traysCapacity === undefined ||
      traysCapacity === 0 ||
      rawWeight === undefined ||
      rawWeight === 0
    ) {
      return undefined;
    }

    // Formula: Capienza colatrice / (Capienza teglie * Peso biscotto crudo)
    // Note: depositorCapacity is in kg, rawWeight is in grams, so we need to convert
    const depositorCapacityG = depositorCapacity * 1000; // convert kg to grams
    const denominator = traysCapacity * rawWeight;
    if (denominator === 0) return undefined;

    const value = depositorCapacityG / denominator;
    if (!Number.isFinite(value) || value <= 0) return undefined;

    // Round to nearest integer
    return Math.round(value);
  }, [
    processData.depositorCapacityKg,
    processData.traysCapacityKg,
    cookieWeightRawGAuto,
    processData.cookieWeightRawG,
  ]);

  // Calculate tray weight (raw): cookieWeightRawG * traysCapacityKg
  const trayWeightRawGAuto = useMemo(() => {
    const rawWeight =
      cookieWeightRawGAuto ?? processData.cookieWeightRawG ?? undefined; // in grams
    const traysCapacity = processData.traysCapacityKg ?? undefined; // number

    // If any value is missing or zero, cannot calculate
    if (
      rawWeight === undefined ||
      rawWeight === 0 ||
      traysCapacity === undefined ||
      traysCapacity === 0
    ) {
      return undefined;
    }

    // Formula: Peso biscotto crudo × Capienza teglie
    const value = rawWeight * traysCapacity;
    if (!Number.isFinite(value) || value <= 0) return undefined;

    // Round to 2 decimal places
    return Number(value.toFixed(2));
  }, [
    cookieWeightRawGAuto,
    processData.cookieWeightRawG,
    processData.traysCapacityKg,
  ]);

  // Calculate tray weight (cooked): cookieWeightCookedG * traysCapacityKg
  const trayWeightCookedGAuto = useMemo(() => {
    const cookedWeight = processData.cookieWeightCookedG ?? undefined; // in grams
    const traysCapacity = processData.traysCapacityKg ?? undefined; // number

    // If any value is missing or zero, cannot calculate
    if (
      cookedWeight === undefined ||
      cookedWeight === 0 ||
      traysCapacity === undefined ||
      traysCapacity === 0
    ) {
      return undefined;
    }

    // Formula: Peso biscotto cotto × Capienza teglie
    const value = cookedWeight * traysCapacity;
    if (!Number.isFinite(value) || value <= 0) return undefined;

    // Round to 2 decimal places
    return Number(value.toFixed(2));
  }, [processData.cookieWeightCookedG, processData.traysCapacityKg]);

  // Calculate number of boxes: numberOfPackages / boxCapacity
  const numberOfBoxesAuto = useMemo(() => {
    const numberOfPackages = recipeData.numberOfPackages ?? 0;
    const boxCapacity = processData.boxCapacity ?? 0;

    // If any value is missing or zero, cannot calculate
    if (numberOfPackages === 0 || boxCapacity === 0) {
      return undefined;
    }

    // Formula: Numero pacchetti / Capienza scatole
    const value = numberOfPackages / boxCapacity;
    if (!Number.isFinite(value) || value <= 0) return undefined;

    // Round to nearest integer
    return Math.round(value);
  }, [recipeData.numberOfPackages, processData.boxCapacity]);

  // Calculate number of carts: traysCount / cartCapacity
  const numberOfCartsAuto = useMemo(() => {
    const trays = traysCountAuto ?? processData.traysCount ?? 0;
    const cartCapacity = processData.cartCapacity ?? 0;

    // If any value is missing or zero, cannot calculate
    if (trays === 0 || cartCapacity === 0) {
      return undefined;
    }

    // Formula: Numero teglie / Capienza carrelli
    const value = trays / cartCapacity;
    if (!Number.isFinite(value) || value <= 0) return undefined;

    // Round to nearest integer
    return Math.round(value);
  }, [traysCountAuto, processData.traysCount, processData.cartCapacity]);

  const setProcess = useCallback(
    (key: keyof typeof processData, value: string | number | undefined) => {
      setProcessData((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // Calculate visibility permissions before early returns (these don't depend on initialRecipe)
  const canViewHeader = canViewField(HEADER_CAPABILITY);
  const basicFieldIds = Object.values(BASIC_CAPABILITIES);
  const processFieldIds = Object.values(PROCESS_CAPABILITIES);
  const canViewBasic = basicFieldIds.some(canViewField);
  const canEditBasic = basicFieldIds.some(canEditField);
  const canViewCalculated = canViewField(CALCULATED_CAPABILITY);
  const canViewProcess = processFieldIds.some(canViewField);
  const canEditProcess = processFieldIds.some(canEditField);
  const canViewIngredientsTable = canViewField(INGREDIENT_CAPABILITIES.table);
  const canEditIngredientFields = canEditField(INGREDIENT_CAPABILITIES.editing);
  const canViewNotes = canViewField(NOTES_CAPABILITY);
  const canEditNotes = canEditField(NOTES_CAPABILITY);
  const canViewNutrition = canViewField(NUTRITION_PANEL_CAPABILITY);
  const canEditNutrition = canEditField(NUTRITION_PANEL_CAPABILITY);
  const canViewActions = canViewField(SAVE_CAPABILITY);
  const canEditActions = canEditField(SAVE_CAPABILITY);
  const canViewHistory = canViewField(HISTORY_CAPABILITY);
  const canViewNutritionToggle = canViewField(NUTRITION_TOGGLE_CAPABILITY);
  const canViewAutomatch = canViewField(INGREDIENT_CAPABILITIES.automatch);

  // Specific capabilities for intermediate nodes
  const canViewPlanning = canViewField('recipe.process.planning');
  const canEditPlanning = canEditField('recipe.process.planning');
  const canViewEquipment = canViewField('recipe.process.equipment');
  const canEditEquipment = canEditField('recipe.process.equipment');
  const canViewQuality = canViewField('recipe.process.quality');
  const canEditQuality = canEditField('recipe.process.quality');
  const canViewCookies = canViewField('recipe.process.cookies');
  const canEditCookies = canEditField('recipe.process.cookies');
  const canViewColatrice = canViewField('recipe.colatrice');
  const canEditColatrice = canEditField('recipe.colatrice');
  const canViewProcesses = canViewField('recipe.processes.view');

  const showProcessSection = canViewBasic || canViewProcess;
  const showEditSection = canViewIngredientsTable || canViewNotes;

  // Track initial recipe costs when loaded
  useEffect(() => {
    if (recipeCosts.length > 0 && initialRecipeCosts.length === 0) {
      setInitialRecipeCosts([...recipeCosts]);
    }
  }, [recipeCosts, initialRecipeCosts.length]);

  // Track process changes to force hasUnsavedChanges re-evaluation
  const [_processChangeTrigger, setProcessChangeTrigger] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleProcessesChanged = () => {
      setProcessChangeTrigger((prev) => prev + 1);
    };
    window.addEventListener('processesChanged', handleProcessesChanged);
    return () => {
      window.removeEventListener('processesChanged', handleProcessesChanged);
    };
  }, []);

  // Function to check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    // Check recipe data
    if (initialRecipeData) {
      const recipeKeys: (keyof NewRecipeProps)[] = [
        'name',
        'notes',
        'packageWeight',
        'numberOfPackages',
        'wastePercent',
        'waterPercent',
        'timeMinutes',
        'temperatureCelsius',
        'heightCm',
        'widthCm',
        'lengthCm',
        'totalQtyForRecipe',
        'cookieWeightCookedG',
        'mixerCapacityKg',
        'traysCapacityKg',
        'depositorCapacityKg',
        'traysPerOvenLoad',
      ];
      for (const key of recipeKeys) {
        if (recipeData[key] !== initialRecipeData[key]) {
          return true;
        }
      }
    }

    // Check process data
    if (initialProcessData) {
      const processKeys: (keyof typeof processData)[] = [
        'cookiesCount',
        'cookieWeightRawG',
        'cookieWeightCookedG',
        'trayWeightRawG',
        'trayWeightCookedG',
        'mixerCapacityKg',
        'doughBatchesCount',
        'depositorCapacityKg',
        'depositorsCount',
        'traysCapacityKg',
        'traysCount',
        'traysPerBatch',
        'traysPerDepositors',
        'traysPerOvenLoad',
        'ovenLoadsCount',
        'boxCapacity',
        'cartCapacity',
        'glutenTestDone',
        'steamMinutes',
        'valveOpenMinutes',
        'valveCloseMinutes',
        'lot',
      ];
      for (const key of processKeys) {
        if (processData[key] !== initialProcessData[key]) {
          return true;
        }
      }
    }

    // Check oven temperatures
    if (
      JSON.stringify(ovenTemperatures) !==
      JSON.stringify(initialOvenTemperatures)
    ) {
      return true;
    }

    // Check mixing times
    if (JSON.stringify(mixingTimes) !== JSON.stringify(initialMixingTimes)) {
      return true;
    }

    // Check colatrice settings
    if (
      JSON.stringify(colatriceSettings) !==
      JSON.stringify(initialColatriceSettings)
    ) {
      return true;
    }

    // Check ingredients
    if (initialIngredientData) {
      // Check SKUs
      if (JSON.stringify(skus.sort()) !== JSON.stringify(initialSkus.sort())) {
        return true;
      }

      // Check ingredient fields
      for (const sku of skus) {
        if (
          ingredientName.get(sku) !== initialIngredientData.names.get(sku) ||
          qtyOriginal.get(sku) !== initialIngredientData.qtyOriginal.get(sku) ||
          powderIngredients.get(sku) !==
            initialIngredientData.powderIngredients.get(sku) ||
          supplier.get(sku) !== initialIngredientData.supplier.get(sku) ||
          warehouseLocation.get(sku) !==
            initialIngredientData.warehouseLocation.get(sku) ||
          mpSku.get(sku) !== initialIngredientData.mpSku.get(sku) ||
          productName.get(sku) !== initialIngredientData.productName.get(sku) ||
          ingredientLot.get(sku) !== initialIngredientData.lot.get(sku) ||
          done.get(sku) !== initialIngredientData.done.get(sku) ||
          checkGlutine.get(sku) !== initialIngredientData.checkGlutine.get(sku)
        ) {
          return true;
        }
      }

      // Check for removed ingredients
      for (const sku of initialSkus) {
        if (!skus.includes(sku)) {
          return true;
        }
      }
    }

    // Check recipe costs
    if (initialRecipeCosts.length > 0 && recipeCosts.length > 0) {
      if (JSON.stringify(recipeCosts) !== JSON.stringify(initialRecipeCosts)) {
        return true;
      }
    }

    // Check recipe processes - force re-evaluation by accessing window function (only on client side)
    if (typeof window !== 'undefined') {
      const hasUnsavedProcessChangesFn = (
        window as unknown as {
          hasUnsavedProcessChanges?: () => boolean;
        }
      ).hasUnsavedProcessChanges;
      if (typeof hasUnsavedProcessChangesFn === 'function') {
        try {
          if (hasUnsavedProcessChangesFn()) {
            return true;
          }
        } catch (e) {
          // Function might not be ready yet
          console.warn('hasUnsavedProcessChanges error:', e);
        }
      }

      // Check if margin has changed
      const currentMargin =
        (window as unknown as { recipeMargin?: string }).recipeMargin || '';
      const initialMargin =
        (window as unknown as { initialRecipeMargin?: string })
          .initialRecipeMargin || '';
      if (currentMargin !== initialMargin) {
        return true;
      }
    }

    return false;
  }, [
    initialRecipeData,
    recipeData,
    initialProcessData,
    processData,
    ovenTemperatures,
    initialOvenTemperatures,
    mixingTimes,
    initialMixingTimes,
    initialIngredientData,
    skus,
    initialSkus,
    ingredientName,
    qtyOriginal,
    powderIngredients,
    supplier,
    warehouseLocation,
    mpSku,
    productName,
    ingredientLot,
    done,
    checkGlutine,
    recipeCosts,
    initialRecipeCosts,
    colatriceSettings,
    initialColatriceSettings,
  ]);

  // Debug logging removed

  if (invalidId) return null;
  if (loading)
    return (
      <div className="p-6 text-zinc-600 dark:text-gray-200">Loading...</div>
    );
  if (error)
    return (
      <div className="p-6 text-red-400">Error loading recipe: {error}</div>
    );
  if (!initialRecipe) return null;

  return (
    <div className="scrollbar-elegant mx-auto flex h-full flex-col gap-4 overflow-y-auto bg-gray-50 p-6 dark:bg-[#050505]">
      {canViewHeader ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <span className="text-xs tracking-[0.2em] text-blue-600 uppercase dark:text-blue-300">
                Recipe #{recipeData.id}
              </span>
              <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white">
                {recipeData.name || 'Untitled recipe'}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-gray-400">
                <span>
                  Updated:{' '}
                  {recipeData.updatedAt
                    ? new Date(recipeData.updatedAt).toLocaleString('it-IT')
                    : '—'}
                </span>
                <span>
                  Created:{' '}
                  {recipeData.createdAt
                    ? new Date(recipeData.createdAt).toLocaleString('it-IT')
                    : '—'}
                </span>
              </div>
            </div>
            {!activeProduction && (
              <Button
                variant="primary"
                onClick={() => setShowProductionModal(true)}
                className="shrink-0"
              >
                Inizia Produzione
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {/* Production Banner */}
      {activeProduction && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-600 dark:bg-blue-900/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-block rounded-full bg-blue-600 px-2 py-1 text-xs font-semibold text-white">
                  PRODUZIONE ATTIVA
                </span>
                {activeProduction.recipeVersionId && (
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    Versione: {activeProduction.recipeVersionId}
                  </span>
                )}
              </div>
              <div className="space-y-1 text-sm text-zinc-700 dark:text-gray-200">
                <div>
                  <span className="font-medium">Lotto:</span>{' '}
                  {activeProduction.productionLot}
                </div>
                <div>
                  <span className="font-medium">Iniziata il:</span>{' '}
                  {new Date(activeProduction.startedAt).toLocaleString('it-IT')}
                </div>
                {activeProduction.notes && (
                  <div>
                    <span className="font-medium">Note:</span>{' '}
                    {activeProduction.notes}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => setShowProductionModal(true)}
                className="shrink-0"
              >
                Termina Produzione
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Production Modal */}
      <ProductionModal
        recipeId={idNum}
        isOpen={showProductionModal}
        onClose={() => setShowProductionModal(false)}
        onProductionStarted={(production) => {
          setActiveProduction(production);
          setShowProductionModal(false);
        }}
        onProductionFinished={() => {
          setActiveProduction(null);
          setShowProductionModal(false);
        }}
        activeProduction={activeProduction}
      />

      {/* Version Selector */}
      <div className="mb-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <RecipeVersionSelector
          recipeId={idNum}
          currentVersion={selectedVersionId}
          onVersionSelect={async (versionId) => {
            if (versionId === null) {
              setSelectedVersionId(null);
              setSelectedVersionData(null);
              return;
            }

            setLoadingVersion(true);
            try {
              const response = (await apiClient.get(
                `/api/recipes/${idNum}/versions/${versionId}`,
              )) as {
                ok?: boolean;
                recipe?: MagentoRecipe;
                ingredients?: MagentoRecipeIngredient[];
                error?: string;
              };

              if (response?.ok && response.recipe && response.ingredients) {
                setSelectedVersionId(versionId);
                setSelectedVersionData({
                  recipe: response.recipe,
                  ingredients: response.ingredients,
                });
              } else {
                throw new Error(response?.error || 'Failed to load version');
              }
            } catch (error) {
              console.error('Failed to load version:', error);
              setToast(
                error instanceof Error
                  ? error.message
                  : 'Errore durante il caricamento della versione',
                { type: 'error' },
              );
            } finally {
              setLoadingVersion(false);
            }
          }}
        />
        {selectedVersionId && (
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedVersionId(null);
              setSelectedVersionData(null);
            }}
          >
            Torna alla versione corrente
          </Button>
        )}
      </div>

      {showEditSection ? (
        <CollapsibleSection title="Edit recipe" defaultCollapsed>
          <div className="space-y-6">
            {canViewIngredientsTable ? (
              <Section
                title="Ingredients"
                {...(canViewAutomatch && {
                  action: (
                    <Button onClick={handleAutoMatch} variant="secondary">
                      Auto match
                    </Button>
                  ),
                })}
              >
                <fieldset
                  disabled={!canEditIngredientFields}
                  aria-disabled={!canEditIngredientFields}
                  className={`space-y-4 ${!canEditIngredientFields ? 'opacity-75' : ''}`}
                >
                  <div className="mb-6 hidden items-center justify-between gap-4 md:flex">
                    <div className="flex items-center gap-4">
                      {canViewNutritionToggle ? (
                        <Button onClick={toggleShowNutritionData}>
                          {showNutritionData
                            ? 'Hide nutrition data'
                            : 'Show nutrition data'}
                        </Button>
                      ) : null}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setShowColumnManager(!showColumnManager)}
                    >
                      {showColumnManager ? 'Nascondi' : 'Gestisci'} colonne
                    </Button>
                  </div>
                  {showColumnManager && (
                    <div className="mb-4">
                      <IngredientTableColumnManager
                        onClose={() => setShowColumnManager(false)}
                        allowedColumns={allowedIngredientColumnIds}
                      />
                    </div>
                  )}
                  {/* Desktop table */}
                  <div className="hidden rounded-lg border border-zinc-200 md:block dark:border-gray-800">
                    <table className="min-w-full table-fixed text-left text-sm">
                      <thead className="bg-zinc-100 text-zinc-700 dark:bg-gray-800 dark:text-gray-300">
                        <tr>
                          {canViewIngredientColumn('name') && (
                            <th
                              className="sticky left-0 z-10 px-3 py-2"
                              style={{ width: getColumnWidth('name') }}
                            >
                              Ingrediente
                            </th>
                          )}
                          {canViewIngredientColumn('sku') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('sku') }}
                            >
                              SKU
                            </th>
                          )}
                          {canViewIngredientColumn('qtyForRecipe') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('qtyForRecipe') }}
                            >
                              Qty ricetta (g)
                            </th>
                          )}
                          {canViewIngredientColumn('qtyOriginal') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('qtyOriginal') }}
                            >
                              Qty base (g)
                            </th>
                          )}
                          {canViewIngredientColumn('percentOnTotal') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{
                                width: getColumnWidth('percentOnTotal'),
                              }}
                            >
                              % on total
                            </th>
                          )}
                          {canViewIngredientColumn('percentOfPowder') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{
                                width: getColumnWidth('percentOfPowder'),
                              }}
                            >
                              % of powder
                            </th>
                          )}
                          {canViewIngredientColumn('pricePerKg') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('pricePerKg') }}
                            >
                              € / kg
                            </th>
                          )}
                          {canViewIngredientColumn('pricePerRecipe') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{
                                width: getColumnWidth('pricePerRecipe'),
                              }}
                            >
                              € / recipe
                            </th>
                          )}
                          {canViewIngredientColumn('isPowder') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('isPowder') }}
                            >
                              is powder
                            </th>
                          )}
                          {canViewIngredientColumn('productName') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('productName') }}
                            >
                              Materia Prima
                            </th>
                          )}
                          {canViewIngredientColumn('supplier') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('supplier') }}
                            >
                              Fornitore
                            </th>
                          )}
                          {canViewIngredientColumn('warehouseLocation') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{
                                width: getColumnWidth('warehouseLocation'),
                              }}
                            >
                              Locazione
                            </th>
                          )}
                          {canViewIngredientColumn('mpSku') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('mpSku') }}
                            >
                              Mp_Sku
                            </th>
                          )}
                          {canViewIngredientColumn('lot') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('lot') }}
                            >
                              Lotto
                            </th>
                          )}
                          {canViewIngredientColumn('done') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('done') }}
                            >
                              Fatto
                            </th>
                          )}
                          {canViewIngredientColumn('checkGlutine') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('checkGlutine') }}
                            >
                              CheckGlutine
                            </th>
                          )}
                          {canViewIngredientColumn('action') && (
                            <th
                              className="px-3 py-2 text-center"
                              style={{ width: getColumnWidth('action') }}
                            >
                              Action
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {skus.map((sku, index) => {
                          const nutrition = nutritionData.get(sku);
                          const isHovered = hoveredSku === sku;
                          const prevIngredient =
                            selectedVersionIngredientMap.get(sku);
                          const currentName = ingredientName.get(sku) || '';
                          return (
                            <React.Fragment key={sku}>
                              <tr
                                className={`${index % 2 === 0 ? 'bg-zinc-50 dark:bg-gray-950/40' : ''} ${isHovered ? '!bg-blue-100 dark:!bg-blue-900/30' : ''}`}
                                onMouseEnter={() => setHoveredSku(sku)}
                                onMouseLeave={() => setHoveredSku(null)}
                              >
                                {canViewIngredientColumn('name') && (
                                  <td
                                    className="sticky left-0 z-10 px-3 py-2 pt-4"
                                    style={{ width: getColumnWidth('name') }}
                                  >
                                    <div className="flex flex-col gap-1">
                                      <input
                                        type="text"
                                        value={currentName}
                                        onChange={(e) =>
                                          handleIngredientNameChange(
                                            sku,
                                            e.target.value,
                                          )
                                        }
                                        className={`w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${
                                          valuesDiffer(
                                            prevIngredient?.name,
                                            currentName,
                                          )
                                            ? 'border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-amber-400 dark:focus:ring-amber-300'
                                            : ''
                                        }`}
                                      />
                                      {renderInlineDiffHint(
                                        prevIngredient?.name,
                                        currentName,
                                      )}
                                    </div>
                                  </td>
                                )}
                                {canViewIngredientColumn('sku') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{ width: getColumnWidth('sku') }}
                                  >
                                    <input
                                      type="text"
                                      value={sku}
                                      disabled
                                      className="w-full cursor-pointer rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                    />
                                  </td>
                                )}

                                {canViewIngredientColumn('qtyForRecipe') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width: getColumnWidth('qtyForRecipe'),
                                    }}
                                  >
                                    <span>
                                      {(qtyForRecipe.get(sku) || 0)?.toFixed(2)}
                                    </span>
                                  </td>
                                )}

                                {canViewIngredientColumn('qtyOriginal') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width: getColumnWidth('qtyOriginal'),
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <input
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        value={qtyOriginal.get(sku) ?? ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === '') {
                                            setQtyOriginal((prev) => {
                                              const m = new Map(prev);
                                              m.delete(sku);
                                              return m;
                                            });
                                            return;
                                          }
                                          const numVal = parseFloat(val);
                                          if (!isNaN(numVal)) {
                                            setQtyOriginal((prev) => {
                                              const m = new Map(prev);
                                              m.set(sku, numVal);
                                              return m;
                                            });
                                          }
                                        }}
                                        className={`mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${
                                          valuesDiffer(
                                            prevIngredient?.qtyOriginal,
                                            qtyOriginal.get(sku),
                                          )
                                            ? 'border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-amber-400 dark:focus:ring-amber-300'
                                            : ''
                                        }`}
                                      />
                                      {renderInlineDiffHint(
                                        prevIngredient?.qtyOriginal,
                                        qtyOriginal.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn('percentOnTotal') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width: getColumnWidth('percentOnTotal'),
                                    }}
                                  >
                                    <span>
                                      {percentOnTotalQtyOriginal.get(sku) || 0}{' '}
                                      %
                                    </span>
                                  </td>
                                )}

                                {canViewIngredientColumn('percentOfPowder') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width: getColumnWidth('percentOfPowder'),
                                    }}
                                  >
                                    <span>
                                      {(percentOfPowder.get(sku) || 0).toFixed(
                                        2,
                                      )}{' '}
                                      %
                                    </span>
                                  </td>
                                )}

                                {canViewIngredientColumn('pricePerKg') && (
                                  <td
                                    className={`px-3 py-2 pt-4 text-center ${
                                      priceCostPerKgError.get(sku)
                                        ? 'bg-red-100 dark:bg-red-900/50'
                                        : ''
                                    }`}
                                    style={{
                                      width: getColumnWidth('pricePerKg'),
                                    }}
                                  >
                                    <span
                                      className={`${
                                        priceCostPerKgError.get(sku)
                                          ? 'font-semibold text-red-600 dark:text-red-200'
                                          : 'text-zinc-700 dark:text-gray-200'
                                      }`}
                                    >
                                      {(
                                        priceCostPerKgAuto.get(sku) || 0
                                      ).toFixed(2)}{' '}
                                      €
                                    </span>
                                  </td>
                                )}

                                {canViewIngredientColumn('pricePerRecipe') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width: getColumnWidth('pricePerRecipe'),
                                    }}
                                  >
                                    <span>
                                      {(
                                        priceCostBasedOnQtyForRecipe.get(sku) ||
                                        0
                                      ).toFixed(2)}
                                    </span>
                                  </td>
                                )}

                                {canViewIngredientColumn('isPowder') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width: getColumnWidth('isPowder'),
                                    }}
                                  >
                                    <div className="flex flex-col items-center">
                                      <Checkbox
                                        checked={!!powderIngredients.get(sku)}
                                        onChange={(e) =>
                                          handlePowerIngredientsChange(
                                            sku,
                                            e.target.checked,
                                          )
                                        }
                                      />
                                      {renderInlineDiffHint(
                                        !!prevIngredient?.isPowderIngredient,
                                        !!powderIngredients.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn('productName') && (
                                  <td
                                    className="px-3 py-2 pt-4"
                                    style={{
                                      width: getColumnWidth('productName'),
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <IngredientProductSearch
                                        value={productName.get(sku) || ''}
                                        onSelect={(product) =>
                                          handleProductSelect(sku, product)
                                        }
                                        disabled={!canEditIngredientFields}
                                        placeholder="Cerca prodotto..."
                                      />
                                      {renderInlineDiffHint(
                                        prevIngredient?.productName,
                                        productName.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn('supplier') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width: getColumnWidth('supplier'),
                                    }}
                                  >
                                    <div className="flex flex-col">
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
                                        disabled={!canEditIngredientFields}
                                        className={`w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${
                                          valuesDiffer(
                                            prevIngredient?.supplier,
                                            supplier.get(sku),
                                          )
                                            ? 'border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-amber-400 dark:focus:ring-amber-300'
                                            : ''
                                        }`}
                                      />
                                      {renderInlineDiffHint(
                                        prevIngredient?.supplier,
                                        supplier.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn(
                                  'warehouseLocation',
                                ) && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width:
                                        getColumnWidth('warehouseLocation'),
                                    }}
                                  >
                                    <div className="flex flex-col">
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
                                        disabled={!canEditIngredientFields}
                                        className={`w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${
                                          valuesDiffer(
                                            prevIngredient?.warehouseLocation,
                                            warehouseLocation.get(sku),
                                          )
                                            ? 'border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-amber-400 dark:focus:ring-amber-300'
                                            : ''
                                        }`}
                                      />
                                      {renderInlineDiffHint(
                                        prevIngredient?.warehouseLocation,
                                        warehouseLocation.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn('mpSku') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{ width: getColumnWidth('mpSku') }}
                                  >
                                    <div className="flex flex-col">
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
                                        disabled={!canEditIngredientFields}
                                        className={`w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${
                                          valuesDiffer(
                                            prevIngredient?.mpSku,
                                            mpSku.get(sku),
                                          )
                                            ? 'border-amber-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-amber-400 dark:focus:ring-amber-300'
                                            : ''
                                        }`}
                                      />
                                      {renderInlineDiffHint(
                                        prevIngredient?.mpSku,
                                        mpSku.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn('lot') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{ width: getColumnWidth('lot') }}
                                  >
                                    <div className="flex flex-col">
                                      <LotAutocompleteInput
                                        sku={sku}
                                        value={ingredientLot.get(sku) || ''}
                                        onChange={(lot) =>
                                          setIngredientLot((prev) => {
                                            const m = new Map(prev);
                                            m.set(sku, lot);
                                            return m;
                                          })
                                        }
                                        disabled={!canEditIngredientFields}
                                        placeholder="Lotto..."
                                      />
                                      {renderInlineDiffHint(
                                        prevIngredient?.lot,
                                        ingredientLot.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn('done') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{ width: getColumnWidth('done') }}
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <Checkbox
                                        checked={!!done.get(sku)}
                                        onChange={(e) =>
                                          setDone((prev) => {
                                            const m = new Map(prev);
                                            m.set(sku, e.target.checked);
                                            return m;
                                          })
                                        }
                                        disabled={!canEditIngredientFields}
                                        className="disabled:cursor-not-allowed disabled:opacity-50"
                                        boxClassName="h-5 w-5"
                                        activeClassName="border-emerald-600 bg-emerald-600"
                                        inactiveClassName="border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-800"
                                        containerClassName="p-1"
                                      />
                                      {renderInlineDiffHint(
                                        !!prevIngredient?.done,
                                        !!done.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn('checkGlutine') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{
                                      width: getColumnWidth('checkGlutine'),
                                    }}
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <Checkbox
                                        checked={!!checkGlutine.get(sku)}
                                        onChange={(e) =>
                                          setCheckGlutine((prev) => {
                                            const m = new Map(prev);
                                            m.set(sku, e.target.checked);
                                            return m;
                                          })
                                        }
                                        disabled={!canEditIngredientFields}
                                        className="disabled:cursor-not-allowed disabled:opacity-50"
                                        boxClassName="h-5 w-5"
                                        activeClassName="border-emerald-600 bg-emerald-600"
                                        inactiveClassName="border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-800"
                                        containerClassName="p-1"
                                      />
                                      {renderInlineDiffHint(
                                        !!prevIngredient?.checkGlutine,
                                        !!checkGlutine.get(sku),
                                      )}
                                    </div>
                                  </td>
                                )}

                                {canViewIngredientColumn('action') && (
                                  <td
                                    className="px-3 py-2 pt-4 text-center"
                                    style={{ width: getColumnWidth('action') }}
                                  >
                                    <div className="flex flex-col items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setNutritionModalSku(sku)
                                        }
                                        title="Update Magento nutrition values"
                                        className="w-full rounded-full border border-blue-500/60 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-100 dark:hover:border-blue-400 dark:hover:bg-transparent dark:hover:text-white"
                                      >
                                        Update ingredient
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleRemoveIngredient(sku)
                                        }
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
                                    </div>
                                  </td>
                                )}
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
                      {skus.map((sku, _index) => {
                        const nutrition = nutritionData.get(sku);
                        return (
                          <div
                            key={sku}
                            className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <input
                                type="text"
                                value={ingredientName.get(sku) || ''}
                                onChange={(e) =>
                                  handleIngredientNameChange(
                                    sku,
                                    e.target.value,
                                  )
                                }
                                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
                              <button
                                type="button"
                                onClick={() => setNutritionModalSku(sku)}
                                title="Update Magento nutrition values"
                                className="ml-2 shrink-0 rounded-full border border-blue-500/60 px-3 py-1 text-xs font-semibold text-blue-100"
                              >
                                Update ingredient
                              </button>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {canViewIngredientColumn('sku') && (
                                <div className="col-span-2 text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mobile-sku-${sku}`}>
                                    SKU
                                  </label>
                                  <input
                                    id={`mobile-sku-${sku}`}
                                    type="text"
                                    value={sku}
                                    disabled
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('qtyForRecipe') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mobile-qty-recipe-${sku}`}>
                                    Qty for recipe (g)
                                  </label>
                                  <input
                                    id={`mobile-qty-recipe-${sku}`}
                                    type="text"
                                    value={(qtyForRecipe.get(sku) || 0).toFixed(
                                      2,
                                    )}
                                    disabled
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('qtyOriginal') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mobile-qty-original-${sku}`}>
                                    Original qty (g)
                                  </label>
                                  <input
                                    id={`mobile-qty-original-${sku}`}
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={qtyOriginal.get(sku) ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === '') {
                                        setQtyOriginal((prev) => {
                                          const m = new Map(prev);
                                          m.delete(sku);
                                          return m;
                                        });
                                        return;
                                      }
                                      const numVal = parseFloat(val);
                                      if (!isNaN(numVal)) {
                                        setQtyOriginal((prev) => {
                                          const m = new Map(prev);
                                          m.set(sku, numVal);
                                          return m;
                                        });
                                      }
                                    }}
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('percentOnTotal') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label
                                    htmlFor={`mobile-percent-total-${sku}`}
                                  >
                                    % on total
                                  </label>
                                  <input
                                    id={`mobile-percent-total-${sku}`}
                                    type="text"
                                    value={
                                      (
                                        percentOnTotalQtyOriginal.get(sku) || 0
                                      ).toString() + ' %'
                                    }
                                    disabled
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('percentOfPowder') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label
                                    htmlFor={`mobile-percent-powder-${sku}`}
                                  >
                                    % of powder
                                  </label>
                                  <input
                                    id={`mobile-percent-powder-${sku}`}
                                    type="text"
                                    value={`${(percentOfPowder.get(sku) || 0).toFixed(2)} %`}
                                    disabled
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('pricePerKg') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mobile-price-kg-${sku}`}>
                                    € / kg
                                  </label>
                                  <input
                                    id={`mobile-price-kg-${sku}`}
                                    type="text"
                                    value={(
                                      priceCostPerKgAuto.get(sku) || 0
                                    ).toFixed(2)}
                                    disabled
                                    className={`mt-1 w-full rounded-md border px-2 py-1 ${
                                      priceCostPerKgError.get(sku)
                                        ? 'border-red-600 bg-red-100 font-semibold text-red-600 dark:bg-red-900/50 dark:text-red-200'
                                        : 'border-zinc-300 bg-white text-zinc-900 opacity-75 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                                    }`}
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('pricePerRecipe') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mobile-price-recipe-${sku}`}>
                                    € / recipe
                                  </label>
                                  <input
                                    id={`mobile-price-recipe-${sku}`}
                                    type="text"
                                    value={(
                                      priceCostBasedOnQtyForRecipe.get(sku) || 0
                                    ).toFixed(2)}
                                    disabled
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('isPowder') && (
                                <label
                                  htmlFor={`powder-ingredient-${sku}`}
                                  className="col-span-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-gray-300"
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
                              )}

                              {canViewIngredientColumn('productName') && (
                                <div className="col-span-2 text-xs text-zinc-600 dark:text-gray-300">
                                  <span>Materia Prima</span>
                                  <IngredientProductSearch
                                    value={productName.get(sku) || ''}
                                    onSelect={(product) =>
                                      handleProductSelect(sku, product)
                                    }
                                    disabled={!canEditIngredientFields}
                                    placeholder="Cerca prodotto..."
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('supplier') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mobile-supplier-${sku}`}>
                                    Fornitore
                                  </label>
                                  <input
                                    id={`mobile-supplier-${sku}`}
                                    type="text"
                                    value={supplier.get(sku) || ''}
                                    onChange={(e) =>
                                      setSupplier((prev) => {
                                        const m = new Map(prev);
                                        m.set(sku, e.target.value);
                                        return m;
                                      })
                                    }
                                    disabled={!canEditIngredientFields}
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('warehouseLocation') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mobile-warehouse-${sku}`}>
                                    Warehouse location
                                  </label>
                                  <input
                                    id={`mobile-warehouse-${sku}`}
                                    type="text"
                                    value={warehouseLocation.get(sku) || ''}
                                    onChange={(e) =>
                                      setWarehouseLocation((prev) => {
                                        const m = new Map(prev);
                                        m.set(sku, e.target.value);
                                        return m;
                                      })
                                    }
                                    disabled={!canEditIngredientFields}
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('mpSku') && (
                                <div className="text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mp-sku-${sku}`}>
                                    Mp_Sku
                                  </label>
                                  <input
                                    id={`mp-sku-${sku}`}
                                    type="text"
                                    value={mpSku.get(sku) || ''}
                                    onChange={(e) =>
                                      setMpSku((prev) => {
                                        const m = new Map(prev);
                                        m.set(sku, e.target.value);
                                        return m;
                                      })
                                    }
                                    disabled={!canEditIngredientFields}
                                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('lot') && (
                                <div className="col-span-2 text-xs text-zinc-600 dark:text-gray-300">
                                  <label htmlFor={`mobile-lot-${sku}`}>
                                    Lotto
                                  </label>
                                  <LotAutocompleteInput
                                    sku={sku}
                                    value={ingredientLot.get(sku) || ''}
                                    onChange={(lot) =>
                                      setIngredientLot((prev) => {
                                        const m = new Map(prev);
                                        m.set(sku, lot);
                                        return m;
                                      })
                                    }
                                    disabled={!canEditIngredientFields}
                                    placeholder="Lotto..."
                                  />
                                </div>
                              )}

                              {canViewIngredientColumn('done') && (
                                <label
                                  htmlFor={`mobile-done-${sku}`}
                                  className="col-span-2 flex items-center gap-3 text-sm font-medium text-zinc-700 dark:text-gray-200"
                                >
                                  <Checkbox
                                    checked={!!done.get(sku)}
                                    onChange={(e) =>
                                      setDone((prev) => {
                                        const m = new Map(prev);
                                        m.set(sku, e.target.checked);
                                        return m;
                                      })
                                    }
                                    disabled={!canEditIngredientFields}
                                    id={`mobile-done-${sku}`}
                                    className="disabled:cursor-not-allowed disabled:opacity-50"
                                    boxClassName="h-5 w-5"
                                    activeClassName="border-emerald-600 bg-emerald-600"
                                    inactiveClassName="border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-800"
                                    containerClassName="p-1"
                                  />
                                  <span>Done</span>
                                </label>
                              )}

                              {canViewIngredientColumn('checkGlutine') && (
                                <label
                                  htmlFor={`mobile-check-glutine-${sku}`}
                                  className="col-span-2 flex items-center gap-3 text-sm font-medium text-zinc-700 dark:text-gray-200"
                                >
                                  <Checkbox
                                    checked={!!checkGlutine.get(sku)}
                                    onChange={(e) =>
                                      setCheckGlutine((prev) => {
                                        const m = new Map(prev);
                                        m.set(sku, e.target.checked);
                                        return m;
                                      })
                                    }
                                    disabled={!canEditIngredientFields}
                                    id={`mobile-check-glutine-${sku}`}
                                    className="disabled:cursor-not-allowed disabled:opacity-50"
                                    boxClassName="h-5 w-5"
                                    activeClassName="border-emerald-600 bg-emerald-600"
                                    inactiveClassName="border-zinc-400 bg-white dark:border-zinc-500 dark:bg-zinc-800"
                                    containerClassName="p-1"
                                  />
                                  <span>Check Glutine</span>
                                </label>
                              )}

                              {canViewIngredientColumn('action') && (
                                <div className="col-span-2 flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setNutritionModalSku(sku)}
                                    title="Update Magento nutrition values"
                                    className="w-full rounded-full border border-blue-500/60 px-3 py-1 text-xs font-semibold text-blue-600 transition hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-100 dark:hover:border-blue-400 dark:hover:bg-transparent dark:hover:text-white"
                                  >
                                    Update ingredient
                                  </button>
                                </div>
                              )}
                            </div>

                            {canViewNutritionToggle && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-zinc-900 dark:text-gray-200">
                                  Nutrition data
                                </summary>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                  {(
                                    nutritionFields as readonly NutritionField[]
                                  ).map((field) => (
                                    <label
                                      key={field}
                                      htmlFor={`nutrition-${field}-${sku}`}
                                      className="text-xs text-zinc-600 dark:text-gray-300"
                                    >
                                      {field}
                                      <input
                                        id={`nutrition-${field}-${sku}`}
                                        type="number"
                                        step={0.01}
                                        className="mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                        value={
                                          (
                                            nutrition as
                                              | Record<
                                                  NutritionField,
                                                  {
                                                    value: number;
                                                    unit?: string;
                                                  }
                                                >
                                              | undefined
                                          )?.[field]?.value || 0
                                        }
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <Button
                      variant="primary"
                      onClick={() => setPickerOpen(true)}
                    >
                      + Add ingredients
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={handleAddCustomIngredient}
                    >
                      + Add custom ingredients
                    </Button>
                  </div>
                </fieldset>
              </Section>
            ) : null}

            {canViewNotes ? (
              <Section title="Notes">
                <fieldset
                  disabled={!canEditNotes}
                  aria-disabled={!canEditNotes}
                  className={!canEditNotes ? 'opacity-75' : undefined}
                >
                  <textarea
                    className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    rows={3}
                    value={recipeData.notes || ''}
                    onChange={(e) =>
                      setRecipeDataByKey('notes', e.target.value)
                    }
                    placeholder="Recipe notes..."
                  />
                </fieldset>
              </Section>
            ) : null}

            {/* Qualità & Processo */}
            {canViewQuality ? (
              <Section title="Qualità & Processo">
                <fieldset
                  disabled={!canEditQuality}
                  aria-disabled={!canEditQuality}
                  className={`space-y-4 ${!canEditQuality ? 'opacity-75' : ''}`}
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {canViewField(PROCESS_CAPABILITIES.glutenTestDone) && (
                      <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                        Test glutine fatto?
                        <div className="flex items-center gap-2">
                          <select
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={processData.glutenTestDone}
                            disabled={
                              !canEditField(PROCESS_CAPABILITIES.glutenTestDone)
                            }
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
                          <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                            yes/no
                          </span>
                        </div>
                      </label>
                    )}
                    {canViewField('recipe.process.steamMinutes') && (
                      <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                        Vapore per minuti
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step={0.1}
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={processData.steamMinutes ?? ''}
                            disabled={
                              !canEditField('recipe.process.steamMinutes')
                            }
                            onChange={(e) => {
                              const val =
                                e.target.value === ''
                                  ? undefined
                                  : Number(e.target.value);
                              setProcess('steamMinutes', val);
                            }}
                          />
                          <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                            min
                          </span>
                        </div>
                      </label>
                    )}
                    {canViewField(PROCESS_CAPABILITIES.valveOpenMinutes) && (
                      <div className="flex flex-col gap-2 text-sm text-zinc-700 md:col-span-2 lg:col-span-1 dark:text-gray-300">
                        <span className="font-medium">
                          Apertura valvola (Forno)
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label
                              htmlFor="valve-open-minutes"
                              className="text-xs text-zinc-500 dark:text-gray-400"
                            >
                              Minuti aperti
                            </label>
                            <input
                              id="valve-open-minutes"
                              type="number"
                              step={0.1}
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                              value={processData.valveOpenMinutes ?? ''}
                              disabled={
                                !canEditField(
                                  PROCESS_CAPABILITIES.valveOpenMinutes,
                                )
                              }
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? undefined
                                    : Number(e.target.value);
                                setProcess('valveOpenMinutes', val);
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label
                              htmlFor="valve-close-minutes"
                              className="text-xs text-zinc-500 dark:text-gray-400"
                            >
                              Minuti chiusi
                            </label>
                            <input
                              id="valve-close-minutes"
                              type="number"
                              step={0.1}
                              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                              value={processData.valveCloseMinutes ?? ''}
                              disabled={
                                !canEditField(
                                  'recipe.process.valveCloseMinutes',
                                )
                              }
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? undefined
                                    : Number(e.target.value);
                                setProcess('valveCloseMinutes', val);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {canViewField(PROCESS_CAPABILITIES.lot) && (
                      <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                        Lotto
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={processData.lot ?? ''}
                            disabled={!canEditField(PROCESS_CAPABILITIES.lot)}
                            onChange={(e) =>
                              setProcess('lot', e.target.value || undefined)
                            }
                          />
                          <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                            String
                          </span>
                        </div>
                      </label>
                    )}
                    {canViewField(
                      PROCESS_CAPABILITIES.laboratoryHumidityPercent,
                    ) && (
                      <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                        Umidità laboratorio %
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step={0.1}
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={processData.laboratoryHumidityPercent ?? ''}
                            disabled={
                              !canEditField(
                                PROCESS_CAPABILITIES.laboratoryHumidityPercent,
                              )
                            }
                            onChange={(e) => {
                              const val =
                                e.target.value === ''
                                  ? undefined
                                  : Number(e.target.value);
                              setProcess('laboratoryHumidityPercent', val);
                            }}
                          />
                          <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                            %
                          </span>
                        </div>
                      </label>
                    )}
                    {canViewField(
                      PROCESS_CAPABILITIES.externalTemperatureC,
                    ) && (
                      <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                        Temperatura esterna °C
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step={0.1}
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={processData.externalTemperatureC ?? ''}
                            disabled={
                              !canEditField(
                                PROCESS_CAPABILITIES.externalTemperatureC,
                              )
                            }
                            onChange={(e) => {
                              const val =
                                e.target.value === ''
                                  ? undefined
                                  : Number(e.target.value);
                              setProcess('externalTemperatureC', val);
                            }}
                          />
                          <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                            °C
                          </span>
                        </div>
                      </label>
                    )}
                    {canViewField(PROCESS_CAPABILITIES.waterTemperatureC) && (
                      <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                        Temperatura Acqua °C
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step={0.1}
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={processData.waterTemperatureC ?? ''}
                            disabled={
                              !canEditField(
                                PROCESS_CAPABILITIES.waterTemperatureC,
                              )
                            }
                            onChange={(e) => {
                              const val =
                                e.target.value === ''
                                  ? undefined
                                  : Number(e.target.value);
                              setProcess('waterTemperatureC', val);
                            }}
                          />
                          <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                            °C
                          </span>
                        </div>
                      </label>
                    )}
                    {canViewField(
                      PROCESS_CAPABILITIES.finalDoughTemperatureC,
                    ) && (
                      <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                        Temperatura finale impasto °C
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step={0.1}
                            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                            value={processData.finalDoughTemperatureC ?? ''}
                            disabled={
                              !canEditField(
                                PROCESS_CAPABILITIES.finalDoughTemperatureC,
                              )
                            }
                            onChange={(e) => {
                              const val =
                                e.target.value === ''
                                  ? undefined
                                  : Number(e.target.value);
                              setProcess('finalDoughTemperatureC', val);
                            }}
                          />
                          <span className="w-20 shrink-0 text-xs text-zinc-500 dark:text-gray-400">
                            °C
                          </span>
                        </div>
                      </label>
                    )}
                  </div>
                  {canViewProcess && (
                    <div className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          Temperature forno e minuti
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOvenTemperatures((prev) => [
                              ...prev,
                              {
                                temperature: 0,
                                minutes: 0,
                                order: prev.length,
                              },
                            ]);
                          }}
                          disabled={!canEditProcess}
                          className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          + Aggiungi
                        </button>
                      </div>
                      <div className="space-y-2">
                        {ovenTemperatures.map((ot, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-800/50"
                          >
                            <input
                              type="number"
                              step={0.1}
                              placeholder="Temperatura"
                              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                              value={ot.temperature || ''}
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value);
                                const newTemps = [...ovenTemperatures];
                                newTemps[index] = {
                                  ...newTemps[index],
                                  temperature: isNaN(val) ? 0 : val,
                                };
                                setOvenTemperatures(newTemps);
                              }}
                              disabled={!canEditProcess}
                            />
                            <span className="text-xs text-zinc-500 dark:text-gray-400">
                              °C
                            </span>
                            <input
                              type="number"
                              step={0.1}
                              placeholder="Minuti"
                              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                              value={ot.minutes || ''}
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value);
                                const newTemps = [...ovenTemperatures];
                                newTemps[index] = {
                                  ...newTemps[index],
                                  minutes: isNaN(val) ? 0 : val,
                                };
                                setOvenTemperatures(newTemps);
                              }}
                              disabled={!canEditProcess}
                            />
                            <span className="text-xs text-zinc-500 dark:text-gray-400">
                              min
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setOvenTemperatures((prev) =>
                                  prev.filter((_, i) => i !== index),
                                );
                              }}
                              disabled={!canEditProcess}
                              className="ml-auto rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Rimuovi
                            </button>
                          </div>
                        ))}
                        {ovenTemperatures.length === 0 && (
                          <p className="text-xs text-zinc-500 italic dark:text-gray-500">
                            Nessuna temperatura forno configurata
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {canViewProcess && (
                    <div className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          Tempo di impasto (minuti) e velocità
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMixingTimes((prev) => [
                              ...prev,
                              { minutes: 0, speed: 0, order: prev.length },
                            ]);
                          }}
                          disabled={!canEditProcess}
                          className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          + Aggiungi
                        </button>
                      </div>
                      <div className="space-y-2">
                        {mixingTimes.map((mt, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-md border border-zinc-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-800/50"
                          >
                            <input
                              type="number"
                              step={0.1}
                              placeholder="Minuti"
                              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                              value={mt.minutes || ''}
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value);
                                const newTimes = [...mixingTimes];
                                newTimes[index] = {
                                  ...newTimes[index],
                                  minutes: isNaN(val) ? 0 : val,
                                };
                                setMixingTimes(newTimes);
                              }}
                              disabled={!canEditProcess}
                            />
                            <span className="text-xs text-zinc-500 dark:text-gray-400">
                              min
                            </span>
                            <input
                              type="number"
                              step={0.1}
                              placeholder="Velocità"
                              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                              value={mt.speed || ''}
                              onChange={(e) => {
                                const val =
                                  e.target.value === ''
                                    ? 0
                                    : Number(e.target.value);
                                const newTimes = [...mixingTimes];
                                newTimes[index] = {
                                  ...newTimes[index],
                                  speed: isNaN(val) ? 0 : val,
                                };
                                setMixingTimes(newTimes);
                              }}
                              disabled={!canEditProcess}
                            />
                            <span className="text-xs text-zinc-500 dark:text-gray-400">
                              vel
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setMixingTimes((prev) =>
                                  prev.filter((_, i) => i !== index),
                                );
                              }}
                              disabled={!canEditProcess}
                              className="ml-auto rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Rimuovi
                            </button>
                          </div>
                        ))}
                        {mixingTimes.length === 0 && (
                          <p className="text-xs text-zinc-500 italic dark:text-gray-500">
                            Nessun tempo di impasto configurato
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </fieldset>
              </Section>
            ) : null}
          </div>
        </CollapsibleSection>
      ) : null}

      {showProcessSection ? (
        <CollapsibleSection title="Process settings" defaultCollapsed>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {canViewBasic ? (
              <div
                className={`flex flex-col gap-3 rounded-lg border border-zinc-300 bg-white p-3 md:col-span-2 dark:border-gray-500/80 dark:bg-gray-900/80 ${!canEditBasic ? 'opacity-75' : ''}`}
                aria-disabled={!canEditBasic}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-zinc-900 dark:text-gray-200">
                      Basic info
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-gray-400">
                      Packaging, waste & hydration
                    </p>
                  </div>
                  {canViewCalculated ? (
                    <button
                      type="button"
                      onClick={() => setShowCalculatedData((prev) => !prev)}
                      className="inline-flex items-center justify-center rounded-lg border border-blue-600 bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:border-blue-500 hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                      aria-expanded={showCalculatedData}
                    >
                      {showCalculatedData
                        ? 'Hide calculated data'
                        : 'Show calculated data'}
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {canViewField(BASIC_CAPABILITIES.name) ? (
                    <label className="text-sm text-zinc-700 md:col-span-2 dark:text-gray-300">
                      Recipe Name
                      <input
                        className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={recipeData.name || ''}
                        disabled={!canEditField(BASIC_CAPABILITIES.name)}
                        onChange={(e) =>
                          setRecipeDataByKey('name', e.target.value)
                        }
                      />
                    </label>
                  ) : null}
                  {canViewField(BASIC_CAPABILITIES.packageWeight) ? (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Peso confezione (g)
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={0.001}
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          value={recipeData.packageWeight || ''}
                          disabled={
                            !canEditField(BASIC_CAPABILITIES.packageWeight)
                          }
                          onChange={(e) =>
                            setRecipeDataByKey(
                              'packageWeight',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">
                          ={' '}
                          {((recipeData.packageWeight || 0) / 1000).toFixed(2)}{' '}
                          kg
                        </span>
                      </div>
                    </label>
                  ) : null}
                  {canViewField(BASIC_CAPABILITIES.numberOfPackages) ? (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Numero pacchetti
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={1}
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          value={recipeData.numberOfPackages || ''}
                          disabled={
                            !canEditField(BASIC_CAPABILITIES.numberOfPackages)
                          }
                          onChange={(e) =>
                            setRecipeDataByKey(
                              'numberOfPackages',
                              Math.ceil(Number(e.target.value)),
                            )
                          }
                        />
                        <span className="w-28" />
                      </div>
                    </label>
                  ) : null}
                  {canViewField(BASIC_CAPABILITIES.wastePercent) ? (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Waste %
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={0.01}
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          value={recipeData.wastePercent || ''}
                          disabled={
                            !canEditField(BASIC_CAPABILITIES.wastePercent)
                          }
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
                  ) : null}
                  {canViewField(BASIC_CAPABILITIES.waterPercent) ? (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Water %
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step={0.01}
                          className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                          value={recipeData.waterPercent || ''}
                          disabled={
                            !canEditField(BASIC_CAPABILITIES.waterPercent)
                          }
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
                  ) : null}
                </div>

                {canViewCalculated && showCalculatedData ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
                      <div className="font-semibold text-blue-900 dark:text-blue-100">
                        Totals overview
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Total waste %
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {totalWastePercent.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Totale qty per ricetta
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {totalQtyForRecipe.toLocaleString('it-IT')} g
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {(totalQtyForRecipe / 1000).toFixed(2)} kg
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
                      <div className="font-semibold text-blue-900 dark:text-blue-100">
                        Derived quantities
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Prodotto cotto (con sfrido)
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {cookedWeightGross.toLocaleString('it-IT')} g
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {(cookedWeightGross / 1000).toFixed(2)} kg
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Solo polveri
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {totalOriginalPowderQty.toLocaleString('it-IT')} g
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {(totalOriginalPowderQty / 1000).toFixed(2)} kg
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Biscotti & Teglie */}
            {canViewCookies ? (
              <fieldset
                disabled={!canEditCookies}
                aria-disabled={!canEditCookies}
                className={`flex flex-col gap-2 rounded-lg border border-zinc-300 p-3 dark:border-gray-500 ${!canEditCookies ? 'opacity-75' : ''}`}
              >
                <div className="text-base font-semibold text-zinc-900 dark:text-gray-200">
                  Biscotti & Teglie
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {canViewCookies && showCalculatedData && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
                      <div className="mb-3 font-semibold text-blue-900 dark:text-blue-100">
                        Campi calcolati
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Numero biscotti
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {cookiesCountAuto ??
                              processData.cookiesCount ??
                              '-'}
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {cookiesCountAuto !== undefined
                              ? `Calcolato da (Totale qty per ricetta ÷ Peso biscotto crudo) arrotondato`
                              : 'Inserisci Totale qty per ricetta e Peso biscotto cotto + % acqua'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Peso biscotto crudo
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {cookieWeightRawGAuto ??
                              processData.cookieWeightRawG ??
                              '-'}{' '}
                            g
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {cookieWeightRawGAuto !== undefined
                              ? `Calcolato da (peso cotto ÷ (1 - ${recipeData.waterPercent ?? 0}%))`
                              : 'Inserisci peso cotto e % acqua'}
                          </span>
                        </div>
                        {(canViewField(PROCESS_CAPABILITIES.trayWeightRawG) ||
                          canViewField(
                            PROCESS_CAPABILITIES.trayWeightCookedG,
                          )) && (
                          <>
                            {canViewField(
                              PROCESS_CAPABILITIES.trayWeightRawG,
                            ) && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                                  Peso teglia (crudo)
                                </span>
                                <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                                  {trayWeightRawGAuto ?? '-'} g
                                </span>
                                <span className="text-xs text-blue-700 dark:text-blue-300">
                                  {trayWeightRawGAuto !== undefined
                                    ? `Calcolato da (Peso biscotto crudo × Capienza teglie)`
                                    : 'Inserisci Peso biscotto crudo e Capienza teglie'}
                                </span>
                              </div>
                            )}
                            {canViewField(
                              PROCESS_CAPABILITIES.trayWeightCookedG,
                            ) && (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                                  Peso teglia (cotto)
                                </span>
                                <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                                  {trayWeightCookedGAuto ?? '-'} g
                                </span>
                                <span className="text-xs text-blue-700 dark:text-blue-300">
                                  {trayWeightCookedGAuto !== undefined
                                    ? `Calcolato da (Peso biscotto cotto × Capienza teglie)`
                                    : 'Inserisci Peso biscotto cotto e Capienza teglie'}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {canViewField(PROCESS_CAPABILITIES.cookieWeightCookedG) && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Peso biscotto cotto
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          value={processData.cookieWeightCookedG ?? ''}
                          disabled={
                            !canEditField(
                              PROCESS_CAPABILITIES.cookieWeightCookedG,
                            )
                          }
                          onChange={(e) =>
                            setProcess(
                              'cookieWeightCookedG',
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">g</span>
                      </div>
                    </label>
                  )}
                </div>
              </fieldset>
            ) : null}

            {/* Attrezzature */}
            {canViewEquipment ? (
              <fieldset
                disabled={!canEditEquipment}
                aria-disabled={!canEditEquipment}
                className={`flex flex-col gap-2 rounded-lg border border-zinc-300 p-3 dark:border-gray-500 ${!canEditEquipment ? 'opacity-75' : ''}`}
              >
                <div className="text-base font-semibold text-zinc-900 dark:text-gray-200">
                  Attrezzature
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {canViewEquipment && showCalculatedData && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100">
                      <div className="mb-3 font-semibold text-blue-900 dark:text-blue-100">
                        Campi calcolati
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Numero impasti
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {doughBatchesCountAuto ??
                              processData.doughBatchesCount ??
                              '-'}
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {doughBatchesCountAuto !== undefined
                              ? `Calcolato da (Totale qty per ricetta ÷ Capienza impastatrice) arrotondato a numero intero`
                              : 'Inserisci Totale qty per ricetta e Capienza impastatrice'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Numero colatrici
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {depositorsCountAuto ??
                              processData.depositorsCount ??
                              '-'}
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {depositorsCountAuto !== undefined
                              ? `Calcolato da (Totale qty per ricetta ÷ Capienza colatrice) arrotondato a numero intero`
                              : 'Inserisci Totale qty per ricetta e Capienza colatrice'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Numero teglie
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {traysCountAuto ?? '-'}
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {traysCountAuto !== undefined
                              ? `Calcolato da (Numero biscotti ÷ Capienza teglie)`
                              : 'Inserisci Numero biscotti e Capienza teglie'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Numero scatole
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {numberOfBoxesAuto ??
                              processData.numberOfBoxes ??
                              '-'}
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {numberOfBoxesAuto !== undefined
                              ? `Calcolato da (Numero pacchetti ÷ Capienza scatole)`
                              : 'Inserisci Numero pacchetti e Capienza scatole'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-700 uppercase dark:text-blue-300">
                            Numero carrelli
                          </span>
                          <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                            {numberOfCartsAuto ??
                              processData.numberOfCarts ??
                              '-'}
                          </span>
                          <span className="text-xs text-blue-700 dark:text-blue-300">
                            {numberOfCartsAuto !== undefined
                              ? `Calcolato da (Numero teglie ÷ Capienza carrelli)`
                              : 'Inserisci Numero teglie e Capienza carrelli'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {canViewField(PROCESS_CAPABILITIES.mixerCapacityKg) && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Capienza impastatrice
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          value={processData.mixerCapacityKg ?? ''}
                          disabled={
                            !canEditField(PROCESS_CAPABILITIES.mixerCapacityKg)
                          }
                          onChange={(e) =>
                            setProcess(
                              'mixerCapacityKg',
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">Kg</span>
                      </div>
                    </label>
                  )}
                  {canViewField(PROCESS_CAPABILITIES.depositorCapacityKg) && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Capienza colatrice
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          value={processData.depositorCapacityKg ?? ''}
                          disabled={
                            !canEditField(
                              PROCESS_CAPABILITIES.depositorCapacityKg,
                            )
                          }
                          onChange={(e) =>
                            setProcess(
                              'depositorCapacityKg',
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">Kg</span>
                      </div>
                    </label>
                  )}
                  {canViewField(PROCESS_CAPABILITIES.traysCapacityKg) && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Capienza teglie
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          value={
                            processData.traysCapacityKg &&
                            processData.traysCapacityKg !== 0
                              ? processData.traysCapacityKg
                              : ''
                          }
                          disabled={
                            !canEditField(PROCESS_CAPABILITIES.traysCapacityKg)
                          }
                          onChange={(e) =>
                            setProcess(
                              'traysCapacityKg',
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                  {canViewField(PROCESS_CAPABILITIES.boxCapacity) && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Capienza scatole
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          value={
                            processData.boxCapacity &&
                            processData.boxCapacity !== 0
                              ? processData.boxCapacity
                              : ''
                          }
                          disabled={
                            !canEditField(PROCESS_CAPABILITIES.boxCapacity)
                          }
                          onChange={(e) =>
                            setProcess(
                              'boxCapacity',
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                  {canViewField(PROCESS_CAPABILITIES.cartCapacity) && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Capienza carrelli
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          value={
                            processData.cartCapacity &&
                            processData.cartCapacity !== 0
                              ? processData.cartCapacity
                              : ''
                          }
                          disabled={
                            !canEditField(PROCESS_CAPABILITIES.cartCapacity)
                          }
                          onChange={(e) =>
                            setProcess(
                              'cartCapacity',
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                </div>
              </fieldset>
            ) : null}

            {/* Pianificazione */}
            {canViewPlanning ? (
              <fieldset
                disabled={!canEditPlanning}
                aria-disabled={!canEditPlanning}
                className={`flex flex-col gap-2 rounded-lg border border-gray-500 p-3 ${!canEditPlanning ? 'opacity-75' : ''}`}
              >
                <div className="text-base font-semibold text-gray-200">
                  Pianificazione
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {canViewPlanning && showCalculatedData && (
                    <div className="rounded-lg border border-blue-900/60 bg-blue-950/40 p-4 text-sm text-blue-100">
                      <div className="mb-3 font-semibold text-blue-100">
                        Campi calcolati
                      </div>
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-300 uppercase">
                            Numero teglie/impasto
                          </span>
                          <span className="text-lg font-semibold text-white">
                            {traysPerBatchAuto ?? '-'}
                          </span>
                          <span className="text-xs text-blue-300">
                            {traysPerBatchAuto !== undefined
                              ? `Calcolato da (Totale qty per ricetta ÷ (Peso biscotto crudo × Capienza teglie))`
                              : 'Inserisci Totale qty per ricetta, Peso biscotto crudo e Capienza teglie'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-300 uppercase">
                            Numero teglie/colatrici
                          </span>
                          <span className="text-lg font-semibold text-white">
                            {traysPerDepositorsAuto ?? '-'}
                          </span>
                          <span className="text-xs text-blue-300">
                            {traysPerDepositorsAuto !== undefined
                              ? `Calcolato da (Capienza colatrice ÷ (Capienza teglie × Peso biscotto crudo))`
                              : 'Inserisci Capienza colatrice, Capienza teglie e Peso biscotto crudo'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs tracking-wide text-blue-300 uppercase">
                            Numero infornate
                          </span>
                          <span className="text-lg font-semibold text-white">
                            {ovenLoadsCountAuto ?? '-'}
                          </span>
                          <span className="text-xs text-blue-300">
                            {ovenLoadsCountAuto !== undefined
                              ? `Calcolato da (Numero teglie ÷ Teglie/Infornate)`
                              : 'Inserisci Numero teglie e Teglie/Infornate'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {canViewField(PROCESS_CAPABILITIES.traysPerOvenLoad) && (
                    <label className="flex flex-col justify-center gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Teglie/Infornate
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                          value={
                            processData.traysPerOvenLoad &&
                            processData.traysPerOvenLoad !== 0
                              ? processData.traysPerOvenLoad
                              : ''
                          }
                          disabled={
                            !canEditField(PROCESS_CAPABILITIES.traysPerOvenLoad)
                          }
                          onChange={(e) =>
                            setProcess(
                              'traysPerOvenLoad',
                              e.target.value === ''
                                ? undefined
                                : Number(e.target.value),
                            )
                          }
                        />
                        <span className="w-28">#</span>
                      </div>
                    </label>
                  )}
                </div>
              </fieldset>
            ) : null}
          </div>
        </CollapsibleSection>
      ) : null}

      {/* Costi - Sezione separata */}
      {(isAdmin && !isOperatorView) ||
      canView(
        effectiveCapabilities,
        'recipe.costs',
        isOperatorView,
        profile?.roleLabel === 'operator',
      ) ? (
        <CollapsibleSection title="Costi" defaultCollapsed>
          <RecipeCostsSection
            recipeId={idNum}
            profileCapabilities={effectiveCapabilities}
            roleLabel={profile?.roleLabel}
            isOperatorView={isOperatorView}
            onCostsChange={setRecipeCosts}
          />
        </CollapsibleSection>
      ) : null}

      {canViewNutrition ? (
        <CollapsibleSection title="Nutrition Insights" defaultCollapsed>
          <fieldset
            disabled={!canEditNutrition}
            aria-disabled={!canEditNutrition}
            className={!canEditNutrition ? 'opacity-75' : undefined}
          >
            <NutritionInsightsPanel recipeId={idNum} layout="embedded" />
          </fieldset>
        </CollapsibleSection>
      ) : null}

      {/* Setting Colatrice Section */}
      {canViewColatrice ? (
        <CollapsibleSection title="Setting Colatrice" defaultCollapsed>
          <fieldset
            disabled={!canEditColatrice}
            aria-disabled={!canEditColatrice}
            className={`space-y-4 ${!canEditColatrice ? 'opacity-75' : ''}`}
          >
            {/* Tabs */}
            <div className="border-b border-zinc-200 dark:border-zinc-700">
              <nav className="-mb-px flex gap-4">
                <button
                  type="button"
                  onClick={() => setColatriceActiveTab('home')}
                  className={`border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    colatriceActiveTab === 'home'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  Home
                </button>
                <button
                  type="button"
                  onClick={() => setColatriceActiveTab('page1')}
                  className={`border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    colatriceActiveTab === 'page1'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  Setting page 1
                </button>
                <button
                  type="button"
                  onClick={() => setColatriceActiveTab('page2')}
                  className={`border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    colatriceActiveTab === 'page2'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  Setting page 2
                </button>
                <button
                  type="button"
                  onClick={() => setColatriceActiveTab('page3')}
                  className={`border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    colatriceActiveTab === 'page3'
                      ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                      : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300'
                  }`}
                >
                  Setting page 3
                </button>
              </nav>
            </div>

            {/* Load Defaults Button */}
            {canEditColatrice && (
              <div className="flex justify-end py-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      // Fetch defaults from database
                      const response = await fetch(
                        '/api/parameters/colatrice-defaults',
                        {
                          credentials: 'include',
                          cache: 'no-store',
                        },
                      );
                      if (!response.ok) {
                        throw new Error('Failed to fetch defaults');
                      }
                      const data = await response.json();
                      const defaultsFromDb =
                        data.defaults || COLATRICE_DEFAULTS;

                      // Check if there are any empty fields
                      const hasEmptyFields = Object.keys(defaultsFromDb).some(
                        (pageKey) => {
                          const currentPage = colatriceSettings[pageKey] || {};
                          const defaultPage = defaultsFromDb[pageKey];
                          return Object.keys(defaultPage).some((fieldKey) => {
                            const currentValue = currentPage[fieldKey];
                            return (
                              currentValue === undefined ||
                              currentValue === null
                            );
                          });
                        },
                      );

                      if (!hasEmptyFields) {
                        setToast(
                          'Tutti i campi sono già popolati. Non è possibile sovrascrivere i dati esistenti.',
                          { type: 'warning' },
                        );
                        return;
                      }

                      // Confirm before populating empty fields
                      if (
                        typeof window !== 'undefined' &&
                        window.confirm(
                          'Stai per inserire i dati di default nei campi di Setting colatrice, sei sicuro?',
                        )
                      ) {
                        // Merge defaults, keeping existing values
                        const merged: Record<string, Record<string, number>> = {
                          ...colatriceSettings,
                        };

                        Object.keys(defaultsFromDb).forEach((pageKey) => {
                          const currentPage = merged[pageKey] || {};
                          const defaultPage = defaultsFromDb[pageKey];

                          merged[pageKey] = { ...currentPage };

                          Object.keys(defaultPage).forEach((fieldKey) => {
                            const currentValue = currentPage[fieldKey];
                            if (
                              currentValue === undefined ||
                              currentValue === null
                            ) {
                              merged[pageKey][fieldKey] = defaultPage[fieldKey];
                            }
                          });
                        });

                        setColatriceSettings(merged);

                        setToast('Dati di default inseriti nei campi vuoti.', {
                          type: 'success',
                        });
                      }
                    } catch (error) {
                      console.error('Failed to load defaults:', error);
                      setToast('Errore nel caricamento dei dati di default.', {
                        type: 'error',
                      });
                    }
                  }}
                  className="text-sm"
                >
                  Carica Dati Default
                </Button>
              </div>
            )}

            {/* Tab Content */}
            <div className="py-4">
              {colatriceActiveTab === 'home' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Tower Drop Easy Access
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Alzata tavola (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.tower_drop_easy_access
                            ?.alzata_tavola_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            tower_drop_easy_access: {
                              ...colatriceSettings.tower_drop_easy_access,
                              alzata_tavola_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Vel colaggio (%)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.tower_drop_easy_access
                            ?.vel_colaggio_percent ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            tower_drop_easy_access: {
                              ...colatriceSettings.tower_drop_easy_access,
                              vel_colaggio_percent: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Tempo giro (sec)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.tower_drop_easy_access
                            ?.tempo_giro_sec ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            tower_drop_easy_access: {
                              ...colatriceSettings.tower_drop_easy_access,
                              tempo_giro_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Tempo colaggio (sec)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.tower_drop_easy_access
                            ?.tempo_colaggio_sec ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            tower_drop_easy_access: {
                              ...colatriceSettings.tower_drop_easy_access,
                              tempo_colaggio_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                  </div>
                </div>
              )}

              {colatriceActiveTab === 'page1' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Schermata 1
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Velocità passi (%)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1
                            ?.velocita_passi_percent ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              velocita_passi_percent: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Bordo teglia (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.bordo_teglia_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              bordo_teglia_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Ritardo start passi (sec)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1
                            ?.ritardo_start_passi_sec ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              ritardo_start_passi_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Spazio biscotto 1 (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.spazio_biscotto_1_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              spazio_biscotto_1_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Spazio biscotto 2 (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.spazio_biscotto_2_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              spazio_biscotto_2_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Spazio biscotto 3 (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.spazio_biscotto_3_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              spazio_biscotto_3_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Spazio biscotto 4 (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.spazio_biscotto_4_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              spazio_biscotto_4_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Ritardo striscio (sec)
                      <input
                        type="number"
                        step={0.01}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.ritardo_striscio_sec ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              ritardo_striscio_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Lunghezza striscio (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1
                            ?.lunghezza_striscio_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              lunghezza_striscio_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Ritorno striscio (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.ritorno_striscio_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              ritorno_striscio_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Altezza start passi (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1
                            ?.altezza_start_passi_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              altezza_start_passi_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Colaggio pompa
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.colaggio_pompa ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              colaggio_pompa: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Teglia alta
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={colatriceSettings.schermata_1?.teglia_alta ?? ''}
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              teglia_alta: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Taglio filo
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={colatriceSettings.schermata_1?.taglio_filo ?? ''}
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              taglio_filo: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Colaggio senza tappeto
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1
                            ?.colaggio_senza_tappeto ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              colaggio_senza_tappeto: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Uscita anteriore
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_1?.uscita_anteriore ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_1: {
                              ...colatriceSettings.schermata_1,
                              uscita_anteriore: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                  </div>
                </div>
              )}

              {colatriceActiveTab === 'page2' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Schermata 2
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Altezza tavola (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.altezza_tavola_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              altezza_tavola_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Altezza biscotto (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.altezza_biscotto_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              altezza_biscotto_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Velocità tavola
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.velocita_tavola ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              velocita_tavola: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Velocità discesa tavola
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2
                            ?.velocita_discesa_tavola ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              velocita_discesa_tavola: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Altezza start colata (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2
                            ?.altezza_start_colata_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              altezza_start_colata_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Velocità colaggio (%)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2
                            ?.velocita_colaggio_percent ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              velocita_colaggio_percent: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Tempo colaggio (sec)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.tempo_colaggio_sec ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              tempo_colaggio_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Recupero colaggio
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.recupero_colaggio ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              recupero_colaggio: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Spazio uscita (cm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.spazio_uscita_cm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              spazio_uscita_cm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Rit1 discesa tavola
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.rit1_discesa_tavola ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              rit1_discesa_tavola: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Rit2 discesa tavola
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.rit2_discesa_tavola ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              rit2_discesa_tavola: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Ritardo giro (sec)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.ritardo_giro_sec ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              ritardo_giro_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Ritardo taglio (sec)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.ritardo_taglio_sec ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              ritardo_taglio_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Tempo giro (sec)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.tempo_giro_sec ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              tempo_giro_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Velocità giro (%)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2
                            ?.velocita_giro_percent ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              velocita_giro_percent: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Altezza reset giro (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2
                            ?.altezza_reset_giro_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              altezza_reset_giro_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Lunghezza teglia (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_2?.lunghezza_teglia_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_2: {
                              ...colatriceSettings.schermata_2,
                              lunghezza_teglia_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                  </div>
                </div>
              )}

              {colatriceActiveTab === 'page3' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Schermata 3
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Altezza tavola (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3?.altezza_tavola_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              altezza_tavola_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Altezza biscotto (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3?.altezza_biscotto_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              altezza_biscotto_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Velocità colaggio (%)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3
                            ?.velocita_colaggio_percent ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              velocita_colaggio_percent: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Tempo colaggio (sec)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3?.tempo_colaggio_sec ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              tempo_colaggio_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Recupero colaggio
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3?.recupero_colaggio ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              recupero_colaggio: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Rit1 discesa tavola
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3?.rit1_discesa_tavola ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              rit1_discesa_tavola: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Ritardo striscio (sec)
                      <input
                        type="number"
                        step={0.01}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3?.ritardo_striscio_sec ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              ritardo_striscio_sec: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Lunghezza striscio (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3
                            ?.lunghezza_striscio_mm ?? ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              lunghezza_striscio_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-gray-300">
                      Ritorno striscio (mm)
                      <input
                        type="number"
                        step={0.1}
                        className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={
                          colatriceSettings.schermata_3?.ritorno_striscio_mm ??
                          ''
                        }
                        onChange={(e) => {
                          const val =
                            e.target.value === ''
                              ? undefined
                              : Number(e.target.value);
                          setColatriceSettings({
                            ...colatriceSettings,
                            schermata_3: {
                              ...colatriceSettings.schermata_3,
                              ritorno_striscio_mm: val ?? 0,
                            },
                          });
                        }}
                        disabled={!canEditColatrice}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </fieldset>
        </CollapsibleSection>
      ) : null}

      {/* Processi di Produzione Section */}
      {canViewProcesses ? (
        <CollapsibleSection title="Processi di Produzione" defaultCollapsed>
          <RecipeProcessesWidget
            recipeId={idNum}
            profileCapabilities={effectiveCapabilities}
            roleLabel={profile?.roleLabel}
            isOperatorView={isOperatorView}
            activeProduction={activeProduction}
          />
        </CollapsibleSection>
      ) : null}

      {/* Recipe History Section */}
      {canViewHistory ? (
        <CollapsibleSection
          title="Storico Modifiche"
          defaultCollapsed={!showHistory}
        >
          <RecipeHistoryPanel recipeId={idNum} filterType="all" />
        </CollapsibleSection>
      ) : null}

      {/* Fixed overlay save button - only show if there are unsaved changes */}
      {canViewActions && hasUnsavedChanges ? (
        <div className="fixed right-6 bottom-6 z-50 flex items-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-3 shadow-2xl backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/95">
          {saving && (
            <span className="text-sm text-zinc-600 dark:text-zinc-300">
              Salvataggio...
            </span>
          )}
          {!canEditActions ? (
            <span className="text-xs tracking-wide text-yellow-600 uppercase dark:text-yellow-400">
              Sola lettura
            </span>
          ) : null}
          <button
            className="cursor-pointer rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-zinc-900"
            onClick={handleSave}
            disabled={saving || !canEditActions}
          >
            {saving ? 'Salvataggio...' : 'Salva modifiche'}
          </button>
        </div>
      ) : null}

      {canViewIngredientsTable ? (
        <ProductPickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPickMany={handlePickMany}
          existingSkus={new Set(skus)}
        />
      ) : null}
      {canViewIngredientsTable &&
      nutritionModalSku &&
      selectedNutritionModalData ? (
        <IngredientNutritionModal
          open
          sku={selectedNutritionModalData.sku}
          name={selectedNutritionModalData.name}
          qtyForRecipe={selectedNutritionModalData.qtyForRecipe}
          qtyOriginal={selectedNutritionModalData.qtyOriginal}
          isPowderIngredient={selectedNutritionModalData.isPowderIngredient}
          recipeId={recipeData.id}
          recipeName={recipeData.name}
          initialValues={selectedNutritionModalValues}
          onClose={() => setNutritionModalSku(null)}
          onValuesApplied={(vals) => {
            handleNutritionModalValuesApplied(vals);
          }}
        />
      ) : null}
    </div>
  );
}
