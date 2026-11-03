const db = require('../config/db');
const AppError = require('../utils/AppError');
const { multiplyCurrency } = require('../utils/money');
const cacheService = require('./cache.service');
const inventoryRepo = require('../repositories/inventory.repository');
const { seedStarterCatalog } = require('../db/starterCatalog');

class InventoryService {
  async getProducts(userId, filters) {
    return inventoryRepo.findAllProducts(userId, filters);
  }

  async createProduct(userId, payload) {
    if (!payload.sku || !payload.name) {
      throw new AppError('SKU and Product Name are required.', 400, 'VALIDATION_ERROR');
    }
    if (Number(payload.selling_price) < Number(payload.cost_price)) {
      throw new AppError(
        'Selling price cannot be lower than buying cost price.',
        400,
        'INVALID_PRICING'
      );
    }
    const product = await inventoryRepo.createProduct(userId, payload);
    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return product;
  }

  async updateProduct(userId, id, payload) {
    if (Number(payload.selling_price) < Number(payload.cost_price)) {
      throw new AppError(
        'Selling price cannot be lower than buying cost price.',
        400,
        'INVALID_PRICING'
      );
    }
    const updated = await inventoryRepo.updateProduct(userId, id, payload);
    if (!updated) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return updated;
  }

  async deleteProduct(userId, id) {
    const deleted = await inventoryRepo.deleteProduct(userId, id);
    if (!deleted) throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return { deleted: true };
  }

  async seedStarterProducts(userId) {
    await db.withTransaction(async (tx) => {
      await seedStarterCatalog(tx, userId);
    });
    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return inventoryRepo.findAllProducts(userId, {});
  }

  // Fast Multi-Item Shop Counter Checkout (Cash, POS, Transfer, or Part-Payment/Credit)
  async checkoutCart(userId, payload) {
    const {
      items,
      payment_method = 'CASH',
      amount_paid,
      customer_name = '',
      customer_phone = '',
      note = '',
    } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('Basket is empty. Tap at least one product to sell.');
    }

