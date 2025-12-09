'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { MagentoProductWithNutritionAttributes } from '@/types';

type IngredientProductSearchProps = {
  value: string;
  onSelect: (product: MagentoProductWithNutritionAttributes) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
};

export function IngredientProductSearch({
  value,
  onSelect,
  onBlur,
  disabled = false,
  placeholder = 'Cerca prodotto...',
}: IngredientProductSearchProps) {
  const [query, setQuery] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [results, setResults] = useState<
    MagentoProductWithNutritionAttributes[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isProductSelected, setIsProductSelected] = useState(!!value);
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

  // Fetch products when debounced query changes
  useEffect(() => {
    // Don't search if a product is already selected and query matches the selected value
    if (isProductSelected && debouncedQuery === value) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
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
    fetch(
      `/api/products/search?includeNutritionAttributes=1&page=1&perPage=10&q=${encodeURIComponent(debouncedQuery)}`,
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (controller.signal.aborted) return;
        const data = json as {
          items: MagentoProductWithNutritionAttributes[];
          total: number;
        };
        setResults(data.items);
        setShowDropdown(data.items.length > 0);
        setSelectedIndex(-1);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          console.error('Product search failed', e);
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
  }, [debouncedQuery, isProductSelected, value]);

  // Update query when value prop changes externally
  useEffect(() => {
    setQuery(value);
    // If value is set externally and matches current query, mark as selected
    if (value && value.trim()) {
      setIsProductSelected(true);
    }
  }, [value]);

  const handleSelect = useCallback(
    (product: MagentoProductWithNutritionAttributes) => {
      console.log('[IngredientProductSearch] Product selected:', {
        sku: product.sku,
        name: product.name,
        cost_price_list: product.cost_price_list,
        weight: product.weight,
        supplier: product.supplier,
        warehouse_location: product.warehouse_location,
        fullProduct: product,
      });
      onSelect(product);
      const selectedValue = product.name || product.sku;
      setQuery(selectedValue);
      setIsProductSelected(true);
      setShowDropdown(false);
      setResults([]);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || results.length === 0) return;

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
            handleSelect(results[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowDropdown(false);
          inputRef.current?.blur();
          break;
      }
    },
    [showDropdown, results, selectedIndex, handleSelect],
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

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsProductSelected(false); // User is typing, reset selection state
          setShowDropdown(true);
        }}
        onFocus={() => {
          if (results.length > 0) {
            setShowDropdown(true);
          }
        }}
        onBlur={() => {
          // Delay to allow click on dropdown item
          setTimeout(() => {
            setShowDropdown(false);
            onBlur?.();
          }, 200);
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
      {loading && (
        <div className="absolute top-1/2 right-2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
        </div>
      )}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-0 z-50 mt-1 max-h-60 w-[400px] overflow-auto rounded-md border border-zinc-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {results.map((product, index) => (
            <button
              key={product.entityId}
              type="button"
              onClick={() => handleSelect(product)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:bg-gray-800 ${
                index === selectedIndex ? 'bg-gray-800' : ''
              }`}
            >
              <div className="font-medium break-words">
                {product.name || product.sku}
              </div>
              <div className="text-xs text-gray-400">SKU: {product.sku}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
