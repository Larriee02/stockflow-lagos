// Common Lagos provision-store items. Seeded per account with 0 stock so traders can start
// counting their shelves immediately instead of typing every product by hand.
const STARTER_CATALOG = [
  ['PRV-001', 'Peak Milk Powder Sachet (Roll x12)', 'Milk & Drinks', 'Roll', 2600, 3000, 8, 'Oke-Arin Wholesale'],
  ['PRV-002', 'Milo Activ-Go Sachet (Roll x10)', 'Milk & Drinks', 'Roll', 2100, 2500, 8, 'Oke-Arin Wholesale'],
  ['NDL-003', 'Indomie Super Pack 120g (Carton x40)', 'Noodles & Pasta', 'Carton', 14200, 16000, 6, 'Mushin Market Depot'],
  ['NDL-004', 'Indomie Super Pack 120g (Single)', 'Noodles & Pasta', 'Piece', 355, 450, 20, 'Mushin Market Depot'],
  ['GRN-005', 'Golden Penny Semovita 2kg', 'Swallow & Grains', 'Bag', 2850, 3300, 10, 'Trade Fair Wholesaler'],
  ['GRN-006', 'Dangote Granulated Sugar 500g', 'Provisions', 'Pack', 1150, 1400, 10, 'Oke-Arin Wholesale'],
  ['OIL-007', 'Devon Kings Cooking Oil 1L Pouch', 'Cooking Oil', 'Pouch', 2400, 2800, 6, 'Trade Fair Wholesaler'],
  ['CND-008', 'Titus Sardine in Oil 125g', 'Canned Food', 'Tin', 1150, 1400, 12, 'Oke-Arin Wholesale'],
  ['SNK-009', 'Golden Morn Maize Cereal 900g', 'Cereals & Snacks', 'Pack', 3600, 4200, 5, 'Mushin Market Depot'],
  ['HHS-010', 'Sunlight Detergent Powder 900g', 'Soap & Household', 'Pack', 1650, 2000, 8, 'Trade Fair Wholesaler'],
  ['DRK-011', 'Eva Table Water 75cl (Pack x12)', 'Milk & Drinks', 'Pack', 2400, 3000, 6, 'Local Beverage Truck'],
  ['BRD-012', 'Agege / Sliced Family Loaf Bread', 'Bread & Bakery', 'Loaf', 1200, 1500, 5, 'Morning Bakery Supplier'],
];

async function seedStarterCatalog(q, userId) {
  for (const [sku, name, category, unit, cost, sell, reorder, supplier] of STARTER_CATALOG) {
    await q.query(
      `INSERT INTO products (user_id, sku, name, category, unit, cost_price, selling_price,
                             stock_quantity, reorder_level, supplier_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9)
       ON CONFLICT (user_id, sku) DO NOTHING`,
      [userId, sku, name, category, unit, cost, sell, reorder, supplier]
    );
  }
}

module.exports = { STARTER_CATALOG, seedStarterCatalog };
