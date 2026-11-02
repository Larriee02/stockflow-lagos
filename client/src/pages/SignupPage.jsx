import React, { useState } from 'react';
import {
  Package,
  Sun,
  Moon,
  Mail,
  Lock,
  User,
  Store,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  LogIn,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../services/api';
import { CURRENCY_OPTIONS } from '../utils/currency';
import {
  OAuthButtons,
  BUSINESS_TYPES,
  LAGOS_LOCATIONS,
} from '../components/auth/OAuthButtons';

export function SignupPage({ darkMode, setDarkMode, onAuthenticated, onNavigate }) {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [signupForm, setSignupForm] = useState({
    full_name: '',
    business_name: '',
    email: '',
    phone: '',
    business_type: BUSINESS_TYPES[0],
    city: LAGOS_LOCATIONS[0],
    currency: 'NGN',
    role: 'USER',
    password: '',
    confirm_password: '',
    seed_catalog: false,
  });

  const handleSignup = async (e) => {
    e.preventDefault();
    if (signupForm.password !== signupForm.confirm_password) {
      return setError('Passwords do not match.');
    }
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(signupForm),
      });
      if (data.token) setStoredToken(data.token);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl liquid-btn-primary shadow-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold font-luxury text-base sm:text-lg text-theme-primary block leading-tight">
              StockFlow
            </span>
            <span className="hidden sm:block text-[11px] text-theme-secondary">
              Account Registration & Store Onboarding
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/login')}
            className="liquid-glass-subtle px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 text-theme-primary cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-theme-brand" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="liquid-glass-subtle px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-theme-primary cursor-pointer"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-sky-400" />
                <span className="hidden xs:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-theme-brand" />
                <span className="hidden xs:inline">Dark</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
        {/* Left Column: Onboarding Highlights */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-subtle text-xs font-extrabold text-theme-brand">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Quick Account Setup</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold font-luxury leading-tight text-theme-primary">
            Set up your <span className="text-theme-brand">Retail Workspace</span> in seconds.
          </h1>

          <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
            Create a Store Owner account for daily inventory, POS sales, and cashbook tracking, or
            register an Administrator account to manage and approve platform users.
          </p>

          <div className="space-y-2.5">
            {[
              {
                step: '01',
                title: 'Email, Google, or Apple Registration',
                desc: 'Register with your business details or authenticate via Google or Apple.',
              },
              {
                step: '02',
                title: 'Configurable Display Currency',
                desc: 'Choose your preferred currency (NGN, USD, GBP, EUR, and more) and update it anytime in Settings.',
              },
              {
                step: '03',
                title: 'Role-Based Access & Governance',
                desc: 'Administrators manage user approvals and permissions; Store Owners run their dedicated POS and inventory.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="liquid-glass-subtle p-3.5 rounded-2xl flex items-start gap-3"
              >
                <span className="px-2.5 py-1 rounded-xl liquid-btn-primary text-[11px] font-extrabold font-luxury shrink-0">
                  {s.step}
                </span>
                <div>
                  <div className="text-xs font-extrabold text-theme-primary">{s.title}</div>
                  <p className="text-[11px] text-theme-secondary mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Registration Card */}
        <div className="lg:col-span-7">
          <div className="liquid-glass-elevated rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-4 theme-divider">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold font-luxury text-theme-primary">
                  Create Your Account
                </h2>
                <p className="text-xs text-theme-secondary mt-0.5">
                  Complete your profile details below
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="text-xs font-extrabold text-theme-brand hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Already have an account? Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Social OAuth Sign-Up Buttons (Google & Apple) */}
            <OAuthButtons
              actionLabel="Sign up"
              onAuthenticated={onAuthenticated}
              onError={setError}
            />

            <div className="relative flex items-center justify-center">
              <div className="border-t w-full theme-divider" />
              <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-theme-muted whitespace-nowrap">
                or register with email
              </span>
              <div className="border-t w-full theme-divider" />
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-2xl text-xs font-bold text-theme-outflow bg-rose-500/10 border border-rose-500/25"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type="text"
                      required
                      placeholder="Full name"
                      value={signupForm.full_name}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, full_name: e.target.value })
                      }
                      className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Business / Store Name
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type="text"
                      required
                      placeholder="Business or store name"
                      value={signupForm.business_name}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, business_name: e.target.value })
                      }
                      className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={signupForm.email}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, email: e.target.value })
                      }
                      className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type="tel"
                      placeholder="+234 800 000 0000"
                      value={signupForm.phone}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, phone: e.target.value })
                      }
                      className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Account Role
                  </label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <select
                      value={signupForm.role}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, role: e.target.value })
                      }
                      className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                    >
                      <option value="USER">Store Owner / Merchant</option>
                      <option value="ADMIN">Platform Administrator</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Default Currency
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <select
                      value={signupForm.currency}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, currency: e.target.value })
                      }
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
                    Business Category
                  </label>
                  <select
                    value={signupForm.business_type}
                    onChange={(e) =>
                      setSignupForm({ ...signupForm, business_type: e.target.value })
                    }
                    className="liquid-input w-full px-3 py-2.5 rounded-xl text-xs"
                  >
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Location
                  </label>
                  <select
                    value={signupForm.city}
                    onChange={(e) => setSignupForm({ ...signupForm, city: e.target.value })}
                    className="liquid-input w-full px-3 py-2.5 rounded-xl text-xs"
                  >
                    {LAGOS_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      value={signupForm.password}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, password: e.target.value })
                      }
                      className="liquid-input w-full pl-10 pr-9 py-2.5 rounded-xl text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-secondary cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Re-enter password"
                      value={signupForm.confirm_password}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, confirm_password: e.target.value })
                      }
                      className="liquid-input w-full pl-10 pr-3 py-2.5 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              <label className="liquid-glass-subtle p-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold cursor-pointer text-theme-primary">
                <input
                  type="checkbox"
                  checked={signupForm.seed_catalog}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, seed_catalog: e.target.checked })
                  }
                />
                <span>
                  Include sample retail product templates (with <strong>0 initial stock</strong>)
                </span>
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="liquid-btn-primary w-full py-3.5 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {submitting ? 'Creating Account...' : 'Create Account'}
                </span>
              </button>
            </form>

            <div className="pt-2 border-t theme-divider text-center">
              <p className="text-xs text-theme-secondary">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="font-extrabold text-theme-brand underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-[11px] text-theme-muted">
        StockFlow • Retail Inventory & Cashbook Platform
      </footer>
    </div>
  );
}
