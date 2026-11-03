import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Store,
  Package,
  Layers,
  ShoppingCart,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Plus,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '../ui/Badge';

export function OnboardingJourneyCard({
  currentUser,
  products = [],
  transactions = [],
  movements = [],
  cashbookSession,
  onOpenBusinessSetup,
  onSeedStarter,
  onAddProduct,
  onOpenQuickStock,
  onGoToCounter,
  isDismissed,
  onToggleDismiss,
  formatCurrency,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Compute status for all 5 milestones
  // 1. Account created
  const step1Done = true;

  // 2. Business profile & drawer float
  const hasBusinessDetails = Boolean(currentUser?.business_name && (currentUser?.address || currentUser?.city));
  const hasOpeningFloat = Boolean(cashbookSession?.todaySession);
  const step2Done = Boolean(hasBusinessDetails && hasOpeningFloat);

  // 3. Products in catalog
  const productsCount = products.length;
  const step3Done = productsCount > 0;

  // 4. Opening stock on shelves
  const inStockCount = products.filter((p) => Number(p.stock_quantity) > 0).length;
  const step4Done = inStockCount > 0;

  // 5. First sale made
  const hasSaleInflow = transactions.some((t) => t.type === 'INFLOW' && (t.category === 'SALES' || t.description?.toLowerCase().includes('sale')));
  const hasSaleMovement = movements.some((m) => m.movement_type === 'SALE');
  const step5Done = Boolean(hasSaleInflow || hasSaleMovement);

  const completedCount = [step1Done, step2Done, step3Done, step4Done, step5Done].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 5) * 100);
  const allComplete = completedCount === 5;

  if (isDismissed) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl liquid-glass-subtle border border-theme-subtle">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="w-4 h-4 text-theme-brand" />
          <span className="font-bold text-theme-primary">Store Launch Onboarding:</span>
          <span className="font-extrabold text-theme-brand">
            {completedCount} of 5 Completed ({progressPercent}%)
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleDismiss}
          className="text-xs font-bold text-theme-brand hover:underline cursor-pointer flex items-center gap-1"
        >
          <span>View Checklist</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="liquid-glass rounded-3xl p-4 sm:p-6 border border-theme-subtle shadow-lg relative overflow-hidden transition-all duration-300">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-blue-500/10 via-emerald-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b theme-divider pb-4 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl liquid-btn-primary">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="font-extrabold font-luxury text-base sm:text-lg text-theme-primary">
              Retail Launch Checklist: Signup to First Sale
            </h3>
            <Badge variant={allComplete ? 'success' : 'info'}>
              {allComplete ? 'Ready for Business' : `${completedCount}/5 Steps`}
            </Badge>
          </div>
          <p className="text-xs text-theme-secondary">
            Set up your shop in 5 simple steps so your shelf stock is counted and counter is ready for buyers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 text-theme-secondary hover:text-theme-primary cursor-pointer"
            title={isCollapsed ? 'Expand checklist' : 'Collapse checklist'}
          >
            <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onToggleDismiss}
            className="p-1.5 rounded-xl liquid-glass-subtle text-theme-secondary hover:text-theme-primary cursor-pointer"
            title="Hide checklist"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 space-y-1.5 relative z-10">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-theme-primary">Launch Readiness</span>
          <span className="text-theme-brand">{progressPercent}% Completed</span>
        </div>
        <div className="w-full bg-black/10 dark:bg-white/10 h-2.5 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allComplete
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Body: 5 Steps */}
      {!isCollapsed && (
        <div className="mt-5 space-y-3 relative z-10">
          {/* STEP 1: Create Account */}
          <div className="liquid-glass-subtle p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs sm:text-sm text-theme-primary">
                    1. Create Account & Login
                  </span>
                  <Badge variant="success">Completed</Badge>
                </div>
                <p className="text-xs text-theme-secondary mt-0.5">
                  Signed up as <strong className="text-theme-primary">{currentUser?.email}</strong>.
                </p>
              </div>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold self-end sm:self-center">
              Account Active ✓
            </div>
          </div>

          {/* STEP 2: Set Up Business Profile & Cash Float */}
          <div
            className={`liquid-glass-subtle p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
              step2Done
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-blue-500/20 bg-blue-500/5'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  step2Done
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-blue-500/20 text-blue-500'
                }`}
              >
                {step2Done ? <CheckCircle2 className="w-5 h-5" /> : <Store className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs sm:text-sm text-theme-primary">
                    2. Set Up Store Details & Drawer Float
                  </span>
                  <Badge variant={step2Done ? 'success' : 'info'}>
                    {step2Done ? 'Ready' : 'Setup Required'}
                  </Badge>
                </div>
                <p className="text-xs text-theme-secondary mt-0.5">
                  {step2Done
                    ? `${currentUser?.business_name || 'Store'} • Drawer Float: ${formatCurrency(cashbookSession?.todaySession?.opening_balance || 0)}`
                    : 'Add your shop address, trading currency, and starting cash float for change.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenBusinessSetup}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 self-end sm:self-center cursor-pointer transition-all ${
                step2Done
                  ? 'liquid-glass-subtle text-theme-primary hover:bg-black/5 dark:hover:bg-white/5'
                  : 'liquid-btn-primary shadow-md'
              }`}
            >
              <span>{step2Done ? 'Edit Profile & Float' : 'Configure Store Profile'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* STEP 3: Add First Products or Load Starter Catalog */}
          <div
            className={`liquid-glass-subtle p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
              step3Done
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-indigo-500/20 bg-indigo-500/5'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  step3Done
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-indigo-500/20 text-indigo-500'
                }`}
              >
                {step3Done ? <CheckCircle2 className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs sm:text-sm text-theme-primary">
                    3. Add Products or Load Starter Catalog
                  </span>
                  <Badge variant={step3Done ? 'success' : 'warning'}>
                    {step3Done ? `${productsCount} Products Added` : 'Catalog Empty'}
                  </Badge>
                </div>
                <p className="text-xs text-theme-secondary mt-0.5">
                  {step3Done
                    ? `Catalog initialized with ${productsCount} retail items.`
                    : 'Load 12 fast-moving Lagos provisions (Peak, Indomie, Sugar) or add your own products.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
              {!step3Done && (
                <button
                  type="button"
                  onClick={onSeedStarter}
                  className="liquid-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Load 12 Lagos Provisions</span>
                </button>
              )}
              <button
                type="button"
                onClick={onAddProduct}
                className="liquid-glass-subtle px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 text-theme-primary hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* STEP 4: Record Opening Stock (Count Shelves) */}
          <div
            className={`liquid-glass-subtle p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
              step4Done
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-amber-500/20 bg-amber-500/5'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  step4Done
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-amber-500/20 text-amber-500'
                }`}
              >
                {step4Done ? <CheckCircle2 className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs sm:text-sm text-theme-primary">
                    4. Record Opening Stock (Shelves Count)
                  </span>
                  <Badge variant={step4Done ? 'success' : 'danger'}>
                    {step4Done ? `${inStockCount} In Stock` : '0 Stock Available'}
                  </Badge>
                </div>
                <p className="text-xs text-theme-secondary mt-0.5">
                  {step4Done
                    ? `${inStockCount} product lines have active stock ready to sell.`
                    : 'Products start at 0 stock. Set your shelf counts so items can be sold at the counter.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenQuickStock}
              disabled={!step3Done}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 self-end sm:self-center cursor-pointer transition-all ${
                !step3Done
                  ? 'opacity-50 cursor-not-allowed liquid-glass-subtle text-theme-muted'
                  : step4Done
                  ? 'liquid-glass-subtle text-theme-primary hover:bg-black/5 dark:hover:bg-white/5'
                  : 'liquid-btn-primary shadow-md'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{step4Done ? 'Adjust Stock Counts' : 'Set Opening Stock (Quick 10)'}</span>
            </button>
          </div>

          {/* STEP 5: Make Your First Sale */}
          <div
            className={`liquid-glass-subtle p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
              step5Done
                ? 'border-emerald-500/20 bg-emerald-500/5'
                : 'border-purple-500/20 bg-purple-500/5'
            }`}
          >
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  step5Done
                    ? 'bg-emerald-500/20 text-emerald-500'
                    : 'bg-purple-500/20 text-purple-500'
                }`}
              >
                {step5Done ? <CheckCircle2 className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs sm:text-sm text-theme-primary">
                    5. Make Your First Sale & Print Receipt
                  </span>
                  <Badge variant={step5Done ? 'success' : 'purple'}>
                    {step5Done ? 'First Sale Recorded' : 'Awaiting First Customer'}
                  </Badge>
                </div>
                <p className="text-xs text-theme-secondary mt-0.5">
                  {step5Done
                    ? 'Congratulations! First retail transaction completed, stock decremented, and cashbook updated.'
                    : 'Tap items on the counter, choose payment (Cash/POS/Transfer), and generate customer receipt.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onGoToCounter}
              disabled={!step4Done}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 self-end sm:self-center cursor-pointer transition-all ${
                !step4Done
                  ? 'opacity-50 cursor-not-allowed liquid-glass-subtle text-theme-muted'
                  : step5Done
                  ? 'liquid-glass-subtle text-theme-primary hover:bg-black/5 dark:hover:bg-white/5'
                  : 'liquid-btn-primary shadow-md'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{step5Done ? 'Go to Store Counter' : 'Open Counter & Ring Up Sale'}</span>
            </button>
          </div>

          {/* All complete celebration banner */}
          {allComplete && (
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-theme-primary">
                <Sparkles className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>
                  🎉 <strong>Store Setup Complete!</strong> Your store is fully operational. You can dismiss this checklist at any time.
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleDismiss}
                className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold text-theme-primary hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap"
              >
                Dismiss Checklist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
