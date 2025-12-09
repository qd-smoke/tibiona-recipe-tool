'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Section } from '@/components/Section';
import {
  NUTRITION_KEYS,
  NutritionTotals,
  computeWaterAdjustedPer100g,
} from '@/lib/nutrition/per100g';
import { MagentoRecipe, MagentoRecipeIngredient } from '@/types';

const MAGENTO_NUTRIENTS_API = '/api/magento/nutrients';

const MAGENTO_NUTRIENT_FIELDS: Array<{
  key: string;
  label: string;
  unit: string;
}> = [
  { key: 'kj', label: 'Energia (kJ)', unit: 'kJ' },
  { key: 'kcal', label: 'Energia (kcal)', unit: 'kcal' },
  { key: 'protein', label: 'Proteine', unit: 'g' },
  { key: 'carbo', label: 'Carboidrati', unit: 'g' },
  { key: 'sugar', label: 'Zuccheri', unit: 'g' },
  { key: 'salt', label: 'Sale', unit: 'g' },
  { key: 'fiber', label: 'Fibre', unit: 'g' },
  { key: 'polyoli', label: 'Polioli', unit: 'g' },
  { key: 'fat', label: 'Grassi', unit: 'g' },
  { key: 'saturi', label: 'Grassi saturi', unit: 'g' },
];

const NUTRITION_FIELDS: Array<{
  key: (typeof NUTRITION_KEYS)[number];
  label: string;
}> = [
  { key: 'kcal', label: 'Kcal' },
  { key: 'kj', label: 'kJ' },
  { key: 'protein', label: 'Proteine' },
  { key: 'carbo', label: 'Carboidrati' },
  { key: 'sugar', label: 'di cui zuccheri' },
  { key: 'polioli', label: 'di cui polioli' },
  { key: 'fat', label: 'Grassi' },
  { key: 'saturi', label: 'di cui saturi' },
  { key: 'fiber', label: 'Fibre' },
  { key: 'salt', label: 'Sale' },
];

type LayoutMode = 'standalone' | 'embedded';

type NutritionInsightsPanelProps = {
  recipeId: number;
  layout?: LayoutMode;
};

