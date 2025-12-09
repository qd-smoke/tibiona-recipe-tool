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

async function addRecipeCategoryClientsFields() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const shouldExecute = process.argv.includes('--execute');
  if (!shouldExecute) {
    console.log('This script will create the following database changes:');
    console.log('  1. Create table dddev_recipe_category');
    console.log('  2. Create table dddev_recipe_client');
    console.log('  3. Create table dddev_recipe_client_relation');
    console.log('  4. Add column category_id to dddev_recipe');
    console.log('\nRun with --execute flag to apply changes.');
    process.exit(0);
  }

  let connection: mysql.Connection | undefined;
  try {
    const dbConfig = parseDatabaseUrl(databaseUrl);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    // Create dddev_recipe_category table
    if (await tableExists(connection, 'dddev_recipe_category')) {
      console.log(
        "Table 'dddev_recipe_category' already exists. Skipping creation.",
      );
    } else {
      const createCategoryTable = `
        CREATE TABLE dddev_recipe_category (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          UNIQUE KEY dddev_recipe_category_name_unique (name),
          KEY idx_category_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await connection.execute(createCategoryTable);
      console.log("Table 'dddev_recipe_category' created successfully.");
    }

    // Create dddev_recipe_client table
    if (await tableExists(connection, 'dddev_recipe_client')) {
      console.log(
        "Table 'dddev_recipe_client' already exists. Skipping creation.",
      );
    } else {
      const createClientTable = `
        CREATE TABLE dddev_recipe_client (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
          UNIQUE KEY dddev_recipe_client_name_unique (name),
          KEY idx_client_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await connection.execute(createClientTable);
      console.log("Table 'dddev_recipe_client' created successfully.");
    }

    // Create dddev_recipe_client_relation table
    if (await tableExists(connection, 'dddev_recipe_client_relation')) {
      console.log(
        "Table 'dddev_recipe_client_relation' already exists. Skipping creation.",
      );
    } else {
      const createRelationTable = `
        CREATE TABLE dddev_recipe_client_relation (
          id INT AUTO_INCREMENT PRIMARY KEY,
          recipe_id INT UNSIGNED NOT NULL,
          client_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          UNIQUE KEY dddev_recipe_client_relation_unique (recipe_id, client_id),
          KEY idx_recipe_id (recipe_id),
          KEY idx_client_id (client_id),
          CONSTRAINT fk_recipe_client_recipe FOREIGN KEY (recipe_id) REFERENCES dddev_recipe(id) ON DELETE CASCADE ON UPDATE RESTRICT,
          CONSTRAINT fk_recipe_client_client FOREIGN KEY (client_id) REFERENCES dddev_recipe_client(id) ON DELETE CASCADE ON UPDATE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await connection.execute(createRelationTable);
      console.log("Table 'dddev_recipe_client_relation' created successfully.");
    }

    // Add category_id column to dddev_recipe
    if (await columnExists(connection, 'dddev_recipe', 'category_id')) {
      console.log(
        "Column 'category_id' already exists in dddev_recipe. Skipping.",
      );
    } else {
      const alterSql = `
        ALTER TABLE dddev_recipe 
        ADD COLUMN category_id INT NULL,
        ADD CONSTRAINT fk_recipe_category FOREIGN KEY (category_id) REFERENCES dddev_recipe_category(id) ON DELETE SET NULL ON UPDATE RESTRICT;
      `;
      await connection.execute(alterSql);
      console.log("Column 'category_id' added to dddev_recipe successfully.");
    }

    console.log('\nAll database changes applied successfully!');
  } catch (error) {
    console.error('Error adding recipe category and clients fields:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

addRecipeCategoryClientsFields();
