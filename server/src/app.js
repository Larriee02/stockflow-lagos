const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const env = require('./config/env');
const db = require('./config/db');
const AppError = require('./utils/AppError');
const { isOwnerEmail } = require('./config/owner');
const { verifySession, issueSessionCookie, clearSessionCookie, readToken } = require('./utils/session');
const userRepo = require('./repositories/user.repository');
const authService = require('./services/auth.service');
const adminService = require('./services/admin.service');
const inventoryService = require('./services/inventory.service');
const cashbookService = require('./services/cashbook.service');

const { createRateLimiter } = require('./utils/rateLimiter');

const app = express();

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (env.IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Rate limiters for authentication & OTP security
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many authentication attempts.',
});

const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many OTP requests from this connection.',
});

// Configurable CORS
app.use(
  cors(
    env.ALLOWED_ORIGIN
      ? {
          origin: env.ALLOWED_ORIGIN.split(',').map((o) => o.trim()),
          credentials: true,
        }
      : { origin: true, credentials: true }
  )
);

app.use(express.json({ limit: '200kb' }));

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;

/* ---------------------------- Authentication Middlewares ---------------------------- */

const requireAuth = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) {
    throw new AppError('Please sign in to continue.', 401, 'UNAUTHENTICATED');
  }
  let decoded;
  try {
    decoded = await verifySession(token);
  } catch {
    throw new AppError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED');
  }

  const authUser = await userRepo.findAuthById(decoded.userId);
  if (!authUser || Number(authUser.token_version || 0) !== decoded.tokenVersion) {
    throw new AppError('Your session is no longer valid. Please sign in again.', 401, 'SESSION_REVOKED');
  }

  req.user = await userRepo.findPublicById(authUser.id);
  next();
});

const requireApprovedUser = [
  requireAuth,
  (req, res, next) => {
    if (req.user.role === 'ADMIN' && isOwnerEmail(req.user.email)) return next();
    if (req.user.status === 'PENDING') {
      return next(
        new AppError(
          'Your account is awaiting administrator approval.',
          403,
          'ACCOUNT_PENDING'
        )
      );
    }
    if (req.user.status === 'SUSPENDED') {
      return next(
        new AppError(
          'Your account has been suspended by an administrator.',
          403,
          'ACCOUNT_SUSPENDED'
        )
      );
    }
    if (req.user.status === 'REJECTED') {
      return next(
        new AppError(
          'Your registration request was declined by an administrator.',
          403,
          'ACCOUNT_REJECTED'
        )
      );
    }
    next();
  },
];

const requireAdmin = [
  requireAuth,
  (req, res, next) => {
    // Only the single platform owner account may access the admin console.
    if (
      req.user.role !== 'ADMIN' ||
      req.user.status !== 'APPROVED' ||
      !isOwnerEmail(req.user.email)
    ) {
      return next(new AppError('Administrator privileges required.', 403, 'FORBIDDEN_ADMIN'));
    }
    next();
  },
];

/* ---------------------------------- Health & Config ---------------------------------- */

app.get(
  '/api/v1/health',
  asyncHandler(async (req, res) => {
    await db.ready();
    res.json({
      status: 'ok',
      dbMode: db.mode,
      timestamp: new Date().toISOString(),
    });
  })
);

app.get('/api/v1/auth/config', (req, res) => {
  res.json(authService.getPublicConfig());
});

/* ----------------------------------- Auth Endpoints ----------------------------------- */

app.post(
  '/api/v1/auth/otp/request',
  otpLimiter,
  asyncHandler(async (req, res) => {
    const { purpose } = req.body;
    if (String(purpose).toUpperCase() === 'SIGNUP') {
      const result = await authService.requestSignupOtp(req.body);
      return res.json(result);
    }
    const result = await authService.requestLoginOtp(req.body);
    res.json(result);
  })
);

app.post(
  '/api/v1/auth/otp/verify',
  authLimiter,
  asyncHandler(async (req, res) => {
    const otpService = require('./services/otp.service');
    const result = await otpService.verifyOtp(req.body);
    res.json(result);
  })
);

