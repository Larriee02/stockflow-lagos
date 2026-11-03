/**
 * Automated Test Suite: Debtor & Credit Management
 * Tests:
 * 1. Credit record creation with due_date, customer_address, notes
 * 2. Overdue status & days overdue calculation
 * 3. Multi-credit aggregation under unified customer ledger
 * 4. Customer debt repayment across multiple invoices (FIFO)
 * 5. Repayment audit logging in credit_repayments
 * 6. Customer statement of account with running balance
 */

const assert = require('assert');
const path = require('path');

process.env.NODE_ENV = 'test';

async function runTests() {
  console.log('🧪 Starting Debtor & Credit Management Test Suite...\n');

  // Initialize DB and Services
  const db = require('./src/config/db');
  await db.ready();

  const authService = require('./src/services/auth.service');
  const cashbookService = require('./src/services/cashbook.service');

  // 1. Create a test user
  const testEmail = `retailer_debtor_${Date.now()}@stockflow.test`;
  const registerResult = await authService.register({
    email: testEmail,
    password: 'Password123#',
    full_name: 'Debtor Test Retailer',
    business_name: 'Lagos Mega Supermarket',
    phone: '08012345678',
    seed_catalog: false,
  });
  const userId = registerResult.user.id;
  console.log(`✅ Test user created with ID ${userId}`);

  // 2. Create multiple credit records for "Mama Chukwudi"
  // First credit: ₦10,000 total, ₦3,000 paid = ₦7,000 owing (due in the PAST to test overdue)
  const pastDueDate = new Date(Date.now() - 5 * 86400000).toISOString(); // 5 days ago
  const credit1 = await cashbookService.createCredit(userId, {
    customer_name: 'Mama Chukwudi',
    phone: '08023456789',
    customer_address: 'Shop 14, Balogun Market',
    items_summary: '2x Cartons of Indomie, 1x 50kg Rice',
    total_amount: 10000,
    amount_paid: 3000,
    due_date: pastDueDate,
    notes: 'Regular customer from line 2',
  });

  assert.strictEqual(credit1.customer_name, 'Mama Chukwudi');
  assert.strictEqual(Number(credit1.balance_due), 7000);
  assert.strictEqual(credit1.is_overdue, true, 'Credit 1 should be overdue');
  assert.ok(credit1.days_overdue >= 5, 'Days overdue should be >= 5');
  console.log('✅ Overdue credit record created and verified (5 days overdue, ₦7,000 balance)');

  // Second credit for "Mama Chukwudi": ₦6,000 total, ₦0 paid = ₦6,000 owing (due in the FUTURE)
  const futureDueDate = new Date(Date.now() + 10 * 86400000).toISOString(); // 10 days in future
  const credit2 = await cashbookService.createCredit(userId, {
    customer_name: 'mama chukwudi', // Test case insensitivity
    phone: '08023456789',
    customer_address: 'Shop 14, Balogun Market',
    items_summary: '1x Carton of Milo Refill, 2x Peak Milk Roll',
    total_amount: 6000,
    amount_paid: 0,
    due_date: futureDueDate,
    notes: 'Second purchase on credit',
  });

  assert.strictEqual(Number(credit2.balance_due), 6000);
  assert.strictEqual(credit2.is_overdue, false, 'Credit 2 should not be overdue');
  console.log('✅ Second credit record created for same customer (₦6,000 balance, future due date)');

  // 3. Test Customer Ledgers Aggregation
  const ledgers = await cashbookService.getCustomerLedgers(userId);
  assert.ok(ledgers.length >= 1, 'Should have at least 1 customer ledger');
  const mamaLedger = ledgers.find((l) => l.customer_name.toLowerCase() === 'mama chukwudi');
  assert.ok(mamaLedger, 'Mama Chukwudi ledger must exist');
  assert.strictEqual(mamaLedger.credit_count, 2, 'Should have 2 credit invoices');
  assert.strictEqual(mamaLedger.active_credits_count, 2, 'Should have 2 active owing invoices');
  assert.strictEqual(mamaLedger.total_credit_taken, 16000, 'Total credit taken should be 16,000');
  assert.strictEqual(mamaLedger.total_paid, 3000, 'Total initial paid should be 3,000');
  assert.strictEqual(mamaLedger.total_balance_due, 13000, 'Total balance due should be 13,000 (7,000 + 6,000)');
  assert.strictEqual(mamaLedger.is_overdue, true, 'Overall ledger should be flagged as overdue');
  assert.strictEqual(mamaLedger.phone, '08023456789');
  assert.strictEqual(mamaLedger.customer_address, 'Shop 14, Balogun Market');
  console.log('✅ Customer Ledgers aggregated successfully (Total balance: ₦13,000 across 2 invoices)');

  // 4. Test Customer Debt Repayment (FIFO allocation across multiple invoices)
  // Mama Chukwudi brings ₦9,000 cash to pay towards her debt
  // Invoice 1 owes ₦7,000 -> Should be fully settled (PAID, balance 0)
  // Invoice 2 owes ₦6,000 -> Should receive remaining ₦2,000 (OWING, balance ₦4,000)
  const repayResult = await cashbookService.repayCustomerDebt(userId, 'Mama Chukwudi', {
    amount: 9000,
    payment_method: 'CASH',
    note: 'Part payment delivered by sales boy',
  });

  assert.strictEqual(repayResult.total_paid, 9000);
  assert.strictEqual(repayResult.remaining_balance, 4000);
  assert.strictEqual(repayResult.updatedCredits.length, 2);
  assert.strictEqual(repayResult.updatedCredits[0].status, 'PAID');
  assert.strictEqual(Number(repayResult.updatedCredits[0].balance_due), 0);
  assert.strictEqual(repayResult.updatedCredits[1].status, 'OWING');
  assert.strictEqual(Number(repayResult.updatedCredits[1].balance_due), 4000);
  assert.strictEqual(repayResult.createdRepayments.length, 2);
  console.log('✅ FIFO Debt Repayment executed successfully:');
  console.log(`   - Invoice #${credit1.id}: Fully settled (₦7,000 applied)`);
  console.log(`   - Invoice #${credit2.id}: Partially paid (₦2,000 applied, ₦4,000 balance remaining)`);

  // 5. Verify Cashbook Cash Inflow Transaction
  const transactions = await cashbookService.getTransactions(userId);
  const repTx = transactions.find((t) => t.category === 'Credit Repayment' && Number(t.amount) === 9000);
  assert.ok(repTx, 'Inflow transaction of ₦9,000 should exist in cashbook');
  console.log('✅ Cashbook inflow recorded automatically for ₦9,000 credit repayment');

  // 6. Test Customer Statement of Account Generation
  const statement = await cashbookService.getCustomerStatement(userId, 'Mama Chukwudi');
  assert.strictEqual(statement.customer.name, 'Mama Chukwudi');
  assert.strictEqual(statement.customer.phone, '08023456789');
  assert.strictEqual(statement.summary.total_credit_taken, 16000);
  assert.strictEqual(statement.summary.current_balance_due, 4000);
  assert.ok(Array.isArray(statement.ledger) && statement.ledger.length >= 4, 'Ledger should contain invoices and repayments');

  // Check running balance consistency
  const finalEntry = statement.ledger[statement.ledger.length - 1];
  assert.strictEqual(finalEntry.running_balance, 4000, 'Final running balance on statement must match balance due');
  console.log('✅ Customer Statement of Account verified with accurate chronological running balance (₦4,000)');

  // 7. Verify updated ledger status
  const updatedLedgers = await cashbookService.getCustomerLedgers(userId);
  const updatedMama = updatedLedgers.find((l) => l.customer_name.toLowerCase() === 'mama chukwudi');
  assert.strictEqual(updatedMama.total_balance_due, 4000);
  assert.strictEqual(updatedMama.active_credits_count, 1);
  // credit1 was overdue, but credit1 is now PAID! So mama is NO LONGER overdue!
  assert.strictEqual(updatedMama.is_overdue, false, 'Overdue status should clear once overdue invoice is settled');
  console.log('✅ Overdue status accurately cleared upon settling overdue invoice');

  console.log('\n🎉 ALL DEBTOR & CREDIT TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
