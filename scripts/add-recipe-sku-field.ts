#!/usr/bin/env tsx
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
    if (error instanceof TypeError && error.message.includes('Invalid URL')) {
      throw new Error(`Invalid DATABASE_URL format: ${url}`);
    }
    throw error;
  }
}

async function columnExists(
  connection: mysql.Connection,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  // Escape table and column names for safety
  const escapedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
  const escapedColumnName = columnName.replace(/[^a-zA-Z0-9_]/g, '');
  const [rows] = await connection.execute(
    `SHOW COLUMNS FROM ${escapedTableName} LIKE '${escapedColumnName}'`,
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function addRecipeSkuField() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const shouldExecute = process.argv.includes('--execute');
  if (!shouldExecute) {
    console.log('This script will add the following database change:');
    console.log('  1. Add column sku to dddev_recipe');
    console.log('\nRun with --execute flag to apply changes.');
    process.exit(0);
  }

  let connection: mysql.Connection | undefined;
  try {
    const dbConfig = parseDatabaseUrl(databaseUrl);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    // Add sku column to dddev_recipe
    if (await columnExists(connection, 'dddev_recipe', 'sku')) {
      console.log("Column 'sku' already exists in dddev_recipe. Skipping.");
    } else {
      const alterSql = `
        ALTER TABLE dddev_recipe 
        ADD COLUMN sku VARCHAR(100) NULL AFTER name;
      `;
      await connection.execute(alterSql);
      console.log("Column 'sku' added to dddev_recipe successfully.");
    }

    console.log('\nAll database changes applied successfully!');
  } catch (error) {
    console.error('Error adding recipe SKU field:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

addRecipeSkuField();
