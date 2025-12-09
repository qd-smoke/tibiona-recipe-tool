'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/helpers/api';
import type { RecipeVersion } from '@/types';

type RecipeVersionSelectorProps = {
  recipeId: number;
  currentVersion: number | null;
  onVersionSelect: (versionId: number | null) => void;
};

export function RecipeVersionSelector({
  recipeId,
  currentVersion,
  onVersionSelect,
}: RecipeVersionSelectorProps) {
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    currentVersion,
  );

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = (await apiClient.get(
        `/api/recipes/${recipeId}/versions`,
      )) as {
        ok?: boolean;
        versions?: RecipeVersion[];
        error?: string;
      };

      if (response?.ok && response.versions) {
        setVersions(response.versions);
      } else {
        throw new Error(response?.error || 'Errore sconosciuto');
      }
    } catch (err) {
      console.error('Failed to load versions', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Errore durante il caricamento delle versioni',
      );
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    setSelectedVersionId(currentVersion);
  }, [currentVersion]);

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'current') {
      setSelectedVersionId(null);
      onVersionSelect(null);
    } else {
      const versionId = Number(value);
      if (Number.isFinite(versionId) && versionId > 0) {
        setSelectedVersionId(versionId);
        onVersionSelect(versionId);
      }
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        Caricamento versioni...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        Errore: {error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor="version-selector"
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        Versione:
      </label>
      <select
        id="version-selector"
        value={selectedVersionId || 'current'}
        onChange={handleVersionChange}
        className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      >
        <option value="current">Versione corrente</option>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            Versione {version.versionNumber} - {formatDate(version.createdAt)}
          </option>
        ))}
      </select>
    </div>
  );
}
