#!/usr/bin/env tsx
/**
 * Script to add 'done' field to dddev_recipe_ingredient table
 *
 * Usage:
 *   pnpm tsx scripts/add-done-field-to-ingredients.ts
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

async function addDoneField() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  let connection: mysql.Connection | undefined;
  try {
    const dbConfig = parseDatabaseUrl(databaseUrl);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    // Check if column already exists
    const [columns] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'dddev_recipe_ingredient' 
       AND COLUMN_NAME = 'done'`,
      [dbConfig.database],
    );

    if (columns.length > 0) {
      console.log('✓ Column "done" already exists in dddev_recipe_ingredient');
      return;
    }

    // Add done column before checkGlutine
    const alterSql = `
      ALTER TABLE dddev_recipe_ingredient
      ADD COLUMN done TINYINT NOT NULL DEFAULT 0
      AFTER lot;
    `;
    await connection.execute(alterSql);
    console.log(
      '✓ Column "done" added successfully to dddev_recipe_ingredient',
    );
  } catch (error) {
    console.error('Error adding done field:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

addDoneField();
