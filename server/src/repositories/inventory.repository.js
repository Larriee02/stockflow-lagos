const pool = require('../config/db');

class InventoryRepository {
  async findAllProducts({ category, search, lowStockOnly }) {
    const conditions = [];
    const params = [];

    if (category && category !== 'ALL') {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR COALESCE(supplier_name, '') ILIKE $${params.length})`);
    }
    if (lowStockOnly === 'true') {
      conditions.push(`stock_quantity <= reorder_level`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT *
      FROM products
      ${whereClause}
      ORDER BY (stock_quantity <= reorder_level) DESC, name ASC
    `;
    const { rows } = await pool.query(query, params);
    return rows;
  }

  async createProduct(data) {
    const { rows } = await pool.query(
      `INSERT INTO products (sku, name, category, unit, cost_price, selling_price, stock_quantity, reorder_level, supplier_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.sku.trim().toUpperCase(),
        data.name.trim(),
        (data.category || 'General').trim(),
        (data.unit || 'pcs').trim(),
        Number(data.cost_price),
        Number(data.selling_price),
        Number(data.stock_quantity || 0),
        Number(data.reorder_level || 5),
        data.supplier_name ? data.supplier_name.trim() : null,
      ]
    );
    return rows[0];
  }

  async updateProduct(id, data) {
    const { rows } = await pool.query(
      `UPDATE products
       SET name = $1,
           category = $2,
           unit = $3,
           cost_price = $4,
           selling_price = $5,
           reorder_level = $6,
           supplier_name = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        data.name.trim(),
        data.category.trim(),
        data.unit.trim(),
        Number(data.cost_price),
        Number(data.selling_price),
        Number(data.reorder_level),
        data.supplier_name ? data.supplier_name.trim() : null,
        id,
      ]
    );
    return rows[0];
  }

  async findRecentMovements(limit = 200) {
    const { rows } = await pool.query(
      `SELECT sm.*, p.name AS product_name, p.sku, p.unit, p.category
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       ORDER BY sm.created_at DESC, sm.id DESC
       LIMIT $1`,
      [Number(limit) || 200]
    );
    return rows;
  }
}

module.exports = new InventoryRepository();
