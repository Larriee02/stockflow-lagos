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
    const category = String(payload.category || '').trim();
    if (!category) {
      throw new AppError('Please select or enter a clear category for this transaction.');
    }
    const expenseReason = String(payload.expense_reason || payload.description || '').trim();
    if (payload.type === 'OUTFLOW' && !expenseReason) {
      throw new AppError('Please provide a clear reason or description for this expense.');
    }

    const tx = await cashbookRepo.createTransaction(userId, {
      ...payload,
      category,
      description: expenseReason || category,
      expense_reason: payload.type === 'OUTFLOW' ? expenseReason : payload.expense_reason || null,
    });
    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return tx;
  }

  /**
   * Transaction Correction Workflow (Preserves Audit Trail - Never Permanently Deletes)
   * Supports:
   *  - mode: 'AMEND' -> Marks original as CORRECTED, creates a linked replacement transaction
   *  - mode: 'VOID'  -> Marks original as VOIDED, excluding it from active totals while keeping audit history
   */
  async correctTransaction(userId, id, payload = {}) {
    const mode = String(payload.mode || 'AMEND').toUpperCase();
    if (!['AMEND', 'VOID'].includes(mode)) {
      throw new AppError('Correction mode must be AMEND or VOID.');
    }

    const correctionReason = String(payload.correction_reason || '').trim();
    if (!correctionReason) {
      throw new AppError(
        'Please provide a reason for correcting or voiding this transaction to preserve the audit trail.'
      );
    }

    const result = await db.withTransaction(async (client) => {
      const existingRes = await client.query(
        'SELECT * FROM cash_transactions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [Number(id), userId]
      );
      if (existingRes.rows.length === 0) {
        throw new AppError('Original transaction not found.', 404, 'TX_NOT_FOUND');
      }

      const original = existingRes.rows[0];
      const currentStatus = original.status || 'ACTIVE';
      if (currentStatus !== 'ACTIVE') {
        throw new AppError(
          `This transaction has already been ${currentStatus.toLowerCase()} and cannot be modified again.`,
          400,
          'TX_ALREADY_MODIFIED'
        );
      }

      if (mode === 'VOID') {
        const voidRes = await client.query(
          `UPDATE cash_transactions
           SET status = 'VOIDED',
               correction_reason = $1,
               corrected_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND user_id = $3
           RETURNING *`,
          [correctionReason, original.id, userId]
        );
        return {
          mode: 'VOID',
          originalTransaction: voidRes.rows[0],
          replacementTransaction: null,
        };
      }

      // mode === 'AMEND'
      const newType = payload.type || original.type;
      if (!['INFLOW', 'OUTFLOW'].includes(newType)) {
        throw new AppError('Corrected transaction type must be INFLOW or OUTFLOW.');
      }
      const newAmount = Number(payload.amount !== undefined ? payload.amount : original.amount);
      if (newAmount <= 0 || Number.isNaN(newAmount)) {
        throw new AppError('Corrected amount must be greater than zero.');
      }
      const newCategory = String(payload.category || original.category || '').trim();
      if (!newCategory) {
        throw new AppError('Category is required for the corrected transaction.');
      }
      const newPaymentMethod = payload.payment_method || original.payment_method || 'CASH';
      const newCounterparty =
        payload.counterparty_name !== undefined
          ? String(payload.counterparty_name || '').trim() || null
          : original.counterparty_name;
      const newExpenseReason =
        payload.expense_reason !== undefined
          ? String(payload.expense_reason || '').trim()
          : original.expense_reason || original.description;
      const newDescription =
        payload.description !== undefined && String(payload.description).trim()
          ? String(payload.description).trim()
          : newExpenseReason || original.description;

      const replacement = await cashbookRepo.createTransaction(
        userId,
        {
          type: newType,
          category: newCategory,
          amount: newAmount,
          payment_method: newPaymentMethod,
          counterparty_name: newCounterparty,
          description: newDescription,
          expense_reason: newType === 'OUTFLOW' ? newExpenseReason || newDescription : null,
          parent_transaction_id: original.id,
        },
        client
      );

      const updatedOrigRes = await client.query(
        `UPDATE cash_transactions
         SET status = 'CORRECTED',
             correction_reason = $1,
             replaced_by_id = $2,
             corrected_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND user_id = $4
         RETURNING *`,
        [correctionReason, replacement.id, original.id, userId]
      );

      return {
        mode: 'AMEND',
        originalTransaction: updatedOrigRes.rows[0],
        replacementTransaction: replacement,
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }

  /**
   * Preserves audit trail: Instead of permanently deleting financial records,
   * marks the transaction as VOIDED with an audit reason.
   */
  async deleteTransaction(userId, id, reason = 'Voided by retailer') {
    const result = await this.correctTransaction(userId, id, {
      mode: 'VOID',
      correction_reason: reason || 'Voided by retailer',
    });
    return {
      deleted: false,
      voided: true,
      transaction: result.originalTransaction,
    };
  }

  /**
   * Opening & Closing Balance Session Management
   */
  async getCashbookSessions(userId, { date } = {}) {
    const toDateKey = (val) => {
      if (!val) return '';
      if (val instanceof Date) return val.toISOString().slice(0, 10);
      const str = String(val);
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
      return new Date(val).toISOString().slice(0, 10);
    };

    const targetDate = date ? toDateKey(date) : new Date().toISOString().slice(0, 10);
    const rawSessions = await cashbookRepo.findSessions(userId, 30);
    const sessions = rawSessions.map((s) => ({
      ...s,
      session_date: toDateKey(s.session_date),
    }));
    const todaySession =
      sessions.find((s) => s.session_date === targetDate) || null;

    // Calculate active transactions for targetDate and prior to targetDate
    const allTx = await cashbookRepo.findTransactions(userId, { limit: 2000 });
    const activeTx = allTx.filter((t) => (t.status || 'ACTIVE') === 'ACTIVE');

    let priorCashNet = 0;
    let priorBankPosNet = 0;
    let dayInflow = 0;
    let dayOutflow = 0;
    let dayCashInflow = 0;
    let dayCashOutflow = 0;
    let dayBankPosInflow = 0;
    let dayBankPosOutflow = 0;

    for (const t of activeTx) {
      const txDateStr = toDateKey(t.transaction_date);
      const amt = Number(t.amount || 0);
      const isCash = (t.payment_method || 'CASH') === 'CASH';

      if (txDateStr < targetDate) {
        if (t.type === 'INFLOW') {
          if (isCash) priorCashNet += amt;
          else priorBankPosNet += amt;
        } else {
          if (isCash) priorCashNet -= amt;
          else priorBankPosNet -= amt;
        }
      } else if (txDateStr === targetDate) {
        if (t.type === 'INFLOW') {
          dayInflow += amt;
          if (isCash) dayCashInflow += amt;
          else dayBankPosInflow += amt;
        } else {
          dayOutflow += amt;
          if (isCash) dayCashOutflow += amt;
          else dayBankPosOutflow += amt;
        }
      }
    }

    // Check if there is a previous closed session before targetDate to carry forward
    const previousClosed = sessions.find(
      (s) => s.session_date < targetDate && s.status === 'CLOSED'
    );

    const suggestedOpeningCash = previousClosed
      ? Number(previousClosed.actual_closing_cash ?? previousClosed.actual_closing_balance ?? 0)
      : Number(priorCashNet.toFixed(2));
    const suggestedOpeningBankPos = previousClosed
      ? Number(previousClosed.actual_closing_bank_pos ?? 0)
      : Number(priorBankPosNet.toFixed(2));
    const suggestedOpeningBalance = previousClosed
      ? Number(previousClosed.actual_closing_balance ?? suggestedOpeningCash + suggestedOpeningBankPos)
      : Number((priorCashNet + priorBankPosNet).toFixed(2));

    const effectiveOpeningBalance = todaySession
      ? Number(todaySession.opening_balance)
      : suggestedOpeningBalance;
    const effectiveOpeningCash = todaySession
      ? Number(todaySession.opening_cash || 0)
      : suggestedOpeningCash;
    const effectiveOpeningBankPos = todaySession
      ? Number(todaySession.opening_bank_pos || 0)
      : suggestedOpeningBankPos;

    const expectedClosingBalance = Number(
      (effectiveOpeningBalance + dayInflow - dayOutflow).toFixed(2)
    );
    const expectedClosingCash = Number(
      (effectiveOpeningCash + dayCashInflow - dayCashOutflow).toFixed(2)
    );
    const expectedClosingBankPos = Number(
      (effectiveOpeningBankPos + dayBankPosInflow - dayBankPosOutflow).toFixed(2)
    );

    return {
      targetDate,
      todaySession,
      suggestedOpeningBalance,
      suggestedOpeningCash,
      suggestedOpeningBankPos,
      effectiveOpeningBalance,
      effectiveOpeningCash,
      effectiveOpeningBankPos,
      dayInflow: Number(dayInflow.toFixed(2)),
      dayOutflow: Number(dayOutflow.toFixed(2)),
      dayCashInflow: Number(dayCashInflow.toFixed(2)),
      dayCashOutflow: Number(dayCashOutflow.toFixed(2)),
      dayBankPosInflow: Number(dayBankPosInflow.toFixed(2)),
      dayBankPosOutflow: Number(dayBankPosOutflow.toFixed(2)),
      expectedClosingBalance,
      expectedClosingCash,
      expectedClosingBankPos,
      sessions,
    };
  }

  async openCashbookSession(userId, payload = {}) {
    const sessionDate = payload.session_date || new Date().toISOString().slice(0, 10);
    const openingCash = Number(payload.opening_cash || 0);
    const openingBankPos = Number(payload.opening_bank_pos || 0);
    const openingBalance =
      payload.opening_balance !== undefined && payload.opening_balance !== ''
        ? Number(payload.opening_balance)
        : Number((openingCash + openingBankPos).toFixed(2));

    if (Number.isNaN(openingBalance)) {
      throw new AppError('Opening balance must be a valid number.');
    }

    const session = await cashbookRepo.upsertOpeningSession(userId, {
      session_date: sessionDate,
      opening_balance: openingBalance,
      opening_cash: openingCash,
      opening_bank_pos: openingBankPos,
      opening_note: payload.opening_note ? String(payload.opening_note).trim() : null,
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return session;
  }

  async closeCashbookSession(userId, payload = {}) {
    const sessionDate = payload.session_date || new Date().toISOString().slice(0, 10);
    const stateInfo = await this.getCashbookSessions(userId, { date: sessionDate });

    const openingBalance =
      payload.opening_balance !== undefined && payload.opening_balance !== ''
        ? Number(payload.opening_balance)
        : stateInfo.effectiveOpeningBalance;
    const openingCash =
      payload.opening_cash !== undefined && payload.opening_cash !== ''
        ? Number(payload.opening_cash)
        : stateInfo.effectiveOpeningCash;
    const openingBankPos =
      payload.opening_bank_pos !== undefined && payload.opening_bank_pos !== ''
        ? Number(payload.opening_bank_pos)
        : stateInfo.effectiveOpeningBankPos;

    const expectedClosingBalance = Number(
      (openingBalance + stateInfo.dayInflow - stateInfo.dayOutflow).toFixed(2)
    );

    const actualClosingCash =
      payload.actual_closing_cash !== undefined && payload.actual_closing_cash !== ''
        ? Number(payload.actual_closing_cash)
        : stateInfo.expectedClosingCash;
    const actualClosingBankPos =
      payload.actual_closing_bank_pos !== undefined && payload.actual_closing_bank_pos !== ''
        ? Number(payload.actual_closing_bank_pos)
        : stateInfo.expectedClosingBankPos;

    const actualClosingBalance =
      payload.actual_closing_balance !== undefined && payload.actual_closing_balance !== ''
        ? Number(payload.actual_closing_balance)
        : Number((actualClosingCash + actualClosingBankPos).toFixed(2));

    if (Number.isNaN(actualClosingBalance)) {
      throw new AppError('Actual closing balance must be a valid amount.');
    }

    const variance = Number((actualClosingBalance - expectedClosingBalance).toFixed(2));

    const closedSession = await cashbookRepo.closeSession(userId, {
      session_date: sessionDate,
      opening_balance: openingBalance,
      opening_cash: openingCash,
      opening_bank_pos: openingBankPos,
      expected_closing_balance: expectedClosingBalance,
      actual_closing_balance: actualClosingBalance,
      actual_closing_cash: actualClosingCash,
      actual_closing_bank_pos: actualClosingBankPos,
      variance,
      closing_note: payload.closing_note ? String(payload.closing_note).trim() : null,
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return closedSession;
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
