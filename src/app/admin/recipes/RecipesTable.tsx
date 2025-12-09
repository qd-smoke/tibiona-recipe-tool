'use client';
import React from 'react';
import Link from 'next/link';
import { useSetToast } from '@/state/ToastProvider';
import Checkbox from '@/components/Checkbox';
import { InlineEditableCell } from '@/components/InlineEditableCell';
import { ClientMultiSelect } from '@/components/ClientMultiSelect';
import { apiClient } from '@/helpers/api';
import { useProfile } from '@/contexts/ProfileContext';
import { canView, canEdit } from '@/lib/permissions/check';
import type { RecipeListItem, RecipeCategory, RecipeClient } from '@/types';

// Component for recipe name with link and edit functionality
function RecipeNameEditable({
  recipeId,
  name,
  onSave,
}: {
  recipeId: number;
  name: string;
  onSave: (newName: string | number | null) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(name);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setEditValue(name);
  }, [name]);

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditValue(name);
    setIsEditing(false);
    setError(null);
  };

  const handleSave = async () => {
    if (isSaving) return;

    const trimmedValue = editValue.trim();
    if (trimmedValue === name) {
      setIsEditing(false);
      return;
    }

    if (!trimmedValue) {
      setError('Il nome non può essere vuoto');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save';
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="w-full rounded border border-blue-500 bg-white px-2 py-1 text-sm text-zinc-900 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-100"
        />
        {isSaving && (
          <div className="absolute top-1/2 right-2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
          </div>
        )}
        {error && (
          <div className="absolute -bottom-5 left-0 text-xs text-red-500">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/recipes/${recipeId}`}
        className="flex-1 font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
      >
        {name}
      </Link>
      <button
        type="button"
        onClick={handleStartEdit}
        className="shrink-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-blue-600 dark:text-zinc-500 dark:hover:text-blue-400"
        title="Modifica nome (doppio click)"
        aria-label="Modifica nome ricetta"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>
    </div>
  );
}

type Props = {
  items: RecipeListItem[];
  loading?: boolean;
};

function isObjWithError(x: unknown): x is { error?: string } {
  return typeof x === 'object' && x !== null && 'error' in x;
}

export default function RecipesTable({
  items: incomingItems,
  loading = false,
}: Props) {
  const [items, setItems] = React.useState<RecipeListItem[]>(
    incomingItems ?? [],
  );
  const [query, setQuery] = React.useState('');
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<
    number | null | undefined
  >(undefined);
  const [selectedClientIds, setSelectedClientIds] = React.useState<
    number[] | undefined
  >(undefined);
  const [categories, setCategories] = React.useState<RecipeCategory[]>([]);
  const [clients, setClients] = React.useState<RecipeClient[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const headerCheckboxRef = React.useRef<HTMLInputElement | null>(null);
  const setToast = useSetToast();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { profile } = useProfile();

  // Check permissions
  const canViewCategory = canView(
    profile?.capabilities,
    'recipe.metadata.category',
  );
  const canEditCategory = canEdit(
    profile?.capabilities,
    'recipe.metadata.category',
  );
  const canViewClients = canView(
    profile?.capabilities,
    'recipe.metadata.clients',
  );
  const canEditClients = canEdit(
    profile?.capabilities,
    'recipe.metadata.clients',
  );
  const canEditName = canEdit(profile?.capabilities, 'recipe.basic.name');
  const canCreateClients = canEdit(profile?.capabilities, 'admin.permissions');

  React.useEffect(() => {
    setItems(incomingItems ?? []);
  }, [incomingItems]);

  // Load categories and clients
  const loadCategories = React.useCallback(async () => {
    try {
      const response = (await apiClient.get('/api/recipes/categories')) as {
        categories: RecipeCategory[];
      };
      setCategories(response.categories || []);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setToast('Errore nel caricamento delle categorie', { type: 'error' });
    }
  }, [setToast]);

  const loadClients = React.useCallback(async () => {
    try {
      const response = (await apiClient.get('/api/recipes/clients')) as {
        clients: RecipeClient[];
      };
      setClients(response.clients || []);
    } catch (err) {
      console.error('Failed to load clients:', err);
      setToast('Errore nel caricamento dei clienti', { type: 'error' });
    }
  }, [setToast]);

  React.useEffect(() => {
    if (canViewCategory || canViewClients) {
      if (canViewCategory && categories.length === 0) {
        loadCategories();
      }
      if (canViewClients && clients.length === 0) {
        loadClients();
      }
    }
  }, [
    canViewCategory,
    canViewClients,
    categories.length,
    clients.length,
    loadCategories,
    loadClients,
  ]);

  const filtered = React.useMemo(() => {
    let result = items;

    // Filter by name
    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => r.name?.toLowerCase().includes(q));
    }

    // Filter by category
    if (selectedCategoryId !== undefined && selectedCategoryId !== null) {
      result = result.filter((r) => r.categoryId === selectedCategoryId);
    }

    // Filter by clients
    if (selectedClientIds !== undefined && selectedClientIds.length > 0) {
      result = result.filter((r) => {
        const recipeClientIds = r.clientIds || [];
        return selectedClientIds.some((id) => recipeClientIds.includes(id));
      });
    }

    return result;
  }, [items, query, selectedCategoryId, selectedClientIds]);

  const handleSaveName = async (
    recipeId: number,
    newName: string | number | null,
  ) => {
    if (typeof newName !== 'string' || !newName.trim()) {
      throw new Error('Il nome non può essere vuoto');
    }

    const response = await apiClient.put(`/api/recipes/${recipeId}/metadata`, {
      name: newName.trim(),
    });

    if (!response || (response as { error?: string }).error) {
      throw new Error(
        (response as { error?: string }).error || 'Errore nel salvataggio',
      );
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === recipeId ? { ...item, name: newName.trim() } : item,
      ),
    );
    setToast('Nome aggiornato', { type: 'success' });
  };

  const handleSaveSku = async (
    recipeId: number,
    newSku: string | number | null,
  ) => {
    const skuValue = typeof newSku === 'string' ? newSku.trim() || null : null;

    const response = await apiClient.put(`/api/recipes/${recipeId}/metadata`, {
      sku: skuValue,
    });

    if (!response || (response as { error?: string }).error) {
      throw new Error(
        (response as { error?: string }).error || 'Errore nel salvataggio',
      );
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === recipeId ? { ...item, sku: skuValue } : item,
      ),
    );
    setToast('Codice SKU aggiornato', { type: 'success' });
  };

  const handleSaveCategory = async (
    recipeId: number,
    categoryId: string | number | null,
  ) => {
    const numCategoryId =
      categoryId === null || categoryId === '' || categoryId === 'null'
        ? null
        : Number(categoryId);

    if (
      categoryId !== null &&
      categoryId !== '' &&
      categoryId !== 'null' &&
      (numCategoryId === null ||
        !Number.isFinite(numCategoryId) ||
        numCategoryId <= 0)
    ) {
      throw new Error('Categoria non valida');
    }

    const response = await apiClient.put(`/api/recipes/${recipeId}/metadata`, {
      categoryId: numCategoryId,
    });

    if (!response || (response as { error?: string }).error) {
      throw new Error(
        (response as { error?: string }).error || 'Errore nel salvataggio',
      );
    }

    const categoryName =
      numCategoryId !== null
        ? categories.find((c) => c.id === numCategoryId)?.name || null
        : null;

    setItems((prev) =>
      prev.map((item) =>
        item.id === recipeId
          ? { ...item, categoryId: numCategoryId, categoryName }
          : item,
      ),
    );
    setToast('Categoria aggiornata', { type: 'success' });
  };

  const handleSaveClients = async (recipeId: number, clientIds: number[]) => {
    const response = await apiClient.put(`/api/recipes/${recipeId}/metadata`, {
      clientIds,
    });

    if (!response || (response as { error?: string }).error) {
      throw new Error(
        (response as { error?: string }).error || 'Errore nel salvataggio',
      );
    }

    const clientNames = clients
      .filter((c) => clientIds.includes(c.id))
      .map((c) => c.name);

    setItems((prev) =>
      prev.map((item) =>
        item.id === recipeId ? { ...item, clientIds, clientNames } : item,
      ),
    );
    setToast('Clienti aggiornati', { type: 'success' });
  };

  const visibleIds = React.useMemo(() => filtered.map((r) => r.id), [filtered]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected, filtered]);

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/recipes/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        let apiErr = '';
        try {
          const j: unknown = await res.json();
          if (isObjWithError(j) && j.error) apiErr = j.error;
        } catch {}
        throw new Error(apiErr || `Delete failed (${res.status})`);
      }
      const j = (await res.json()) as { deletedCount?: number };
      setItems((prev) => prev.filter((it) => !ids.includes(it.id)));
      setSelectedIds(new Set());
      setToast(
        `Eliminate ${j.deletedCount ?? ids.length} ricetta${
          (j.deletedCount ?? ids.length) === 1 ? '' : 'e'
        }`,
        { type: 'success' },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      setToast(msg, { type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-2.5 left-3 text-sm text-zinc-400 dark:text-zinc-500">
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per nome..."
            className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pr-10 pl-9 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder-zinc-500"
            aria-label="Search recipes by name"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute top-2.5 right-3 text-xs font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-white"
            >
              Reset
            </button>
          )}
        </div>
        <div className="text-xs text-zinc-600 dark:text-zinc-500">
          {filtered.length} risultati
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-xs text-blue-100">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">
              {selectedIds.size} selezionate
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full border border-blue-300/50 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase hover:bg-blue-400/10"
            >
              Cancella selezione
            </button>
          </div>

          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-[11px] font-semibold tracking-wide text-white uppercase hover:bg-red-500 disabled:opacity-60"
            aria-label="Delete selected recipes"
          >
            {isDeleting ? 'Eliminazione...' : 'Elimina selezionate'}
          </button>
        </div>
      )}

      {/* Filters */}
      {(canViewCategory || canViewClients) && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
          {canViewCategory && (
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="category-filter"
                className="mb-1 block text-xs font-semibold text-zinc-600 uppercase dark:text-zinc-400"
              >
                Filtra per Categoria
              </label>
              <select
                id="category-filter"
                value={selectedCategoryId ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedCategoryId(
                    value === ''
                      ? undefined
                      : value === 'null'
                        ? null
                        : Number(value),
                  );
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">Tutte le categorie</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {canViewClients && (
            <div className="min-w-[200px] flex-1">
              <label
                htmlFor="client-filter"
                className="mb-1 block text-xs font-semibold text-zinc-600 uppercase dark:text-zinc-400"
              >
                Filtra per Cliente
              </label>
              <select
                id="client-filter"
                value={
                  selectedClientIds && selectedClientIds.length > 0
                    ? selectedClientIds[0]
                    : ''
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedClientIds(
                    value === '' ? undefined : [Number(value)],
                  );
                }}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">Tutti i clienti</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(selectedCategoryId !== undefined ||
            (selectedClientIds !== undefined &&
              selectedClientIds.length > 0)) && (
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId(undefined);
                  setSelectedClientIds(undefined);
                }}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Reset filtri
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-900/60 dark:bg-black/20">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-900">
          <thead className="bg-zinc-50 dark:bg-zinc-950/60">
            <tr>
              <th className="w-12 px-4 py-3 text-left font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
                <Checkbox
                  ref={headerCheckboxRef}
                  aria-label="Select all visible recipes"
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  disabled={loading || filtered.length === 0}
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
                SKU
              </th>
              <th className="px-4 py-3 text-left font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
                Nome
              </th>
              {canViewCategory && (
                <th className="px-4 py-3 text-left font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
                  Categoria
                </th>
              )}
              {canViewClients && (
                <th className="px-4 py-3 text-left font-semibold tracking-wider text-zinc-600 uppercase dark:text-zinc-400">
                  Clienti
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-900/60">
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="transition hover:bg-blue-50 hover:text-zinc-900 dark:hover:bg-blue-500/5 dark:hover:text-white"
              >
                <td
                  className={`w-12 px-4 py-3 ${
                    loading ? '' : 'cursor-pointer'
                  }`}
                  onClick={(event) => {
                    if (loading) return;
                    if (event.target instanceof HTMLInputElement) return;
                    toggleOne(r.id);
                  }}
                >
                  <Checkbox
                    aria-label={`Select recipe ${r.name}`}
                    checked={selectedIds.has(r.id)}
                    disabled={loading}
                    onChange={() => {
                      if (loading) return;
                      toggleOne(r.id);
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  {canEditName ? (
                    <InlineEditableCell
                      value={r.sku ?? null}
                      onSave={(newSku) => handleSaveSku(r.id, newSku)}
                      type="text"
                      placeholder="Codice SKU"
                    />
                  ) : (
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {r.sku || '—'}
                    </span>
                  )}
                </td>
                <td className="group px-4 py-3">
                  {canEditName ? (
                    <RecipeNameEditable
                      recipeId={r.id}
                      name={r.name}
                      onSave={(newName) => handleSaveName(r.id, newName)}
                    />
                  ) : (
                    <Link
                      href={`/recipes/${r.id}`}
                      className="font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
                    >
                      {r.name}
                    </Link>
                  )}
                </td>
                {canViewCategory && (
                  <td className="px-4 py-3">
                    {canEditCategory ? (
                      <InlineEditableCell
                        value={r.categoryId ?? null}
                        displayValue={r.categoryName ?? undefined}
                        onSave={(categoryId) =>
                          handleSaveCategory(r.id, categoryId)
                        }
                        type="select"
                        options={categories}
                      />
                    ) : (
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {r.categoryName || '—'}
                      </span>
                    )}
                  </td>
                )}
                {canViewClients && (
                  <td className="px-4 py-3">
                    {canEditClients ? (
                      <ClientMultiSelect
                        value={r.clientIds || []}
                        onSave={(clientIds) =>
                          handleSaveClients(r.id, clientIds)
                        }
                        canCreateNew={canCreateClients}
                        displayNames={r.clientNames}
                      />
                    ) : (
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {r.clientNames && r.clientNames.length > 0
                          ? r.clientNames.join(', ')
                          : '—'}
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {loading && (
              <tr>
                <td
                  colSpan={
                    3 + (canViewCategory ? 1 : 0) + (canViewClients ? 1 : 0)
                  }
                  className="px-4 py-6 text-center text-sm text-zinc-500"
                >
                  Caricamento ricette...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={
                    3 + (canViewCategory ? 1 : 0) + (canViewClients ? 1 : 0)
                  }
                  className="px-4 py-6 text-center text-sm text-zinc-500"
                >
                  {items.length === 0
                    ? 'Nessuna ricetta presente'
                    : 'Nessun risultato per questa ricerca'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
