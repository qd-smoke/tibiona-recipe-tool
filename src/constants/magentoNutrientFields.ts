export const MAGENTO_NUTRIENT_FIELDS = [
  { key: 'kj', label: 'Energia (kJ)', unit: 'kJ' },
  { key: 'kcal', label: 'Energia (kcal)', unit: 'kcal' },
  { key: 'protein', label: 'Proteine', unit: 'g' },
  { key: 'carbo', label: 'Carboidrati', unit: 'g' },
  { key: 'sugar', label: 'Zuccheri', unit: 'g' },
  { key: 'salt', label: 'Sale', unit: 'g' },
  { key: 'fiber', label: 'Fibre', unit: 'g' },
  { key: 'polyoli', label: 'Polioli', unit: 'g' },
  { key: 'fat', label: 'Grassi', unit: 'g' },
  { key: 'saturi', label: 'Grassi saturi', unit: 'g' },
] as const;

export type MagentoNutrientField = (typeof MAGENTO_NUTRIENT_FIELDS)[number];
