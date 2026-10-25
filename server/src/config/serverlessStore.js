const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_FILE = path.join(os.tmpdir(), 'stockflow-lagos-store-v1.json');

const INITIAL_STATE = {
  store_settings: {
    store_pin: process.env.STORE_PIN || '1234',
  },
  products: [
    {
      id: 1,
      sku: 'PRV-001',
      name: 'Peak Milk Powder Sachet (Roll x12)',
      category: 'Milk & Drinks',
      unit: 'Roll',
      cost_price: 2600.0,
      selling_price: 3000.0,
      stock_quantity: 24,
      reorder_level: 8,
      supplier_name: 'Oke-Arin Wholesale',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 2,
      sku: 'PRV-002',
      name: 'Milo Activ-Go Sachet (Roll x10)',
      category: 'Milk & Drinks',
      unit: 'Roll',
      cost_price: 2100.0,
      selling_price: 2500.0,
      stock_quantity: 19,
      reorder_level: 8,
      supplier_name: 'Oke-Arin Wholesale',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 3,
      sku: 'NDL-003',
      name: 'Indomie Super Pack 120g (Carton x40)',
      category: 'Noodles & Pasta',
      unit: 'Carton',
      cost_price: 14200.0,
      selling_price: 16000.0,
      stock_quantity: 4,
      reorder_level: 6,
      supplier_name: 'Mushin Market Depot',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 4,
      sku: 'NDL-004',
      name: 'Indomie Super Pack 120g (Single)',
      category: 'Noodles & Pasta',
      unit: 'Piece',
      cost_price: 355.0,
      selling_price: 450.0,
      stock_quantity: 45,
      reorder_level: 20,
      supplier_name: 'Mushin Market Depot',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 5,
      sku: 'GRN-005',
      name: 'Golden Penny Semovita 2kg',
      category: 'Swallow & Grains',
      unit: 'Bag',
      cost_price: 2850.0,
      selling_price: 3300.0,
      stock_quantity: 3,
      reorder_level: 10,
      supplier_name: 'Trade Fair Wholesaler',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 6,
      sku: 'GRN-006',
      name: 'Dangote Granulated Sugar 500g',
      category: 'Provisions',
      unit: 'Pack',
      cost_price: 1150.0,
      selling_price: 1400.0,
      stock_quantity: 28,
      reorder_level: 10,
      supplier_name: 'Oke-Arin Wholesale',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 7,
      sku: 'OIL-007',
      name: 'Devon Kings Cooking Oil 1L Pouch',
      category: 'Cooking Oil',
      unit: 'Pouch',
      cost_price: 2400.0,
      selling_price: 2800.0,
      stock_quantity: 15,
      reorder_level: 6,
      supplier_name: 'Trade Fair Wholesaler',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 8,
      sku: 'CND-008',
      name: 'Titus Sardine in Oil 125g',
      category: 'Canned Food',
      unit: 'Tin',
      cost_price: 1150.0,
      selling_price: 1400.0,
      stock_quantity: 5,
      reorder_level: 12,
      supplier_name: 'Oke-Arin Wholesale',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 9,
      sku: 'SNK-009',
      name: 'Golden Morn Maize Cereal 900g',
      category: 'Cereals & Snacks',
      unit: 'Pack',
      cost_price: 3600.0,
      selling_price: 4200.0,
      stock_quantity: 11,
      reorder_level: 5,
      supplier_name: 'Mushin Market Depot',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 10,
      sku: 'HHS-010',
      name: 'Sunlight Detergent Powder 900g',
      category: 'Soap & Household',
      unit: 'Pack',
      cost_price: 1650.0,
      selling_price: 2000.0,
      stock_quantity: 4,
      reorder_level: 8,
      supplier_name: 'Trade Fair Wholesaler',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 11,
      sku: 'DRK-011',
      name: 'Eva Table Water 75cl (Pack x12)',
      category: 'Milk & Drinks',
      unit: 'Pack',
      cost_price: 2400.0,
      selling_price: 3000.0,
      stock_quantity: 14,
      reorder_level: 6,
      supplier_name: 'Local Beverage Truck',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 12,
      sku: 'BRD-012',
      name: 'Agege / Sliced Family Loaf Bread',
      category: 'Bread & Bakery',
      unit: 'Loaf',
      cost_price: 1200.0,
      selling_price: 1500.0,
      stock_quantity: 9,
      reorder_level: 5,
      supplier_name: 'Morning Bakery Supplier',
      created_at: '2026-10-20T08:00:00.000Z',
      updated_at: '2026-10-24T09:00:00.000Z',
    },
  ],
  stock_movements: [
    {
      id: 1,
      idempotency_key: null,
      product_id: 1,
      movement_type: 'RESTOCK',
      quantity_change: 30,
      previous_stock: 0,
      new_stock: 30,
      unit_price: 2600.0,
      total_value: 78000.0,
      counterparty_name: 'Oke-Arin Wholesale',
      note: 'Monday market restock',
      created_at: '2026-10-24T08:30:00.000Z',
    },
    {
      id: 2,
      idempotency_key: null,
      product_id: 1,
      movement_type: 'SALE',
      quantity_change: -6,
      previous_stock: 30,
      new_stock: 24,
      unit_price: 3000.0,
      total_value: 18000.0,
      counterparty_name: 'Walk-in Customers',
      note: 'Morning counter sales',
      created_at: '2026-10-24T10:15:00.000Z',
    },
    {
      id: 3,
      idempotency_key: null,
      product_id: 3,
      movement_type: 'RESTOCK',
      quantity_change: 10,
      previous_stock: 0,
      new_stock: 10,
      unit_price: 14200.0,
      total_value: 142000.0,
      counterparty_name: 'Mushin Market Depot',
      note: 'Bought 10 cartons of Indomie',
      created_at: '2026-10-24T11:00:00.000Z',
    },
    {
      id: 4,
      idempotency_key: null,
      product_id: 3,
      movement_type: 'SALE',
      quantity_change: -6,
      previous_stock: 10,
      new_stock: 4,
      unit_price: 16000.0,
      total_value: 96000.0,
      counterparty_name: 'Mama Tobi & Walk-in',
      note: 'Sold 6 cartons',
      created_at: '2026-10-24T14:20:00.000Z',
    },
  ],
  cash_transactions: [
    {
      id: 1,
      idempotency_key: null,
      type: 'INFLOW',
      category: 'Opening Shop Float',
      amount: 250000.0,
      payment_method: 'BANK_TRANSFER',
      counterparty_name: 'Shop Owner Account',
      description: 'Starting capital in OPay / Moniepoint account',
      stock_movement_id: null,
      transaction_date: '2026-10-24T08:00:00.000Z',
    },
    {
      id: 2,
      idempotency_key: null,
      type: 'OUTFLOW',
      category: 'Market Restock',
      amount: 165000.0,
      payment_method: 'BANK_TRANSFER',
      counterparty_name: 'Oke-Arin & Mushin Suppliers',
      description: 'Stock purchase for Peak, Indomie & Semovita',
      stock_movement_id: null,
      transaction_date: '2026-10-24T09:00:00.000Z',
    },
    {
      id: 3,
      idempotency_key: null,
      type: 'INFLOW',
      category: 'Counter Sales',
      amount: 68500.0,
      payment_method: 'CASH',
      counterparty_name: 'Walk-in Customers',
      description: 'Cash sales at shop front',
      stock_movement_id: null,
      transaction_date: new Date().toISOString(),
    },
    {
      id: 4,
      idempotency_key: null,
      type: 'INFLOW',
      category: 'Counter Sales',
      amount: 45500.0,
      payment_method: 'POS',
      counterparty_name: 'Moniepoint POS Terminal',
      description: 'Customer card & transfer payments via POS',
      stock_movement_id: null,
      transaction_date: new Date().toISOString(),
    },
    {
      id: 5,
      idempotency_key: null,
      type: 'OUTFLOW',
      category: 'Generator Fuel',
      amount: 6500.0,
      payment_method: 'CASH',
      counterparty_name: 'Total Filling Station',
      description: '5 litres petrol for shop generator',
      stock_movement_id: null,
      transaction_date: new Date().toISOString(),
    },
    {
      id: 6,
      idempotency_key: null,
      type: 'OUTFLOW',
      category: 'Market Transport (Keke/Bus)',
      amount: 4000.0,
      payment_method: 'CASH',
      counterparty_name: 'Keke / Korope Driver',
      description: 'Transport fare carrying goods from Mushin market',
      stock_movement_id: null,
      transaction_date: '2026-10-24T15:00:00.000Z',
    },
    {
      id: 7,
      idempotency_key: null,
      type: 'OUTFLOW',
      category: 'EKEDC / Nepa Light',
      amount: 10000.0,
      payment_method: 'BANK_TRANSFER',
      counterparty_name: 'EKEDC Prepaid',
      description: 'Shop prepaid electricity meter token',
      stock_movement_id: null,
      transaction_date: '2026-10-24T16:00:00.000Z',
    },
  ],
  credit_records: [
    {
      id: 1,
      customer_name: 'Mama Tobi (No. 14 Street)',
      phone: '08031234567',
      items_summary: '1 Carton Indomie Super Pack, 2 Rolls Peak Milk',
      total_amount: 22000.0,
      amount_paid: 15000.0,
      balance_due: 7000.0,
      status: 'OWING',
      created_at: '2026-10-24T12:00:00.000Z',
      updated_at: '2026-10-24T12:00:00.000Z',
    },
    {
      id: 2,
      customer_name: 'Bro Chinedu (Barber Shop)',
      phone: '08098765432',
      items_summary: '2 Golden Penny Semovita 2kg, 2 Titus Sardine',
      total_amount: 9400.0,
      amount_paid: 5000.0,
      balance_due: 4400.0,
      status: 'OWING',
      created_at: '2026-10-24T13:30:00.000Z',
      updated_at: '2026-10-24T13:30:00.000Z',
    },
  ],
};

