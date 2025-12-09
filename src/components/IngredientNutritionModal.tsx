'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  MAGENTO_NUTRIENT_FIELDS,
  type MagentoNutrientField,
} from '@/constants/magentoNutrientFields';

const MAGENTO_NUTRIENTS_API = '/api/magento/nutrients';

type MagentoUpdateStatus = 'idle' | 'saving' | 'ok' | 'error';

type IngredientNutritionModalProps = {
  open: boolean;
  sku: string;
  name: string;
  qtyForRecipe?: number;
  qtyOriginal?: number;
  isPowderIngredient?: boolean;
  recipeId?: number;
  recipeName?: string;
  initialValues?: Record<string, string>;
  aiContext?: Record<string, unknown>;
  onClose: () => void;
  onValuesApplied?: (values: Record<string, string>) => void;
};

const normalizeValuesRecord = (
  values?: Record<string, string | number | null | undefined>,
) => {
  const next: Record<string, string> = {};
  if (!values) return next;
  for (const field of MAGENTO_NUTRIENT_FIELDS) {
    const raw = values[field.key];
    if (raw === undefined || raw === null) continue;
    const numeric =
      typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
    if (!Number.isFinite(numeric)) continue;
    next[field.key] = numeric.toString();
  }
  return next;
};

export function IngredientNutritionModal({
  open,
  sku,
  name,
  qtyForRecipe,
  qtyOriginal,
  isPowderIngredient,
  recipeId,
  recipeName,
  initialValues,
  aiContext,
  onClose,
  onValuesApplied,
}: IngredientNutritionModalProps) {
  const [magentoValues, setMagentoValues] = useState<Record<string, string>>(
    normalizeValuesRecord(initialValues),
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
    setMagentoValues(normalizeValuesRecord(initialValues));
  }, [initialValues, sku]);

  useEffect(() => {
    if (!open) return;
    setMagentoError(null);
    setAiError(null);
    setAiSuccess(null);
    setBulkSaving(false);
    setBulkStatus('idle');
    setUpdateState({});

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
        setMagentoValues(normalizeValuesRecord(nutrients));
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
  }, [open, sku]);

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

  const handleMagentoSave = async (field: MagentoNutrientField) => {
    setUpdateState((prev) => ({ ...prev, [field.key]: 'saving' }));
    try {
      const response = await fetch(MAGENTO_NUTRIENTS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_attr',
          sku,
          attr: field.key,
          val: magentoValues[field.key] ?? '',
        }),
      });
      const payload = await response.json();
      if (!payload?.ok) {
        throw new Error(payload?.error || 'Aggiornamento non riuscito.');
      }
      setUpdateState((prev) => ({ ...prev, [field.key]: 'ok' }));
      setTimeout(() => {
        setUpdateState((prev) => ({ ...prev, [field.key]: 'idle' }));
      }, 2500);
    } catch (err) {
      console.error(err);
      setUpdateState((prev) => ({ ...prev, [field.key]: 'error' }));
    }
  };

  const handleAiEstimate = async () => {
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
          sku,
          name,
          notes: recipeName,
          context: {
            recipeId,
            recipeName,
            qtyForRecipe,
            qtyOriginal,
            isPowderIngredient,
            ...aiContext,
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
      const estimated = normalizeValuesRecord(payload?.data?.nutrients);
      if (Object.keys(estimated).length === 0) {
        setAiError(
          'La risposta AI non contiene valori utilizzabili. Riprova con una descrizione più dettagliata.',
        );
      } else {
        setMagentoValues((prev) => ({
          ...prev,
          ...estimated,
        }));
        onValuesApplied?.(estimated);
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
          sku,
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
      onValuesApplied?.(magentoValues);
    } catch (error) {
      setBulkStatus('error');
      setAiError(
        error instanceof Error ? error.message : 'Salvataggio massivo fallito.',
      );
    } finally {
      setBulkSaving(false);
    }
  };

  const qtyInfo = useMemo(() => {
    const sections: Array<{ label: string; value: string }> = [];
    if (qtyForRecipe !== undefined) {
      sections.push({
        label: 'Qty per ricetta',
        value: `${qtyForRecipe.toLocaleString('it-IT', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        })} g`,
      });
    }
    if (qtyOriginal !== undefined) {
      sections.push({
        label: 'Qty originale',
        value: `${qtyOriginal.toLocaleString('it-IT', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        })} g`,
      });
    }
    sections.push({
      label: 'Polvere',
      value: isPowderIngredient ? 'Yes' : 'No',
    });
    return sections;
  }, [qtyForRecipe, qtyOriginal, isPowderIngredient]);

  if (!open) {
    return null;
  }

  return (
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
              Magento SKU {sku}
            </p>
            <h2 className="text-xl font-semibold text-white">{name}</h2>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            className="rounded-full border border-gray-700 p-1 text-gray-400 hover:border-gray-500 hover:text-gray-100"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grow overflow-y-auto px-6 py-4 text-sm text-gray-200">
          <div className="mb-4 flex flex-wrap gap-4 text-xs text-gray-400">
            {qtyInfo.map((section) => (
              <span key={section.label}>
                {section.label}:{' '}
                <strong className="text-gray-100">{section.value}</strong>
              </span>
            ))}
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
                  <span className="text-xs text-gray-400">Caricamento…</span>
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
                    {MAGENTO_NUTRIENT_FIELDS.map((field) => {
                      const status = updateState[field.key] ?? 'idle';
                      return (
                        <tr key={field.key} className="odd:bg-gray-950/40">
                          <td className="px-3 py-2">{field.label}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.001"
                              className="w-28 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                              value={magentoValues[field.key] ?? ''}
                              onChange={(event) =>
                                handleMagentoValueChange(
                                  field.key,
                                  event.target.value,
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-gray-400">
                            {field.unit}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => handleMagentoSave(field)}
                              disabled={status === 'saving' || magentoLoading}
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
                  che a sua volta chiama <code>datasheet/nutrienti.php</code>.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-gray-500"
              onClick={onClose}
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
