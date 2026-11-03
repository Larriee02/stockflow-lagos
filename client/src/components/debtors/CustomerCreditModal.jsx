import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  Calendar,
  Phone,
  MapPin,
  FileText,
  DollarSign,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Modal } from '../ui/Modal';

export function CustomerCreditModal({
  isOpen,
  onClose,
  onSuccess,
  apiFetch,
  existingCustomers = [],
  formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`,
}) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [itemsSummary, setItemsSummary] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [dueDateDays, setDueDateDays] = useState(7);
  const [customDueDate, setCustomDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Auto-fill phone/address when selecting an existing customer name
  const handleNameChange = (val) => {
    setCustomerName(val);
    const match = existingCustomers.find(
      (c) => (c.customer_name || '').toLowerCase() === val.trim().toLowerCase()
    );
    if (match) {
      if (match.phone && !phone) setPhone(match.phone);
      if (match.customer_address && !customerAddress) setCustomerAddress(match.customer_address);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCustomerName('');
      setPhone('');
      setCustomerAddress('');
      setItemsSummary('');
      setTotalAmount('');
      setAmountPaid('0');
      setDueDateDays(7);
      setCustomDueDate('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  const numTotal = Number(totalAmount || 0);
  const numPaid = Number(amountPaid || 0);
  const balanceDue = Math.max(0, Number((numTotal - numPaid).toFixed(2)));

  const computedDueDate = customDueDate
    ? new Date(customDueDate).toISOString()
    : new Date(Date.now() + dueDateDays * 86400000).toISOString();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Please enter a customer name.');
      return;
    }
    if (numTotal <= 0) {
      setError('Total credit amount must be greater than zero.');
      return;
    }
    if (numPaid > numTotal) {
      setError('Amount paid cannot be greater than the total amount.');
      return;
    }
    if (!itemsSummary.trim()) {
      setError('Please enter a summary of the goods taken.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await apiFetch('/api/v1/credits', {
        method: 'POST',
        body: {
          customer_name: customerName.trim(),
          phone: phone.trim() || undefined,
          customer_address: customerAddress.trim() || undefined,
          items_summary: itemsSummary.trim(),
          total_amount: numTotal,
          amount_paid: numPaid,
          due_date: computedDueDate,
          notes: notes.trim() || undefined,
        },
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to record credit transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record New Credit Sale"
      subtitle="Issue goods on credit or part-payment directly to a customer"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Customer Details */}
        <div className="space-y-3 p-3.5 rounded-2xl liquid-glass-subtle border theme-divider">
          <div className="text-xs font-bold uppercase tracking-wider text-theme-secondary">
            Customer Information
          </div>
          <div>
            <label className="text-xs font-bold text-theme-secondary">Customer Name *</label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Mama Chukwudi, Baba Rasheed"
              className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-theme-secondary flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08023456789"
                className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-theme-secondary flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Address / Shop Line
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="e.g. Shop 14, Main Market"
                className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Goods / Bill Information */}
        <div className="space-y-3 p-3.5 rounded-2xl liquid-glass-subtle border theme-divider">
          <div className="text-xs font-bold uppercase tracking-wider text-theme-secondary flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Items Taken
          </div>
          <div>
            <label className="text-xs font-bold text-theme-secondary">Goods Description *</label>
            <input
              type="text"
              required
              value={itemsSummary}
              onChange={(e) => setItemsSummary(e.target.value)}
              placeholder="e.g. 2x Cartons of Indomie, 1x Peak Milk roll"
              className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-bold text-theme-secondary">Total Bill (₦) *</label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm font-bold font-mono bg-theme-input border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-theme-secondary">Amount Paid Down (₦)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
                className="w-full mt-1 px-3.5 py-2 rounded-xl text-sm font-bold font-mono bg-theme-input border border-theme-border text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Balance Due Display */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-theme-input/50 border theme-divider">
            <span className="text-xs font-bold text-theme-secondary">Balance Owed:</span>
            <span className="text-base font-extrabold font-luxury text-theme-outflow tabular-nums">
              {formatNaira(balanceDue)}
            </span>
          </div>
        </div>

        {/* Due Date Presets */}
        <div className="space-y-2 p-3.5 rounded-2xl liquid-glass-subtle border theme-divider">
          <label className="text-xs font-bold text-theme-secondary flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Due Date for Payment
            </span>
            <span className="text-[11px] font-normal text-theme-secondary">
              Due: {new Date(computedDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { days: 3, label: '3 Days' },
              { days: 7, label: '1 Week' },
              { days: 14, label: '2 Weeks' },
              { days: 30, label: '1 Month' },
            ].map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => {
                  setDueDateDays(p.days);
                  setCustomDueDate('');
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  dueDateDays === p.days && !customDueDate
                    ? 'bg-primary/20 border-primary text-theme-primary'
                    : 'liquid-glass-subtle border-theme-border text-theme-secondary hover:text-theme-primary'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="pt-1">
            <label className="text-[11px] text-theme-muted block mb-1">Or pick a specific calendar date:</label>
            <input
              type="date"
              value={customDueDate}
              onChange={(e) => setCustomDueDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="text-xs font-bold text-theme-secondary">Additional Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Promised payment after market day on Friday"
            className="w-full mt-1 px-3.5 py-2 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
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
            disabled={submitting || numTotal <= 0}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold liquid-btn-primary flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {submitting ? 'Recording Credit...' : 'Save Credit Sale'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
