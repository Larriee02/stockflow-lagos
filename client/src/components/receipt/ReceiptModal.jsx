import React, { useState } from 'react';
import {
  Printer,
  Share2,
  Copy,
  Check,
  MessageCircle,
  X,
  Store,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const PAYMENT_LABELS = {
  CASH: 'Cash',
  POS: 'POS Terminal (Moniepoint/OPay)',
  BANK_TRANSFER: 'Bank Transfer',
  MOBILE_MONEY: 'Mobile Wallet / USSD',
};

/**
 * Production-Grade Printable & Shareable Receipt Component
 *
 * Implements:
 * - Dedicated print isolation (#printable-receipt) for thermal POS / paper printing
 * - 1-Click WhatsApp customer dispatch
 * - Native Mobile Web Share API (iOS / Android)
 * - Plain-text clipboard receipt copy
 * - Clear display of items purchased, amount paid, and balance due (debtor highlight)
 */
export function ReceiptModal({ isOpen, onClose, receipt, formatNaira }) {
  const [copied, setCopied] = useState(false);

  if (!receipt) return null;

  const paymentLabel = PAYMENT_LABELS[receipt.paymentMethod] || receipt.paymentMethod || 'Cash';
  const isCredit = (receipt.balanceDue || 0) > 0;
  const isPaidInFull = !isCredit;

  // Build clean plain text version for copying & sharing
  const generateReceiptText = () => {
    const divider = '------------------------------------------';
    const itemsText = (receipt.items || [])
      .map(
        (i) =>
          `${i.quantity} ${i.unit || 'pcs'} x ${i.name}\n   @ ${formatNaira(i.unitPrice)} = ${formatNaira(i.lineTotal)}`
      )
      .join('\n');

    return [
      `==========================================`,
      `       ${(receipt.businessName || 'STOCKFLOW STORE').toUpperCase()}`,
      `       ${receipt.location || 'Lagos, Nigeria'}`,
      `==========================================`,
      `Receipt No: ${receipt.receiptNo || 'N/A'}`,
      `Date/Time:  ${receipt.timestamp || new Date().toLocaleString()}`,
      `Cashier:    ${receipt.cashierName || 'Attendant'}`,
      `Customer:   ${receipt.customerName || 'Walk-in Customer'}`,
      receipt.customerPhone ? `Phone:      ${receipt.customerPhone}` : null,
      divider,
      `ITEMS PURCHASED:`,
      itemsText,
      divider,
      `TOTAL BILL:    ${formatNaira(receipt.totalBill)}`,
      `AMOUNT PAID:   ${formatNaira(receipt.amountPaid)} (${paymentLabel})`,
      isCredit
        ? `BALANCE DUE:   ${formatNaira(receipt.balanceDue)} [OWING - RECORDED IN CREDIT BOOK]`
        : `STATUS:        PAID IN FULL [OFFICIAL RECEIPT]`,
      divider,
      `Thank you for your patronage!`,
      `Goods received in good condition.`,
      `==========================================`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateReceiptText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleWhatsAppShare = () => {
    const text = generateReceiptText();
    const cleanPhone = (receipt.customerPhone || '')
      .replace(/\D/g, '')
      .replace(/^0/, '234');
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Receipt #${receipt.receiptNo} - ${receipt.businessName}`,
          text: generateReceiptText(),
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Official Sales Receipt"
      subtitle={`Receipt #${receipt.receiptNo} • ${receipt.timestamp || ''}`}
    >
      <div className="space-y-4">
        {/* Printable Paper Receipt Slip Container */}
        <div
          id="printable-receipt"
          className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md font-sans space-y-4"
        >
          {/* Receipt Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300 dark:border-slate-700 space-y-1">
            <h3 className="text-base sm:text-lg font-black tracking-tight uppercase font-luxury text-slate-900 dark:text-white">
              {receipt.businessName || 'StockFlow Lagos Store'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {receipt.location || 'Lagos, Nigeria'}
            </p>
            <div className="pt-1 flex items-center justify-center gap-2">
              <Badge variant={isPaidInFull ? 'success' : 'warning'}>
                {isPaidInFull ? 'PAID IN FULL' : 'PART-PAYMENT / DEBTOR'}
              </Badge>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 py-1 border-b border-dashed border-slate-200 dark:border-slate-800">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">Receipt:</span>{' '}
              <span className="font-mono">{receipt.receiptNo}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-800 dark:text-slate-200">Date:</span>{' '}
              <span>{receipt.timestamp}</span>
            </div>
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">Customer:</span>{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {receipt.customerName || 'Walk-in Customer'}
              </span>
            </div>
            <div className="text-right">
              <span className="font-bold text-slate-800 dark:text-slate-200">Cashier:</span>{' '}
              <span>{receipt.cashierName || 'Attendant'}</span>
            </div>
            {receipt.customerPhone && (
              <div className="col-span-2">
                <span className="font-bold text-slate-800 dark:text-slate-200">Phone:</span>{' '}
                <span className="font-mono">{receipt.customerPhone}</span>
              </div>
            )}
          </div>

          {/* Itemized Table */}
          <div className="space-y-2">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-800 flex justify-between">
              <span>Item & Description</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(receipt.items || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between text-xs gap-3 py-1 border-b border-slate-100 dark:border-slate-800/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-slate-100 break-words">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {item.quantity} {item.unit || 'pcs'} × {formatNaira(item.unitPrice)}
                    </p>
                  </div>
                  <div className="font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums shrink-0 text-right">
                    {formatNaira(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="pt-2 border-t-2 border-slate-300 dark:border-slate-700 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-700 dark:text-slate-300 font-bold">
              <span>Total Bill</span>
              <span className="font-mono text-sm tabular-nums">
                {formatNaira(receipt.totalBill)}
              </span>
            </div>

            <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-bold">
              <span>Amount Paid ({paymentLabel})</span>
              <span className="font-mono text-sm tabular-nums">
                {formatNaira(receipt.amountPaid)}
              </span>
            </div>

            {isCredit ? (
              <div className="flex justify-between items-center p-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-extrabold">
                <span className="flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Balance Due (Owing)
                </span>
                <span className="font-mono text-sm tabular-nums">
                  {formatNaira(receipt.balanceDue)}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 font-medium">
                <span>Balance Due</span>
                <span className="font-mono tabular-nums">{formatNaira(0)}</span>
              </div>
            )}
          </div>

          {/* Receipt Footer Message */}
          <div className="pt-3 text-center border-t border-dashed border-slate-300 dark:border-slate-700 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Thank you for shopping with us!
            </p>
            <p className="text-[10px]">
              Goods collected in good condition • Powered by StockFlow Lagos
            </p>
          </div>
        </div>

        {/* Action Controls (WhatsApp, Print, Copy, Native Share) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 no-print">
          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp Share Button */}
            <Button
              variant="luxury"
              size="sm"
              leftIcon={MessageCircle}
              onClick={handleWhatsAppShare}
              className="!bg-emerald-600 hover:!bg-emerald-700 !text-white"
            >
              Share on WhatsApp
            </Button>

            {/* Print Button */}
            <Button
              variant="secondary"
              size="sm"
              leftIcon={Printer}
              onClick={handlePrint}
            >
              Print Slip
            </Button>

            {/* Native Mobile Share Button */}
            {typeof navigator !== 'undefined' && navigator.share && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={Share2}
                onClick={handleNativeShare}
              >
                Share
              </Button>
            )}

            {/* Copy Text Button */}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={copied ? Check : Copy}
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy Text'}
            </Button>
          </div>

          <Button variant="primary" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
