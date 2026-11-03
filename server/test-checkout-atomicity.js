// Automated test verifying that failed checkout does NOT leave cart, stock, or cashbook in an inconsistent state
process.env.VERCEL = '1';
process.env.ALLOW_OTP_PREVIEW = 'true';
const os = require('os');
const fs = require('fs');
const path = require('path');
fs.rmSync(path.join(os.tmpdir(), 'stockflow-live-production-v5.json'), { force: true });

const S = path.join(__dirname, '../server/src');
const authService = require(`${S}/services/auth.service`);
const inventoryService = require(`${S}/services/inventory.service`);
const db = require(`${S}/config/db`);

async function runTest() {
  console.log('--- Starting Checkout Atomicity & Rollback Verification ---');

  // 1. Create a test merchant user
  const { user } = await authService.register({
    email: 'merchant-atomicity@test.com',
    password: 'Password123#',
    full_name: 'Test Merchant',
    business_name: 'Atomicity Provisions Store',
    seed_catalog: false, // clean slate
  });

  const userId = user.id;

  // 2. Create two test products with known starting stock
  const p1Res = await db.query(
    `INSERT INTO products (user_id, sku, name, category, unit, cost_price, selling_price, stock_quantity, reorder_level, supplier_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [userId, 'SKU-MILK-1', 'Peak Milk 400g Tin', 'Dairy', 'Tin', 800, 1200, 10, 2, 'Lagos Distributor']
  );
  const prod1 = p1Res.rows[0];

  const p2Res = await db.query(
    `INSERT INTO products (user_id, sku, name, category, unit, cost_price, selling_price, stock_quantity, reorder_level, supplier_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [userId, 'SKU-SUGAR-1', 'Dangote Sugar 500g', 'Provisions', 'Pack', 500, 700, 2, 1, 'Lagos Sugar Wholesaler']
  );
  const prod2 = p2Res.rows[0];

  console.log(`Initial Setup:`);
  console.log(`- Product 1 (${prod1.name}): Initial Stock = ${prod1.stock_quantity}`);
  console.log(`- Product 2 (${prod2.name}): Initial Stock = ${prod2.stock_quantity}`);

  // Check initial movements and cashbook
  const initialMovements = (await db.query('SELECT * FROM stock_movements WHERE user_id = $1', [userId])).rows;
  const initialCash = (await db.query('SELECT * FROM cash_transactions WHERE user_id = $1', [userId])).rows;
  const initialCredit = (await db.query('SELECT * FROM credit_records WHERE user_id = $1', [userId])).rows;

  console.log(`Initial Movements: ${initialMovements.length}, Cashbook: ${initialCash.length}, Credit: ${initialCredit.length}`);

  // 3. Attempt invalid checkout:
  // Item 1: Qty 4 (Available: 10 - Valid)
  // Item 2: Qty 5 (Available: 2 - Insufficient Stock!)
  let checkoutError = null;
  try {
    await inventoryService.checkoutCart(userId, {
      items: [
        { product_id: prod1.id, quantity: 4 },
        { product_id: prod2.id, quantity: 5 }, // will fail here
      ],
      payment_method: 'CASH',
      amount_paid: 8300,
      customer_name: 'Walk-in Customer',
    });
  } catch (err) {
    checkoutError = err;
  }

  if (!checkoutError) {
    throw new Error('FAILED: Expected checkout to throw INSUFFICIENT_STOCK error, but it succeeded!');
  }
  console.log(`Received expected error: [${checkoutError.statusCode || 400}] ${checkoutError.message}`);

  // 4. Verify Database State After Failed Checkout:
  const postProd1 = (await db.query('SELECT * FROM products WHERE id = $1', [prod1.id])).rows[0];
  const postProd2 = (await db.query('SELECT * FROM products WHERE id = $1', [prod2.id])).rows[0];
  const postMovements = (await db.query('SELECT * FROM stock_movements WHERE user_id = $1', [userId])).rows;
  const postCash = (await db.query('SELECT * FROM cash_transactions WHERE user_id = $1', [userId])).rows;
  const postCredit = (await db.query('SELECT * FROM credit_records WHERE user_id = $1', [userId])).rows;

  console.log('\n--- Verifying Database Rollback Integrity ---');
  console.log(`Product 1 Stock: Expected 10, Found: ${postProd1.stock_quantity}`);
  console.log(`Product 2 Stock: Expected 2, Found: ${postProd2.stock_quantity}`);
  console.log(`Movements Created: Expected 0, Found: ${postMovements.length}`);
  console.log(`Cash Transactions Created: Expected 0, Found: ${postCash.length}`);
  console.log(`Credit Records Created: Expected 0, Found: ${postCredit.length}`);

  if (Number(postProd1.stock_quantity) !== 10) {
    throw new Error(`INTEGRITY FAILURE: Product 1 was partially decremented to ${postProd1.stock_quantity}!`);
  }
  if (Number(postProd2.stock_quantity) !== 2) {
    throw new Error(`INTEGRITY FAILURE: Product 2 stock was mutated to ${postProd2.stock_quantity}!`);
  }
  if (postMovements.length !== 0) {
    throw new Error(`INTEGRITY FAILURE: Stock movements were created despite checkout failure!`);
  }
  if (postCash.length !== 0) {
    throw new Error(`INTEGRITY FAILURE: Cash transaction was logged despite checkout failure!`);
  }
  if (postCredit.length !== 0) {
    throw new Error(`INTEGRITY FAILURE: Credit record was created despite checkout failure!`);
  }

  // 5. Verify Successful Checkout After Error:
  console.log('\n--- Verifying Subsequent Valid Checkout Succeeded ---');
  const validSale = await inventoryService.checkoutCart(userId, {
    items: [
      { product_id: prod1.id, quantity: 3 }, // 10 - 3 = 7
      { product_id: prod2.id, quantity: 1 }, // 2 - 1 = 1
    ],
    payment_method: 'POS',
    amount_paid: 4300, // 3 * 1200 + 1 * 700 = 3600 + 700 = 4300
    customer_name: 'Adeola Lagos',
  });

  const finalProd1 = (await db.query('SELECT * FROM products WHERE id = $1', [prod1.id])).rows[0];
  const finalProd2 = (await db.query('SELECT * FROM products WHERE id = $1', [prod2.id])).rows[0];
  const finalCash = (await db.query('SELECT * FROM cash_transactions WHERE user_id = $1', [userId])).rows;

  console.log(`Final Product 1 Stock: Expected 7, Found: ${finalProd1.stock_quantity}`);
  console.log(`Final Product 2 Stock: Expected 1, Found: ${finalProd2.stock_quantity}`);
  console.log(`Final Cash Inflows: Expected 1, Found: ${finalCash.length} (${finalCash[0]?.amount})`);

  if (Number(finalProd1.stock_quantity) !== 7 || Number(finalProd2.stock_quantity) !== 1 || finalCash.length !== 1) {
    throw new Error('Valid checkout failed to produce correct state!');
  }

  console.log('\n>>> ALL CHECKOUT ATOMICITY & INTEGRITY TESTS PASSED! <<<');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
