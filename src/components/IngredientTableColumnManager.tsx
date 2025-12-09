'use client';

import React, { useMemo, useState } from 'react';
import {
  useIngredientTableColumns,
  type IngredientColumnId,
} from '@/hooks/useIngredientTableColumns';

const COLUMN_LABELS: Record<IngredientColumnId, string> = {
  name: 'Ingrediente',
  sku: 'SKU',
  qtyForRecipe: 'Qty ricetta (g)',
  qtyOriginal: 'Qty base (g)',
  percentOnTotal: '% on total',
  percentOfPowder: '% of powder',
  pricePerKg: '€ / kg',
  pricePerRecipe: '€ / recipe',
  isPowder: 'is powder',
  productName: 'Materia Prima',
  supplier: 'Fornitore',
  warehouseLocation: 'Locazione',
  mpSku: 'Mp_Sku',
  lot: 'Lotto',
  done: 'Fatto',
  checkGlutine: 'CheckGlutine',
  action: 'Action',
};

type IngredientTableColumnManagerProps = {
  onClose?: () => void;
  allowedColumns?: IngredientColumnId[];
};

export function IngredientTableColumnManager({
  onClose,
  allowedColumns,
}: IngredientTableColumnManagerProps) {
  const { columns, toggleColumn, setColumnWidth, resetColumns } =
    useIngredientTableColumns();
  const [draggingColumn, setDraggingColumn] =
    useState<IngredientColumnId | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWidth, setDragStartWidth] = useState(0);
  const visibleColumns = useMemo(() => {
    if (allowedColumns && allowedColumns.length > 0) {
      return columns.filter((col) => allowedColumns.includes(col.id));
    }
    return columns;
  }, [allowedColumns, columns]);

  const handleMouseDown = (
    e: React.MouseEvent,
    columnId: IngredientColumnId,
  ) => {
    e.preventDefault();
    const column = columns.find((c) => c.id === columnId);
    if (!column) return;
    setDraggingColumn(columnId);
    setDragStartX(e.clientX);
    setDragStartWidth(column.width);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingColumn) return;
    const deltaX = e.clientX - dragStartX;
    // Convert pixel delta to percentage (rough estimate: 1% ≈ 10px for a 1000px table)
    const deltaPercent = (deltaX / 10) * 0.1;
    const newWidth = Math.max(5, Math.min(50, dragStartWidth + deltaPercent));
    setColumnWidth(draggingColumn, newWidth);
  };

  const handleMouseUp = () => {
    setDraggingColumn(null);
  };

  React.useEffect(() => {
    if (draggingColumn) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingColumn, dragStartX, dragStartWidth]);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Gestione Colonne
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ✕
          </button>
        )}
      </div>
      <div className="space-y-2">
        {visibleColumns.map((column) => (
          <div
            key={column.id}
            className="flex items-center gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-700"
          >
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                checked={column.visible}
                onChange={() => toggleColumn(column.id)}
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
              />
              <span className="text-sm text-zinc-900 dark:text-zinc-100">
                {COLUMN_LABELS[column.id]}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {column.width.toFixed(1)}%
              </span>
              <div
                className="h-4 w-1 cursor-col-resize rounded bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                onMouseDown={(e) => handleMouseDown(e, column.id)}
                role="button"
                tabIndex={0}
                aria-label={`Ridimensiona colonna ${COLUMN_LABELS[column.id]}`}
              />
            </div>
          </div>
        ))}
        {visibleColumns.length === 0 && (
          <p className="text-xs text-zinc-500">
            Nessuna colonna disponibile con i permessi correnti.
          </p>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={resetColumns}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Reset colonne
        </button>
      </div>
    </div>
  );
}
