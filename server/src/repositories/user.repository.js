const db = require('../config/db');

// Columns safe to expose to the user's own client / admin console (never password hashes or token versions).
const BASE_FIELDS = [
  'id', 'email', 'full_name', 'business_name', 'phone', 'business_type', 'city', 'address',
  'currency', 'role', 'status', 'auth_provider', 'avatar_url', 'must_change_password',
  'last_login_at', 'approved_at', 'created_at', 'updated_at',
];
const ADMIN_FIELDS = ['admin_note', 'approved_by', 'failed_login_attempts', 'locked_until'];

const columns = (fields, alias = '') => {
  const p = alias ? `${alias}.` : '';
  return [
    ...fields.map((f) => `${p}${f}`),
    `(${p}password_hash IS NOT NULL) AS has_password`,
    `(${p}google_sub IS NOT NULL) AS google_linked`,
    `(${p}apple_sub IS NOT NULL) AS apple_linked`,
  ].join(', ');
};

const PUBLIC_COLUMNS = columns(BASE_FIELDS);
const ADMIN_COLUMNS = columns([...BASE_FIELDS, ...ADMIN_FIELDS]);
const ADMIN_COLUMNS_U = columns([...BASE_FIELDS, ...ADMIN_FIELDS], 'u');

const SORTABLE = {
  created_at: 'u.created_at',
  full_name: 'LOWER(u.full_name)',
  business_name: 'LOWER(u.business_name)',
  email: 'LOWER(u.email)',
  last_login_at: 'u.last_login_at',
  status: 'u.status',
};