    const result = await db.withTransaction(async (client) => {
      let basketTotal = 0;
      const summaryParts = [];
      const movementsCreated = [];

      for (const item of items) {
        const qty = Number(item.quantity);
        if (qty <= 0 || Number.isNaN(qty)) continue;

        const prodRes = await client.query(
          'SELECT * FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [item.product_id, userId]
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
          'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
          [newStock, product.id, userId]
        );

        const movRes = await client.query(
          `INSERT INTO stock_movements (
            user_id, product_id, movement_type, quantity_change, previous_stock, new_stock,
            unit_price, total_value, counterparty_name, note
          ) VALUES ($1, $2, 'SALE', $3, $4, $5, $6, $7, $8, $9)
          RETURNING *`,
          [
            userId,
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
        movementsCreated.push({
          ...movRes.rows[0],
          product_name: product.name,
          unit: product.unit,
          sku: product.sku,
        });
      }

      const itemsSummary = summaryParts.join(', ');
      const actualPaid =
        amount_paid !== undefined && amount_paid !== '' ? Number(amount_paid) : basketTotal;

      if (actualPaid < 0 || actualPaid > basketTotal) {
        throw new AppError('Amount paid cannot be negative or greater than total bill.');
      }

      const balanceDue = Number((basketTotal - actualPaid).toFixed(2));

      if (balanceDue > 0 && !customer_name.trim()) {
        throw new AppError(
          'Please enter the Customer Name to record the unpaid balance in your Credit Book.'
        );
      }

      let cashTx = null;
      if (actualPaid > 0) {
        const cashRes = await client.query(
          `INSERT INTO cash_transactions (
            user_id, type, category, amount, payment_method, counterparty_name, description, stock_movement_id
          ) VALUES ($1, 'INFLOW', 'Counter Sales', $2, $3, $4, $5, $6)
          RETURNING *`,
          [
            userId,
            actualPaid,
            payment_method,
            customer_name.trim() || 'Walk-in Customer',
            `Sold: ${itemsSummary}${balanceDue > 0 ? ` (Part payment, owes ₦${balanceDue})` : ''}`,
            movementsCreated[0]?.id || null,
          ]
        );
        cashTx = cashRes.rows[0];
      }

      let creditRecord = null;
      if (balanceDue > 0) {
        const credRes = await client.query(
          `INSERT INTO credit_records (
            user_id, customer_name, phone, items_summary, total_amount, amount_paid, balance_due, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OWING')
          RETURNING *`,
          [
            userId,
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

      return {
        basketTotal,
        actualPaid,
        balanceDue,
        itemsSummary,
        movementsCreated,
        cashTransaction: cashTx,
        creditRecord,
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }

  async recordMovement(userId, payload) {
    const {
      idempotency_key,
      product_id,
      movement_type,
      quantity,
      record_cash,
      amount_paid,
      payment_method = 'CASH',
      counterparty_name = '',
      note = '',
    } = payload;

    const result = await db.withTransaction(async (client) => {
      if (idempotency_key) {
        const existing = await client.query(
          'SELECT * FROM stock_movements WHERE user_id = $1 AND idempotency_key = $2',
          [userId, idempotency_key]
        );
        if (existing.rows.length > 0) {
          return { movement: existing.rows[0], deduplicated: true };
        }
      }

      const productRes = await client.query(
        'SELECT * FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [product_id, userId]
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

      const normalizedType = String(movement_type || '').toUpperCase();
      switch (normalizedType) {
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
        case 'DAMAGED':
          if (inputQty <= 0) throw new AppError('Damaged quantity must be greater than zero.');
          if (previousStock < inputQty) {
            throw new AppError(`Damaged quantity cannot exceed current stock (${previousStock}).`);
          }
          quantityChange = -inputQty;
          newStock = previousStock - inputQty;
          unitPrice = Number(product.cost_price);
          break;

        case 'EXPIRED':
          if (inputQty <= 0) throw new AppError('Expired quantity must be greater than zero.');
          if (previousStock < inputQty) {
            throw new AppError(`Expired quantity cannot exceed current stock (${previousStock}).`);
          }
          quantityChange = -inputQty;
          newStock = previousStock - inputQty;
          unitPrice = Number(product.cost_price);
          break;

        case 'MISSING':
          if (inputQty <= 0) throw new AppError('Missing quantity must be greater than zero.');
          if (previousStock < inputQty) {
            throw new AppError(`Missing quantity cannot exceed current stock (${previousStock}).`);
          }
          quantityChange = -inputQty;
          newStock = previousStock - inputQty;
          unitPrice = Number(product.cost_price);
          break;

        case 'SURPLUS':
          if (inputQty <= 0) throw new AppError('Surplus quantity must be greater than zero.');
          quantityChange = inputQty;
          newStock = previousStock + inputQty;
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
        'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
        [newStock, product_id, userId]
      );

      const movementRes = await client.query(
        `INSERT INTO stock_movements (
          user_id, idempotency_key, product_id, movement_type, quantity_change,
          previous_stock, new_stock, unit_price, total_value, counterparty_name, note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          userId,
          idempotency_key || null,
          product_id,
          normalizedType === 'DAMAGE' ? 'DAMAGED' : normalizedType,
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
          amount_paid !== undefined && amount_paid !== '' ? Number(amount_paid) : totalValue;

        if (cashAmount > 0) {
          const cashType = movement_type === 'SALE' ? 'INFLOW' : 'OUTFLOW';
          const cashCategory = movement_type === 'SALE' ? 'Counter Sales' : 'Market Restock';
          const actionLabel = movement_type === 'SALE' ? 'Sold' : 'Restocked';
          const description =
            note.trim() ||
            `${actionLabel} ${Math.abs(quantityChange)} ${product.unit} of ${product.name}`;

          const cashRes = await client.query(
            `INSERT INTO cash_transactions (
              user_id, idempotency_key, type, category, amount, payment_method,
              counterparty_name, description, stock_movement_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
              userId,
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

      return {
        movement: movementRes.rows[0],
        cashTransaction,
        deduplicated: false,
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }

  async getRecentMovements(userId, limit) {
    return inventoryRepo.findRecentMovements(userId, limit);
  }

  /**
   * Bulk Product Import from CSV or Excel data
   */
  async bulkImportProducts(userId, payload) {
    const { products: rawProducts, updateExisting = true } = payload || {};
    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      throw new AppError('No products provided for import.', 400);
    }

    const result = await db.withTransaction(async (client) => {
      let importedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      const processedProducts = [];

      // Fetch all existing products for this user once for fast memory matching
      const existingRes = await client.query(
        'SELECT * FROM products WHERE user_id = $1',
        [userId]
      );
      const existingMapBySku = new Map();
      const existingMapByName = new Map();
      for (const p of existingRes.rows) {
        if (p.sku) existingMapBySku.set(String(p.sku).trim().toUpperCase(), p);
        if (p.name) existingMapByName.set(String(p.name).trim().toLowerCase(), p);
      }

      for (let i = 0; i < rawProducts.length; i++) {
        const row = rawProducts[i];
        const name = String(row.name || '').trim();
        if (!name) {
          skippedCount++;
          continue;
        }

        const sku = String(
          row.sku || `SKU-${Date.now().toString().slice(-4)}-${i + 1}`
        )
          .trim()
          .toUpperCase();
        const category = String(row.category || 'Provisions').trim();
        const unit = String(row.unit || 'Pack').trim();
        const costPrice = Math.max(0, Number(row.cost_price || 0));
        const sellingPrice = Math.max(0, Number(row.selling_price || 0));
        const stockQty = Math.max(0, Number(row.stock_quantity || 0));
        const reorderLevel = Math.max(0, Number(row.reorder_level ?? 5));
        const supplierName = row.supplier_name ? String(row.supplier_name).trim() : null;

        const existing =
          existingMapBySku.get(sku) ||
          existingMapByName.get(name.toLowerCase());

        if (existing) {
          if (!updateExisting) {
            skippedCount++;
            continue;
          }

          const prevStock = Number(existing.stock_quantity);
          const stockDiff = stockQty - prevStock;

          const updateRes = await client.query(
            `UPDATE products
             SET name = $1, category = $2, unit = $3, cost_price = $4,
                 selling_price = $5, stock_quantity = $6, reorder_level = $7,
                 supplier_name = $8, updated_at = CURRENT_TIMESTAMP
             WHERE id = $9 AND user_id = $10
             RETURNING *`,
            [
              name,
              category,
              unit,
              costPrice,
              sellingPrice,
              stockQty,
              reorderLevel,
              supplierName,
              existing.id,
              userId,
            ]
          );

          if (stockDiff !== 0) {
            const movementType = stockDiff > 0 ? 'RESTOCK' : 'ADJUSTMENT';
            await client.query(
              `INSERT INTO stock_movements (
                user_id, product_id, movement_type, quantity_change,
                previous_stock, new_stock, unit_price, total_value,
                counterparty_name, note
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                userId,
                existing.id,
                movementType,
                stockDiff,
                prevStock,
                stockQty,
                costPrice,
                multiplyCurrency(costPrice, Math.abs(stockDiff)),
                supplierName || 'Bulk Import Update',
                'Bulk CSV/Excel Inventory Adjustment',
              ]
            );
          }

          updatedCount++;
          processedProducts.push(updateRes.rows[0]);
        } else {
          const insertRes = await client.query(
            `INSERT INTO products (
              user_id, sku, name, category, unit, cost_price,
              selling_price, stock_quantity, reorder_level, supplier_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
              userId,
              sku,
              name,
              category,
              unit,
              costPrice,
              sellingPrice,
              stockQty,
              reorderLevel,
              supplierName,
            ]
          );

          const newProd = insertRes.rows[0];
          if (stockQty > 0) {
            await client.query(
              `INSERT INTO stock_movements (
                user_id, product_id, movement_type, quantity_change,
                previous_stock, new_stock, unit_price, total_value,
                counterparty_name, note
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                userId,
                newProd.id,
                'RESTOCK',
                stockQty,
                0,
                stockQty,
                costPrice,
                multiplyCurrency(costPrice, stockQty),
                supplierName || 'Initial Shelf Setup',
                'Initial Bulk Import',
              ]
            );
          }

          importedCount++;
          processedProducts.push(newProd);
        }
      }

      return {
        importedCount,
        updatedCount,
        skippedCount,
        totalCount: processedProducts.length,
        products: processedProducts,
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }

  /**
   * Fast Batch Stock Adjustment for multiple products at once
   */
  async batchStockAdjustment(userId, payload) {
    const { adjustments } = payload || {};
    if (!Array.isArray(adjustments) || adjustments.length === 0) {
      throw new AppError('No adjustments provided.', 400);
    }

    const result = await db.withTransaction(async (client) => {
      let updatedCount = 0;
      let totalValueChange = 0;
      const movements = [];

      for (const adj of adjustments) {
        const productId = Number(adj.product_id);
        const qtyInput = Number(adj.quantity);
        const mode = adj.mode === 'SET_COUNT' ? 'SET_COUNT' : 'DELTA';
        const movementType = String(adj.movement_type || 'ADJUSTMENT').toUpperCase();
        const note = String(adj.note || '').trim() || 'Batch Stock Adjustment';

        if (!productId || Number.isNaN(qtyInput)) continue;

        const prodRes = await client.query(
          'SELECT * FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [productId, userId]
        );
        if (prodRes.rows.length === 0) continue;

        const prod = prodRes.rows[0];
        const prevStock = Number(prod.stock_quantity);
        let newStock = prevStock;
        let qtyChange = 0;

        if (mode === 'SET_COUNT') {
          if (qtyInput < 0) throw new AppError(`Shelf count for "${prod.name}" cannot be negative.`);
          newStock = qtyInput;
          qtyChange = newStock - prevStock;
        } else {
          // DELTA mode
          if (['DAMAGED', 'DAMAGE', 'EXPIRED', 'MISSING'].includes(movementType)) {
            const deductQty = Math.abs(qtyInput);
            if (prevStock < deductQty) {
              throw new AppError(`Deduction for "${prod.name}" (${deductQty}) exceeds stock (${prevStock}).`);
            }
            newStock = prevStock - deductQty;
            qtyChange = -deductQty;
          } else if (movementType === 'RESTOCK' || movementType === 'SURPLUS') {
            const addQty = Math.abs(qtyInput);
            newStock = prevStock + addQty;
            qtyChange = addQty;
          } else {
            newStock = prevStock + qtyInput;
            qtyChange = qtyInput;
            if (newStock < 0) {
              throw new AppError(`Stock for "${prod.name}" cannot drop below 0.`);
            }
          }
        }

        if (qtyChange === 0) continue;

        const unitPrice = Number(prod.cost_price || 0);
        const lineTotal = multiplyCurrency(unitPrice, Math.abs(qtyChange));
        totalValueChange += lineTotal;

        await client.query(
          'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
          [newStock, productId, userId]
        );

        const movRes = await client.query(
          `INSERT INTO stock_movements (
            user_id, product_id, movement_type, quantity_change,
            previous_stock, new_stock, unit_price, total_value,
            counterparty_name, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            userId,
            productId,
            movementType === 'DAMAGE' ? 'DAMAGED' : movementType,
            qtyChange,
            prevStock,
            newStock,
            unitPrice,
            lineTotal,
            adj.counterparty_name || null,
            note,
          ]
        );

        movements.push(movRes.rows[0]);
        updatedCount++;
      }

      return {
        updatedCount,
        totalValueChange,
        movements,
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }

  /**
   * Physical Stock Count Reconciliation Workflow
   * Compares expected stock against actual shelf counts and tags discrepancy reasons
   */
  async batchPhysicalStockCount(userId, payload) {
    const { counts, auditNote = 'Physical Shelf Audit' } = payload || {};
    if (!Array.isArray(counts) || counts.length === 0) {
      throw new AppError('No stock counts provided.', 400);
    }

    const result = await db.withTransaction(async (client) => {
      let totalAudited = 0;
      let balancedCount = 0;
      let discrepancyCount = 0;
      let totalDiscrepancyValue = 0;
      const movements = [];

      for (const item of counts) {
        const productId = Number(item.product_id);
        const actualCount = Number(item.actual_count);
        const reason = String(item.reason || 'ADJUSTMENT').toUpperCase();
        const note = String(item.note || auditNote).trim();

        if (!productId || Number.isNaN(actualCount) || actualCount < 0) continue;

        const prodRes = await client.query(
          'SELECT * FROM products WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [productId, userId]
        );
        if (prodRes.rows.length === 0) continue;

        const prod = prodRes.rows[0];
        const prevStock = Number(prod.stock_quantity);
        const variance = actualCount - prevStock;
        totalAudited++;

        if (variance === 0) {
          balancedCount++;
          continue;
        }

        discrepancyCount++;
        const unitPrice = Number(prod.cost_price || 0);
        const lineTotal = multiplyCurrency(unitPrice, Math.abs(variance));
        totalDiscrepancyValue += lineTotal;

        // Auto-assign clean movement type if not provided
        let movementType = reason;
        if (!['DAMAGED', 'EXPIRED', 'MISSING', 'SURPLUS', 'ADJUSTMENT'].includes(movementType)) {
          movementType = variance > 0 ? 'SURPLUS' : 'MISSING';
        }

        await client.query(
          'UPDATE products SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
          [actualCount, productId, userId]
        );

        const movRes = await client.query(
          `INSERT INTO stock_movements (
            user_id, product_id, movement_type, quantity_change,
            previous_stock, new_stock, unit_price, total_value,
            counterparty_name, note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Shelf Audit', $9)
          RETURNING *`,
          [
            userId,
            productId,
            movementType,
            variance,
            prevStock,
            actualCount,
            unitPrice,
            lineTotal,
            note ? `${note} (Variance: ${variance > 0 ? `+${variance}` : variance})` : 'Physical Stock Audit',
          ]
        );

        movements.push(movRes.rows[0]);
      }

      return {
        totalAudited,
        balancedCount,
        discrepancyCount,
        totalDiscrepancyValue,
        movements,
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }
}

module.exports = new InventoryService();
