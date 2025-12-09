'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type {
  CostType,
  RecipeCostWithStandard,
  PermissionCapabilities,
} from '@/types';
import { COST_TYPE_LABELS } from '@/types';
import { canView, canEdit } from '@/lib/permissions/check';
import { isAdminRole } from '@/constants/roles';

type RecipeCostsSectionProps = {
  recipeId: number;
  profileCapabilities?: PermissionCapabilities | null;
  roleLabel?: string | null;
  isOperatorView?: boolean;
  onCostsChange?: (costs: RecipeCostWithStandard[]) => void;
};

const COSTS_CAPABILITY_ID = 'recipe.costs';

export function RecipeCostsSection({
  recipeId,
  profileCapabilities,
  roleLabel,
  isOperatorView = false,
  onCostsChange,
}: RecipeCostsSectionProps) {
  const [costs, setCosts] = useState<RecipeCostWithStandard[]>([]);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_message, _setMessage] = useState<string | null>(null);

  const isAdmin = isAdminRole(roleLabel) || roleLabel === 'admin';
  // Admin should see and edit everything when not in operator view
  const canViewCosts =
    (isAdmin && !isOperatorView) ||
    canView(profileCapabilities, COSTS_CAPABILITY_ID);
  const canEditCosts =
    (isAdmin && !isOperatorView) ||
    canEdit(profileCapabilities, COSTS_CAPABILITY_ID);

  const fetchCosts = useCallback(async () => {
    if (!recipeId || !canViewCosts) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/recipes/${recipeId}/costs`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error('Failed to fetch costs');
      }
      const data = await res.json();
      const loadedCosts = data.costs || [];
      setCosts(loadedCosts);
      onCostsChange?.(loadedCosts);
      // Inizializza i valori di input
      const initialInputValues: Record<string, string> = {};
      loadedCosts.forEach((cost: RecipeCostWithStandard) => {
        initialInputValues[cost.costType] =
          cost.value === 0 || cost.value === null || cost.value === undefined
            ? '0'
            : cost.value.toString();
      });
      setInputValues(initialInputValues);
    } catch (e) {
      console.error('Failed to fetch costs', e);
      setError('Errore nel caricamento dei costi');
    } finally {
      setLoading(false);
    }
  }, [recipeId, canViewCosts, onCostsChange]);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  const handleCostChange = useCallback(
    (costType: CostType, inputValue: string) => {
      if (!canEditCosts) return;
      // Aggiorna il valore dell'input durante la digitazione
      setInputValues((prev) => ({ ...prev, [costType]: inputValue }));
      // Se il valore è vuoto o solo un punto, imposta a 0
      if (inputValue === '' || inputValue === '.') {
        setCosts((prev) => {
          const updated = prev.map((cost) =>
            cost.costType === costType ? { ...cost, value: 0 } : cost,
          );
          onCostsChange?.(updated);
          return updated;
        });
        return;
      }
      // Converti in numero e aggiorna solo se valido
      const numValue = parseFloat(inputValue);
      if (!isNaN(numValue) && isFinite(numValue) && numValue >= 0) {
        setCosts((prev) => {
          const updated = prev.map((cost) =>
            cost.costType === costType ? { ...cost, value: numValue } : cost,
          );
          onCostsChange?.(updated);
          return updated;
        });
      }
    },
    [canEditCosts, onCostsChange],
  );

  const handleUseStandard = useCallback(
    (costType: CostType) => {
      if (!canEditCosts) return;
      const cost = costs.find((c) => c.costType === costType);
      if (cost) {
        const standardValueStr = cost.standardValue.toString();
        setInputValues((prev) => ({ ...prev, [costType]: standardValueStr }));
        handleCostChange(costType, standardValueStr);
      }
    },
    [canEditCosts, costs, handleCostChange],
  );

  if (!canViewCosts) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Caricamento costi...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {_message && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-2 text-sm text-green-200">
          {_message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {costs.map((cost) => (
          <div
            key={cost.costType}
            className="rounded-lg border border-zinc-700 bg-zinc-900/40 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-200">
                {COST_TYPE_LABELS[cost.costType]}
              </label>
              {!cost.isStandard && (
                <span className="text-xs text-blue-400">Personalizzato</span>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    inputValues[cost.costType] ?? cost.value?.toString() ?? '0'
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

              {cost.standardValue !== cost.value && (
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Standard: €{cost.standardValue.toFixed(2)}</span>
                  {canEditCosts && (
                    <button
                      type="button"
                      onClick={() => handleUseStandard(cost.costType)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      Usa standard
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
