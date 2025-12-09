#!/usr/bin/env tsx
/**
 * Script riutilizzabile per leggere le tabelle del database
 * Utile per debug quando si fanno modifiche o si hanno problemi
 *
 * Uso:
 *   pnpm tsx scripts/read-db-table.ts <tableName> [options]
 *
 * Esempi:
 *   pnpm tsx scripts/read-db-table.ts dddev_recipe --limit 5
 *   pnpm tsx scripts/read-db-table.ts dddev_recipe --id 123
 *   pnpm tsx scripts/read-db-table.ts app_permissions --username "test"
 *   pnpm tsx scripts/read-db-table.ts dddev_recipe_ingredient --recipe-id 10
 *   pnpm tsx scripts/read-db-table.ts dddev_recipe --count
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

type ParsedDatabaseUrl = {
  user: string;
  password: string;
  host: string;
  port: number;
  database: string;
};

export function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
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

// Available tables with their description and common filters
const TABLE_INFO: Record<
  string,
  { description: string; commonFilters: string[] }
> = {
  dddev_recipe: {
    description: 'Recipe table',
    commonFilters: ['id', 'name'],
  },
  dddev_recipe_ingredient: {
    description: 'Recipe ingredients table',
    commonFilters: ['id', 'recipe_id', 'sku'],
  },
  dddev_recipe_oven_temperature: {
    description: 'Recipe oven temperatures table',
    commonFilters: ['id', 'recipe_id'],
  },
  dddev_recipe_mixing_time: {
    description: 'Recipe mixing times table',
    commonFilters: ['id', 'recipe_id'],
  },
  dddev_recipe_cost: {
    description: 'Recipe costs table',
    commonFilters: ['id', 'recipe_id', 'cost_type'],
  },
  dddev_recipe_version: {
    description: 'Recipe versions table',
    commonFilters: ['id', 'recipe_id', 'version_number'],
  },
  dddev_recipe_history: {
    description: 'Recipe history table',
    commonFilters: ['id', 'recipe_id', 'user_id'],
  },
  dddev_production: {
    description: 'Production records table',
    commonFilters: ['id', 'recipe_id', 'production_lot', 'status'],
  },
  dddev_production_ingredient: {
    description: 'Production ingredients table',
    commonFilters: ['id', 'production_id', 'ingredient_id'],
  },
  dddev_cost_standard: {
    description: 'Standard costs table',
    commonFilters: ['id', 'cost_type'],
  },
  app_permissions: {
    description: 'User permissions table',
    commonFilters: ['id', 'username', 'role_label'],
  },
  app_roles: {
    description: 'Roles table',
    commonFilters: ['id', 'role_label'],
  },
};

function parseArgs(): {
  tableName: string;
  limit?: number;
  id?: number;
  where?: Record<string, string | number>;
  count?: boolean;
  columns?: string[];
  showHelp?: boolean;
  execute?: string;
  sql?: string;
} {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return { tableName: '', showHelp: true };
  }

  const tableName = args[0];
  const options: {
    tableName: string;
    limit?: number;
    id?: number;
    where?: Record<string, string | number>;
    count?: boolean;
    columns?: string[];
    showHelp?: boolean;
    execute?: string;
    sql?: string;
  } = { tableName };

  const processedArgs = new Set<number>();

  for (let i = 1; i < args.length; i++) {
    if (processedArgs.has(i)) continue;

    const arg = args[i];
    if (arg === '--limit' && args[i + 1]) {
      options.limit = parseInt(args[i + 1], 10);
      processedArgs.add(i);
      processedArgs.add(i + 1);
      i++;
    } else if (arg === '--id' && args[i + 1]) {
      options.id = parseInt(args[i + 1], 10);
      processedArgs.add(i);
      processedArgs.add(i + 1);
      i++;
    } else if (arg === '--count') {
      options.count = true;
      processedArgs.add(i);
    } else if (arg === '--where' && args[i + 1]) {
      // --where "key=value,key2=value2"
      if (!options.where) options.where = {};
      const wherePairs = args[i + 1].split(',');
      for (const pair of wherePairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          const numValue = Number(value);
          options.where[key.trim()] = Number.isFinite(numValue)
            ? numValue
            : value.trim();
        }
      }
      processedArgs.add(i);
      processedArgs.add(i + 1);
      i++;
    } else if (arg === '--columns' && args[i + 1]) {
      options.columns = args[i + 1].split(',');
      processedArgs.add(i);
      processedArgs.add(i + 1);
      i++;
    } else if (arg === '--execute' && args[i + 1]) {
      options.execute = args[i + 1];
      processedArgs.add(i);
      processedArgs.add(i + 1);
      i++;
    } else if (arg === '--sql' && args[i + 1]) {
      options.sql = args[i + 1];
      processedArgs.add(i);
      processedArgs.add(i + 1);
      i++;
    }
  }

  // Common filters: convert --recipe-id to --where recipe_id=value
  // Only process args that haven't been processed yet
  const knownOptions = [
    '--limit',
    '--id',
    '--count',
    '--where',
    '--columns',
    '--execute',
    '--sql',
  ];
  for (let i = 1; i < args.length; i++) {
    if (processedArgs.has(i)) continue;

    const arg = args[i];
    // Skip known options
    if (knownOptions.includes(arg)) continue;

    if (
      arg.startsWith('--') &&
      arg.includes('-') &&
      args[i + 1] &&
      !processedArgs.has(i + 1)
    ) {
      const filterKey = arg.replace('--', '').replace(/-/g, '_');
      const filterValue = args[i + 1];
      if (!options.where) options.where = {};
      const numValue = Number(filterValue);
      options.where[filterKey] = Number.isFinite(numValue)
        ? numValue
        : filterValue;
      processedArgs.add(i);
      processedArgs.add(i + 1);
      i++;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Script riutilizzabile per leggere le tabelle del database
Utile per debug quando si fanno modifiche o si hanno problemi

Uso:
  pnpm tsx scripts/read-db-table.ts <tableName> [options]

Opzioni:
  --limit <n>          Limita il numero di righe da mostrare (default: 10)
  --id <id>            Filtra per ID
  --where "key=value"  Filtra per colonne multiple (separati da virgola)
                       Es: --where "recipe_id=10,status=finished"
  --count              Mostra solo il conteggio delle righe
  --columns "col1,col2" Mostra solo colonne specifiche
  --execute "<SQL>"    Esegue un comando SQL direttamente (ALTER, CREATE, etc.)
                       Es: --execute "ALTER TABLE dddev_recipe ADD COLUMN test INT"
  --sql "<SQL>"        Alias di --execute
  --recipe-id <id>     Shortcut per filtrare per recipe_id
  --username <name>    Shortcut per filtrare per username (app_permissions)
  --status <status>    Shortcut per filtrare per status (dddev_production)
  --help, -h           Mostra questo help

Tabelle disponibili:
${Object.entries(TABLE_INFO)
  .map(
    ([name, info]) =>
      `  ${name.padEnd(30)} - ${info.description} (filtri: ${info.commonFilters.join(', ')})`,
  )
  .join('\n')}

Esempi:
  pnpm tsx scripts/read-db-table.ts dddev_recipe --limit 5
  pnpm tsx scripts/read-db-table.ts dddev_recipe --id 123
  pnpm tsx scripts/read-db-table.ts app_permissions --username "test"
  pnpm tsx scripts/read-db-table.ts dddev_recipe_ingredient --recipe-id 10
  pnpm tsx scripts/read-db-table.ts dddev_production --status "in_progress" --limit 20
  pnpm tsx scripts/read-db-table.ts dddev_recipe --count
  pnpm tsx scripts/read-db-table.ts dddev_recipe --columns "id,name,notes"
  pnpm tsx scripts/read-db-table.ts dddev_recipe --execute "ALTER TABLE dddev_recipe ADD COLUMN test INT"
  pnpm tsx scripts/read-db-table.ts dddev_recipe --sql "SHOW COLUMNS FROM dddev_recipe"
`);
}

function formatValue(value: unknown): string {
  if (value === null) return 'NULL';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 97) + '...';
  }
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 100 ? json.substring(0, 97) + '...' : json;
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function buildWhereClause(
  where: Record<string, string | number>,
  _tableName: string,
): { sql: string; values: (string | number)[] } {
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  for (const [key, value] of Object.entries(where)) {
    conditions.push(`\`${key}\` = ?`);
    values.push(value);
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values,
  };
}

async function main() {
  const options = parseArgs();

  if (options.showHelp || !options.tableName) {
    showHelp();
    process.exit(0);
  }

  // Get database connection
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

  let connection: mysql.Connection | null = null;

  try {
    console.log(
      `\n📊 Connessione al database: ${dbConfig.database}@${dbConfig.host}\n`,
    );

    connection = await mysql.createConnection({
      ...dbConfig,
    });

    // Execute SQL directly if requested
    if (options.execute || options.sql) {
      const sqlQuery = options.execute || options.sql || '';
      console.log(`🔧 Esecuzione SQL:\n${sqlQuery}\n`);

      try {
        const [result] = await connection.execute(sqlQuery);

        if (Array.isArray(result) && result.length > 0) {
          // Query returned results (SELECT, SHOW, etc.)
          const rows = result as mysql.RowDataPacket[];

          if (rows.length === 0) {
            console.log('✅ Query eseguita con successo (nessun risultato)\n');
          } else {
            // Display results
            const keys = Object.keys(rows[0]);
            const columnWidths: Record<string, number> = {};

            // Calculate column widths
            for (const key of keys) {
              columnWidths[key] = Math.max(
                key.length,
                ...rows.map((row) => formatValue(row[key] || '').length),
              );
            }

            // Print header
            const headerRow = keys
              .map((key) => key.padEnd(columnWidths[key] + 2))
              .join(' | ');
            console.log(headerRow);
            console.log('-'.repeat(headerRow.length));

            // Print rows
            for (const row of rows) {
              const dataRow = keys
                .map((key) =>
                  formatValue(row[key] || '').padEnd(columnWidths[key] + 2),
                )
                .join(' | ');
              console.log(dataRow);
            }
            console.log(
              `\n✅ Query eseguita: ${rows.length} riga${rows.length !== 1 ? 'e' : ''} risultante${rows.length !== 1 ? 'i' : ''}\n`,
            );
          }
        } else {
          // Query didn't return results (INSERT, UPDATE, DELETE, ALTER, etc.)
          const resultInfo = result as mysql.ResultSetHeader;
          if (resultInfo.affectedRows !== undefined) {
            console.log(`✅ Query eseguita con successo`);
            if (resultInfo.affectedRows !== undefined) {
              console.log(`   Righe interessate: ${resultInfo.affectedRows}`);
            }
            if (resultInfo.insertId !== undefined && resultInfo.insertId > 0) {
              console.log(`   ID inserito: ${resultInfo.insertId}`);
            }
            console.log('');
          } else {
            console.log('✅ Query eseguita con successo\n');
          }
        }
      } catch (sqlError) {
        console.error(
          '❌ Errore SQL:',
          sqlError instanceof Error ? sqlError.message : String(sqlError),
        );
        if (sqlError instanceof Error && sqlError.stack) {
          console.error('\nStack trace:', sqlError.stack);
        }
        process.exit(1);
      }

      return;
    }

    const tableName = options.tableName;

    // Check if table exists
    const [tables] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = ?`,
      [dbConfig.database, tableName],
    );

    if (tables.length === 0 || tables[0].count === 0) {
      console.error(`❌ Tabella "${tableName}" non trovata nel database.`);
      console.log('\nTabelle disponibili:');
      const [availableTables] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = ? 
         ORDER BY table_name`,
        [dbConfig.database],
      );
      availableTables.forEach((row) => {
        console.log(`  - ${row.table_name}`);
      });
      process.exit(1);
    }

    // Get column info
    const [columns] = await connection.execute<mysql.RowDataPacket[]>(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_schema = ? AND table_name = ? 
       ORDER BY ordinal_position`,
      [dbConfig.database, tableName],
    );

    // Build WHERE clause
    const where: Record<string, string | number> = {};
    if (options.id) {
      where.id = options.id;
    }
    if (options.where) {
      Object.assign(where, options.where);
    }

    const { sql: whereSql, values: whereValues } = buildWhereClause(
      where,
      tableName,
    );

    // Build SELECT columns
    const selectColumns = options.columns
      ? options.columns.map((col) => `\`${col}\``).join(', ')
      : '*';

    if (options.count) {
      const [result] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM \`${tableName}\` ${whereSql}`,
        whereValues,
      );
      console.log(
        `\n📈 Conteggio righe in "${tableName}": ${result[0].count}\n`,
      );
    } else {
      const limit = options.limit || 10;
      const queryParams =
        whereValues.length > 0 ? [...whereValues, limit] : [limit];
      const limitSql = `LIMIT ?`;
      const [rows] = await connection.execute<mysql.RowDataPacket[]>(
        `SELECT ${selectColumns} FROM \`${tableName}\` ${whereSql} ${limitSql}`,
        queryParams,
      );

      if (rows.length === 0) {
        console.log(`\n⚠️  Nessun risultato trovato in "${tableName}"\n`);
        if (Object.keys(where).length > 0) {
          console.log('Filtri applicati:', where);
        }
      } else {
        console.log(
          `\n📋 ${rows.length} riga${rows.length !== 1 ? 'e' : ''} da "${tableName}":\n`,
        );

        // Display columns header
        const displayColumns =
          options.columns || columns.map((col) => col.column_name);
        const columnWidths: Record<string, number> = {};

        // Calculate column widths
        for (const col of displayColumns) {
          columnWidths[col] = Math.max(
            col.length,
            ...rows.map((row) => formatValue(row[col] || '').length),
          );
        }

        // Print header
        const headerRow = displayColumns
          .map((col) => col.padEnd(columnWidths[col] + 2))
          .join(' | ');
        console.log(headerRow);
        console.log('-'.repeat(headerRow.length));

        // Print rows
        for (const row of rows) {
          const dataRow = displayColumns
            .map((col) =>
              formatValue(row[col] || '').padEnd(columnWidths[col] + 2),
            )
            .join(' | ');
          console.log(dataRow);
        }

        if (rows.length >= limit) {
          console.log(
            `\n⚠️  Mostrate solo ${limit} righe (usa --limit per cambiare)\n`,
          );
        } else {
          console.log('');
        }
      }
    }

    // Show table info if available
    if (TABLE_INFO[tableName]) {
      const info = TABLE_INFO[tableName];
      console.log(`ℹ️  ${info.description}`);
      if (info.commonFilters.length > 0) {
        console.log(`   Filtri comuni: ${info.commonFilters.join(', ')}\n`);
      }
    }
  } catch (error) {
    console.error(
      '\n❌ Errore:',
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
