'use client';
import React from 'react';
import Link from 'next/link';
import RecipesTable from '../admin/recipes/RecipesTable';
import type { RecipeListItem } from '@/types';
import { apiClient } from '@/helpers/api';
import type { JsonValue } from '@/helpers/api';
import {
  MagentoRecipe,
  MagentoProductWithNutritionAttributes,
  NewIngredientProps,
  NewRecipeProps,
  CostType,
  COST_TYPE_LABELS,
} from '@/types';
import { Button } from '@/components/Button';
import { useSetToast } from '@/state/ToastProvider';
import { useProfile } from '@/contexts/ProfileContext';
import { canView } from '@/lib/permissions/check';

type ImportResult = {
  recipeData: NewRecipeProps;
  ingredients: NewIngredientProps[];
  importedName: string;
  costs?: Array<{ costType: CostType; value: number }>;
  categoryName?: string;
  clientNames?: string[];
};

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed =
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizePercent = (value: unknown): number | undefined => {
  const numeric = toNumber(value);
  if (numeric === undefined) return undefined;
  const normalized = numeric > 1 ? numeric : numeric * 100;
  return Number(normalized.toFixed(2));
};

const sanitizeRecipePayload = (
  payload: Partial<NewRecipeProps>,
): NewRecipeProps => {
  if (!payload.name || payload.name.trim().length === 0) {
    throw new Error('Recipe name is missing in the JSON file.');
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }

  return cleaned as NewRecipeProps;
};

const slugify = (value: string): string => {
  const base = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'INGREDIENT';
};

