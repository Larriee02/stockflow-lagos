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
  MapPin,
  Eye,
  EyeOff,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../../services/api';
import { Modal } from '../ui/Modal';

const BUSINESS_TYPES = [
  'Provision & Convenience Store',
  'Mini-Mart / Supermarket',
  'Wholesale Market Depot',
  'Drinks & Beverage Retailer',
  'Cosmetics & Household Goods',
  'Pharmacy & Chemist',
  'General Trading & Retail',
];

const LAGOS_LOCATIONS = [
  'Lagos Mainland (Ikeja / Yaba / Surulere)',
  'Lagos Island (Oke-Arin / Idumota / Marina)',
  'Lekki / Ajah / Victoria Island',
  'Mushin / Oshodi / Isolo',
  'Alimosho / Egbeda / Iyana Ipaja',
  'Festac / Trade Fair / Amuwo-Odofin',
  'Ikorodu / Ketu / Mile 12',
  'Agege / Ogba / Berger',
  'Other Location (Nigeria)',
];

function GoogleIcon() {
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

function AppleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export function AuthScreen({ darkMode, setDarkMode, onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup Form
  const [signupForm, setSignupForm] = useState({
    full_name: '',
    business_name: '',
    email: '',
    phone: '',
    business_type: BUSINESS_TYPES[0],
    city: LAGOS_LOCATIONS[0],
    password: '',
    seed_catalog: true,
  });

  // OAuth Modal State (Google / Apple)
  const [oauthProvider, setOauthProvider] = useState(null); // 'GOOGLE' | 'APPLE' | null
  const [oauthForm, setOauthForm] = useState({
    email: '',
    full_name: '',
    business_name: '',
    phone: '',
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (data.token) setStoredToken(data.token);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
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

  const handleOauthSubmit = async (e) => {
    e.preventDefault();
    if (!oauthProvider) return;
    setError('');
    setSubmitting(true);
    try {
      const data = await apiFetch('/api/v1/auth/oauth', {
        method: 'POST',
        body: JSON.stringify({
          provider: oauthProvider,
          email: oauthForm.email,
          full_name: oauthForm.full_name,
          business_name: oauthForm.business_name,
          phone: oauthForm.phone,
        }),
      });
      if (data.token) setStoredToken(data.token);
      setOauthProvider(null);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillAdminCredentials = () => {
    setMode('login');
    setError('');
    setLoginEmail('admin@stockflowlagos.com');
    setLoginPassword('Admin@2026');
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-3.5 sm:p-6">
      {/* Top Bar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-2xl liquid-btn-primary shadow-md">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold font-luxury text-base sm:text-xl text-theme-primary tracking-tight">
              StockFlow Lagos
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] font-bold px-2.5 py-0.5 rounded-full liquid-glass-subtle text-theme-brand">
              Retail & Provision Cloud (₦)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="liquid-glass-subtle px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-theme-primary cursor-pointer"
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-theme-brand" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl w-full mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Brand Story Column */}
        <div className="lg:col-span-6 space-y-5 px-1 sm:px-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass-subtle text-xs font-bold text-theme-brand">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built for Lagos Provision Traders & Retail Businesses</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold font-luxury leading-tight text-theme-primary">
            Take Control of Your Shelf Stock, Counter Sales & Naira Cashflow.
          </h1>

          <p className="text-xs sm:text-sm leading-relaxed text-theme-secondary">
            Whether you run a neighborhood provision store, wholesale market depot, or mini-mart in
            Lagos, StockFlow keeps every carton, roll, POS transfer, cash note, and customer debt
            organized in one place.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {[
              {
                title: 'Fast Counter Checkout',
                desc: 'Record Cash, Moniepoint/OPay POS, Bank Transfer & part-payments in seconds.',
              },
              {
                title: 'Physical Shelf Stock-Taking',
                desc: 'Track rolls, cartons, packs & single pieces with automatic low-stock alerts.',
              },
              {
                title: 'Debtors Book + WhatsApp',
                desc: 'Know every customer owing your shop and send polite 1-click WhatsApp reminders.',
              },
              {
                title: 'Isolated & Admin-Protected',
                desc: 'Every business gets its own private workspace verified by platform administrators.',
              },
            ].map((item) => (
              <div key={item.title} className="liquid-glass p-3.5 rounded-2xl space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-extrabold font-luxury text-theme-primary">
                  <CheckCircle2 className="w-4 h-4 text-theme-inflow shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-[11px] text-theme-secondary leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Auth Card */}
        <div className="lg:col-span-6">
          <div className="liquid-glass-elevated rounded-3xl p-5 sm:p-8 space-y-5">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl liquid-glass-subtle">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer ${
                  mode === 'login' ? 'liquid-btn-primary shadow-sm' : 'text-theme-secondary'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`py-2.5 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer ${
                  mode === 'signup' ? 'liquid-btn-primary shadow-sm' : 'text-theme-secondary'
                }`}
              >
                Create Store Account
              </button>
            </div>

            {/* Social OAuth Buttons (Google & Apple) */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setOauthProvider('GOOGLE');
                  }}
                  className="liquid-glass-subtle hover:scale-[1.01] active:scale-99 py-2.5 px-3.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 text-theme-primary cursor-pointer"
                >
                  <GoogleIcon />
                  <span>{mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setOauthProvider('APPLE');
                  }}
                  className="liquid-glass-subtle hover:scale-[1.01] active:scale-99 py-2.5 px-3.5 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 text-theme-primary cursor-pointer"
                >
                  <AppleIcon />
                  <span>{mode === 'login' ? 'Sign in with Apple' : 'Sign up with Apple'}</span>
                </button>
              </div>

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1" style={{ backgroundColor: 'var(--divider-color)' }} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary">
                  or continue with email
                </span>
                <div className="h-px flex-1" style={{ backgroundColor: 'var(--divider-color)' }} />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-2xl text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-theme-outflow">
                {error}
              </div>
            )}

            {/* SIGN IN FORM */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@yourstore.com"
                      className="liquid-input w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="liquid-input w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="liquid-btn-primary w-full py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{submitting ? 'Signing In...' : 'Sign In to My Store'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Quick Admin Access Helper */}
                <div className="pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--divider-color)' }}>
                  <div className="flex items-center gap-1.5 text-[11px] text-theme-secondary">
                    <ShieldCheck className="w-4 h-4 text-theme-brand shrink-0" />
                    <span>Platform Administrator?</span>
                  </div>
                  <button
                    type="button"
                    onClick={fillAdminCredentials}
                    className="text-[11px] font-extrabold text-theme-brand hover:underline cursor-pointer"
                  >
                    Fill Admin Login
                  </button>
                </div>
              </form>
            ) : (
              /* SIGN UP FORM */
              <form onSubmit={handleSignup} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-theme-primary">
                      Your Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                      <input
                        type="text"
                        required
                        value={signupForm.full_name}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, full_name: e.target.value })
                        }
                        placeholder="e.g. Alhaja Kudirat Bello"
                        className="liquid-input w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-theme-primary">
                      Shop / Business Name *
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                      <input
                        type="text"
                        required
                        value={signupForm.business_name}
                        onChange={(e) =>
                          setSignupForm({ ...signupForm, business_name: e.target.value })
                        }
                        placeholder="e.g. Kudi Best Provisions"
                        className="liquid-input w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-theme-primary">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                      <input
                        type="email"
                        required
                        value={signupForm.email}
                        onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                        placeholder="you@example.com"
                        className="liquid-input w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-theme-primary">
                      WhatsApp / Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                      <input
                        type="tel"
                        value={signupForm.phone}
                        onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                        placeholder="e.g. 08031234567"
                        className="liquid-input w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-theme-primary">
                      Business Type
                    </label>
                    <select
                      value={signupForm.business_type}
                      onChange={(e) =>
                        setSignupForm({ ...signupForm, business_type: e.target.value })
                      }
                      className="liquid-input w-full px-3 py-2 rounded-xl text-xs sm:text-sm"
                    >
                      {BUSINESS_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-theme-primary">
                      Store Area / Location
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary pointer-events-none" />
                      <select
                        value={signupForm.city}
                        onChange={(e) => setSignupForm({ ...signupForm, city: e.target.value })}
                        className="liquid-input w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm"
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

                <div>
                  <label className="block text-xs font-bold mb-1 text-theme-primary">
                    Create Password (min. 6 characters) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                      placeholder="At least 6 characters"
                      className="liquid-input w-full pl-10 pr-10 py-2 rounded-xl text-xs sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold text-theme-secondary cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={signupForm.seed_catalog}
                    onChange={(e) =>
                      setSignupForm({ ...signupForm, seed_catalog: e.target.checked })
                    }
                  />
                  <span>
                    Pre-load Lagos provision starter catalog (Peak, Indomie, Sugar, etc. at 0 stock)
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="liquid-btn-primary w-full py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>{submitting ? 'Creating Store Account...' : 'Create My Store Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <footer className="text-center text-[11px] text-theme-secondary py-2">
        StockFlow Lagos — Multi-Store Retail Inventory, Cashbook & Admin Governance Platform
      </footer>

      {/* GOOGLE / APPLE OAUTH SIGN-IN MODAL */}
      <Modal
        isOpen={Boolean(oauthProvider)}
        onClose={() => setOauthProvider(null)}
        title={
          oauthProvider === 'GOOGLE' ? 'Continue with Google Account' : 'Continue with Apple ID'
        }
        subtitle={`Sign in or create your StockFlow Lagos store account using your ${
          oauthProvider === 'GOOGLE' ? 'Google' : 'Apple'
        } identity.`}
      >
        <form onSubmit={handleOauthSubmit} className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl liquid-glass-subtle">
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800 shadow-xs">
              {oauthProvider === 'GOOGLE' ? <GoogleIcon /> : <AppleIcon />}
            </div>
            <div className="text-xs">
              <p className="font-extrabold text-theme-primary">
                {oauthProvider === 'GOOGLE'
                  ? 'Google Identity Verification'
                  : 'Apple ID Verification'}
              </p>
              <p className="text-theme-secondary">
                If you already have an account, we will sign you right in. Otherwise, we will set up
                your new shop workspace.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              {oauthProvider === 'GOOGLE' ? 'Google Email Address *' : 'Apple ID Email Address *'}
            </label>
            <input
              type="email"
              required
              autoFocus
              value={oauthForm.email}
              onChange={(e) => setOauthForm({ ...oauthForm, email: e.target.value })}
              placeholder={
                oauthProvider === 'GOOGLE' ? 'yourname@gmail.com' : 'yourname@icloud.com'
              }
              className="liquid-input w-full rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Your Name (for new signup)
              </label>
              <input
                type="text"
                value={oauthForm.full_name}
                onChange={(e) => setOauthForm({ ...oauthForm, full_name: e.target.value })}
                placeholder="e.g. Chinedu Okafor"
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Shop / Business Name
              </label>
              <input
                type="text"
                value={oauthForm.business_name}
                onChange={(e) => setOauthForm({ ...oauthForm, business_name: e.target.value })}
                placeholder="e.g. Chinedu Super Stores"
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              WhatsApp / Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={oauthForm.phone}
              onChange={(e) => setOauthForm({ ...oauthForm, phone: e.target.value })}
              placeholder="e.g. 08031234567"
              className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOauthProvider(null)}
              className="px-4 py-2 text-xs font-semibold text-theme-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="liquid-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer flex items-center gap-2"
            >
              {oauthProvider === 'GOOGLE' ? <GoogleIcon /> : <AppleIcon />}
              <span>
                {submitting
                  ? 'Connecting...'
                  : `Continue with ${oauthProvider === 'GOOGLE' ? 'Google' : 'Apple'}`}
              </span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
