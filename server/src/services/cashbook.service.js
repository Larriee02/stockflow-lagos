const pool = require('../config/db');
const AppError = require('../utils/AppError');
const cacheService = require('./cache.service');
const cashbookRepo = require('../repositories/cashbook.repository');

class CashbookService {
  async getDashboardSummary() {
    const cacheKey = 'dashboard:summary';
    const cached = cacheService.get(cacheKey);
    if (cached) return { ...cached, cached: true };

    const metrics = await cashbookRepo.getDashboardMetrics();
    cacheService.set(cacheKey, metrics, 30000);
    return { ...metrics, cached: false };
  }

  async getTransactions(filters) {
    return cashbookRepo.findTransactions(filters);
  }

  async recordTransaction(payload) {
    if (!['INFLOW', 'OUTFLOW'].includes(payload.type)) {
      throw new AppError('Transaction type must be INFLOW or OUTFLOW.');
    }
    if (Number(payload.amount) <= 0 || Number.isNaN(Number(payload.amount))) {
      throw new AppError('Transaction amount must be greater than zero.');
    }
    const tx = await cashbookRepo.createTransaction(payload);
    cacheService.invalidatePrefix('dashboard:');
    return tx;
  }

  async deleteTransaction(id) {
    const deleted = await cashbookRepo.deleteTransaction(id);
    if (!deleted) throw new AppError('Transaction not found.', 404, 'TX_NOT_FOUND');
    cacheService.invalidatePrefix('dashboard:');
    return { deleted: true };
  }

  // Credit / Debtors Book Methods
  async getCredits(filters) {
    return cashbookRepo.findCredits(filters);
  }

  async createCredit(payload) {
    if (!payload.customer_name || !payload.total_amount) {
      throw new AppError('Customer name and total amount are required.');
    }
    const record = await cashbookRepo.createCreditRecord(payload);
    cacheService.invalidatePrefix('dashboard:');
    return record;
  }

  async repayCredit(id, { amount, payment_method = 'CASH' }) {
    const payAmount = Number(amount);
    if (payAmount <= 0 || Number.isNaN(payAmount)) {
      throw new AppError('Repayment amount must be greater than zero.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const credRes = await client.query(
        'SELECT * FROM credit_records WHERE id = $1 FOR UPDATE',
        [id]
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
         WHERE id = $4
         RETURNING *`,
        [newPaid, newBalance, newStatus, id]
      );

      // Automatically record the debt collection in the Cashbook!
      const cashRes = await client.query(
        `INSERT INTO cash_transactions (
          type, category, amount, payment_method, counterparty_name, description
        ) VALUES ('INFLOW', 'Credit Repayment', $1, $2, $3, $4)
        RETURNING *`,
        [
          payAmount,
          payment_method,
          credit.customer_name,
          `Debt payment from ${credit.customer_name} for (${credit.items_summary})${
            newBalance > 0 ? ` — Remaining balance: ₦${newBalance}` : ' — Fully Settled!'
          }`,
        ]
      );

      await client.query('COMMIT');
      cacheService.invalidatePrefix('dashboard:');

      return {
        credit: updatedCred.rows[0],
        cashTransaction: cashRes.rows[0],
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new CashbookService();
