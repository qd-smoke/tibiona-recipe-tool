'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import type { StandardCost, CostType, PermissionCapabilities } from '@/types';
import { COST_TYPE_LABELS } from '@/types';
import { canView, canEdit } from '@/lib/permissions/check';
import { useOperatorView } from '@/contexts/OperatorViewContext';

type StandardCostsWidgetProps = {
  profileCapabilities?: PermissionCapabilities | null;
};

const STANDARD_COSTS_CAPABILITY_ID = 'admin.costs.standard';

export function StandardCostsWidget({
  profileCapabilities,
}: StandardCostsWidgetProps) {
  const { getEffectiveCapabilities, isOperatorView } = useOperatorView();
  const effectiveCapabilities = getEffectiveCapabilities(profileCapabilities);

  const [costs, setCosts] = useState<StandardCost[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canViewCosts = canView(
    effectiveCapabilities,
    STANDARD_COSTS_CAPABILITY_ID,
    isOperatorView,
  );
  const canEditCosts = canEdit(
    effectiveCapabilities,
    STANDARD_COSTS_CAPABILITY_ID,
  );

  const fetchCosts = useCallback(async () => {
    if (!canViewCosts) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/costs/standard', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch standard costs');
      }
      const data = await res.json();
      const loadedCosts = data.costs || [];
      setCosts(loadedCosts);
      // Inizializza i valori di input
      const initialInputValues: Record<string, string> = {};
      loadedCosts.forEach((cost: StandardCost) => {
        initialInputValues[cost.costType] =
          cost.value === 0 || cost.value === null || cost.value === undefined
            ? '0'
            : cost.value.toString();
      });
      setInputValues(initialInputValues);
    } catch (e) {
      console.error('Failed to fetch costs', e);
      setError('Errore nel caricamento dei costi standard');
    } finally {
      setLoading(false);
    }
  }, [canViewCosts]);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  const handleCostChange = useCallback(
    (costType: string, inputValue: string) => {
      if (!canEditCosts) return;
      // Aggiorna il valore dell'input durante la digitazione
      setInputValues((prev) => ({ ...prev, [costType]: inputValue }));
      // Se il valore è vuoto o solo un punto, imposta a 0
      if (inputValue === '' || inputValue === '.') {
        setCosts((prev) =>
          prev.map((cost) =>
            cost.costType === costType ? { ...cost, value: 0 } : cost,
          ),
        );
        return;
      }
      // Converti in numero e aggiorna solo se valido
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue) && isFinite(numValue) && numValue >= 0) {
        setCosts((prev) =>
          prev.map((cost) =>
            cost.costType === costType ? { ...cost, value: numValue } : cost,
          ),
        );
      }
    },
    [canEditCosts],
  );

  const handleSave = useCallback(async () => {
    if (!canEditCosts || saving) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const costsToSave = costs.map(({ costType, value }) => ({
        costType: costType as CostType,
        value,
      }));

      const res = await fetch('/api/costs/standard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ costs: costsToSave }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save standard costs');
      }

      setMessage('Costi standard salvati con successo');
      setTimeout(() => setMessage(null), 3000);
      await fetchCosts();
    } catch (e) {
      console.error('Failed to save costs', e);
      setError(
        e instanceof Error
          ? e.message
          : 'Errore nel salvataggio dei costi standard',
      );
    } finally {
      setSaving(false);
    }
  }, [canEditCosts, costs, saving, fetchCosts]);

  if (!canViewCosts) {
    return null;
  }

  // Calcola il totale dei costi
  const totalCosts = costs.reduce((sum, cost) => sum + (cost.value || 0), 0);

  return (
    <CollapsibleSection title="Costi Standard" defaultCollapsed={true}>
      <div className="space-y-4">
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

        {loading ? (
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            Caricamento costi...
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">
                  Totale costi standard
                </span>
                <span className="text-lg font-semibold text-white">
                  €{totalCosts.toFixed(2)}
                </span>
              </div>
            </div>

            <fieldset
              disabled={!canEditCosts}
              aria-disabled={!canEditCosts}
              className={!canEditCosts ? 'opacity-75' : undefined}
            >
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {costs.map((cost) => (
                  <div
                    key={cost.costType}
                    className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-3"
                  >
                    <label className="mb-1 block text-xs font-medium text-zinc-300">
                      {COST_TYPE_LABELS[cost.costType as CostType]}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={
                          inputValues[cost.costType] ??
                          cost.value?.toString() ??
                          '0'
                        }
                        onChange={(e) =>
                          handleCostChange(cost.costType, e.target.value)
                        }
                        disabled={!canEditCosts}
                        className={`w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 ${
                          !canEditCosts
                            ? 'cursor-not-allowed opacity-50'
                            : 'focus:border-blue-500 focus:outline-none'
                        }`}
                      />
                      <span className="text-xs text-zinc-400">€</span>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            {canEditCosts && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Salvataggio...' : 'Salva modifiche'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </CollapsibleSection>
  );
}
