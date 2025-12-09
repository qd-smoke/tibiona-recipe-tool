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

async function addMarginSellingPriceFields() {
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

    // Check if margin_percent column exists
    const [marginColumns] = await connection.execute(
      "SHOW COLUMNS FROM dddev_recipe LIKE 'margin_percent'",
    );
    if (Array.isArray(marginColumns) && marginColumns.length > 0) {
      console.log("Column 'margin_percent' already exists. Skipping.");
    } else {
      await connection.execute(
        `ALTER TABLE dddev_recipe 
         ADD COLUMN margin_percent DECIMAL(12,2) DEFAULT 0 NOT NULL AFTER colatrice_settings`,
      );
      console.log("Column 'margin_percent' added successfully.");
    }

    // Check if selling_price column exists
    const [sellingColumns] = await connection.execute(
      "SHOW COLUMNS FROM dddev_recipe LIKE 'selling_price'",
    );
    if (Array.isArray(sellingColumns) && sellingColumns.length > 0) {
      console.log("Column 'selling_price' already exists. Skipping.");
    } else {
      await connection.execute(
        `ALTER TABLE dddev_recipe 
         ADD COLUMN selling_price DECIMAL(12,2) DEFAULT 0 NOT NULL AFTER margin_percent`,
      );
      console.log("Column 'selling_price' added successfully.");
    }
  } catch (error) {
    console.error('Error adding margin and selling price fields:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

addMarginSellingPriceFields();
