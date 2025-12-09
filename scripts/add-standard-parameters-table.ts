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

async function tableExists(
  connection: mysql.Connection,
  tableName: string,
): Promise<boolean> {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName],
  );
  const result = rows as Array<{ count: number }>;
  return result[0]?.count > 0;
}

async function addStandardParametersTable() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const shouldExecute = process.argv.includes('--execute');
  if (!shouldExecute) {
    console.log('This script will create the following database changes:');
    console.log('  1. Create table dddev_standard_parameters');
    console.log('\nRun with --execute flag to apply changes.');
    process.exit(0);
  }

  let connection: mysql.Connection | undefined;
  try {
    const dbConfig = parseDatabaseUrl(databaseUrl);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    // Create dddev_standard_parameters table
    if (await tableExists(connection, 'dddev_standard_parameters')) {
      console.log(
        "Table 'dddev_standard_parameters' already exists. Skipping creation.",
      );
    } else {
      const createTable = `
        CREATE TABLE dddev_standard_parameters (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          parameter_type VARCHAR(64) NOT NULL,
          value DECIMAL(12,2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY dddev_standard_parameters_parameter_type_unique (parameter_type),
          KEY idx_parameter_type (parameter_type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await connection.execute(createTable);
      console.log("✓ Table 'dddev_standard_parameters' created");
    }

    console.log('\n✓ Migration completed successfully!');
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

addStandardParametersTable();
