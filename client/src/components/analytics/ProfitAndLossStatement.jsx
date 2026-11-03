import React from 'react';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Percent,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '../ui/Badge';

export function ProfitAndLossStatement({
  metrics,
  expenseBreakdown = [],
  channelBreakdown = [],
  dateRangeLabel = 'Selected Period',
  formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`,
}) {
  const {
    salesRevenue = 0,
    cogs = 0,
    grossProfit = 0,
    grossMarginPercent = 0,
    operatingExpenses = 0,
    netOperatingProfit = 0,
    netMarginPercent = 0,
    cashAvailable = 0,
    inventoryCostValue = 0,
  } = metrics || {};

  const isProfitable = netOperatingProfit >= 0;

  return (
    <div className="liquid-glass rounded-3xl p-4 sm:p-5 border theme-divider space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b theme-divider pb-3">
        <div>
          <h3 className="font-extrabold font-luxury text-base sm:text-lg text-theme-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-theme-primary" />
            Retail Profit &amp; Loss Statement (P&amp;L)
          </h3>
          <p className="text-xs text-theme-secondary">
            Period: <span className="font-semibold text-theme-primary">{dateRangeLabel}</span> • Clear audit of revenue, merchandise cost, and operating overheads.
          </p>
        </div>
        <div>
          <Badge variant={isProfitable ? 'success' : 'danger'}>
            {isProfitable ? 'NET PROFITABLE' : 'NET OPERATING LOSS'}
          </Badge>
        </div>
      </div>

      {/* Structured P&L Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-sans">
          <tbody className="divide-y theme-divider">
            {/* 1. REVENUE SECTION */}
            <tr className="bg-theme-input/40">
              <td colSpan={2} className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-amber-500">
                1. Operating Sales Revenue
              </td>
              <td className="py-2.5 px-3 text-right font-bold text-theme-secondary uppercase text-[10px]">
                Subtotal (₦)
              </td>
            </tr>

            {channelBreakdown.length > 0 ? (
              channelBreakdown.map((ch) => (
                <tr key={ch.payment_method} className="hover:bg-white/10 dark:hover:bg-white/5 transition">
                  <td className="py-2 px-3 pl-6 text-theme-secondary flex items-center gap-1.5">
                    <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                    <span>Sales via {ch.label || ch.payment_method}</span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-theme-secondary">
                    {ch.salesCount ? `${ch.salesCount} txns` : ''}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums font-mono font-semibold text-theme-inflow">
                    +{formatNaira(ch.inflow)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-2 px-3 pl-6 text-theme-secondary">Merchandise Counter Sales</td>
                <td className="py-2 px-3 text-right tabular-nums text-theme-secondary"></td>
                <td className="py-2 px-3 text-right tabular-nums font-mono font-semibold text-theme-inflow">
                  +{formatNaira(salesRevenue)}
                </td>
              </tr>
            )}

            <tr className="bg-amber-500/10 font-bold border-t border-amber-500/20">
              <td className="py-2.5 px-3 pl-6 text-amber-500">TOTAL SALES REVENUE (A)</td>
              <td className="py-2.5 px-3 text-right text-theme-secondary">100.0%</td>
              <td className="py-2.5 px-3 text-right font-extrabold font-mono text-amber-500 text-sm tabular-nums">
                {formatNaira(salesRevenue)}
              </td>
            </tr>

            {/* 2. COST OF GOODS SOLD SECTION */}
            <tr className="bg-theme-input/40">
              <td colSpan={2} className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-blue-500">
                2. Cost of Goods Sold (COGS)
              </td>
              <td className="py-2.5 px-3 text-right font-bold text-theme-secondary uppercase text-[10px]">
                Subtotal (₦)
              </td>
            </tr>

            <tr className="hover:bg-white/10 dark:hover:bg-white/5 transition">
              <td className="py-2 px-3 pl-6 text-theme-secondary">
                Wholesale Acquisition Cost of Sold Stock
              </td>
              <td className="py-2 px-3 text-right text-theme-secondary font-mono">
                {salesRevenue > 0 ? `${((cogs / salesRevenue) * 100).toFixed(1)}%` : '0%'}
              </td>
              <td className="py-2 px-3 text-right tabular-nums font-mono font-semibold text-theme-outflow">
                -{formatNaira(cogs)}
              </td>
            </tr>

            <tr className="bg-blue-500/10 font-bold border-t border-blue-500/20">
              <td className="py-2.5 px-3 pl-6 text-blue-500">
                = GROSS OPERATING PROFIT (A - B)
              </td>
              <td className="py-2.5 px-3 text-right text-blue-400 font-bold">
                {grossMarginPercent.toFixed(1)}% Margin
              </td>
              <td className="py-2.5 px-3 text-right font-extrabold font-mono text-blue-500 text-sm tabular-nums">
                {formatNaira(grossProfit)}
              </td>
            </tr>

            {/* 3. OPERATING EXPENSES SECTION */}
            <tr className="bg-theme-input/40">
              <td colSpan={2} className="py-2.5 px-3 font-extrabold uppercase tracking-wider text-rose-500">
                3. Operating Shop Expenses (Overheads)
              </td>
              <td className="py-2.5 px-3 text-right font-bold text-theme-secondary uppercase text-[10px]">
                Subtotal (₦)
              </td>
            </tr>

            {expenseBreakdown.length > 0 ? (
              expenseBreakdown.map((exp) => (
                <tr key={exp.category} className="hover:bg-white/10 dark:hover:bg-white/5 transition">
                  <td className="py-2 px-3 pl-6 text-theme-secondary flex items-center gap-1.5">
                    <ArrowDownRight className="w-3 h-3 text-rose-500" />
                    <span>{exp.category}</span>
                  </td>
                  <td className="py-2 px-3 text-right text-theme-secondary font-mono">
                    {salesRevenue > 0 ? `${((exp.amount / salesRevenue) * 100).toFixed(1)}%` : ''}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums font-mono font-semibold text-rose-500">
                    -{formatNaira(exp.amount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-2 px-3 pl-6 text-theme-secondary">Shop running overheads</td>
                <td className="py-2 px-3 text-right text-theme-secondary"></td>
                <td className="py-2 px-3 text-right tabular-nums font-mono font-semibold text-rose-500">
                  -{formatNaira(operatingExpenses)}
                </td>
              </tr>
            )}

            <tr className="bg-rose-500/10 font-bold border-t border-rose-500/20">
              <td className="py-2.5 px-3 pl-6 text-rose-500">TOTAL OPERATING EXPENSES (C)</td>
              <td className="py-2.5 px-3 text-right text-theme-secondary font-mono">
                {salesRevenue > 0 ? `${((operatingExpenses / salesRevenue) * 100).toFixed(1)}%` : '0%'}
              </td>
              <td className="py-2.5 px-3 text-right font-extrabold font-mono text-rose-500 text-sm tabular-nums">
                -{formatNaira(operatingExpenses)}
              </td>
            </tr>

            {/* 4. NET OPERATING PROFIT (THE BOTTOM LINE) */}
            <tr
              className={`font-black text-sm border-t-2 ${
                isProfitable
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500'
              }`}
            >
              <td className="py-3.5 px-3 pl-6 font-luxury uppercase tracking-wider">
                = NET OPERATING PROFIT / (LOSS) (Gross Profit - Expenses)
              </td>
              <td className="py-3.5 px-3 text-right font-mono font-bold">
                {netMarginPercent >= 0 ? `+${netMarginPercent.toFixed(1)}%` : `${netMarginPercent.toFixed(1)}%`}
              </td>
              <td className="py-3.5 px-3 text-right font-mono font-extrabold text-base sm:text-lg tabular-nums">
                {isProfitable ? `+${formatNaira(netOperatingProfit)}` : formatNaira(netOperatingProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Balance Sheet / Context Footer: Liquid Cash & Stock Asset */}
      <div className="p-3.5 rounded-2xl bg-theme-input/40 border theme-divider grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-theme-bg/60 border theme-divider">
          <div>
            <span className="text-[10px] text-theme-muted uppercase font-bold block">
              Liquid Cash Position (Drawer + Bank)
            </span>
            <span className="text-sm font-extrabold font-mono text-sky-400">
              {formatNaira(cashAvailable)}
            </span>
          </div>
          <Badge variant="neutral">Not Profit</Badge>
        </div>

        <div className="flex items-center justify-between p-2.5 rounded-xl bg-theme-bg/60 border theme-divider">
          <div>
            <span className="text-[10px] text-theme-muted uppercase font-bold block">
              Inventory Cost Capital (On Shelves)
            </span>
            <span className="text-sm font-extrabold font-mono text-indigo-400">
              {formatNaira(inventoryCostValue)}
            </span>
          </div>
          <Badge variant="info">Physical Asset</Badge>
        </div>
      </div>
    </div>
  );
}
