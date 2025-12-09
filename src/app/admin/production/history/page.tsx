'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProfile } from '@/contexts/ProfileContext';
import { useOperatorView } from '@/contexts/OperatorViewContext';
import { canView, canEdit } from '@/lib/permissions/check';
import { apiClient } from '@/helpers/api';
import { useSetToast } from '@/state/ToastProvider';

type ProductionHistoryItem = {
  production: {
    id: number;
    recipeId: number;
    productionLot: string;
    startedAt: string;
    finishedAt: string | null;
    status: 'completed' | 'in_progress' | 'cancelled' | 'loaded';
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: number;
    displayName: string;
    username: string;
  };
  recipe: {
    id: number;
    name: string;
  };
  recipeVersion: {
    id: number;
    versionNumber: number;
    createdAt: string;
  } | null;
  recipeSnapshot: Record<string, unknown> | null;
  ingredients: unknown[];
};

type ProductionStatus =
  | 'all'
  | 'completed'
  | 'in_progress'
  | 'cancelled'
  | 'loaded';

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function calculateDuration(
  startedAt: string,
  finishedAt: string | null,
): number | null {
  if (!finishedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  return Math.round((end - start) / (1000 * 60));
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completata';
    case 'in_progress':
      return 'In Corso';
    case 'cancelled':
      return 'Cancellata';
    case 'loaded':
      return 'Caricata';
    default:
      return status;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700';
    case 'loaded':
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700';
  }
}

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