const buildNotes = (
  data: Record<string, unknown>,
  sourceFileName?: string,
): string | undefined => {
  const noteFields: Array<[string, string]> = [
    ['Foglio', 'Sheet'],
    ['Tempi Foglio', 'Timing sheet'],
    ['Peso biscotto cotto', 'Cooked biscuit weight'],
    ['Capienza impastatrice', 'Mixer capacity'],
    ['Capienza teglie', 'Tray capacity'],
    ['Teglie/Infornate', 'Trays per bake'],
    ['Prezzo vendita', 'Sale price'],
    ['Capienza cartone', 'Carton capacity'],
    ['Tempi - Confezionamento', 'Packaging time'],
    ['Tempi - Costo elettricità', 'Electricity cost per minute'],
    ['Tempi - Kwatt usati al minuto', 'kW used per minute'],
  ];

  const lines: string[] = [];
  if (sourceFileName) {
    lines.push(`Imported from JSON file: ${sourceFileName}`);
  }

  for (const [field, label] of noteFields) {
    const value = data[field];
    if (value !== undefined && value !== null && value !== '') {
      lines.push(`${label}: ${value}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
};

// Mappatura inversa da label italiana a CostType
const COST_LABEL_TO_TYPE: Record<string, CostType> = Object.entries(
  COST_TYPE_LABELS,
).reduce(
  (acc, [type, label]) => {
    acc[label] = type as CostType;
    return acc;
  },
  {} as Record<string, CostType>,
);

const parseImportedRecipeJson = (
  raw: unknown,
  sourceFileName?: string,
): ImportResult => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid JSON: expected an object at the root.');
  }

  const data = raw as Record<string, unknown>;

  const recipeName = String(data['Ricetta'] ?? '').trim();
  if (!recipeName) {
    throw new Error('Missing "Ricetta" field in the JSON file.');
  }

  const seenSkus = new Set<string>();
  const ingredients: NewIngredientProps[] = [];

  for (let index = 1; index <= 100; index += 1) {
    const nameKey = `Ingrediente ${index}`;
    const qtyKey = `Qty Ingrediente ${index}`;
    const skuKey = `Codice Ingrediente ${index}`;
    if (!(nameKey in data) && !(qtyKey in data)) continue;

    const ingredientNameRaw = data[nameKey];
    const ingredientName = ingredientNameRaw
      ? String(ingredientNameRaw).trim()
      : '';

    const qtyValue = toNumber(data[qtyKey]);
    if (!ingredientName || qtyValue === undefined || qtyValue <= 0) continue;

    const skuFromJson =
      data[skuKey] && String(data[skuKey]).trim().length > 0
        ? String(data[skuKey]).trim()
        : undefined;

    const baseSku = skuFromJson ? skuFromJson : slugify(ingredientName);

    let sku = baseSku;
    let suffix = 1;
    while (seenSkus.has(sku)) {
      suffix += 1;
      sku = `${baseSku}-${suffix}`;
    }
    seenSkus.add(sku);

    ingredients.push({
      sku,
      name: ingredientName,
      qtyOriginal: Number(qtyValue.toFixed(2)),
      priceCostPerKg: 0,
      isPowderIngredient: 0,
      supplier: null,
      warehouseLocation: null,
      mpSku: null,
      productName: null,
      lot: null,
      done: 0,
      checkGlutine: 0,
      kcal: 0,
      kj: 0,
      protein: 0,
      carbo: 0,
      sugar: 0,
      fat: 0,
      saturi: 0,
      fiber: 0,
      salt: 0,
      polioli: 0,
    });
  }

  if (ingredients.length === 0) {
    throw new Error('No ingredient rows were found in the JSON file.');
  }

  const totalQty = ingredients.reduce(
    (sum, ingredient) => sum + ingredient.qtyOriginal,
    0,
  );

  // Parse SKU, category and clients
  const recipeSku = data['SKU']
    ? String(data['SKU']).trim() || undefined
    : undefined;

  // Parse category (by name, will need to resolve to ID)
  const categoryName = data['Categoria']
    ? String(data['Categoria']).trim()
    : undefined;

  // Parse clients (comma-separated names, will need to resolve to IDs)
  const clientsString = data['Clienti']
    ? String(data['Clienti']).trim()
    : undefined;
  const clientNames = clientsString
    ? clientsString
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    : [];

  // Parse tutti i parametri dal JSON
  const recipePayload: Partial<NewRecipeProps> = {
    name: recipeName,
    sku: recipeSku,
    notes: buildNotes(data, sourceFileName),
    totalQtyForRecipe: totalQty > 0 ? Number(totalQty.toFixed(2)) : undefined,
    wastePercent: normalizePercent(data['Sfrido']),
    waterPercent: normalizePercent(data['Acqua in %']),
    packageWeight: toNumber(data['Peso confezione biscotti']),
    numberOfPackages: toNumber(data['Numero pacchetti']),
    mixerCapacityKg: toNumber(data['Capienza impastatrice']),
    depositorCapacityKg: toNumber(data['Capienza colatrice']),
    traysCapacityKg: toNumber(data['Capienza teglie']),
    cookieWeightCookedG: toNumber(data['Peso biscotto cotto']),
    traysPerOvenLoad: toNumber(data['Teglie/Infornate']),
    // Optional fields left undefined by default; database defaults take over.
  };

  // Parse costi dal JSON (se presenti)
  const costs: Array<{ costType: CostType; value: number }> = [];
  for (const [label, costType] of Object.entries(COST_LABEL_TO_TYPE)) {
    const costValue = toNumber(data[label]);
    if (costValue !== undefined && costValue >= 0) {
      costs.push({ costType, value: costValue });
    }
  }

  return {
    recipeData: sanitizeRecipePayload(recipePayload),
    ingredients,
    importedName: recipeName,
    costs: costs.length > 0 ? costs : undefined,
    categoryName,
    clientNames,
  };
};

export default function RecipesPage() {
  const setToast = useSetToast();
  const { profile } = useProfile();
  const [items, setItems] = React.useState<RecipeListItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [importing, setImporting] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const canViewPortalRecipes = canView(
    profile?.capabilities,
    'portal.recipes',
    false,
  );

  React.useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const response = (await apiClient.get(`/api/recipes?t=${Date.now()}`, {
          headers: {
            'Cache-Control': 'no-store',
          },
        })) as {
          items?: MagentoRecipe[];
          total?: number;
          error?: string;
        };
        if (!canceled) {
          const apiItems = response.items ?? [];
          const mapped: RecipeListItem[] = apiItems.map((r) => {
            const recipe = r as Partial<MagentoRecipe> & {
              sku?: string | null;
              categoryId?: number | null;
              categoryName?: string | null;
              clientIds?: number[];
              clientNames?: string[];
            };
            return {
              id: Number(recipe.id) || 0,
              name: recipe.name ?? '',
              sku: recipe.sku ?? null,
              categoryId: recipe.categoryId ?? null,
              categoryName: recipe.categoryName ?? null,
              clientIds: recipe.clientIds ?? [],
              clientNames: recipe.clientNames ?? [],
            };
          });
          setItems(mapped);
          if (response.error) {
            setToast(`Errore nel caricamento: ${response.error}`, {
              type: 'error',
            });
          }
        }
      } catch (error) {
        console.error('[RecipesPage] Failed to load recipes:', error);
        if (!canceled) {
          setItems([]);
          const errorMessage =
            error instanceof Error ? error.message : 'Errore sconosciuto';
          setError(`Errore nel caricamento: ${errorMessage}`);
          setToast('Errore nel caricamento delle ricette. Riprova più tardi.', {
            type: 'error',
          });
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // setToast is stable from useSetToast hook

  const handleImportClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        setImporting(true);
        const fileContent = await file.text();
        const parsedJson = JSON.parse(fileContent);
        const {
          recipeData,
          ingredients,
          importedName,
          costs,
          categoryName,
          clientNames,
        } = parseImportedRecipeJson(parsedJson, file.name);

        // Recupera valori standard per fallback
        let standardParameters: Record<string, number> = {};
        try {
          const standardRes = await apiClient.get('/api/parameters/standard');
          const standardData = standardRes as {
            parameters?: Array<{ parameterType: string; value: number }>;
          };
          if (standardData.parameters) {
            standardParameters = standardData.parameters.reduce(
              (acc, param) => {
                acc[param.parameterType] = param.value;
                return acc;
              },
              {} as Record<string, number>,
            );
          }
        } catch (standardError) {
          console.warn(
            'Failed to fetch standard parameters, using defaults',
            standardError,
          );
        }

        // Applica fallback ai valori standard se i campi sono undefined
        const recipeDataWithDefaults: NewRecipeProps = {
          ...recipeData,
          mixerCapacityKg:
            recipeData.mixerCapacityKg ??
            standardParameters.mixerCapacityKg ??
            0,
          depositorCapacityKg:
            recipeData.depositorCapacityKg ??
            standardParameters.depositorCapacityKg ??
            0,
          traysCapacityKg:
            recipeData.traysCapacityKg ??
            standardParameters.traysCapacityKg ??
            0,
          cookieWeightCookedG:
            recipeData.cookieWeightCookedG ??
            standardParameters.cookieWeightCookedG ??
            0,
          traysPerOvenLoad:
            recipeData.traysPerOvenLoad ??
            standardParameters.traysPerOvenLoad ??
            0,
          wastePercent:
            recipeData.wastePercent ?? standardParameters.wastePercent ?? 0,
          waterPercent:
            recipeData.waterPercent ?? standardParameters.waterPercent ?? 0,
          packageWeight: recipeData.packageWeight ?? 0,
          numberOfPackages: recipeData.numberOfPackages ?? 0,
        } as NewRecipeProps;

        let preparedIngredients = ingredients;
        try {
          const productResponse = (await apiClient.post(
            '/api/products/by-skus',
            {
              skus: ingredients.map((ingredient) => ingredient.sku),
              includeNutritionAttributes: true,
            },
          )) as {
            items: MagentoProductWithNutritionAttributes[];
          };

          const productBySku = new Map(
            productResponse.items.map((item) => [item.sku, item]),
          );

          preparedIngredients = ingredients.map((ingredient) => {
            const product = productBySku.get(ingredient.sku);
            if (!product) return ingredient;

            const nutrition = product.nutritionAttributes ?? {};

            return {
              ...ingredient,
              name: ingredient.name || product.name || ingredient.sku,
              kcal: nutrition.kcal?.value ?? ingredient.kcal ?? 0,
              kj: nutrition.kj?.value ?? ingredient.kj ?? 0,
              protein: nutrition.protein?.value ?? ingredient.protein ?? 0,
              carbo: nutrition.carbo?.value ?? ingredient.carbo ?? 0,
              sugar: nutrition.sugar?.value ?? ingredient.sugar ?? 0,
              fat: nutrition.fat?.value ?? ingredient.fat ?? 0,
              saturi: nutrition.saturi?.value ?? ingredient.saturi ?? 0,
              fiber: nutrition.fiber?.value ?? ingredient.fiber ?? 0,
              salt: nutrition.salt?.value ?? ingredient.salt ?? 0,
              polioli: nutrition.polioli?.value ?? ingredient.polioli ?? 0,
            };
          });
        } catch (nutritionError) {
          console.warn(
            'Failed to enrich ingredients with Magento data',
            nutritionError,
          );
        }

        const response = (await apiClient.post('/api/recipes', {
          recipeData: recipeDataWithDefaults,
          ingredients: preparedIngredients,
          categoryName: categoryName || undefined,
          clientNames: clientNames || undefined,
        } as JsonValue)) as {
          success: boolean;
          createdRecipe: MagentoRecipe;
          error?: string;
        };

        if (!response.success) {
          throw new Error(response.error || 'API returned an error.');
        }

        const created = response.createdRecipe;
        if (!created || !created.id) {
          throw new Error('Recipe was created but no ID was returned.');
        }

        // Salva i costi specifici per la ricetta se presenti
        if (costs && costs.length > 0) {
          try {
            await apiClient.put(`/api/recipes/${created.id}/costs`, {
              costs,
            });
          } catch (costsError) {
            console.warn('Failed to save recipe costs', costsError);
            // Non bloccare l'import se il salvataggio dei costi fallisce
          }
        }

        // Categoria e clienti sono già gestiti in createRecipe se passati nel payload
        // Questo codice è mantenuto come fallback per compatibilità

        // Reload recipes from server to ensure consistency
        try {
          const refreshResponse = (await apiClient.get('/api/recipes', {
            headers: {
              'Cache-Control': 'no-store',
            },
          })) as {
            items?: MagentoRecipe[];
            error?: string;
          };
          const apiItems = refreshResponse.items ?? [];
          const mapped: RecipeListItem[] = apiItems.map((r) => {
            const recipe = r as Partial<MagentoRecipe> & {
              sku?: string | null;
              categoryId?: number | null;
              categoryName?: string | null;
              clientIds?: number[];
              clientNames?: string[];
            };
            return {
              id: Number(recipe.id) || 0,
              name: recipe.name ?? '',
              sku: recipe.sku ?? null,
              categoryId: recipe.categoryId ?? null,
              categoryName: recipe.categoryName ?? null,
              clientIds: recipe.clientIds ?? [],
              clientNames: recipe.clientNames ?? [],
            };
          });
          setItems(mapped);
        } catch (refreshError) {
          console.warn(
            'Failed to refresh recipes list, using local update',
            refreshError,
          );
          // Fallback: add to local list
          setItems((prev) => [
            ...prev,
            {
              id: Number(created.id),
              name: created.name ?? importedName,
            },
          ]);
        }

        setToast(`Imported recipe "${created.name ?? importedName}".`, {
          type: 'success',
        });
      } catch (error) {
        console.error('Recipe import failed', error);
        let errorMessage = 'Failed to import recipe.';
        if (error instanceof Error) {
          errorMessage = `Failed to import recipe: ${error.message}`;
          // Try to extract error from HttpError responseBody if available
          if (
            'responseBody' in error &&
            typeof error.responseBody === 'string'
          ) {
            try {
              const errorJson = JSON.parse(error.responseBody);
              if (errorJson.error) {
                errorMessage = `Failed to import recipe: ${errorJson.error}`;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
        setToast(errorMessage, { type: 'error' });
      } finally {
        setImporting(false);
        event.target.value = '';
      }
    },
    [setItems, setToast],
  );

  const recipeCount = items.length;

  return (
    <div
      className="bg-gray-50 px-4 py-6 text-zinc-900 dark:bg-[#050505] dark:text-zinc-100"
      style={{ scrollbarGutter: 'stable' }}
    >
      <div className="mx-auto w-[75%] space-y-6">
        {canViewPortalRecipes && (
          <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.3em] text-blue-600 uppercase dark:text-blue-300">
                  Portal · Ricette
                </p>
                <h1 className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-white">
                  Gestione ricette
                </h1>
                <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
                  Importa ricette storiche, crea nuove schede e apri il
                  dettaglio in un click.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleImportClick}
                  disabled={importing}
                  className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-blue-500 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:border-blue-500 dark:hover:text-white"
                >
                  {importing ? 'Importazione…' : 'Importa JSON'}
                </Button>
                <Link
                  href="/admin/recipes/new"
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-white focus:outline-none dark:focus:ring-offset-zinc-900"
                >
                  + Nuova ricetta
                </Link>
              </div>
            </div>
            <div className="mt-6 grid gap-4 text-sm md:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-black/40">
                <p className="text-xs tracking-widest text-zinc-500 uppercase">
                  Totale ricette
                </p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                  {recipeCount}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-black/30">
                <p className="text-xs tracking-widest text-zinc-500 uppercase">
                  Ultimo import
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Usa il pulsante Importa JSON per caricare file
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-black/30">
                <p className="text-xs tracking-widest text-zinc-500 uppercase">
                  Suggerimento
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  Clicca sul nome per entrare nella scheda ricetta
                </p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </header>
        )}

        <div className="space-y-6">
          {error && (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-6 dark:border-red-700 dark:bg-red-900/20">
              <h2 className="mb-2 text-xl font-semibold text-red-800 dark:text-red-200">
                Errore
              </h2>
              <p className="text-red-600 dark:text-red-300">{error}</p>
            </div>
          )}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950/50">
            <RecipesTable items={items} loading={loading} />
          </section>
        </div>
      </div>
    </div>
  );
}
