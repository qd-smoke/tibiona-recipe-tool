import { useCallback, useSyncExternalStore } from 'react';

export type IngredientColumnId =
  | 'name'
  | 'sku'
  | 'qtyForRecipe'
  | 'qtyOriginal'
  | 'percentOnTotal'
  | 'percentOfPowder'
  | 'pricePerKg'
  | 'pricePerRecipe'
  | 'isPowder'
  | 'productName'
  | 'supplier'
  | 'warehouseLocation'
  | 'mpSku'
  | 'lot'
  | 'done'
  | 'checkGlutine'
  | 'action';

export type ColumnConfig = {
  id: IngredientColumnId;
  visible: boolean;
  width: number; // percentage
};

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', visible: true, width: 20 },
  { id: 'sku', visible: true, width: 8 },
  { id: 'qtyForRecipe', visible: true, width: 8 },
  { id: 'qtyOriginal', visible: true, width: 8 },
  { id: 'percentOnTotal', visible: true, width: 8 },
  { id: 'percentOfPowder', visible: true, width: 8 },
  { id: 'pricePerKg', visible: true, width: 8 },
  { id: 'pricePerRecipe', visible: true, width: 8 },
  { id: 'isPowder', visible: true, width: 8 },
  { id: 'productName', visible: true, width: 10 },
  { id: 'supplier', visible: true, width: 8 },
  { id: 'warehouseLocation', visible: true, width: 8 },
  { id: 'mpSku', visible: true, width: 8 },
  { id: 'lot', visible: true, width: 12 },
  { id: 'done', visible: true, width: 8 },
  { id: 'checkGlutine', visible: true, width: 8 },
  { id: 'action', visible: true, width: 8 },
];

export const INGREDIENT_COLUMN_IDS: IngredientColumnId[] = DEFAULT_COLUMNS.map(
  (column) => column.id,
);

const STORAGE_KEY = 'ingredient-table-columns';

type ColumnStoreSubscriber = () => void;

const isBrowser = () => typeof window !== 'undefined';

const loadPersistedColumns = (): ColumnConfig[] => {
  if (!isBrowser()) return DEFAULT_COLUMNS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(stored) as ColumnConfig[];
    const storedMap = new Map(parsed.map((c) => [c.id, c]));
    return DEFAULT_COLUMNS.map(
      (defaultCol) => storedMap.get(defaultCol.id) ?? defaultCol,
    );
  } catch (error) {
    console.warn('Failed to parse column config from localStorage', error);
    return DEFAULT_COLUMNS;
  }
};

const persistColumns = (columns: ColumnConfig[]) => {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch (error) {
    console.warn('Failed to save column config to localStorage', error);
  }
};

let columnStore: ColumnConfig[] = loadPersistedColumns();
const subscribers = new Set<ColumnStoreSubscriber>();

const notifySubscribers = () => {
  subscribers.forEach((subscriber) => subscriber());
};

const setColumnState = (updater: (prev: ColumnConfig[]) => ColumnConfig[]) => {
  columnStore = updater(columnStore);
  persistColumns(columnStore);
  notifySubscribers();
};

export function useIngredientTableColumns() {
  const columns = useSyncExternalStore(
    (callback) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
    () => columnStore,
    () => DEFAULT_COLUMNS,
  );

  const toggleColumn = useCallback((columnId: IngredientColumnId) => {
    setColumnState((prev) =>
      prev.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col,
      ),
    );
  }, []);

  const setColumnWidth = useCallback(
    (columnId: IngredientColumnId, width: number) => {
      setColumnState((prev) =>
        prev.map((col) => (col.id === columnId ? { ...col, width } : col)),
      );
    },
    [],
  );

  const resetColumns = useCallback(() => {
    setColumnState(() => DEFAULT_COLUMNS);
  }, []);

  const getColumn = useCallback(
    (columnId: IngredientColumnId) => columns.find((c) => c.id === columnId),
    [columns],
  );

  return {
    columns,
    toggleColumn,
    setColumnWidth,
    resetColumns,
    getColumn,
  };
}
