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

  async repayCredit(userId, id, { amount, payment_method = 'CASH', note = '' }) {
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

      // Record in credit_repayments audit table
      const repRes = await client.query(
        `INSERT INTO credit_repayments (
          user_id, credit_record_id, customer_name, amount, payment_method, note
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          userId,
          id,
          credit.customer_name,
          payAmount,
          payment_method,
          note?.trim() || `Payment towards credit #${id} (${credit.items_summary})`,
        ]
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
        repayment: repRes.rows[0],
        cashTransaction: cashRes.rows[0],
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }

  /**
   * Aggregate Customer Ledgers: Group multiple credit purchases by customer,
   * showing aggregate balance, contact details, overdue status, and earliest due date.
   */
  async getCustomerLedgers(userId) {
    const credits = await cashbookRepo.findCredits(userId);
    const groups = new Map();

    for (const c of credits) {
      const key = String(c.customer_name || '').trim().toLowerCase();
      if (!key) continue;

      if (!groups.has(key)) {
        groups.set(key, {
          customer_name: c.customer_name.trim(),
          phone: c.phone?.trim() || null,
          customer_address: c.customer_address?.trim() || null,
          notes: c.notes?.trim() || null,
          total_credit_taken: 0,
          total_paid: 0,
          total_balance_due: 0,
          credit_count: 0,
          active_credits_count: 0,
          is_overdue: false,
          max_days_overdue: 0,
          earliest_due_date: null,
          latest_credit_date: c.created_at,
          invoices: [],
        });
      }

      const g = groups.get(key);
      if (c.phone && !g.phone) g.phone = c.phone.trim();
      if (c.customer_address && !g.customer_address) g.customer_address = c.customer_address.trim();
      if (c.notes && !g.notes) g.notes = c.notes.trim();

      const total = Number(c.total_amount || 0);
      const paid = Number(c.amount_paid || 0);
      const bal = Number(c.balance_due || 0);

      g.total_credit_taken = Number((g.total_credit_taken + total).toFixed(2));
      g.total_paid = Number((g.total_paid + paid).toFixed(2));
      g.total_balance_due = Number((g.total_balance_due + bal).toFixed(2));
      g.credit_count += 1;

      if (bal > 0) {
        g.active_credits_count += 1;
        if (c.is_overdue) {
          g.is_overdue = true;
          if (c.days_overdue > g.max_days_overdue) {
            g.max_days_overdue = c.days_overdue;
          }
        }
        if (c.due_date) {
          if (!g.earliest_due_date || new Date(c.due_date) < new Date(g.earliest_due_date)) {
            g.earliest_due_date = c.due_date;
          }
        }
      }

      if (new Date(c.created_at) > new Date(g.latest_credit_date)) {
        g.latest_credit_date = c.created_at;
      }

      g.invoices.push(c);
    }

    const result = Array.from(groups.values()).map((g) => ({
      ...g,
      status: g.total_balance_due <= 0 ? 'SETTLED' : g.is_overdue ? 'OVERDUE' : 'OWING',
    }));

    // Sort by largest balance owed first, then overdue status, then latest date
    result.sort((a, b) => {
      if (b.total_balance_due !== a.total_balance_due) {
        return b.total_balance_due - a.total_balance_due;
      }
      if (b.is_overdue !== a.is_overdue) {
        return b.is_overdue ? 1 : -1;
      }
      return new Date(b.latest_credit_date) - new Date(a.latest_credit_date);
    });

    return result;
  }

  /**
   * Settle customer debt across multiple credit invoices FIFO (First In First Out)
   */
  async repayCustomerDebt(userId, customerName, { amount, payment_method = 'CASH', note = '' }) {
    const payAmount = Number(amount);
    if (payAmount <= 0 || Number.isNaN(payAmount)) {
      throw new AppError('Repayment amount must be greater than zero.');
    }

    const normName = String(customerName || '').trim().toLowerCase();
    if (!normName) {
      throw new AppError('Customer name is required.');
    }

    const result = await db.withTransaction(async (client) => {
      // Find all owing credit records for this customer, sorted oldest first (FIFO)
      const credRes = await client.query(
        `SELECT * FROM credit_records
         WHERE user_id = $1 AND LOWER(TRIM(customer_name)) = $2 AND status = 'OWING' AND balance_due > 0
         ORDER BY created_at ASC, id ASC
         FOR UPDATE`,
        [userId, normName]
      );

      if (credRes.rows.length === 0) {
        throw new AppError('No outstanding credit balance found for this customer.', 404);
      }

      const totalOwing = credRes.rows.reduce((sum, r) => sum + Number(r.balance_due), 0);
      if (payAmount > Number(totalOwing.toFixed(2))) {
        throw new AppError(
          `Payment amount (₦${payAmount.toLocaleString()}) exceeds total outstanding balance (₦${totalOwing.toLocaleString()}).`
        );
      }

      let remainingToApply = payAmount;
      const updatedCredits = [];
      const createdRepayments = [];
      const displayCustomerName = credRes.rows[0].customer_name;

      for (const credit of credRes.rows) {
        if (remainingToApply <= 0) break;

        const creditBalance = Number(credit.balance_due);
        const applyAmt = Number(Math.min(remainingToApply, creditBalance).toFixed(2));
        const newPaid = Number((Number(credit.amount_paid) + applyAmt).toFixed(2));
        const newBalance = Number((creditBalance - applyAmt).toFixed(2));
        const newStatus = newBalance <= 0 ? 'PAID' : 'OWING';

        const updated = await client.query(
          `UPDATE credit_records
           SET amount_paid = $1, balance_due = $2, status = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4 AND user_id = $5
           RETURNING *`,
          [newPaid, newBalance, newStatus, credit.id, userId]
        );
        updatedCredits.push(updated.rows[0]);

        const rep = await client.query(
          `INSERT INTO credit_repayments (
            user_id, credit_record_id, customer_name, amount, payment_method, note
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [
            userId,
            credit.id,
            displayCustomerName,
            applyAmt,
            payment_method,
            note?.trim() || `Account payment applied to invoice #${credit.id} (${credit.items_summary})`,
          ]
        );
        createdRepayments.push(rep.rows[0]);

        remainingToApply = Number((remainingToApply - applyAmt).toFixed(2));
      }

      // Record single Inflow cash transaction
      const remainingTotalBalance = Number((totalOwing - payAmount).toFixed(2));
      const cashRes = await client.query(
        `INSERT INTO cash_transactions (
          user_id, type, category, amount, payment_method, counterparty_name, description
        ) VALUES ($1, 'INFLOW', 'Credit Repayment', $2, $3, $4, $5)
        RETURNING *`,
        [
          userId,
          payAmount,
          payment_method,
          displayCustomerName,
          `Debt payment from ${displayCustomerName}${
            note ? ` (${note})` : ''
          }${remainingTotalBalance > 0 ? ` — Remaining balance: ₦${remainingTotalBalance.toLocaleString()}` : ' — Fully Settled!'}`,
        ]
      );

      return {
        customer_name: displayCustomerName,
        total_paid: payAmount,
        remaining_balance: remainingTotalBalance,
        updatedCredits,
        createdRepayments,
        cashTransaction: cashRes.rows[0],
      };
    });

    cacheService.invalidatePrefix(`dashboard:${userId}`);
    return result;
  }

  /**
   * Generates a formal, printable Statement of Account for a customer
   * showing all purchases on credit, initial down-payments, subsequent repayments, and running balance.
   */
  async getCustomerStatement(userId, customerName) {
    const normName = String(customerName || '').trim().toLowerCase();
    if (!normName) {
      throw new AppError('Customer name is required.');
    }

    const allCredits = await cashbookRepo.findCredits(userId);
    const customerCredits = allCredits.filter(
      (c) => String(c.customer_name || '').trim().toLowerCase() === normName
    );

    if (customerCredits.length === 0) {
      throw new AppError(`No credit records found for customer "${customerName}".`, 404);
    }

    const repayments = await cashbookRepo.findCreditRepayments(userId, { customer_name: normName });

    // Build timeline events
    const rawEvents = [];

    // Credit Purchases and Initial Down-payments
    for (const c of customerCredits) {
      // The credit invoice purchase (Debit to customer account)
      rawEvents.push({
        id: `inv-${c.id}`,
        credit_record_id: c.id,
        timestamp: new Date(c.created_at).getTime(),
        date: c.created_at,
        type: 'INVOICE',
        title: `Credit Purchase #${c.id}`,
        description: c.items_summary,
        debit: Number(c.total_amount),
        credit: 0,
        due_date: c.due_date,
        is_overdue: c.is_overdue,
        status: c.status,
      });

      // If initial deposit/down-payment was made at checkout but not logged in credit_repayments (historical data):
      const totalRecordedRepayments = repayments
        .filter((r) => Number(r.credit_record_id) === Number(c.id))
        .reduce((sum, r) => sum + Number(r.amount), 0);
      const unloggedDownpayment = Number((Number(c.amount_paid) - totalRecordedRepayments).toFixed(2));

      if (unloggedDownpayment > 0.009) {
        rawEvents.push({
          id: `down-${c.id}`,
          credit_record_id: c.id,
          timestamp: new Date(c.created_at).getTime() + 1,
          date: c.created_at,
          type: 'DOWN_PAYMENT',
          title: 'Initial Deposit / Down-Payment',
          description: 'Paid at time of purchase',
          debit: 0,
          credit: unloggedDownpayment,
          payment_method: 'CASH',
        });
      }
    }

    // Subsequent Repayments (Credit to customer account)
    for (const r of repayments) {
      rawEvents.push({
        id: `rep-${r.id}`,
        credit_record_id: r.credit_record_id,
        timestamp: new Date(r.created_at).getTime(),
        date: r.created_at,
        type: 'REPAYMENT',
        title: `Repayment (${r.payment_method || 'CASH'})`,
        description: r.note || 'Payment towards outstanding balance',
        debit: 0,
        credit: Number(r.amount),
        payment_method: r.payment_method,
      });
    }

    // Sort chronologically ascending
    rawEvents.sort((a, b) => a.timestamp - b.timestamp);

    // Compute running balance
    let runningBalance = 0;
    const ledger = rawEvents.map((evt) => {
      runningBalance = Number((runningBalance + evt.debit - evt.credit).toFixed(2));
      return {
        ...evt,
        running_balance: runningBalance,
      };
    });

    const displayCustomerName =
      customerCredits.find((c) => /[A-Z]/.test(c.customer_name))?.customer_name ||
      customerCredits[0]?.customer_name ||
      customerName;
    const phone = customerCredits.find((c) => c.phone)?.phone || null;
    const address = customerCredits.find((c) => c.customer_address)?.customer_address || null;
    const notes = customerCredits.find((c) => c.notes)?.notes || null;

    const totalCreditTaken = customerCredits.reduce((s, c) => s + Number(c.total_amount), 0);
    const totalPaid = customerCredits.reduce((s, c) => s + Number(c.amount_paid), 0);
    const currentBalanceDue = customerCredits.reduce((s, c) => s + Number(c.balance_due), 0);
    const hasOverdue = customerCredits.some((c) => c.is_overdue);

    return {
      customer: {
        name: displayCustomerName,
        phone,
        address,
        notes,
      },
      summary: {
        total_credit_taken: Number(totalCreditTaken.toFixed(2)),
        total_paid: Number(totalPaid.toFixed(2)),
        current_balance_due: Number(currentBalanceDue.toFixed(2)),
        invoice_count: customerCredits.length,
        active_invoices: customerCredits.filter((c) => c.status === 'OWING' && Number(c.balance_due) > 0).length,
        is_overdue: hasOverdue,
        statement_date: new Date().toISOString(),
      },
      ledger,
    };
  }
}

module.exports = new CashbookService();