app.post(
  '/api/v1/auth/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { user, token } = await authService.register(req.body, clientIp(req));
    await issueSessionCookie(res, { id: user.id, token_version: 0 });
    res.status(201).json({ user, token });
  })
);

app.post(
  '/api/v1/auth/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body, clientIp(req));
    if (result.otpRequired) {
      return res.json(result);
    }
    const authUser = await userRepo.findAuthById(result.user.id);
    await issueSessionCookie(res, authUser);
    res.json({ user: result.user, token: result.token });
  })
);

app.post(
  '/api/v1/auth/oauth',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { user, token, isNewUser } = await authService.oauthSignIn(req.body, clientIp(req));
    const authUser = await userRepo.findAuthById(user.id);
    await issueSessionCookie(res, authUser);
    res.status(isNewUser ? 201 : 200).json({ user, token, isNewUser });
  })
);

app.post('/api/v1/auth/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ loggedOut: true });
});

app.get('/api/v1/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.put(
  '/api/v1/auth/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user.id, req.body);
    res.json({ user });
  })
);

app.post(
  '/api/v1/auth/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.changePassword(req.user.id, req.body, clientIp(req));
    res.json({ user });
  })
);

/* ------------------------------ Admin Control Endpoints ------------------------------ */

app.get(
  '/api/v1/admin/overview',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const overview = await adminService.getOverview();
    res.json(overview);
  })
);

app.get(
  '/api/v1/admin/users',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await adminService.listUsers(req.query);
    res.json(data);
  })
);

app.get(
  '/api/v1/admin/users/export',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const users = await adminService.exportUsers();
    res.json({ users });
  })
);

app.get(
  '/api/v1/admin/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const detail = await adminService.getUserDetail(req.params.id);
    res.json(detail);
  })
);

app.patch(
  '/api/v1/admin/users/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const updated = await adminService.updateUserStatus(
      req.user.id,
      req.params.id,
      req.body,
      clientIp(req)
    );
    res.json({ user: updated });
  })
);

app.post(
  '/api/v1/admin/users/bulk-status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await adminService.bulkUpdateStatus(req.user.id, req.body, clientIp(req));
    res.json(result);
  })
);

app.patch(
  '/api/v1/admin/users/:id/role',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const updated = await adminService.updateUserRole(
      req.user.id,
      req.params.id,
      req.body,
      clientIp(req)
    );
    res.json({ user: updated });
  })
);

app.patch(
  '/api/v1/admin/users/:id/note',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const updated = await adminService.updateAdminNote(
      req.user.id,
      req.params.id,
      req.body,
      clientIp(req)
    );
    res.json({ user: updated });
  })
);

app.post(
  '/api/v1/admin/users/:id/reset-password',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await adminService.resetUserPassword(
      req.user.id,
      req.params.id,
      req.body,
      clientIp(req)
    );
    res.json(result);
  })
);

app.delete(
  '/api/v1/admin/users/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const result = await adminService.deleteUser(req.user.id, req.params.id, clientIp(req));
    res.json(result);
  })
);

app.get(
  '/api/v1/admin/audit-logs',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const data = await adminService.getAuditLogs(req.query);
    res.json(data);
  })
);

/* ------------------------- Multi-Tenant Store Endpoints ------------------------- */

app.get(
  '/api/v1/dashboard',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const summary = await cashbookService.getDashboardSummary(req.user.id);
    res.json(summary);
  })
);

app.get(
  '/api/v1/products',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const products = await inventoryService.getProducts(req.user.id, req.query);
    res.json(products);
  })
);

app.post(
  '/api/v1/products',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const product = await inventoryService.createProduct(req.user.id, req.body);
    res.status(201).json(product);
  })
);

app.post(
  '/api/v1/products/seed-starter',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const products = await inventoryService.seedStarterProducts(req.user.id);
    res.status(201).json(products);
  })
);

app.put(
  '/api/v1/products/:id',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const product = await inventoryService.updateProduct(req.user.id, req.params.id, req.body);
    res.json(product);
  })
);

app.delete(
  '/api/v1/products/:id',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await inventoryService.deleteProduct(req.user.id, req.params.id);
    res.json(result);
  })
);

