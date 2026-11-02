import React, { useState } from 'react';
import {
  Package,
  Sun,
  Moon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch, setStoredToken } from '../services/api';
import { OAuthButtons } from '../components/auth/OAuthButtons';
import { OtpVerificationStep } from '../components/auth/OtpVerificationStep';

export function LoginPage({ darkMode, setDarkMode, onAuthenticated, onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step state: 'FORM' | 'OTP'
  const [step, setStep] = useState('FORM');
  const [otpInfo, setOtpInfo] = useState(null);

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

      // Two-Factor OTP required
      if (data.otpRequired) {
        setOtpInfo(data);
        setStep('OTP');
        return;
      }

      if (data.token) setStoredToken(data.token);
      onAuthenticated(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtpAndLogin = async (otpCode) => {
    setSubmitting(true);
    setError('');
    try {
      const data = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          otp: otpCode,
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

  const handleResendOtp = async (preferredChannel) => {
    setError('');
    const data = await apiFetch('/api/v1/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'LOGIN',
        email: email.trim(),
        channel: preferredChannel || 'EMAIL',
      }),
    });
    setOtpInfo(data);
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
              Retail Operations, Inventory & Cashbook Platform
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('/signup')}
            className="liquid-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
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
      <main className="max-w-6xl w-full mx-auto my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
        {/* Left Column: Platform Overview */}
        <div className="lg:col-span-6 space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full liquid-glass-subtle text-xs font-extrabold text-theme-brand">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Multi-Currency Retail & Inventory Suite</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-[2.65rem] font-extrabold font-luxury leading-[1.12] text-theme-primary">
            Streamlined <span className="text-theme-brand">Point of Sale</span>, Inventory &
            Cashbook Management.
          </h1>

          <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed max-w-xl">
            Sign in to manage your inventory catalog, process counter sales, reconcile payment
            channels, and track customer receivables in real time.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {[
              {
                title: 'Dedicated Workspace',
                desc: 'Isolated inventory, cashbook ledger, and credit records per account.',
              },
              {
                title: 'Email & SMS OTP Verification',
                desc: 'Fast, secure one-time passcode verification for enhanced account protection.',
              },
              {
                title: 'Multi-Currency Support',
                desc: 'Switch seamlessly between NGN, USD, GBP, EUR, GHS, KES, ZAR, and CAD.',
              },
              {
                title: 'Real-Time Reconciliation',
                desc: 'Instant visibility across cash, POS terminals, and bank transfers.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="liquid-glass-subtle p-3.5 rounded-2xl space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-theme-primary">
                  <Sparkles className="w-3.5 h-3.5 text-theme-brand shrink-0" />
                  <span>{item.title}</span>
                </div>
                <p className="text-[11px] text-theme-secondary leading-snug">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Sign In Card */}
        <div className="lg:col-span-6">
          <div className="liquid-glass-elevated rounded-3xl p-5 sm:p-8 space-y-5">
            {step === 'OTP' ? (
              <OtpVerificationStep
                purpose="LOGIN"
                email={email}
                phone={otpInfo?.phone}
                maskedDestination={otpInfo?.maskedDestination}
                otpPreview={otpInfo?.otpPreview}
                submitting={submitting}
                error={error}
                onVerify={handleVerifyOtpAndLogin}
                onResend={handleResendOtp}
                onBack={() => setStep('FORM')}
              />
            ) : (
              <>
                <div className="flex items-center justify-between border-b pb-4 theme-divider">
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold font-luxury text-theme-primary">
                      Sign In
                    </h2>
                    <p className="text-xs text-theme-secondary mt-0.5">
                      Access your store workspace or admin console
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('/signup')}
                    className="text-xs font-extrabold text-theme-brand hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Create Account</span>
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
                    or continue with email
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
                        placeholder="name@company.com"
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
                    <span>{submitting ? 'Verifying...' : 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="pt-2 border-t theme-divider text-center">
                  <p className="text-xs text-theme-secondary">
                    Don&apos;t have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate('/signup')}
                      className="font-extrabold text-theme-brand underline cursor-pointer"
                    >
                      Register a new account
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-6xl w-full mx-auto text-center text-[11px] text-theme-muted">
        StockFlow • Retail Inventory & Cashbook Platform
      </footer>
    </div>
  );
}
