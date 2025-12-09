import React from 'react';
import { MagentoProductWithNutritionAttributes } from '@/types';
import Checkbox from './Checkbox';

export default function ProductPickerModal({
  open,
  onClose,
  onPickMany,
  existingSkus,
}: {
  open: boolean;
  onClose: () => void;
  onPickMany: (ps: MagentoProductWithNutritionAttributes[]) => void;
  existingSkus: Set<string>;
}) {
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(10);
  const [items, setItems] = React.useState<
    MagentoProductWithNutritionAttributes[]
  >([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<
    Map<number, MagentoProductWithNutritionAttributes>
  >(new Map());
  const inputRef = React.useRef<HTMLInputElement>(null);

  // debounce query
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  React.useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(
      `/api/products/search?includeNutritionAttributes=1&page=${page}&perPage=${perPage}&q=${encodeURIComponent(
        debouncedQ,
      )}`,
      { signal: ctrl.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        const data = json as {
          items: MagentoProductWithNutritionAttributes[];
          total: number;
        };
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message || 'Failed to fetch');
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [open, page, perPage, debouncedQ]);

  // reset page when perPage or query changes
  React.useEffect(() => {
    setPage(1);
  }, [perPage, debouncedQ]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) setSelected(new Map());
  }, [open]);

  if (!open) return null;

  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClose();
        }}
      />
      <div className="relative z-10 flex max-h-screen w-full max-w-[95vw] flex-col rounded-lg border border-gray-700 bg-gray-900 shadow-xl md:w-[900px]">
        <div className="flex items-center justify-between border-b border-gray-800 p-3">
          <h3 className="text-lg font-semibold text-gray-100">
            Select product
          </h3>
          <button
            className="rounded-md bg-gray-800 px-2 py-1 text-gray-200"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="p-3">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full">
              <input
                ref={inputRef}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 pr-12 text-gray-100"
                placeholder="Search by name or SKU"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute top-1/2 right-0 aspect-[1/1] h-full -translate-y-1/2 transform cursor-pointer rounded-r-md text-gray-300 hover:bg-gray-700 hover:text-white"
                  onClick={() => {
                    setQ('');
                    setPage(1);
                    inputRef.current?.focus();
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <label className="text-sm text-gray-300">
              Per page
              <select
                className="ml-2 rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-gray-100"
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>

          <div className="h-[min(30rem,80vh)] overflow-auto rounded-md border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-800 text-gray-300">
                <tr>
                  <th className="w-12 px-3 py-2">
                    <Checkbox
                      aria-label="Select all on page"
                      checked={(() => {
                        const selectable = items.filter(
                          (i) => !existingSkus.has(i.sku),
                        );
                        return (
                          selectable.length > 0 &&
                          selectable.every((i) => selected.has(i.entityId))
                        );
                      })()}
                      onChange={(e) => {
                        const selectable = items.filter(
                          (i) => !existingSkus.has(i.sku),
                        );
                        if (e.currentTarget.checked) {
                          const copy = new Map(selected);
                          for (const i of selectable) copy.set(i.entityId, i);
                          setSelected(copy);
                        } else {
                          const copy = new Map(selected);
                          for (const i of selectable) copy.delete(i.entityId);
                          setSelected(copy);
                        }
                      }}
                    />
                  </th>
                  <th className="w-24 px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Name</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-300" colSpan={3}>
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-3 py-4 text-red-300" colSpan={3}>
                      {error}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-400" colSpan={3}>
                      No products found
                    </td>
                  </tr>
                ) : (
                  items.map((p) => {
                    const isAlready = existingSkus.has(p.sku);
                    const isChecked = selected.has(p.entityId);
                    return (
                      <tr
                        key={p.entityId}
                        className={
                          'odd:bg-gray-950/40 ' +
                          (isAlready
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer hover:bg-gray-800')
                        }
                        onClick={() => {
                          if (isAlready) return;
                          setSelected((prev) => {
                            const copy = new Map(prev);
                            if (isChecked) copy.delete(p.entityId);
                            else copy.set(p.entityId, p);
                            return copy;
                          });
                        }}
                      >
                        <td className="px-3 py-2">
                          <Checkbox
                            disabled={isAlready}
                            checked={isChecked || isAlready}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              const checked = e.currentTarget.checked;
                              if (isAlready) return;
                              setSelected((prev) => {
                                const copy = new Map(prev);
                                if (checked) copy.set(p.entityId, p);
                                else copy.delete(p.entityId);
                                return copy;
                              });
                            }}
                            title={isAlready ? 'Already added' : undefined}
                            aria-label={`Select ${p.sku}`}
                          />
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-100">
                          {p.sku}
                        </td>
                        <td className="px-3 py-2 text-gray-100">
                          <div className="flex items-center gap-2">
                            <span>{p.name}</span>
                            {isAlready && (
                              <span className="rounded-md border border-green-700 bg-green-900/40 px-2 py-0.5 text-xs text-green-300">
                                Added
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid grid-cols-1 items-center gap-3 text-sm text-gray-300 md:grid-cols-3">
            <div className="mr-auto">
              {total > 0 ? (
                <span>
                  Showing {start}-{end} of {total}
                </span>
              ) : (
                <span>Nothing to show</span>
              )}
            </div>

            <div className="mx-auto flex items-center gap-2">
              <button
                className="cursor-pointer rounded-md bg-gray-800 px-3 py-1 text-gray-200 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span>
                Page {page} / {totalPages}
              </span>
              <button
                className="cursor-pointer rounded-md bg-gray-800 px-3 py-1 text-gray-200 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>

            <button
              className="w-full cursor-pointer rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50 md:ml-auto md:w-24"
              disabled={selected.size === 0}
              onClick={() => {
                const picked = Array.from(selected.values());
                onPickMany(picked);
                setSelected(new Map());
                onClose();
              }}
            >
              Add {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
