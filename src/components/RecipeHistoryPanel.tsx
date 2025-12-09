'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/helpers/api';
import type { RecipeHistoryEntry } from '@/types';

type RecipeHistoryPanelProps = {
  recipeId: number;
  filterType?: 'all' | 'production' | 'admin';
};

export function RecipeHistoryPanel({
  recipeId,
  filterType = 'all',
}: RecipeHistoryPanelProps) {
  const [history, setHistory] = useState<RecipeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<
    'all' | 'production' | 'admin'
  >(filterType);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = (await apiClient.get(
        `/api/recipes/${recipeId}/history?type=${currentFilter}`,
      )) as { ok?: boolean; history?: RecipeHistoryEntry[]; error?: string };

      if (response?.ok && response.history) {
        setHistory(response.history);
      } else {
        throw new Error(response?.error || 'Errore sconosciuto');
      }
    } catch (err) {
      console.error('Failed to load history', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante il caricamento dello storico',
      );
    } finally {
      setLoading(false);
    }
  }, [recipeId, currentFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'production':
        return 'Produzione';
      case 'admin':
        return 'Amministrativo';
      case 'version_created':
        return 'Versione Creata';
      default:
        return type;
    }
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'production':
        return 'bg-blue-900/30 text-blue-200 border-blue-700';
      case 'admin':
        return 'bg-purple-900/30 text-purple-200 border-purple-700';
      case 'version_created':
        return 'bg-green-900/30 text-green-200 border-green-700';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div className="text-center text-gray-400">Caricamento storico...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-900/20 p-4">
        <div className="text-red-200">Errore: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setCurrentFilter('all')}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            currentFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Tutti
        </button>
        <button
          onClick={() => setCurrentFilter('production')}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            currentFilter === 'production'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Produzione
        </button>
        <button
          onClick={() => setCurrentFilter('admin')}
          className={`rounded-md px-3 py-1 text-sm font-medium transition ${
            currentFilter === 'admin'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Amministrativo
        </button>
      </div>

      {/* History table */}
      {history.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 text-center text-gray-400">
          Nessuna modifica trovata
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-800 text-gray-300">
              <tr>
                <th className="px-4 py-2">Data/Ora</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Campo</th>
                <th className="px-4 py-2">Descrizione</th>
                <th className="px-4 py-2">Utente</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr className="border-t border-gray-800 bg-gray-900/50 hover:bg-gray-800/50">
                    <td className="px-4 py-2 text-gray-300">
                      {new Date(entry.createdAt).toLocaleString('it-IT')}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded border px-2 py-1 text-xs font-medium ${getChangeTypeColor(entry.changeType)}`}
                      >
                        {getChangeTypeLabel(entry.changeType)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-300">
                      {entry.fieldName || '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-300">
                      {entry.changeDescription}
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      ID: {entry.userId}
                    </td>
                    <td className="px-4 py-2">
                      {(entry.oldValue || entry.newValue) && (
                        <button
                          onClick={() =>
                            setExpandedId(
                              expandedId === entry.id ? null : entry.id,
                            )
                          }
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {expandedId === entry.id ? 'Nascondi' : 'Dettagli'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === entry.id &&
                    (entry.oldValue || entry.newValue) && (
                      <tr className="border-t border-gray-800 bg-gray-950/50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {entry.oldValue && (
                              <div>
                                <div className="mb-1 font-medium text-red-300">
                                  Valore Precedente:
                                </div>
                                <div className="rounded bg-red-900/20 p-2 text-gray-300">
                                  {entry.oldValue.length > 200
                                    ? `${entry.oldValue.substring(0, 200)}...`
                                    : entry.oldValue}
                                </div>
                              </div>
                            )}
                            {entry.newValue && (
                              <div>
                                <div className="mb-1 font-medium text-green-300">
                                  Nuovo Valore:
                                </div>
                                <div className="rounded bg-green-900/20 p-2 text-gray-300">
                                  {entry.newValue.length > 200
                                    ? `${entry.newValue.substring(0, 200)}...`
                                    : entry.newValue}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
