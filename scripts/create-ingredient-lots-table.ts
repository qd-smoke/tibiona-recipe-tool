#!/usr/bin/env tsx
/**
 * Script to create dddev_ingredient_lots table
 * Stores lots linked to ingredient SKUs for autocomplete functionality
 *
 * Usage:
 *   pnpm tsx scripts/create-ingredient-lots-table.ts
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

type ParsedDatabaseUrl = {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
};

function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'mysql:') {
      throw new Error(
        `Invalid protocol: expected 'mysql:' but got '${urlObj.protocol}'`,
      );
    }
    if (!urlObj.hostname) {
      throw new Error('Missing hostname in DATABASE_URL');
    }
    const database = urlObj.pathname.replace(/^\//, '');
    if (!database) {
      throw new Error('Missing database name in DATABASE_URL');
    }
    return {
      user: decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      host: urlObj.hostname,
      port: urlObj.port ? parseInt(urlObj.port, 10) : 3306,
      database,
    };
  } catch (error) {
    throw new Error(
      `Invalid DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function createTable() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Error: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const config = parseDatabaseUrl(dbUrl);
  let connection: mysql.Connection | null = null;

  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
    });

    console.log('Connected to database');

    // Check if table already exists
    const [tables] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dddev_ingredient_lots'`,
      [config.database],
    );

    if (tables.length > 0) {
      console.log(
        'Table dddev_ingredient_lots already exists. Skipping creation.',
      );
      return;
    }

    // Create table
    const createTableSQL = `
      CREATE TABLE dddev_ingredient_lots (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        sku VARCHAR(100) NOT NULL,
        lot VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_sku_lot (sku, lot),
        INDEX idx_sku (sku),
        INDEX idx_lot (lot)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Stores lots linked to ingredient SKUs for autocomplete';
    `;

    await connection.execute(createTableSQL);
    console.log('✓ Table dddev_ingredient_lots created successfully');

    // Populate table with existing lots from dddev_recipe_ingredient
    console.log(
      'Populating table with existing lots from dddev_recipe_ingredient...',
    );
    const populateSQL = `
      INSERT IGNORE INTO dddev_ingredient_lots (sku, lot)
      SELECT DISTINCT sku, lot
      FROM dddev_recipe_ingredient
      WHERE lot IS NOT NULL AND lot != '' AND lot != 'NULL'
    `;

    const [result] = await connection.execute(populateSQL);
    const affectedRows = (result as mysql.ResultSetHeader).affectedRows;
    console.log(`✓ Populated table with ${affectedRows} existing lots`);
  } catch (error) {
    console.error('Error creating table:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

createTable().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
