/**
 * Automated Verification: Multi-Tenant Business Data Isolation Test Suite
 *
 * Verifies strict data isolation between different retail accounts:
 * 1. Product Isolation: Merchant B cannot view, edit, stock-adjust, or delete Merchant A's products.
 * 2. Cashbook Transaction Isolation: Merchant B cannot view, void, or amend Merchant A's transactions.
 * 3. Daily Session Isolation: Opening floats, closing balances, and daily reconciliations are strictly isolated.
 * 4. Credit & Debtor Isolation: Customer ledgers, debts, statements, and repayments cannot leak or cross-settle.
 * 5. Stock Movement Audit Isolation: Movement logs and audit trails are scoped exclusively to the owning user.
 */

const assert = require('assert');
const path = require('path');

process.env.NODE_ENV = 'test';

async function runTests() {
  console.log('🧪 Starting Business Data Isolation & Multi-Tenancy Test Suite...\n');

  const db = require('./src/config/db');
  await db.ready();

  const authService = require('./src/services/auth.service');
  const inventoryService = require('./src/services/inventory.service');
  const cashbookService = require('./src/services/cashbook.service');

  // ==========================================
  // SETUP: Create Two Independent Merchants
  // ==========================================
  const timestamp = Date.now();
  const merchantARes = await authService.register({
    email: `merchant_alpha_${timestamp}@stockflow.test`,
    password: 'AlphaPassword123#',
    full_name: 'Merchant Alpha',
    business_name: 'Alpha Supermarket Ltd',
    currency: 'NGN',
    seed_catalog: false,
  });
  const userA = merchantARes.user.id;

  const merchantBRes = await authService.register({
    email: `merchant_beta_${timestamp}@stockflow.test`,
    password: 'BetaPassword123#',
    full_name: 'Merchant Beta',
    business_name: 'Beta Provisions Stall',
    currency: 'NGN',
    seed_catalog: false,
  });
  const userB = merchantBRes.user.id;

  console.log(`✅ Registered two distinct merchants: User A (${userA}) & User B (${userB})`);

  // ==========================================
  // 1. PRODUCT & INVENTORY ISOLATION
  // ==========================================
  console.log('\n🔒 [1/5] Testing Product & Inventory Isolation...');

  const prodA = await inventoryService.createProduct(userA, {
    name: 'Alpha Peak Milk Tin',
    sku: `SKU-A-${timestamp}`,
    category: 'Dairy',
    cost_price: 1000,
    selling_price: 1500,
    stock_quantity: 50,
  });

  const prodB = await inventoryService.createProduct(userB, {
    name: 'Beta Titus Sardine',
    sku: `SKU-B-${timestamp}`,
    category: 'Canned Food',
    cost_price: 1200,
    selling_price: 1600,
    stock_quantity: 20,
  });

  // Verify list isolation
  const productsA = await inventoryService.getProducts(userA);
  const productsB = await inventoryService.getProducts(userB);

  assert.strictEqual(productsA.length, 1);
  assert.strictEqual(productsA[0].id, prodA.id);
  assert.ok(!productsA.some((p) => p.id === prodB.id), 'Merchant A must not see Merchant B products');

  assert.strictEqual(productsB.length, 1);
  assert.strictEqual(productsB[0].id, prodB.id);
  assert.ok(!productsB.some((p) => p.id === prodA.id), 'Merchant B must not see Merchant A products');

  // Verify cross-user modification rejection
  let updateBlocked = false;
  try {
    await inventoryService.updateProduct(userB, prodA.id, {
      name: 'Hacked Product Name',
      selling_price: 10,
    });
  } catch (err) {
    updateBlocked = true;
  }
  assert.ok(updateBlocked, 'Merchant B updating Merchant A product must be rejected');

  // Verify cross-user deletion rejection
  let deleteBlocked = false;
  try {
    await inventoryService.deleteProduct(userB, prodA.id);
  } catch (err) {
    deleteBlocked = true;
  }
  assert.ok(deleteBlocked, 'Merchant B deleting Merchant A product must be rejected');

  // Verify cross-user batch stock adjustment is ignored / rejected
  await inventoryService.batchStockAdjustment(userB, {
    adjustments: [
      { product_id: prodA.id, quantity: 0, mode: 'SET_COUNT', movement_type: 'SURPLUS' },
    ],
  });

  const prodsAAfter = await inventoryService.getProducts(userA);
  const recheckProdA = prodsAAfter.find((p) => p.id === prodA.id);
  assert.strictEqual(
    Number(recheckProdA.stock_quantity),
    50,
    'Merchant A stock quantity must remain unchanged after malicious adjustment attempt by B'
  );

  console.log('✅ Product isolation verified: zero leakage, cross-updates and cross-deletions blocked');

  // ==========================================
  // 2. CASHBOOK TRANSACTION & AUDIT ISOLATION
  // ==========================================
  console.log('\n🔒 [2/5] Testing Cashbook Transactions & Audit-Trail Isolation...');

  const txA = await cashbookService.recordTransaction(userA, {
    type: 'INFLOW',
    category: 'SALES',
    amount: 75000,
    payment_method: 'CASH',
    counterparty_name: 'Alpha Customer',
    description: 'Alpha high value retail sale',
  });

  const txB = await cashbookService.recordTransaction(userB, {
    type: 'OUTFLOW',
    category: 'Inventory Restock',
    amount: 15000,
    payment_method: 'BANK_TRANSFER',
    counterparty_name: 'Beta Supplier',
    description: 'Beta market restock',
  });

  // Verify list isolation
  const txListA = await cashbookService.getTransactions(userA);
  const txListB = await cashbookService.getTransactions(userB);

  assert.ok(txListA.some((t) => t.id === txA.id));
  assert.ok(!txListA.some((t) => t.id === txB.id), 'Merchant A must not see Merchant B transactions');

  assert.ok(txListB.some((t) => t.id === txB.id));
  assert.ok(!txListB.some((t) => t.id === txA.id), 'Merchant B must not see Merchant A transactions');

  // Verify cross-user void rejection
  let voidBlocked = false;
  try {
    await cashbookService.deleteTransaction(userB, txA.id, 'Malicious void attempt');
  } catch (err) {
    voidBlocked = true;
  }
  assert.ok(voidBlocked, 'Merchant B voiding Merchant A transaction must be rejected');

  // Verify cross-user amend/correct rejection
  let amendBlocked = false;
  try {
    await cashbookService.correctTransaction(userB, txA.id, {
      amount: 10,
      correction_reason: 'Malicious amend attempt',
    });
  } catch (err) {
    amendBlocked = true;
  }
  assert.ok(amendBlocked, 'Merchant B correcting Merchant A transaction must be rejected');

  console.log('✅ Cashbook transactions & audit-safe modifications strictly isolated');

  // ==========================================
  // 3. CASHBOOK REGISTER SESSION ISOLATION
  // ==========================================
  console.log('\n🔒 [3/5] Testing Cash Register Sessions & Float Isolation...');

  const todayKey = new Date().toISOString().slice(0, 10);

  // Merchant A opens register with ₦50,000 float
  await cashbookService.openCashbookSession(userA, {
    session_date: todayKey,
    opening_cash: 50000,
    opening_bank_pos: 0,
    opening_balance: 50000,
    opening_note: 'Alpha morning float',
  });

  // Merchant B opens register with ₦10,000 float
  await cashbookService.openCashbookSession(userB, {
    session_date: todayKey,
    opening_cash: 10000,
    opening_bank_pos: 0,
    opening_balance: 10000,
    opening_note: 'Beta morning float',
  });

  const sessionStateA = await cashbookService.getCashbookSessions(userA, { date: todayKey });
  const sessionStateB = await cashbookService.getCashbookSessions(userB, { date: todayKey });

  assert.strictEqual(
    Number(sessionStateA.effectiveOpeningBalance),
    50000,
    'Merchant A opening balance must be ₦50,000'
  );
  assert.strictEqual(
    Number(sessionStateB.effectiveOpeningBalance),
    10000,
    'Merchant B opening balance must be ₦10,000'
  );

  // Merchant B closes their register session
  await cashbookService.closeCashbookSession(userB, {
    session_date: todayKey,
    closing_cash: 10000,
    closing_bank_pos: 0,
    closing_note: 'Beta closed evening register',
  });

  // Merchant A session must remain OPEN
  const recheckSessionA = await cashbookService.getCashbookSessions(userA, { date: todayKey });
  assert.strictEqual(
    recheckSessionA.todaySession.status,
    'OPEN',
    'Merchant A session must remain OPEN when Merchant B closes'
  );

  console.log('✅ Register sessions, opening cash floats, and closing reconciliation isolated');

  // ==========================================
  // 4. DEBTORS & CREDIT MANAGEMENT ISOLATION
  // ==========================================
  console.log('\n🔒 [4/5] Testing Debtors, Credit Ledgers & Repayments Isolation...');

  const creditA = await cashbookService.createCredit(userA, {
    customer_name: 'Chief Obinna',
    customer_phone: '08011223344',
    total_amount: 30000,
    amount_paid: 10000,
    due_date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    items_summary: '2x Milk Cartons',
  });

  // Merchant B checks customer ledgers
  const customerLedgersB = await cashbookService.getCustomerLedgers(userB);
  assert.strictEqual(customerLedgersB.length, 0, 'Merchant B must have 0 customer ledgers');

  // Merchant B tries to repay Chief Obinna's debt
  let crossRepayBlocked = false;
  try {
    await cashbookService.repayCustomerDebt(userB, 'Chief Obinna', {
      amount: 5000,
      payment_method: 'CASH',
    });
  } catch (err) {
    crossRepayBlocked = true;
  }
  assert.ok(crossRepayBlocked, 'Merchant B settling Merchant A customer credit must be rejected');

  // Chief Obinna debt for Merchant A must remain unchanged (₦20,000)
  const statementA = await cashbookService.getCustomerStatement(userA, 'Chief Obinna');
  assert.strictEqual(
    Number(statementA.summary.current_balance_due),
    20000,
    'Merchant A customer balance must remain ₦20,000'
  );

  console.log('✅ Credit records, customer debts, statements, and repayment FIFO strictly isolated');

  // ==========================================
  // 5. STOCK MOVEMENTS & AUDIT TRAIL ISOLATION
  // ==========================================
  console.log('\n🔒 [5/5] Testing Stock Movement Audit Trail Isolation...');

  await inventoryService.recordMovement(userA, {
    product_id: prodA.id,
    movement_type: 'RESTOCK',
    quantity: 10,
    unit_price: 1000,
    record_cash: false,
    note: 'Alpha restock movement',
  });

  await inventoryService.recordMovement(userB, {
    product_id: prodB.id,
    movement_type: 'RESTOCK',
    quantity: 5,
    unit_price: 1200,
    record_cash: false,
    note: 'Beta restock movement',
  });

  const movementsA = await inventoryService.getRecentMovements(userA, 10);
  const movementsB = await inventoryService.getRecentMovements(userB, 10);

  assert.ok(movementsA.length > 0, 'Merchant A must have recorded movements');
  assert.ok(!movementsA.some((m) => m.product_id === prodB.id), 'Merchant A must not see Merchant B movements');

  assert.ok(movementsB.length > 0, 'Merchant B must have recorded movements');
  assert.ok(!movementsB.some((m) => m.product_id === prodA.id), 'Merchant B must not see Merchant A movements');

  console.log('✅ Stock movement audit records completely isolated');

  console.log('\n🎉 ALL MULTI-TENANT BUSINESS DATA ISOLATION TESTS PASSED 100% GREEN!\n');
}

runTests().catch((err) => {
  console.error('❌ Data isolation test suite failed:', err);
  process.exit(1);
});
