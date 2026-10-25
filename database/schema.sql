-- StockFlow Lagos - Provision Store & Retail Trader Schema (Naira / NGN)
DROP TABLE IF EXISTS credit_repayments CASCADE;
DROP TABLE IF EXISTS credit_records CASCADE;
DROP TABLE IF EXISTS cash_transactions CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- 1. Provision & Retail Products Table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
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

-- 2. Stock Movements (Sales, Market Restock, Physical Shelf Count, Damaged/Expired)
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(64) UNIQUE,
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

-- 3. Cash Inflow & Outflow Ledger (Money In & Money Out)
CREATE TABLE cash_transactions (
    id SERIAL PRIMARY KEY,
    idempotency_key VARCHAR(64) UNIQUE,
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

-- 4. Credit / Debtors Book (Customers Owing Store / Suppliers Owed)
CREATE TABLE credit_records (
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

-- Indexes for fast lookup
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_low_stock ON products(id) WHERE stock_quantity <= reorder_level;
CREATE INDEX idx_stock_movements_product_date ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_cash_tx_type_date ON cash_transactions(type, transaction_date DESC);
CREATE INDEX idx_credit_records_status ON credit_records(status, created_at DESC);

-- Starter Product Catalog with 0 Initial Stock (All financial & stock figures start at 0)
INSERT INTO products (sku, name, category, unit, cost_price, selling_price, stock_quantity, reorder_level, supplier_name)
VALUES
    ('PRV-001', 'Peak Milk Powder Sachet (Roll x12)', 'Milk & Drinks', 'Roll', 2600.00, 3000.00, 0, 8, 'Oke-Arin Wholesale'),
    ('PRV-002', 'Milo Activ-Go Sachet (Roll x10)', 'Milk & Drinks', 'Roll', 2100.00, 2500.00, 0, 8, 'Oke-Arin Wholesale'),
    ('NDL-003', 'Indomie Super Pack 120g (Carton x40)', 'Noodles & Pasta', 'Carton', 14200.00, 16000.00, 0, 6, 'Mushin Market Depot'),
    ('NDL-004', 'Indomie Super Pack 120g (Single)', 'Noodles & Pasta', 'Piece', 355.00, 450.00, 0, 20, 'Mushin Market Depot'),
    ('GRN-005', 'Golden Penny Semovita 2kg', 'Swallow & Grains', 'Bag', 2850.00, 3300.00, 0, 10, 'Trade Fair Wholesaler'),
    ('GRN-006', 'Dangote Granulated Sugar 500g', 'Provisions', 'Pack', 1150.00, 1400.00, 0, 10, 'Oke-Arin Wholesale'),
    ('OIL-007', 'Devon Kings Cooking Oil 1L Pouch', 'Cooking Oil', 'Pouch', 2400.00, 2800.00, 0, 6, 'Trade Fair Wholesaler'),
    ('CND-008', 'Titus Sardine in Oil 125g', 'Canned Food', 'Tin', 1150.00, 1400.00, 0, 12, 'Oke-Arin Wholesale'),
    ('SNK-009', 'Golden Morn Maize Cereal 900g', 'Cereals & Snacks', 'Pack', 3600.00, 4200.00, 0, 5, 'Mushin Market Depot'),
    ('HHS-010', 'Sunlight Detergent Powder 900g', 'Soap & Household', 'Pack', 1650.00, 2000.00, 0, 8, 'Trade Fair Wholesaler'),
    ('DRK-011', 'Eva Table Water 75cl (Pack x12)', 'Milk & Drinks', 'Pack', 2400.00, 3000.00, 0, 6, 'Local Beverage Truck'),
    ('BRD-012', 'Agege / Sliced Family Loaf Bread', 'Bread & Bakery', 'Loaf', 1200.00, 1500.00, 0, 5, 'Morning Bakery Supplier');
