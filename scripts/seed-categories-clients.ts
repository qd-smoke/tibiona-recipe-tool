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

async function seedCategoriesAndClients() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const shouldExecute = process.argv.includes('--execute');
  if (!shouldExecute) {
    console.log('This script will insert the following data:');
    console.log('\nCategories:');
    console.log('  - Mix');
    console.log('  - Mix senza glutine');
    console.log('  - Prodotti da forno dolci');
    console.log('  - Prodotti da forno salati');
    console.log('  - Granola');
    console.log('\nClients:');
    console.log('  - Ali degli Angeli');
    console.log('  - Ariete');
    console.log('  - San e Bun');
    console.log('  - Tutti');
    console.log('  - Mondopane');
    console.log('  - Dial');
    console.log('  - Scuderi');
    console.log('  - Miminchia');
    console.log('\nRun with --execute flag to apply changes.');
    process.exit(0);
  }

  const categories = [
    'Mix',
    'Mix senza glutine',
    'Prodotti da forno dolci',
    'Prodotti da forno salati',
    'Granola',
  ];

  const clients = [
    'Ali degli Angeli',
    'Ariete',
    'San e Bun',
    'Tutti',
    'Mondopane',
    'Dial',
    'Scuderi',
    'Miminchia',
  ];

  let connection: mysql.Connection | undefined;
  try {
    const dbConfig = parseDatabaseUrl(databaseUrl);
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to database');

    // Insert categories
    console.log('\nInserting categories...');
    for (const categoryName of categories) {
      try {
        await connection.execute(
          'INSERT INTO dddev_recipe_category (name) VALUES (?)',
          [categoryName],
        );
        console.log(`  ✓ Category "${categoryName}" inserted`);
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.message.includes('Duplicate entry')
        ) {
          console.log(
            `  ⊙ Category "${categoryName}" already exists, skipping`,
          );
        } else {
          console.error(
            `  ✗ Failed to insert category "${categoryName}":`,
            error,
          );
        }
      }
    }

    // Insert clients
    console.log('\nInserting clients...');
    for (const clientName of clients) {
      try {
        await connection.execute(
          'INSERT INTO dddev_recipe_client (name) VALUES (?)',
          [clientName],
        );
        console.log(`  ✓ Client "${clientName}" inserted`);
      } catch (error: unknown) {
        if (
          error instanceof Error &&
          error.message.includes('Duplicate entry')
        ) {
          console.log(`  ⊙ Client "${clientName}" already exists, skipping`);
        } else {
          console.error(`  ✗ Failed to insert client "${clientName}":`, error);
        }
      }
    }

    console.log('\n✓ Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding categories and clients:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed');
    }
  }
}

seedCategoriesAndClients();
