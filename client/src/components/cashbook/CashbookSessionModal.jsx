import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  Lock,
  Unlock,
  Sparkles,
  Banknote,
  CreditCard,
  History,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

export function CashbookSessionModal({
  isOpen,
  onClose,
  initialMode = 'OPEN', // 'OPEN' | 'CLOSE'
  sessionState,
  apiFetch,
  formatCurrency,
  currencySymbol = '₦',
  toastSuccess,
  toastError,
  onSuccess,
}) {
  const [mode, setMode] = useState(initialMode);
  const [sessionDate, setSessionDate] = useState(
    sessionState?.targetDate || new Date().toISOString().slice(0, 10)
  );
  const [openingCash, setOpeningCash] = useState('');
  const [openingBankPos, setOpeningBankPos] = useState('');
  const [openingNote, setOpeningNote] = useState('');

  const [actualClosingCash, setActualClosingCash] = useState('');
  const [actualClosingBankPos, setActualClosingBankPos] = useState('');
  const [closingNote, setClosingNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      const target = sessionState?.targetDate || new Date().toISOString().slice(0, 10);
      setSessionDate(target);

      const curSess = sessionState?.todaySession;
      const initOpenCash =
        curSess?.opening_cash !== undefined && curSess?.opening_cash !== null
          ? String(curSess.opening_cash)
          : String(sessionState?.effectiveOpeningCash ?? sessionState?.suggestedOpeningCash ?? 0);
      const initOpenBank =
        curSess?.opening_bank_pos !== undefined && curSess?.opening_bank_pos !== null
          ? String(curSess.opening_bank_pos)
          : String(sessionState?.effectiveOpeningBankPos ?? sessionState?.suggestedOpeningBankPos ?? 0);

      setOpeningCash(initOpenCash);
      setOpeningBankPos(initOpenBank);
      setOpeningNote(curSess?.opening_note || '');

      const initCloseCash =
        curSess?.actual_closing_cash !== undefined && curSess?.actual_closing_cash !== null
          ? String(curSess.actual_closing_cash)
          : String(sessionState?.expectedClosingCash ?? 0);
      const initCloseBank =
        curSess?.actual_closing_bank_pos !== undefined && curSess?.actual_closing_bank_pos !== null
          ? String(curSess.actual_closing_bank_pos)
          : String(sessionState?.expectedClosingBankPos ?? 0);

      setActualClosingCash(initCloseCash);
      setActualClosingBankPos(initCloseBank);
      setClosingNote(curSess?.closing_note || '');
    }
  }, [isOpen, initialMode, sessionState]);

  const totalOpeningInput = useMemo(() => {
    const c = Number(openingCash || 0);
    const b = Number(openingBankPos || 0);
    return Number(((Number.isNaN(c) ? 0 : c) + (Number.isNaN(b) ? 0 : b)).toFixed(2));
  }, [openingCash, openingBankPos]);

  const totalActualClosingInput = useMemo(() => {
    const c = Number(actualClosingCash || 0);
    const b = Number(actualClosingBankPos || 0);
    return Number(((Number.isNaN(c) ? 0 : c) + (Number.isNaN(b) ? 0 : b)).toFixed(2));
  }, [actualClosingCash, actualClosingBankPos]);

  const dayInflow = Number(sessionState?.dayInflow || 0);
  const dayOutflow = Number(sessionState?.dayOutflow || 0);
  const expectedClosing = useMemo(() => {
    return Number((totalOpeningInput + dayInflow - dayOutflow).toFixed(2));
  }, [totalOpeningInput, dayInflow, dayOutflow]);

  const variance = useMemo(() => {
    return Number((totalActualClosingInput - expectedClosing).toFixed(2));
  }, [totalActualClosingInput, expectedClosing]);

  const handlePrefillSuggestedOpening = () => {
    setOpeningCash(String(sessionState?.suggestedOpeningCash ?? 0));
    setOpeningBankPos(String(sessionState?.suggestedOpeningBankPos ?? 0));
    setOpeningNote('Carried forward from previous closing balance');
  };

  const handleMatchExpectedClosing = () => {
    const expCash = Number(openingCash || 0) + Number(sessionState?.dayCashInflow || 0) - Number(sessionState?.dayCashOutflow || 0);
    const expBank = Number(openingBankPos || 0) + Number(sessionState?.dayBankPosInflow || 0) - Number(sessionState?.dayBankPosOutflow || 0);
    setActualClosingCash(String(Number(expCash.toFixed(2))));
    setActualClosingBankPos(String(Number(expBank.toFixed(2))));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === 'OPEN') {
        await apiFetch('/api/v1/cashbook/sessions/open', {
          method: 'POST',
          body: JSON.stringify({
            session_date: sessionDate,
            opening_cash: Number(openingCash || 0),
            opening_bank_pos: Number(openingBankPos || 0),
            opening_balance: totalOpeningInput,
            opening_note: openingNote,
          }),
        });
        toastSuccess?.(`Opening balance (${formatCurrency(totalOpeningInput)}) saved for ${sessionDate}!`);
      } else {
        await apiFetch('/api/v1/cashbook/sessions/close', {
          method: 'POST',
          body: JSON.stringify({
            session_date: sessionDate,
            opening_cash: Number(openingCash || 0),
            opening_bank_pos: Number(openingBankPos || 0),
            opening_balance: totalOpeningInput,
            actual_closing_cash: Number(actualClosingCash || 0),
            actual_closing_bank_pos: Number(actualClosingBankPos || 0),
            actual_closing_balance: totalActualClosingInput,
            closing_note: closingNote,
          }),
        });
        toastSuccess?.(`Daily cashbook reconciled & closed for ${sessionDate}!`);
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toastError?.(err.message || 'Failed to save cashbook session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Cashbook Opening & Closing Balance"
      subtitle="Start the day with your opening drawer float and reconcile physical cash + POS/Bank at closing"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-900/70 border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('OPEN')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'OPEN'
                ? 'liquid-btn-primary shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            1. Set Opening Balance
          </button>
          <button
            type="button"
            onClick={() => setMode('CLOSE')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'CLOSE'
                ? 'liquid-btn-primary shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            2. Reconcile & Close Day
          </button>
        </div>

        {/* Date & Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <label className="text-xs font-bold text-slate-300">Register Date:</label>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="liquid-input text-xs rounded-xl px-2.5 py-1.5"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={sessionState?.todaySession?.status === 'CLOSED' ? 'success' : 'info'}
            >
              {sessionState?.todaySession?.status === 'CLOSED'
                ? 'RECONCILED & CLOSED'
                : 'REGISTER OPEN'}
            </Badge>
          </div>
        </div>

        {mode === 'OPEN' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Morning Opening Float & Balance
                </h4>
                <p className="text-[11px] text-slate-400">
                  Enter the cash in your shop drawer and available POS/Bank float at the start of business.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePrefillSuggestedOpening}
                className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Sparkles className="w-3 h-3" />
                Carry Forward ({formatCurrency(sessionState?.suggestedOpeningBalance || 0)})
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <Banknote className="w-4 h-4" />
                  Opening Physical Cash ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="any"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="0.00"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-sm font-bold"
                />
                <span className="text-[10px] text-slate-400 block">
                  Notes & coins inside the shop counter drawer
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                  <CreditCard className="w-4 h-4" />
                  Opening POS & Bank Float ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="any"
                  value={openingBankPos}
                  onChange={(e) => setOpeningBankPos(e.target.value)}
                  placeholder="0.00"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-sm font-bold"
                />
                <span className="text-[10px] text-slate-400 block">
                  Starting balance in shop POS / business bank account
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-200">
                Total Combined Opening Balance:
              </span>
              <span className="text-lg font-extrabold font-luxury tabular-nums text-emerald-400">
                {formatCurrency(totalOpeningInput)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-300">
                Opening Note (Optional)
              </label>
              <input
                type="text"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="e.g. Morning float verified before opening shop"
                className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Expected vs Actual Reconciliation Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase block">Opening Balance</span>
                <strong className="text-xs sm:text-sm font-bold text-slate-200 tabular-nums">
                  {formatCurrency(totalOpeningInput)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
                <span className="text-[10px] text-emerald-400 uppercase block">+ Day Money In</span>
                <strong className="text-xs sm:text-sm font-bold text-emerald-400 tabular-nums">
                  +{formatCurrency(dayInflow)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40">
                <span className="text-[10px] text-rose-400 uppercase block">- Day Money Out</span>
                <strong className="text-xs sm:text-sm font-bold text-rose-400 tabular-nums">
                  -{formatCurrency(dayOutflow)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-sky-950/30 border border-sky-800/40">
                <span className="text-[10px] text-sky-400 uppercase block">= Expected Closing</span>
                <strong className="text-xs sm:text-sm font-extrabold text-sky-300 tabular-nums">
                  {formatCurrency(expectedClosing)}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Enter Actual Counted Closing Balances
              </h4>
              <button
                type="button"
                onClick={handleMatchExpectedClosing}
                className="liquid-glass-subtle px-2.5 py-1 rounded-xl text-[11px] font-bold text-sky-400 border border-sky-500/30 cursor-pointer"
              >
                Prefill Expected Amounts
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Banknote className="w-4 h-4" />
                    Actual Cash Counted ({currencySymbol})
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Expected: {formatCurrency(Number(openingCash || 0) + Number(sessionState?.dayCashInflow || 0) - Number(sessionState?.dayCashOutflow || 0))}
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={actualClosingCash}
                  onChange={(e) => setActualClosingCash(e.target.value)}
                  placeholder="0.00"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-sm font-bold"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                    <CreditCard className="w-4 h-4" />
                    Actual POS / Bank Total ({currencySymbol})
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Expected: {formatCurrency(Number(openingBankPos || 0) + Number(sessionState?.dayBankPosInflow || 0) - Number(sessionState?.dayBankPosOutflow || 0))}
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  value={actualClosingBankPos}
                  onChange={(e) => setActualClosingBankPos(e.target.value)}
                  placeholder="0.00"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-sm font-bold"
                />
              </div>
            </div>

            {/* Variance Banner */}
            <div
              className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                variance === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : variance > 0
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {variance === 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                )}
                <div>
                  <div className="text-xs font-bold">
                    {variance === 0
                      ? 'Cashbook Balanced Perfectly (Zero Variance)'
                      : variance > 0
                      ? `Cash Surplus / Overage (+${formatCurrency(variance)})`
                      : `Cash Shortage / Discrepancy (${formatCurrency(variance)})`}
                  </div>
                  <div className="text-[11px] opacity-80">
                    Actual Closing: {formatCurrency(totalActualClosingInput)} vs Expected:{' '}
                    {formatCurrency(expectedClosing)}
                  </div>
                </div>
              </div>
              <span className="text-base font-extrabold font-luxury tabular-nums">
                {formatCurrency(totalActualClosingInput)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-slate-300">
                Closing Reconciliation Note (Optional)
              </label>
              <input
                type="text"
                value={closingNote}
                onChange={(e) => setClosingNote(e.target.value)}
                placeholder="e.g. All POS slips reconciled with Moniepoint settlement report"
                className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>
        )}

        {/* Recent Reconciled Sessions Log */}
        {Array.isArray(sessionState?.sessions) && sessionState.sessions.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-emerald-400" />
              Recent Daily Register Logs
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
              {sessionState.sessions.slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800/70"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-200">
                      {String(s.session_date).slice(0, 10)}
                    </span>
                    <Badge variant={s.status === 'CLOSED' ? 'success' : 'info'}>
                      {s.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums text-[11px]">
                    <span className="text-slate-400">
                      Open: <strong className="text-slate-200">{formatCurrency(s.opening_balance)}</strong>
                    </span>
                    {s.status === 'CLOSED' && (
                      <>
                        <span className="text-slate-400">
                          Close: <strong className="text-emerald-400">{formatCurrency(s.actual_closing_balance)}</strong>
                        </span>
                        {Number(s.variance || 0) !== 0 && (
                          <span
                            className={
                              Number(s.variance) > 0 ? 'text-sky-400 font-bold' : 'text-rose-400 font-bold'
                            }
                          >
                            ({Number(s.variance) > 0 ? '+' : ''}
                            {formatCurrency(s.variance)})
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting} className="flex items-center gap-1.5">
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : mode === 'OPEN' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Confirm Opening Balance
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Save & Close Daily Register
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
