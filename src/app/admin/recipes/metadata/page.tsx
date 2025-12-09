'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type {
  RecipeCategory,
  RecipeClient,
  PermissionCapabilities,
} from '@/types';
import { canView, canEdit } from '@/lib/permissions/check';
import { useOperatorView } from '@/contexts/OperatorViewContext';
import { useSetToast } from '@/state/ToastProvider';
import { apiClient } from '@/helpers/api';

const METADATA_CAPABILITY_ID = 'admin.permissions';

export default function RecipeMetadataPage() {
  const router = useRouter();
  const setToast = useSetToast();
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [clients, setClients] = useState<RecipeClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    capabilities?: PermissionCapabilities;
  } | null>(null);

  // New item states
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingClientName, setEditingClientName] = useState('');

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

  const canViewMetadata = canView(
    effectiveCapabilities,
    METADATA_CAPABILITY_ID,
  );
  const canEditMetadata = canEdit(
    effectiveCapabilities,
    METADATA_CAPABILITY_ID,
  );

  const fetchData = useCallback(async () => {
    if (!canViewMetadata) return;
    try {
      setLoading(true);
      setError(null);

      const [categoriesRes, clientsRes] = await Promise.all([
        apiClient.get('/api/recipes/categories'),
        apiClient.get('/api/recipes/clients'),
      ]);

      const categoriesData = categoriesRes as { categories: RecipeCategory[] };
      const clientsData = clientsRes as { clients: RecipeClient[] };

      setCategories(categoriesData.categories || []);
      setClients(clientsData.clients || []);
    } catch (e) {
      console.error('Failed to fetch metadata', e);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  }, [canViewMetadata]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const normalizeName = (name: string): string => {
    return name.trim().toLowerCase();
  };

  const checkDuplicateCategory = (
    name: string,
    excludeId?: number,
  ): boolean => {
    const normalized = normalizeName(name);
    return categories.some(
      (cat) => normalizeName(cat.name) === normalized && cat.id !== excludeId,
    );
  };

  const checkDuplicateClient = (name: string, excludeId?: number): boolean => {
    const normalized = normalizeName(name);
    return clients.some(
      (client) =>
        normalizeName(client.name) === normalized && client.id !== excludeId,
    );
  };

  const handleAddCategory = async () => {
    if (!canEditMetadata || saving || !newCategoryName.trim()) return;

    const trimmedName = newCategoryName.trim();
    if (checkDuplicateCategory(trimmedName)) {
      setError('Una categoria con questo nome esiste già');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = (await apiClient.post('/api/recipes/categories', {
        name: trimmedName,
      })) as { category: RecipeCategory };

      setCategories((prev) => [...prev, response.category]);
      setNewCategoryName('');
      setMessage('Categoria aggiunta con successo');
      setToast('Categoria aggiunta con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to add category', e);
      const errorMessage =
        e instanceof Error ? e.message : "Errore nell'aggiunta della categoria";
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddClient = async () => {
    if (!canEditMetadata || saving || !newClientName.trim()) return;

    const trimmedName = newClientName.trim();
    if (checkDuplicateClient(trimmedName)) {
      setError('Un cliente con questo nome esiste già');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = (await apiClient.post('/api/recipes/clients', {
        name: trimmedName,
      })) as { client: RecipeClient };

      setClients((prev) => [...prev, response.client]);
      setNewClientName('');
      setMessage('Cliente aggiunto con successo');
      setToast('Cliente aggiunto con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to add client', e);
      const errorMessage =
        e instanceof Error ? e.message : "Errore nell'aggiunta del cliente";
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditCategory = (category: RecipeCategory) => {
    if (!canEditMetadata) return;
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setError(null);
  };

  const handleStartEditClient = (client: RecipeClient) => {
    if (!canEditMetadata) return;
    setEditingClientId(client.id);
    setEditingClientName(client.name);
    setError(null);
  };

  const handleSaveCategory = async (id: number) => {
    if (!canEditMetadata || saving || !editingCategoryName.trim()) return;

    const trimmedName = editingCategoryName.trim();
    if (checkDuplicateCategory(trimmedName, id)) {
      setError('Una categoria con questo nome esiste già');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await apiClient.put(`/api/recipes/categories/${id}`, {
        name: trimmedName,
      });

      setCategories((prev) =>
        prev.map((cat) =>
          cat.id === id ? { ...cat, name: trimmedName } : cat,
        ),
      );
      setEditingCategoryId(null);
      setEditingCategoryName('');
      setMessage('Categoria aggiornata con successo');
      setToast('Categoria aggiornata con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to update category', e);
      const errorMessage =
        e instanceof Error
          ? e.message
          : "Errore nell'aggiornamento della categoria";
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClient = async (id: number) => {
    if (!canEditMetadata || saving || !editingClientName.trim()) return;

    const trimmedName = editingClientName.trim();
    if (checkDuplicateClient(trimmedName, id)) {
      setError('Un cliente con questo nome esiste già');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await apiClient.put(`/api/recipes/clients/${id}`, {
        name: trimmedName,
      });

      setClients((prev) =>
        prev.map((client) =>
          client.id === id ? { ...client, name: trimmedName } : client,
        ),
      );
      setEditingClientId(null);
      setEditingClientName('');
      setMessage('Cliente aggiornato con successo');
      setToast('Cliente aggiornato con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to update client', e);
      const errorMessage =
        e instanceof Error
          ? e.message
          : "Errore nell'aggiornamento del cliente";
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!canEditMetadata || saving) return;
    if (
      !confirm(
        'Sei sicuro di voler eliminare questa categoria? Le ricette che la utilizzano verranno aggiornate.',
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await apiClient.del(`/api/recipes/categories/${id}`);

      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      setMessage('Categoria eliminata con successo');
      setToast('Categoria eliminata con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to delete category', e);
      const errorMessage =
        e instanceof Error
          ? e.message
          : "Errore nell'eliminazione della categoria";
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClient = async (id: number) => {
    if (!canEditMetadata || saving) return;
    if (
      !confirm(
        'Sei sicuro di voler eliminare questo cliente? Verranno rimosse tutte le associazioni con le ricette.',
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await apiClient.del(`/api/recipes/clients/${id}`);

      setClients((prev) => prev.filter((client) => client.id !== id));
      setMessage('Cliente eliminato con successo');
      setToast('Cliente eliminato con successo', { type: 'success' });
    } catch (e) {
      console.error('Failed to delete client', e);
      const errorMessage =
        e instanceof Error ? e.message : "Errore nell'eliminazione del cliente";
      setError(errorMessage);
      setToast(errorMessage, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingClientId(null);
    setEditingCategoryName('');
    setEditingClientName('');
    setError(null);
  };

  if (loading || !profile) {
    return (
      <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-400">
          Caricamento...
        </div>
      </div>
    );
  }

  if (!canViewMetadata) {
    return (
      <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          Non hai i permessi per visualizzare questa pagina.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-[#050505] px-4 py-6 text-zinc-100">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          Gestione Categorie e Clienti
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Gestisci le categorie e i clienti disponibili per le ricette. I nomi
          vengono normalizzati per evitare duplicati.
        </p>
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Categories Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">
            Categorie
          </h2>

          {/* Add Category */}
          {canEditMetadata && (
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory();
                  } else if (e.key === 'Escape') {
                    setNewCategoryName('');
                  }
                }}
                placeholder="Nome categoria..."
                disabled={saving}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                disabled={saving || !newCategoryName.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Aggiungi
              </button>
            </div>
          )}

          {/* Categories List */}
          <div className="space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Nessuna categoria presente
              </p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 p-3"
                >
                  {editingCategoryId === category.id ? (
                    <>
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveCategory(category.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        disabled={saving}
                        className="flex-1 rounded-md border border-blue-500 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveCategory(category.id)}
                        disabled={saving || !editingCategoryName.trim()}
                        className="rounded px-2 py-1 text-xs text-green-400 hover:bg-green-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-zinc-200">
                        {category.name}
                      </span>
                      {canEditMetadata && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditCategory(category)}
                            disabled={saving}
                            className="rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(category.id)}
                            disabled={saving}
                            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Elimina
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Clients Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-6">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">Clienti</h2>

          {/* Add Client */}
          {canEditMetadata && (
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddClient();
                  } else if (e.key === 'Escape') {
                    setNewClientName('');
                  }
                }}
                placeholder="Nome cliente..."
                disabled={saving}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddClient}
                disabled={saving || !newClientName.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Aggiungi
              </button>
            </div>
          )}

          {/* Clients List */}
          <div className="space-y-2">
            {clients.length === 0 ? (
              <p className="text-sm text-zinc-500">Nessun cliente presente</p>
            ) : (
              clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 p-3"
                >
                  {editingClientId === client.id ? (
                    <>
                      <input
                        type="text"
                        value={editingClientName}
                        onChange={(e) => setEditingClientName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveClient(client.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        disabled={saving}
                        className="flex-1 rounded-md border border-blue-500 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveClient(client.id)}
                        disabled={saving || !editingClientName.trim()}
                        className="rounded px-2 py-1 text-xs text-green-400 hover:bg-green-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-zinc-200">
                        {client.name}
                      </span>
                      {canEditMetadata && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditClient(client)}
                            disabled={saving}
                            className="rounded px-2 py-1 text-xs text-blue-400 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClient(client.id)}
                            disabled={saving}
                            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Elimina
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
