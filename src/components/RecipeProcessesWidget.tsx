'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type {
  Process,
  RecipeProcess,
  PermissionCapabilities,
  Production,
  ProcessCostType,
  RecipeCycleField,
  MagentoRecipe,
} from '@/types';
import { apiClient } from '@/helpers/api';
import { canView, canEdit } from '@/lib/permissions/check';
import { isAdminRole } from '@/constants/roles';
import { Button } from '@/components/Button';
import { ProcessTrackingModal } from './ProcessTrackingModal';
import { CostMultiSelect } from './CostMultiSelect';

// Available cost types for processes (includes both CostType and ParameterType consumptions)
const PROCESS_COST_TYPES: ProcessCostType[] = [
  'hourly_labor',
  'consumoForno',
  'consumoColatrice',
  'consumoImpastatrice',
  'consumoSaldatrice',
  'consumoConfezionatrice',
  'consumoBassima',
  'consumoMulino',
];

// Available cycle fields with labels
const CYCLE_FIELD_OPTIONS: Array<{ value: RecipeCycleField; label: string }> = [
  { value: 'numberOfPackages', label: 'Numero pacchetti' },
  { value: 'traysPerOvenLoad', label: 'Teglie/Infornate' },
  { value: 'numberOfOvenLoads', label: 'Numero infornate' },
  { value: 'totalQtyForRecipe', label: 'Quantità totale ricetta' },
  { value: 'traysCapacityKg', label: 'Capienza teglie' },
  { value: 'mixerCapacityKg', label: 'Capienza impastatrice' },
  { value: 'depositorCapacityKg', label: 'Capienza colatrice' },
  { value: 'packageWeight', label: 'Peso pacchetto' },
  { value: 'cookieWeightCookedG', label: 'Peso biscotto cotto (g)' },
  { value: 'numberOfCookies', label: 'Numero biscotti' },
  { value: 'numberOfTrays', label: 'Numero teglie' },
  { value: 'numberOfDepositorCycles', label: 'Numero cicli colatrice' },
  { value: 'numberOfMixingCycles', label: 'Numero impasti' },
  { value: 'boxCapacity', label: 'Capienza scatole' },
  { value: 'numberOfBoxes', label: 'Numero scatole' },
  { value: 'cartCapacity', label: 'Capienza carrelli' },
  { value: 'numberOfCarts', label: 'Numero carrelli' },
];

type RecipeProcessesWidgetProps = {
  recipeId: number;
  profileCapabilities?: PermissionCapabilities | null;
  roleLabel?: string | null;
  isOperatorView?: boolean;
  activeProduction?: Production | null;
};

const PROCESSES_CAPABILITY_ID = 'recipe.processes';