export default function ProductionHistoryPage() {
  const router = useRouter();
  const { profile } = useProfile();
  const { getEffectiveCapabilities, isOperatorView } = useOperatorView();
  const setToast = useSetToast();
  const [history, setHistory] = useState<ProductionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProductionStatus>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [statusChanges, setStatusChanges] = useState<Record<number, string>>(
    {},
  );
  const [statusSavingId, setStatusSavingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    productionId: number;
    confirmation: string;
    error?: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const effectiveCapabilities = getEffectiveCapabilities(profile?.capabilities);
  const canViewHistory = canView(
    effectiveCapabilities,
    'admin.production.history',
    isOperatorView,
  );
  const canEditHistory = canEdit(
    effectiveCapabilities,
    'admin.production.history',
  );

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = (await apiClient.get('/api/production/history', {
        headers: {
          'Cache-Control': 'no-store',
        },
      })) as {
        ok?: boolean;
        history?: ProductionHistoryItem[];
        error?: string;
      };

      if (response?.ok && response.history) {
        setHistory(response.history);
      } else {
        throw new Error(response?.error || 'Errore sconosciuto');
      }
    } catch (err) {
      console.error('Failed to load production history', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante il caricamento dello storico',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) {
      router.replace('/login');
      return;
    }
    if (!canViewHistory) {
      setError('Non hai i permessi per accedere a questa pagina.');
      setLoading(false);
      return;
    }
    loadHistory();
  }, [profile, canViewHistory, router, loadHistory]);

  const handleStatusSelect = (
    productionId: number,
    value: string,
    originalStatus: string,
  ) => {
    setStatusChanges((prev) => {
      if (value === originalStatus) {
        const { [productionId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productionId]: value };
    });
  };

  const handleSaveStatus = useCallback(
    async (productionId: number) => {
      const status = statusChanges[productionId];
      if (!status) return;
      try {
        setStatusSavingId(productionId);
        const response = await fetch(
          `/api/production/history/${productionId}/status`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          },
        );
        if (!response.ok) {
          throw new Error('Errore nel salvataggio');
        }
        setStatusChanges((prev) => {
          const { [productionId]: _, ...rest } = prev;
          return rest;
        });
        setToast('Stato aggiornato', { type: 'success' });
        await loadHistory();
      } catch (err) {
        console.error('Failed to update status', err);
        setToast("Errore durante l'aggiornamento dello stato", {
          type: 'error',
        });
      } finally {
        setStatusSavingId(null);
      }
    },
    [loadHistory, setToast, statusChanges],
  );

  const openDeleteModal = (productionId: number) => {
    setDeleteTarget({
      productionId,
      confirmation: '',
      error: undefined,
    });
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.confirmation.trim().toLowerCase() !== 'cancella') {
      setDeleteTarget((prev) =>
        prev ? { ...prev, error: "Scrivi 'cancella' per confermare." } : prev,
      );
      return;
    }
    try {
      setDeleteLoading(true);
      const response = await fetch(
        `/api/production/history/${deleteTarget.productionId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );
      if (!response.ok) {
        throw new Error('Errore durante la cancellazione');
      }
      setToast('Produzione cancellata', { type: 'success' });
      closeDeleteModal();
      await loadHistory();
    } catch (err) {
      console.error('Failed to delete production', err);
      setDeleteTarget((prev) =>
        prev
          ? { ...prev, error: 'Errore durante la cancellazione, riprova.' }
          : prev,
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch('/api/production/history/export', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error("Errore durante l'export");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'storico-produzioni.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setToast('Export completato con successo', { type: 'success' });
    } catch (err) {
      console.error('Export failed', err);
      setToast(
        err instanceof Error
          ? `Errore export: ${err.message}`
          : "Errore durante l'export",
        { type: 'error' },
      );
    } finally {
      setExporting(false);
    }
  };

  const filteredHistory =
    statusFilter === 'all'
      ? history
      : history.filter((item) => item.production.status === statusFilter);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center text-zinc-600 dark:text-zinc-400">
          Caricamento storico produzioni...
        </div>
      </div>
    );
  }

  if (!canViewHistory) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-2xl rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-700 dark:bg-red-900/20">
          <h2 className="mb-2 text-xl font-semibold text-red-800 dark:text-red-200">
            Accesso negato
          </h2>
          <p className="text-red-600 dark:text-red-300">
            {error || 'Non hai i permessi per accedere a questa pagina.'}
          </p>
        </div>
      </div>
    );
  }

  if (error && !history.length) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-2xl rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-700 dark:bg-red-900/20">
          <h2 className="mb-2 text-xl font-semibold text-red-800 dark:text-red-200">
            Errore
          </h2>
          <p className="text-red-600 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gray-50 px-4 py-6 text-zinc-900 dark:bg-[#050505] dark:text-zinc-100">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-gradient-to-br dark:from-zinc-950/70 dark:via-zinc-900/40 dark:to-[#030712] dark:shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.3em] text-blue-600 uppercase dark:text-blue-300">
                  Admin · Produzione
                </p>
                <h1 className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-white">
                  Storico Produzioni
                </h1>
                <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
                  Visualizza tutte le produzioni con dettagli completi della
                  ricetta e ingredienti. Export disponibile in formato Excel.
                </p>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting || filteredHistory.length === 0}
                className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-500 focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600 dark:focus:ring-offset-zinc-900"
              >
                {exporting ? 'Export in corso...' : 'Scarica Excel'}
              </button>
            </div>

            {/* Filters */}
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                Tutte ({history.length})
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  statusFilter === 'completed'
                    ? 'bg-green-600 text-white'
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                Completate (
                {
                  history.filter((h) => h.production.status === 'completed')
                    .length
                }
                )
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  statusFilter === 'in_progress'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                In Corso (
                {
                  history.filter((h) => h.production.status === 'in_progress')
                    .length
                }
                )
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  statusFilter === 'cancelled'
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                Cancellate (
                {
                  history.filter((h) => h.production.status === 'cancelled')
                    .length
                }
                )
              </button>
              <button
                onClick={() => setStatusFilter('loaded')}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  statusFilter === 'loaded'
                    ? 'bg-amber-500 text-white'
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                Caricate (
                {history.filter((h) => h.production.status === 'loaded').length}
                )
              </button>
            </div>
          </header>

          {/* History table */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-800 dark:bg-zinc-950/50">
            {filteredHistory.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                Nessuna produzione trovata
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold">ID</th>
                      <th className="px-4 py-3 font-semibold">Ricetta</th>
                      <th className="px-4 py-3 font-semibold">Lotto</th>
                      <th className="px-4 py-3 font-semibold">Stato</th>
                      <th className="px-4 py-3 font-semibold">Inizio</th>
                      <th className="px-4 py-3 font-semibold">Fine</th>
                      <th className="px-4 py-3 font-semibold">Durata</th>
                      <th className="px-4 py-3 font-semibold">Utente</th>
                      <th className="px-4 py-3 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredHistory.map((item) => {
                      const duration = calculateDuration(
                        item.production.startedAt,
                        item.production.finishedAt,
                      );
                      const recipeFields =
                        item.recipeSnapshot &&
                        typeof item.recipeSnapshot === 'object'
                          ? Object.entries(item.recipeSnapshot).filter(
                              ([, value]) => isPopulated(value),
                            )
                          : [];

                      return (
                        <React.Fragment key={item.production.id}>
                          <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                            <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                              {item.production.id}
                            </td>
                            <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                              <Link
                                href={`/recipes/${item.production.recipeId}`}
                                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {item.recipe?.name || 'N/A'}
                              </Link>
                              {item.recipeVersion && (
                                <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                                  v{item.recipeVersion.versionNumber}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-sm text-zinc-700 dark:text-zinc-300">
                              {item.production.productionLot}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded border px-2 py-1 text-xs font-medium ${getStatusColor(item.production.status)}`}
                              >
                                {getStatusLabel(item.production.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              {formatDateTime(item.production.startedAt)}
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              {formatDateTime(item.production.finishedAt)}
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              {duration !== null
                                ? `${duration} min`
                                : item.production.status === 'in_progress'
                                  ? 'In corso'
                                  : '—'}
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              {item.user?.displayName ||
                                item.user?.username ||
                                'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              {(recipeFields.length > 0 ||
                                (Array.isArray(item.ingredients) &&
                                  item.ingredients.length > 0)) && (
                                <button
                                  onClick={() =>
                                    setExpandedId(
                                      expandedId === item.production.id
                                        ? null
                                        : item.production.id,
                                    )
                                  }
                                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  {expandedId === item.production.id
                                    ? 'Nascondi'
                                    : 'Dettagli'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expandedId === item.production.id && (
                            <tr className="bg-zinc-50 dark:bg-zinc-900/30">
                              <td colSpan={9} className="px-4 py-4">
                                <div className="space-y-4">
                                  {/* Recipe fields */}
                                  {recipeFields.length > 0 && (
                                    <div>
                                      <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
                                        Campi Ricetta (solo popolati):
                                      </h3>
                                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {recipeFields.map(([key, value]) => (
                                          <div
                                            key={key}
                                            className="rounded border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                                          >
                                            <span className="font-medium text-zinc-600 dark:text-zinc-400">
                                              {key}:
                                            </span>{' '}
                                            <span className="text-zinc-900 dark:text-zinc-100">
                                              {typeof value === 'object'
                                                ? JSON.stringify(value)
                                                : String(value)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Ingredients */}
                                  {Array.isArray(item.ingredients) &&
                                    item.ingredients.length > 0 && (
                                      <div>
                                        <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
                                          Ingredienti ({item.ingredients.length}
                                          ):
                                        </h3>
                                        <div className="overflow-x-auto">
                                          <table className="min-w-full text-xs">
                                            <thead className="border-b border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800">
                                              <tr>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  SKU
                                                </th>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  Nome
                                                </th>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  Fornitore
                                                </th>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  Materia Prima
                                                </th>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  Mp_sku
                                                </th>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  Lotto
                                                </th>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  Check glutine
                                                </th>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  Qty for recipe
                                                </th>
                                                <th className="px-2 py-1 text-left font-semibold">
                                                  Original Qty
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                                              {item.ingredients.map(
                                                (ingredient, idx) => {
                                                  if (
                                                    typeof ingredient !==
                                                      'object' ||
                                                    ingredient === null
                                                  ) {
                                                    return null;
                                                  }
                                                  const ing =
                                                    ingredient as Record<
                                                      string,
                                                      unknown
                                                    >;
                                                  const _populatedFields =
                                                    Object.entries(ing).filter(
                                                      ([, value]) =>
                                                        isPopulated(value),
                                                    );

                                                  return (
                                                    <tr
                                                      key={idx}
                                                      className="dark:bg-zinc-900/50"
                                                    >
                                                      <td className="px-2 py-1">
                                                        {String(
                                                          ing.sku ||
                                                            ing.id ||
                                                            idx,
                                                        )}
                                                        {/* ERP status flag */}
                                                        <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4 text-xs text-amber-900 dark:border-amber-600 dark:bg-amber-900/10 dark:text-amber-200">
                                                          <div className="flex flex-wrap items-center gap-3">
                                                            <label
                                                              htmlFor={`erp-status-${item.production.id}`}
                                                              className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-200"
                                                            >
                                                              Flag ERP
                                                            </label>
                                                            <select
                                                              id={`erp-status-${item.production.id}`}
                                                              value={
                                                                statusChanges[
                                                                  item
                                                                    .production
                                                                    .id
                                                                ] ??
                                                                item.production
                                                                  .status
                                                              }
                                                              onChange={(
                                                                event,
                                                              ) =>
                                                                handleStatusSelect(
                                                                  item
                                                                    .production
                                                                    .id,
                                                                  event.target
                                                                    .value,
                                                                  item
                                                                    .production
                                                                    .status,
                                                                )
                                                              }
                                                              disabled={
                                                                !canEditHistory
                                                              }
                                                              className="rounded-md border border-amber-400 bg-white px-2 py-1 text-xs font-semibold text-amber-900 focus:border-amber-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                              <option value="completed">
                                                                Completata
                                                              </option>
                                                              <option value="loaded">
                                                                Caricata
                                                              </option>
                                                            </select>
                                                          </div>
                                                          {statusChanges[
                                                            item.production.id
                                                          ] && (
                                                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                                              <span className="text-[11px]">
                                                                Stato
                                                                modificato: da{' '}
                                                                <strong>
                                                                  {getStatusLabel(
                                                                    item
                                                                      .production
                                                                      .status,
                                                                  )}
                                                                </strong>{' '}
                                                                a{' '}
                                                                <strong>
                                                                  {getStatusLabel(
                                                                    statusChanges[
                                                                      item
                                                                        .production
                                                                        .id
                                                                    ],
                                                                  )}
                                                                </strong>
                                                              </span>
                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  handleSaveStatus(
                                                                    item
                                                                      .production
                                                                      .id,
                                                                  )
                                                                }
                                                                disabled={
                                                                  statusSavingId ===
                                                                  item
                                                                    .production
                                                                    .id
                                                                }
                                                                className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
                                                              >
                                                                {statusSavingId ===
                                                                item.production
                                                                  .id
                                                                  ? 'Salvataggio...'
                                                                  : 'Salva stato'}
                                                              </button>
                                                            </div>
                                                          )}
                                                          {canEditHistory && (
                                                            <div className="mt-3 space-y-2 text-xs text-amber-700 dark:text-amber-200">
                                                              <p className="font-semibold">
                                                                Vuoi cancellare
                                                                la produzione?
                                                              </p>
                                                              <button
                                                                type="button"
                                                                onClick={() =>
                                                                  openDeleteModal(
                                                                    item
                                                                      .production
                                                                      .id,
                                                                  )
                                                                }
                                                                className="rounded-lg border border-amber-500 px-3 py-1 text-xs font-semibold tracking-wide text-amber-600 uppercase transition hover:border-amber-400 hover:text-amber-400"
                                                              >
                                                                Cancella
                                                                produzione
                                                              </button>
                                                              <p className="text-[10px] text-amber-600/80 dark:text-amber-300/80">
                                                                Il pulsante
                                                                funziona solo se
                                                                digiti
                                                                <strong>
                                                                  {' '}
                                                                  cancella{' '}
                                                                </strong>{' '}
                                                                nella finestra
                                                                di conferma.
                                                                Operazione
                                                                irreversibile.
                                                              </p>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </td>
                                                      <td className="px-2 py-1">
                                                        {String(
                                                          ing.name || '—',
                                                        )}
                                                      </td>
                                                      <td className="px-2 py-1">
                                                        {String(
                                                          ing.supplier || '—',
                                                        )}
                                                      </td>
                                                      <td className="px-2 py-1">
                                                        {String(
                                                          ing.productName ||
                                                            '—',
                                                        )}
                                                      </td>
                                                      <td className="px-2 py-1">
                                                        {String(
                                                          ing.mpSku || '—',
                                                        )}
                                                      </td>
                                                      <td className="px-2 py-1">
                                                        {String(ing.lot || '—')}
                                                      </td>
                                                      <td className="px-2 py-1">
                                                        {String(
                                                          ing.checkGlutine ===
                                                            1 ||
                                                            ing.checkGlutine ===
                                                              true
                                                            ? 'Sì'
                                                            : 'No',
                                                        )}
                                                      </td>
                                                      <td className="px-2 py-1">
                                                        {String(
                                                          ing.qtyForRecipe ||
                                                            '—',
                                                        )}
                                                      </td>
                                                      <td className="px-2 py-1">
                                                        {String(
                                                          ing.qtyOriginal ||
                                                            ing.qty ||
                                                            '—',
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                },
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}

                                  {/* Notes */}
                                  {item.production.notes && (
                                    <div>
                                      <h3 className="mb-2 font-semibold text-zinc-900 dark:text-zinc-100">
                                        Note:
                                      </h3>
                                      <p className="rounded border border-zinc-200 bg-white p-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                        {item.production.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-red-500 bg-zinc-950 p-6 text-left text-sm text-zinc-100 shadow-2xl">
            <h3 className="text-lg font-semibold text-red-300">
              Conferma cancellazione
            </h3>
            <p className="mt-2 text-xs text-zinc-400">
              Questa azione elimina la produzione dal database. Per confermare,
              digita <strong>cancella</strong> (case insensitive). Non puoi
              annullare.
            </p>
            <input
              type="text"
              value={deleteTarget.confirmation}
              onChange={(event) =>
                setDeleteTarget((prev) =>
                  prev
                    ? {
                        ...prev,
                        confirmation: event.target.value,
                        error: undefined,
                      }
                    : prev,
                )
              }
              className="mt-4 w-full rounded-lg border border-zinc-700 bg-black/70 px-3 py-2 text-sm text-zinc-100 focus:border-red-500 focus:outline-none"
            />
            {deleteTarget.error && (
              <p className="mt-2 text-xs text-red-400">{deleteTarget.error}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs tracking-wide text-zinc-300 uppercase transition hover:border-zinc-500"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase transition hover:bg-red-500 disabled:opacity-60"
              >
                {deleteLoading ? 'Cancellazione...' : 'Conferma cancellazione'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
