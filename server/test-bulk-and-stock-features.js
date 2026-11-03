// Automated test for bulk import, batch adjustment, physical stock-taking, and damaged/expired/missing classification
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
  console.log('--- Testing Bulk Import, Batch Adjustments & Physical Stock Audit ---');

  // 1. Register test merchant
  const { user } = await authService.register({
    email: 'stock-audit-test@lagos.ng',
    password: 'Password123#',
    full_name: 'Audit Trader',
    business_name: 'Lagos Fast Provisions',
    seed_catalog: false,
  });
  const userId = user.id;

  // 2. Test Bulk Import (CSV / Excel format)
  console.log('\n[1/4] Testing Bulk Product Import...');
  const importData = [
    {
      sku: 'SKU-INDOMIE-01',
      name: 'Indomie Instant Noodles Onion Chicken 70g (Carton)',
      category: 'Pasta & Noodles',
      unit: 'Carton',
      cost_price: 6800,
      selling_price: 7800,
      stock_quantity: 20,
      reorder_level: 5,
      supplier_name: 'Indomie Depot Oshodi',
    },
    {
      sku: 'SKU-GOLDEN-02',
      name: 'Golden Penny Spaghetti 500g',
      category: 'Pasta & Noodles',
      unit: 'Pack',
      cost_price: 900,
      selling_price: 1100,
      stock_quantity: 50,
      reorder_level: 10,
      supplier_name: 'Flour Mills Lagos',
    },
    {
      sku: 'SKU-PEAK-03',
      name: 'Peak Evaporated Milk 160g Tin',
      category: 'Dairy',
      unit: 'Roll',
      cost_price: 4500,
      selling_price: 5200,
      stock_quantity: 15,
      reorder_level: 3,
      supplier_name: 'FrieslandCampina WAMCO',
    },
  ];

  const importResult = await inventoryService.bulkImportProducts(userId, {
    products: importData,
    updateExisting: true,
  });

  console.log(`Import Result: ${importResult.importedCount} imported, ${importResult.updatedCount} updated.`);
  if (importResult.importedCount !== 3) {
    throw new Error(`Expected 3 products imported, got ${importResult.importedCount}`);
  }

  // Re-import with an update (upsert)
  const upsertData = [
    {
      sku: 'SKU-INDOMIE-01',
      name: 'Indomie Instant Noodles Onion Chicken 70g (Carton)',
      category: 'Pasta & Noodles',
      unit: 'Carton',
      cost_price: 7000, // updated price
      selling_price: 8000,
      stock_quantity: 25, // updated stock (+5)
      reorder_level: 5,
    },
  ];

  const upsertResult = await inventoryService.bulkImportProducts(userId, {
    products: upsertData,
    updateExisting: true,
  });

  console.log(`Upsert Result: ${upsertResult.updatedCount} updated.`);
  if (upsertResult.updatedCount !== 1) {
    throw new Error('Expected 1 product updated on re-import!');
  }

  const allProds = await inventoryService.getProducts(userId, {});
  const indomie = allProds.find((p) => p.sku === 'SKU-INDOMIE-01');
  const spaghetti = allProds.find((p) => p.sku === 'SKU-GOLDEN-02');
  const milk = allProds.find((p) => p.sku === 'SKU-PEAK-03');

  if (Number(indomie.stock_quantity) !== 25) {
    throw new Error(`Expected Indomie stock to be 25, got ${indomie.stock_quantity}`);
  }

  // 3. Test Batch Stock Adjustments with Damaged, Expired & Missing
  console.log('\n[2/4] Testing Batch Stock Adjustments with Discrepancy Reasons...');
  const adjustments = [
    {
      product_id: indomie.id,
      mode: 'DELTA',
      quantity: 2,
      movement_type: 'DAMAGED', // 2 cartons water-damaged
      note: 'Rain leakage in backroom',
    },
    {
      product_id: spaghetti.id,
      mode: 'DELTA',
      quantity: 5,
      movement_type: 'EXPIRED', // 5 packs past expiry
      note: 'Past best-before batch 09/2026',
    },
    {
      product_id: milk.id,
      mode: 'DELTA',
      quantity: 1,
      movement_type: 'MISSING', // 1 roll missing from counter
      note: 'Untracked loss during evening shift',
    },
  ];

  const adjResult = await inventoryService.batchStockAdjustment(userId, { adjustments });
  console.log(`Adjusted ${adjResult.updatedCount} products in batch.`);
  if (adjResult.updatedCount !== 3) {
    throw new Error(`Expected 3 adjustments, got ${adjResult.updatedCount}`);
  }

  const postAdjIndomie = (await db.query('SELECT * FROM products WHERE id = $1', [indomie.id])).rows[0];
  const postAdjSpaghetti = (await db.query('SELECT * FROM products WHERE id = $1', [spaghetti.id])).rows[0];
  const postAdjMilk = (await db.query('SELECT * FROM products WHERE id = $1', [milk.id])).rows[0];

  console.log(`- Indomie Stock: ${indomie.stock_quantity} -> ${postAdjIndomie.stock_quantity} (Expected 23)`);
  console.log(`- Spaghetti Stock: ${spaghetti.stock_quantity} -> ${postAdjSpaghetti.stock_quantity} (Expected 45)`);
  console.log(`- Milk Stock: ${milk.stock_quantity} -> ${postAdjMilk.stock_quantity} (Expected 14)`);

  if (Number(postAdjIndomie.stock_quantity) !== 23) throw new Error('Damaged deduction mismatch!');
  if (Number(postAdjSpaghetti.stock_quantity) !== 45) throw new Error('Expired deduction mismatch!');
  if (Number(postAdjMilk.stock_quantity) !== 14) throw new Error('Missing deduction mismatch!');

  // 4. Test Physical Stock Count (Stock Audit Workflow)
  console.log('\n[3/4] Testing Physical Stock Count Workflow (Shelf Audit)...');
  const counts = [
    {
      product_id: indomie.id,
      actual_count: 23, // Expected 23 -> Balanced (0 discrepancy)
      reason: 'ADJUSTMENT',
      note: 'Shelf count matched perfectly',
    },
    {
      product_id: spaghetti.id,
      actual_count: 42, // Expected 45 -> -3 deficit (Missing/Shrinkage)
      reason: 'MISSING',
      note: 'Physical shelf count short by 3 packs',
    },
    {
      product_id: milk.id,
      actual_count: 16, // Expected 14 -> +2 surplus (Found extra unrecorded roll)
      reason: 'SURPLUS',
      note: 'Found extra unrecorded roll behind display',
    },
  ];

  const auditResult = await inventoryService.batchPhysicalStockCount(userId, {
    counts,
    auditNote: 'Weekly Shelf Audit Lagos',
  });

  console.log(`Audit Results: Total: ${auditResult.totalAudited}, Balanced: ${auditResult.balancedCount}, Discrepancies: ${auditResult.discrepancyCount}`);
  if (auditResult.balancedCount !== 1 || auditResult.discrepancyCount !== 2) {
    throw new Error('Audit count summary mismatch!');
  }

  // 5. Verify Movements and Historical Filtering
  console.log('\n[4/4] Verifying Movement Types in History...');
  const movements = await inventoryService.getRecentMovements(userId, 50);
  const typesRecorded = new Set(movements.map((m) => m.movement_type));
  console.log('Recorded Movement Types:', Array.from(typesRecorded));

  const hasDamaged = typesRecorded.has('DAMAGED');
  const hasExpired = typesRecorded.has('EXPIRED');
  const hasMissing = typesRecorded.has('MISSING');
  const hasSurplus = typesRecorded.has('SURPLUS');

  console.log(`- DAMAGED logged: ${hasDamaged}`);
  console.log(`- EXPIRED logged: ${hasExpired}`);
  console.log(`- MISSING logged: ${hasMissing}`);
  console.log(`- SURPLUS logged: ${hasSurplus}`);

  if (!hasDamaged || !hasExpired || !hasMissing || !hasSurplus) {
    throw new Error('Missing expected movement types in stock movement ledger!');
  }

  console.log('\n>>> ALL BULK IMPORT, BATCH ADJUSTMENT & PHYSICAL STOCK AUDIT TESTS PASSED! <<<');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
