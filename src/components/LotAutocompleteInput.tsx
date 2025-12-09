'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/helpers/api';

type LotAutocompleteInputProps = {
  sku: string;
  value: string;
  onChange: (lot: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

type LotResult = {
  lot: string;
  lastUsedAt: string | null;
};

export function LotAutocompleteInput({
  sku,
  value,
  onChange,
  disabled = false,
  placeholder = 'Inserisci lotto...',
}: LotAutocompleteInputProps) {
  const [query, setQuery] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [results, setResults] = useState<LotResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch lots when debounced query changes
  useEffect(() => {
    if (!sku || !sku.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    const searchQuery = debouncedQuery.trim() || '';
    const url = `/api/ingredient-lots?sku=${encodeURIComponent(sku)}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ''}`;

    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        if (controller.signal.aborted) return null;
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (controller.signal.aborted || !json) return;
        const data = json as {
          ok?: boolean;
          lots?: LotResult[];
          error?: string;
        };
        if (data.ok && data.lots) {
          setResults(data.lots);
          setShowDropdown(data.lots.length > 0 && searchQuery.length > 0);
        } else {
          setResults([]);
          setShowDropdown(false);
        }
        setSelectedIndex(-1);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          console.error('Lot search failed', e);
          setResults([]);
          setShowDropdown(false);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [sku, debouncedQuery]);

  // Update query when value prop changes externally
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleSelect = useCallback(
    async (lot: string) => {
      setQuery(lot);
      onChange(lot);
      setShowDropdown(false);
      setResults([]);
      inputRef.current?.blur();

      // Save lot to database
      try {
        await apiClient.post('/api/ingredient-lots', {
          sku,
          lot,
        });
      } catch (error) {
        console.error('Failed to save lot:', error);
        // Don't show error to user, lot is still set in the input
      }
    },
    [onChange, sku],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || results.length === 0) {
        if (e.key === 'Enter' && query.trim()) {
          // Allow manual entry
          handleSelect(query.trim());
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            handleSelect(results[selectedIndex].lot);
          } else if (query.trim()) {
            handleSelect(query.trim());
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          inputRef.current?.blur();
          break;
      }
    },
    [showDropdown, results, selectedIndex, query, handleSelect],
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => {
          if (results.length > 0 && query.trim()) {
            setShowDropdown(true);
          }
        }}
        onBlur={() => {
          // Delay to allow click on dropdown item
          setTimeout(() => {
            setShowDropdown(false);
          }, 200);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
      />
      {loading && (
        <div className="absolute top-1/2 right-2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500 dark:border-gray-600" />
        </div>
      )}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {results.map((result, index) => (
            <button
              key={`${result.lot}-${index}`}
              type="button"
              onClick={() => handleSelect(result.lot)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-3 py-2 text-left text-sm text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-gray-200 dark:hover:bg-gray-800 ${
                index === selectedIndex ? 'bg-zinc-100 dark:bg-gray-800' : ''
              }`}
            >
              <div className="font-medium">{result.lot}</div>
              {result.lastUsedAt && (
                <div className="text-xs text-zinc-500 dark:text-gray-400">
                  Usato: {formatDate(result.lastUsedAt)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
