'use client';
import React from 'react';
import { apiClient } from '@/helpers/api';
import type { RecipeClient } from '@/types';

type ClientMultiSelectProps = {
  value: number[]; // Array of client IDs
  onSave: (clientIds: number[]) => Promise<void>;
  disabled?: boolean;
  className?: string;
  canCreateNew?: boolean; // Whether user can create new clients
  displayNames?: string[]; // Client names to display when not in edit mode
};

export function ClientMultiSelect({
  value,
  onSave,
  disabled = false,
  className = '',
  canCreateNew = false,
  displayNames,
}: ClientMultiSelectProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<number[]>(value);
  const [availableClients, setAvailableClients] = React.useState<
    RecipeClient[]
  >([]);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false); // Used in setLoading() calls
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Load available clients on mount (needed for display mode too)
  React.useEffect(() => {
    if (availableClients.length === 0) {
      loadClients();
    }
    // availableClients.length is intentionally excluded to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload clients when editing starts to ensure fresh data
  React.useEffect(() => {
    if (isEditing && availableClients.length === 0) {
      loadClients();
    }
    // availableClients.length is intentionally excluded - we only want to reload when editing starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  // Sync selectedIds with value prop
  React.useEffect(() => {
    setSelectedIds(value);
  }, [value]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = (await apiClient.get('/api/recipes/clients')) as {
        clients: RecipeClient[];
      };
      setAvailableClients(response.clients || []);
    } catch (err) {
      console.error('Failed to load clients:', err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = () => {
    if (disabled) return;
    setIsEditing(true);
    setError(null);
    setQuery('');
  };

  const handleCancel = () => {
    setSelectedIds(value);
    setIsEditing(false);
    setQuery('');
    setError(null);
  };

  const handleSave = async () => {
    if (disabled || isSaving) return;

    // Check if value actually changed
    const currentIds = [...value].sort();
    const newIds = [...selectedIds].sort();
    if (
      currentIds.length === newIds.length &&
      currentIds.every((id, idx) => id === newIds[idx])
    ) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(selectedIds);
      setIsEditing(false);
      setQuery('');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to save';
      setError(errorMessage);
      // Keep editing mode open on error so user can retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      const relatedTarget = e.relatedTarget as Node | null;
      if (
        !containerRef.current?.contains(document.activeElement) &&
        !dropdownRef.current?.contains(document.activeElement) &&
        !containerRef.current?.contains(relatedTarget) &&
        !dropdownRef.current?.contains(relatedTarget)
      ) {
        handleSave();
      }
    }, 200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim() && canCreateNew) {
        handleCreateNew(query.trim());
      } else {
        handleSave();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const toggleClient = (clientId: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(clientId)) {
        return prev.filter((id) => id !== clientId);
      } else {
        return [...prev, clientId];
      }
    });
    setQuery('');
    inputRef.current?.focus();
  };

  const removeClient = (clientId: number) => {
    setSelectedIds((prev) => prev.filter((id) => id !== clientId));
  };

  const handleCreateNew = async (name: string) => {
    if (!canCreateNew || !name.trim()) return;

    try {
      setLoading(true);
      const response = (await apiClient.post('/api/recipes/clients', {
        name: name.trim(),
      })) as { client: RecipeClient };

      const newClient = response.client;
      setAvailableClients((prev) => [...prev, newClient]);
      setSelectedIds((prev) => [...prev, newClient.id]);
      setQuery('');
      inputRef.current?.focus();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to create client';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Filter clients based on query
  const filteredClients = React.useMemo(() => {
    if (!query.trim()) {
      return availableClients.filter(
        (client) => !selectedIds.includes(client.id),
      );
    }
    const q = query.toLowerCase();
    return availableClients.filter(
      (client) =>
        !selectedIds.includes(client.id) &&
        client.name.toLowerCase().includes(q),
    );
  }, [availableClients, selectedIds, query]);

  // Get selected client names
  const selectedClients = React.useMemo(() => {
    return availableClients.filter((client) => selectedIds.includes(client.id));
  }, [availableClients, selectedIds]);

  // Display mode text - use displayNames prop if available, otherwise use selectedClients
  const displayText = React.useMemo(() => {
    if (displayNames && displayNames.length > 0) {
      return displayNames.join(', ');
    }
    if (selectedClients.length > 0) {
      return selectedClients.map((c) => c.name).join(', ');
    }
    return 'Nessun cliente';
  }, [displayNames, selectedClients]);

  if (isEditing) {
    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <div className="flex flex-wrap gap-1 rounded border border-blue-500 bg-white px-2 py-1 text-sm dark:bg-zinc-900">
          {/* Selected clients as tags */}
          {selectedClients.map((client) => (
            <span
              key={client.id}
              className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
            >
              {client.name}
              <button
                type="button"
                onClick={() => removeClient(client.id)}
                className="hover:text-blue-600 dark:hover:text-blue-100"
                aria-label={`Remove ${client.name}`}
              >
                ×
              </button>
            </span>
          ))}

          {/* Input for search/create */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              if (
                filteredClients.length > 0 ||
                (query.trim() && canCreateNew)
              ) {
                setShowDropdown(true);
              }
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={isSaving || disabled}
            placeholder={
              selectedClients.length === 0
                ? 'Aggiungi clienti...'
                : 'Cerca o aggiungi...'
            }
            className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />

          {isSaving && (
            <div className="flex items-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
            </div>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown &&
          (filteredClients.length > 0 || (query.trim() && canCreateNew)) && (
            <div
              ref={dropdownRef}
              className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => toggleClient(client.id)}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-900 hover:bg-blue-50 dark:text-zinc-100 dark:hover:bg-blue-500/10"
                >
                  {client.name}
                </button>
              ))}
              {query.trim() &&
                canCreateNew &&
                !availableClients.some(
                  (c) => c.name.toLowerCase() === query.toLowerCase(),
                ) && (
                  <button
                    type="button"
                    onClick={() => handleCreateNew(query.trim())}
                    className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                  >
                    + Crea &ldquo;{query.trim()}&rdquo;
                  </button>
                )}
              {loading && (
                <div className="px-3 py-2 text-sm text-zinc-500">
                  Caricamento...
                </div>
              )}
              {!loading &&
                filteredClients.length === 0 &&
                !query.trim() &&
                !canCreateNew && (
                  <div className="px-3 py-2 text-sm text-zinc-500">
                    Nessun cliente disponibile
                  </div>
                )}
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
    <div
      onClick={handleStartEdit}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleStartEdit();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`cursor-pointer rounded px-2 py-1 text-sm transition-colors hover:bg-blue-50 hover:text-zinc-900 dark:hover:bg-blue-500/5 dark:hover:text-white ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`}
      title={disabled ? '' : 'Click to edit'}
    >
      {displayText}
    </div>
  );
}
