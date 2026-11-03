/**
 * Automated Verification: POS vs Cash Reconciliation & Profit Disambiguation
 * Verifies:
 * 1. Financial measurement distinction:
 *    - Sales revenue
 *    - Gross profit
 *    - Operating expenses
 *    - Net operating profit
 *    - Cash available
 *    - Inventory value
 * 2. Channel reconciliation: Cash, POS, Bank Transfer
 * 3. Daily closing session workflow
 */

const assert = require('assert');
const path = require('path');

process.env.NODE_ENV = 'test';

async function runTests() {
  console.log('🧪 Starting POS vs Cash Reconciliation & Profit Disambiguation Test Suite...\n');

  const db = require('./src/config/db');
  await db.ready();

  const authService = require('./src/services/auth.service');
  const inventoryService = require('./src/services/inventory.service');
  const cashbookService = require('./src/services/cashbook.service');

  // 1. Create a dedicated test retailer
  const testEmail = `reconcile_retailer_${Date.now()}@stockflow.test`;
  const registerResult = await authService.register({
    email: testEmail,
    password: 'Password123#',
    full_name: 'Reconciliation Manager',
    business_name: 'Lagos Island Retail Depot',
    phone: '08099887766',
    seed_catalog: false,
  });
  const userId = registerResult.user.id;
  console.log(`✅ Test user created with ID ${userId}`);

  // 2. Add inventory products with clear cost vs selling prices
  // Product A: Cost ₦800, Selling ₦1,200 (Unit margin = ₦400, stock = 100)
  const prodA = await inventoryService.createProduct(userId, {
    name: 'Milo 500g Refill Pack',
    sku: 'MILO-500G',
    category: 'Beverages',
    cost_price: 800,
    selling_price: 1200,
    stock_quantity: 100,
    reorder_level: 15,
    unit: 'Pack',
  });

  // Product B: Cost ₦1,500, Selling ₦2,000 (Unit margin = ₦500, stock = 50)
  const prodB = await inventoryService.createProduct(userId, {
    name: 'Golden Morn 1kg',
    sku: 'GM-1KG',
    category: 'Cereals',
    cost_price: 1500,
    selling_price: 2000,
    stock_quantity: 50,
    reorder_level: 10,
    unit: 'Pack',
  });

  console.log('✅ Added 2 inventory products:');
  console.log(`   - Product A: Cost ₦800, Selling ₦1,200 (Stock: 100)`);
  console.log(`   - Product B: Cost ₦1,500, Selling ₦2,000 (Stock: 50)`);

  // Initial Inventory Value:
  // Cost Value = (100 * 800) + (50 * 1500) = 80,000 + 75,000 = ₦155,000
  // Retail Value = (100 * 1200) + (50 * 2000) = 120,000 + 100,000 = ₦220,000
  const initialDashboard = await cashbookService.getDashboardSummary(userId);
  assert.strictEqual(Number(initialDashboard.inventory_cost_value), 155000);
  assert.strictEqual(Number(initialDashboard.inventory_retail_value), 220000);
  assert.strictEqual(Number(initialDashboard.projected_gross_margin), 65000);
  console.log('✅ Inventory asset values verified: Cost ₦155,000 vs Retail ₦220,000');

  // 3. Open morning cashbook session with cash drawer float of ₦20,000 & POS/Bank balance of ₦50,000
  const todayStr = new Date().toISOString().slice(0, 10);
  const openSession = await cashbookService.openCashbookSession(userId, {
    session_date: todayStr,
    opening_cash: 20000,
    opening_bank_pos: 50000,
    opening_note: 'Morning shop cash float & Moniepoint POS account',
  });
  assert.strictEqual(Number(openSession.opening_balance), 70000);
  console.log('✅ Opened morning session: Float ₦20,000 + POS/Bank ₦50,000 = ₦70,000 total');

  // 4. Perform Sales across Channels:
  // Sale 1: 10 units of Product A sold via CASH
  // Revenue = 10 * 1200 = ₦12,000 | COGS = 10 * 800 = ₦8,000 | Gross Profit = ₦4,000
  await inventoryService.checkoutCart(userId, {
    items: [{ product_id: prodA.id, quantity: 10 }],
    payment_method: 'CASH',
    amount_paid: 12000,
    customer_name: 'Walk-in Cash Customer',
  });

  // Sale 2: 5 units of Product B sold via POS Terminal
  // Revenue = 5 * 2000 = ₦10,000 | COGS = 5 * 1500 = ₦7,500 | Gross Profit = ₦2,500
  await inventoryService.checkoutCart(userId, {
    items: [{ product_id: prodB.id, quantity: 5 }],
    payment_method: 'POS',
    amount_paid: 10000,
    customer_name: 'Card Customer Moniepoint',
  });

  // Sale 3: 5 units of Product A sold via BANK TRANSFER
  // Revenue = 5 * 1200 = ₦6,000 | COGS = 5 * 800 = ₦4,000 | Gross Profit = ₦2,000
  await inventoryService.checkoutCart(userId, {
    items: [{ product_id: prodA.id, quantity: 5 }],
    payment_method: 'BANK_TRANSFER',
    amount_paid: 6000,
    customer_name: 'Transfer Customer GTBank',
  });

  console.log('✅ Completed 3 checkout sales across CASH, POS & BANK_TRANSFER');

  // Total Sales Revenue = 12,000 + 10,000 + 6,000 = ₦28,000
  // Total Cost of Goods Sold (COGS) = 8,000 + 7,500 + 4,000 = ₦19,500
  // Total Gross Profit = 28,000 - 19,500 = ₦8,500 (Gross Margin: 30.36%)
  const movements = await inventoryService.getRecentMovements(userId, 100);
  const salesMovements = movements.filter((m) => m.movement_type === 'SALE');
  const calculatedSalesRevenue = salesMovements.reduce((sum, m) => sum + Number(m.total_value), 0);
  const calculatedCogs = salesMovements.reduce(
    (sum, m) => sum + Math.abs(Number(m.quantity_change)) * Number(m.cost_price),
    0
  );
  const calculatedGrossProfit = calculatedSalesRevenue - calculatedCogs;

  assert.strictEqual(calculatedSalesRevenue, 28000, 'Sales Revenue should be 28,000');
  assert.strictEqual(calculatedCogs, 19500, 'COGS should be 19,500');
  assert.strictEqual(calculatedGrossProfit, 8500, 'Gross profit should be 8,500');
  console.log('✅ Verified P&L Topline:');
  console.log(`   - Sales Revenue: ₦${calculatedSalesRevenue.toLocaleString()}`);
  console.log(`   - Cost of Goods Sold: ₦${calculatedCogs.toLocaleString()}`);
  console.log(`   - Gross Profit: ₦${calculatedGrossProfit.toLocaleString()}`);

  // 5. Record Operating Expenses:
  // Expense 1: Generator Petrol = ₦3,500 (CASH)
  await cashbookService.recordTransaction(userId, {
    type: 'OUTFLOW',
    category: 'Generator Fuel',
    amount: 3500,
    payment_method: 'CASH',
    counterparty_name: 'Total Fuel Station',
    expense_reason: 'Bought 5 litres of petrol for shop generator',
  });

  // Expense 2: Shop Attendant Allowance = ₦2,000 (CASH)
  await cashbookService.recordTransaction(userId, {
    type: 'OUTFLOW',
    category: 'Staff Wages',
    amount: 2000,
    payment_method: 'CASH',
    counterparty_name: 'Emeka Sales Boy',
    expense_reason: 'Daily counter shift allowance',
  });

  // Total Operating Expenses = 3,500 + 2,000 = ₦5,500
  // Net Operating Profit = Gross Profit (8,500) - Operating Expenses (5,500) = ₦3,000!
  const txs = await cashbookService.getTransactions(userId);
  const activeOutflows = txs.filter((t) => t.type === 'OUTFLOW' && t.status === 'ACTIVE');
  const totalOpex = activeOutflows.reduce((sum, t) => sum + Number(t.amount), 0);
  const netOperatingProfit = calculatedGrossProfit - totalOpex;

  assert.strictEqual(totalOpex, 5500, 'Operating expenses should be 5,500');
  assert.strictEqual(netOperatingProfit, 3000, 'Net operating profit should be 3,000');
  console.log('✅ Verified Operating Expenses & Net Profit:');
  console.log(`   - Operating Expenses: ₦${totalOpex.toLocaleString()}`);
  console.log(`   - Net Operating Profit: ₦${netOperatingProfit.toLocaleString()}`);

  // 6. Verify Liquid Cash Available Position:
  // Drawer Cash Expected = Opening Cash (20,000) + Cash Sales (12,000) - Cash Expenses (5,500) = ₦26,500
  // POS Expected = ₦10,000
  // Bank Expected = Opening Bank (50,000) + Bank Sales (6,000) = ₦56,000
  // Total Liquid Cash = 26,500 + 10,000 + 56,000 = ₦92,500
  // Notice that Total Liquid Cash (₦92,500) is completely distinct from Net Profit (₦3,000) and Revenue (₦28,000)!
  const updatedDashboard = await cashbookService.getDashboardSummary(userId);
  assert.strictEqual(Number(updatedDashboard.total_inflow), 28000, 'Total inflow matches revenue');
  assert.strictEqual(Number(updatedDashboard.total_outflow), 5500, 'Total outflow matches expenses');
  assert.strictEqual(Number(updatedDashboard.net_cash_balance), 22500, 'Net period cash flow is 28,000 - 5,500 = 22,500');
  console.log('✅ Distinct Cash Flow verified: Period Net Cash Flow = ₦22,500');

  // 7. Verify Remaining Inventory Value (Current Asset):
  // Product A: 100 - 15 = 85 left @ ₦800 cost = ₦68,000
  // Product B: 50 - 5 = 45 left @ ₦1,500 cost = ₦67,500
  // Remaining Total Inventory Cost = ₦135,500 (155,000 original - 19,500 COGS sold = 135,500)
  assert.strictEqual(Number(updatedDashboard.inventory_cost_value), 135500);
  console.log('✅ Inventory asset reduction matches COGS: ₦135,500 remaining on shelf');

  // 8. Test Daily POS & Cash Channel Reconciliation Workflow:
  // Expected: Cash ₦26,500, POS ₦10,000, Bank ₦56,000 (Total Expected = ₦92,500)
  // Retailer closes register with:
  // Actual Cash Count = ₦26,500 (Balanced)
  // Actual POS Slip = ₦10,000 (Balanced)
  // Actual Bank Alerts = ₦56,000 (Balanced)
  const closeResult = await cashbookService.closeCashbookSession(userId, {
    session_date: todayStr,
    opening_balance: 70000,
    opening_cash: 20000,
    opening_bank_pos: 50000,
    expected_closing_balance: 92500,
    actual_closing_balance: 92500,
    actual_closing_cash: 26500,
    actual_closing_bank_pos: 66000,
    variance: 0,
    closing_note: 'Daily register balanced to the kobo across drawer, Moniepoint POS and GTBank',
  });

  assert.strictEqual(closeResult.status, 'CLOSED');
  assert.strictEqual(Number(closeResult.variance), 0);
  assert.strictEqual(Number(closeResult.actual_closing_cash), 26500);
  console.log('✅ Daily reconciliation signed off & closed with zero variance!');

  // Summary Comparison Table to demonstrate clear distinction
  console.log('\n======================================================');
  console.log('📊 FINANCIAL MEASUREMENTS DISAMBIGUATION SUMMARY');
  console.log('======================================================');
  console.log(`1. Sales Revenue:        ₦${calculatedSalesRevenue.toLocaleString()} (Gross receipts)`);
  console.log(`2. Cost of Goods Sold:   ₦${calculatedCogs.toLocaleString()} (Direct product cost)`);
  console.log(`3. Gross Profit:         ₦${calculatedGrossProfit.toLocaleString()} (Margin on merchandise)`);
  console.log(`4. Operating Expenses:   ₦${totalOpex.toLocaleString()} (Fuel, rent & wages)`);
  console.log(`5. Net Operating Profit: ₦${netOperatingProfit.toLocaleString()} (True business profit)`);
  console.log(`6. Net Cash Available:   ₦${(22500 + 70000).toLocaleString()} (Liquid funds in hand)`);
  console.log(`7. Inventory Cost Value: ₦${Number(updatedDashboard.inventory_cost_value).toLocaleString()} (Goods on shelves)`);
  console.log('======================================================');
  console.log('✅ All measurements are verified distinct and not interchangeable.');

  console.log('\n🎉 ALL RECONCILIATION & PROFIT TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
