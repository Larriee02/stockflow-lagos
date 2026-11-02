/**
 * Versioned, forward-only database migrations.
 * Each migration runs exactly once (tracked in `schema_migrations`) inside a transaction.
 * Kept as JS strings (not .sql files) so serverless bundlers always include them.
 *
 * 001 recreates the original single-store tables idempotently (IF NOT EXISTS), so it is a
 * no-op on databases created by the old schema.sql and a fresh start on new databases.
 * 002 introduces accounts, audit logs and per-user (multi-tenant) data isolation.
 */
module.exports = [
  {
    id: '001_core_store_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        category VARCHAR(80) NOT NULL DEFAULT 'Provisions',
        unit VARCHAR(40) NOT NULL DEFAULT 'Pack',
        cost_price NUMERIC(14, 2) NOT NULL CHECK (cost_price >= 0),
        selling_price NUMERIC(14, 2) NOT NULL CHECK (selling_price >= 0),
        stock_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
        reorder_level NUMERIC(14, 2) NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
        supplier_name VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        idempotency_key VARCHAR(64),
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('SALE', 'RESTOCK', 'ADJUSTMENT', 'DAMAGE')),
        quantity_change NUMERIC(14, 2) NOT NULL,
        previous_stock NUMERIC(14, 2) NOT NULL,
        new_stock NUMERIC(14, 2) NOT NULL CHECK (new_stock >= 0),
        unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
        total_value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_value >= 0),
        counterparty_name VARCHAR(120),
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cash_transactions (
        id SERIAL PRIMARY KEY,
        idempotency_key VARCHAR(64),
        type VARCHAR(15) NOT NULL CHECK (type IN ('INFLOW', 'OUTFLOW')),
        category VARCHAR(80) NOT NULL,
        amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
        payment_method VARCHAR(30) NOT NULL DEFAULT 'CASH'
          CHECK (payment_method IN ('CASH', 'POS', 'BANK_TRANSFER', 'MOBILE_MONEY')),
        counterparty_name VARCHAR(120),
        description TEXT NOT NULL,
        stock_movement_id INTEGER REFERENCES stock_movements(id) ON DELETE SET NULL,
        transaction_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS credit_records (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(120) NOT NULL,
        phone VARCHAR(40),
        items_summary TEXT NOT NULL,
        total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount > 0),
        amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
        balance_due NUMERIC(14, 2) NOT NULL CHECK (balance_due >= 0),
        status VARCHAR(20) NOT NULL DEFAULT 'OWING' CHECK (status IN ('OWING', 'PAID')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },
  {
    id: '002_accounts_admin_multi_tenant',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT,
        full_name VARCHAR(120) NOT NULL,
        business_name VARCHAR(150) NOT NULL DEFAULT '',
        phone VARCHAR(40),
        business_type VARCHAR(60),
        city VARCHAR(80) DEFAULT 'Lagos',
        address TEXT,
        role VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
          CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED')),
        auth_provider VARCHAR(20) NOT NULL DEFAULT 'EMAIL'
          CHECK (auth_provider IN ('EMAIL', 'GOOGLE', 'APPLE')),
        google_sub VARCHAR(255) UNIQUE,
        apple_sub VARCHAR(255) UNIQUE,
        avatar_url TEXT,
        admin_note TEXT,
        token_version INTEGER NOT NULL DEFAULT 0,
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        approved_at TIMESTAMPTZ,
        approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_users_status_created ON users (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(60) NOT NULL,
        target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_user_id, created_at DESC);

      -- Multi-tenant isolation: every store record belongs to exactly one account.
      ALTER TABLE products ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE credit_records ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

      -- Uniqueness is now per store instead of global.
      ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
      ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_idempotency_key_key;
      ALTER TABLE cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_idempotency_key_key;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_products_user_sku ON products (user_id, sku);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_movements_user_idem
        ON stock_movements (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_user_idem
        ON cash_transactions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

      DROP INDEX IF EXISTS idx_products_category;
      DROP INDEX IF EXISTS idx_products_low_stock;
      DROP INDEX IF EXISTS idx_stock_movements_product_date;
      DROP INDEX IF EXISTS idx_cash_tx_type_date;
      DROP INDEX IF EXISTS idx_credit_records_status;

      CREATE INDEX IF NOT EXISTS idx_products_user_name ON products (user_id, name);
      CREATE INDEX IF NOT EXISTS idx_movements_user_date ON stock_movements (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements (product_id);
      CREATE INDEX IF NOT EXISTS idx_cash_user_date ON cash_transactions (user_id, transaction_date DESC);
      CREATE INDEX IF NOT EXISTS idx_credit_user_status ON credit_records (user_id, status, updated_at DESC);

      -- The old shared-PIN table is superseded by real accounts.
      DROP TABLE IF EXISTS store_settings;
    `,
  },
  {
    id: '003_user_currency_and_clean_live',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'NGN';

      -- Remove demo/test accounts and any unowned legacy rows for clean live testing
      DELETE FROM users
      WHERE LOWER(email) = 'admin@stockflowlagos.com'
         OR LOWER(email) LIKE 'trader_%@lagos.ng'
         OR LOWER(email) LIKE 'google_trader_%@gmail.com'
         OR LOWER(email) LIKE 'apple_trader_%@icloud.com';

      DELETE FROM cash_transactions WHERE user_id IS NULL;
      DELETE FROM stock_movements WHERE user_id IS NULL;
      DELETE FROM credit_records WHERE user_id IS NULL;
      DELETE FROM products WHERE user_id IS NULL;
    `,
  },
];
