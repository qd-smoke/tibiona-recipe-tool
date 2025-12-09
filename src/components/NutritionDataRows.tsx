import React from 'react';
import { IngredientNutritionAttributes } from '@/types';

interface NutritionDataRowsProps {
  sku: string;
  index: number;
  nutrition: IngredientNutritionAttributes | undefined;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  nutritionFields: readonly (keyof IngredientNutritionAttributes)[];
  onNutritionChange: (
    sku: string,
    field: keyof IngredientNutritionAttributes,
    value: number,
  ) => void;
}

export const NutritionDataRows: React.FC<NutritionDataRowsProps> = ({
  sku,
  index,
  nutrition,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  nutritionFields,
  onNutritionChange,
}) => {
  return (
    <>
      {/* Nutrition attributes header row */}
      <tr
        className={`${index % 2 === 0 ? 'bg-gray-950/40' : ''} text-xs ${isHovered ? '!bg-blue-900/30' : ''}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <td className="sticky left-0 z-10 w-64 px-3 py-1 text-gray-400 italic">
          Nutrition Attributes:
        </td>
        <td className="px-1 py-1 text-center text-gray-400">kcal</td>
        <td className="px-1 py-1 text-center text-gray-400">kj</td>
        <td className="px-1 py-1 text-center text-gray-400">protein</td>
        <td className="px-1 py-1 text-center text-gray-400">carbo</td>
        <td className="px-1 py-1 text-center text-gray-400">sugar</td>
        <td className="px-1 py-1 text-center text-gray-400">fiber</td>
        <td className="px-1 py-1 text-center text-gray-400">fat</td>
        <td className="px-1 py-1 text-center text-gray-400">saturi</td>
        <td className="px-1 py-1 text-center text-gray-400">salt</td>
        <td className="px-1 py-1 text-center text-gray-400">polioli</td>
      </tr>

      {/* Nutrition values row */}
      <tr
        className={`border-b border-gray-700 ${index % 2 === 0 ? 'bg-gray-950/40' : ''} text-xs ${isHovered ? '!bg-blue-900/30' : ''}`}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <td className="sticky left-0 z-10 w-64 px-3 py-1 text-gray-400 italic">
          Values per 100g:
        </td>
        {nutritionFields.map((field) => (
          <td key={field} className="px-1 py-1 pb-4 text-center">
            <input
              type="number"
              step="0.01"
              className="w-24 rounded border border-gray-600 bg-gray-800 px-1 py-0.5 text-center text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
              value={
                nutrition?.[field as keyof IngredientNutritionAttributes]
                  ?.value || 0
              }
              onChange={(e) =>
                onNutritionChange(sku, field, Number(e.target.value))
              }
            />
          </td>
        ))}
      </tr>
    </>
  );
};
