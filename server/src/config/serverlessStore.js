const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
const env = require('./env');
const { STARTER_CATALOG } = require('../db/starterCatalog');

const STORE_FILE = path.join(os.tmpdir(), 'stockflow-live-production-v5.json');

let memoryState = null;

function buildInitialState() {
  return {
    users: [],
    audit_logs: [],
    products: [],
    stock_movements: [],
    cash_transactions: [],
    credit_records: [],
  };
}

/**
 * Guarantees the platform owner exists as the ONLY administrator in the store.
 * Returns true if the state was modified.
 */
function ensureOwner(state) {
  const { OWNER_EMAIL, OWNER_NAME, getOwnerPasswordHash } = require('./owner');
  let changed = false;
  const now = new Date().toISOString();

  let owner = state.users.find((u) => String(u.email).toLowerCase() === OWNER_EMAIL);
  if (!owner) {
    owner = {
      id: nextId(state.users),
      email: OWNER_EMAIL,
      password_hash: getOwnerPasswordHash(),
      full_name: OWNER_NAME,
      business_name: 'StockFlow HQ',
      phone: null,
      business_type: 'Provision Store',
      city: 'Lagos',
      address: null,
      currency: 'NGN',
      role: 'ADMIN',
      status: 'APPROVED',
      auth_provider: 'EMAIL',
      google_sub: null,
      apple_sub: null,
      avatar_url: null,
      admin_note: null,
      token_version: 0,
      must_change_password: false,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: null,
      approved_at: now,
      approved_by: null,
      created_at: now,
      updated_at: now,
    };
    state.users.push(owner);
    changed = true;
  } else if (owner.role !== 'ADMIN' || !owner.password_hash || owner.status !== 'APPROVED') {
    owner.role = 'ADMIN';
    owner.status = 'APPROVED';
    if (!owner.password_hash || owner.auth_provider !== 'EMAIL') {
      owner.password_hash = getOwnerPasswordHash();
      owner.auth_provider = 'EMAIL';
      owner.token_version = (owner.token_version || 0) + 1;
    }
    owner.updated_at = now;
    changed = true;
  }

  for (const u of state.users) {
    if (u !== owner && u.role === 'ADMIN') {
      u.role = 'USER';
      u.token_version = (u.token_version || 0) + 1;
      u.updated_at = now;
      changed = true;
    }
  }
  return changed;
}

