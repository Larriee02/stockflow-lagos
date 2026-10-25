const { Pool } = require('pg');
const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let poolInstance = null;
let pgliteInstance = null;
let initPromise = null;

async function getPglite() {
  if (pgliteInstance) return pgliteInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dataDir = path.join(__dirname, '../../pgdata');
    const db = new PGlite(dataDir);
    await db.waitReady;

    // Check if the Lagos provision store credit_records table is initialized
    const check = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'credit_records'
      ) AS initialized;
    `);

    if (!check.rows[0]?.initialized) {
      const schemaPath = path.join(__dirname, '../../../database/schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await db.exec(schemaSql);
      console.log('[DB] Initialized Lagos Provision Store schema & Naira (NGN) seed data.');
    } else {
      console.log('[DB] Connected to persistent PostgreSQL database at server/pgdata.');
    }

    pgliteInstance = db;
    return db;
  })();

  return initPromise;
}

if (process.env.DATABASE_URL) {
  const isLocalHost =
    process.env.DATABASE_URL.includes('localhost') ||
    process.env.DATABASE_URL.includes('127.0.0.1');

  poolInstance = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalHost ? false : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
  });
  console.log('[DB] Using external PostgreSQL server via DATABASE_URL');
}

let cloudSchemaReady = false;
let cloudInitPromise = null;

async function ensureCloudSchema() {
  if (!poolInstance || cloudSchemaReady) return;
  if (cloudInitPromise) return cloudInitPromise;

  cloudInitPromise = (async () => {
    try {
      const check = await poolInstance.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'credit_records'
        ) AS initialized;
      `);
      if (!check.rows[0]?.initialized) {
        const schemaPath = path.join(__dirname, '../../../database/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await poolInstance.query(schemaSql);
        console.log('[DB] Auto-initialized Cloud PostgreSQL schema & Lagos seed data.');
      }
      cloudSchemaReady = true;
    } catch (err) {
      console.error('[DB] Cloud schema check error:', err.message);
      cloudInitPromise = null;
      throw err;
    }
  })();

  return cloudInitPromise;
}

const dbAdapter = {
  async query(text, params = []) {
    if (poolInstance) {
      await ensureCloudSchema();
      return poolInstance.query(text, params);
    }
    const db = await getPglite();
    return db.query(text, params);
  },

  async connect() {
    if (poolInstance) {
      await ensureCloudSchema();
      return poolInstance.connect();
    }
    const db = await getPglite();
    return {
      query: (text, params = []) => db.query(text, params),
      release: () => {},
    };
  },
};

module.exports = dbAdapter;