export function RecipeProcessesWidget({
  recipeId,
  profileCapabilities,
  roleLabel,
  isOperatorView = false,
  activeProduction,
}: RecipeProcessesWidgetProps) {
  const [allProcesses, setAllProcesses] = useState<Process[]>([]);
  const [recipeProcesses, setRecipeProcesses] = useState<RecipeProcess[]>([]);
  const [initialRecipeProcesses, setInitialRecipeProcesses] = useState<
    RecipeProcess[]
  >([]);
  const [recipeData, setRecipeData] = useState<MagentoRecipe | null>(null);
  const [inputValues, setInputValues] = useState<
    Record<
      number,
      {
        minutes: string;
        cycles: string;
        costTypes?: ProcessCostType[];
        cycleField?: string | null;
      }
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [_saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [processCosts, setProcessCosts] = useState<
    Array<{
      processId: number;
      processName: string;
      minutes: number;
      cycles: number;
      cost: number;
    }>
  >([]);
  const [margin, setMargin] = useState<string>('');

  const isAdmin = isAdminRole(roleLabel) || roleLabel === 'admin';
  const canViewProcesses =
    (isAdmin && !isOperatorView) ||
    canView(profileCapabilities, `${PROCESSES_CAPABILITY_ID}.view`);
  const canEditProcesses =
    (isAdmin && !isOperatorView) ||
    canEdit(profileCapabilities, `${PROCESSES_CAPABILITY_ID}.edit`);
  const canTrackProcesses =
    (isAdmin && !isOperatorView) ||
    canEdit(profileCapabilities, `${PROCESSES_CAPABILITY_ID}.tracking`);

  const fetchAllProcesses = useCallback(async () => {
    try {
      const response = (await apiClient.get('/api/recipes/processes')) as {
        processes: Process[];
      };
      setAllProcesses(response.processes || []);
    } catch {
      // Ignore errors
    }
  }, []);

  const fetchRecipeProcesses = useCallback(async () => {
    if (!recipeId || !canViewProcesses) return;
    try {
      setLoading(true);
      setError(null);
      const response = (await apiClient.get(
        `/api/recipes/${recipeId}/processes`,
      )) as { processes: RecipeProcess[] };
      const loaded = response.processes || [];
      setRecipeProcesses(loaded);
      // Store initial values for comparison
      if (initialRecipeProcesses.length === 0) {
        setInitialRecipeProcesses([...loaded]);
      }

      // Initialize input values
      const initialValues: Record<
        number,
        {
          minutes: string;
          cycles: string;
          costTypes?: ProcessCostType[];
          cycleField?: string | null;
        }
      > = {};
      loaded.forEach((rp) => {
        initialValues[rp.processId] = {
          minutes:
            rp.minutes !== undefined && rp.minutes !== null
              ? rp.minutes.toString()
              : '',
          cycles:
            rp.cycles !== undefined && rp.cycles !== null
              ? rp.cycles.toString()
              : '1',
          costTypes: rp.costTypes || [],
          cycleField: rp.cycleField || null,
        };
      });
      setInputValues(initialValues);
    } catch {
      setError('Errore nel caricamento dei processi');
    } finally {
      setLoading(false);
    }
  }, [recipeId, canViewProcesses, initialRecipeProcesses.length]);

  const fetchCosts = useCallback(async () => {
    if (!recipeId || !canViewProcesses) return;
    try {
      const response = (await apiClient.get(
        `/api/recipes/${recipeId}/processes/costs`,
      )) as { totalCost: number; processCosts: typeof processCosts };
      setTotalCost(response.totalCost || 0);
      setProcessCosts(response.processCosts || []);
    } catch {
      // Ignore errors
    }
  }, [recipeId, canViewProcesses]);

  const fetchRecipeData = useCallback(async () => {
    if (!recipeId || !canViewProcesses) return;
    try {
      const response = (await apiClient.get(`/api/recipes/${recipeId}`)) as {
        recipe: MagentoRecipe;
        ingredients?: unknown[];
        ovenTemperatures?: unknown[];
        mixingTimes?: unknown[];
        colatriceSettings?: unknown;
      };
      setRecipeData(response.recipe || null);
    } catch {
      // Ignore errors
    }
  }, [recipeId, canViewProcesses]);

  useEffect(() => {
    fetchAllProcesses();
  }, [fetchAllProcesses]);

  useEffect(() => {
    fetchRecipeProcesses();
  }, [fetchRecipeProcesses]);

  useEffect(() => {
    fetchRecipeData();
    // Refresh recipe data periodically to get updated values (reduced frequency for performance)
    const interval = setInterval(() => {
      fetchRecipeData();
    }, 30000); // Refresh every 30 seconds instead of 3 seconds
    return () => {
      clearInterval(interval);
    };
  }, [fetchRecipeData]);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  // Load margin from recipe data when it's available
  useEffect(() => {
    if (
      recipeData?.marginPercent !== undefined &&
      recipeData.marginPercent !== null
    ) {
      setMargin(recipeData.marginPercent.toString());
    }
  }, [recipeData?.marginPercent]);

  // Expose save function to parent component
  const saveProcesses = useCallback(async () => {
    if (!canEditProcesses) return;

    try {
      setSaving(true);
      setError(null);

      // Build processes array from all processes, using saved or input values
      const processesToSave = allProcesses.map((proc) => {
        const existing = recipeProcesses.find((rp) => rp.processId === proc.id);
        const inputValue = inputValues[proc.id];
        return {
          processId: proc.id,
          minutes:
            inputValue?.minutes !== undefined && inputValue.minutes !== ''
              ? parseFloat(inputValue.minutes) || 0
              : existing?.minutes || 0,
          cycles:
            inputValue?.cycles !== undefined
              ? parseInt(inputValue.cycles, 10) || 1
              : existing?.cycles || 1,
          costTypes:
            inputValue?.costTypes !== undefined
              ? inputValue.costTypes
              : existing?.costTypes || [],
          cycleField:
            inputValue?.cycleField !== undefined
              ? inputValue.cycleField
              : existing?.cycleField || null,
        };
      });

      await apiClient.put(`/api/recipes/${recipeId}/processes`, {
        processes: processesToSave,
      });

      await fetchRecipeProcesses();
      await fetchRecipeData();
      await fetchCosts();
      // Reset initial values after save
      const updated = (await apiClient.get(
        `/api/recipes/${recipeId}/processes`,
      )) as { processes: RecipeProcess[] };
      setInitialRecipeProcesses(updated.processes || []);
    } catch (e) {
      setError('Errore nel salvataggio dei processi');
      throw e; // Re-throw to let parent handle error
    } finally {
      setSaving(false);
    }
  }, [
    recipeId,
    canEditProcesses,
    allProcesses,
    recipeProcesses,
    inputValues,
    fetchRecipeProcesses,
    fetchRecipeData,
    fetchCosts,
  ]);

  // Check if there are unsaved changes in processes
  const hasUnsavedProcessChanges = useCallback(() => {
    // Compare current inputValues with initial recipeProcesses
    for (const proc of allProcesses) {
      const initial = initialRecipeProcesses.find(
        (rp) => rp.processId === proc.id,
      );
      const inputValue = inputValues[proc.id];

      // Get current values from input or initial
      const currentMinutes =
        inputValue?.minutes !== undefined && inputValue.minutes !== ''
          ? parseFloat(inputValue.minutes) || 0
          : initial?.minutes || 0;
      const currentCycles =
        inputValue?.cycles !== undefined
          ? parseInt(inputValue.cycles, 10) || 1
          : initial?.cycles || 1;
      const currentCostTypes =
        inputValue?.costTypes !== undefined
          ? inputValue.costTypes || []
          : initial?.costTypes || [];
      const currentCycleField =
        inputValue?.cycleField !== undefined
          ? inputValue.cycleField
          : initial?.cycleField || null;

      // Get initial values
      const initialMinutes = initial?.minutes || 0;
      const initialCycles = initial?.cycles || 1;
      const initialCostTypes = initial?.costTypes || [];
      const initialCycleField = initial?.cycleField || null;

      // Compare
      if (currentMinutes !== initialMinutes) {
        return true;
      }
      if (currentCycles !== initialCycles) {
        return true;
      }
      if (
        JSON.stringify(currentCostTypes.sort()) !==
        JSON.stringify(initialCostTypes.sort())
      ) {
        return true;
      }
      if (currentCycleField !== initialCycleField) {
        return true;
      }
    }
    return false;
  }, [allProcesses, initialRecipeProcesses, inputValues]);

  // Expose save function, hasUnsavedChanges, margin and selling price to parent via window (temporary solution)
  useEffect(() => {
    const costPerPackage =
      recipeData?.numberOfPackages && recipeData.numberOfPackages > 0
        ? totalCost / recipeData.numberOfPackages
        : 0;
    const marginValue = parseFloat(margin);
    const calculatedSellingPrice =
      costPerPackage > 0 &&
      !isNaN(marginValue) &&
      marginValue > 0 &&
      marginValue < 100
        ? costPerPackage / (1 - marginValue / 100)
        : 0;

    const windowObj = window as unknown as {
      saveRecipeProcesses?: () => Promise<void>;
      hasUnsavedProcessChanges?: () => boolean;
      recipeMargin?: string;
      recipeSellingPrice?: number;
    };

    windowObj.saveRecipeProcesses = saveProcesses;
    windowObj.hasUnsavedProcessChanges = hasUnsavedProcessChanges;
    windowObj.recipeMargin = margin;
    windowObj.recipeSellingPrice = calculatedSellingPrice;

    return () => {
      delete windowObj.saveRecipeProcesses;
      delete windowObj.hasUnsavedProcessChanges;
      delete windowObj.recipeMargin;
      delete windowObj.recipeSellingPrice;
    };
  }, [saveProcesses, hasUnsavedProcessChanges, margin, totalCost, recipeData]);

  const handleInputChange = useCallback(
    (
      processId: number,
      field: 'minutes' | 'cycles' | 'costTypes' | 'cycleField',
      value: string | null | ProcessCostType[],
    ) => {
      if (!canEditProcesses) return;
      setInputValues((prev) => {
        const newValues = {
          ...prev,
          [processId]: {
            ...prev[processId],
            [field]: value,
          },
        };
        // Trigger a re-render in parent by updating window function reference
        setTimeout(() => {
          const fn = hasUnsavedProcessChanges;
          if (fn) {
            (
              window as unknown as {
                hasUnsavedProcessChanges?: () => boolean;
              }
            ).hasUnsavedProcessChanges = fn;
            // Force parent to re-check by dispatching a custom event
            window.dispatchEvent(new Event('processesChanged'));
          }
        }, 0);
        return newValues;
      });
    },
    [canEditProcesses, hasUnsavedProcessChanges],
  );

  if (!canViewProcesses) {
    return null;
  }

  if (loading) {
    return <div className="p-4 text-center">Caricamento processi...</div>;
  }

  // Merge all processes with recipe values
  const processesToDisplay = allProcesses.map((proc) => {
    const recipeProcess = recipeProcesses.find(
      (rp) => rp.processId === proc.id,
    );
    const inputValue = inputValues[proc.id];
    const cost = processCosts.find((pc) => pc.processId === proc.id);

    return {
      ...proc,
      minutes:
        inputValue?.minutes !== undefined
          ? parseFloat(inputValue.minutes) || 0
          : recipeProcess?.minutes || 0,
      cycles:
        inputValue?.cycles !== undefined
          ? parseInt(inputValue.cycles, 10) || 1
          : recipeProcess?.cycles || 1,
      cost: cost?.cost || 0,
      inputMinutes:
        inputValue?.minutes !== undefined
          ? inputValue.minutes
          : recipeProcess?.minutes !== undefined &&
              recipeProcess.minutes !== null
            ? recipeProcess.minutes === 0
              ? '0'
              : recipeProcess.minutes.toString()
            : '0',
      inputCycles:
        inputValue?.cycles || recipeProcess?.cycles?.toString() || '1',
      costTypes:
        inputValue?.costTypes !== undefined
          ? inputValue.costTypes
          : recipeProcess?.costTypes || [],
      cycleField:
        inputValue?.cycleField !== undefined
          ? inputValue.cycleField
          : recipeProcess?.cycleField || null,
    };
  });

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {canEditProcesses && (
          <Button
            onClick={async () => {
              try {
                // Fetch default processes from API
                const res = await fetch('/api/parameters/process-defaults', {
                  credentials: 'include',
                  cache: 'no-store',
                });
                if (!res.ok) {
                  throw new Error('Failed to fetch process defaults');
                }
                const data = await res.json();
                const defaults = data.defaults || { processes: [] };

                if (!defaults.processes || defaults.processes.length === 0) {
                  if (typeof window !== 'undefined') {
                    window.alert(
                      'Nessun default disponibile. Carica prima i default dalla pagina Parametri Standard.',
                    );
                  }
                  return;
                }

                // Check if there are any empty processes
                const hasEmptyProcesses = processesToDisplay.some(
                  (proc) =>
                    !proc.inputMinutes ||
                    proc.inputMinutes === '0' ||
                    !proc.inputCycles ||
                    proc.inputCycles === '0' ||
                    !proc.costTypes ||
                    proc.costTypes.length === 0,
                );

                if (!hasEmptyProcesses) {
                  if (typeof window !== 'undefined') {
                    window.alert(
                      'Tutti i processi hanno valori. Non è possibile caricare i default.',
                    );
                  }
                  return;
                }

                if (
                  typeof window !== 'undefined' &&
                  window.confirm(
                    'Stai per caricare i valori di default per i processi vuoti. Continuare?',
                  )
                ) {
                  // Create a map of defaults by processId
                  const defaultsByProcessId = new Map<
                    number,
                    (typeof defaults.processes)[0]
                  >();
                  defaults.processes.forEach((def: { processId: number }) => {
                    defaultsByProcessId.set(def.processId, def);
                  });

                  // Set default values for empty processes
                  const newValues = { ...inputValues };
                  processesToDisplay.forEach((proc) => {
                    const defaultProc = defaultsByProcessId.get(proc.id);
                    if (defaultProc) {
                      if (!newValues[proc.id]) {
                        newValues[proc.id] = {
                          minutes: '',
                          cycles: '1',
                          costTypes: [],
                          cycleField: null,
                        };
                      }
                      // Only set if empty
                      if (
                        !newValues[proc.id].minutes ||
                        newValues[proc.id].minutes === '0'
                      ) {
                        newValues[proc.id].minutes =
                          defaultProc.minutes.toString();
                      }
                      if (
                        !newValues[proc.id].costTypes ||
                        newValues[proc.id].costTypes?.length === 0
                      ) {
                        newValues[proc.id].costTypes =
                          defaultProc.costTypes || ['hourly_labor'];
                      }
                      if (!newValues[proc.id].cycleField) {
                        newValues[proc.id].cycleField =
                          defaultProc.cycleField || 'singleCycle';
                      }
                    }
                  });
                  setInputValues(newValues);
                  // Trigger change event
                  setTimeout(() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new Event('processesChanged'));
                    }
                  }, 0);
                }
              } catch (error) {
                console.error('Failed to load process defaults:', error);
                if (typeof window !== 'undefined') {
                  window.alert(
                    'Errore nel caricamento dei default. Riprova più tardi.',
                  );
                }
              }
            }}
            variant="secondary"
          >
            Carica Parametri Default
          </Button>
        )}
        {canTrackProcesses && (
          <Button onClick={() => setShowTrackingModal(true)} variant="primary">
            Traccia lavorazione
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-gray-700">
              <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-900 dark:text-gray-100">
                Processo
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-900 dark:text-gray-100">
                Minuti
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-900 dark:text-gray-100">
                Costo associato
              </th>
              <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-900 dark:text-gray-100">
                Campo cicli
              </th>
              <th className="px-4 py-2 text-right text-sm font-semibold text-zinc-900 dark:text-gray-100">
                Costo (€)
              </th>
            </tr>
          </thead>
          <tbody>
            {processesToDisplay.map((proc) => (
              <tr
                key={proc.id}
                className="border-b border-zinc-100 dark:border-gray-800"
              >
                <td className="px-4 py-3 text-sm text-zinc-900 dark:text-gray-100">
                  {proc.name}
                </td>
                <td className="px-4 py-3">
                  {canEditProcesses ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={proc.inputMinutes}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleInputChange(proc.id, 'minutes', value);
                      }}
                      onBlur={(e) => {
                        // When blurring, ensure we have a valid number or empty string
                        const value = e.target.value;
                        if (value === '' || value === '.' || value === '-') {
                          handleInputChange(proc.id, 'minutes', '');
                        } else {
                          const numValue = parseFloat(value);
                          if (
                            !isNaN(numValue) &&
                            isFinite(numValue) &&
                            numValue >= 0
                          ) {
                            handleInputChange(
                              proc.id,
                              'minutes',
                              numValue.toString(),
                            );
                          }
                        }
                      }}
                      className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      disabled={!canEditProcesses}
                      placeholder="0"
                    />
                  ) : (
                    <span className="text-sm text-zinc-700 dark:text-gray-300">
                      {proc.minutes}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <CostMultiSelect
                    value={proc.costTypes}
                    onChange={(costTypes) =>
                      handleInputChange(proc.id, 'costTypes', costTypes)
                    }
                    availableCostTypes={PROCESS_COST_TYPES}
                    disabled={!canEditProcesses}
                    className="w-full"
                  />
                </td>
                <td className="px-4 py-3">
                  {canEditProcesses ? (
                    <select
                      value={proc.cycleField || ''}
                      onChange={(e) =>
                        handleInputChange(
                          proc.id,
                          'cycleField',
                          e.target.value || null,
                        )
                      }
                      className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      <option value="">Usa valore salvato</option>
                      <option value="singleCycle">1 Ciclo</option>
                      {CYCLE_FIELD_OPTIONS.map((option) => {
                        let displayValue: number | string = 0;
                        if (recipeData) {
                          if (option.value === 'numberOfCookies') {
                            // Calculate: totalQtyForRecipe / cookieWeightCookedG
                            const totalQty = recipeData.totalQtyForRecipe || 0;
                            const cookieWeight =
                              recipeData.cookieWeightCookedG || 0;
                            displayValue =
                              totalQty > 0 && cookieWeight > 0
                                ? Math.round(totalQty / cookieWeight)
                                : 0;
                          } else if (option.value === 'numberOfTrays') {
                            // Calculate: numberOfCookies / traysCapacityKg
                            const totalQty = recipeData.totalQtyForRecipe || 0;
                            const cookieWeight =
                              recipeData.cookieWeightCookedG || 0;
                            const traysCapacity =
                              recipeData.traysCapacityKg || 0;
                            if (
                              totalQty > 0 &&
                              cookieWeight > 0 &&
                              traysCapacity > 0
                            ) {
                              const cookiesCount = Math.round(
                                totalQty / cookieWeight,
                              );
                              displayValue = Math.round(
                                cookiesCount / traysCapacity,
                              );
                            } else {
                              displayValue = 0;
                            }
                          } else if (option.value === 'numberOfMixingCycles') {
                            // Calculate: totalQtyForRecipe (kg) / mixerCapacityKg
                            const totalQtyKg =
                              (recipeData.totalQtyForRecipe || 0) / 1000;
                            const mixerCapacity =
                              recipeData.mixerCapacityKg || 0;
                            displayValue =
                              totalQtyKg > 0 && mixerCapacity > 0
                                ? Math.round(totalQtyKg / mixerCapacity)
                                : 0;
                          } else if (
                            option.value === 'numberOfDepositorCycles'
                          ) {
                            // Calculate: totalQtyForRecipe (kg) / depositorCapacityKg
                            const totalQtyKg =
                              (recipeData.totalQtyForRecipe || 0) / 1000;
                            const depositorCapacity =
                              recipeData.depositorCapacityKg || 0;
                            displayValue =
                              totalQtyKg > 0 && depositorCapacity > 0
                                ? Math.round(totalQtyKg / depositorCapacity)
                                : 0;
                          } else if (option.value === 'numberOfOvenLoads') {
                            // Calculate: traysCount / traysPerOvenLoad
                            const totalQty = recipeData.totalQtyForRecipe || 0;
                            const cookieWeight =
                              recipeData.cookieWeightCookedG || 0;
                            const traysCapacity =
                              recipeData.traysCapacityKg || 0;
                            const traysPerOven =
                              recipeData.traysPerOvenLoad || 0;
                            if (
                              totalQty > 0 &&
                              cookieWeight > 0 &&
                              traysCapacity > 0 &&
                              traysPerOven > 0
                            ) {
                              const cookiesCount = Math.round(
                                totalQty / cookieWeight,
                              );
                              const traysCount = Math.round(
                                cookiesCount / traysCapacity,
                              );
                              displayValue = Math.round(
                                traysCount / traysPerOven,
                              );
                            } else {
                              displayValue = 0;
                            }
                          } else if (option.value === 'numberOfBoxes') {
                            // Calculate: numberOfPackages / boxCapacity
                            const numberOfPackages =
                              recipeData.numberOfPackages || 0;
                            const boxCapacity = recipeData.boxCapacity || 0;
                            if (numberOfPackages > 0 && boxCapacity > 0) {
                              displayValue = Math.round(
                                numberOfPackages / boxCapacity,
                              );
                            } else {
                              displayValue = 0;
                            }
                          } else if (option.value === 'numberOfCarts') {
                            // Calculate: numberOfTrays / cartCapacity
                            // First calculate numberOfTrays: numberOfCookies / traysCapacityKg
                            const totalQty = recipeData.totalQtyForRecipe || 0;
                            const cookieWeight =
                              recipeData.cookieWeightCookedG || 0;
                            const traysCapacity =
                              recipeData.traysCapacityKg || 0;
                            const cartCapacity = recipeData.cartCapacity || 0;
                            if (
                              totalQty > 0 &&
                              cookieWeight > 0 &&
                              traysCapacity > 0 &&
                              cartCapacity > 0
                            ) {
                              const cookiesCount = Math.round(
                                totalQty / cookieWeight,
                              );
                              const traysCount = Math.round(
                                cookiesCount / traysCapacity,
                              );
                              displayValue = Math.round(
                                traysCount / cartCapacity,
                              );
                            } else {
                              displayValue = 0;
                            }
                          } else if (option.value === 'singleCycle') {
                            displayValue = 1;
                          } else {
                            displayValue =
                              (recipeData[
                                option.value as keyof MagentoRecipe
                              ] as number) || 0;
                          }
                        }
                        return (
                          <option key={option.value} value={option.value}>
                            {option.label} ({displayValue})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <span className="text-sm text-zinc-700 dark:text-gray-300">
                      {proc.cycleField === 'singleCycle'
                        ? '1 Ciclo'
                        : proc.cycleField
                          ? CYCLE_FIELD_OPTIONS.find(
                              (o) => o.value === proc.cycleField,
                            )?.label || proc.cycleField
                          : '-'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-sm text-zinc-700 dark:text-gray-300">
                  {proc.cost.toFixed(2)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-300 font-semibold dark:border-gray-600">
              <td
                colSpan={4}
                className="px-4 py-3 text-right text-sm text-zinc-900 dark:text-gray-100"
              >
                Totale:
              </td>
              <td className="px-4 py-3 text-right text-sm text-zinc-900 dark:text-gray-100">
                {totalCost.toFixed(2)} €
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals and Pricing Section */}
      <div className="mt-6 rounded-lg border border-zinc-300 bg-white p-4 dark:border-gray-600 dark:bg-zinc-800">
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-gray-100">
          Totali e Prezzo di Vendita
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* Total Cost */}
          <div>
            <div className="mb-1 block text-sm font-medium text-zinc-700 dark:text-gray-300">
              Totale Costi
            </div>
            <div className="rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100">
              {totalCost.toFixed(2)} €
            </div>
          </div>

          {/* Cost per Package */}
          <div>
            <div className="mb-1 block text-sm font-medium text-zinc-700 dark:text-gray-300">
              Costo per Pacchetto
            </div>
            <div className="rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100">
              {recipeData?.numberOfPackages && recipeData.numberOfPackages > 0
                ? (totalCost / recipeData.numberOfPackages).toFixed(2)
                : '0.00'}{' '}
              €
            </div>
          </div>

          {/* Margin Input */}
          <div>
            <label
              htmlFor="margin-input"
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-gray-300"
            >
              Margine (%)
            </label>
            <input
              id="margin-input"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={margin}
              onChange={(e) => {
                setMargin(e.target.value);
                // Trigger change event to notify parent
                setTimeout(() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('processesChanged'));
                  }
                }, 0);
              }}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100"
              placeholder="50"
            />
          </div>

          {/* Selling Price */}
          <div>
            <div className="mb-1 block text-sm font-medium text-zinc-700 dark:text-gray-300">
              Prezzo di Vendita
            </div>
            <div className="rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-900 dark:border-gray-600 dark:bg-zinc-900 dark:text-gray-100">
              {(() => {
                const costPerPackage =
                  recipeData?.numberOfPackages &&
                  recipeData.numberOfPackages > 0
                    ? totalCost / recipeData.numberOfPackages
                    : 0;
                const marginValue = parseFloat(margin);
                if (
                  costPerPackage > 0 &&
                  !isNaN(marginValue) &&
                  marginValue > 0 &&
                  marginValue < 100
                ) {
                  // Formula: costo / (1 - margine / 100)
                  // Example: 4.70 / (1 - 20/100) = 4.70 / 0.8 = 5.875
                  const calculatedSellingPrice =
                    costPerPackage / (1 - marginValue / 100);
                  return calculatedSellingPrice.toFixed(2);
                }
                return '0.00';
              })()}{' '}
              €
            </div>
          </div>
        </div>
      </div>

      {showTrackingModal && (
        <ProcessTrackingModal
          recipeId={recipeId}
          processes={allProcesses}
          onClose={() => setShowTrackingModal(false)}
          activeProduction={activeProduction}
        />
      )}
    </div>
  );
}
