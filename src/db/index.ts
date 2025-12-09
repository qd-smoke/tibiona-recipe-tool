import 'dotenv/config';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';

type ParsedDatabaseUrl = {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
};

function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  // Parse mysql://user:password@host:port/database
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
    const database = urlObj.pathname.replace(/^\//, ''); // Remove leading slash
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

let dbConfig: {
  host: string;
  user: string;
  password: string;
  database: string;
  port?: number;
};

if (process.env.DATABASE_URL) {
  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  dbConfig = {
    host: parsed.host,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    port: parsed.port,
  };
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
  };
  if (process.env.DB_PORT) {
    dbConfig.port = parseInt(process.env.DB_PORT, 10);
  }
}

const pool = mysql.createPool({
  ...dbConfig,
  connectionLimit: 10, // adjust pool size
});

export const db = drizzle(pool);
