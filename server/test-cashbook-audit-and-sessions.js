const assert = require('assert');
const db = require('./src/config/db');
const authService = require('./src/services/auth.service');
const cashbookService = require('./src/services/cashbook.service');

async function runTests() {
  console.log('--- Testing Cashbook Reports, Opening/Closing Balances & Audit Trail Corrections ---');
  await db.ready();

  const testEmail = `cashbook-audit-${Date.now()}@lagos.ng`;
  const { user } = await authService.register({
    email: testEmail,
    password: 'Password123#',
    full_name: 'Cashbook Auditor',
    business_name: 'Lagos Audit Provisions',
    seed_catalog: false,
  });
  const testUserId = user.id;
  const todayStr = new Date().toISOString().slice(0, 10);

  console.log('\n[1/5] Testing Opening Balance Workflow...');
  const opened = await cashbookService.openCashbookSession(testUserId, {
    session_date: todayStr,
    opening_cash: 25000,
    opening_bank_pos: 50000,
    opening_note: 'Morning counter float & POS balance',
  });
  assert.strictEqual(Number(opened.opening_balance), 75000, 'Opening balance should be 75,000');
  assert.strictEqual(opened.status, 'OPEN');
  console.log('Opening Balance Saved:', opened.opening_balance, '(Cash: 25,000, POS/Bank: 50,000)');

  console.log('\n[2/5] Recording Cash, POS & Bank Transfer Inflows & Categorized Expenses...');
  const saleCash = await cashbookService.recordTransaction(testUserId, {
    type: 'INFLOW',
    category: 'Counter Sales',
    amount: 18000,
    payment_method: 'CASH',
    counterparty_name: 'Mama Chinedu',
    description: 'Sold 2 cartons of Indomie',
  });

  const salePos = await cashbookService.recordTransaction(testUserId, {
    type: 'INFLOW',
    category: 'Counter Sales',
    amount: 32000,
    payment_method: 'POS',
    counterparty_name: 'Walk-in Buyer',
    description: 'Peak Milk & Sugar via POS',
  });

  // Intentional mistake: Retailer enters 40,000 instead of 4,000 for Generator Fuel on CASH
  const mistakenExpense = await cashbookService.recordTransaction(testUserId, {
    type: 'OUTFLOW',
    category: 'Generator & Power',
    amount: 40000,
    payment_method: 'CASH',
    counterparty_name: 'Total Filling Station',
    expense_reason: 'Bought 5 litres of petrol for evening generator',
  });

  // Accidental duplicate entry to test VOID
  const duplicateTransfer = await cashbookService.recordTransaction(testUserId, {
    type: 'OUTFLOW',
    category: 'Logistics & Transport',
    amount: 6000,
    payment_method: 'BANK_TRANSFER',
    counterparty_name: 'Keke Rider',
    expense_reason: 'Market delivery fare from Mushin',
  });

  console.log('Recorded 4 initial transactions:', [
    saleCash.id,
    salePos.id,
    mistakenExpense.id,
    duplicateTransfer.id,
  ]);

  console.log('\n[3/5] Testing Audit-Safe Transaction Amendment (AMEND)...');
  const amendRes = await cashbookService.correctTransaction(testUserId, mistakenExpense.id, {
    mode: 'AMEND',
    correction_reason: 'Typo in amount: entered 40,000 instead of 4,000',
    type: 'OUTFLOW',
    category: 'Generator & Power',
    amount: 4000,
    payment_method: 'CASH',
    counterparty_name: 'Total Filling Station',
    expense_reason: 'Bought 5 litres of petrol for evening generator (Corrected)',
  });

  assert.strictEqual(amendRes.originalTransaction.status, 'CORRECTED');
  assert.strictEqual(
    amendRes.originalTransaction.replaced_by_id,
    amendRes.replacementTransaction.id
  );
  assert.strictEqual(
    amendRes.replacementTransaction.parent_transaction_id,
    mistakenExpense.id
  );
  assert.strictEqual(Number(amendRes.replacementTransaction.amount), 4000);
  console.log(
    `Original Tx #${mistakenExpense.id} marked CORRECTED -> Replaced by Tx #${amendRes.replacementTransaction.id} (₦4,000)`
  );

  console.log('\n[4/5] Testing Audit-Safe Transaction Voiding (VOID)...');
  const voidRes = await cashbookService.correctTransaction(testUserId, duplicateTransfer.id, {
    mode: 'VOID',
    correction_reason: 'Duplicate entry recorded by mistake',
  });
  assert.strictEqual(voidRes.originalTransaction.status, 'VOIDED');
  console.log(
    `Duplicate Tx #${duplicateTransfer.id} marked VOIDED with reason: "${voidRes.originalTransaction.correction_reason}"`
  );

  // Verify full audit trail is still stored in database (5 total rows: 3 ACTIVE, 1 CORRECTED, 1 VOIDED)
  const allRows = await cashbookService.getTransactions(testUserId, {
    startDate: todayStr,
    endDate: todayStr,
  });
  assert.strictEqual(allRows.length, 5, 'All 5 records must be preserved in the audit trail');
  const activeRows = allRows.filter((r) => (r.status || 'ACTIVE') === 'ACTIVE');
  assert.strictEqual(activeRows.length, 3, 'Only 3 records should be ACTIVE');

  // Verify Dashboard Metrics only count ACTIVE transactions
  // Active Inflows: 18,000 + 32,000 = 50,000
  // Active Outflows: 4,000 (amended generator fuel)
  const dash = await cashbookService.getDashboardSummary(testUserId);
  assert.strictEqual(Number(dash.total_inflow), 50000, 'Active inflow should be 50,000');
  assert.strictEqual(Number(dash.total_outflow), 4000, 'Active outflow should be 4,000');
  console.log(
    `Verified Active Totals -> Inflow: ₦${dash.total_inflow}, Outflow: ₦${dash.total_outflow}, Net: ₦${dash.net_cash_balance}`
  );

  console.log('\n[5/5] Testing Closing Balance Reconciliation Workflow...');
  // Expected Closing = Opening (75,000) + Inflow (50,000) - Outflow (4,000) = 121,000
  // Expected Cash = Opening Cash (25,000) + Cash In (18,000) - Cash Out (4,000) = 39,000
  // Expected POS/Bank = Opening POS/Bank (50,000) + POS In (32,000) = 82,000
  const sessState = await cashbookService.getCashbookSessions(testUserId, { date: todayStr });
  assert.strictEqual(sessState.expectedClosingBalance, 121000);
  assert.strictEqual(sessState.expectedClosingCash, 39000);
  assert.strictEqual(sessState.expectedClosingBankPos, 82000);

  const closed = await cashbookService.closeCashbookSession(testUserId, {
    session_date: todayStr,
    actual_closing_cash: 39000,
    actual_closing_bank_pos: 82000,
    closing_note: 'All cash and POS slips balanced at closing',
  });
  assert.strictEqual(closed.status, 'CLOSED');
  assert.strictEqual(Number(closed.expected_closing_balance), 121000);
  assert.strictEqual(Number(closed.actual_closing_balance), 121000);
  assert.strictEqual(Number(closed.variance), 0);
  console.log(
    `Closed Register -> Expected: ₦${closed.expected_closing_balance}, Actual: ₦${closed.actual_closing_balance}, Variance: ₦${closed.variance}`
  );

  // Clean up test user and its cascaded records
  await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  console.log('\n>>> ALL CASHBOOK REPORTS, SESSIONS & AUDIT TRAIL TESTS PASSED! <<<');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
