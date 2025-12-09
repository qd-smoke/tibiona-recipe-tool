import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import * as XLSX from 'xlsx';
import { db } from '@/db';
import {
  dddevProduction,
  dddevRecipeVersion,
  appPermissions,
  dddevRecipe,
} from '@/db/schema';

// Helper to check if a value is populated (not null, undefined, empty string, 0 for numbers, empty array)
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

// Helper to filter object to only populated fields
function filterPopulatedFields<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isPopulated(value)) {
      filtered[key as keyof T] = value as T[keyof T];
    }
  }
  return filtered;
}

// Map ingredient field names to Italian labels
function mapIngredientFieldName(key: string): string {
  const fieldMap: Record<string, string> = {
    supplier: 'Fornitore',
    productName: 'Materia Prima',
    mpSku: 'Mp_sku',
    lot: 'Lotto',
    checkGlutine: 'Check glutine',
    qtyForRecipe: 'Qty for recipe',
    qtyOriginal: 'Original Qty',
    sku: 'SKU',
    name: 'Nome',
  };
  return fieldMap[key] || key;
}

// GET /api/production/history/export
// Generates and downloads Excel XLSX file
export async function GET(_req: Request) {
  try {
    // Get all productions with related data (same query as history route)
    const productions = await db
      .select({
        production: {
          id: dddevProduction.id,
          recipeId: dddevProduction.recipeId,
          productionLot: dddevProduction.productionLot,
          startedAt: dddevProduction.startedAt,
          finishedAt: dddevProduction.finishedAt,
          status: dddevProduction.status,
          notes: dddevProduction.notes,
        },
        user: {
          id: appPermissions.id,
          displayName: appPermissions.displayName,
          username: appPermissions.username,
        },
        recipe: {
          id: dddevRecipe.id,
          name: dddevRecipe.name,
        },
        recipeVersion: {
          id: dddevRecipeVersion.id,
          versionNumber: dddevRecipeVersion.versionNumber,
          recipeSnapshot: dddevRecipeVersion.recipeSnapshot,
          ingredientsSnapshot: dddevRecipeVersion.ingredientsSnapshot,
        },
      })
      .from(dddevProduction)
      .leftJoin(
        dddevRecipeVersion,
        eq(dddevProduction.recipeVersionId, dddevRecipeVersion.id),
      )
      .leftJoin(appPermissions, eq(dddevProduction.userId, appPermissions.id))
      .leftJoin(dddevRecipe, eq(dddevProduction.recipeId, dddevRecipe.id))
      .orderBy(desc(dddevProduction.startedAt));

    // Parse snapshots and prepare data for Excel
    const productionRows: Record<string, unknown>[] = [];
    const ingredientRows: Record<string, unknown>[] = [];

    for (const item of productions) {
      let recipeSnapshot: Record<string, unknown> | null = null;
      let ingredients: unknown[] = [];

      try {
        if (item.recipeVersion?.recipeSnapshot) {
          recipeSnapshot = JSON.parse(
            item.recipeVersion.recipeSnapshot,
          ) as Record<string, unknown>;
        }
      } catch (error) {
        console.error(
          `Failed to parse recipe snapshot for production ${item.production.id}:`,
          error,
        );
      }

      try {
        if (item.recipeVersion?.ingredientsSnapshot) {
          ingredients = JSON.parse(
            item.recipeVersion.ingredientsSnapshot,
          ) as unknown[];
        }
      } catch (error) {
        console.error(
          `Failed to parse ingredients snapshot for production ${item.production.id}:`,
          error,
        );
      }

      // Build production row with fixed columns and dynamic recipe fields
      const productionRow: Record<string, unknown> = {
        'ID Produzione': item.production.id,
        'Nome Ricetta': item.recipe?.name || 'N/A',
        'Peso confezioni (g)': recipeSnapshot?.packageWeight ?? '',
        'Numero pacchetti': recipeSnapshot?.numberOfPackages ?? '',
        'Test glutine fatto':
          recipeSnapshot && recipeSnapshot.glutenTestDone ? 'Sì' : 'No',
      };

      productionRows.push(productionRow);

      // Add ingredient rows with mapped field names
      if (Array.isArray(ingredients)) {
        for (const ingredient of ingredients) {
          if (typeof ingredient === 'object' && ingredient !== null) {
            const filteredIngredient = filterPopulatedFields(
              ingredient as Record<string, unknown>,
            );
            const mappedIngredient: Record<string, unknown> = {
              'ID Produzione': item.production.id,
              Lotto: item.production.productionLot,
              'Nome Ricetta': item.recipe?.name || 'N/A',
            };
            // Map ingredient field names to Italian labels
            for (const [key, value] of Object.entries(filteredIngredient)) {
              const mappedKey = mapIngredientFieldName(key);
              mappedIngredient[mappedKey] = value;
            }
            ingredientRows.push(mappedIngredient);
          }
        }
      }
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Create "Produzioni" sheet
    const productionsSheet = XLSX.utils.json_to_sheet(productionRows);
    XLSX.utils.book_append_sheet(workbook, productionsSheet, 'Produzioni');

    // Create "Ingredienti" sheet if there are ingredients
    if (ingredientRows.length > 0) {
      const ingredientsSheet = XLSX.utils.json_to_sheet(ingredientRows);
      XLSX.utils.book_append_sheet(workbook, ingredientsSheet, 'Ingredienti');
    }

    // Generate Excel file buffer
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    // Create filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `storico-produzioni-${dateStr}.xlsx`;

    // Return Excel file as response
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('Export production history failed', e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: 'Failed to export production history',
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}
