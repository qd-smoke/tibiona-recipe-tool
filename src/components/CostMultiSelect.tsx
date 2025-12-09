'use client';
import React from 'react';
import type { ProcessCostType } from '@/types';
import { COST_TYPE_LABELS, PARAMETER_TYPE_LABELS } from '@/types';

type CostMultiSelectProps = {
  value: ProcessCostType[]; // Array of cost types
  onChange: (costTypes: ProcessCostType[]) => void;
  availableCostTypes: ProcessCostType[];
  disabled?: boolean;
  className?: string;
};

export function CostMultiSelect({
  value,
  onChange,
  availableCostTypes,
  disabled = false,
  className = '',
}: CostMultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedCostTypes, setSelectedCostTypes] =
    React.useState<ProcessCostType[]>(value);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Sync selectedCostTypes with value prop
  React.useEffect(() => {
    setSelectedCostTypes(value);
  }, [value]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleToggleCost = (costType: ProcessCostType) => {
    const newSelection = selectedCostTypes.includes(costType)
      ? selectedCostTypes.filter((ct) => ct !== costType)
      : [...selectedCostTypes, costType];
    setSelectedCostTypes(newSelection);
    onChange(newSelection);
  };

  const getCostLabel = (costType: ProcessCostType): string => {
    if (costType === 'hourly_labor') {
      return COST_TYPE_LABELS[costType];
    }
    return (
      PARAMETER_TYPE_LABELS[costType as keyof typeof PARAMETER_TYPE_LABELS] ||
      costType
    );
  };

  if (disabled) {
    // Display mode: show tags
    if (selectedCostTypes.length === 0) {
      return (
        <span className="text-sm text-zinc-500 dark:text-gray-400">-</span>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {selectedCostTypes.map((costType) => (
          <span
            key={costType}
            className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-100"
          >
            {getCostLabel(costType)}
          </span>
        ))}
      </div>
    );
  }

  // Edit mode: dropdown with checkboxes
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Display selected costs as tags */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[2rem] cursor-pointer flex-wrap gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        {selectedCostTypes.length === 0 ? (
          <span className="text-zinc-500 dark:text-gray-400">
            Seleziona costi...
          </span>
        ) : (
          selectedCostTypes.map((costType) => (
            <span
              key={costType}
              className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/60 dark:text-blue-100"
            >
              {getCostLabel(costType)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCost(costType);
                }}
                className="ml-1 inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-200 dark:hover:text-blue-50"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-300 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {availableCostTypes.map((costType) => {
            const isSelected = selectedCostTypes.includes(costType);
            return (
              <label
                key={costType}
                className="flex cursor-pointer items-center px-3 py-2 hover:bg-zinc-50 dark:hover:bg-gray-700"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleCost(costType)}
                  className="mr-2 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <span className="text-sm text-zinc-900 dark:text-gray-100">
                  {getCostLabel(costType)}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
