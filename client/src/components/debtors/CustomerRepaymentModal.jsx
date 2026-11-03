import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  CreditCard,
  Building,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';

export function CustomerRepaymentModal({
  isOpen,
  onClose,
  target,
  onSuccess,
  apiFetch,
  formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`,
}) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Is target an individual credit invoice or an aggregate customer account?
  const isSingleSlip = Boolean(target?.id && target?.items_summary);
  const customerName = target?.customer_name || 'Customer';
  const balanceDue = Number(
    target?.total_balance_due !== undefined ? target.total_balance_due : target?.balance_due || 0
  );

  useEffect(() => {
    if (target) {
      setAmount(String(balanceDue));
      setPaymentMethod('CASH');
      setNote('');
      setError(null);
    }
  }, [target, balanceDue]);

  const numAmount = Number(amount || 0);
  const remainingBalance = Math.max(0, Number((balanceDue - numAmount).toFixed(2)));
  const isOverpaying = numAmount > balanceDue;

  const quickChips = useMemo(() => {
    if (balanceDue <= 0) return [];
    const chips = [{ label: 'Full Balance', value: balanceDue }];
    if (balanceDue > 1000) {
      chips.push({ label: '50% Half', value: Math.round(balanceDue / 2) });
    }
    const presetAmounts = [2000, 5000, 10000, 20000, 50000];
    for (const p of presetAmounts) {
      if (p < balanceDue && !chips.some((c) => c.value === p)) {
        chips.push({ label: formatNaira(p), value: p });
      }
    }
    return chips.slice(0, 4);
  }, [balanceDue, formatNaira]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Please enter a payment amount greater than zero.');
      return;
    }
    if (isOverpaying) {
      setError(`Payment cannot exceed the outstanding balance of ${formatNaira(balanceDue)}.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (isSingleSlip) {
        // Settle specific credit slip
        await apiFetch(`/api/v1/credits/${target.id}/repay`, {
          method: 'POST',
          body: {
            amount: numAmount,
            payment_method: paymentMethod,
            note: note.trim() || undefined,
          },
        });
      } else {
        // Settle customer aggregate account (FIFO across open invoices)
        await apiFetch(`/api/v1/credits/customers/${encodeURIComponent(customerName)}/repay`, {
          method: 'POST',
          body: {
            amount: numAmount,
            payment_method: paymentMethod,
            note: note.trim() || undefined,
          },
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record repayment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !target) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSingleSlip ? 'Collect Slip Payment' : 'Collect Customer Debt'}
      subtitle={`Record debt payment from ${customerName}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Balance Card */}
        <div className="liquid-glass-subtle rounded-2xl p-4 border theme-divider flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-theme-secondary">Total Balance Owed</div>
            <div className="text-xl font-extrabold font-luxury text-theme-outflow tabular-nums">
              {formatNaira(balanceDue)}
            </div>
            {isSingleSlip && (
              <div className="text-[11px] text-theme-muted mt-0.5 max-w-xs truncate">
                Slip #{target.id}: {target.items_summary}
              </div>
            )}
            {!isSingleSlip && target.active_credits_count > 1 && (
              <div className="text-[11px] text-theme-secondary mt-0.5">
                Will auto-settle across {target.active_credits_count} owing invoices (oldest first)
              </div>
            )}
          </div>
          <div className="text-right">
            <Badge variant="warning">Owing</Badge>
          </div>
        </div>

        {/* Quick Amount Chips */}
        {quickChips.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-theme-secondary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Amount Shortcuts
            </label>
            <div className="flex flex-wrap gap-2">
              {quickChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAmount(String(chip.value))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border transition liquid-glass-subtle hover:border-emerald-500 hover:text-emerald-500 cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount Input */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-theme-secondary flex items-center justify-between">
            <span>Amount Paying (₦)</span>
            <span className="text-[11px] text-theme-muted">
              {numAmount > 0 && (
                remainingBalance === 0 ? (
                  <span className="text-emerald-500 font-bold">Will fully settle! 🎉</span>
                ) : (
                  <span>Remaining: {formatNaira(remainingBalance)}</span>
                )
              )}
            </span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted text-sm font-bold">
              ₦
            </span>
            <input
              type="number"
              step="any"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-2.5 rounded-xl text-base font-bold font-mono bg-theme-input border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Payment Channel Pills */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-theme-secondary">Payment Method Received</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'CASH', label: 'Cash', icon: Banknote },
              { id: 'POS', label: 'POS Terminal', icon: CreditCard },
              { id: 'TRANSFER', label: 'Bank Transfer', icon: Building },
            ].map((method) => {
              const active = paymentMethod === method.id;
              const Icon = method.icon;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setPaymentMethod(method.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer flex flex-col items-center gap-1.5 ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'liquid-glass-subtle border-theme-border text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment Note */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-theme-secondary">
            Payment Note / Reference (Optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Paid by brother, GTBank transfer ref 99482"
            className="w-full px-3.5 py-2 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t theme-divider">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold liquid-glass-subtle text-theme-secondary hover:text-theme-primary transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || numAmount <= 0 || isOverpaying}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold liquid-btn-primary flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              'Recording Payment...'
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Settle {formatNaira(numAmount)}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
