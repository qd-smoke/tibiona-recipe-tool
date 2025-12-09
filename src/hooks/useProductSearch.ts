'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from './useDebounce';

type ProductOption = { entity_id: number; name: string | null; sku: string };

const cache = new Map<string, ProductOption[]>(); // simple per-session cache

export function useProductSearch(query: string, limit = 20) {
  const debounced = useDebounce(query, 300);
  const [data, setData] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const key = useMemo(() => `${debounced}|${limit}`, [debounced, limit]);

  useEffect(() => {
    if (!debounced || debounced.length < 2) {
      // When query is too short, ensure no pending request and reset state deterministically
      controllerRef.current?.abort();
      setLoading(false);
      setData([]);
      setError(null);
      return;
    }

    // cache hit
    if (cache.has(key)) {
      // Serve immediately and ensure loading is not shown
      setLoading(false);
      setData(cache.get(key)!);
      return;
    }

    // abort previous request
    controllerRef.current?.abort();
    const ctrl = new AbortController();
    controllerRef.current = ctrl;

    setLoading(true);
    setError(null);

    fetch(
      `/api/products/search?q=${encodeURIComponent(debounced)}&limit=${limit}`,
      {
        signal: ctrl.signal,
      },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: ProductOption[]) => {
        cache.set(key, json);
        setData(json);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message || 'Failed to fetch');
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [key, debounced, limit]);

  return { data, loading, error };
}
