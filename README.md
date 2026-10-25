# StockFlow Pro — Retail Inventory, Stock-Taking & Cashflow Management Platform

A production-grade full-stack MVP built with **React 18 + Tailwind CSS**, **Node.js + Express**, and **PostgreSQL**.

## Applied Engineering Principles (Prompts #1–#8)

1. **Prompt #1 (Startup Engineering Team)** & **Prompt #6 (Startup Backend Architect)**:
   - Designed a layered architecture (`Controller -> Service -> Repository -> PostgreSQL`) with versioned REST endpoints (`/api/v1/*`), read-through TTL caching (`cache.service.js`), and dual-mode PostgreSQL connectivity (`pg.Pool` for external PostgreSQL 18 + automatic persistent `@electric-sql/pglite` fallback).
2. **Prompt #2 (Senior Codebase Audit)** & **Prompt #5 (Clean Architecture Refactoring)**:
   - Separated HTTP transport (`app.js`), domain orchestration (`inventory.service.js`, `cashbook.service.js`), data access (`inventory.repository.js`, `cashbook.repository.js`), and cross-cutting concerns (`AppError.js`, `money.js`, `cache.service.js`).
3. **Prompt #3 (Production Debugging Expert)**:
   - **Floating-Point Drift Fix**: Replaced naive float multiplication with integer-cent arithmetic (`money.js`) and PostgreSQL `NUMERIC(14,2)`.
   - **Concurrent Checkout Race Condition Fix**: Used `SELECT ... FOR UPDATE` row locking inside ACID transactions (`BEGIN ... COMMIT`) plus `CHECK (stock_quantity >= 0)` constraints.
   - **Network Retry Double-Submission Fix**: Implemented `Idempotency-Key` deduplication on stock movements and cash transactions.
4. **Prompt #4 (Performance Optimization Engineer)**:
   - Consolidated dashboard KPI queries into a single PostgreSQL CTE query with a 30-second read-through cache and automatic write invalidation.
   - Added partial & composite PostgreSQL indexes (`idx_products_low_stock`, `idx_cash_tx_type_date`).
   - Added `useDebounce` for SKU search, `useMemo` for filtered product/category computation, and `AbortController` cleanup.
5. **Prompt #7 (Senior Frontend Engineer)**:
   - Created reusable, accessible UI components (`Modal.jsx` with `Escape` & `aria-modal`, `StatCard.jsx` with skeleton loader, `Badge.jsx`, `EmptyState.jsx`).
6. **Prompt #8 (Technical Lead Mode — 5-Year Maintainability & Tradeoffs)**:
   - Prioritized a modular monolith with strict ACID relational integrity over premature microservices so inventory counts and cash ledgers can never drift out of sync.

---

## Running Locally

### 1. Start the Backend API (Port 5000)
```powershell
cd server
npm install
npm run start
```
*(By default, if `DATABASE_URL` is not set in `server/.env`, the server automatically initializes a persistent PostgreSQL database in `server/pgdata` using `database/schema.sql`. To use your external PostgreSQL 18 server, uncomment `DATABASE_URL` in `server/.env`.)*

### 2. Start the Frontend Client (Port 5173)
```powershell
cd client
npm install
npm run dev
```
