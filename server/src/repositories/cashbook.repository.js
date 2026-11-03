const db = require('../config/db');

class CashbookRepository {
  async getDashboardMetrics(userId) {
    const { rows } = await db.query(
      `
      WITH inv AS (
        SELECT
          COUNT(*)::int AS total_products,
          COUNT(*) FILTER (WHERE stock_quantity <= reorder_level)::int AS low_stock_count,
          COALESCE(SUM(stock_quantity * cost_price), 0)::numeric(14,2) AS inventory_cost_value,
          COALESCE(SUM(stock_quantity * selling_price), 0)::numeric(14,2) AS inventory_retail_value,
          COALESCE(SUM(stock_quantity * (selling_price - cost_price)), 0)::numeric(14,2) AS projected_gross_margin
        FROM products
        WHERE user_id = $1
      ),
      cash AS (
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type = 'INFLOW' AND COALESCE(status, 'ACTIVE') = 'ACTIVE'), 0)::numeric(14,2) AS total_inflow,
          COALESCE(SUM(amount) FILTER (WHERE type = 'OUTFLOW' AND COALESCE(status, 'ACTIVE') = 'ACTIVE'), 0)::numeric(14,2) AS total_outflow,
          COALESCE(SUM(amount) FILTER (WHERE type = 'INFLOW' AND COALESCE(status, 'ACTIVE') = 'ACTIVE' AND transaction_date >= CURRENT_DATE), 0)::numeric(14,2) AS today_inflow,
          COALESCE(SUM(amount) FILTER (WHERE type = 'OUTFLOW' AND COALESCE(status, 'ACTIVE') = 'ACTIVE' AND transaction_date >= CURRENT_DATE), 0)::numeric(14,2) AS today_outflow
        FROM cash_transactions
        WHERE user_id = $1
      ),
      cred AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'OWING')::int AS active_debtors_count,
          COALESCE(SUM(balance_due) FILTER (WHERE status = 'OWING'), 0)::numeric(14,2) AS total_credit_owed
        FROM credit_records
        WHERE user_id = $1
      )
      SELECT
        inv.*,
        cash.*,
        cred.*,
        (cash.total_inflow - cash.total_outflow)::numeric(14,2) AS net_cash_balance
      FROM inv, cash, cred;
    `,
      [userId]
    );

    const categoryBreakdown = await db.query(
      `
      SELECT
        category,
        COUNT(*)::int AS sku_count,
        COALESCE(SUM(stock_quantity * cost_price), 0)::numeric(14,2) AS cost_value,
        COALESCE(SUM(stock_quantity * selling_price), 0)::numeric(14,2) AS retail_value
      FROM products
      WHERE user_id = $1
      GROUP BY category
      ORDER BY retail_value DESC
    `,
      [userId]
    );

    const cashChannelBreakdown = await db.query(
      `
      SELECT
        payment_method,
        COALESCE(SUM(amount) FILTER (WHERE type = 'INFLOW' AND COALESCE(status, 'ACTIVE') = 'ACTIVE'), 0)::numeric(14,2) AS inflow,
        COALESCE(SUM(amount) FILTER (WHERE type = 'OUTFLOW' AND COALESCE(status, 'ACTIVE') = 'ACTIVE'), 0)::numeric(14,2) AS outflow,
        (
          COALESCE(SUM(amount) FILTER (WHERE type = 'INFLOW' AND COALESCE(status, 'ACTIVE') = 'ACTIVE'), 0) -
          COALESCE(SUM(amount) FILTER (WHERE type = 'OUTFLOW' AND COALESCE(status, 'ACTIVE') = 'ACTIVE'), 0)
        )::numeric(14,2) AS net
      FROM cash_transactions
      WHERE user_id = $1 AND COALESCE(status, 'ACTIVE') = 'ACTIVE'
      GROUP BY payment_method
      ORDER BY net DESC
    `,
      [userId]
    );

    return {
      ...rows[0],
      categories: categoryBreakdown.rows,
      channels: cashChannelBreakdown.rows,
    };
  }

