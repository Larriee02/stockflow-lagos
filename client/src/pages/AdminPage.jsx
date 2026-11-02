import React from 'react';
import {
  ShieldCheck,
  Store,
  Sun,
  Moon,
  LogOut,
  Crown,
  ArrowUpRight,
} from 'lucide-react';
import { AdminConsole } from '../components/admin/AdminConsole';

export function AdminPage({
  currentUser,
  darkMode,
  setDarkMode,
  onNavigate,
  onLogout,
  toast,
  onToast,
}) {
  return (
    <div className="min-h-screen pb-16">
      {/* Standalone Executive Admin Portal Header */}
      <header className="liquid-glass-header text-stone-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl liquid-btn-gold shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  style={{ color: '#f8f4ec' }}
                  className="text-base sm:text-xl font-extrabold font-luxury tracking-tight truncate"
                >
                  StockFlow Lagos • Admin Governance Portal
                </h1>
                <span className="text-[10px] sm:text-[11px] bg-amber-400/20 text-amber-200 border border-amber-300/35 px-2.5 py-0.5 rounded-full font-extrabold">
                  Route: /admin
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-300/90 truncate font-medium">
                Signed in as {currentUser.full_name} ({currentUser.email}) • Super Administrator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch to Standalone Store POS Workspace */}
            <button
              type="button"
              onClick={() => onNavigate('/store/sell')}
              className="liquid-btn-gold px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Open Store Workspace (/store/sell)</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-1.5 bg-white/12 hover:bg-white/20 text-stone-100 border border-white/25 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-amber-300" />
                  <span className="hidden sm:inline">Ivory Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-amber-200" />
                  <span className="hidden sm:inline">Obsidian Mode</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 bg-rose-500/25 hover:bg-rose-500/40 text-stone-100 border border-rose-300/35 px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-200" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-5">
        {toast && (
          <div className="liquid-btn-gold px-4 py-3 rounded-2xl text-sm font-extrabold flex items-center gap-2">
            <Crown className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Standalone Admin Control Center Component */}
        <AdminConsole currentUser={currentUser} onToast={onToast} />
      </main>
    </div>
  );
}
