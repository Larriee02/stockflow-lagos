const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const inventoryService = require('./services/inventory.service');
const cashbookService = require('./services/cashbook.service');
require('dotenv').config();

const app = express();

// Production Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Configurable CORS (restricts to ALLOWED_ORIGIN in production if set)
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(
  cors(
    allowedOrigin
      ? { origin: allowedOrigin.split(',').map((o) => o.trim()), credentials: true }
      : undefined
  )
);

app.use(express.json({ limit: '100kb' }));

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Health Check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard Summary
app.get(
  '/api/v1/dashboard',
  asyncHandler(async (req, res) => {
    const summary = await cashbookService.getDashboardSummary();
    res.json(summary);
  })
);

// Products CRUD
app.get(
  '/api/v1/products',
  asyncHandler(async (req, res) => {
    const products = await inventoryService.getProducts(req.query);
    res.json(products);
  })
);

app.post(
  '/api/v1/products',
  asyncHandler(async (req, res) => {
    const product = await inventoryService.createProduct(req.body);
    res.status(201).json(product);
  })
);

app.put(
  '/api/v1/products/:id',
  asyncHandler(async (req, res) => {
    const product = await inventoryService.updateProduct(req.params.id, req.body);
    res.json(product);
  })
);

// Fast Multi-Item Shop Counter Checkout
app.post(
  '/api/v1/sales/checkout',
  asyncHandler(async (req, res) => {
    const result = await inventoryService.checkoutCart(req.body);
    res.status(201).json(result);
  })
);

// Single Item Stock Movement (Market Restock, Shelf Count, Damaged Goods)
app.post(
  '/api/v1/inventory/movements',
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key;
    const result = await inventoryService.recordMovement({
      ...req.body,
      idempotency_key: idempotencyKey,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

app.get(
  '/api/v1/inventory/movements',
  asyncHandler(async (req, res) => {
    const movements = await inventoryService.getRecentMovements(req.query.limit);
    res.json(movements);
  })
);

// Cashbook Inflow & Outflow Ledger
app.get(
  '/api/v1/transactions',
  asyncHandler(async (req, res) => {
    const transactions = await cashbookService.getTransactions(req.query);
    res.json(transactions);
  })
);

app.post(
  '/api/v1/transactions',
  asyncHandler(async (req, res) => {
    const tx = await cashbookService.recordTransaction(req.body);
    res.status(201).json(tx);
  })
);

app.delete(
  '/api/v1/transactions/:id',
  asyncHandler(async (req, res) => {
    const result = await cashbookService.deleteTransaction(req.params.id);
    res.json(result);
  })
);

// Credit / Debtors Book Routes ("Who Owes Me")
app.get(
  '/api/v1/credits',
  asyncHandler(async (req, res) => {
    const credits = await cashbookService.getCredits(req.query);
    res.json(credits);
  })
);

app.post(
  '/api/v1/credits',
  asyncHandler(async (req, res) => {
    const credit = await cashbookService.createCredit(req.body);
    res.status(201).json(credit);
  })
);

app.post(
  '/api/v1/credits/:id/repay',
  asyncHandler(async (req, res) => {
    const result = await cashbookService.repayCredit(req.params.id, req.body);
    res.json(result);
  })
);

// Serve Production Frontend Build (client/dist) automatically when present
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[API Error]:', err.message);
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'A product with this code already exists.',
      code: 'DUPLICATE_RECORD',
    });
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.isOperational ? err.message : 'Something went wrong. Please try again.',
    code: err.code || 'INTERNAL_ERROR',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`StockFlow Lagos API v1 running on http://localhost:${PORT}`);
});
