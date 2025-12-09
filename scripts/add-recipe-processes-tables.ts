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

async function addRecipeProcessesTables() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const shouldExecute = process.argv.includes('--execute');
  if (!shouldExecute) {
    console.log('This script will create the following database changes:');
    console.log('  1. Create table dddev_process');
    console.log('  2. Create table dddev_recipe_process');
    console.log('  3. Create table dddev_recipe_process_tracking');
    console.log('  4. Seed 18 initial processes');
    console.log('\nRun with --execute flag to apply changes.');
    process.exit(0);
  }

  let connection: mysql.Connection | undefined;
  try {
    const dbConfig = parseDatabaseUrl(databaseUrl);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    // Create dddev_process table
    if (await tableExists(connection, 'dddev_process')) {
      console.log("Table 'dddev_process' already exists. Skipping creation.");
    } else {
      const createProcessTable = `
        CREATE TABLE dddev_process (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          \`order\` INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY dddev_process_name_unique (name),
          KEY idx_process_order (\`order\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await connection.execute(createProcessTable);
      console.log("✓ Table 'dddev_process' created");
    }

    // Create dddev_recipe_process table
    if (await tableExists(connection, 'dddev_recipe_process')) {
      console.log(
        "Table 'dddev_recipe_process' already exists. Skipping creation.",
      );
    } else {
      const createRecipeProcessTable = `
        CREATE TABLE dddev_recipe_process (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          recipe_id INT UNSIGNED NOT NULL,
          process_id INT UNSIGNED NOT NULL,
          minutes DECIMAL(12,2) NOT NULL DEFAULT 0,
          cycles INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY dddev_recipe_process_unique (recipe_id, process_id),
          KEY idx_recipe_id (recipe_id),
          KEY idx_process_id (process_id),
          CONSTRAINT fk_recipe_process_recipe FOREIGN KEY (recipe_id) REFERENCES dddev_recipe(id) ON DELETE CASCADE ON UPDATE RESTRICT,
          CONSTRAINT fk_recipe_process_process FOREIGN KEY (process_id) REFERENCES dddev_process(id) ON DELETE CASCADE ON UPDATE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await connection.execute(createRecipeProcessTable);
      console.log("✓ Table 'dddev_recipe_process' created");
    }

    // Create dddev_recipe_process_tracking table
    if (await tableExists(connection, 'dddev_recipe_process_tracking')) {
      console.log(
        "Table 'dddev_recipe_process_tracking' already exists. Skipping creation.",
      );
    } else {
      const createTrackingTable = `
        CREATE TABLE dddev_recipe_process_tracking (
          id INT UNSIGNED NOT NULL AUTO_INCREMENT,
          production_id INT UNSIGNED NOT NULL,
          process_id INT UNSIGNED NOT NULL,
          started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP NULL,
          duration_seconds INT NULL,
          user_id INT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_production_id (production_id),
          KEY idx_process_id (process_id),
          KEY idx_user_id (user_id),
          CONSTRAINT fk_process_tracking_production FOREIGN KEY (production_id) REFERENCES dddev_production(id) ON DELETE CASCADE ON UPDATE RESTRICT,
          CONSTRAINT fk_process_tracking_process FOREIGN KEY (process_id) REFERENCES dddev_process(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
          CONSTRAINT fk_process_tracking_user FOREIGN KEY (user_id) REFERENCES app_permissions(id) ON DELETE RESTRICT ON UPDATE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;
      await connection.execute(createTrackingTable);
      console.log("✓ Table 'dddev_recipe_process_tracking' created");
    }

    // Seed initial processes
    const processes = [
      'Preparazione laboratorio',
      'Recupero ingredienti',
      'Impasto',
      'Caricare colatrice',
      'Preparare teglie',
      'Colare',
      'Prendere la teglia',
      'Mettere teglia su carello',
      'Mettere carrello nel forno',
      'Cottura',
      'Togliere dal forno',
      'Togliere dalle teglie il prodotto',
      'Portare in confezionamento',
      'Confezionare',
      'Etichettare',
      'Mettere nelle scatole',
      'Spostare scatole in magazzino',
    ];

    console.log('\nSeeding initial processes...');
    for (let i = 0; i < processes.length; i++) {
      const processName = processes[i];
      try {
        await connection.execute(
          'INSERT INTO dddev_process (name, `order`) VALUES (?, ?)',
          [processName, i + 1],
        );
        console.log(`  ✓ Process "${processName}" inserted (order: ${i + 1})`);
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.message.includes('Duplicate entry')
        ) {
          console.log(`  ⊙ Process "${processName}" already exists, skipping`);
        } else {
          console.error(
            `  ✗ Failed to insert process "${processName}":`,
            error,
          );
        }
      }
    }

    console.log('\n✓ Migration completed successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

addRecipeProcessesTables();
