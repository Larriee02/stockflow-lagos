const pool = require('../config/db');

class CashbookRepository {
  async getDashboardMetrics() {
    const { rows } = await pool.query(`
      WITH inv AS (
        SELECT
          COUNT(*)::int AS total_products,
          COUNT(*) FILTER (WHERE stock_quantity <= reorder_level)::int AS low_stock_count,
          COALESCE(SUM(stock_quantity * cost_price), 0)::numeric(14,2) AS inventory_cost_value,
          COALESCE(SUM(stock_quantity * selling_price), 0)::numeric(14,2) AS inventory_retail_value,
          COALESCE(SUM(stock_quantity * (selling_price - cost_price)), 0)::numeric(14,2) AS projected_gross_margin
        FROM products
      ),
      cash AS (
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type = 'INFLOW'), 0)::numeric(14,2) AS total_inflow,
          COALESCE(SUM(amount) FILTER (WHERE type = 'OUTFLOW'), 0)::numeric(14,2) AS total_outflow,
          COALESCE(SUM(amount) FILTER (WHERE type = 'INFLOW' AND transaction_date >= CURRENT_DATE), 0)::numeric(14,2) AS today_inflow,
          COALESCE(SUM(amount) FILTER (WHERE type = 'OUTFLOW' AND transaction_date >= CURRENT_DATE), 0)::numeric(14,2) AS today_outflow
        FROM cash_transactions
      ),
      cred AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'OWING')::int AS active_debtors_count,
          COALESCE(SUM(balance_due) FILTER (WHERE status = 'OWING'), 0)::numeric(14,2) AS total_credit_owed
        FROM credit_records
      )
      SELECT
        inv.*,
        cash.*,
        cred.*,
        (cash.total_inflow - cash.total_outflow)::numeric(14,2) AS net_cash_balance
      FROM inv, cash, cred;
    `);

    const categoryBreakdown = await pool.query(`
      SELECT
        category,
        COUNT(*)::int AS sku_count,
        COALESCE(SUM(stock_quantity * cost_price), 0)::numeric(14,2) AS cost_value,
        COALESCE(SUM(stock_quantity * selling_price), 0)::numeric(14,2) AS retail_value
      FROM products
      GROUP BY category
      ORDER BY retail_value DESC
    `);

    const cashChannelBreakdown = await pool.query(`
      SELECT
        payment_method,
        COALESCE(SUM(amount) FILTER (WHERE type = 'INFLOW'), 0)::numeric(14,2) AS inflow,
        COALESCE(SUM(amount) FILTER (WHERE type = 'OUTFLOW'), 0)::numeric(14,2) AS outflow,
        (
          COALESCE(SUM(amount) FILTER (WHERE type = 'INFLOW'), 0) -
          COALESCE(SUM(amount) FILTER (WHERE type = 'OUTFLOW'), 0)
        )::numeric(14,2) AS net
      FROM cash_transactions
      GROUP BY payment_method
      ORDER BY net DESC
    `);

    return {
      ...rows[0],
      categories: categoryBreakdown.rows,
      channels: cashChannelBreakdown.rows,
    };
  }

  async findTransactions({ type, paymentMethod, search, limit = 100 }) {
    const conditions = [];
    const params = [];

    if (type && (type === 'INFLOW' || type === 'OUTFLOW')) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (paymentMethod && paymentMethod !== 'ALL') {
      params.push(paymentMethod);
      conditions.push(`payment_method = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(description ILIKE $${params.length} OR category ILIKE $${params.length} OR COALESCE(counterparty_name, '') ILIKE $${params.length})`
      );
    }

    params.push(Number(limit) || 100);
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT * FROM cash_transactions
       ${whereClause}
       ORDER BY transaction_date DESC, id DESC
       LIMIT $${params.length}`,
      params
    );
    return rows;
  }

  async createTransaction(data) {
    if (data.idempotency_key) {
      const existing = await pool.query(
        'SELECT * FROM cash_transactions WHERE idempotency_key = $1',
        [data.idempotency_key]
      );
      if (existing.rows.length > 0) return existing.rows[0];
    }

    const { rows } = await pool.query(
      `INSERT INTO cash_transactions (
        idempotency_key, type, category, amount, payment_method, counterparty_name, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        data.idempotency_key || null,
        data.type,
        data.category.trim(),
        Number(data.amount),
        data.payment_method || 'CASH',
        data.counterparty_name?.trim() || null,
        data.description.trim(),
      ]
    );
    return rows[0];
  }

  async deleteTransaction(id) {
    const { rowCount } = await pool.query('DELETE FROM cash_transactions WHERE id = $1', [id]);
    return rowCount > 0;
  }

  // Credit / Debtors Book Methods
  async findCredits({ status }) {
    const params = [];
    let where = '';
    if (status && status !== 'ALL') {
      params.push(status);
      where = 'WHERE status = $1';
    }
    const { rows } = await pool.query(
      `SELECT * FROM credit_records ${where} ORDER BY status DESC, updated_at DESC`,
      params
    );
    return rows;
  }

  async createCreditRecord(data) {
    const total = Number(data.total_amount);
    const paid = Number(data.amount_paid || 0);
    const balance = Math.max(0, total - paid);
    const status = balance <= 0 ? 'PAID' : 'OWING';

    const { rows } = await pool.query(
      `INSERT INTO credit_records (customer_name, phone, items_summary, total_amount, amount_paid, balance_due, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.customer_name.trim(),
        data.phone?.trim() || null,
        data.items_summary.trim(),
        total,
        paid,
        balance,
        status,
      ]
    );
    return rows[0];
  }
}

module.exports = new CashbookRepository();
