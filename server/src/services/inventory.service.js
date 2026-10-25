const pool = require('../config/db');
const AppError = require('../utils/AppError');
const { multiplyCurrency } = require('../utils/money');
const cacheService = require('./cache.service');
const inventoryRepo = require('../repositories/inventory.repository');

class InventoryService {
  async getProducts(filters) {
    return inventoryRepo.findAllProducts(filters);
  }

  async createProduct(payload) {
    if (!payload.sku || !payload.name) {
      throw new AppError('SKU and Product Name are required.', 400, 'VALIDATION_ERROR');
    }
    if (Number(payload.selling_price) < Number(payload.cost_price)) {
      throw new AppError('Selling price cannot be lower than buying cost price.', 400, 'INVALID_PRICING');
    }
    const product = await inventoryRepo.createProduct(payload);
    cacheService.invalidatePrefix('dashboard:');
    return product;
  }

  async updateProduct(id, payload) {
    if (Number(payload.selling_price) < Number(payload.cost_price)) {
      throw new AppError('Selling price cannot be lower than buying cost price.', 400, 'INVALID_PRICING');
    }
    const updated = await inventoryRepo.updateProduct(id, payload);
    if (!updated) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    cacheService.invalidatePrefix('dashboard:');
    return updated;
  }

  // Fast Multi-Item Shop Counter Checkout (Cash, POS, Transfer, or Part-Payment/Credit)
  async checkoutCart(payload) {
    const {
      items, // [{ product_id, quantity }]
      payment_method = 'CASH',
      amount_paid,
      customer_name = '',
      customer_phone = '',
      note = '',
    } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('Basket is empty. Tap at least one product to sell.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let basketTotal = 0;
      const summaryParts = [];
      const movementsCreated = [];

      for (const item of items) {
        const qty = Number(item.quantity);
        if (qty <= 0 || Number.isNaN(qty)) continue;

        const prodRes = await client.query(
          'SELECT * FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id]
        );
        if (prodRes.rows.length === 0) {
          throw new AppError(`Product ID ${item.product_id} not found.`);
        }

        const product = prodRes.rows[0];
        const prevStock = Number(product.stock_quantity);
        if (prevStock < qty) {
          throw new AppError(
            `Not enough "${product.name}" in stock! Remaining: ${prevStock} ${product.unit}.`,
            409,
            'INSUFFICIENT_STOCK'
          );
        }

        const newStock = prevStock - qty;
        const unitPrice = Number(product.selling_price);
        const lineTotal = multiplyCurrency(unitPrice, qty);
        basketTotal = Number((basketTotal + lineTotal).toFixed(2));
        summaryParts.push(`${qty} ${product.unit} ${product.name}`);

        await client.query(
          'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newStock, product.id]
        );

        const movRes = await client.query(
          `INSERT INTO stock_movements (
            product_id, movement_type, quantity_change, previous_stock, new_stock,
            unit_price, total_value, counterparty_name, note
          ) VALUES ($1, 'SALE', $2, $3, $4, $5, $6, $7, $8)
          RETURNING *`,
          [
            product.id,
            -qty,
            prevStock,
            newStock,
            unitPrice,
            lineTotal,
            customer_name.trim() || 'Walk-in Customer',
            note.trim() || 'Counter Sale',
          ]
        );
        movementsCreated.push(movRes.rows[0]);
      }

      const itemsSummary = summaryParts.join(', ');
      const actualPaid =
        amount_paid !== undefined && amount_paid !== ''
          ? Number(amount_paid)
          : basketTotal;

      if (actualPaid < 0 || actualPaid > basketTotal) {
        throw new AppError('Amount paid cannot be negative or greater than total bill.');
      }

      const balanceDue = Number((basketTotal - actualPaid).toFixed(2));

      // If there is an unpaid balance, require customer name for the Credit/Debtors Book
      if (balanceDue > 0 && !customer_name.trim()) {
        throw new AppError(
          'Please enter the Customer Name to record the unpaid balance in your Credit Book.'
        );
      }

      // 1. Record Cash Inflow for the money actually paid right now
      let cashTx = null;
      if (actualPaid > 0) {
        const cashRes = await client.query(
          `INSERT INTO cash_transactions (
            type, category, amount, payment_method, counterparty_name, description, stock_movement_id
          ) VALUES ('INFLOW', 'Counter Sales', $1, $2, $3, $4, $5)
          RETURNING *`,
          [
            actualPaid,
            payment_method,
            customer_name.trim() || 'Walk-in Customer',
            `Sold: ${itemsSummary}${balanceDue > 0 ? ` (Part payment, owes ₦${balanceDue})` : ''}`,
            movementsCreated[0]?.id || null,
          ]
        );
        cashTx = cashRes.rows[0];
      }

      // 2. If customer owes a balance, automatically add to Credit / Debtors Book
      let creditRecord = null;
      if (balanceDue > 0) {
        const credRes = await client.query(
          `INSERT INTO credit_records (
            customer_name, phone, items_summary, total_amount, amount_paid, balance_due, status
          ) VALUES ($1, $2, $3, $4, $5, $6, 'OWING')
          RETURNING *`,
          [
            customer_name.trim(),
            customer_phone.trim() || null,
            itemsSummary,
            basketTotal,
            actualPaid,
            balanceDue,
          ]
        );
        creditRecord = credRes.rows[0];
      }

      await client.query('COMMIT');
      cacheService.invalidatePrefix('dashboard:');

      return {
        basketTotal,
        actualPaid,
        balanceDue,
        movementsCreated,
        cashTransaction: cashTx,
        creditRecord,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async recordMovement(payload) {
    const {
      idempotency_key,
      product_id,
      movement_type, // 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'DAMAGE'
      quantity,
      record_cash,
      amount_paid,
      payment_method = 'CASH',
      counterparty_name = '',
      note = '',
    } = payload;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (idempotency_key) {
        const existing = await client.query(
          'SELECT * FROM stock_movements WHERE idempotency_key = $1',
          [idempotency_key]
        );
        if (existing.rows.length > 0) {
          await client.query('COMMIT');
          return { movement: existing.rows[0], deduplicated: true };
        }
      }

      const productRes = await client.query(
        'SELECT * FROM products WHERE id = $1 FOR UPDATE',
        [product_id]
      );
      if (productRes.rows.length === 0) {
        throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
      }

      const product = productRes.rows[0];
      const previousStock = Number(product.stock_quantity);
      const inputQty = Number(quantity);

      if (Number.isNaN(inputQty)) {
        throw new AppError('Quantity must be a valid number.', 400, 'INVALID_QUANTITY');
      }

      let quantityChange = 0;
      let newStock = previousStock;
      let unitPrice = 0;

      switch (movement_type) {
        case 'SALE':
          if (inputQty <= 0) throw new AppError('Sale quantity must be greater than zero.');
          if (previousStock < inputQty) {
            throw new AppError(
              `Not enough "${product.name}" on shelf. Available: ${previousStock} ${product.unit}.`,
              409,
              'INSUFFICIENT_STOCK'
            );
          }
          quantityChange = -inputQty;
          newStock = previousStock - inputQty;
          unitPrice = Number(product.selling_price);
          break;

        case 'DAMAGE':
          if (inputQty <= 0) throw new AppError('Damaged quantity must be greater than zero.');
          if (previousStock < inputQty) {
            throw new AppError(`Damaged quantity cannot exceed current stock (${previousStock}).`);
          }
          quantityChange = -inputQty;
          newStock = previousStock - inputQty;
          unitPrice = Number(product.cost_price);
          break;

        case 'RESTOCK':
          if (inputQty <= 0) throw new AppError('Restock quantity must be greater than zero.');
          quantityChange = inputQty;
          newStock = previousStock + inputQty;
          unitPrice = Number(product.cost_price);
          break;

        case 'ADJUSTMENT':
          if (inputQty < 0) throw new AppError('Physical shelf count cannot be negative.');
          newStock = inputQty;
          quantityChange = newStock - previousStock;
          unitPrice = Number(product.cost_price);
          break;

        default:
          throw new AppError(`Unsupported movement type: ${movement_type}`);
      }

      const totalValue = multiplyCurrency(unitPrice, Math.abs(quantityChange));

      await client.query(
        'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newStock, product_id]
      );

      const movementRes = await client.query(
        `INSERT INTO stock_movements (
          idempotency_key, product_id, movement_type, quantity_change,
          previous_stock, new_stock, unit_price, total_value, counterparty_name, note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          idempotency_key || null,
          product_id,
          movement_type,
          quantityChange,
          previousStock,
          newStock,
          unitPrice,
          totalValue,
          counterparty_name.trim() || null,
          note.trim() || null,
        ]
      );

      let cashTransaction = null;
      if (record_cash && (movement_type === 'SALE' || movement_type === 'RESTOCK')) {
        const cashAmount =
          amount_paid !== undefined && amount_paid !== ''
            ? Number(amount_paid)
            : totalValue;

        if (cashAmount > 0) {
          const cashType = movement_type === 'SALE' ? 'INFLOW' : 'OUTFLOW';
          const cashCategory = movement_type === 'SALE' ? 'Counter Sales' : 'Market Restock';
          const actionLabel = movement_type === 'SALE' ? 'Sold' : 'Restocked';
          const description =
            note.trim() ||
            `${actionLabel} ${Math.abs(quantityChange)} ${product.unit} of ${product.name}`;

          const cashRes = await client.query(
            `INSERT INTO cash_transactions (
              idempotency_key, type, category, amount, payment_method,
              counterparty_name, description, stock_movement_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
              idempotency_key ? `${idempotency_key}-cash` : null,
              cashType,
              cashCategory,
              cashAmount,
              payment_method,
              counterparty_name.trim() || null,
              description,
              movementRes.rows[0].id,
            ]
          );
          cashTransaction = cashRes.rows[0];
        }
      }

      await client.query('COMMIT');
      cacheService.invalidatePrefix('dashboard:');

      return {
        movement: movementRes.rows[0],
        cashTransaction,
        deduplicated: false,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getRecentMovements(limit) {
    return inventoryRepo.findRecentMovements(limit);
  }
}

module.exports = new InventoryService();
