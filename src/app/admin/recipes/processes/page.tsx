'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Process, PermissionCapabilities } from '@/types';
import { apiClient } from '@/helpers/api';
import { canView, canEdit } from '@/lib/permissions/check';
import { useOperatorView } from '@/contexts/OperatorViewContext';
import { useSetToast } from '@/state/ToastProvider';
import { Button } from '@/components/Button';

const PROCESSES_CAPABILITY_ID = 'admin.processes';

export default function ProcessesPage() {
  const router = useRouter();
  const setToast = useSetToast();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    capabilities?: PermissionCapabilities;
  } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editOrder, setEditOrder] = useState(0);
  const [newName, setNewName] = useState('');
  const [newOrder, setNewOrder] = useState(0);

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

  const canViewProcesses = canView(
    effectiveCapabilities,
    PROCESSES_CAPABILITY_ID,
  );
  const canEditProcesses = canEdit(
    effectiveCapabilities,
    PROCESSES_CAPABILITY_ID,
  );

  const loadProcesses = useCallback(async () => {
    if (!canViewProcesses) return;
    try {
      setLoading(true);
      setError(null);
      const response = (await apiClient.get('/api/recipes/processes')) as {
        processes: Process[];
      };
      setProcesses(response.processes || []);
    } catch (e) {
      console.error('Failed to load processes', e);
      setError('Errore nel caricamento dei processi');
    } finally {
      setLoading(false);
    }
  }, [canViewProcesses]);

  useEffect(() => {
    loadProcesses();
  }, [loadProcesses]);

  const handleCreate = async () => {
    if (!canEditProcesses || !newName.trim()) return;

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const response = (await apiClient.post('/api/recipes/processes', {
        name: newName.trim(),
        order: newOrder,
      })) as { process: Process };

      setMessage(`Processo "${response.process.name}" creato con successo`);
      setNewName('');
      setNewOrder(0);
      await loadProcesses();
      setToast('Processo creato con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to create process', e);
      const errorMessage =
        e instanceof Error ? e.message : 'Errore nella creazione del processo';
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (process: Process) => {
    if (!canEditProcesses) return;
    setEditingId(process.id);
    setEditName(process.name);
    setEditOrder(process.order);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditOrder(0);
  };

  const handleSaveEdit = async (id: number) => {
    if (!canEditProcesses) return;

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      await apiClient.put(`/api/recipes/processes/${id}`, {
        name: editName.trim(),
        order: editOrder,
      });

      setMessage(`Processo aggiornato con successo`);
      setEditingId(null);
      setEditName('');
      setEditOrder(0);
      await loadProcesses();
      setToast('Processo aggiornato con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to update process', e);
      const errorMessage =
        e instanceof Error
          ? e.message
          : "Errore nell'aggiornamento del processo";
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!canEditProcesses) return;
    if (
      !confirm(
        `Sei sicuro di voler eliminare il processo "${name}"? Questa azione non può essere annullata.`,
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      await apiClient.del(`/api/recipes/processes/${id}`);

      setMessage(`Processo "${name}" eliminato con successo`);
      await loadProcesses();
      setToast('Processo eliminato con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to delete process', e);
      const errorMessage =
        e instanceof Error
          ? e.message
          : "Errore nell'eliminazione del processo";
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!canViewProcesses) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-md bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200">
          Non hai i permessi per visualizzare questa pagina.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-gray-100">
        Gestione Processi Standard
      </h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">
          {message}
        </div>
      )}

      {/* Create new process */}
      {canEditProcesses && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-gray-100">
            Aggiungi Nuovo Processo
          </h2>
          <div className="flex gap-4">
            <div className="flex-1">
              <label
                htmlFor="new-process-name"
                className="block text-sm font-medium text-zinc-700 dark:text-gray-300"
              >
                Nome Processo
              </label>
              <input
                id="new-process-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Es: Preparazione laboratorio"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="w-32">
              <label
                htmlFor="new-process-order"
                className="block text-sm font-medium text-zinc-700 dark:text-gray-300"
              >
                Ordine
              </label>
              <input
                id="new-process-order"
                type="number"
                value={newOrder}
                onChange={(e) => setNewOrder(Number(e.target.value) || 0)}
                min="0"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                variant="primary"
              >
                {saving ? 'Salvataggio...' : 'Aggiungi'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Processes list */}
      {loading ? (
        <div className="text-center">Caricamento processi...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-gray-700">
                <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-900 dark:text-gray-100">
                  Ordine
                </th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-zinc-900 dark:text-gray-100">
                  Nome
                </th>
                {canEditProcesses && (
                  <th className="px-4 py-2 text-right text-sm font-semibold text-zinc-900 dark:text-gray-100">
                    Azioni
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {processes.map((proc) => (
                <tr
                  key={proc.id}
                  className="border-b border-zinc-100 dark:border-gray-800"
                >
                  <td className="px-4 py-3 text-sm text-zinc-700 dark:text-gray-300">
                    {editingId === proc.id ? (
                      <input
                        type="number"
                        value={editOrder}
                        onChange={(e) =>
                          setEditOrder(Number(e.target.value) || 0)
                        }
                        min="0"
                        className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                    ) : (
                      proc.order
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-900 dark:text-gray-100">
                    {editingId === proc.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                      />
                    ) : (
                      proc.name
                    )}
                  </td>
                  {canEditProcesses && (
                    <td className="px-4 py-3 text-right">
                      {editingId === proc.id ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleSaveEdit(proc.id)}
                            disabled={saving || !editName.trim()}
                            variant="primary"
                          >
                            Salva
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            disabled={saving}
                            variant="secondary"
                          >
                            Annulla
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() => handleStartEdit(proc)}
                            disabled={saving}
                            variant="secondary"
                          >
                            Modifica
                          </Button>
                          <Button
                            onClick={() => handleDelete(proc.id, proc.name)}
                            disabled={saving}
                            variant="secondary"
                          >
                            Elimina
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
