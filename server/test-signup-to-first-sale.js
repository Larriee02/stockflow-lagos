/**
 * Automated Verification: Signup-to-First-Sale Retailer Journey
 * Tests the 5 core launch milestones:
 * 1. Create an account (auto-approved, token issued)
 * 2. Set up store business profile & opening cash drawer float
 * 3. Seed starter catalog (12 popular Lagos provisions)
 * 4. Record opening stock via batch shelf count (10 packs for each item)
 * 5. Make first counter sale with receipt, stock decrement, and cashbook entry
 */

const assert = require('assert');
const path = require('path');

process.env.NODE_ENV = 'test';

async function runTests() {
  console.log('🧪 Starting Signup-to-First-Sale End-to-End Test Suite...\n');

  const db = require('./src/config/db');
  await db.ready();

  const authService = require('./src/services/auth.service');
  const inventoryService = require('./src/services/inventory.service');
  const cashbookService = require('./src/services/cashbook.service');

  // ==========================================
  // MILESTONE 1: Create an Account
  // ==========================================
  console.log('📌 MILESTONE 1: Create Account & Auto-Approval');
  const testEmail = `retailer_first_sale_${Date.now()}@stockflow.test`;
  const registerResult = await authService.register({
    email: testEmail,
    password: 'SecureRetailPassword123#',
    full_name: 'Alhaja Bisi Adeyemi',
    business_name: 'Bisi Provisions & Cold Drinks',
    phone: '08033221100',
    business_type: 'Provision Store',
    city: 'Lagos Island',
    currency: 'NGN',
    seed_catalog: true, // Retail launch default
  });

  assert.ok(registerResult.user, 'User object should be returned');
  assert.ok(registerResult.token, 'Auth token should be issued');
  assert.strictEqual(
    registerResult.user.status,
    'APPROVED',
    'New retailer must be auto-approved for immediate self-serve launch'
  );
  const userId = registerResult.user.id;
  console.log(`✅ Retailer registered and auto-approved with ID: ${userId}`);

  // ==========================================
  // MILESTONE 2: Set Up Business Profile & Drawer Float
  // ==========================================
  console.log('\n📌 MILESTONE 2: Set Up Store Business Profile & Morning Drawer Float');
  const updatedProfile = await authService.updateProfile(userId, {
    full_name: 'Alhaja Bisi Adeyemi',
    business_name: 'Bisi Provisions & Wholesale',
    business_type: 'Supermarket & Provisions',
    city: 'Lagos Island',
    address: 'Shop 14, Block C, Oke-Arin Market, Lagos Island',
    currency: 'NGN',
  });

  assert.strictEqual(updatedProfile.business_name, 'Bisi Provisions & Wholesale');
  assert.strictEqual(updatedProfile.address, 'Shop 14, Block C, Oke-Arin Market, Lagos Island');
  console.log('✅ Store business profile updated with market stall address');

  // Open morning drawer cash float of ₦20,000
  const session = await cashbookService.openCashbookSession(userId, {
    session_date: new Date().toISOString().slice(0, 10),
    opening_cash: 20000,
    opening_bank_pos: 0,
    opening_balance: 20000,
    opening_note: 'Morning counter cash float for customer change',
  });

  assert.strictEqual(Number(session.opening_balance), 20000, 'Opening balance should be ₦20,000');
  assert.strictEqual(Number(session.opening_cash), 20000, 'Opening cash should be ₦20,000');
  console.log('✅ Morning drawer cash float of ₦20,000 opened successfully');

  // ==========================================
  // MILESTONE 3: Verify Starter Catalog Seeded
  // ==========================================
  console.log('\n📌 MILESTONE 3: Verify Starter Catalog Products');
  const catalogProducts = await inventoryService.getProducts(userId);
  assert.strictEqual(catalogProducts.length, 12, '12 starter provisions should be seeded');

  // Check that all 12 items have 0 stock initially
  const nonZeroStock = catalogProducts.filter((p) => Number(p.stock_quantity) > 0);
  assert.strictEqual(
    nonZeroStock.length,
    0,
    'Seeded catalog items must have 0 initial stock until shelves are counted'
  );
  console.log('✅ 12 starter items verified (all with initial stock = 0)');

  // ==========================================
  // MILESTONE 4: Record Opening Stock (Shelf Count)
  // ==========================================
  console.log('\n📌 MILESTONE 4: Record Opening Stock (Shelf Count)');
  // Set 10 packs for every product using batch adjustment
  const batchAdjustments = catalogProducts.map((p) => ({
    product_id: p.id,
    quantity: 10,
    mode: 'SET_COUNT',
    movement_type: 'SURPLUS',
    note: 'Initial Shelf Count / Opening Stock',
  }));

  const batchResult = await inventoryService.batchStockAdjustment(userId, {
    adjustments: batchAdjustments,
  });

  assert.strictEqual(
    batchResult.updatedCount || batchResult.updated_count,
    12,
    'All 12 items should be updated'
  );
  console.log(`✅ Batch adjusted 12 items with total starting valuation: ₦${(batchResult.totalValueChange || batchResult.total_value_change).toLocaleString()}`);

  // Re-query products and verify all stock is 10
  const updatedProducts = await inventoryService.getProducts(userId);
  for (const prod of updatedProducts) {
    assert.strictEqual(
      Number(prod.stock_quantity),
      10,
      `Product "${prod.name}" should have stock 10`
    );
  }
  console.log('✅ Verified: All 12 store products now have 10 units active on shelf');

  // ==========================================
  // MILESTONE 5: Make First Counter Sale
  // ==========================================
  console.log('\n📌 MILESTONE 5: Make First Counter Sale');
  // Identify Peak Milk (PRV-001) and Indomie Single (NDL-004)
  const peakMilk = updatedProducts.find((p) => p.sku === 'PRV-001');
  const indomie = updatedProducts.find((p) => p.sku === 'NDL-004');

  assert.ok(peakMilk, 'Peak Milk must exist in catalog');
  assert.ok(indomie, 'Indomie must exist in catalog');

  // Sell:
  // - 2 Peak Milk rolls @ ₦3,000 = ₦6,000
  // - 3 Indomie packets @ ₦450 = ₦1,350
  // Total Sale = ₦7,350 (Paid in CASH)
  const cartPayload = {
    items: [
      { product_id: peakMilk.id, quantity: 2, unit_price: Number(peakMilk.selling_price) },
      { product_id: indomie.id, quantity: 3, unit_price: Number(indomie.selling_price) },
    ],
    payment_method: 'CASH',
    amount_paid: 7350,
    customer_name: 'Mama Nkechi',
    customer_phone: '08091122334',
  };

  const checkoutResult = await inventoryService.checkoutCart(userId, cartPayload);

  // 1. Verify checkout financial calculation
  assert.strictEqual(Number(checkoutResult.basketTotal), 7350, 'Total sale amount must be ₦7,350');
  assert.strictEqual(Number(checkoutResult.actualPaid), 7350, 'Amount paid must be ₦7,350');
  assert.strictEqual(Number(checkoutResult.balanceDue), 0, 'Balance due must be 0');
  assert.strictEqual(checkoutResult.movementsCreated.length, 2, 'Sale must create 2 stock movements');
  assert.ok(checkoutResult.itemsSummary.includes('Peak Milk'), 'Items summary must mention Peak Milk');
  assert.ok(checkoutResult.itemsSummary.includes('Indomie'), 'Items summary must mention Indomie');
  console.log(`✅ Checkout completed successfully: Total ₦${checkoutResult.basketTotal.toLocaleString()} Paid in full (${checkoutResult.itemsSummary})`);

  // 2. Verify stock reduction
  const postSaleProducts = await inventoryService.getProducts(userId);
  const postPeakMilk = postSaleProducts.find((p) => p.id === peakMilk.id);
  const postIndomie = postSaleProducts.find((p) => p.id === indomie.id);

  assert.strictEqual(Number(postPeakMilk.stock_quantity), 8, 'Peak milk stock should decrement from 10 to 8');
  assert.strictEqual(Number(postIndomie.stock_quantity), 7, 'Indomie stock should decrement from 10 to 7');
  console.log('✅ Stock accurately decremented on store shelves');

  // 3. Verify cashbook automatic inflow
  const transactions = await cashbookService.getTransactions(userId);
  const saleTx = transactions.find((t) => t.type === 'INFLOW' && Number(t.amount) === 7350);
  assert.ok(saleTx, 'Cashbook must contain ₦7,350 sales inflow');
  assert.strictEqual(saleTx.payment_method, 'CASH', 'Payment channel must be CASH');
  console.log('✅ Cashbook automatically recorded ₦7,350 CASH inflow');

  // 4. Verify stock movements audit log
  const movements = await inventoryService.getRecentMovements(userId, 20);
  const saleMovements = movements.filter((m) => m.movement_type === 'SALE');
  assert.strictEqual(saleMovements.length, 2, 'Two SALE movements should be recorded');
  console.log('✅ Stock movements audit trail verified for both sold items');

  console.log('\n🎉 ALL 5 MILESTONES IN THE SIGNUP-TO-FIRST-SALE JOURNEY COMPLETED AND VERIFIED 100% GREEN!\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
