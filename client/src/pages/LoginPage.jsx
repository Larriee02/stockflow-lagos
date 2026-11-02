import React, { useState } from 'react';
import {
  Package,
  Sun,
  Moon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  UserPlus,
  Crown,
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../services/api';
import { OAuthButtons } from '../components/auth/OAuthButtons';

export function LoginPage({ darkMode, setDarkMode, onAuthenticated, onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      if (data.token) setStoredToken(data.token);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@stockflowlagos.com',
          password: 'Admin@2026',
        }),
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
      {/* Standalone Login Header */}
      <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl liquid-btn-gold shadow-lg">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold font-luxury text-base sm:text-lg text-theme-primary">
                StockFlow Lagos
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full liquid-glass-subtle text-theme-gold">
                Sign In Portal
              </span>
            </div>
            <span className="hidden sm:block text-[11px] text-theme-secondary">
              Sovereign Retail Inventory, POS & Naira Cashbook Suite
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/signup')}
            className="liquid-btn-gold px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Store Account</span>
          </button>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="liquid-glass-subtle px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-theme-primary cursor-pointer"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden xs:inline">Ivory Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-theme-gold" />
                <span className="hidden xs:inline">Obsidian Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Standalone Sign In Content */}
      <main className="max-w-6xl w-full mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        {/* Left Column: Luxury Executive Brand Showcase */}
        <div className="lg:col-span-6 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-subtle text-xs font-extrabold text-theme-gold">
            <Crown className="w-3.5 h-3.5" />
            <span>Sovereign Edition • Lagos Retail & Wholesale OS</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-[2.65rem] font-extrabold font-luxury leading-[1.12] text-theme-primary">
            Welcome back to your{' '}
            <span className="text-theme-gold">Executive Shop Counter</span> & Cashbook.
          </h1>

          <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed max-w-xl">
            Sign in to access your private store inventory, record counter sales, reconcile POS
            vs physical Naira, or manage platform users from the standalone Admin Control Center.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {[
              {
                title: 'Isolated Store Vault',
                desc: 'Your shelf stock, Naira cashbook, and debtor records are strictly isolated to your account.',
              },
              {
                title: 'Google & Apple Identity',
                desc: 'One-tap sign-in with your verified Google Workspace or Apple ID credentials.',
              },
              {
                title: 'Instant Digital Receipts',
                desc: 'Generate itemized Naira receipts and send them directly to customers on WhatsApp.',
              },
              {
                title: 'Dedicated Admin Portal',
                desc: 'Super Admins are routed to their standalone `/admin` Executive Governance Portal.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="liquid-glass-subtle p-3.5 rounded-2xl space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-theme-primary">
                  <Sparkles className="w-3.5 h-3.5 text-theme-gold shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-[11px] text-theme-secondary leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Dedicated Sign In Card */}
        <div className="lg:col-span-6">
          <div className="liquid-glass-elevated rounded-3xl p-5 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b pb-4 theme-divider">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-theme-gold block">
                  Page Route: /login
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold font-luxury text-theme-primary mt-0.5">
                  Sign In to Your Account
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/signup')}
                className="text-xs font-extrabold text-theme-brand hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Need an account? Sign Up</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Social OAuth Buttons (Google & Apple) */}
            <OAuthButtons
              actionLabel="Sign in"
              onAuthenticated={onAuthenticated}
              onError={setError}
            />

            <div className="relative flex items-center justify-center">
              <div className="border-t w-full theme-divider" />
              <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-theme-muted whitespace-nowrap">
                or sign in with email & password
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
                    autoComplete="email"
                    placeholder="you@yourstore.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="liquid-input w-full pl-10 pr-4 py-3 rounded-2xl text-sm"
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
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="liquid-input w-full pl-10 pr-10 py-3 rounded-2xl text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-theme-primary cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="liquid-btn-primary w-full py-3.5 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{submitting ? 'Signing In...' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* 1-Click Super Admin Portal Helper */}
              <div className="pt-2 border-t theme-divider flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleQuickAdminLogin}
                  disabled={submitting}
                  className="flex-1 py-2.5 px-3 rounded-2xl liquid-glass-subtle text-xs font-extrabold text-theme-gold hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>1-Click Super Admin Portal (admin@stockflowlagos.com)</span>
                </button>
              </div>
            </form>

            <div className="pt-2 border-t theme-divider text-center">
              <p className="text-xs text-theme-secondary">
                Don&apos;t have a store account yet?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/signup')}
                  className="font-extrabold text-theme-gold underline cursor-pointer"
                >
                  Go to the Registration Page (/signup) →
                </button>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-[11px] text-theme-muted">
        StockFlow Lagos Sovereign Edition • Dedicated Sign In Page (/login)
      </footer>
    </div>
  );
}
