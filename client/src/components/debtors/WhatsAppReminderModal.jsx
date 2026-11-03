import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  Calendar,
  AlertTriangle,
  Phone,
  Send,
  Sparkles,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';

export function WhatsAppReminderModal({
  isOpen,
  onClose,
  debtor,
  storeName = 'Our Store',
  storePhone = '',
  formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`,
}) {
  const [templateKey, setTemplateKey] = useState('gentle');
  const [customPhone, setCustomPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Normalize debtor info whether passed as aggregate customer ledger or single credit invoice
  const customerName = debtor?.customer_name || 'Valued Customer';
  const balanceDue = Number(
    debtor?.total_balance_due !== undefined ? debtor.total_balance_due : debtor?.balance_due || 0
  );
  const totalBilled = Number(
    debtor?.total_credit_taken !== undefined ? debtor.total_credit_taken : debtor?.total_amount || balanceDue
  );
  const totalPaid = Number(
    debtor?.total_paid !== undefined ? debtor.total_paid : debtor?.amount_paid || 0
  );
  const dueDate = debtor?.due_date || debtor?.earliest_due_date || null;
  const isOverdue = Boolean(debtor?.is_overdue);
  const daysOverdue = Number(debtor?.days_overdue || debtor?.max_days_overdue || 0);
  const itemsSummary = debtor?.items_summary || (debtor?.invoices?.length ? `${debtor.invoices.length} credit purchases` : 'goods purchased on credit');

  const formattedDueDate = useMemo(() => {
    if (!dueDate) return 'as soon as possible';
    try {
      return new Date(dueDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return String(dueDate);
    }
  }, [dueDate]);

  // Clean phone number for WhatsApp wa.me link
  const sanitizePhone = (raw) => {
    if (!raw) return '';
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 11) {
      digits = '234' + digits.slice(1);
    } else if (digits.startsWith('234')) {
      // Already good
    } else if (digits.length === 10) {
      digits = '234' + digits;
    }
    return digits;
  };

  useEffect(() => {
    if (debtor) {
      setCustomPhone(debtor.phone || '');
      setCopied(false);
      // Default to urgent template if already overdue
      if (debtor.is_overdue) {
        setTemplateKey('overdue');
      } else {
        setTemplateKey('gentle');
      }
    }
  }, [debtor]);

  // Templates
  const templates = useMemo(() => {
    const sName = storeName || 'Our Store';
    const sPhone = storePhone ? ` or reach us on ${storePhone}` : '';

    return {
      gentle: {
        id: 'gentle',
        name: 'Gentle Reminder',
        tag: 'Friendly & Polite',
        text: `Hello ${customerName}, warm greetings from ${sName}! ✨\n\nHope your week is going smoothly. This is a gentle reminder regarding your outstanding balance of *${formatNaira(
          balanceDue
        )}* for (${itemsSummary}).\n\nWhenever it is convenient, we would truly appreciate your payment. Thank you so much for your continued patronage! 🙏`,
      },
      due_soon: {
        id: 'due_soon',
        name: 'Due Date Reminder',
        tag: 'Professional',
        text: `Hello ${customerName}, polite reminder from ${sName} that your pending balance of *${formatNaira(
          balanceDue
        )}* is scheduled for settlement by *${formattedDueDate}*.\n\nKindly let us know if you need our bank account details for a direct transfer${sPhone}. Thank you for doing business with us!`,
      },
      overdue: {
        id: 'overdue',
        name: 'Urgent Overdue Notice',
        tag: 'Important',
        text: `⚠️ *PAYMENT REMINDER NOTICE*\n\nHello ${customerName}, your outstanding balance of *${formatNaira(
          balanceDue
        )}* with ${sName} was due on *${formattedDueDate}* and is currently *${
          daysOverdue > 0 ? `${daysOverdue} days overdue` : 'overdue'
        }*.\n\nPlease arrange for payment today${sPhone} so we can update your customer ledger. We appreciate your prompt attention to this. Thank you.`,
      },
      statement: {
        id: 'statement',
        name: 'Full Account Summary',
        tag: 'Itemized Breakdown',
        text: `📊 *CUSTOMER STATEMENT SUMMARY*\nCustomer: *${customerName}*\nStore: *${sName}*\n\n• Total Goods Taken: ${formatNaira(
          totalBilled
        )}\n• Total Paid So Far: ${formatNaira(totalPaid)}\n• *Current Balance Due: ${formatNaira(
          balanceDue
        )}*\n• Due Date: ${formattedDueDate}\n\nKindly review and let us know when we can expect settlement. Thank you!`,
      },
    };
  }, [
    customerName,
    storeName,
    storePhone,
    formatNaira,
    balanceDue,
    itemsSummary,
    formattedDueDate,
    daysOverdue,
    totalBilled,
    totalPaid,
  ]);

  // Update customMessage whenever template or dependencies change
  useEffect(() => {
    if (templates[templateKey]) {
      setCustomMessage(templates[templateKey].text);
    }
  }, [templateKey, templates]);

  const cleanPhone = sanitizePhone(customPhone);
  const isValidPhone = cleanPhone.length >= 10;
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMessage)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  if (!isOpen || !debtor) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send WhatsApp Reminder"
      subtitle={`Send a professional payment reminder to ${customerName}`}
    >
      <div className="space-y-4">
        {/* Customer Balance Banner */}
        <div className="liquid-glass-subtle rounded-2xl p-3.5 flex items-center justify-between gap-3 border theme-divider">
          <div>
            <div className="text-xs font-semibold text-theme-secondary">Current Balance Owed</div>
            <div className="text-xl font-extrabold font-luxury text-theme-outflow tabular-nums">
              {formatNaira(balanceDue)}
            </div>
            {dueDate && (
              <div className="text-[11px] text-theme-secondary flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" /> Due {formattedDueDate}
              </div>
            )}
          </div>
          <div className="text-right">
            {isOverdue ? (
              <Badge variant="danger">
                <AlertTriangle className="w-3 h-3 mr-1 inline" />
                {daysOverdue > 0 ? `${daysOverdue} Days Overdue` : 'Overdue'}
              </Badge>
            ) : (
              <Badge variant="warning">Owing</Badge>
            )}
            <div className="text-[11px] text-theme-secondary mt-1">
              {debtor.phone ? debtor.phone : 'No phone saved'}
            </div>
          </div>
        </div>

        {/* Customer Phone Input (editable if missing or needs international prefix) */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-theme-secondary flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> WhatsApp Phone Number
            </span>
            <span className="text-[11px] font-normal text-theme-secondary">
              {cleanPhone ? `Intl: +${cleanPhone}` : 'Nigerian local or international'}
            </span>
          </label>
          <input
            type="tel"
            value={customPhone}
            onChange={(e) => setCustomPhone(e.target.value)}
            placeholder="e.g. 08012345678 or 2348012345678"
            className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          />
          {!isValidPhone && (
            <p className="text-[11px] text-amber-500">
              Please enter a valid 11-digit Nigerian or international phone number to send via WhatsApp.
            </p>
          )}
        </div>

        {/* Template Selector Chips */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-theme-secondary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Select Message Style
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(templates).map((t) => {
              const active = templateKey === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateKey(t.id)}
                  className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-500 text-theme-primary font-bold shadow-sm'
                      : 'liquid-glass-subtle border-theme-border text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{t.name}</span>
                    {active && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-theme-muted mt-0.5">{t.tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editable Message Box */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-theme-secondary flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Customize Message Before Sending
            </label>
            <span className="text-[10px] text-theme-muted">{customMessage.length} characters</span>
          </div>
          <textarea
            rows={5}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-emerald-500/50 leading-relaxed font-sans resize-y"
          />
        </div>

        {/* WhatsApp Chat Preview Bubble */}
        <div className="rounded-2xl bg-emerald-950/20 dark:bg-emerald-950/40 border border-emerald-500/30 p-3 space-y-2">
          <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Preview (What customer sees)
          </div>
          <div className="bg-emerald-600/10 dark:bg-emerald-900/30 rounded-2xl rounded-tl-sm p-3 text-xs text-theme-primary whitespace-pre-wrap font-sans border border-emerald-500/20 shadow-inner">
            {customMessage}
            <div className="text-right text-[10px] text-emerald-500/70 mt-1 font-mono">
              Just now ✓✓
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t theme-divider">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold liquid-glass-subtle text-theme-primary hover:opacity-90 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied to Clipboard
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Message
              </>
            )}
          </button>

          {isValidPhone ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" /> Open in WhatsApp <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-gray-500/30 text-gray-400 cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" /> Enter Valid Phone to Send
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
