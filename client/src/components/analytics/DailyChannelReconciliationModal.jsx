import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  Banknote,
  CreditCard,
  Building,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Copy,
  Check,
  Calendar,
  Lock,
  ArrowRight,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';

export function DailyChannelReconciliationModal({
  isOpen,
  onClose,
  sessionState,
  transactions = [],
  apiFetch,
  formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`,
  storeName = 'StockFlow Store',
  onSuccess,
}) {
  const [reconcileDate, setReconcileDate] = useState(
    sessionState?.targetDate || new Date().toISOString().slice(0, 10)
  );
  const [actualCash, setActualCash] = useState('');
  const [actualPos, setActualPos] = useState('');
  const [actualBank, setActualBank] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  // Compute expected cash, POS, and Bank transfers for the selected date
  const channelData = useMemo(() => {
    const toDateKey = (val) => {
      if (!val) return '';
      if (val instanceof Date) return val.toISOString().slice(0, 10);
      const str = String(val);
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
      return new Date(val).toISOString().slice(0, 10);
    };

    const targetDate = reconcileDate;
    let cashIn = 0;
    let cashOut = 0;
    let posIn = 0;
    let posOut = 0;
    let bankIn = 0;
    let bankOut = 0;

    for (const tx of transactions) {
      if ((tx.status || 'ACTIVE') !== 'ACTIVE') continue;
      const txDate = toDateKey(tx.transaction_date);
      if (txDate !== targetDate) continue;

      const amt = Number(tx.amount || 0);
      const method = tx.payment_method || 'CASH';

      if (method === 'CASH') {
        if (tx.type === 'INFLOW') cashIn += amt;
        else cashOut += amt;
      } else if (method === 'POS') {
        if (tx.type === 'INFLOW') posIn += amt;
        else posOut += amt;
      } else if (method === 'BANK_TRANSFER' || method === 'MOBILE_MONEY') {
        if (tx.type === 'INFLOW') bankIn += amt;
        else bankOut += amt;
      }
    }

    const openingCash = Number(sessionState?.effectiveOpeningCash ?? 0);
    const openingBankPos = Number(sessionState?.effectiveOpeningBankPos ?? 0);

    const expectedCash = Number((openingCash + cashIn - cashOut).toFixed(2));
    const expectedPos = Number((posIn - posOut).toFixed(2));
    const expectedBank = Number((openingBankPos + bankIn - bankOut).toFixed(2));
    const totalExpected = Number((expectedCash + expectedPos + expectedBank).toFixed(2));

    return {
      openingCash,
      openingBankPos,
      cashIn,
      cashOut,
      posIn,
      posOut,
      bankIn,
      bankOut,
      expectedCash,
      expectedPos,
      expectedBank,
      totalExpected,
    };
  }, [transactions, reconcileDate, sessionState]);

  useEffect(() => {
    if (isOpen) {
      const target = sessionState?.targetDate || new Date().toISOString().slice(0, 10);
      setReconcileDate(target);
      setActualCash(String(channelData.expectedCash || 0));
      setActualPos(String(channelData.expectedPos || 0));
      setActualBank(String(channelData.expectedBank || 0));
      setReconcileNotes('');
      setError(null);
      setCopied(false);
    }
  }, [isOpen, sessionState, channelData.expectedCash, channelData.expectedPos, channelData.expectedBank]);

  const numActualCash = Number(actualCash || 0);
  const numActualPos = Number(actualPos || 0);
  const numActualBank = Number(actualBank || 0);

  const cashVariance = Number((numActualCash - channelData.expectedCash).toFixed(2));
  const posVariance = Number((numActualPos - channelData.expectedPos).toFixed(2));
  const bankVariance = Number((numActualBank - channelData.expectedBank).toFixed(2));

  const totalActual = Number((numActualCash + numActualPos + numActualBank).toFixed(2));
  const totalVariance = Number((totalActual - channelData.totalExpected).toFixed(2));

  const getVarianceBadge = (diff) => {
    if (Math.abs(diff) < 0.01) {
      return <Badge variant="success">BALANCED ✓</Badge>;
    }
    if (diff > 0) {
      return <Badge variant="info">OVER +{formatNaira(diff)}</Badge>;
    }
    return <Badge variant="danger">SHORT -{formatNaira(Math.abs(diff))}</Badge>;
  };

  const buildSummaryText = () => {
    return [
      `=====================================`,
      `DAILY CASH & CHANNEL RECONCILIATION`,
      `${storeName.toUpperCase()}`,
      `Date: ${reconcileDate}`,
      `Generated: ${new Date().toLocaleTimeString('en-GB')}`,
      `=====================================`,
      `1. PHYSICAL CASH IN DRAWER:`,
      `   Expected: ${formatNaira(channelData.expectedCash)}`,
      `   Actual:   ${formatNaira(numActualCash)}`,
      `   Variance: ${cashVariance >= 0 ? `+${formatNaira(cashVariance)}` : `-${formatNaira(Math.abs(cashVariance))}`}`,
      `-------------------------------------`,
      `2. POS TERMINAL SETTLEMENT:`,
      `   Expected: ${formatNaira(channelData.expectedPos)}`,
      `   Actual:   ${formatNaira(numActualPos)}`,
      `   Variance: ${posVariance >= 0 ? `+${formatNaira(posVariance)}` : `-${formatNaira(Math.abs(posVariance))}`}`,
      `-------------------------------------`,
      `3. BANK TRANSFERS:`,
      `   Expected: ${formatNaira(channelData.expectedBank)}`,
      `   Actual:   ${formatNaira(numActualBank)}`,
      `   Variance: ${bankVariance >= 0 ? `+${formatNaira(bankVariance)}` : `-${formatNaira(Math.abs(bankVariance))}`}`,
      `=====================================`,
      `TOTAL SYSTEM EXPECTED: ${formatNaira(channelData.totalExpected)}`,
      `TOTAL ACTUAL COUNTED:  ${formatNaira(totalActual)}`,
      `NET RECONCILIATION:   ${totalVariance === 0 ? 'BALANCED' : totalVariance > 0 ? `OVER +${formatNaira(totalVariance)}` : `SHORT -${formatNaira(Math.abs(totalVariance))}`}`,
      reconcileNotes ? `Notes: ${reconcileNotes}` : '',
      `=====================================`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSubmitCloseSession = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      await apiFetch('/api/v1/cashbook/sessions/close', {
        method: 'POST',
        body: {
          session_date: reconcileDate,
          opening_balance: sessionState?.effectiveOpeningBalance || channelData.openingCash + channelData.openingBankPos,
          opening_cash: channelData.openingCash,
          opening_bank_pos: channelData.openingBankPos,
          expected_closing_balance: channelData.totalExpected,
          actual_closing_balance: totalActual,
          actual_closing_cash: numActualCash,
          actual_closing_bank_pos: numActualPos + numActualBank,
          variance: totalVariance,
          closing_note: reconcileNotes.trim() || undefined,
        },
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save daily reconciliation sign-off.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily POS, Cash & Bank Reconciliation"
      subtitle="Reconcile drawer cash, POS terminal settlements, and bank transfer alerts"
    >
      <form onSubmit={handleSubmitCloseSession} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Date Selector Header */}
        <div className="flex items-center justify-between p-3 rounded-2xl liquid-glass-subtle border theme-divider">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-theme-secondary" />
            <span className="text-xs font-bold text-theme-primary">Reconciliation Date:</span>
          </div>
          <input
            type="date"
            value={reconcileDate}
            onChange={(e) => setReconcileDate(e.target.value)}
            className="px-2.5 py-1 rounded-xl text-xs font-mono bg-theme-input border border-theme-border text-theme-primary focus:outline-none"
          />
        </div>

        {/* 3 Channel Breakdown Blocks */}
        <div className="space-y-3">
          {/* CHANNEL 1: PHYSICAL CASH */}
          <div className="p-3.5 rounded-2xl liquid-glass-subtle border theme-divider space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-theme-primary flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-emerald-500" /> 1. Physical Cash in Shop Drawer
              </span>
              {getVarianceBadge(cashVariance)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-theme-input/40 border theme-divider">
                <span className="text-[10px] text-theme-muted uppercase block">System Expected:</span>
                <span className="text-sm font-bold font-mono text-theme-primary">
                  {formatNaira(channelData.expectedCash)}
                </span>
                <span className="text-[9px] text-theme-muted block mt-0.5">
                  Float ({formatNaira(channelData.openingCash)}) + In ({formatNaira(channelData.cashIn)}) - Out ({formatNaira(channelData.cashOut)})
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">
                  Actual Cash Counted (₦):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl text-sm font-bold font-mono bg-theme-input border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>
          </div>

          {/* CHANNEL 2: POS TERMINAL */}
          <div className="p-3.5 rounded-2xl liquid-glass-subtle border theme-divider space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-theme-primary flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-sky-500" /> 2. POS Terminal (Card Payments)
              </span>
              {getVarianceBadge(posVariance)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-theme-input/40 border theme-divider">
                <span className="text-[10px] text-theme-muted uppercase block">System Expected POS:</span>
                <span className="text-sm font-bold font-mono text-theme-primary">
                  {formatNaira(channelData.expectedPos)}
                </span>
                <span className="text-[9px] text-theme-muted block mt-0.5">
                  Total card transactions logged today
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">
                  POS Machine Settlement Total (₦):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={actualPos}
                  onChange={(e) => setActualPos(e.target.value)}
                  placeholder="From terminal printout"
                  className="w-full px-3 py-2 rounded-xl text-sm font-bold font-mono bg-theme-input border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                />
              </div>
            </div>
          </div>

          {/* CHANNEL 3: BANK TRANSFERS */}
          <div className="p-3.5 rounded-2xl liquid-glass-subtle border theme-divider space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-theme-primary flex items-center gap-1.5">
                <Building className="w-4 h-4 text-purple-500" /> 3. Direct Bank Transfers
              </span>
              {getVarianceBadge(bankVariance)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-theme-input/40 border theme-divider">
                <span className="text-[10px] text-theme-muted uppercase block">System Expected Bank:</span>
                <span className="text-sm font-bold font-mono text-theme-primary">
                  {formatNaira(channelData.expectedBank)}
                </span>
                <span className="text-[9px] text-theme-muted block mt-0.5">
                  Credit alerts verified at counter
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-theme-secondary uppercase block mb-1">
                  Actual Bank Credit Total (₦):
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={actualBank}
                  onChange={(e) => setActualBank(e.target.value)}
                  placeholder="From bank app alerts"
                  className="w-full px-3 py-2 rounded-xl text-sm font-bold font-mono bg-theme-input border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* OVERALL RECONCILIATION SUMMARY BOX */}
        <div className="p-4 rounded-2xl bg-theme-input/50 border theme-divider space-y-2 text-center">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-[10px] text-theme-muted uppercase block font-bold">Total Expected</span>
              <span className="text-sm font-extrabold font-luxury text-theme-primary tabular-nums">
                {formatNaira(channelData.totalExpected)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-theme-muted uppercase block font-bold">Total Reconciled</span>
              <span className="text-sm font-extrabold font-luxury text-theme-primary tabular-nums">
                {formatNaira(totalActual)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-theme-muted uppercase block font-bold">Net Difference</span>
              <span
                className={`text-sm font-extrabold font-luxury tabular-nums ${
                  totalVariance === 0
                    ? 'text-emerald-500'
                    : totalVariance > 0
                    ? 'text-sky-400'
                    : 'text-rose-500'
                }`}
              >
                {totalVariance === 0
                  ? 'Balanced ✓'
                  : totalVariance > 0
                  ? `+${formatNaira(totalVariance)}`
                  : `-${formatNaira(Math.abs(totalVariance))}`}
              </span>
            </div>
          </div>
        </div>

        {/* Sign-off Notes */}
        <div>
          <label className="text-xs font-bold text-theme-secondary block mb-1">
            Reconciliation & Sign-off Notes (Optional)
          </label>
          <input
            type="text"
            value={reconcileNotes}
            onChange={(e) => setReconcileNotes(e.target.value)}
            placeholder="e.g. ₦150 short on cash due to ₦50 change shortage; POS balanced to the kobo"
            className="w-full px-3.5 py-2 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t theme-divider no-print">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 rounded-xl text-xs font-bold liquid-glass-subtle text-theme-primary hover:opacity-90 flex items-center gap-1 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-2 rounded-xl text-xs font-bold liquid-glass-subtle text-theme-primary hover:opacity-90 flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-theme-secondary hover:text-theme-primary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="liquid-btn-primary px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Lock className="w-3.5 h-3.5" />
              {isSubmitting ? 'Recording Sign-off...' : 'Sign Off & Close Day'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
