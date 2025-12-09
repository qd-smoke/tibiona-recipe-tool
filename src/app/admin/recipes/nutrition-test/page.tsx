'use client';

import React from 'react';
import NutritionInsightsPanel from '@/components/NutritionInsightsPanel';

const TEST_RECIPE_ID = 10;

export default function NutritionTestPage() {
  return (
    <NutritionInsightsPanel recipeId={TEST_RECIPE_ID} layout="standalone" />
  );
}
