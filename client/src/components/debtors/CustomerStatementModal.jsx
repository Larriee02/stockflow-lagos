import React, { useState, useEffect } from 'react';
import {
  FileText,
  Printer,
  MessageCircle,
  Copy,
  Check,
  Calendar,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Store,
  Phone,
  MapPin,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';

export function CustomerStatementModal({
  isOpen,
  onClose,
  customerName,
  storeName = 'StockFlow Store',
  storePhone = '',
  storeAddress = '',
  apiFetch,
  formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`,
}) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !customerName) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiFetch(`/api/v1/credits/customers/${encodeURIComponent(customerName)}/statement`)
      .then((data) => {
        if (isMounted) {
          setStatement(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load customer statement.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, customerName, apiFetch]);

  const handlePrint = () => {
    window.print();
  };

  const sanitizePhone = (raw) => {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 11) {
      digits = '234' + digits.slice(1);
    } else if (digits.length === 10) {
      digits = '234' + digits;
    }
    return digits;
  };

  const buildStatementText = () => {
    if (!statement) return '';
    const cust = statement.customer;
    const summ = statement.summary;
    const ledger = statement.ledger || [];

    const lines = [
      `=====================================`,
      `STATEMENT OF ACCOUNT`,
      `${storeName.toUpperCase()}`,
      storeAddress ? `${storeAddress}` : '',
      storePhone ? `Tel: ${storePhone}` : '',
      `Date Issued: ${new Date().toLocaleDateString('en-GB')}`,
      `=====================================`,
      `Customer: ${cust.name}`,
      cust.phone ? `Phone: ${cust.phone}` : '',
      cust.address ? `Address: ${cust.address}` : '',
      `-------------------------------------`,
      `SUMMARY:`,
      `Total Goods Billed:   ${formatNaira(summ.total_credit_taken)}`,
      `Total Payments Made:  ${formatNaira(summ.total_paid)}`,
      `CURRENT BALANCE DUE:  ${formatNaira(summ.current_balance_due)}`,
      `Status: ${summ.current_balance_due <= 0 ? 'SETTLED' : summ.is_overdue ? 'OVERDUE' : 'OWING'}`,
      `-------------------------------------`,
      `TRANSACTION LEDGER:`,
    ];

    for (const item of ledger) {
      const dateStr = new Date(item.date).toLocaleDateString('en-GB');
      if (item.debit > 0) {
        lines.push(`[${dateStr}] PURCHASE: +${formatNaira(item.debit)} | (${item.description}) | Bal: ${formatNaira(item.running_balance)}`);
      } else {
        lines.push(`[${dateStr}] PAYMENT:  -${formatNaira(item.credit)} | (${item.description}) | Bal: ${formatNaira(item.running_balance)}`);
      }
    }

    lines.push(`=====================================`);
    lines.push(`Thank you for your business!`);
    return lines.filter(Boolean).join('\n');
  };

  const handleCopy = async () => {
    const text = buildStatementText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const cleanPhone = statement?.customer?.phone ? sanitizePhone(statement.customer.phone) : '';
  const shareWhatsAppUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(buildStatementText())}`
    : `https://wa.me/?text=${encodeURIComponent(buildStatementText())}`;

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Statement of Account"
      subtitle={`Detailed credit and payment ledger for ${customerName}`}
    >
      <div className="space-y-4">
        {/* Loading state */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-theme-secondary" />
            <p className="text-xs text-theme-secondary">Compiling chronological customer ledger...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
            {error}
          </div>
        )}

        {/* Loaded Statement View */}
        {statement && !loading && (
          <div className="space-y-4 printable-statement">
            {/* Store & Customer Header Card */}
            <div className="liquid-glass-subtle rounded-2xl p-4 border theme-divider space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b theme-divider pb-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-theme-secondary flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" /> {storeName}
                  </div>
                  <div className="text-[11px] text-theme-muted mt-0.5">
                    {storeAddress && <span>{storeAddress} • </span>}
                    {storePhone && <span>Tel: {storePhone}</span>}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-mono uppercase bg-theme-input px-2.5 py-1 rounded-lg border theme-divider text-theme-secondary">
                    Statement #{customerName.slice(0, 3).toUpperCase()}-{Date.now().toString().slice(-4)}
                  </span>
                  <div className="text-[10px] text-theme-muted mt-1">
                    Issued: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-theme-secondary">Customer Account</div>
                  <div className="text-base font-extrabold font-luxury text-theme-primary">
                    {statement.customer.name}
                  </div>
                  <div className="text-xs text-theme-secondary flex items-center gap-2 mt-0.5">
                    {statement.customer.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {statement.customer.phone}
                      </span>
                    )}
                    {statement.customer.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {statement.customer.address}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  {statement.summary.current_balance_due <= 0 ? (
                    <Badge variant="success">ACCOUNT FULLY SETTLED</Badge>
                  ) : statement.summary.is_overdue ? (
                    <Badge variant="danger">
                      <AlertTriangle className="w-3 h-3 mr-1 inline" />
                      OVERDUE BALANCE
                    </Badge>
                  ) : (
                    <Badge variant="warning">OUTSTANDING BALANCE</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* KPI Summary Banner */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="liquid-glass-subtle rounded-xl p-2.5 border theme-divider">
                <div className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">
                  Total Purchases
                </div>
                <div className="text-sm font-extrabold font-luxury text-theme-primary tabular-nums mt-0.5">
                  {formatNaira(statement.summary.total_credit_taken)}
                </div>
              </div>
              <div className="liquid-glass-subtle rounded-xl p-2.5 border theme-divider">
                <div className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">
                  Total Repaid
                </div>
                <div className="text-sm font-extrabold font-luxury text-theme-inflow tabular-nums mt-0.5">
                  {formatNaira(statement.summary.total_paid)}
                </div>
              </div>
              <div className="liquid-glass-subtle rounded-xl p-2.5 border theme-divider">
                <div className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">
                  Balance Owed
                </div>
                <div className="text-sm font-extrabold font-luxury text-theme-outflow tabular-nums mt-0.5">
                  {formatNaira(statement.summary.current_balance_due)}
                </div>
              </div>
            </div>

            {/* Ledger Table */}
            <div className="liquid-glass-subtle rounded-2xl border theme-divider overflow-hidden">
              <div className="p-3 border-b theme-divider flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-theme-primary flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Itemized Activity Ledger
                </span>
                <span className="text-[10px] text-theme-secondary">
                  {statement.ledger.length} {statement.ledger.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-theme-input text-[10px] font-bold uppercase tracking-wider text-theme-secondary border-b theme-divider sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Description / Goods</th>
                      <th className="py-2.5 px-3 text-right">Debit (+)</th>
                      <th className="py-2.5 px-3 text-right">Credit (-)</th>
                      <th className="py-2.5 px-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-divider font-mono text-[11px]">
                    {statement.ledger.map((row) => {
                      const isPurchase = row.debit > 0;
                      return (
                        <tr key={row.id} className="hover:bg-white/20 dark:hover:bg-white/5 transition">
                          <td className="py-2 px-3 whitespace-nowrap text-theme-secondary">
                            {new Date(row.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: '2-digit',
                            })}
                          </td>
                          <td className="py-2 px-3 font-sans text-theme-primary">
                            <div className="font-bold flex items-center gap-1">
                              {isPurchase ? (
                                <ArrowUpRight className="w-3 h-3 text-rose-500 shrink-0" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3 text-emerald-500 shrink-0" />
                              )}
                              <span>{row.title}</span>
                            </div>
                            <div className="text-[10px] text-theme-secondary truncate max-w-xs">
                              {row.description}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-rose-500">
                            {row.debit > 0 ? formatNaira(row.debit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold text-emerald-500">
                            {row.credit > 0 ? formatNaira(row.credit) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-theme-primary">
                            {formatNaira(row.running_balance)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note / Remittance Footer */}
            <div className="p-3 rounded-xl bg-theme-input/50 border theme-divider text-[11px] text-theme-secondary flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-theme-primary">Payment Settlement: </span>
                Kindly make payments in cash at our counter or via direct bank transfer. Once paid, your statement will immediately reflect zero balance.
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t theme-divider no-print">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3.5 py-2 rounded-xl text-xs font-bold liquid-glass-subtle text-theme-primary hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" /> Statement Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Text
                  </>
                )}
              </button>

              <a
                href={shareWhatsAppUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Share Statement <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl text-xs font-extrabold liquid-btn-primary flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print / Save PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