function loadState() {
  if (memoryState) return memoryState;
  try {
    if (fs.existsSync(STORE_FILE)) {
      memoryState = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      if (ensureOwner(memoryState)) saveState(memoryState);
      return memoryState;
    }
  } catch {
    // Fallback
  }
  memoryState = buildInitialState();
  ensureOwner(memoryState);
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

function toPublicUser(u, includeAdmin = false) {
  if (!u) return null;
  const base = {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    business_name: u.business_name,
    phone: u.phone,
    business_type: u.business_type,
    city: u.city,
    address: u.address,
    currency: u.currency || 'NGN',
    role: u.role,
    status: u.status,
    auth_provider: u.auth_provider,
    avatar_url: u.avatar_url,
    must_change_password: Boolean(u.must_change_password),
    last_login_at: u.last_login_at,
    approved_at: u.approved_at,
    created_at: u.created_at,
    updated_at: u.updated_at,
    has_password: Boolean(u.password_hash),
    google_linked: Boolean(u.google_sub),
    apple_linked: Boolean(u.apple_sub),
  };
  if (includeAdmin) {
    base.admin_note = u.admin_note || null;
    base.approved_by = u.approved_by || null;
    base.failed_login_attempts = u.failed_login_attempts || 0;
    base.locked_until = u.locked_until || null;
  }
  return base;
}

async function executeQuery(text, params = []) {
  const sql = text.replace(/\s+/g, ' ').trim();
  const upper = sql.toUpperCase();
  const state = loadState();

  if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
    return { rows: [], rowCount: 0 };
  }

  // ----------------------- USERS & AUTH QUERIES -----------------------

  if (upper === 'SELECT * FROM USERS WHERE ID = $1') {
    const u = state.users.find((x) => Number(x.id) === Number(params[0]));
    return { rows: u ? [{ ...u }] : [], rowCount: u ? 1 : 0 };
  }

  if (upper === 'SELECT * FROM USERS WHERE LOWER(EMAIL) = LOWER($1)') {
    const email = String(params[0] || '').toLowerCase();
    const u = state.users.find((x) => String(x.email).toLowerCase() === email);
    return { rows: u ? [{ ...u }] : [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('SELECT * FROM USERS WHERE GOOGLE_SUB = $1')) {
    const u = state.users.find((x) => x.google_sub && x.google_sub === params[0]);
    return { rows: u ? [{ ...u }] : [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('SELECT * FROM USERS WHERE APPLE_SUB = $1')) {
    const u = state.users.find((x) => x.apple_sub && x.apple_sub === params[0]);
    return { rows: u ? [{ ...u }] : [], rowCount: u ? 1 : 0 };
  }

  if (upper.includes('FROM USERS WHERE ID = $1') && upper.includes('HAS_PASSWORD')) {
    const includeAdmin = upper.includes('ADMIN_NOTE');
    const u = state.users.find((x) => Number(x.id) === Number(params[0]));
    const mapped = toPublicUser(u, includeAdmin);
    return { rows: mapped ? [mapped] : [], rowCount: mapped ? 1 : 0 };
  }

  if (upper.startsWith('INSERT INTO USERS')) {
    const [
      email,
      password_hash,
      full_name,
      business_name,
      phone,
      business_type,
      city,
      role,
      status,
      auth_provider,
      google_sub,
      apple_sub,
      avatar_url,
      approved_at,
      currency,
    ] = params;
    const now = new Date().toISOString();
    const newUser = {
      id: nextId(state.users),
      email: String(email).toLowerCase(),
      password_hash: password_hash || null,
      full_name,
      business_name: business_name || '',
      phone: phone || null,
      business_type: business_type || 'Retail Store',
      city: city || 'Lagos',
      address: null,
      currency: currency || 'NGN',
      role: role || 'USER',
      status: status || 'PENDING',
      auth_provider: auth_provider || 'EMAIL',
      google_sub: google_sub || null,
      apple_sub: apple_sub || null,
      avatar_url: avatar_url || null,
      admin_note: null,
      token_version: 0,
      must_change_password: false,
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: now,
      approved_at: approved_at ? new Date(approved_at).toISOString() : null,
      approved_by: null,
      created_at: now,
      updated_at: now,
    };
    state.users.push(newUser);
    saveState(state);
    return { rows: [{ id: newUser.id }], rowCount: 1 };
  }

  if (upper.startsWith('UPDATE USERS SET GOOGLE_SUB = $1')) {
    const [sub, avatar, id] = params;
    const u = state.users.find((x) => Number(x.id) === Number(id));
    if (u) {
      u.google_sub = sub;
      u.avatar_url = u.avatar_url || avatar;
      u.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE USERS SET APPLE_SUB = $1')) {
    const [sub, avatar, id] = params;
    const u = state.users.find((x) => Number(x.id) === Number(id));
    if (u) {
      u.apple_sub = sub;
      u.avatar_url = u.avatar_url || avatar;
      u.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE USERS SET LAST_LOGIN_AT = NOW()')) {
    const u = state.users.find((x) => Number(x.id) === Number(params[0]));
    if (u) {
      u.last_login_at = new Date().toISOString();
      u.failed_login_attempts = 0;
      u.locked_until = null;
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE USERS SET FAILED_LOGIN_ATTEMPTS')) {
    const [id, maxAttempts, lockMinutes] = params;
    const u = state.users.find((x) => Number(x.id) === Number(id));
    if (u) {
      u.failed_login_attempts = (u.failed_login_attempts || 0) + 1;
      if (u.failed_login_attempts >= Number(maxAttempts)) {
        u.locked_until = new Date(Date.now() + Number(lockMinutes) * 60000).toISOString();
      }
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE USERS SET FULL_NAME = $1')) {
    const [full_name, business_name, phone, business_type, city, address, currency, id] = params;
    const u = state.users.find((x) => Number(x.id) === Number(id));
    if (u) {
      u.full_name = full_name;
      u.business_name = business_name;
      u.phone = phone;
      u.business_type = business_type;
      u.city = city;
      u.address = address;
      if (currency) u.currency = currency;
      u.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE USERS SET PASSWORD_HASH = $1')) {
    const [hash, mustChange, bump, id] = params;
    const u = state.users.find((x) => Number(x.id) === Number(id));
    if (u) {
      u.password_hash = hash;
      u.must_change_password = Boolean(mustChange);
      u.token_version = (u.token_version || 0) + Number(bump || 0);
      u.failed_login_attempts = 0;
      u.locked_until = null;
      u.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE USERS SET TOKEN_VERSION = TOKEN_VERSION + 1')) {
    const u = state.users.find((x) => Number(x.id) === Number(params[0]));
    if (u) {
      u.token_version = (u.token_version || 0) + 1;
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.includes("SELECT COUNT(*)::INT AS N FROM USERS WHERE ROLE = 'ADMIN'")) {
    const n = state.users.filter((u) => u.role === 'ADMIN' && u.status === 'APPROVED').length;
    return { rows: [{ n }], rowCount: 1 };
  }

  // ----------------------- ADMIN QUERIES -----------------------

  if (upper.includes('AS TOTAL_USERS') && upper.includes('AS PENDING_USERS')) {
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const users = state.users;
    return {
      rows: [
        {
          total_users: users.length,
          pending_users: users.filter((u) => u.status === 'PENDING').length,
          approved_users: users.filter((u) => u.status === 'APPROVED').length,
          suspended_users: users.filter((u) => u.status === 'SUSPENDED').length,
          rejected_users: users.filter((u) => u.status === 'REJECTED').length,
          admin_users: users.filter((u) => u.role === 'ADMIN').length,
          signups_7d: users.filter((u) => new Date(u.created_at).getTime() >= sevenDaysAgo).length,
          active_7d: users.filter(
            (u) => u.last_login_at && new Date(u.last_login_at).getTime() >= sevenDaysAgo
          ).length,
          google_users: users.filter((u) => u.auth_provider === 'GOOGLE').length,
          apple_users: users.filter((u) => u.auth_provider === 'APPLE').length,
          email_users: users.filter((u) => u.auth_provider === 'EMAIL').length,
        },
      ],
      rowCount: 1,
    };
  }

  if (upper.includes('AS PLATFORM_INFLOW')) {
    const platform_inflow = state.cash_transactions
      .filter((t) => t.type === 'INFLOW')
      .reduce((s, t) => s + Number(t.amount), 0)
      .toFixed(2);
    return {
      rows: [
        {
          platform_inflow,
          platform_transactions: state.cash_transactions.length,
        },
      ],
      rowCount: 1,
    };
  }

  if (upper.startsWith('SELECT COUNT(*)::INT AS TOTAL FROM USERS U')) {
    let list = [...state.users];
    let idx = 0;
    if (upper.includes('U.EMAIL ILIKE')) {
      const q = String(params[idx++] || '').replace(/%/g, '').toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.full_name.toLowerCase().includes(q) ||
          (u.business_name || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q)
      );
    }
    if (upper.includes('U.STATUS =')) {
      const st = params[idx++];
      list = list.filter((u) => u.status === st);
    }
    if (upper.includes('U.ROLE =')) {
      const rl = params[idx++];
      list = list.filter((u) => u.role === rl);
    }
    if (upper.includes('U.AUTH_PROVIDER =')) {
      const pr = params[idx++];
      list = list.filter((u) => u.auth_provider === pr);
    }
    return { rows: [{ total: list.length }], rowCount: 1 };
  }

  if (upper.includes('AS PRODUCT_COUNT') && upper.includes('FROM USERS U')) {
    let list = [...state.users];
    let idx = 0;
    if (upper.includes('U.EMAIL ILIKE')) {
      const q = String(params[idx++] || '').replace(/%/g, '').toLowerCase();
      list = list.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.full_name.toLowerCase().includes(q) ||
          (u.business_name || '').toLowerCase().includes(q) ||
          (u.phone || '').toLowerCase().includes(q)
      );
    }
    if (upper.includes('U.STATUS =')) {
      const st = params[idx++];
      list = list.filter((u) => u.status === st);
    }
    if (upper.includes('U.ROLE =')) {
      const rl = params[idx++];
      list = list.filter((u) => u.role === rl);
    }
    if (upper.includes('U.AUTH_PROVIDER =')) {
      const pr = params[idx++];
      list = list.filter((u) => u.auth_provider === pr);
    }

    const pageSize = Number(params[params.length - 2]) || 25;
    const offset = Number(params[params.length - 1]) || 0;
    const isAsc = upper.includes(' ASC ');

    list.sort((a, b) => {
      let cmp = 0;
      if (upper.includes('ORDER BY LOWER(U.FULL_NAME)')) {
        cmp = a.full_name.localeCompare(b.full_name);
      } else if (upper.includes('ORDER BY LOWER(U.BUSINESS_NAME)')) {
        cmp = (a.business_name || '').localeCompare(b.business_name || '');
      } else if (upper.includes('ORDER BY LOWER(U.EMAIL)')) {
        cmp = a.email.localeCompare(b.email);
      } else if (upper.includes('ORDER BY U.STATUS')) {
        cmp = a.status.localeCompare(b.status);
      } else if (upper.includes('ORDER BY U.LAST_LOGIN_AT')) {
        cmp = new Date(a.last_login_at || 0) - new Date(b.last_login_at || 0);
      } else {
        cmp = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      return isAsc ? cmp : -cmp;
    });

    const rows = list.slice(offset, offset + pageSize).map((u) => {
      const pub = toPublicUser(u, true);
      pub.product_count = state.products.filter((p) => Number(p.user_id) === Number(u.id)).length;
      pub.total_inflow = state.cash_transactions
        .filter((c) => Number(c.user_id) === Number(u.id) && c.type === 'INFLOW')
        .reduce((s, c) => s + Number(c.amount), 0)
        .toFixed(2);
      return pub;
    });

    return { rows, rowCount: rows.length };
  }

  if (upper.includes('AS STOCK_RETAIL_VALUE') && upper.includes('AS ACTIVE_DEBTORS')) {
    const uid = Number(params[0]);
    const prods = state.products.filter((p) => Number(p.user_id) === uid);
    const txs = state.cash_transactions.filter((t) => Number(t.user_id) === uid);
    const movs = state.stock_movements.filter((m) => Number(m.user_id) === uid);
    const creds = state.credit_records.filter((c) => Number(c.user_id) === uid);
    return {
      rows: [
        {
          product_count: prods.length,
          stock_retail_value: prods
            .reduce((s, p) => s + Number(p.stock_quantity) * Number(p.selling_price), 0)
            .toFixed(2),
          total_inflow: txs
            .filter((t) => t.type === 'INFLOW')
            .reduce((s, t) => s + Number(t.amount), 0)
            .toFixed(2),
          total_outflow: txs
            .filter((t) => t.type === 'OUTFLOW')
            .reduce((s, t) => s + Number(t.amount), 0)
            .toFixed(2),
          transaction_count: txs.length,
          sale_count: movs.filter((m) => m.movement_type === 'SALE').length,
          active_debtors: creds.filter((c) => c.status === 'OWING').length,
          last_activity_at: txs.length ? txs[0].transaction_date : null,
        },
      ],
      rowCount: 1,
    };
  }

  if (upper.startsWith('UPDATE USERS SET STATUS = $1')) {
    const [status, adminId, note, id] = params;
    const u = state.users.find((x) => Number(x.id) === Number(id));
    if (u) {
      u.status = status;
      if (status === 'APPROVED') {
        u.approved_at = new Date().toISOString();
        u.approved_by = adminId;
      }
      if (note !== null && note !== undefined) u.admin_note = note;
      if (status === 'SUSPENDED' || status === 'REJECTED') {
        u.token_version = (u.token_version || 0) + 1;
      }
      u.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE USERS SET ROLE = $1')) {
    const [role, id] = params;
    const u = state.users.find((x) => Number(x.id) === Number(id));
    if (u) {
      u.role = role;
      if (role === 'ADMIN') u.status = 'APPROVED';
      u.token_version = (u.token_version || 0) + 1;
      u.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE USERS SET ADMIN_NOTE = $1')) {
    const [note, id] = params;
    const u = state.users.find((x) => Number(x.id) === Number(id));
    if (u) {
      u.admin_note = note;
      u.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: [], rowCount: u ? 1 : 0 };
  }

  if (upper.startsWith('DELETE FROM USERS WHERE ID = $1')) {
    const id = Number(params[0]);
    state.users = state.users.filter((u) => Number(u.id) !== id);
    saveState(state);
    return { rows: [], rowCount: 1 };
  }

  if (upper.includes('FROM USERS ORDER BY CREATED_AT DESC LIMIT 10000')) {
    return {
      rows: state.users.map((u) => toPublicUser(u, false)),
      rowCount: state.users.length,
    };
  }

  // ----------------------- AUDIT LOGS -----------------------

  if (upper.startsWith('INSERT INTO AUDIT_LOGS')) {
    const [actor_user_id, action, target_user_id, details, ip_address] = params;
    let parsedDetails = {};
    try {
      parsedDetails = typeof details === 'string' ? JSON.parse(details) : details || {};
    } catch {
      parsedDetails = {};
    }
    const entry = {
      id: nextId(state.audit_logs),
      actor_user_id: actor_user_id || null,
      action,
      target_user_id: target_user_id || null,
      details: parsedDetails,
      ip_address: ip_address || null,
      created_at: new Date().toISOString(),
    };
    state.audit_logs.unshift(entry);
    saveState(state);
    return { rows: [entry], rowCount: 1 };
  }

  if (upper.startsWith('SELECT COUNT(*)::INT AS TOTAL FROM AUDIT_LOGS')) {
    return { rows: [{ total: state.audit_logs.length }], rowCount: 1 };
  }

  if (upper.includes('FROM AUDIT_LOGS A')) {
    let logs = [...state.audit_logs];
    if (upper.includes('A.TARGET_USER_ID =')) {
      const tid = Number(params[0]);
      logs = logs.filter((a) => Number(a.target_user_id) === tid);
    }
    const rows = logs.slice(0, 40).map((a) => {
      const actor = state.users.find((u) => Number(u.id) === Number(a.actor_user_id));
      const target = state.users.find((u) => Number(u.id) === Number(a.target_user_id));
      return {
        ...a,
        actor_name: actor?.full_name || null,
        actor_email: actor?.email || null,
        target_name: target?.full_name || null,
        target_email: target?.email || null,
      };
    });
    return { rows, rowCount: rows.length };
  }

  // ----------------------- MULTI-TENANT STORE QUERIES -----------------------

  if (upper.startsWith('WITH INV AS')) {
    const uid = Number(params[0]);
    const todayStr = new Date().toISOString().slice(0, 10);
    const prods = state.products.filter((p) => Number(p.user_id) === uid);
    const txs = state.cash_transactions.filter((t) => Number(t.user_id) === uid);
    const creds = state.credit_records.filter(
      (c) => Number(c.user_id) === uid && c.status === 'OWING'
    );

    const total_products = prods.length;
    const low_stock_count = prods.filter(
      (p) => Number(p.stock_quantity) <= Number(p.reorder_level)
    ).length;
    const inventory_cost_value = prods
      .reduce((s, p) => s + Number(p.stock_quantity) * Number(p.cost_price), 0)
      .toFixed(2);
    const inventory_retail_value = prods
      .reduce((s, p) => s + Number(p.stock_quantity) * Number(p.selling_price), 0)
      .toFixed(2);
    const projected_gross_margin = prods
      .reduce(
        (s, p) => s + Number(p.stock_quantity) * (Number(p.selling_price) - Number(p.cost_price)),
        0
      )
      .toFixed(2);

    const totalIn = txs
      .filter((t) => t.type === 'INFLOW')
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = txs
      .filter((t) => t.type === 'OUTFLOW')
      .reduce((s, t) => s + Number(t.amount), 0);
    const todayIn = txs
      .filter((t) => t.type === 'INFLOW' && String(t.transaction_date).slice(0, 10) >= todayStr)
      .reduce((s, t) => s + Number(t.amount), 0);
    const todayOut = txs
      .filter((t) => t.type === 'OUTFLOW' && String(t.transaction_date).slice(0, 10) >= todayStr)
      .reduce((s, t) => s + Number(t.amount), 0);

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
          active_debtors_count: creds.length,
          total_credit_owed: creds.reduce((s, c) => s + Number(c.balance_due), 0).toFixed(2),
          net_cash_balance: (totalIn - totalOut).toFixed(2),
        },
      ],
      rowCount: 1,
    };
  }

  if (upper.includes('FROM PRODUCTS WHERE USER_ID = $1 GROUP BY CATEGORY')) {
    const uid = Number(params[0]);
    const map = {};
    for (const p of state.products.filter((x) => Number(x.user_id) === uid)) {
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

  if (upper.includes('FROM CASH_TRANSACTIONS WHERE USER_ID = $1 GROUP BY PAYMENT_METHOD')) {
    const uid = Number(params[0]);
    const map = {};
    for (const t of state.cash_transactions.filter((x) => Number(x.user_id) === uid)) {
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

  if (upper.startsWith('SELECT * FROM PRODUCTS WHERE ID = $1 AND USER_ID = $2')) {
    const [id, uid] = params;
    const prod = state.products.find(
      (p) => Number(p.id) === Number(id) && Number(p.user_id) === Number(uid)
    );
    return { rows: prod ? [prod] : [], rowCount: prod ? 1 : 0 };
  }

  if (upper.startsWith('SELECT * FROM PRODUCTS')) {
    const uid = Number(params[0]);
    const list = state.products
      .filter((p) => Number(p.user_id) === uid)
      .sort((a, b) => {
        const aLow = Number(a.stock_quantity) <= Number(a.reorder_level) ? 1 : 0;
        const bLow = Number(b.stock_quantity) <= Number(b.reorder_level) ? 1 : 0;
        if (aLow !== bLow) return bLow - aLow;
        return a.name.localeCompare(b.name);
      });
    return { rows: list, rowCount: list.length };
  }

  if (upper.startsWith('INSERT INTO PRODUCTS')) {
    if (upper.includes('ON CONFLICT (USER_ID, SKU) DO NOTHING')) {
      const [user_id, sku, name, category, unit, cost_price, selling_price, reorder_level, supplier_name] =
        params;
      const exists = state.products.some(
        (p) => Number(p.user_id) === Number(user_id) && p.sku.toUpperCase() === String(sku).toUpperCase()
      );
      if (exists) return { rows: [], rowCount: 0 };
      const now = new Date().toISOString();
      const created = {
        id: nextId(state.products),
        user_id: Number(user_id),
        sku,
        name,
        category,
        unit,
        cost_price: Number(cost_price),
        selling_price: Number(selling_price),
        stock_quantity: 0,
        reorder_level: Number(reorder_level),
        supplier_name,
        created_at: now,
        updated_at: now,
      };
      state.products.push(created);
      saveState(state);
      return { rows: [created], rowCount: 1 };
    }

    const [
      user_id,
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
    if (
      state.products.some(
        (p) => Number(p.user_id) === Number(user_id) && p.sku.toUpperCase() === String(sku).toUpperCase()
      )
    ) {
      const err = new Error('Duplicate SKU');
      err.code = '23505';
      throw err;
    }
    const now = new Date().toISOString();
    const created = {
      id: nextId(state.products),
      user_id: Number(user_id),
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
    const [newStock, id, uid] = params;
    const prod = state.products.find(
      (p) => Number(p.id) === Number(id) && Number(p.user_id) === Number(uid)
    );
    if (prod) {
      prod.stock_quantity = Number(newStock);
      prod.updated_at = new Date().toISOString();
      saveState(state);
    }
    return { rows: prod ? [prod] : [], rowCount: prod ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE PRODUCTS SET NAME = $1')) {
    const [name, category, unit, cost_price, selling_price, reorder_level, supplier_name, id, uid] =
      params;
    const prod = state.products.find(
      (p) => Number(p.id) === Number(id) && Number(p.user_id) === Number(uid)
    );
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

  if (upper.startsWith('DELETE FROM STOCK_MOVEMENTS WHERE PRODUCT_ID = $1')) {
    const [pid, uid] = params;
    state.stock_movements = state.stock_movements.filter(
      (m) => !(Number(m.product_id) === Number(pid) && Number(m.user_id) === Number(uid))
    );
    saveState(state);
    return { rows: [], rowCount: 1 };
  }

  if (upper.startsWith('DELETE FROM PRODUCTS WHERE ID = $1 AND USER_ID = $2')) {
    const [id, uid] = params;
    const before = state.products.length;
    state.products = state.products.filter(
      (p) => !(Number(p.id) === Number(id) && Number(p.user_id) === Number(uid))
    );
    saveState(state);
    return { rows: [], rowCount: before - state.products.length };
  }

  if (upper.startsWith('DELETE FROM PRODUCTS WHERE USER_ID = $1')) {
    const uid = Number(params[0]);
    state.products = state.products.filter((p) => Number(p.user_id) !== uid);
    saveState(state);
    return { rows: [], rowCount: 1 };
  }

  if (upper.startsWith('SELECT * FROM STOCK_MOVEMENTS WHERE USER_ID = $1 AND IDEMPOTENCY_KEY = $2')) {
    const [uid, key] = params;
    const found = state.stock_movements.find(
      (m) => Number(m.user_id) === Number(uid) && m.idempotency_key === key
    );
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  if (upper.startsWith('SELECT SM.*, P.NAME AS PRODUCT_NAME')) {
    const [uid, limit] = params;
    const rows = state.stock_movements
      .filter((m) => Number(m.user_id) === Number(uid))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id)
      .slice(0, Number(limit) || 250)
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
        user_id,
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
        user_id: Number(user_id),
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
        user_id,
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
        user_id: Number(user_id),
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

  if (upper.startsWith('DELETE FROM STOCK_MOVEMENTS WHERE USER_ID = $1')) {
    const uid = Number(params[0]);
    state.stock_movements = state.stock_movements.filter((m) => Number(m.user_id) !== uid);
    saveState(state);
    return { rows: [], rowCount: 1 };
  }

  if (upper.startsWith('SELECT * FROM CASH_TRANSACTIONS WHERE USER_ID = $1 AND IDEMPOTENCY_KEY = $2')) {
    const [uid, key] = params;
    const found = state.cash_transactions.find(
      (t) => Number(t.user_id) === Number(uid) && t.idempotency_key === key
    );
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  if (upper.startsWith('SELECT * FROM CASH_TRANSACTIONS')) {
    const uid = Number(params[0]);
    let list = state.cash_transactions.filter((t) => Number(t.user_id) === uid);
    const tVal = params.find((p) => p === 'INFLOW' || p === 'OUTFLOW');
    if (tVal) list = list.filter((t) => t.type === tVal);
    const mVal = params.find((p) => ['CASH', 'POS', 'BANK_TRANSFER', 'MOBILE_MONEY'].includes(p));
    if (mVal) list = list.filter((t) => t.payment_method === mVal);
    list.sort(
      (a, b) => new Date(b.transaction_date) - new Date(a.transaction_date) || b.id - a.id
    );
    return { rows: list, rowCount: list.length };
  }

  if (upper.startsWith('INSERT INTO CASH_TRANSACTIONS')) {
    let tx;
    if (upper.includes("'COUNTER SALES'")) {
      const [user_id, amount, payment_method, counterparty_name, description, stock_movement_id] =
        params;
      tx = {
        id: nextId(state.cash_transactions),
        user_id: Number(user_id),
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
      const [user_id, amount, payment_method, counterparty_name, description] = params;
      tx = {
        id: nextId(state.cash_transactions),
        user_id: Number(user_id),
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
    } else if (params.length === 9) {
      const [
        user_id,
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
        user_id: Number(user_id),
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
        user_id,
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
        user_id: Number(user_id),
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

  if (upper.startsWith('DELETE FROM CASH_TRANSACTIONS WHERE ID = $1 AND USER_ID = $2')) {
    const [id, uid] = params;
    const before = state.cash_transactions.length;
    state.cash_transactions = state.cash_transactions.filter(
      (t) => !(Number(t.id) === Number(id) && Number(t.user_id) === Number(uid))
    );
    saveState(state);
    return { rows: [], rowCount: before - state.cash_transactions.length };
  }

  if (upper.startsWith('DELETE FROM CASH_TRANSACTIONS WHERE USER_ID = $1')) {
    const uid = Number(params[0]);
    state.cash_transactions = state.cash_transactions.filter((t) => Number(t.user_id) !== uid);
    saveState(state);
    return { rows: [], rowCount: 1 };
  }

  if (upper.startsWith('SELECT * FROM CREDIT_RECORDS WHERE ID = $1 AND USER_ID = $2')) {
    const [id, uid] = params;
    const found = state.credit_records.find(
      (c) => Number(c.id) === Number(id) && Number(c.user_id) === Number(uid)
    );
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  if (upper.startsWith('SELECT * FROM CREDIT_RECORDS')) {
    const uid = Number(params[0]);
    let list = state.credit_records.filter((c) => Number(c.user_id) === uid);
    if (params[1] && params[1] !== 'ALL') {
      list = list.filter((c) => c.status === params[1]);
    }
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'OWING' ? -1 : 1;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    return { rows: list, rowCount: list.length };
  }

  if (upper.startsWith('INSERT INTO CREDIT_RECORDS')) {
    const [
      user_id,
      customer_name,
      phone,
      items_summary,
      total_amount,
      amount_paid,
      balance_due,
      status,
    ] = params;
    const now = new Date().toISOString();
    const rec = {
      id: nextId(state.credit_records),
      user_id: Number(user_id),
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
    const [amount_paid, balance_due, status, id, uid] = params;
    const rec = state.credit_records.find(
      (c) => Number(c.id) === Number(id) && Number(c.user_id) === Number(uid)
    );
    if (!rec) return { rows: [], rowCount: 0 };
    rec.amount_paid = Number(amount_paid);
    rec.balance_due = Number(balance_due);
    rec.status = status;
    rec.updated_at = new Date().toISOString();
    saveState(state);
    return { rows: [rec], rowCount: 1 };
  }

  if (upper.startsWith('DELETE FROM CREDIT_RECORDS WHERE USER_ID = $1')) {
    const uid = Number(params[0]);
    state.credit_records = state.credit_records.filter((c) => Number(c.user_id) !== uid);
    saveState(state);
    return { rows: [], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

module.exports = {
  query: executeQuery,
  withTransaction: async (fn) => fn({ query: executeQuery }),
};
