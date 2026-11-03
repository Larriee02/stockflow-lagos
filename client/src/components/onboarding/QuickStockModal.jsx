import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Search,
  Zap,
  RotateCcw,
  Package,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';

export function QuickStockModal({
  isOpen,
  onClose,
  products = [],
  apiFetch,
  formatCurrency,
  toastSuccess,
  toastError,
  onSuccess,
}) {
  // Map of productId -> quantity (string or number)
  const [counts, setCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize or reset counts whenever modal opens or products change
  useEffect(() => {
    if (isOpen) {
      const initial = {};
      products.forEach((p) => {
        // Default to existing stock or 10 if currently 0
        initial[p.id] = Number(p.stock_quantity) > 0 ? String(p.stock_quantity) : '10';
      });
      setCounts(initial);
      setSearchTerm('');
    }
  }, [isOpen, products]);

  const handleSetAll = (val) => {
    const updated = {};
    products.forEach((p) => {
      updated[p.id] = String(val);
    });
    setCounts(updated);
  };

  const handleCountChange = (productId, val) => {
    setCounts((prev) => ({
      ...prev,
      [productId]: val,
    }));
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const q = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, searchTerm]);

  // Aggregate stats
  const totalUnits = useMemo(() => {
    let sum = 0;
    for (const p of products) {
      const q = Number(counts[p.id]);
      if (!Number.isNaN(q) && q > 0) {
        sum += q;
      }
    }
    return sum;
  }, [counts, products]);

  const totalValue = useMemo(() => {
    let sum = 0;
    for (const p of products) {
      const q = Number(counts[p.id]);
      if (!Number.isNaN(q) && q > 0) {
        sum += q * Number(p.cost_price || 0);
      }
    }
    return sum;
  }, [counts, products]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const adjustments = [];
      for (const p of products) {
        const val = counts[p.id];
        if (val !== undefined && val !== '' && !Number.isNaN(Number(val))) {
          const qty = Math.max(0, Number(val));
          adjustments.push({
            product_id: p.id,
            quantity: qty,
            mode: 'SET_COUNT',
            movement_type: 'SURPLUS',
            note: 'Initial Shelf Count / Opening Stock',
          });
        }
      }

      if (adjustments.length === 0) {
        throw new Error('Please enter shelf counts for at least one product.');
      }

      await apiFetch('/api/v1/inventory/batch-adjust', {
        method: 'POST',
        body: JSON.stringify({ adjustments }),
      });

      toastSuccess(`Shelf opening stock recorded (${totalUnits} total units counted)!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toastError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Opening Stock (Shelf Count)"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="liquid-glass-subtle p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <div className="text-xs font-extrabold text-theme-primary">
                Quick Shelf Count Shortcuts
              </div>
              <div className="text-[11px] text-theme-secondary">
                Set starting units across all {products.length} catalog items with 1 click:
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => handleSetAll(10)}
              className="liquid-btn-primary px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer shadow"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Set 10 for All</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetAll(20)}
              className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold text-theme-primary hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              Set 20
            </button>
            <button
              type="button"
              onClick={() => handleSetAll(0)}
              className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-xs font-bold text-theme-secondary hover:text-theme-primary cursor-pointer"
              title="Reset all to 0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="liquid-input w-full pl-10 pr-4 py-2 text-xs rounded-xl"
          />
        </div>

        {/* Product List Table */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {filteredProducts.map((p) => {
            const currentStock = Number(p.stock_quantity || 0);
            const countVal = counts[p.id] ?? '';
            return (
              <div
                key={p.id}
                className="liquid-glass-subtle p-3 rounded-2xl flex items-center justify-between gap-3 border border-theme-subtle"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-extrabold text-xs text-theme-primary truncate">
                    {p.name}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-theme-secondary">
                    <span>{p.sku}</span>
                    <span>•</span>
                    <span>Cost: {formatCurrency(p.cost_price)}</span>
                    <span>•</span>
                    <Badge variant={currentStock > 0 ? 'info' : 'danger'}>
                      Current: {currentStock} {p.unit}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="text-[11px] font-bold text-theme-secondary">Count:</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={countVal}
                    onChange={(e) => handleCountChange(p.id, e.target.value)}
                    className="liquid-input w-20 px-2.5 py-1.5 text-xs text-right font-bold rounded-xl"
                  />
                  <span className="text-[11px] text-theme-secondary w-8 truncate">
                    {p.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Valuation Summary */}
        <div className="p-3 rounded-2xl liquid-glass-subtle border border-theme-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-theme-secondary">Total Shelf Count: </span>
            <strong className="text-theme-primary tabular-nums">{totalUnits} units</strong>
          </div>
          <div>
            <span className="text-theme-secondary">Starting Inventory Value: </span>
            <strong className="text-theme-brand tabular-nums">{formatCurrency(totalValue)}</strong>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t theme-divider">
          <button
            type="button"
            onClick={onClose}
            className="liquid-glass-subtle px-4 py-2.5 rounded-xl text-xs font-bold text-theme-secondary hover:text-theme-primary cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="liquid-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? 'Recording Stock...' : 'Save Shelf Stock Counts'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