let memoryState = null;

function loadState() {
  if (memoryState) return memoryState;
  try {
    if (fs.existsSync(STORE_FILE)) {
      memoryState = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      return memoryState;
    }
  } catch {
    // Fallback to initial state
  }
  memoryState = JSON.parse(JSON.stringify(INITIAL_STATE));
  saveState(memoryState);
  return memoryState;
}

function saveState(state) {
  memoryState = state;
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(state), 'utf8');
  } catch {
    // Ignore read-only fs errors
  }
}

function nextId(list) {
  return list.length ? Math.max(...list.map((i) => Number(i.id) || 0)) + 1 : 1;
}

async function executeQuery(text, params = []) {
  const sql = text.replace(/\s+/g, ' ').trim();
  const upper = sql.toUpperCase();
  const state = loadState();

  // Transaction control statements
  if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
    return { rows: [], rowCount: 0 };
  }

  // 1. Store settings queries
  if (upper.startsWith('CREATE TABLE IF NOT EXISTS STORE_SETTINGS')) {
    return { rows: [], rowCount: 0 };
  }
  if (upper.startsWith('INSERT INTO STORE_SETTINGS')) {
    if (!state.store_settings.store_pin) {
      state.store_settings.store_pin = params[0] || '1234';
      saveState(state);
    }
    return { rows: [], rowCount: 1 };
  }
  if (upper.includes("FROM STORE_SETTINGS WHERE KEY = 'STORE_PIN'")) {
    return {
      rows: [{ value: state.store_settings.store_pin || '1234' }],
      rowCount: 1,
    };
  }
  if (upper.startsWith('UPDATE STORE_SETTINGS SET VALUE')) {
    state.store_settings.store_pin = String(params[0]);
    saveState(state);
    return { rows: [], rowCount: 1 };
  }

  // 2. Dashboard Metrics CTE
  if (upper.startsWith('WITH INV AS')) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const total_products = state.products.length;
    const low_stock_count = state.products.filter(
      (p) => Number(p.stock_quantity) <= Number(p.reorder_level)
    ).length;
    const inventory_cost_value = state.products
      .reduce((s, p) => s + Number(p.stock_quantity) * Number(p.cost_price), 0)
      .toFixed(2);
    const inventory_retail_value = state.products
      .reduce((s, p) => s + Number(p.stock_quantity) * Number(p.selling_price), 0)
      .toFixed(2);
    const projected_gross_margin = state.products
      .reduce(
        (s, p) => s + Number(p.stock_quantity) * (Number(p.selling_price) - Number(p.cost_price)),
        0
      )
      .toFixed(2);

    const totalIn = state.cash_transactions
      .filter((t) => t.type === 'INFLOW')
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = state.cash_transactions
      .filter((t) => t.type === 'OUTFLOW')
      .reduce((s, t) => s + Number(t.amount), 0);
    const todayIn = state.cash_transactions
      .filter((t) => t.type === 'INFLOW' && String(t.transaction_date).slice(0, 10) >= todayStr)
      .reduce((s, t) => s + Number(t.amount), 0);
    const todayOut = state.cash_transactions
      .filter((t) => t.type === 'OUTFLOW' && String(t.transaction_date).slice(0, 10) >= todayStr)
      .reduce((s, t) => s + Number(t.amount), 0);

    const owingCredits = state.credit_records.filter((c) => c.status === 'OWING');
    const active_debtors_count = owingCredits.length;
    const total_credit_owed = owingCredits
      .reduce((s, c) => s + Number(c.balance_due), 0)
      .toFixed(2);

    return {
      rows: [
        {
          total_products,
          low_stock_count,
          inventory_cost_value,
          inventory_retail_value,
          projected_gross_margin,
          total_inflow: totalIn.toFixed(2),
          total_outflow: totalOut.toFixed(2),
          today_inflow: todayIn.toFixed(2),
          today_outflow: todayOut.toFixed(2),
          active_debtors_count,
          total_credit_owed,
          net_cash_balance: (totalIn - totalOut).toFixed(2),
        },
      ],
      rowCount: 1,
    };
  }

  // Category Breakdown
  if (upper.includes('FROM PRODUCTS GROUP BY CATEGORY')) {
    const map = {};
    for (const p of state.products) {
      if (!map[p.category]) {
        map[p.category] = { category: p.category, sku_count: 0, cost: 0, retail: 0 };
      }
      map[p.category].sku_count += 1;
      map[p.category].cost += Number(p.stock_quantity) * Number(p.cost_price);
      map[p.category].retail += Number(p.stock_quantity) * Number(p.selling_price);
    }
    const rows = Object.values(map)
      .sort((a, b) => b.retail - a.retail)
      .map((c) => ({
        category: c.category,
        sku_count: c.sku_count,
        cost_value: c.cost.toFixed(2),
        retail_value: c.retail.toFixed(2),
      }));
    return { rows, rowCount: rows.length };
  }

  // Channel Breakdown
  if (upper.includes('FROM CASH_TRANSACTIONS GROUP BY PAYMENT_METHOD')) {
    const map = {};
    for (const t of state.cash_transactions) {
      const m = t.payment_method || 'CASH';
      if (!map[m]) map[m] = { payment_method: m, inflow: 0, outflow: 0 };
      if (t.type === 'INFLOW') map[m].inflow += Number(t.amount);
      else map[m].outflow += Number(t.amount);
    }
    const rows = Object.values(map)
      .map((c) => ({
        payment_method: c.payment_method,
        inflow: c.inflow.toFixed(2),
        outflow: c.outflow.toFixed(2),
        net: (c.inflow - c.outflow).toFixed(2),
      }))
      .sort((a, b) => Number(b.net) - Number(a.net));
    return { rows, rowCount: rows.length };
  }

  // 3. Products queries
  if (upper.startsWith('SELECT * FROM PRODUCTS WHERE ID = $1')) {
    const id = Number(params[0]);
    const prod = state.products.find((p) => Number(p.id) === id);
    return { rows: prod ? [prod] : [], rowCount: prod ? 1 : 0 };
  }

  if (upper.startsWith('SELECT * FROM PRODUCTS')) {
    let list = [...state.products];
    list.sort((a, b) => {
      const aLow = Number(a.stock_quantity) <= Number(a.reorder_level) ? 1 : 0;
      const bLow = Number(b.stock_quantity) <= Number(b.reorder_level) ? 1 : 0;
      if (aLow !== bLow) return bLow - aLow;
      return a.name.localeCompare(b.name);
    });
    return { rows: list, rowCount: list.length };
  }

  if (upper.startsWith('INSERT INTO PRODUCTS')) {
    const [
      sku,
      name,
      category,
      unit,
      cost_price,
      selling_price,
      stock_quantity,
      reorder_level,
      supplier_name,
    ] = params;
    if (state.products.some((p) => p.sku.toUpperCase() === String(sku).toUpperCase())) {
      const err = new Error('Duplicate SKU');
      err.code = '23505';
      throw err;
    }
    const now = new Date().toISOString();
    const created = {
      id: nextId(state.products),
      sku,
      name,
      category,
      unit,
      cost_price: Number(cost_price),
      selling_price: Number(selling_price),
      stock_quantity: Number(stock_quantity),
      reorder_level: Number(reorder_level),
      supplier_name,
      created_at: now,
      updated_at: now,
    };
    state.products.push(created);
    saveState(state);
    return { rows: [created], rowCount: 1 };
  }

  if (upper.startsWith('UPDATE PRODUCTS SET STOCK_QUANTITY = $1')) {
    const [newStock, id] = params;
    const prod = state.products.find((p) => Number(p.id) === Number(id));
    if (prod) {
      prod.stock_quantity = Number(newStock);
      prod.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: prod ? [prod] : [], rowCount: prod ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE PRODUCTS SET NAME = $1')) {
    const [name, category, unit, cost_price, selling_price, reorder_level, supplier_name, id] =
      params;
    const prod = state.products.find((p) => Number(p.id) === Number(id));
    if (!prod) return { rows: [], rowCount: 0 };
    prod.name = name;
    prod.category = category;
    prod.unit = unit;
    prod.cost_price = Number(cost_price);
    prod.selling_price = Number(selling_price);
    prod.reorder_level = Number(reorder_level);
    prod.supplier_name = supplier_name;
    prod.updated_at = new Date().toISOString();
    saveState(state);
    return { rows: [prod], rowCount: 1 };
  }

  // 4. Stock Movements queries
  if (upper.startsWith('SELECT * FROM STOCK_MOVEMENTS WHERE IDEMPOTENCY_KEY = $1')) {
    const found = state.stock_movements.find((m) => m.idempotency_key === params[0]);
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  if (upper.startsWith('SELECT SM.*, P.NAME AS PRODUCT_NAME')) {
    const limit = Number(params[0]) || 200;
    const rows = [...state.stock_movements]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id)
      .slice(0, limit)
      .map((sm) => {
        const p = state.products.find((prod) => Number(prod.id) === Number(sm.product_id)) || {};
        return {
          ...sm,
          product_name: p.name || 'Provision Item',
          sku: p.sku || 'PRV',
          unit: p.unit || 'Pack',
          category: p.category || 'Provisions',
        };
      });
    return { rows, rowCount: rows.length };
  }

  if (upper.startsWith('INSERT INTO STOCK_MOVEMENTS')) {
    let record;
    if (upper.includes("'SALE'")) {
      const [
        product_id,
        quantity_change,
        previous_stock,
        new_stock,
        unit_price,
        total_value,
        counterparty_name,
        note,
      ] = params;
      record = {
        id: nextId(state.stock_movements),
        idempotency_key: null,
        product_id: Number(product_id),
        movement_type: 'SALE',
        quantity_change: Number(quantity_change),
        previous_stock: Number(previous_stock),
        new_stock: Number(new_stock),
        unit_price: Number(unit_price),
        total_value: Number(total_value),
        counterparty_name,
        note,
        created_at: new Date().toISOString(),
      };
    } else {
      const [
        idempotency_key,
        product_id,
        movement_type,
        quantity_change,
        previous_stock,
        new_stock,
        unit_price,
        total_value,
        counterparty_name,
        note,
      ] = params;
      record = {
        id: nextId(state.stock_movements),
        idempotency_key,
        product_id: Number(product_id),
        movement_type,
        quantity_change: Number(quantity_change),
        previous_stock: Number(previous_stock),
        new_stock: Number(new_stock),
        unit_price: Number(unit_price),
        total_value: Number(total_value),
        counterparty_name,
        note,
        created_at: new Date().toISOString(),
      };
    }
    state.stock_movements.push(record);
    saveState(state);
    return { rows: [record], rowCount: 1 };
  }

  // 5. Cash Transactions queries
  if (upper.startsWith('SELECT * FROM CASH_TRANSACTIONS WHERE IDEMPOTENCY_KEY = $1')) {
    const found = state.cash_transactions.find((t) => t.idempotency_key === params[0]);
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  if (upper.startsWith('SELECT * FROM CASH_TRANSACTIONS')) {
    let list = [...state.cash_transactions];
    if (upper.includes('TYPE = $')) {
      const tVal = params.find((p) => p === 'INFLOW' || p === 'OUTFLOW');
      if (tVal) list = list.filter((t) => t.type === tVal);
    }
    if (upper.includes('PAYMENT_METHOD = $')) {
      const mVal = params.find((p) =>
        ['CASH', 'POS', 'BANK_TRANSFER', 'MOBILE_MONEY'].includes(p)
      );
      if (mVal) list = list.filter((t) => t.payment_method === mVal);
    }
    list.sort(
      (a, b) => new Date(b.transaction_date) - new Date(a.transaction_date) || b.id - a.id
    );
    return { rows: list, rowCount: list.length };
  }

  if (upper.startsWith('INSERT INTO CASH_TRANSACTIONS')) {
    let tx;
    if (upper.includes("'COUNTER SALES'")) {
      const [amount, payment_method, counterparty_name, description, stock_movement_id] = params;
      tx = {
        id: nextId(state.cash_transactions),
        idempotency_key: null,
        type: 'INFLOW',
        category: 'Counter Sales',
        amount: Number(amount),
        payment_method,
        counterparty_name,
        description,
        stock_movement_id,
        transaction_date: new Date().toISOString(),
      };
    } else if (upper.includes("'CREDIT REPAYMENT'")) {
      const [amount, payment_method, counterparty_name, description] = params;
      tx = {
        id: nextId(state.cash_transactions),
        idempotency_key: null,
        type: 'INFLOW',
        category: 'Credit Repayment',
        amount: Number(amount),
        payment_method,
        counterparty_name,
        description,
        stock_movement_id: null,
        transaction_date: new Date().toISOString(),
      };
    } else if (params.length === 8) {
      const [
        idempotency_key,
        type,
        category,
        amount,
        payment_method,
        counterparty_name,
        description,
        stock_movement_id,
      ] = params;
      tx = {
        id: nextId(state.cash_transactions),
        idempotency_key,
        type,
        category,
        amount: Number(amount),
        payment_method,
        counterparty_name,
        description,
        stock_movement_id,
        transaction_date: new Date().toISOString(),
      };
    } else {
      const [
        idempotency_key,
        type,
        category,
        amount,
        payment_method,
        counterparty_name,
        description,
      ] = params;
      tx = {
        id: nextId(state.cash_transactions),
        idempotency_key,
        type,
        category,
        amount: Number(amount),
        payment_method,
        counterparty_name,
        description,
        stock_movement_id: null,
        transaction_date: new Date().toISOString(),
      };
    }
    state.cash_transactions.push(tx);
    saveState(state);
    return { rows: [tx], rowCount: 1 };
  }

  if (upper.startsWith('DELETE FROM CASH_TRANSACTIONS WHERE ID = $1')) {
    const id = Number(params[0]);
    const before = state.cash_transactions.length;
    state.cash_transactions = state.cash_transactions.filter((t) => Number(t.id) !== id);
    saveState(state);
    return { rows: [], rowCount: before - state.cash_transactions.length };
  }

  // 6. Credit / Debtors Book queries
  if (upper.startsWith('SELECT * FROM CREDIT_RECORDS WHERE ID = $1')) {
    const id = Number(params[0]);
    const found = state.credit_records.find((c) => Number(c.id) === id);
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  if (upper.startsWith('SELECT * FROM CREDIT_RECORDS')) {
    let list = [...state.credit_records];
    if (params[0] && params[0] !== 'ALL') {
      list = list.filter((c) => c.status === params[0]);
    }
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'OWING' ? -1 : 1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    return { rows: list, rowCount: list.length };
  }

  if (upper.startsWith('INSERT INTO CREDIT_RECORDS')) {
    const [customer_name, phone, items_summary, total_amount, amount_paid, balance_due, status] =
      params;
    const now = new Date().toISOString();
    const rec = {
      id: nextId(state.credit_records),
      customer_name,
      phone,
      items_summary,
      total_amount: Number(total_amount),
      amount_paid: Number(amount_paid),
      balance_due: Number(balance_due),
      status: status || 'OWING',
      created_at: now,
      updated_at: now,
    };
    state.credit_records.push(rec);
    saveState(state);
    return { rows: [rec], rowCount: 1 };
  }

  if (upper.startsWith('UPDATE CREDIT_RECORDS SET AMOUNT_PAID = $1')) {
    const [amount_paid, balance_due, status, id] = params;
    const rec = state.credit_records.find((c) => Number(c.id) === Number(id));
    if (!rec) return { rows: [], rowCount: 0 };
    rec.amount_paid = Number(amount_paid);
    rec.balance_due = Number(balance_due);
    rec.status = status;
    rec.updated_at = new Date().toISOString();
    saveState(state);
    return { rows: [rec], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

module.exports = {
  query: executeQuery,
  connect: async () => ({
    query: executeQuery,
    release: () => {},
  }),
};
