'use client';

import React from 'react';
import type { MagentoRecipe, MagentoRecipeIngredient } from '@/types';

type RecipeVersionDiffProps = {
  currentRecipe: MagentoRecipe;
  selectedVersionRecipe: MagentoRecipe;
  currentIngredients: MagentoRecipeIngredient[];
  selectedVersionIngredients: MagentoRecipeIngredient[];
};

type FieldDiff = {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  label: string;
};

function hasChanged(oldVal: unknown, newVal: unknown): boolean {
  if (oldVal === newVal) return false;
  if (oldVal === null || oldVal === undefined) {
    return newVal !== null && newVal !== undefined;
  }
  if (newVal === null || newVal === undefined) {
    return oldVal !== null && oldVal !== undefined;
  }
  if (typeof oldVal === 'number' && typeof newVal === 'number') {
    return Math.abs(oldVal - newVal) > 0.0001;
  }
  if (typeof oldVal === 'object' && typeof newVal === 'object') {
    return JSON.stringify(oldVal) !== JSON.stringify(newVal);
  }
  return String(oldVal) !== String(newVal);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') {
    return value.toLocaleString('it-IT', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === 'boolean') {
    return value ? 'Sì' : 'No';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function RecipeVersionDiff({
  currentRecipe,
  selectedVersionRecipe,
  currentIngredients,
  selectedVersionIngredients,
}: RecipeVersionDiffProps) {
  // Compare recipe fields
  const recipeFields: FieldDiff[] = [];
  const recipeFieldLabels: Record<string, string> = {
    name: 'Nome ricetta',
    packageWeight: 'Peso confezione (g)',
    numberOfPackages: 'Numero pacchetti',
    wastePercent: 'Waste %',
    waterPercent: 'Water %',
    totalQtyForRecipe: 'Totale qty per ricetta (g)',
    timeMinutes: 'Tempo cottura (min)',
    temperatureCelsius: 'Temperatura (°C)',
    heightCm: 'Altezza (cm)',
    widthCm: 'Larghezza (cm)',
    lengthCm: 'Lunghezza (cm)',
    cookieWeightCookedG: 'Peso biscotto cotto (g)',
    mixerCapacityKg: 'Capienza impastatrice (kg)',
    traysCapacityKg: 'Capienza teglie',
    depositorCapacityKg: 'Capienza colatrice (kg)',
    traysPerOvenLoad: 'Teglie/Infornate',
    steamMinutes: 'Vapore (min)',
    valveOpenMinutes: 'Valvola aperta (min)',
    valveCloseMinutes: 'Valvola chiusa (min)',
    glutenTestDone: 'Test glutine fatto',
    lot: 'Lotto',
    notes: 'Note',
  };

  for (const [key, label] of Object.entries(recipeFieldLabels)) {
    const oldVal = (selectedVersionRecipe as Record<string, unknown>)[key];
    const newVal = (currentRecipe as Record<string, unknown>)[key];
    // Skip if both are null/undefined/empty
    if (
      (oldVal === null || oldVal === undefined || oldVal === '') &&
      (newVal === null || newVal === undefined || newVal === '')
    ) {
      continue;
    }
    if (hasChanged(oldVal, newVal)) {
      recipeFields.push({
        field: key,
        oldValue: oldVal,
        newValue: newVal,
        label,
      });
    }
  }

  // Compare colatriceSettings if present
  if (
    selectedVersionRecipe.colatriceSettings ||
    currentRecipe.colatriceSettings
  ) {
    const oldSettings = selectedVersionRecipe.colatriceSettings
      ? JSON.parse(
          typeof selectedVersionRecipe.colatriceSettings === 'string'
            ? selectedVersionRecipe.colatriceSettings
            : JSON.stringify(selectedVersionRecipe.colatriceSettings),
        )
      : null;
    const newSettings = currentRecipe.colatriceSettings
      ? JSON.parse(
          typeof currentRecipe.colatriceSettings === 'string'
            ? currentRecipe.colatriceSettings
            : JSON.stringify(currentRecipe.colatriceSettings),
        )
      : null;

    if (hasChanged(oldSettings, newSettings)) {
      recipeFields.push({
        field: 'colatriceSettings',
        oldValue: oldSettings,
        newValue: newSettings,
        label: 'Setting Colatrice',
      });
    }
  }

  // Compare ingredients
  const ingredientDiffs: Array<{
    type: 'added' | 'removed' | 'modified';
    sku: string;
    name: string;
    changes?: FieldDiff[];
  }> = [];

  // Find added ingredients
  for (const currentIng of currentIngredients) {
    const versionIng = selectedVersionIngredients.find(
      (ing) => ing.sku === currentIng.sku,
    );
    if (!versionIng) {
      ingredientDiffs.push({
        type: 'added',
        sku: currentIng.sku,
        name: currentIng.name,
      });
    }
  }

  // Find removed ingredients
  for (const versionIng of selectedVersionIngredients) {
    const currentIng = currentIngredients.find(
      (ing) => ing.sku === versionIng.sku,
    );
    if (!currentIng) {
      ingredientDiffs.push({
        type: 'removed',
        sku: versionIng.sku,
        name: versionIng.name,
      });
    }
  }

  // Find modified ingredients
  for (const currentIng of currentIngredients) {
    const versionIng = selectedVersionIngredients.find(
      (ing) => ing.sku === currentIng.sku,
    );
    if (versionIng) {
      const changes: FieldDiff[] = [];
      const ingredientFieldLabels: Record<string, string> = {
        name: 'Nome',
        qtyOriginal: 'Qty originale (g)',
        qtyForRecipe: 'Qty per ricetta (g)',
        priceCostPerKg: 'Prezzo €/kg',
        isPowderIngredient: 'È polvere',
        supplier: 'Fornitore',
        warehouseLocation: 'Posizione magazzino',
        mpSku: 'MP SKU',
        productName: 'Nome prodotto',
        lot: 'Lotto',
        checkGlutine: 'Check glutine',
      };

      for (const [key, label] of Object.entries(ingredientFieldLabels)) {
        const oldVal = (versionIng as Record<string, unknown>)[key];
        const newVal = (currentIng as Record<string, unknown>)[key];
        // Skip if both are null/undefined/empty
        if (
          (oldVal === null || oldVal === undefined || oldVal === '') &&
          (newVal === null || newVal === undefined || newVal === '')
        ) {
          continue;
        }
        if (hasChanged(oldVal, newVal)) {
          changes.push({
            field: key,
            oldValue: oldVal,
            newValue: newVal,
            label,
          });
        }
      }

      if (changes.length > 0) {
        ingredientDiffs.push({
          type: 'modified',
          sku: currentIng.sku,
          name: currentIng.name,
          changes,
        });
      }
    }
  }

  if (recipeFields.length === 0 && ingredientDiffs.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
        Nessuna differenza trovata tra la versione selezionata e la versione
        corrente.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {recipeFields.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Campi ricetta modificati
          </h3>
          <div className="space-y-2">
            {recipeFields.map((diff) => (
              <div
                key={diff.field}
                className="rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20"
              >
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {diff.label}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Versione selezionata:
                    </span>{' '}
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatValue(diff.oldValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Versione corrente:
                    </span>{' '}
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatValue(diff.newValue)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ingredientDiffs.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Ingredienti modificati
          </h3>
          <div className="space-y-3">
            {ingredientDiffs.map((diff, index) => (
              <div
                key={`${diff.sku}-${index}`}
                className={`rounded-md border p-3 ${
                  diff.type === 'added'
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : diff.type === 'removed'
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                      : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      diff.type === 'added'
                        ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                        : diff.type === 'removed'
                          ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                          : 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                    }`}
                  >
                    {diff.type === 'added'
                      ? 'Aggiunto'
                      : diff.type === 'removed'
                        ? 'Rimosso'
                        : 'Modificato'}
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {diff.name} ({diff.sku})
                  </span>
                </div>
                {diff.changes && diff.changes.length > 0 && (
                  <div className="mt-2 space-y-1 pl-4">
                    {diff.changes.map((change) => (
                      <div
                        key={change.field}
                        className="text-sm text-zinc-700 dark:text-zinc-300"
                      >
                        <span className="font-medium">{change.label}:</span>{' '}
                        <span className="text-red-600 dark:text-red-400">
                          {formatValue(change.oldValue)}
                        </span>{' '}
                        →{' '}
                        <span className="text-green-600 dark:text-green-400">
                          {formatValue(change.newValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