app.post(
  '/api/v1/sales/checkout',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await inventoryService.checkoutCart(req.user.id, req.body);
    res.status(201).json(result);
  })
);

app.post(
  '/api/v1/inventory/movements',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key;
    const result = await inventoryService.recordMovement(req.user.id, {
      ...req.body,
      idempotency_key: idempotencyKey,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

app.get(
  '/api/v1/inventory/movements',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const movements = await inventoryService.getRecentMovements(req.user.id, req.query.limit);
    res.json(movements);
  })
);

app.post(
  '/api/v1/inventory/bulk-import',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await inventoryService.bulkImportProducts(req.user.id, req.body);
    res.status(200).json(result);
  })
);

app.post(
  '/api/v1/inventory/batch-adjust',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await inventoryService.batchStockAdjustment(req.user.id, req.body);
    res.status(200).json(result);
  })
);

app.post(
  '/api/v1/inventory/stock-count',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await inventoryService.batchPhysicalStockCount(req.user.id, req.body);
    res.status(200).json(result);
  })
);

app.get(
  '/api/v1/transactions',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const transactions = await cashbookService.getTransactions(req.user.id, req.query);
    res.json(transactions);
  })
);

app.post(
  '/api/v1/transactions',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const tx = await cashbookService.recordTransaction(req.user.id, req.body);
    res.status(201).json(tx);
  })
);

app.post(
  '/api/v1/transactions/:id/correct',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await cashbookService.correctTransaction(
      req.user.id,
      req.params.id,
      req.body
    );
    res.json(result);
  })
);

app.delete(
  '/api/v1/transactions/:id',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await cashbookService.deleteTransaction(
      req.user.id,
      req.params.id,
      req.body?.reason
    );
    res.json(result);
  })
);

app.get(
  '/api/v1/cashbook/sessions',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const data = await cashbookService.getCashbookSessions(req.user.id, req.query);
    res.json(data);
  })
);

app.post(
  '/api/v1/cashbook/sessions/open',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const session = await cashbookService.openCashbookSession(req.user.id, req.body);
    res.json(session);
  })
);

app.post(
  '/api/v1/cashbook/sessions/close',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const session = await cashbookService.closeCashbookSession(req.user.id, req.body);
    res.json(session);
  })
);

app.get(
  '/api/v1/credits',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const credits = await cashbookService.getCredits(req.user.id, req.query);
    res.json(credits);
  })
);

app.get(
  '/api/v1/credits/customers',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const ledgers = await cashbookService.getCustomerLedgers(req.user.id);
    res.json(ledgers);
  })
);

app.get(
  '/api/v1/credits/customers/:name/statement',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const statement = await cashbookService.getCustomerStatement(req.user.id, req.params.name);
    res.json(statement);
  })
);

app.post(
  '/api/v1/credits/customers/:name/repay',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await cashbookService.repayCustomerDebt(req.user.id, req.params.name, req.body);
    res.json(result);
  })
);

app.post(
  '/api/v1/credits',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const credit = await cashbookService.createCredit(req.user.id, req.body);
    res.status(201).json(credit);
  })
);

app.post(
  '/api/v1/credits/:id/repay',
  requireApprovedUser,
  asyncHandler(async (req, res) => {
    const result = await cashbookService.repayCredit(req.user.id, req.params.id, req.body);
    res.json(result);
  })
);

// Serve Production Frontend Build (dist or client/dist) automatically when present
const rootDistPath = path.join(__dirname, '../../dist');
const clientDistPath = fs.existsSync(path.join(rootDistPath, 'index.html'))
  ? rootDistPath
  : path.join(__dirname, '../../client/dist');
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
      error: 'A record with this code or email already exists.',
      code: 'DUPLICATE_RECORD',
    });
  }
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.isOperational ? err.message : 'Something went wrong. Please try again.',
    code: err.code || 'INTERNAL_ERROR',
  });
});

const PORT = env.PORT || 5000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`StockFlow Lagos SaaS API v1 running on http://localhost:${PORT}`);
  });
}

module.exports = app;
