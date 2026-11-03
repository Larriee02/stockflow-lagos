import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  History,
  Edit3,
  XCircle,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const CORRECTION_REASON_PRESETS = [
  'Typo in amount entered',
  'Wrong payment channel (Cash vs POS/Transfer)',
  'Wrong expense category selected',
  'Duplicate entry recorded by mistake',
  'Customer cancelled or returned order',
];

const EXPENSE_CATEGORIES = [
  'Inventory Restock',
  'Generator & Power',
  'Electricity & Utilities',
  'Logistics & Transport',
  'Store Rent & Lease',
  'Staff Wages & Allowance',
  'POS & Bank Charges',
  'Security & Maintenance',
  'Packaging & Supplies',
  'Taxes & Market Levies',
  'Miscellaneous Expense',
];

const INFLOW_CATEGORIES = [
  'Counter Sales',
  'Credit Repayment',
  'Wholesale Order',
  'Capital Injection / Float',
  'Other Income',
];

const CHANNEL_OPTIONS = [
  { id: 'CASH', label: 'Cash (Notes)', icon: Banknote, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10' },
  { id: 'POS', label: 'POS Terminal', icon: CreditCard, color: 'text-sky-400 border-sky-500/40 bg-sky-500/10' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Landmark, color: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10' },
  { id: 'MOBILE_MONEY', label: 'Mobile Wallet', icon: Smartphone, color: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
];

export function TransactionCorrectionModal({
  isOpen,
  onClose,
  transaction,
  apiFetch,
  formatCurrency,
  currencySymbol = '₦',
  toastSuccess,
  toastError,
  onSuccess,
}) {
  const [mode, setMode] = useState('AMEND'); // 'AMEND' | 'VOID'
  const [type, setType] = useState('OUTFLOW');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [counterpartyName, setCounterpartyName] = useState('');
  const [expenseReason, setExpenseReason] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && transaction) {
      setMode('AMEND');
      setType(transaction.type || 'OUTFLOW');
      setCategory(transaction.category || 'Inventory Restock');
      setAmount(String(transaction.amount || ''));
      setPaymentMethod(transaction.payment_method || 'CASH');
      setCounterpartyName(transaction.counterparty_name || '');
      setExpenseReason(transaction.expense_reason || transaction.description || '');
      setCorrectionReason('');
    }
  }, [isOpen, transaction]);

  if (!transaction) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      toastError?.('Please select or enter a reason for this correction to preserve your audit trail.');
      return;
    }
    if (mode === 'AMEND' && (Number(amount) <= 0 || Number.isNaN(Number(amount)))) {
      toastError?.('Corrected amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiFetch(`/api/v1/transactions/${transaction.id}/correct`, {
        method: 'POST',
        body: JSON.stringify({
          mode,
          correction_reason: correctionReason.trim(),
          type,
          category: category.trim(),
          amount: Number(amount),
          payment_method: paymentMethod,
          counterparty_name: counterpartyName.trim() || null,
          expense_reason: expenseReason.trim(),
          description: expenseReason.trim() || category.trim(),
        }),
      });

      toastSuccess?.(
        mode === 'AMEND'
          ? `Entry #${transaction.id} corrected! Original preserved in audit trail.`
          : `Entry #${transaction.id} voided with full audit trail preserved.`
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      toastError?.(err.message || 'Could not process transaction correction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryPresets = type === 'OUTFLOW' ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Correct or Void Cashbook Entry #${transaction.id}`}
      subtitle="Audit-safe financial workflow: original records are never permanently erased"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Audit Trail Guarantee Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-bold text-slate-200">
              Original Record Snapshot (Preserved in Audit History)
            </div>
            <div className="text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                <strong>{transaction.type === 'INFLOW' ? 'Money In' : 'Money Out'}:</strong>{' '}
                {formatCurrency(transaction.amount)}
              </span>
              <span>•</span>
              <span>
                <strong>Channel:</strong> {transaction.payment_method}
              </span>
              <span>•</span>
              <span>
                <strong>Category:</strong> {transaction.category}
              </span>
              <span>•</span>
              <span>{new Date(transaction.transaction_date).toLocaleString()}</span>
            </div>
            <div className="text-slate-400 italic">
              &ldquo;{transaction.expense_reason || transaction.description}&rdquo;
            </div>
          </div>
        </div>

        {/* Correction Action Selector */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setMode('AMEND')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              mode === 'AMEND'
                ? 'bg-emerald-500/15 border-emerald-500/50 text-slate-100 shadow-md'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-400 mb-0.5">
              <Edit3 className="w-3.5 h-3.5" />
              Amend & Replace Entry
            </div>
            <p className="text-[11px] opacity-80">
              Fix wrong amount, payment channel, or category. Marks original as superseded and creates a corrected entry.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode('VOID')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              mode === 'VOID'
                ? 'bg-rose-500/15 border-rose-500/50 text-slate-100 shadow-md'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs text-rose-400 mb-0.5">
              <XCircle className="w-3.5 h-3.5" />
              Void / Reverse Entry
            </div>
            <p className="text-[11px] opacity-80">
              Cancel an accidental or duplicate entry. Excludes it from cash totals while keeping it in the audit trail.
            </p>
          </button>
        </div>

        {/* If Amending: Show Replacement Values Form */}
        {mode === 'AMEND' && (
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Corrected Replacement Details
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setType('OUTFLOW');
                    if (INFLOW_CATEGORIES.includes(category)) setCategory('Inventory Restock');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    type === 'OUTFLOW'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  - Money Out
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('INFLOW');
                    if (EXPENSE_CATEGORIES.includes(category)) setCategory('Counter Sales');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    type === 'INFLOW'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  + Money In
                </button>
              </div>
            </div>

            {/* Payment Channel Visual Picker */}
            <div>
              <label className="block text-xs font-bold mb-1.5 text-slate-300">
                Corrected Payment Channel
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CHANNEL_OPTIONS.map((ch) => {
                  const Icon = ch.icon;
                  const active = paymentMethod === ch.id;
                  return (
                    <button
                      type="button"
                      key={ch.id}
                      onClick={() => setPaymentMethod(ch.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        active
                          ? ch.color
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{ch.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-300">
                  Corrected Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="liquid-input w-full rounded-xl px-3 py-2 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-slate-300">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs font-bold"
                >
                  {!categoryPresets.includes(category) && category && (
                    <option value={category}>{category}</option>
                  )}
                  {categoryPresets.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-300">
                  {type === 'OUTFLOW' ? 'Specific Expense Reason / Purpose' : 'Transaction Note / Details'}
                </label>
                <input
                  type="text"
                  required
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  placeholder="e.g. 10 litres petrol for evening generator"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-300">
                  {type === 'OUTFLOW' ? 'Payee / Vendor Name (Optional)' : 'Customer / Payer Name (Optional)'}
                </label>
                <input
                  type="text"
                  value={counterpartyName}
                  onChange={(e) => setCounterpartyName(e.target.value)}
                  placeholder="e.g. Total Filling Station / Walk-in"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Mandatory Correction Audit Reason */}
        <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/30 space-y-2.5">
          <label className="block text-xs font-bold text-amber-300">
            Why are you {mode === 'AMEND' ? 'correcting' : 'voiding'} this entry? (Required for Audit Trail)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CORRECTION_REASON_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                onClick={() => setCorrectionReason(preset)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-all ${
                  correctionReason === preset
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900/80 text-slate-300 border border-slate-700 hover:border-amber-500/50'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            type="text"
            required
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            placeholder="Explain why this transaction is being corrected or voided..."
            className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={isSubmitting || !correctionReason.trim()}
            className="flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Recording Audit Trail...
              </>
            ) : mode === 'AMEND' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save Correction & Preserve Audit Trail
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                Void Entry & Preserve Audit Trail
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
