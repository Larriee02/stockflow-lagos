import React, { useState } from 'react';
import {
  Package,
  Sun,
  Moon,
  User,
  Store,
  Phone,
  MapPin,
  Lock,
  Globe,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { apiFetch } from '../services/api';
import { CURRENCY_OPTIONS } from '../utils/currency';
import { BUSINESS_TYPES, LAGOS_LOCATIONS } from '../components/auth/OAuthButtons';
import { Badge } from '../components/ui/Badge';

export function SettingsPage({
  currentUser,
  darkMode,
  setDarkMode,
  onUserUpdated,
  onNavigate,
  onLogout,
  toast,
  onToast,
}) {
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: currentUser?.full_name || '',
    business_name: currentUser?.business_name || '',
    phone: currentUser?.phone || '',
    business_type: currentUser?.business_type || BUSINESS_TYPES[0],
    city: currentUser?.city || LAGOS_LOCATIONS[0],
    currency: currentUser?.currency || 'NGN',
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    setSubmittingProfile(true);
    try {
      const data = await apiFetch('/api/v1/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      if (data?.user) {
        onUserUpdated(data.user);
      }
      onToast('Account & currency preferences saved.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handleSelectCurrency = async (code) => {
    const nextForm = { ...profileForm, currency: code };
    setProfileForm(nextForm);
    try {
      const data = await apiFetch('/api/v1/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(nextForm),
      });
      if (data?.user) {
        onUserUpdated(data.user);
      }
      onToast(`Display currency updated to ${code}.`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      return alert('New password and confirmation do not match.');
    }
    setSubmittingPassword(true);
    try {
      await apiFetch('/api/v1/auth/password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password,
        }),
      });
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      onToast('Password updated successfully.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmittingPassword(false);
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="min-h-screen pb-16">
      {/* Top Header */}
      <header className="liquid-glass-header text-slate-100 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl liquid-btn-primary">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 style={{ color: '#f8fafc' }} className="text-base sm:text-lg font-extrabold font-luxury">
                Account & Currency Settings
              </h1>
              <p className="text-xs text-slate-300">
                {currentUser.full_name} • {currentUser.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="flex items-center gap-1.5 bg-white/12 hover:bg-white/20 text-white border border-white/20 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-sky-300" />
                <span>Admin Console</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('/store/sell')}
              className="liquid-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Store Workspace</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-1.5 bg-white/12 hover:bg-white/20 text-white border border-white/20 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-sky-300" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {toast && (
          <div className="liquid-btn-primary px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Section 1: Currency & Regional Format */}
        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3.5 theme-divider">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl liquid-glass-subtle text-theme-brand">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold font-luxury text-theme-primary">
                  Display Currency
                </h2>
                <p className="text-xs text-theme-secondary">
                  Choose the currency used across your inventory, point of sale, cashbook, and reports.
                </p>
              </div>
            </div>
            <Badge variant="info">Active: {profileForm.currency}</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CURRENCY_OPTIONS.map((curr) => {
              const active = profileForm.currency === curr.code;
              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => handleSelectCurrency(curr.code)}
                  className={`p-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                    active
                      ? 'liquid-btn-primary'
                      : 'liquid-glass-subtle hover:opacity-90'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold font-luxury">{curr.symbol}</span>
                    <span className="text-[11px] font-bold opacity-85">{curr.code}</span>
                  </div>
                  <div className="text-xs font-semibold mt-1 truncate">{curr.name}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Store & Account Profile */}
        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3.5 theme-divider">
            <div>
              <h2 className="text-base font-extrabold font-luxury text-theme-primary">
                Profile & Business Information
              </h2>
              <p className="text-xs text-theme-secondary">
                Update your account details and business profile shown on customer receipts.
              </p>
            </div>
            <Badge variant={isAdmin ? 'info' : 'success'}>
              {isAdmin ? 'Administrator' : 'Verified Merchant'}
            </Badge>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <input
                    type="text"
                    required
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, full_name: e.target.value })
                    }
                    className="liquid-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  Business / Store Name
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <input
                    type="text"
                    required
                    value={profileForm.business_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, business_name: e.target.value })
                    }
                    className="liquid-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                    className="liquid-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  Business Category
                </label>
                <select
                  value={profileForm.business_type}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, business_type: e.target.value })
                  }
                  className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-sm"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  Location / Region
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <select
                    value={profileForm.city}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, city: e.target.value })
                    }
                    className="liquid-input w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm"
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
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  Default Currency
                </label>
                <select
                  value={profileForm.currency}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, currency: e.target.value })
                  }
                  className="liquid-input w-full px-3.5 py-2.5 rounded-xl text-sm font-bold"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submittingProfile}
                className="liquid-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer disabled:opacity-50"
              >
                {submittingProfile ? 'Saving Changes...' : 'Save Profile & Preferences'}
              </button>
            </div>
          </form>
        </section>

        {/* Section 3: Password & Security */}
        <section className="liquid-glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3.5 theme-divider">
            <div>
              <h2 className="text-base font-extrabold font-luxury text-theme-primary">
                Security & Password
              </h2>
              <p className="text-xs text-theme-secondary">
                Sign-in method: <strong>{currentUser.auth_provider || 'EMAIL'}</strong>
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <input
                    type="password"
                    placeholder="Leave blank if OAuth account"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, current_password: e.target.value })
                    }
                    className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, new_password: e.target.value })
                    }
                    className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Repeat new password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                    }
                    className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Account</span>
              </button>

              <button
                type="submit"
                disabled={submittingPassword}
                className="liquid-glass-subtle px-5 py-2.5 rounded-xl text-xs font-extrabold text-theme-primary cursor-pointer disabled:opacity-50"
              >
                {submittingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
