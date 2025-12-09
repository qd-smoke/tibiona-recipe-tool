'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type {
  StandardParameter,
  ParameterType,
  PermissionCapabilities,
} from '@/types';
import { PARAMETER_TYPE_LABELS } from '@/types';
import { canView, canEdit } from '@/lib/permissions/check';
import { useOperatorView } from '@/contexts/OperatorViewContext';
import { useSetToast } from '@/state/ToastProvider';
import { CostMultiSelect } from '@/components/CostMultiSelect';
import type { ProcessCostType } from '@/types';

// Available cost types for processes (same as RecipeProcessesWidget)
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

const STANDARD_PARAMETERS_CAPABILITY_ID = 'admin.parameters.standard';

export default function StandardParametersPage() {
  const router = useRouter();
  const _setToast = useSetToast();
  const [parameters, setParameters] = useState<StandardParameter[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    capabilities?: PermissionCapabilities;
  } | null>(null);
  const [colatriceDefaults, setColatriceDefaults] = useState<
    Record<string, Record<string, number>>
  >({});
  const [colatriceInputValues, setColatriceInputValues] = useState<
    Record<string, Record<string, string>>
  >({});
  const [processDefaults, setProcessDefaults] = useState<{
    processes: Array<{
      processId: number;
      minutes: number;
      cycles: number;
      costTypes?: string[];
      cycleField?: string | null;
    }>;
  }>({ processes: [] });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) {
          router.replace('/login');
          return;
        }
        const data = await res.json();
        if (data.ok && data.data) {
          setProfile({ capabilities: data.data.capabilities });
        }
      } catch (e) {
        console.error('Auth check failed', e);
        router.replace('/login');
      }
    };
    checkAuth();
  }, [router]);

  const { getEffectiveCapabilities } = useOperatorView();
  const effectiveCapabilities = getEffectiveCapabilities(profile?.capabilities);

  const canViewParameters = canView(
    effectiveCapabilities,
    STANDARD_PARAMETERS_CAPABILITY_ID,
  );
  const canEditParameters = canEdit(
    effectiveCapabilities,
    STANDARD_PARAMETERS_CAPABILITY_ID,
  );

  const fetchParameters = useCallback(async () => {
    if (!canViewParameters) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/parameters/standard', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch standard parameters');
      }
      const data = await res.json();
      const loadedParameters = data.parameters || [];
      setParameters(loadedParameters);
      // Inizializza i valori di input
      const initialInputValues: Record<string, string> = {};
      loadedParameters.forEach((param: StandardParameter) => {
        initialInputValues[param.parameterType] =
          param.value === 0 || param.value === null || param.value === undefined
            ? '0'
            : param.value.toString();
      });
      setInputValues(initialInputValues);
    } catch (e) {
      console.error('Failed to fetch parameters', e);
      setError('Errore nel caricamento dei parametri standard');
    } finally {
      setLoading(false);
    }
  }, [canViewParameters]);

  useEffect(() => {
    fetchParameters();
  }, [fetchParameters]);

  const fetchColatriceDefaults = useCallback(async () => {
    try {
      const res = await fetch('/api/parameters/colatrice-defaults', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch colatrice defaults');
      }
      const data = await res.json();
      const defaults = data.defaults || {};
      // Ensure defaults always have the structure, even if empty
      // Initialize with empty structure for each page if defaults is empty
      if (Object.keys(defaults).length === 0) {
        defaults.schermata_1 = {};
        defaults.schermata_2 = {};
        defaults.schermata_3 = {};
        defaults.tower_drop_easy_access = {};
      }
      // Always set defaults (API returns hardcoded defaults if DB is empty)
      setColatriceDefaults(defaults);
      // Initialize input values
      const initialInputValues: Record<string, Record<string, string>> = {};
      Object.keys(defaults).forEach((pageKey) => {
        initialInputValues[pageKey] = {};
        Object.keys(defaults[pageKey] || {}).forEach((fieldKey) => {
          const value = defaults[pageKey][fieldKey];
          initialInputValues[pageKey][fieldKey] =
            value === 0 || value === null || value === undefined
              ? '0'
              : value.toString();
        });
      });
      setColatriceInputValues(initialInputValues);
    } catch {
      // Failed to fetch defaults, will use empty object
    }
  }, []);

  useEffect(() => {
    if (canViewParameters) {
      fetchColatriceDefaults();
    }
  }, [canViewParameters, fetchColatriceDefaults]);

  const [processNames, setProcessNames] = useState<Record<number, string>>({});

  const fetchProcessDefaults = useCallback(async () => {
    try {
      // Fetch process names first
      const processesRes = await fetch('/api/recipes/processes', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (processesRes.ok) {
        const processesData = await processesRes.json();
        const namesMap: Record<number, string> = {};
        if (processesData.processes) {
          processesData.processes.forEach(
            (proc: { id: number; name: string }) => {
              namesMap[proc.id] = proc.name;
            },
          );
        }
        setProcessNames(namesMap);
      }

      // Fetch process defaults
      const res = await fetch('/api/parameters/process-defaults', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch process defaults');
      }
      const data = await res.json();
      const defaults = data.defaults || { processes: [] };
      setProcessDefaults(defaults);
    } catch {
      // Failed to fetch defaults, will use empty
    }
  }, []);

  useEffect(() => {
    if (canViewParameters) {
      fetchProcessDefaults();
    }
  }, [canViewParameters, fetchProcessDefaults]);

  const handleColatriceDefaultChange = useCallback(
    (pageKey: string, fieldKey: string, inputValue: string) => {
      if (!canEditParameters) return;
      setColatriceInputValues((prev) => ({
        ...prev,
        [pageKey]: {
          ...prev[pageKey],
          [fieldKey]: inputValue,
        },
      }));
      if (inputValue === '' || inputValue === '.') {
        setColatriceDefaults((prev) => ({
          ...prev,
          [pageKey]: {
            ...prev[pageKey],
            [fieldKey]: 0,
          },
        }));
        return;
      }
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue) && isFinite(numValue)) {
        setColatriceDefaults((prev) => ({
          ...prev,
          [pageKey]: {
            ...prev[pageKey],
            [fieldKey]: numValue,
          },
        }));
      }
    },
    [canEditParameters],
  );

  const handleParameterChange = useCallback(
    (parameterType: string, inputValue: string) => {
      if (!canEditParameters) return;
      // Aggiorna il valore dell'input durante la digitazione
      setInputValues((prev) => ({ ...prev, [parameterType]: inputValue }));
      // Se il valore è vuoto o solo un punto, imposta a 0
      if (inputValue === '' || inputValue === '.') {
        setParameters((prev) =>
          prev.map((param) =>
            param.parameterType === parameterType
              ? { ...param, value: 0 }
              : param,
          ),
        );
        return;
      }
      // Converti in numero e aggiorna solo se valido
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue) && isFinite(numValue) && numValue >= 0) {
        setParameters((prev) =>
          prev.map((param) =>
            param.parameterType === parameterType
              ? { ...param, value: numValue }
              : param,
          ),
        );
      }
    },
    [canEditParameters],
  );

  const handleSave = useCallback(async () => {
    if (!canEditParameters || saving) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      // Save standard parameters
      const parametersToSave = parameters.map(({ parameterType, value }) => ({
        parameterType: parameterType as ParameterType,
        value,
      }));

      const res = await fetch('/api/parameters/standard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parameters: parametersToSave }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save standard parameters');
      }

      // Save colatrice defaults if there are any
      if (Object.keys(colatriceDefaults).length > 0) {
        const resColatrice = await fetch('/api/parameters/colatrice-defaults', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ defaults: colatriceDefaults }),
        });

        if (!resColatrice.ok) {
          const data = await resColatrice.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save colatrice defaults');
        }
      }

      // Save process defaults if there are any
      if (processDefaults.processes && processDefaults.processes.length > 0) {
        const resProcess = await fetch('/api/parameters/process-defaults', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ defaults: processDefaults }),
        });

        if (!resProcess.ok) {
          const data = await resProcess.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save process defaults');
        }
      }

      setMessage('Parametri salvati con successo');
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      console.error('Failed to save parameters', e);
      setError(
        e instanceof Error ? e.message : 'Errore nel salvataggio dei parametri',
      );
    } finally {
      setSaving(false);
    }
  }, [
    canEditParameters,
    parameters,
    colatriceDefaults,
    processDefaults,
    saving,
  ]);

  if (loading || !profile) {
    return (
      <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
          Caricamento...
        </div>
      </div>
    );
  }

  if (!canViewParameters) {
    return (
      <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          Non hai i permessi per visualizzare i parametri standard.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            Parametri Standard
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Gestisci i parametri standard utilizzati come default per tutte le
            ricette
          </p>
        </div>
        {canEditParameters && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvataggio...' : 'Salva modifiche'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-200">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
        <fieldset
          disabled={!canEditParameters}
          aria-disabled={!canEditParameters}
          className={!canEditParameters ? 'opacity-75' : undefined}
        >
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {parameters.map((param) => (
              <div
                key={param.parameterType}
                className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4"
              >
                <label className="mb-2 block text-sm font-medium text-zinc-200">
                  {PARAMETER_TYPE_LABELS[param.parameterType as ParameterType]}
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      inputValues[param.parameterType] ??
                      param.value?.toString() ??
                      '0'
                    }
                    onChange={(e) =>
                      handleParameterChange(param.parameterType, e.target.value)
                    }
                    disabled={!canEditParameters}
                    className={`w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 ${
                      !canEditParameters
                        ? 'cursor-not-allowed opacity-50'
                        : 'focus:border-blue-500 focus:outline-none'
                    }`}
                  />
                  {param.parameterType === 'wastePercent' ||
                  param.parameterType === 'waterPercent' ? (
                    <span className="text-xs text-zinc-400">%</span>
                  ) : param.parameterType === 'cookieWeightCookedG' ? (
                    <span className="text-xs text-zinc-400">g</span>
                  ) : param.parameterType === 'mixerCapacityKg' ||
                    param.parameterType === 'depositorCapacityKg' ? (
                    <span className="text-xs text-zinc-400">kg</span>
                  ) : param.parameterType === 'traysCapacityKg' ||
                    param.parameterType === 'traysPerOvenLoad' ||
                    param.parameterType === 'boxCapacity' ||
                    param.parameterType === 'cartCapacity' ? (
                    <span className="text-xs text-zinc-400">#</span>
                  ) : param.parameterType === 'steamMinutes' ||
                    param.parameterType === 'valveOpenMinutes' ||
                    param.parameterType === 'valveCloseMinutes' ? (
                    <span className="text-xs text-zinc-400">min</span>
                  ) : param.parameterType === 'consumoForno' ||
                    param.parameterType === 'consumoColatrice' ||
                    param.parameterType === 'consumoImpastatrice' ||
                    param.parameterType === 'consumoSaldatrice' ||
                    param.parameterType === 'consumoConfezionatrice' ||
                    param.parameterType === 'consumoBassima' ||
                    param.parameterType === 'consumoMulino' ? (
                    <span className="text-xs text-zinc-400">kW/h</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Colatrice Defaults Section */}
      {Object.keys(colatriceDefaults).length > 0 && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
          <h2 className="mb-4 text-xl font-semibold text-zinc-100">
            Setting Colatrice Defaults
          </h2>
          <fieldset
            disabled={!canEditParameters}
            aria-disabled={!canEditParameters}
            className={!canEditParameters ? 'opacity-75' : undefined}
          >
            <div className="space-y-6">
              {Object.keys(colatriceDefaults).map((pageKey) => (
                <div
                  key={pageKey}
                  className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4"
                >
                  <h3 className="mb-3 text-lg font-medium text-zinc-200 capitalize">
                    {pageKey.replace(/_/g, ' ')}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.keys(colatriceDefaults[pageKey] || {}).map(
                      (fieldKey) => (
                        <div key={fieldKey}>
                          <label className="mb-1 block text-sm font-medium text-zinc-300">
                            {fieldKey.replace(/_/g, ' ')}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={
                              colatriceInputValues[pageKey]?.[fieldKey] ??
                              colatriceDefaults[pageKey]?.[
                                fieldKey
                              ]?.toString() ??
                              '0'
                            }
                            onChange={(e) =>
                              handleColatriceDefaultChange(
                                pageKey,
                                fieldKey,
                                e.target.value,
                              )
                            }
                            disabled={!canEditParameters}
                            className={`w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 ${
                              !canEditParameters
                                ? 'cursor-not-allowed opacity-50'
                                : 'focus:border-blue-500 focus:outline-none'
                            }`}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {/* Process Defaults Section */}
      {processDefaults.processes && processDefaults.processes.length > 0 && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
          <h2 className="mb-4 text-xl font-semibold text-zinc-100">
            Processi di Produzione Default
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Questi valori verranno utilizzati quando si preme &quot;Carica
            Parametri Default&quot; nel widget Processi di produzione
          </p>
          <fieldset
            disabled={!canEditParameters}
            aria-disabled={!canEditParameters}
            className={!canEditParameters ? 'opacity-75' : undefined}
          >
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
                  </tr>
                </thead>
                <tbody>
                  {processDefaults.processes.map((proc, index) => (
                    <tr
                      key={index}
                      className="border-b border-zinc-100 dark:border-gray-800"
                    >
                      <td className="px-4 py-3 text-sm text-zinc-900 dark:text-gray-100">
                        {processNames[proc.processId] ||
                          `ID: ${proc.processId}`}
                      </td>
                      <td className="px-4 py-3">
                        {canEditParameters ? (
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={proc.minutes}
                            onChange={(e) => {
                              const newProcesses = [
                                ...processDefaults.processes,
                              ];
                              newProcesses[index] = {
                                ...newProcesses[index],
                                minutes: parseFloat(e.target.value) || 0,
                              };
                              setProcessDefaults({ processes: newProcesses });
                            }}
                            className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
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
                          value={(proc.costTypes || []) as ProcessCostType[]}
                          onChange={(costTypes) => {
                            const newProcesses = [...processDefaults.processes];
                            newProcesses[index] = {
                              ...newProcesses[index],
                              costTypes: costTypes as string[],
                            };
                            setProcessDefaults({ processes: newProcesses });
                          }}
                          availableCostTypes={PROCESS_COST_TYPES}
                          disabled={!canEditParameters}
                          className="w-full"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {canEditParameters ? (
                          <select
                            value={proc.cycleField || ''}
                            onChange={(e) => {
                              const newProcesses = [
                                ...processDefaults.processes,
                              ];
                              newProcesses[index] = {
                                ...newProcesses[index],
                                cycleField:
                                  e.target.value === '' ? null : e.target.value,
                              };
                              setProcessDefaults({ processes: newProcesses });
                            }}
                            className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                          >
                            <option value="">Usa valore salvato</option>
                            <option value="singleCycle">1 Ciclo</option>
                            <option value="numberOfPackages">
                              Numero pacchetti
                            </option>
                            <option value="traysPerOvenLoad">
                              Teglie/Infornate
                            </option>
                            <option value="numberOfOvenLoads">
                              Numero infornate
                            </option>
                            <option value="numberOfTrays">Numero teglie</option>
                            <option value="numberOfDepositorCycles">
                              Numero cicli colatrice
                            </option>
                            <option value="numberOfMixingCycles">
                              Numero impasti
                            </option>
                            <option value="numberOfBoxes">
                              Numero scatole
                            </option>
                            <option value="numberOfCarts">
                              Numero carrelli
                            </option>
                          </select>
                        ) : (
                          <span className="text-sm text-zinc-700 dark:text-gray-300">
                            {proc.cycleField || '-'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
