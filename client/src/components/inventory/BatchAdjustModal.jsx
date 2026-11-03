import React, { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  X,
  PackageCheck,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const MOVEMENT_TYPES = [
  { id: 'RESTOCK', label: 'Restock (+ Add Stock)', direction: 'add', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'DAMAGED', label: 'Damaged / Broken (-)', direction: 'subtract', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  { id: 'EXPIRED', label: 'Expired (-)', direction: 'subtract', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'MISSING', label: 'Missing / Loss (-)', direction: 'subtract', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { id: 'SURPLUS', label: 'Surplus (+ Found Extra)', direction: 'add', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  { id: 'ADJUSTMENT', label: 'Manual Adjustment', direction: 'neutral', color: 'text-zinc-300 bg-zinc-800 border-zinc-700' },
];

export function BatchAdjustModal({
  isOpen,
  onClose,
  products = [],
  apiFetch,
  formatCurrency,
  toastSuccess,
  toastError,
  onSuccess,
}) {
  // Map of product_id -> { quantity: number|string, mode: 'DELTA'|'SET_COUNT', movement_type: string, note: string }
  const [items, setItems] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [globalReason, setGlobalReason] = useState('RESTOCK');
  const [globalNote, setGlobalNote] = useState('Multi-Product Inventory Adjustment');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available products not yet added to batch
  const unselectedProducts = useMemo(() => {
    return products.filter((p) => !items[p.id]);
  }, [products, items]);

  const filteredUnselected = useMemo(() => {
    if (!searchTerm.trim()) return unselectedProducts.slice(0, 10);
    const q = searchTerm.toLowerCase();
    return unselectedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [unselectedProducts, searchTerm]);

  // Selected products list with metadata
  const selectedList = useMemo(() => {
    const list = [];
    for (const [idStr, state] of Object.entries(items)) {
      const prod = products.find((p) => String(p.id) === String(idStr));
      if (prod) {
        list.push({ product: prod, ...state });
      }
    }
    return list;
  }, [items, products]);

  // Add single product
  const handleAddProduct = (prod) => {
    setItems((prev) => ({
      ...prev,
      [prod.id]: {
        quantity: '',
        mode: 'DELTA',
        movement_type: globalReason,
        note: '',
      },
    }));
  };

  // Add all visible filtered products
  const handleAddAllFiltered = () => {
    setItems((prev) => {
      const updated = { ...prev };
      filteredUnselected.forEach((prod) => {
        if (!updated[prod.id]) {
          updated[prod.id] = {
            quantity: '',
            mode: 'DELTA',
            movement_type: globalReason,
            note: '',
          };
        }
      });
      return updated;
    });
  };

  // Remove single product
  const handleRemoveProduct = (productId) => {
    setItems((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  // Update item field
  const updateItemField = (productId, field, value) => {
    setItems((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  // Apply reason to all currently added items
  const handleApplyGlobalReason = (reason) => {
    setGlobalReason(reason);
    setItems((prev) => {
      const updated = {};
      for (const [k, v] of Object.entries(prev)) {
        updated[k] = { ...v, movement_type: reason };
      }
      return updated;
    });
  };

  // Metrics summary
  const summary = useMemo(() => {
    let totalItems = 0;
    let validAdjustments = 0;
    let netStockDiff = 0;
    let netValueImpact = 0;
    const errors = [];

    selectedList.forEach(({ product, quantity, mode, movement_type }) => {
      totalItems++;
      const curStock = Number(product.stock_quantity) || 0;
      const numVal = Number(quantity);

      if (quantity === '' || Number.isNaN(numVal)) {
        return;
      }

      validAdjustments++;
      let stockDiff = 0;

      if (mode === 'SET_COUNT') {
        if (numVal < 0) {
          errors.push(`${product.name}: Count cannot be negative`);
          return;
        }
        stockDiff = numVal - curStock;
      } else {
        // DELTA
        if (['DAMAGED', 'EXPIRED', 'MISSING'].includes(movement_type)) {
          const deduct = Math.abs(numVal);
          if (curStock < deduct) {
            errors.push(`${product.name}: Deduction (${deduct}) exceeds current stock (${curStock})`);
          }
          stockDiff = -deduct;
        } else if (['RESTOCK', 'SURPLUS'].includes(movement_type)) {
          stockDiff = Math.abs(numVal);
        } else {
          // Manual general adjustment
          stockDiff = numVal;
          if (curStock + stockDiff < 0) {
            errors.push(`${product.name}: Resulting stock cannot be negative`);
          }
        }
      }

      netStockDiff += stockDiff;
      const unitCost = Number(product.cost_price) || 0;
      netValueImpact += stockDiff * unitCost;
    });

    return {
      totalItems,
      validAdjustments,
      netStockDiff,
      netValueImpact,
      errors,
    };
  }, [selectedList]);

  const handleSubmit = async () => {
    if (summary.validAdjustments === 0) {
      toastError?.('Please enter valid quantities for at least one product.');
      return;
    }
    if (summary.errors.length > 0) {
      toastError?.(summary.errors[0]);
      return;
    }

    const payload = {
      adjustments: selectedList
        .filter((item) => item.quantity !== '' && !Number.isNaN(Number(item.quantity)))
        .map((item) => ({
          product_id: item.product.id,
          quantity: Number(item.quantity),
          mode: item.mode,
          movement_type: item.movement_type,
          note: item.note?.trim() || globalNote,
        })),
    };

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/v1/inventory/batch-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to apply batch adjustments');
      }

      toastSuccess?.(`Successfully updated ${data.data?.updatedCount || payload.adjustments.length} product(s)!`);
      setItems({});
      onSuccess?.();
      onClose();
    } catch (err) {
      toastError?.(err.message || 'An error occurred while saving batch adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Multi-Product Stock Adjustments"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-6">
        {/* Banner / Instructions */}
        <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-100">
                Simultaneous Batch Stock Update
              </p>
              <p className="text-xs text-slate-400">
                Log restocks, write off expired or damaged goods, or adjust shelves across multiple products simultaneously in one atomic transaction.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400">Quick Reason:</span>
            <select
              value={globalReason}
              onChange={(e) => handleApplyGlobalReason(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
            >
              {MOVEMENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Picker Section */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left: Product Search & Quick Add */}
          <div className="md:col-span-5 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Select Products ({unselectedProducts.length} available)
              </span>
              {filteredUnselected.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddAllFiltered}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  + Add Filtered ({filteredUnselected.length})
                </button>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {filteredUnselected.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                  <PackageCheck className="w-8 h-8 mb-2 opacity-40 text-emerald-400" />
                  <p className="text-xs">
                    {unselectedProducts.length === 0
                      ? 'All store products are in the batch list.'
                      : 'No unselected products match search.'}
                  </p>
                </div>
              ) : (
                filteredUnselected.map((prod) => (
                  <div
                    key={prod.id}
                    onClick={() => handleAddProduct(prod)}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/60 cursor-pointer transition-colors group"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-medium text-slate-200 truncate group-hover:text-emerald-300">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        SKU: {prod.sku || 'N/A'} • On Hand:{' '}
                        <span className="font-semibold text-slate-300">{prod.stock_quantity}</span>{' '}
                        {prod.unit || 'units'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="w-6 h-6 rounded bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Selected Adjustment Table */}
          <div className="md:col-span-7 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/60">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Adjustment Batch ({selectedList.length} item{selectedList.length === 1 ? '' : 's'})
              </span>
              {selectedList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems({})}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {selectedList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <SlidersHorizontal className="w-8 h-8 mb-2 opacity-30 text-slate-400" />
                  <p className="text-xs font-medium text-slate-400">Batch is currently empty</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Select products from the left panel to build your stock adjustment batch.
                  </p>
                </div>
              ) : (
                selectedList.map(({ product, quantity, mode, movement_type, note }) => {
                  const curStock = Number(product.stock_quantity) || 0;
                  const numVal = Number(quantity);
                  let projectedStock = curStock;
                  let diff = 0;

                  if (quantity !== '' && !Number.isNaN(numVal)) {
                    if (mode === 'SET_COUNT') {
                      projectedStock = numVal;
                      diff = projectedStock - curStock;
                    } else {
                      if (['DAMAGED', 'EXPIRED', 'MISSING'].includes(movement_type)) {
                        diff = -Math.abs(numVal);
                      } else if (['RESTOCK', 'SURPLUS'].includes(movement_type)) {
                        diff = Math.abs(numVal);
                      } else {
                        diff = numVal;
                      }
                      projectedStock = curStock + diff;
                    }
                  }

                  const isError =
                    projectedStock < 0 ||
                    (mode === 'SET_COUNT' && numVal < 0);

                  return (
                    <div
                      key={product.id}
                      className={`p-2.5 rounded-lg border transition-colors ${
                        isError
                          ? 'bg-rose-950/20 border-rose-800/50'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-200 truncate">
                            {product.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>SKU: {product.sku || 'N/A'}</span>
                            <span>•</span>
                            <span>
                              Shelf: <strong className="text-slate-200">{curStock}</strong> {product.unit}
                            </span>
                            {product.cost_price > 0 && (
                              <>
                                <span>•</span>
                                <span>Cost: {formatCurrency(product.cost_price)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(product.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Controls grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                        {/* Reason / Movement Type */}
                        <div>
                          <label className="block text-[9px] text-slate-400 uppercase font-medium mb-0.5">
                            Reason
                          </label>
                          <select
                            value={movement_type}
                            onChange={(e) =>
                              updateItemField(product.id, 'movement_type', e.target.value)
                            }
                            className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
                          >
                            {MOVEMENT_TYPES.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Mode & Quantity */}
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[9px] text-slate-400 uppercase font-medium">
                              {mode === 'DELTA' ? 'Units Change' : 'New Total'}
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                updateItemField(
                                  product.id,
                                  'mode',
                                  mode === 'DELTA' ? 'SET_COUNT' : 'DELTA'
                                )
                              }
                              className="text-[9px] text-emerald-400 hover:underline"
                            >
                              Switch to {mode === 'DELTA' ? 'Set Total' : '+/- Diff'}
                            </button>
                          </div>
                          <input
                            type="number"
                            min={mode === 'SET_COUNT' ? '0' : undefined}
                            placeholder={mode === 'DELTA' ? 'e.g. 10 or -3' : `Shelf count`}
                            value={quantity}
                            onChange={(e) =>
                              updateItemField(product.id, 'quantity', e.target.value)
                            }
                            className="w-full bg-slate-950 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* Outcome Preview */}
                        <div className="flex flex-col justify-end bg-slate-950/60 p-1.5 rounded border border-slate-800">
                          <span className="text-[9px] text-slate-400 uppercase">Projected Stock</span>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300">
                              {curStock} <ArrowRight className="w-3 h-3 inline text-slate-500 mx-0.5" />
                              <span
                                className={
                                  isError
                                    ? 'text-rose-400'
                                    : diff > 0
                                    ? 'text-emerald-400'
                                    : diff < 0
                                    ? 'text-amber-400'
                                    : 'text-slate-300'
                                }
                              >
                                {projectedStock}
                              </span>
                            </span>
                            {diff !== 0 && (
                              <span
                                className={`text-[10px] font-semibold ${
                                  diff > 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Optional Note */}
                      <div className="mt-1.5">
                        <input
                          type="text"
                          placeholder="Optional line note (e.g., invoice #, rack location, cause)"
                          value={note}
                          onChange={(e) => updateItemField(product.id, 'note', e.target.value)}
                          className="w-full bg-slate-950/50 border border-slate-800/80 rounded px-2 py-0.5 text-[10px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Global Batch Notes & Impact Summary */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-3 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="md:col-span-6">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              General Batch Reference Note
            </label>
            <input
              type="text"
              value={globalNote}
              onChange={(e) => setGlobalNote(e.target.value)}
              placeholder="e.g. Weekly restock from Alaba Market or Monthly spoilage write-off"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-6 grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Products Ready</span>
              <span className="text-sm font-bold text-slate-100">
                {summary.validAdjustments} / {summary.totalItems}
              </span>
            </div>
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Net Units</span>
              <span
                className={`text-sm font-bold ${
                  summary.netStockDiff > 0
                    ? 'text-emerald-400'
                    : summary.netStockDiff < 0
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {summary.netStockDiff > 0 ? `+${summary.netStockDiff}` : summary.netStockDiff}
              </span>
            </div>
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block uppercase">Est. Value Diff</span>
              <span
                className={`text-xs font-bold truncate block ${
                  summary.netValueImpact > 0
                    ? 'text-emerald-400'
                    : summary.netValueImpact < 0
                    ? 'text-rose-400'
                    : 'text-slate-300'
                }`}
              >
                {formatCurrency(summary.netValueImpact)}
              </span>
            </div>
          </div>
        </div>

        {summary.errors.length > 0 && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{summary.errors[0]}</span>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || summary.validAdjustments === 0 || summary.errors.length > 0}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Applying Batch Adjustments...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Apply {summary.validAdjustments} Stock Adjustment{summary.validAdjustments === 1 ? '' : 's'}
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
