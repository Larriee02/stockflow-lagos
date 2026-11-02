import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldAlert,
  XCircle,
  RefreshCw,
  LogOut,
  Sun,
  Moon,
  Package,
  Store,
  Mail,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { Badge } from '../ui/Badge';

export function AccountStatusScreen({
  user,
  darkMode,
  setDarkMode,
  onUserUpdated,
  onLogout,
}) {
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date());

  const checkStatus = async () => {
    setChecking(true);
    try {
      const data = await apiFetch('/api/v1/auth/me');
      setLastChecked(new Date());
      if (data?.user) {
        onUserUpdated(data.user);
      }
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  };

  // Auto-poll every 10 seconds while pending so approval unlocks automatically
  useEffect(() => {
    if (user?.status !== 'PENDING') return;
    const timer = setInterval(checkStatus, 10000);
    return () => clearInterval(timer);
  }, [user?.status]);

  const isPending = user?.status === 'PENDING';
  const isSuspended = user?.status === 'SUSPENDED';

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6">
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-2xl liquid-btn-primary">
            <Package className="w-5 h-5" />
          </div>
          <span className="font-extrabold font-luxury text-base sm:text-lg text-theme-primary">
            StockFlow Lagos
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="liquid-glass-subtle px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-theme-primary cursor-pointer"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-theme-brand" />
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="liquid-glass-subtle px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-theme-outflow cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <div className="max-w-lg w-full mx-auto my-auto py-8">
        <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl liquid-glass-subtle flex items-center justify-center">
            {isPending ? (
              <Clock className="w-8 h-8 text-theme-warning" />
            ) : isSuspended ? (
              <ShieldAlert className="w-8 h-8 text-theme-outflow" />
            ) : (
              <XCircle className="w-8 h-8 text-theme-outflow" />
            )}
          </div>

          <div className="space-y-2">
            <Badge variant={isPending ? 'warning' : 'danger'}>
              {isPending
                ? 'AWAITING ADMIN APPROVAL'
                : isSuspended
                ? 'ACCOUNT SUSPENDED'
                : 'REGISTRATION DECLINED'}
            </Badge>

            <h1 className="text-xl sm:text-2xl font-extrabold font-luxury text-theme-primary pt-1">
              {isPending
                ? 'Your Store Account Is Pending Approval'
                : isSuspended
                ? 'Your Store Access Is Currently Suspended'
                : 'Your Store Registration Was Declined'}
            </h1>

            <p className="text-xs sm:text-sm text-theme-secondary leading-relaxed">
              {isPending
                ? 'Thank you for registering on StockFlow Lagos! A platform administrator is reviewing your store registration. As soon as your account is approved, this screen will unlock automatically.'
                : isSuspended
                ? 'An administrator has temporarily paused access to this store account. Please contact the platform administrator to restore access.'
                : 'Your registration request was declined by the platform administrator. Please contact support if you believe this was a mistake.'}
            </p>
          </div>

          <div className="liquid-glass-subtle rounded-2xl p-4 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-theme-secondary font-semibold flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" /> Business Name:
              </span>
              <span className="font-extrabold text-theme-primary">{user?.business_name}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-theme-secondary font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Account Email:
              </span>
              <span className="font-bold text-theme-primary">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-theme-secondary font-semibold">Sign-In Method:</span>
              <Badge variant="info">{user?.auth_provider}</Badge>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={checkStatus}
              disabled={checking}
              className="liquid-btn-primary flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              <span>{checking ? 'Checking Status...' : 'Check Approval Status Now'}</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="liquid-glass-subtle py-3 px-4 rounded-2xl text-xs sm:text-sm font-bold text-theme-secondary cursor-pointer"
            >
              Switch Account
            </button>
          </div>

          <p className="text-[11px] text-theme-secondary">
            Last checked at {lastChecked.toLocaleTimeString()} (auto-refreshes every 10s)
          </p>
        </div>
      </div>

      <footer className="text-center text-[11px] text-theme-secondary">
        StockFlow Lagos Security & Merchant Verification
      </footer>
    </div>
  );
}
