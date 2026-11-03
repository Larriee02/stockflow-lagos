import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const REASON_OPTIONS = [
  { id: 'DAMAGED', label: 'Damaged / Broken / Spilled' },
  { id: 'EXPIRED', label: 'Expired (Past Date)' },
  { id: 'MISSING', label: 'Missing / Untracked Loss' },
  { id: 'SURPLUS', label: 'Surplus (Found Extra)' },
  { id: 'ADJUSTMENT', label: 'General Recount / Adjustment' },
];

/**
 * Physical Stock Count / Audit Workflow Modal
 *
 * Compares system expected inventory against physical counted quantities on shelves,
 * highlights variances, tags loss reasons (damaged, expired, missing, surplus),
 * and reconciles the store inventory in one atomic operation.
 */
export function PhysicalStockAuditModal({
  isOpen,
  onClose,
  products = [],
  apiFetch,
  formatCurrency,
  toastSuccess,
  toastError,
  onReconcileSuccess,
}) {
  const [counts, setCounts] = useState({}); // { [productId]: { actual_count: number|string, reason: string, note: string } }
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [auditNote, setAuditNote] = useState('Weekly Physical Shelf Audit');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'Provisions'));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (category !== 'ALL' && p.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchSku = (p.sku || '').toLowerCase().includes(q);
        if (!matchName && !matchSku) return false;
      }
      return true;
    });
  }, [products, category, search]);

  const handleSetActualCount = (productId, val) => {
    setCounts((prev) => {
      const existing = prev[productId] || {};
      return {
        ...prev,
        [productId]: {
          ...existing,
          actual_count: val,
        },
      };
    });
  };

  const handleSetReason = (productId, reason) => {
    setCounts((prev) => {
      const existing = prev[productId] || {};
      return {
        ...prev,
        [productId]: {
          ...existing,
          reason,
        },
      };
    });
  };

  // Prefill all physical counts with current expected stock for rapid audits
  const handlePrefillExpected = () => {
    const next = {};
    for (const p of products) {
      next[p.id] = {
        actual_count: Number(p.stock_quantity),
        reason: 'ADJUSTMENT',
        note: '',
      };
    }
    setCounts(next);
  };

  const handleClearAll = () => {
    setCounts({});
  };

  // Summary Metrics
  const auditSummary = useMemo(() => {
    let auditedCount = 0;
    let balancedCount = 0;
    let discrepancyCount = 0;
    let netVarianceValue = 0;

    for (const p of products) {
      const item = counts[p.id];
      if (item && item.actual_count !== '' && item.actual_count !== undefined) {
        auditedCount++;
        const actual = Number(item.actual_count);
        const expected = Number(p.stock_quantity);
        const diff = actual - expected;
        const valDiff = diff * Number(p.cost_price || 0);
        netVarianceValue += valDiff;

        if (diff === 0) {
          balancedCount++;
        } else {
          discrepancyCount++;
        }
      }
    }

    return {
      auditedCount,
      balancedCount,
      discrepancyCount,
      netVarianceValue,
    };
  }, [products, counts]);

  const handleSaveAudit = async () => {
    const payloadCounts = [];

    for (const p of products) {
      const item = counts[p.id];
      if (item && item.actual_count !== '' && !Number.isNaN(Number(item.actual_count))) {
        const actual = Number(item.actual_count);
        const expected = Number(p.stock_quantity);
        const diff = actual - expected;

        let autoReason = item.reason || (diff > 0 ? 'SURPLUS' : 'MISSING');
        if (diff === 0) autoReason = 'ADJUSTMENT';

        payloadCounts.push({
          product_id: p.id,
          actual_count: actual,
          reason: autoReason,
          note: item.note || auditNote,
        });
      }
    }

    if (payloadCounts.length === 0) {
      toastError?.('Please enter physical counts for at least one product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/inventory/stock-count', {
        method: 'POST',
        body: JSON.stringify({
          counts: payloadCounts,
          auditNote,
        }),
      });

      toastSuccess?.(
        `Audit saved! Reconciled ${res.totalAudited} items (${res.discrepancyCount} discrepancy movements logged).`
      );
      onReconcileSuccess?.();
      onClose();
    } catch (err) {
      toastError?.(err.message || 'Failed to reconcile stock count.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Physical Stock Count & Shelf Audit"
      subtitle="Compare system expected stock against actual physical counts on shelves and log variances"
    >
      <div className="space-y-4">
        {/* Audit Controls & Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="liquid-glass p-3 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-theme-secondary">
              Items Audited
            </p>
            <p className="text-base font-extrabold font-luxury text-theme-primary mt-0.5">
              {auditSummary.auditedCount} / {products.length}
            </p>
          </div>

          <div className="liquid-glass p-3 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-theme-inflow">
              In Balance (0 Diff)
            </p>
            <p className="text-base font-extrabold font-luxury text-theme-inflow mt-0.5">
              {auditSummary.balancedCount}
            </p>
          </div>

          <div className="liquid-glass p-3 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-theme-outflow">
              Discrepancies
            </p>
            <p className="text-base font-extrabold font-luxury text-theme-outflow mt-0.5">
              {auditSummary.discrepancyCount}
            </p>
          </div>

          <div className="liquid-glass p-3 rounded-2xl">
            <p className="text-[10px] font-bold uppercase tracking-wider text-theme-secondary">
              Net Value Variance
            </p>
            <p
              className={`text-base font-extrabold font-luxury mt-0.5 tabular-nums ${
                auditSummary.netVarianceValue >= 0
                  ? 'text-theme-inflow'
                  : 'text-theme-outflow'
              }`}
            >
              {auditSummary.netVarianceValue >= 0 ? '+' : ''}
              {formatCurrency(auditSummary.netVarianceValue)}
            </p>
          </div>
        </div>

        {/* Filters & Rapid Tools */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b theme-divider">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
              <input
                type="text"
                placeholder="Search goods..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="liquid-input w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
              />
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="liquid-input text-xs rounded-xl px-2.5 py-1.5"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrefillExpected}
              className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-xs font-bold text-theme-brand hover:opacity-80 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Prefill Expected</span>
            </button>
            {Object.keys(counts).length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-bold text-theme-outflow hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Audit Sheet Table */}
        <div className="liquid-glass-subtle rounded-2xl border overflow-hidden max-h-[50vh] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b theme-divider text-[10px] uppercase font-bold text-theme-secondary bg-white/20 dark:bg-black/20 sticky top-0 backdrop-blur-md z-10">
              <tr>
                <th className="py-2.5 px-3">Product / SKU</th>
                <th className="py-2.5 px-3 text-right">Expected Stock</th>
                <th className="py-2.5 px-3 text-center w-28">Actual Count</th>
                <th className="py-2.5 px-3 text-right">Discrepancy</th>
                <th className="py-2.5 px-3">Reason if Short</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-divider">
              {filteredProducts.map((p) => {
                const item = counts[p.id] || {};
                const hasInput = item.actual_count !== '' && item.actual_count !== undefined;
                const actual = hasInput ? Number(item.actual_count) : null;
                const expected = Number(p.stock_quantity);
                const diff = hasInput ? actual - expected : null;
                const costPrice = Number(p.cost_price || 0);

                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-white/30 dark:hover:bg-white/5 transition ${
                      hasInput && diff !== 0
                        ? diff < 0
                          ? 'bg-rose-500/5'
                          : 'bg-blue-500/5'
                        : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 min-w-[140px]">
                      <p className="font-extrabold text-theme-primary">{p.name}</p>
                      <p className="text-[10px] text-theme-secondary font-mono">
                        {p.sku} • {p.unit}
                      </p>
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono font-bold text-theme-secondary tabular-nums">
                      {expected} {p.unit}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="number"
                        min="0"
                        placeholder="Count"
                        value={item.actual_count ?? ''}
                        onChange={(e) => handleSetActualCount(p.id, e.target.value)}
                        className={`liquid-input w-24 text-center py-1 px-2 rounded-xl text-xs font-mono font-bold ${
                          hasInput && diff !== 0
                            ? diff < 0
                              ? 'border-rose-500 font-black'
                              : 'border-blue-500 font-black'
                            : ''
                        }`}
                      />
                    </td>

                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {hasInput ? (
                        diff === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 0
                          </span>
                        ) : diff < 0 ? (
                          <div className="text-right">
                            <span className="text-[11px] font-black text-rose-500">
                              {diff} {p.unit}
                            </span>
                            <p className="text-[9px] text-theme-secondary">
                              -{formatCurrency(Math.abs(diff) * costPrice)}
                            </p>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-[11px] font-black text-blue-500">
                              +{diff} {p.unit}
                            </span>
                            <p className="text-[9px] text-theme-secondary">
                              +{formatCurrency(diff * costPrice)}
                            </p>
                          </div>
                        )
                      ) : (
                        <span className="text-theme-secondary text-[11px]">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 min-w-[140px]">
                      {hasInput && diff !== 0 ? (
                        diff < 0 ? (
                          <select
                            value={item.reason || 'MISSING'}
                            onChange={(e) => handleSetReason(p.id, e.target.value)}
                            className="liquid-input text-[11px] py-1 px-2 rounded-xl font-bold w-full"
                          >
                            <option value="MISSING">Missing / Theft / Loss</option>
                            <option value="DAMAGED">Damaged / Broken / Spilled</option>
                            <option value="EXPIRED">Expired Goods</option>
                            <option value="ADJUSTMENT">Recount Adjustment</option>
                          </select>
                        ) : (
                          <select
                            value={item.reason || 'SURPLUS'}
                            onChange={(e) => handleSetReason(p.id, e.target.value)}
                            className="liquid-input text-[11px] py-1 px-2 rounded-xl font-bold w-full"
                          >
                            <option value="SURPLUS">Surplus / Extra Found</option>
                            <option value="ADJUSTMENT">Recount Adjustment</option>
                          </select>
                        )
                      ) : (
                        <span className="text-theme-secondary text-[10px]">
                          {hasInput ? 'In Balance' : 'Uncounted'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Audit Note */}
        <div>
          <label className="block text-[11px] font-bold text-theme-secondary mb-1">
            Audit Ledger Note
          </label>
          <input
            type="text"
            value={auditNote}
            onChange={(e) => setAuditNote(e.target.value)}
            placeholder="e.g. End of Month Shelf Count, Alaba warehouse check..."
            className="liquid-input w-full px-3 py-2 rounded-xl text-xs"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t theme-divider">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={auditSummary.auditedCount === 0}
            onClick={handleSaveAudit}
            className="!px-6"
          >
            Reconcile Stock & Save Audit
          </Button>
        </div>
      </div>
    </Modal>
  );
}
