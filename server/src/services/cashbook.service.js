const db = require('../config/db');
const AppError = require('../utils/AppError');
const cacheService = require('./cache.service');
const cashbookRepo = require('../repositories/cashbook.repository');

class CashbookService {
  async getDashboardSummary(userId) {
    const cacheKey = `dashboard:${userId}:summary`;
    const cached = cacheService.get(cacheKey);
    if (cached) return { ...cached, cached: true };

    const metrics = await cashbookRepo.getDashboardMetrics(userId);
    cacheService.set(cacheKey, metrics, 20000);
    return { ...metrics, cached: false };
  }

  async getTransactions(userId, filters) {
    return cashbookRepo.findTransactions(userId, filters);
  }

  async recordTransaction(userId, payload) {
    if (!['INFLOW', 'OUTFLOW'].includes(payload.type)) {
      throw new AppError('Transaction type must be INFLOW or OUTFLOW.');
    }
    if (Number(payload.amount) <= 0 || Number.isNaN(Number(payload.amount))) {
      throw new AppError('Transaction amount must be greater than zero.');
    }
    const tx = await cashbookRepo.createTransaction(userId, payload);
    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return tx;
  }

  async deleteTransaction(userId, id) {
    const deleted = await cashbookRepo.deleteTransaction(userId, id);
    if (!deleted) throw new AppError('Transaction not found.', 404, 'TX_NOT_FOUND');
    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return { deleted: true };
  }

  async getCredits(userId, filters) {
    return cashbookRepo.findCredits(userId, filters);
  }

  async createCredit(userId, payload) {
    if (!payload.customer_name || !payload.total_amount) {
      throw new AppError('Customer name and total amount are required.');
    }
    const record = await cashbookRepo.createCreditRecord(userId, payload);
    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return record;
  }

  async repayCredit(userId, id, { amount, payment_method = 'CASH' }) {
    const payAmount = Number(amount);
    if (payAmount <= 0 || Number.isNaN(payAmount)) {
      throw new AppError('Repayment amount must be greater than zero.');
    }

    const result = await db.withTransaction(async (client) => {
      const credRes = await client.query(
        'SELECT * FROM credit_records WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, userId]
      );
      if (credRes.rows.length === 0) {
        throw new AppError('Credit record not found.', 404);
      }

      const credit = credRes.rows[0];
      const currentBalance = Number(credit.balance_due);
      if (currentBalance <= 0) {
        throw new AppError('This customer has already settled their debt.');
      }
      if (payAmount > currentBalance) {
        throw new AppError(`Amount exceeds balance owed (₦${currentBalance}).`);
      }

      const newPaid = Number(credit.amount_paid) + payAmount;
      const newBalance = Number((currentBalance - payAmount).toFixed(2));
      const newStatus = newBalance <= 0 ? 'PAID' : 'OWING';

      const updatedCred = await client.query(
        `UPDATE credit_records
         SET amount_paid = $1, balance_due = $2, status = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND user_id = $5
         RETURNING *`,
        [newPaid, newBalance, newStatus, id, userId]
      );

      const cashRes = await client.query(
        `INSERT INTO cash_transactions (
          user_id, type, category, amount, payment_method, counterparty_name, description
        ) VALUES ($1, 'INFLOW', 'Credit Repayment', $2, $3, $4, $5)
        RETURNING *`,
        [
          userId,
          payAmount,
          payment_method,
          credit.customer_name,
          `Debt payment from ${credit.customer_name} for (${credit.items_summary})${
            newBalance > 0 ? ` — Remaining balance: ₦${newBalance}` : ' — Fully Settled!'
          }`,
        ]
      );

      return {
        credit: updatedCred.rows[0],
        cashTransaction: cashRes.rows[0],
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }
}

module.exports = new CashbookService();
