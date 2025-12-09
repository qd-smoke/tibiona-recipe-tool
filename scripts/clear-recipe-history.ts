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
      throw new Error(`Invalid protocol: ${urlObj.protocol}`);
    }
    const database = urlObj.pathname.replace(/^\//, '');
    return {
      user: decodeURIComponent(urlObj.username),
      password: decodeURIComponent(urlObj.password),
      host: urlObj.hostname,
      port: urlObj.port ? Number(urlObj.port) : 3306,
      database,
    };
  } catch (error) {
    throw new Error(
      `Invalid DATABASE_URL: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function clearHistory() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set');
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
    const [result] = await connection.execute(
      'TRUNCATE TABLE dddev_recipe_history',
    );

    console.log('Recipe history cleared');
    console.log(result);
  } catch (error) {
    console.error('Failed to clear recipe history', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

clearHistory().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