export default function NutritionInsightsPanel({
  recipeId,
  layout = 'standalone',
}: NutritionInsightsPanelProps) {
  const [recipe, setRecipe] =
    useState<
      Pick<MagentoRecipe, 'id' | 'name' | 'totalQtyForRecipe' | 'waterPercent'>
    >();
  const [ingredients, setIngredients] = useState<MagentoRecipeIngredient[]>([]);
  const [totals, setTotals] = useState<NutritionTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalIngredient, setModalIngredient] =
    useState<MagentoRecipeIngredient | null>(null);
  type MagentoUpdateStatus = 'idle' | 'saving' | 'ok' | 'error';
  const [magentoValues, setMagentoValues] = useState<Record<string, string>>(
    {},
  );
  const [magentoLoading, setMagentoLoading] = useState(false);
  const [magentoError, setMagentoError] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<
    Record<string, MagentoUpdateStatus>
  >({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/recipes/${recipeId}?t=${Date.now()}`,
        );
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = (await response.json()) as {
          recipe: MagentoRecipe;
          ingredients: MagentoRecipeIngredient[];
        };
        if (cancelled) return;

        const aggregateTotals: NutritionTotals = {};
        for (const key of NUTRITION_KEYS) {
          aggregateTotals[key] = 0;
        }

        for (const ingredient of data.ingredients) {
          const qty = Number(ingredient.qtyOriginal ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) continue;
          for (const key of NUTRITION_KEYS) {
            const value = Number(
              (ingredient as Record<string, unknown>)[key] ?? 0,
            );
            if (!Number.isFinite(value)) continue;
            aggregateTotals[key] =
              (aggregateTotals[key] ?? 0) + (value * qty) / 100;
          }
        }

        setRecipe({
          id: data.recipe.id,
          name: data.recipe.name,
          totalQtyForRecipe: Number(data.recipe.totalQtyForRecipe ?? 0),
          waterPercent: Number(data.recipe.waterPercent ?? 0) || 0,
        });
        setIngredients(data.ingredients);
        setTotals(aggregateTotals);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const perHundred = useMemo(() => {
    if (!recipe || !totals) return null;
    return computeWaterAdjustedPer100g({
      totals,
      totalQuantity: recipe.totalQtyForRecipe ?? 0,
      waterPercent: recipe.waterPercent ?? 0,
    });
  }, [recipe, totals]);

  const waterMass = useMemo(() => {
    if (!recipe || !perHundred) return 0;
    return Math.max((recipe.totalQtyForRecipe ?? 0) - perHundred.dryMass, 0);
  }, [perHundred, recipe]);

  const ingredientBreakdown = useMemo(() => {
    if (!ingredients.length) return [];
    return ingredients.map((ingredient) => {
      const qty = Number(ingredient.qtyOriginal ?? 0);
      const perRecipe: NutritionTotals = {};
      for (const key of NUTRITION_KEYS) {
        const value = Number((ingredient as Record<string, unknown>)[key] ?? 0);
        perRecipe[key] = Number(((value * qty) / 100 || 0).toFixed(3));
      }
      return {
        ingredient,
        qty,
        perRecipe,
      };
    });
  }, [ingredients]);

  const selectedBreakdown = useMemo(() => {
    if (!modalIngredient) return null;
    return (
      ingredientBreakdown.find(
        ({ ingredient }) => ingredient.id === modalIngredient.id,
      ) ?? null
    );
  }, [ingredientBreakdown, modalIngredient]);

  useEffect(() => {
    if (!modalIngredient) {
      setMagentoValues({});
      setMagentoLoading(false);
      setMagentoError(null);
      setUpdateState({});
      setAiLoading(false);
      setAiError(null);
      setAiSuccess(null);
      setBulkSaving(false);
      setBulkStatus('idle');
      return;
    }
    const sku = modalIngredient.sku;
    const controller = new AbortController();
    let cancelled = false;
    async function fetchMagentoNutrients() {
      setMagentoLoading(true);
      setMagentoError(null);
      try {
        const response = await fetch(MAGENTO_NUTRIENTS_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'fetch',
            sku,
          }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!payload?.ok) {
          throw new Error(
            payload?.error ||
              'Impossibile recuperare i valori nutrizionali da Magento.',
          );
        }
        if (cancelled) return;
        const nutrients =
          (payload?.data?.nutrients as Record<string, string | number>) ?? {};
        const mapped: Record<string, string> = {};
        for (const field of MAGENTO_NUTRIENT_FIELDS) {
          const raw =
            nutrients[field.key] ?? nutrients[field.key.toLowerCase()];
          mapped[field.key] =
            raw !== undefined && raw !== null ? String(raw) : '';
        }
        setMagentoValues(mapped);
        setUpdateState({});
      } catch (err) {
        if (!cancelled) {
          setMagentoError(
            err instanceof Error
              ? err.message
              : 'Errore inatteso durante il recupero dei dati.',
          );
        }
      } finally {
        if (!cancelled) setMagentoLoading(false);
      }
    }
    fetchMagentoNutrients();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [modalIngredient]);

  useEffect(() => {
    if (!modalIngredient) return undefined;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModalIngredient(null);
      }
    };
    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [modalIngredient]);

  const handleMagentoValueChange = (key: string, value: string) => {
    setMagentoValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    setUpdateState((prev) => {
      if (!prev[key] || prev[key] === 'idle') return prev;
      return { ...prev, [key]: 'idle' };
    });
  };

  const handleMagentoSave = async (key: string) => {
    if (!modalIngredient) return;
    const sku = modalIngredient.sku;
    setUpdateState((prev) => ({ ...prev, [key]: 'saving' }));
    try {
      const response = await fetch(MAGENTO_NUTRIENTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_attr',
          sku,
          attr: key,
          val: magentoValues[key] ?? '',
        }),
      });
      const payload = await response.json();
      if (!payload?.ok) {
        throw new Error(payload?.error || 'Aggiornamento non riuscito.');
      }
      setUpdateState((prev) => ({ ...prev, [key]: 'ok' }));
      setTimeout(() => {
        setUpdateState((prev) => ({ ...prev, [key]: 'idle' }));
      }, 2500);
    } catch (err) {
      console.error(err);
      setUpdateState((prev) => ({ ...prev, [key]: 'error' }));
    }
  };

  const handleAiEstimate = async () => {
    if (!modalIngredient) return;
    const ingredientMeta = modalIngredient as Record<string, unknown>;
    const description =
      typeof ingredientMeta.description === 'string'
        ? ingredientMeta.description
        : undefined;
    const notes =
      typeof ingredientMeta.notes === 'string'
        ? ingredientMeta.notes
        : undefined;
    setAiLoading(true);
    setAiError(null);
    setAiSuccess(null);
    try {
      const response = await fetch(MAGENTO_NUTRIENTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'estimate_ai',
          sku: modalIngredient.sku,
          name: modalIngredient.name,
          description,
          notes: notes ?? recipe?.name,
          context: {
            ingredientQty:
              selectedBreakdown?.qty ?? modalIngredient.qtyOriginal,
            isPowderIngredient: Boolean(modalIngredient.isPowderIngredient),
            recipeId: recipe?.id,
            recipeName: recipe?.name,
          },
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        data?: { nutrients?: Record<string, string | number> };
      };
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Stima AI non riuscita.');
      }
      const estimated = payload?.data?.nutrients ?? {};
      const updates: Record<string, string> = {};
      let applied = false;
      for (const field of MAGENTO_NUTRIENT_FIELDS) {
        const incoming = estimated[field.key];
        if (incoming === undefined || incoming === null || incoming === '') {
          continue;
        }
        updates[field.key] = incoming.toString();
        applied = true;
      }
      if (!applied) {
        setAiError(
          'La risposta AI non contiene valori utilizzabili. Riprova con una descrizione più dettagliata.',
        );
      } else {
        setMagentoValues((prev) => ({
          ...prev,
          ...updates,
        }));
        setAiSuccess('Valori stimati. Controlla e salva se coerenti.');
      }
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : 'Stima AI non riuscita.',
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleBulkSave = async () => {
    if (!modalIngredient) return;
    const entries = MAGENTO_NUTRIENT_FIELDS.map(({ key }) => ({
      attr: key,
      val: magentoValues[key],
    })).filter(
      (entry) =>
        entry.val !== undefined && entry.val !== null && entry.val !== '',
    );

    if (!entries.length) {
      setAiError('Compila almeno un valore prima del salvataggio massivo.');
      return;
    }

    setBulkSaving(true);
    setAiError(null);
    setAiSuccess(null);
    setBulkStatus('idle');
    try {
      const response = await fetch(MAGENTO_NUTRIENTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bulk_update',
          sku: modalIngredient.sku,
          entries,
        }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
      };
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Salvataggio massivo non riuscito.');
      }
      setBulkStatus('ok');
      setTimeout(() => setBulkStatus('idle'), 2500);
      setUpdateState({});
    } catch (error) {
      setBulkStatus('error');
      setAiError(
        error instanceof Error ? error.message : 'Salvataggio massivo fallito.',
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const containerClass =
    layout === 'standalone'
      ? 'scrollbar-elegant mx-auto flex min-h-screen max-w-5xl flex-col gap-6 overflow-y-auto bg-zinc-950 p-6'
      : 'flex flex-col gap-6';

  if (loading) {
    return layout === 'standalone' ? (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
        <p className="text-sm text-gray-400">Loading nutrition data…</p>
      </div>
    ) : (
      <p className="text-sm text-gray-400">Loading nutrition data…</p>
    );
  }

  if (error) {
    const errorBlock = (
      <div className="rounded border border-red-500/40 bg-red-500/10 px-6 py-4 text-sm text-red-200">
        <p className="font-semibold">Failed to load recipe data</p>
        <p className="mt-1 text-xs opacity-80">{error}</p>
      </div>
    );
    return layout === 'standalone' ? (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
        {errorBlock}
      </div>
    ) : (
      errorBlock
    );
  }

  if (!recipe || !totals || !perHundred) {
    const message = (
      <p className="text-sm text-gray-400">
        Unable to compute nutrition values for recipe {recipeId}.
      </p>
    );
    return layout === 'standalone' ? (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-200">
        {message}
      </div>
    ) : (
      message
    );
  }

  const recipeTotalQty = recipe.totalQtyForRecipe ?? 0;
  const recipeWaterPercent = recipe.waterPercent ?? 0;

  return (
    <div className={containerClass}>
      {layout === 'standalone' && (
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Nutrition Testbed – Recipe {recipe.id}
          </h1>
          <p className="mt-1 text-sm text-gray-400">{recipe.name}</p>
        </div>
      )}

      <Section title="Input Totals (per ricetta)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-gray-800 bg-gray-900 p-4 text-sm text-gray-200">
            <div className="font-semibold">Massa ricetta</div>
            <div>
              Impasto totale: {recipeTotalQty.toLocaleString('it-IT')} g
            </div>
            <div>
              Percentuale acqua crudo:{' '}
              {recipeWaterPercent.toLocaleString('it-IT')}%
            </div>
            <div>
              Solidi totali (dry mass):{' '}
              {perHundred.dryMass.toLocaleString('it-IT')} g
            </div>
          </div>

          <div className="rounded border border-gray-800 bg-gray-900 p-4 text-sm">
            <div className="font-semibold text-gray-200">
              Energia (ricetta intera)
            </div>
            <div className="mt-2 space-y-1 text-gray-300">
              <div>
                Kcal dichiarate:{' '}
                {Number(totals.kcal ?? 0).toLocaleString('it-IT', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                Kcal da carboidrati/proteine:{' '}
                {(
                  (Number(totals.carbo ?? 0) + Number(totals.protein ?? 0)) *
                  4
                ).toLocaleString('it-IT', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div>
                Kcal da grassi:{' '}
                {(Number(totals.fat ?? 0) * 9).toLocaleString('it-IT', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Breakdown ingredienti">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border border-gray-800 text-left text-xs text-gray-200 md:text-sm">
            <thead className="bg-gray-800">
              <tr>
                <th className="w-24 px-3 py-2">SKU</th>
                <th className="w-64 px-3 py-2">Ingrediente</th>
                <th className="w-28 px-3 py-2 text-right">Qty (g)</th>
                {NUTRITION_FIELDS.map(({ key, label }) => (
                  <th key={key} className="px-3 py-2 text-right">
                    {label} (ricetta)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ingredientBreakdown.map(({ ingredient, qty, perRecipe }) => (
                <tr key={ingredient.id} className="odd:bg-gray-950/40">
                  <td className="px-3 py-2 text-gray-300">{ingredient.sku}</td>
                  <td className="px-3 py-2 text-gray-100">{ingredient.name}</td>
                  <td className="px-3 py-2 text-right text-gray-200">
                    {qty.toLocaleString('it-IT', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  {NUTRITION_FIELDS.map(({ key }) => (
                    <td
                      key={key}
                      className="px-3 py-2 text-right text-gray-200"
                    >
                      {Number(perRecipe[key] ?? 0).toLocaleString('it-IT', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 3,
                      })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Per 100 g (acqua sottratta)">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border border-gray-800 text-left text-sm text-gray-200">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-3 py-2">Voce</th>
                <th className="px-3 py-2 text-right">Per 100 g</th>
              </tr>
            </thead>
            <tbody>
              {NUTRITION_FIELDS.map(({ key, label }) => (
                <tr key={key} className="odd:bg-gray-950/40">
                  <td className="px-3 py-2">{label}</td>
                  <td className="px-3 py-2 text-right">
                    {Number(perHundred.per100g[key] ?? 0).toLocaleString(
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

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-gray-800 bg-gray-900 p-4 text-sm text-gray-200">
            <div className="font-semibold">Massa di riferimento</div>
            <div className="mt-2 space-y-1 text-gray-300">
              <div>
                Impasto totale: {recipeTotalQty.toLocaleString('it-IT')} g
              </div>
              <div>
                Acqua sottratta: {waterMass.toLocaleString('it-IT')} g
                {recipeTotalQty
                  ? ` (${((waterMass / recipeTotalQty) * 100).toFixed(2)}%)`
                  : ''}
              </div>
              <div>
                Solidi (dry mass): {perHundred.dryMass.toLocaleString('it-IT')}{' '}
                g
              </div>
            </div>
          </div>

          <div
            className={`rounded border border-gray-800 bg-gray-900 p-4 text-sm ${perHundred.kcalCheck.isValid ? 'text-gray-200' : 'text-red-200'}`}
          >
            <div className="font-semibold text-gray-100">
              Controllo energia (≤ {perHundred.kcalCheck.tolerance}% )
            </div>
            <div className="mt-2 space-y-1 text-current">
              <div>
                Kcal teoriche (4-4-9):{' '}
                {perHundred.kcalCheck.theoretical.toFixed(2)}
              </div>
              <div>
                Kcal dichiarate: {perHundred.kcalCheck.declared.toFixed(2)}
              </div>
              <div>
                Delta%: {perHundred.kcalCheck.deltaPercent.toFixed(2)}%{' '}
                {perHundred.kcalCheck.isValid ? (
                  <span className="text-green-400">OK</span>
                ) : (
                  <span className="text-red-400">FUORI RANGE</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {modalIngredient && selectedBreakdown && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-zinc-950 shadow-2xl"
            style={{ maxHeight: '90vh' }}
          >
            <div className="flex items-start justify-between border-b border-gray-800 px-6 py-4">
              <div>
                <p className="text-xs tracking-wide text-gray-500 uppercase">
                  Magento SKU {modalIngredient.sku}
                </p>
                <h2 className="text-xl font-semibold text-white">
                  {modalIngredient.name}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close modal"
                className="rounded-full border border-gray-700 p-1 text-gray-400 hover:border-gray-500 hover:text-gray-100"
                onClick={() => setModalIngredient(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grow overflow-y-auto px-6 py-4 text-sm text-gray-200">
              <div className="mb-4 flex flex-wrap gap-6 text-xs text-gray-400">
                <span>
                  Qty per ricetta:{' '}
                  <strong className="text-gray-100">
                    {selectedBreakdown.qty.toLocaleString('it-IT', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 3,
                    })}{' '}
                    g
                  </strong>
                </span>
                <span>
                  Powder ingredient:{' '}
                  <strong className="text-gray-100">
                    {modalIngredient.isPowderIngredient ? 'Yes' : 'No'}
                  </strong>
                </span>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs tracking-wide text-gray-500 uppercase">
                      API bridge · /api/magento/nutrients
                    </p>
                    <h3 className="text-base font-semibold text-gray-100">
                      Valori Magento
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAiEstimate}
                      disabled={aiLoading || magentoLoading}
                      className="rounded-md border border-emerald-500/60 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {aiLoading ? 'Stima…' : 'Stima con AI'}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkSave}
                      disabled={bulkSaving || magentoLoading}
                      className="rounded-md border border-blue-500/60 px-4 py-2 text-xs font-semibold text-blue-200 transition hover:border-blue-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bulkSaving
                        ? 'Salvataggio…'
                        : bulkStatus === 'ok'
                          ? 'Salvato'
                          : 'Salva tutti'}
                    </button>
                    {magentoLoading ? (
                      <span className="text-xs text-gray-400">
                        Caricamento…
                      </span>
                    ) : null}
                  </div>
                </div>
                {aiError ? (
                  <div className="mb-3 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {aiError}
                  </div>
                ) : null}
                {aiSuccess ? (
                  <div className="mb-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    {aiSuccess}
                  </div>
                ) : null}
                {bulkStatus === 'ok' && !aiSuccess ? (
                  <div className="mb-3 rounded border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
                    Valori aggiornati in Magento.
                  </div>
                ) : null}
                {magentoError ? (
                  <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {magentoError}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full table-fixed text-left text-xs text-gray-200">
                      <thead className="bg-gray-900/60 text-gray-400">
                        <tr>
                          <th className="px-3 py-2">Campo</th>
                          <th className="px-3 py-2 text-right">Valore</th>
                          <th className="px-3 py-2 text-right">Unità</th>
                          <th className="px-3 py-2 text-right">Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MAGENTO_NUTRIENT_FIELDS.map(({ key, label, unit }) => {
                          const status = updateState[key] ?? 'idle';
                          return (
                            <tr key={key} className="odd:bg-gray-950/40">
                              <td className="px-3 py-2">{label}</td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.001"
                                  className="w-28 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                                  value={magentoValues[key] ?? ''}
                                  onChange={(event) =>
                                    handleMagentoValueChange(
                                      key,
                                      event.target.value,
                                    )
                                  }
                                />
                              </td>
                              <td className="px-3 py-2 text-right text-gray-400">
                                {unit}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleMagentoSave(key)}
                                  disabled={
                                    status === 'saving' || magentoLoading
                                  }
                                  className="rounded-md border border-blue-500/60 px-3 py-1 text-xs font-medium text-blue-200 transition hover:border-blue-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {status === 'saving'
                                    ? 'Salvataggio…'
                                    : status === 'ok'
                                      ? 'Salvato'
                                      : status === 'error'
                                        ? 'Riprova'
                                        : 'Aggiorna'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11px] text-gray-500">
                      I comandi passano da{' '}
                      <code className="rounded bg-black/40 px-1 py-px text-[10px] text-gray-300">
                        /api/magento/nutrients
                      </code>{' '}
                      che a sua volta chiama{' '}
                      <code>datasheet/nutrienti.php</code>.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-gray-500"
                  onClick={() => setModalIngredient(null)}
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
