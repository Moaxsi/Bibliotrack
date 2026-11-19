import pg from 'pg';
import { readFileSync } from 'node:fs';

const supabaseCa = readFileSync(new URL('./supabase-ca.pem', import.meta.url), 'utf8');
// Match Spring's LocalDateTime JSON for the existing timestamp-without-zone columns.
pg.types.setTypeParser(1114, value => value.replace(' ', 'T'));

let pool;
export function database() {
  if (!pool) {
    if (!process.env.PGHOST || !process.env.PGPASSWORD) throw new Error('Database is not configured');
    pool = new pg.Pool({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'postgres',
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { ca: supabaseCa, rejectUnauthorized: true },
      max: 2,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
      statement_timeout: 15000,
      options: '-c timezone=America/Lima'
    });
    pool.on('error', error => console.error('Database pool error', error.code));
  }
  return pool;
}

export async function transaction(db, work) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
