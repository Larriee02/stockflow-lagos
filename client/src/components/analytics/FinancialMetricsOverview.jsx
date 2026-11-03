import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Wallet,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Banknote,
  CreditCard,
  Building,
  Scale,
  Receipt,
  PieChart,
} from 'lucide-react';
import { Badge } from '../ui/Badge';

export function FinancialMetricsOverview({
  metrics,
  formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`,
  dateRangeLabel = 'Selected Period',
  onOpenReconcile,
}) {
  const [showGuide, setShowGuide] = useState(false);

  const {
    salesRevenue = 0,
    cogs = 0,
    grossProfit = 0,
    grossMarginPercent = 0,
    operatingExpenses = 0,
    netOperatingProfit = 0,
    netMarginPercent = 0,
    cashAvailable = 0,
    cashInDrawer = 0,
    posBalance = 0,
    bankBalance = 0,
    inventoryCostValue = 0,
    inventoryRetailValue = 0,
    unrealizedMargin = 0,
    salesCount = 0,
    expenseCount = 0,
  } = metrics || {};

  const isProfitable = netOperatingProfit >= 0;

  return (
    <div className="space-y-4">
      {/* Educational Clarification Banner / Toggle */}
      <div className="rounded-2xl border border-sky-500/30 bg-sky-950/15 dark:bg-sky-950/30 p-4 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-extrabold font-luxury text-theme-primary">
                  Retail Financial Rule: Revenue ≠ Profit ≠ Cash Available
                </h4>
                <Badge variant="info">Essential Accounting</Badge>
              </div>
              <p className="text-xs text-theme-secondary mt-0.5">
                In retail management, confusing cash in hand with profit is the #1 reason shop owners run out of stock capital.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {onOpenReconcile && (
              <button
                type="button"
                onClick={onOpenReconcile}
                className="liquid-btn-primary px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Scale className="w-3.5 h-3.5" /> Reconcile Today&apos;s Cash & POS
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showGuide ? 'Hide Guide' : 'Why These Differ'}</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Explainer Grid */}
        {showGuide && (
          <div className="mt-4 pt-3.5 border-t border-sky-500/20 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed text-theme-secondary animate-in fade-in duration-200">
            <div className="p-3 rounded-xl bg-theme-input/40 border border-theme-border/50 space-y-1">
              <div className="font-extrabold text-theme-primary flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-500" />
                1. Revenue vs. Gross Profit
              </div>
              <p className="text-[11px]">
                <strong className="text-theme-primary">Revenue</strong> is total sales money collected. But goods have a wholesale cost (<strong className="text-theme-primary">COGS</strong>). <strong className="text-theme-primary">Gross Profit</strong> is only what remains after subtracting the cost to buy the goods.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-theme-input/40 border border-theme-border/50 space-y-1">
              <div className="font-extrabold text-theme-primary flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                2. Gross Profit vs. Net Profit
              </div>
              <p className="text-[11px]">
                Gross profit hasn&apos;t paid for your generator petrol, shop rent, staff wages, or market dues. <strong className="text-theme-primary">Net Operating Profit</strong> is your true take-home earnings after paying all store running costs.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-theme-input/40 border border-theme-border/50 space-y-1">
              <div className="font-extrabold text-theme-primary flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-sky-400" />
                3. Cash Available vs. Inventory Value
              </div>
              <p className="text-[11px]">
                <strong className="text-theme-primary">Cash Available</strong> is liquid money in your drawer & POS accounts today. <strong className="text-theme-primary">Inventory Value</strong> is working capital locked inside goods on shelves that you cannot spend until sold.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 6 Core Financial Metric Cards (Distinct Categories) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* METRIC 1: SALES REVENUE */}
        <div className="liquid-glass rounded-3xl p-4 sm:p-5 border theme-divider space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> 1. Sales Revenue
            </span>
            <Badge variant="warning">Topline Income</Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-luxury text-theme-primary tabular-nums tracking-tight">
              {formatNaira(salesRevenue)}
            </div>
            <div className="text-xs text-theme-secondary mt-1 flex items-center gap-1">
              <span>{salesCount} sales completed in {dateRangeLabel.toLowerCase()}</span>
            </div>
          </div>
          <div className="pt-2 border-t theme-divider text-[11px] text-theme-muted flex items-center justify-between">
            <span>Wholesale Cost (COGS):</span>
            <span className="font-mono text-theme-secondary">-{formatNaira(cogs)}</span>
          </div>
        </div>

        {/* METRIC 2: GROSS PROFIT */}
        <div className="liquid-glass rounded-3xl p-4 sm:p-5 border theme-divider space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> 2. Gross Profit
            </span>
            <Badge variant="info">{grossMarginPercent.toFixed(1)}% Margin</Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-luxury text-theme-primary tabular-nums tracking-tight">
              {formatNaira(grossProfit)}
            </div>
            <div className="text-xs text-theme-secondary mt-1">
              Revenue minus wholesale product cost (COGS)
            </div>
          </div>
          <div className="pt-2 border-t theme-divider text-[11px] text-theme-muted flex items-center justify-between">
            <span>Product Markup:</span>
            <span className="font-mono text-blue-400 font-bold">
              {salesRevenue > 0 ? `${((grossProfit / (cogs || 1)) * 100).toFixed(1)}% Markup` : '0%'}
            </span>
          </div>
        </div>

        {/* METRIC 3: OPERATING EXPENSES */}
        <div className="liquid-glass rounded-3xl p-4 sm:p-5 border theme-divider space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" /> 3. Operating Expenses
            </span>
            <Badge variant="danger">{expenseCount} Expenses</Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-luxury text-theme-outflow tabular-nums tracking-tight">
              {formatNaira(operatingExpenses)}
            </div>
            <div className="text-xs text-theme-secondary mt-1">
              Shop rent, generator fuel, NEPA, wages & levies
            </div>
          </div>
          <div className="pt-2 border-t theme-divider text-[11px] text-theme-muted flex items-center justify-between">
            <span>Expense-to-Revenue Ratio:</span>
            <span className="font-mono text-theme-secondary">
              {salesRevenue > 0 ? `${((operatingExpenses / salesRevenue) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>
        </div>

        {/* METRIC 4: NET OPERATING PROFIT (THE REAL BOTTOM LINE) */}
        <div
          className={`liquid-glass rounded-3xl p-4 sm:p-5 border space-y-3 relative overflow-hidden shadow-lg ${
            isProfitable
              ? 'border-emerald-500/40 bg-emerald-950/10'
              : 'border-rose-500/40 bg-rose-950/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isProfitable ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {isProfitable ? <Sparkles className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              4. Net Operating Profit
            </span>
            <Badge variant={isProfitable ? 'success' : 'danger'}>
              {netMarginPercent >= 0 ? `+${netMarginPercent.toFixed(1)}% Net` : `${netMarginPercent.toFixed(1)}% Net`}
            </Badge>
          </div>
          <div>
            <div
              className={`text-2xl sm:text-3xl font-black font-luxury tabular-nums tracking-tight ${
                isProfitable ? 'text-theme-inflow' : 'text-theme-outflow'
              }`}
            >
              {isProfitable ? `+${formatNaira(netOperatingProfit)}` : formatNaira(netOperatingProfit)}
            </div>
            <div className="text-xs text-theme-secondary mt-1">
              Gross profit minus all operating shop expenses
            </div>
          </div>
          <div className="pt-2 border-t theme-divider text-[11px] text-theme-muted flex items-center justify-between">
            <span>Status:</span>
            <span className={`font-bold ${isProfitable ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isProfitable ? 'Profitable Period ✨' : 'Operating at a Loss ⚠️'}
            </span>
          </div>
        </div>

        {/* METRIC 5: CASH AVAILABLE (LIQUID MONEY) */}
        <div className="liquid-glass rounded-3xl p-4 sm:p-5 border theme-divider space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-500 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> 5. Cash Available
            </span>
            <Badge variant="neutral">Liquid Asset</Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-luxury text-theme-primary tabular-nums tracking-tight">
              {formatNaira(cashAvailable)}
            </div>
            <div className="text-xs text-theme-secondary mt-1">
              Physical cash float + POS accounts right now
            </div>
          </div>
          <div className="pt-2 border-t theme-divider text-[10px] text-theme-secondary grid grid-cols-3 gap-1 text-center font-mono">
            <div>
              <span className="text-theme-muted block">Drawer:</span>
              <span className="font-bold">{formatNaira(cashInDrawer)}</span>
            </div>
            <div>
              <span className="text-theme-muted block">POS:</span>
              <span className="font-bold">{formatNaira(posBalance)}</span>
            </div>
            <div>
              <span className="text-theme-muted block">Bank:</span>
              <span className="font-bold">{formatNaira(bankBalance)}</span>
            </div>
          </div>
        </div>

        {/* METRIC 6: INVENTORY VALUE (STOCK ASSET) */}
        <div className="liquid-glass rounded-3xl p-4 sm:p-5 border theme-divider space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> 6. Inventory Value
            </span>
            <Badge variant="info">Physical Asset</Badge>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black font-luxury text-theme-primary tabular-nums tracking-tight">
              {formatNaira(inventoryCostValue)}
            </div>
            <div className="text-xs text-theme-secondary mt-1">
              Wholesale capital locked in shelf goods
            </div>
          </div>
          <div className="pt-2 border-t theme-divider text-[11px] text-theme-muted flex items-center justify-between">
            <span>Retail Valuation:</span>
            <span className="font-mono text-emerald-500 font-bold">
              {formatNaira(inventoryRetailValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