  async findTransactions(
    userId,
    { type, paymentMethod, category, status, startDate, endDate, search, limit = 500 } = {}
  ) {
    const conditions = ['user_id = $1'];
    const params = [userId];

    if (type && (type === 'INFLOW' || type === 'OUTFLOW')) {
      params.push(type);
      conditions.push(`type = $${params.length}`);
    }
    if (paymentMethod && paymentMethod !== 'ALL') {
      params.push(paymentMethod);
      conditions.push(`payment_method = $${params.length}`);
    }
    if (category && category !== 'ALL') {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`COALESCE(status, 'ACTIVE') = $${params.length}`);
    }
    if (startDate) {
      const startStr = String(startDate).trim();
      const startIso =
        startStr.length <= 10
          ? new Date(`${startStr}T00:00:00.000Z`).toISOString()
          : new Date(startStr).toISOString();
      params.push(startIso);
      conditions.push(`transaction_date >= $${params.length}`);
    }
    if (endDate) {
      const endStr = String(endDate).trim();
      const endIso =
        endStr.length <= 10
          ? new Date(`${endStr}T23:59:59.999Z`).toISOString()
          : new Date(endStr).toISOString();
      params.push(endIso);
      conditions.push(`transaction_date <= $${params.length}`);
    }
    if (search) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(description ILIKE $${params.length} OR category ILIKE $${params.length} OR COALESCE(counterparty_name, '') ILIKE $${params.length} OR COALESCE(expense_reason, '') ILIKE $${params.length} OR COALESCE(correction_reason, '') ILIKE $${params.length})`
      );
    }

    params.push(Number(limit) || 500);
    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const { rows } = await db.query(
      `SELECT * FROM cash_transactions
       ${whereClause}
       ORDER BY transaction_date DESC, id DESC
       LIMIT $${params.length}`,
      params
    );
    return rows;
  }

  async createTransaction(userId, data, client = db) {
    if (data.idempotency_key) {
      const existing = await client.query(
        'SELECT * FROM cash_transactions WHERE user_id = $1 AND idempotency_key = $2',
        [userId, data.idempotency_key]
      );
      if (existing.rows.length > 0) return existing.rows[0];
    }

    const expenseReason = data.expense_reason
      ? String(data.expense_reason).trim()
      : data.type === 'OUTFLOW'
      ? String(data.description || data.category || '').trim()
      : null;

    const { rows } = await client.query(
      `INSERT INTO cash_transactions (
        user_id, idempotency_key, type, category, amount, payment_method,
        counterparty_name, description, expense_reason, status, parent_transaction_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10)
      RETURNING *`,
      [
        userId,
        data.idempotency_key || null,
        data.type,
        data.category.trim(),
        Number(data.amount),
        data.payment_method || 'CASH',
        data.counterparty_name?.trim() || null,
        data.description.trim(),
        expenseReason,
        data.parent_transaction_id || null,
      ]
    );
    return rows[0];
  }

  async findSessions(userId, limit = 30) {
    const { rows } = await db.query(
      `SELECT * FROM cashbook_sessions
       WHERE user_id = $1
       ORDER BY session_date DESC
       LIMIT $2`,
      [userId, Number(limit) || 30]
    );
    return rows;
  }

  async findSessionByDate(userId, dateStr, client = db) {
    const { rows } = await client.query(
      `SELECT * FROM cashbook_sessions WHERE user_id = $1 AND session_date = $2`,
      [userId, dateStr]
    );
    return rows[0] || null;
  }

  async upsertOpeningSession(userId, data, client = db) {
    const {
      session_date,
      opening_balance = 0,
      opening_cash = 0,
      opening_bank_pos = 0,
      opening_note = null,
    } = data;

    const { rows } = await client.query(
      `INSERT INTO cashbook_sessions (
        user_id, session_date, opening_balance, opening_cash, opening_bank_pos, opening_note, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
      ON CONFLICT (user_id, session_date)
      DO UPDATE SET
        opening_balance = EXCLUDED.opening_balance,
        opening_cash = EXCLUDED.opening_cash,
        opening_bank_pos = EXCLUDED.opening_bank_pos,
        opening_note = EXCLUDED.opening_note,
        status = 'OPEN'
      RETURNING *`,
      [
        userId,
        session_date,
        Number(opening_balance),
        Number(opening_cash),
        Number(opening_bank_pos),
        opening_note,
      ]
    );
    return rows[0];
  }

  async closeSession(userId, data, client = db) {
    const {
      session_date,
      opening_balance = 0,
      opening_cash = 0,
      opening_bank_pos = 0,
      expected_closing_balance = 0,
      actual_closing_balance = 0,
      actual_closing_cash = 0,
      actual_closing_bank_pos = 0,
      variance = 0,
      closing_note = null,
    } = data;

    const { rows } = await client.query(
      `INSERT INTO cashbook_sessions (
        user_id, session_date, opening_balance, opening_cash, opening_bank_pos,
        expected_closing_balance, actual_closing_balance, actual_closing_cash,
        actual_closing_bank_pos, variance, closing_note, status, closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'CLOSED', CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, session_date)
      DO UPDATE SET
        opening_balance = EXCLUDED.opening_balance,
        expected_closing_balance = EXCLUDED.expected_closing_balance,
        actual_closing_balance = EXCLUDED.actual_closing_balance,
        actual_closing_cash = EXCLUDED.actual_closing_cash,
        actual_closing_bank_pos = EXCLUDED.actual_closing_bank_pos,
        variance = EXCLUDED.variance,
        closing_note = EXCLUDED.closing_note,
        status = 'CLOSED',
        closed_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        userId,
        session_date,
        Number(opening_balance),
        Number(opening_cash),
        Number(opening_bank_pos),
        Number(expected_closing_balance),
        Number(actual_closing_balance),
        Number(actual_closing_cash),
        Number(actual_closing_bank_pos),
        Number(variance),
        closing_note,
      ]
    );
    return rows[0];
  }

  async findCredits(userId, { status } = {}) {
    const params = [userId];
    let where = 'WHERE user_id = $1';
    if (status && status !== 'ALL') {
      params.push(status);
      where += ' AND status = $2';
    }
    const { rows } = await db.query(
      `SELECT * FROM credit_records ${where} ORDER BY status DESC, updated_at DESC`,
      params
    );

    const now = new Date();
    return rows.map((r) => {
      const balance = Number(r.balance_due || 0);
      const dueDate = r.due_date ? new Date(r.due_date) : null;
      const isOverdue = Boolean(dueDate && dueDate < now && balance > 0);
      const daysOverdue = isOverdue
        ? Math.max(1, Math.ceil((now.getTime() - dueDate.getTime()) / 86400000))
        : 0;
      return {
        ...r,
        is_overdue: isOverdue,
        days_overdue: daysOverdue,
      };
    });
  }

  async createCreditRecord(userId, data, client = db) {
    const total = Number(data.total_amount);
    const paid = Number(data.amount_paid || 0);
    const balance = Math.max(0, total - paid);
    const status = balance <= 0 ? 'PAID' : 'OWING';
    const dueDate = data.due_date
      ? new Date(data.due_date).toISOString()
      : new Date(Date.now() + 7 * 86400000).toISOString();

    const { rows } = await client.query(
      `INSERT INTO credit_records (
        user_id, customer_name, phone, items_summary, total_amount, amount_paid,
        balance_due, status, due_date, customer_address, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        userId,
        data.customer_name.trim(),
        data.phone?.trim() || null,
        data.items_summary.trim(),
        total,
        paid,
        balance,
        status,
        dueDate,
        data.customer_address?.trim() || null,
        data.notes?.trim() || null,
      ]
    );

    const row = rows[0];

    if (paid > 0) {
      await client.query(
        `INSERT INTO credit_repayments (
          user_id, credit_record_id, customer_name, amount, payment_method, note
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          row.id,
          data.customer_name.trim(),
          paid,
          data.payment_method || 'CASH',
          data.repayment_note?.trim() || 'Initial down-payment at creation',
        ]
      );
    }

    const now = new Date();
    const dDate = row.due_date ? new Date(row.due_date) : null;
    const isOverdue = Boolean(dDate && dDate < now && Number(row.balance_due) > 0);
    const daysOverdue = isOverdue
      ? Math.max(1, Math.ceil((now.getTime() - dDate.getTime()) / 86400000))
      : 0;

    return {
      ...row,
      is_overdue: isOverdue,
      days_overdue: daysOverdue,
    };
  }

  async recordCreditRepayment(userId, data, client = db) {
    const { rows } = await client.query(
      `INSERT INTO credit_repayments (
        user_id, credit_record_id, customer_name, amount, payment_method, note
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        userId,
        data.credit_record_id || null,
        data.customer_name.trim(),
        Number(data.amount),
        data.payment_method || 'CASH',
        data.note?.trim() || null,
      ]
    );
    return rows[0];
  }

  async findCreditRepayments(userId, { customer_name, credit_record_id } = {}) {
    const conditions = ['user_id = $1'];
    const params = [userId];

    if (credit_record_id) {
      params.push(Number(credit_record_id));
      conditions.push(`credit_record_id = $${params.length}`);
    }
    if (customer_name) {
      params.push(customer_name.trim().toLowerCase());
      conditions.push(`LOWER(customer_name) = $${params.length}`);
    }

    const { rows } = await db.query(
      `SELECT * FROM credit_repayments
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC, id DESC`,
      params
    );
    return rows;
  }
}

module.exports = new CashbookRepository();
