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

async function addProcessFields() {
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

    const columnsToAdd = [
      {
        name: 'water_temperature_c',
        definition: 'DECIMAL(12,2) DEFAULT 0',
      },
      {
        name: 'final_dough_temperature_c',
        definition: 'DECIMAL(12,2) DEFAULT 0',
      },
    ];

    for (const column of columnsToAdd) {
      // Escape column name for safety (only alphanumeric and underscore allowed)
      const escapedColumnName = column.name.replace(/[^a-zA-Z0-9_]/g, '');
      const [rows] = await connection.execute(
        `SHOW COLUMNS FROM dddev_recipe LIKE '${escapedColumnName}';`,
      );
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(
          `Column '${column.name}' already exists in dddev_recipe. Skipping.`,
        );
        continue;
      }
      const alterSql = `ALTER TABLE dddev_recipe ADD COLUMN ${escapedColumnName} ${column.definition};`;
      await connection.execute(alterSql);
      console.log(`Column '${column.name}' added successfully.`);
    }
  } catch (error) {
    console.error('Error adding water temperature fields:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

addProcessFields();
