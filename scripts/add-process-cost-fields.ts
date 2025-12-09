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
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as count FROM information_schema.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = ? 
     AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return rows[0]?.count > 0;
}

async function addProcessCostFields() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const shouldExecute = process.argv.includes('--execute');
  if (!shouldExecute) {
    console.log('This script will create the following database changes:');
    console.log('  1. Add cost_type column to dddev_recipe_process');
    console.log('  2. Add cycle_field column to dddev_recipe_process');
    console.log('\nRun with --execute flag to apply changes.');
    process.exit(0);
  }

  let connection: mysql.Connection | undefined;
  try {
    const dbConfig = parseDatabaseUrl(databaseUrl);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    // Add cost_type column
    if (await columnExists(connection, 'dddev_recipe_process', 'cost_type')) {
      console.log(
        "Column 'cost_type' already exists in 'dddev_recipe_process'. Skipping.",
      );
    } else {
      await connection.execute(
        `ALTER TABLE dddev_recipe_process 
         ADD COLUMN cost_type VARCHAR(64) NULL`,
      );
      console.log("✓ Added 'cost_type' column to 'dddev_recipe_process'");
    }

    // Add cycle_field column
    if (await columnExists(connection, 'dddev_recipe_process', 'cycle_field')) {
      console.log(
        "Column 'cycle_field' already exists in 'dddev_recipe_process'. Skipping.",
      );
    } else {
      await connection.execute(
        `ALTER TABLE dddev_recipe_process 
         ADD COLUMN cycle_field VARCHAR(64) NULL`,
      );
      console.log("✓ Added 'cycle_field' column to 'dddev_recipe_process'");
    }

    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

addProcessCostFields();
