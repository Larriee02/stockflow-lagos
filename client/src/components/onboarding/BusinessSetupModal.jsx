import React, { useState, useEffect } from 'react';
import {
  Store,
  Wallet,
  MapPin,
  Globe,
  Building,
  User,
  CheckCircle2,
  Banknote,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { CURRENCY_OPTIONS } from '../../utils/currency';
import { BUSINESS_TYPES, LAGOS_LOCATIONS } from '../auth/OAuthButtons';

export function BusinessSetupModal({
  isOpen,
  onClose,
  currentUser,
  cashbookSession,
  apiFetch,
  toastSuccess,
  toastError,
  onSuccess,
}) {
  const [form, setForm] = useState({
    full_name: '',
    business_name: '',
    business_type: BUSINESS_TYPES[0],
    city: LAGOS_LOCATIONS[0],
    address: '',
    currency: 'NGN',
    opening_float: '20000',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      const existingOpening = cashbookSession?.todaySession?.opening_balance;
      setForm({
        full_name: currentUser.full_name || '',
        business_name: currentUser.business_name || '',
        business_type: currentUser.business_type || BUSINESS_TYPES[0],
        city: currentUser.city || LAGOS_LOCATIONS[0],
        address: currentUser.address || '',
        currency: currentUser.currency || 'NGN',
        opening_float: existingOpening !== undefined ? String(existingOpening) : '20000',
      });
    }
  }, [isOpen, currentUser, cashbookSession]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 1. Update business profile
      const profileRes = await apiFetch('/api/v1/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          business_name: form.business_name.trim(),
          business_type: form.business_type,
          city: form.city,
          address: form.address.trim(),
          currency: form.currency,
        }),
      });

      // 2. If opening float provided and cashbook session not already set, open session
      const floatVal = Number(form.opening_float);
      if (!Number.isNaN(floatVal) && floatVal >= 0 && !cashbookSession?.todaySession) {
        await apiFetch('/api/v1/cashbook/sessions/open', {
          method: 'POST',
          body: JSON.stringify({
            opening_cash: floatVal,
            opening_balance: floatVal,
            opening_note: 'Store onboarding drawer float',
          }),
        });
      }

      toastSuccess('Business profile and drawer float updated successfully!');
      if (onSuccess) onSuccess(profileRes.user);
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
      title="Set Up Store Profile & Cash Float"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Owner Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="liquid-input w-full pl-10 pr-3 py-2 text-xs rounded-xl"
                placeholder="e.g. Alhaja Bisi Adeyemi"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Store / Business Name
            </label>
            <div className="relative">
              <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
              <input
                type="text"
                required
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                className="liquid-input w-full pl-10 pr-3 py-2 text-xs rounded-xl"
                placeholder="e.g. Bisi Provisions & Wholesale"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Business Category
            </label>
            <select
              value={form.business_type}
              onChange={(e) => setForm({ ...form, business_type: e.target.value })}
              className="liquid-input w-full px-3 py-2 text-xs rounded-xl font-bold"
            >
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Market / City Location
            </label>
            <select
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="liquid-input w-full px-3 py-2 text-xs rounded-xl font-bold"
            >
              {LAGOS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1 text-theme-primary">
            Store Address / Market Stall Number
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="liquid-input w-full pl-10 pr-3 py-2 text-xs rounded-xl"
              placeholder="e.g. Shop 14, Block C, Oke-Arin Market, Lagos Island"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Trading Currency
            </label>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="liquid-input w-full px-3 py-2 text-xs rounded-xl font-bold"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol}) - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Morning Cash Float (Drawer Cash)
            </label>
            <div className="relative">
              <Banknote className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
              <input
                type="number"
                min="0"
                step="any"
                value={form.opening_float}
                onChange={(e) => setForm({ ...form, opening_float: e.target.value })}
                className="liquid-input w-full pl-10 pr-3 py-2 text-xs rounded-xl"
                placeholder="20000"
              />
            </div>
            {/* Quick float presets */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-theme-secondary font-bold">Presets:</span>
              {[0, 10000, 20000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setForm({ ...form, opening_float: String(amt) })}
                  className="px-2 py-0.5 rounded-lg liquid-glass-subtle text-[10px] font-bold text-theme-primary hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  {amt === 0 ? '₦0' : `₦${amt.toLocaleString()}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t theme-divider">
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
            <span>{isSubmitting ? 'Saving Profile...' : 'Save Store Details'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
