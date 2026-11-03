import React, { useState } from 'react';
import { Mail, User, Store, Phone, MapPin, Globe, ShieldCheck } from 'lucide-react';
import { apiFetch, setStoredToken } from '../../services/api';
import { CURRENCY_OPTIONS } from '../../utils/currency';
import { Modal } from '../ui/Modal';

export const BUSINESS_TYPES = [
  'Supermarket & Grocery',
  'Provision & Convenience Store',
  'Wholesale & Distribution',
  'Beverage & Drinks Outlet',
  'Pharmacy & Health Store',
  'Cosmetics & Household Retail',
  'General Merchandise',
];

export const LAGOS_LOCATIONS = [
  'Ikeja / Yaba / Surulere',
  'Lagos Island / Marina',
  'Lekki / Victoria Island / Ajah',
  'Mushin / Oshodi / Isolo',
  'Alimosho / Egbeda',
  'Festac / Amuwo-Odofin',
  'Ikorodu / Ketu',
  'Agege / Ogba / Berger',
  'Other Location',
];

export function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function OAuthButtons({ actionLabel = 'Continue', onAuthenticated, onError }) {
  const [oauthProvider, setOauthProvider] = useState(null); // 'GOOGLE' | 'APPLE'
  const [submitting, setSubmitting] = useState(false);
  const [oauthForm, setOauthForm] = useState({
    email: '',
    full_name: '',
    business_name: '',
    phone: '',
    city: LAGOS_LOCATIONS[0],
    currency: 'NGN',
    role: 'USER',
  });

  const handleOAuthSubmit = async (e) => {
    e.preventDefault();
    if (!oauthProvider) return;
    setSubmitting(true);
    if (onError) onError('');
    try {
      const data = await apiFetch('/api/v1/auth/oauth', {
        method: 'POST',
        body: JSON.stringify({
          provider: oauthProvider,
          email: oauthForm.email.trim(),
          full_name: oauthForm.full_name.trim(),
          business_name: oauthForm.business_name.trim(),
          phone: oauthForm.phone.trim(),
          city: oauthForm.city,
          currency: oauthForm.currency,
          role: oauthForm.role,
        }),
      });
      if (data.token) setStoredToken(data.token);
      setOauthProvider(null);
      onAuthenticated(data.user);
    } catch (err) {
      if (onError) onError(err.message);
      else alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (onError) onError('');
            setOauthProvider('GOOGLE');
          }}
          className="liquid-glass-subtle hover:scale-[1.01] active:scale-[0.99] py-3 px-4 rounded-2xl text-xs font-extrabold text-theme-primary flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <GoogleIcon />
          <span>{actionLabel} with Google</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (onError) onError('');
            setOauthProvider('APPLE');
          }}
          className="liquid-glass-subtle hover:scale-[1.01] active:scale-[0.99] py-3 px-4 rounded-2xl text-xs font-extrabold text-theme-primary flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <AppleIcon />
          <span>{actionLabel} with Apple</span>
        </button>
      </div>

      <Modal
        isOpen={Boolean(oauthProvider)}
        onClose={() => setOauthProvider(null)}
        title={`${actionLabel} with ${oauthProvider === 'GOOGLE' ? 'Google' : 'Apple'}`}
        subtitle={
          oauthProvider === 'GOOGLE'
            ? 'Authenticate using your Google account'
            : 'Authenticate using your Apple ID'
        }
      >
        <form onSubmit={handleOAuthSubmit} className="space-y-3.5">
          <div className="liquid-glass-subtle p-3.5 rounded-2xl flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-xs">
              {oauthProvider === 'GOOGLE' ? <GoogleIcon /> : <AppleIcon />}
            </div>
            <div className="text-xs">
              <div className="font-extrabold text-theme-primary">
                {oauthProvider === 'GOOGLE' ? 'Google Authentication' : 'Apple ID Authentication'}
              </div>
              <div className="text-theme-secondary">
                Returning accounts sign in immediately. New accounts are created with the details
                below.
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              {oauthProvider === 'GOOGLE' ? 'Google Email' : 'Apple ID Email'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
              <input
                type="email"
                required
                autoFocus
                placeholder={
                  oauthProvider === 'GOOGLE' ? 'name@gmail.com' : 'name@icloud.com'
                }
                value={oauthForm.email}
                onChange={(e) => setOauthForm({ ...oauthForm, email: e.target.value })}
                className="liquid-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Full Name (New Accounts)
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={oauthForm.full_name}
                  onChange={(e) => setOauthForm({ ...oauthForm, full_name: e.target.value })}
                  className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Business Name (New Accounts)
              </label>
              <div className="relative">
                <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                <input
                  type="text"
                  placeholder="Store or company name"
                  value={oauthForm.business_name}
                  onChange={(e) =>
                    setOauthForm({ ...oauthForm, business_name: e.target.value })
                  }
                  className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Default Currency
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                <select
                  value={oauthForm.currency}
                  onChange={(e) => setOauthForm({ ...oauthForm, currency: e.target.value })}
                  className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} — {c.code} ({c.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                <input
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={oauthForm.phone}
                  onChange={(e) => setOauthForm({ ...oauthForm, phone: e.target.value })}
                  className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Location
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                <select
                  value={oauthForm.city}
                  onChange={(e) => setOauthForm({ ...oauthForm, city: e.target.value })}
                  className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                >
                  {LAGOS_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOauthProvider(null)}
              className="px-4 py-2 text-xs font-bold text-theme-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="liquid-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer disabled:opacity-50"
            >
              {submitting
                ? 'Authenticating...'
                : `Continue with ${oauthProvider === 'GOOGLE' ? 'Google' : 'Apple'}`}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