class UserRepository {
  async findAuthById(id, q = db) {
    const { rows } = await q.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findAuthByEmail(email, q = db) {
    const { rows } = await q.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    return rows[0] || null;
  }

  async findAuthByProviderSub(provider, sub, q = db) {
    const column = provider === 'GOOGLE' ? 'google_sub' : 'apple_sub';
    const { rows } = await q.query(`SELECT * FROM users WHERE ${column} = $1`, [sub]);
    return rows[0] || null;
  }

  async findPublicById(id, q = db) {
    const { rows } = await q.query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  async create(data, q = db) {
    const { rows } = await q.query(
      `INSERT INTO users (
         email, password_hash, full_name, business_name, phone, business_type, city,
         role, status, auth_provider, google_sub, apple_sub, avatar_url, approved_at, currency
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        data.email,
        data.password_hash || null,
        data.full_name,
        data.business_name || '',
        data.phone || null,
        data.business_type || null,
        data.city || 'Lagos',
        data.role || 'USER',
        data.status || 'PENDING',
        data.auth_provider || 'EMAIL',
        data.google_sub || null,
        data.apple_sub || null,
        data.avatar_url || null,
        data.status === 'APPROVED' ? new Date() : null,
        data.currency || 'NGN',
      ]
    );
    return rows[0].id;
  }

  async linkProvider(id, provider, sub, avatarUrl, q = db) {
    const column = provider === 'GOOGLE' ? 'google_sub' : 'apple_sub';
    await q.query(
      `UPDATE users SET ${column} = $1, avatar_url = COALESCE(avatar_url, $2), updated_at = NOW() WHERE id = $3`,
      [sub, avatarUrl || null, id]
    );
  }

  async recordLoginSuccess(id) {
    await db.query(
      `UPDATE users SET last_login_at = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [id]
    );
  }

  async recordLoginFailure(id, maxAttempts, lockMinutes) {
    await db.query(
      `UPDATE users
         SET failed_login_attempts = failed_login_attempts + 1,
             locked_until = CASE WHEN failed_login_attempts + 1 >= $2::int
                                 THEN NOW() + make_interval(mins => $3::int) ELSE locked_until END
       WHERE id = $1::int`,
      [id, maxAttempts, lockMinutes]
    );
  }

  async updateProfile(id, fields) {
    await db.query(
      `UPDATE users SET full_name = $1, business_name = $2, phone = $3, business_type = $4,
              city = $5, address = $6, currency = $7, updated_at = NOW()
       WHERE id = $8`,
      [
        fields.full_name,
        fields.business_name,
        fields.phone,
        fields.business_type,
        fields.city,
        fields.address,
        fields.currency || 'NGN',
        id,
      ]
    );
  }

  async setPassword(id, hash, { mustChange = false, bumpTokenVersion = true } = {}) {
    await db.query(
      `UPDATE users SET password_hash = $1, must_change_password = $2,
              token_version = token_version + $3, failed_login_attempts = 0, locked_until = NULL,
              updated_at = NOW()
       WHERE id = $4`,
      [hash, mustChange, bumpTokenVersion ? 1 : 0, id]
    );
  }

  async bumpTokenVersion(id) {
    await db.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [id]);
  }

  /* ------------------------------- Admin queries ------------------------------- */

  async adminList({ search, status, role, provider, sort, order, page, pageSize }) {
    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      const i = params.length;
      where.push(
        `(u.email ILIKE $${i} OR u.full_name ILIKE $${i} OR u.business_name ILIKE $${i} OR COALESCE(u.phone, '') ILIKE $${i})`
      );
    }
    if (status) {
      params.push(status);
      where.push(`u.status = $${params.length}`);
    }
    if (role) {
      params.push(role);
      where.push(`u.role = $${params.length}`);
    }
    if (provider) {
      params.push(provider);
      where.push(`u.auth_provider = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortSql = SORTABLE[sort] || SORTABLE.created_at;
    const dir = order === 'asc' ? 'ASC' : 'DESC';

    const countRes = await db.query(`SELECT COUNT(*)::int AS total FROM users u ${whereSql}`, params);

    params.push(pageSize, (page - 1) * pageSize);
    const { rows } = await db.query(
      `SELECT ${ADMIN_COLUMNS_U},
         (SELECT COUNT(*)::int FROM products p WHERE p.user_id = u.id) AS product_count,
         (SELECT COALESCE(SUM(c.amount), 0)::numeric(14,2) FROM cash_transactions c
            WHERE c.user_id = u.id AND c.type = 'INFLOW') AS total_inflow
       FROM users u
       ${whereSql}
       ORDER BY ${sortSql} ${dir} NULLS LAST, u.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { users: rows, total: countRes.rows[0].total };
  }

  async adminFindById(id) {
    const { rows } = await db.query(`SELECT ${ADMIN_COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  }

  async adminStoreStats(userId) {
    const { rows } = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM products WHERE user_id = $1) AS product_count,
         (SELECT COALESCE(SUM(stock_quantity * selling_price), 0)::numeric(14,2) FROM products WHERE user_id = $1) AS stock_retail_value,
         (SELECT COALESCE(SUM(amount), 0)::numeric(14,2) FROM cash_transactions WHERE user_id = $1 AND type = 'INFLOW') AS total_inflow,
         (SELECT COALESCE(SUM(amount), 0)::numeric(14,2) FROM cash_transactions WHERE user_id = $1 AND type = 'OUTFLOW') AS total_outflow,
         (SELECT COUNT(*)::int FROM cash_transactions WHERE user_id = $1) AS transaction_count,
         (SELECT COUNT(*)::int FROM stock_movements WHERE user_id = $1 AND movement_type = 'SALE') AS sale_count,
         (SELECT COUNT(*)::int FROM credit_records WHERE user_id = $1 AND status = 'OWING') AS active_debtors,
         (SELECT MAX(transaction_date) FROM cash_transactions WHERE user_id = $1) AS last_activity_at`,
      [userId]
    );
    return rows[0];
  }

  async adminStats() {
    const { rows } = await db.query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_users,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved_users,
        COUNT(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended_users,
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_users,
        COUNT(*) FILTER (WHERE role = 'ADMIN')::int AS admin_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS signups_7d,
        COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days')::int AS active_7d,
        COUNT(*) FILTER (WHERE auth_provider = 'GOOGLE')::int AS google_users,
        COUNT(*) FILTER (WHERE auth_provider = 'APPLE')::int AS apple_users,
        COUNT(*) FILTER (WHERE auth_provider = 'EMAIL')::int AS email_users
      FROM users
    `);
    const gmv = await db.query(`
      SELECT COALESCE(SUM(amount), 0)::numeric(14,2) AS platform_inflow,
             COUNT(*)::int AS platform_transactions
      FROM cash_transactions
    `);
    return { ...rows[0], ...gmv.rows[0] };
  }

  async adminUpdateStatus(id, status, adminId, note) {
    await db.query(
      `UPDATE users SET
         status = $1::varchar,
         approved_at = CASE WHEN $1::varchar = 'APPROVED' THEN NOW() ELSE approved_at END,
         approved_by = CASE WHEN $1::varchar = 'APPROVED' THEN $2::int ELSE approved_by END,
         admin_note = COALESCE($3::text, admin_note),
         token_version = token_version + CASE WHEN $1::varchar IN ('SUSPENDED', 'REJECTED') THEN 1 ELSE 0 END,
         updated_at = NOW()
       WHERE id = $4::int`,
      [status, adminId, note ?? null, id]
    );
  }

  async adminSetRole(id, role) {
    await db.query(
      `UPDATE users SET role = $1::varchar,
         status = CASE WHEN $1::varchar = 'ADMIN' THEN 'APPROVED' ELSE status END,
         token_version = token_version + 1, updated_at = NOW()
       WHERE id = $2::int`,
      [role, id]
    );
  }

  async adminSetNote(id, note) {
    await db.query('UPDATE users SET admin_note = $1, updated_at = NOW() WHERE id = $2', [note, id]);
  }

  async countAdmins() {
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE role = 'ADMIN' AND status = 'APPROVED'`
    );
    return rows[0].n;
  }

  async deleteWithData(id) {
    await db.withTransaction(async (tx) => {
      // Explicit order: stock_movements -> products uses ON DELETE RESTRICT.
      await tx.query('DELETE FROM cash_transactions WHERE user_id = $1', [id]);
      await tx.query('DELETE FROM credit_records WHERE user_id = $1', [id]);
      await tx.query('DELETE FROM stock_movements WHERE user_id = $1', [id]);
      await tx.query('DELETE FROM products WHERE user_id = $1', [id]);
      await tx.query('DELETE FROM users WHERE id = $1', [id]);
    });
  }

  async exportAll() {
    const { rows } = await db.query(
      `SELECT id, email, full_name, business_name, phone, business_type, city, role, status,
              auth_provider, created_at, approved_at, last_login_at
       FROM users ORDER BY created_at DESC LIMIT 10000`
    );
    return rows;
  }
}

module.exports = new UserRepository();
