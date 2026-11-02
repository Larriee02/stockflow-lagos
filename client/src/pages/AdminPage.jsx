import React from 'react';
import {
  ShieldCheck,
  Store,
  Sun,
  Moon,
  LogOut,
  CheckCircle2,
  ArrowUpRight,
  Settings,
} from 'lucide-react';
import { AdminConsole } from '../components/admin/AdminConsole';
import { getCurrencySymbol } from '../utils/currency';

export function AdminPage({
  currentUser,
  darkMode,
  setDarkMode,
  onNavigate,
  onLogout,
  toast,
  onToast,
}) {
  const currencyCode = currentUser?.currency || 'NGN';
  const currencySymbol = getCurrencySymbol(currencyCode);

  return (
    <div className="min-h-screen pb-16">
      {/* Admin Header */}
      <header className="liquid-glass-header text-slate-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl liquid-btn-primary shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-extrabold font-luxury tracking-tight truncate text-white">
                  Administration Console
                </h1>
                <span className="text-[10px] sm:text-[11px] bg-sky-400/20 text-sky-200 border border-sky-300/35 px-2.5 py-0.5 rounded-full font-extrabold">
                  {currencyCode} ({currencySymbol})
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300/90 truncate font-medium">
                {currentUser.full_name} ({currentUser.email}) • Administrator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch to Store Workspace */}
            <button
              type="button"
              onClick={() => onNavigate('/store/sell')}
              className="liquid-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Store Workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/settings')}
              className="flex items-center gap-1.5 bg-white/12 hover:bg-white/20 text-slate-100 border border-white/25 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
              title="Account & Currency Settings"
            >
              <Settings className="w-4 h-4 text-sky-300" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-1.5 bg-white/12 hover:bg-white/20 text-slate-100 border border-white/25 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-sky-300" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-sky-200" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 bg-rose-500/25 hover:bg-rose-500/40 text-slate-100 border border-rose-300/35 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-200" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5">
        {toast && (
          <div className="liquid-btn-primary px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        <AdminConsole currentUser={currentUser} onToast={onToast} />
      </main>
    </div>
  );
}
