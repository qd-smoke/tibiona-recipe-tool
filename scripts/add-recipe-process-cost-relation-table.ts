#!/usr/bin/env tsx

/**
 * Migration script: Add recipe_process_cost relation table
 *
 * This script:
 * 1. Creates the new dddev_recipe_process_cost table
 * 2. Migrates existing cost_type data from dddev_recipe_process to the new table
 * 3. Removes the cost_type column from dddev_recipe_process
 *
 * Usage: npx tsx scripts/add-recipe-process-cost-relation-table.ts [--execute]
 */

import { db } from '../src/db';
import { sql } from 'drizzle-orm';

const EXECUTE = process.argv.includes('--execute');

async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await db.execute<[{ count: number }]>(
    sql.raw(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = '${tableName}'
    `),
  );
  const rows = result[0] as unknown as Array<{ count: number }>;
  return (rows[0]?.count ?? 0) > 0;
}

async function checkColumnExists(
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await db.execute(
    sql.raw(`
      SELECT COUNT(*) as count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      AND table_name = '${tableName}'
      AND column_name = '${columnName}'
    `),
  );
  const rows = result[0] as unknown as Array<{ count: number }>;
  return (rows[0]?.count ?? 0) > 0;
}

async function main() {
  console.log('🔍 Checking database state...');

  const costTableExists = await checkTableExists('dddev_recipe_process_cost');
  const costTypeColumnExists = await checkColumnExists(
    'dddev_recipe_process',
    'cost_type',
  );

  if (costTableExists && !costTypeColumnExists) {
    console.log(
      '✅ Migration already completed. Table exists and column removed.',
    );
    return;
  }

  console.log('\n📋 Migration plan:');
  console.log('1. Create dddev_recipe_process_cost table');
  if (costTypeColumnExists) {
    console.log('2. Migrate existing cost_type data to new table');
    console.log('3. Remove cost_type column from dddev_recipe_process');
  } else {
    console.log('2. cost_type column already removed (skipping migration)');
  }

  if (!EXECUTE) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made');
    console.log('   Add --execute flag to run the migration');
    return;
  }

  console.log('\n🚀 Executing migration...');

  try {
    await db.transaction(async (tx) => {
      // Step 1: Create the new table
      if (!costTableExists) {
        console.log('Creating dddev_recipe_process_cost table...');
        await tx.execute(
          sql.raw(`
          CREATE TABLE dddev_recipe_process_cost (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            recipe_process_id INT UNSIGNED NOT NULL,
            cost_type VARCHAR(64) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY dddev_recipe_process_cost_unique (recipe_process_id, cost_type),
            KEY idx_recipe_process_id (recipe_process_id),
            KEY idx_cost_type (cost_type),
            CONSTRAINT fk_recipe_process_cost_recipe_process
              FOREIGN KEY (recipe_process_id)
              REFERENCES dddev_recipe_process(id)
              ON DELETE CASCADE
              ON UPDATE RESTRICT
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `),
        );
        console.log('✅ Table created');
      } else {
        console.log('✅ Table already exists');
      }

      // Step 2: Migrate existing data
      if (costTypeColumnExists) {
        console.log('Migrating existing cost_type data...');
        const migrated = await tx.execute(
          sql.raw(`
          INSERT INTO dddev_recipe_process_cost (recipe_process_id, cost_type)
          SELECT id, cost_type
          FROM dddev_recipe_process
          WHERE cost_type IS NOT NULL
          AND cost_type != ''
          ON DUPLICATE KEY UPDATE cost_type = VALUES(cost_type)
        `),
        );
        const migratedResult = migrated as unknown as { rowsAffected: number };
        console.log(
          `✅ Migrated ${migratedResult.rowsAffected || 0} cost associations`,
        );

        // Step 3: Remove the old column
        console.log('Removing cost_type column from dddev_recipe_process...');
        await tx.execute(
          sql.raw(`
          ALTER TABLE dddev_recipe_process
          DROP COLUMN cost_type
        `),
        );
        console.log('✅ Column removed');
      } else {
        console.log('⚠️  cost_type column not found (already removed?)');
      }
    });

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✨ Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
