const db = require('../config/db');

class AuditRepository {
  async log({ actorUserId = null, action, targetUserId = null, details = {}, ip = null }, q = db) {
    try {
      await q.query(
        `INSERT INTO audit_logs (actor_user_id, action, target_user_id, details, ip_address)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [actorUserId, action, targetUserId, JSON.stringify(details || {}), ip]
      );
    } catch (err) {
      // Auditing must never break the primary action.
      console.error('[Audit] Failed to write audit log:', err.message);
    }
  }

  async list({ page = 1, pageSize = 30, action, targetUserId }) {
    const where = [];
    const params = [];
    if (action) {
      params.push(action);
      where.push(`a.action = $${params.length}`);
    }
    if (targetUserId) {
      params.push(targetUserId);
      where.push(`a.target_user_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await db.query(`SELECT COUNT(*)::int AS total FROM audit_logs a ${whereSql}`, params);
    params.push(pageSize, (page - 1) * pageSize);
    const { rows } = await db.query(
      `SELECT a.id, a.action, a.details, a.ip_address, a.created_at,
              a.actor_user_id, actor.full_name AS actor_name, actor.email AS actor_email,
              a.target_user_id, target.full_name AS target_name, target.email AS target_email
       FROM audit_logs a
       LEFT JOIN users actor ON actor.id = a.actor_user_id
       LEFT JOIN users target ON target.id = a.target_user_id
       ${whereSql}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return { logs: rows, total: count.rows[0].total };
  }
}

module.exports = new AuditRepository();
