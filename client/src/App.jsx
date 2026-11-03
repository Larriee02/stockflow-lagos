import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  AlertTriangle,
  Plus,
  Minus,
  ClipboardCheck,
  Search,
  ShoppingCart,
  Users,
  Download,
  Filter,
  BarChart3,
  Edit3,
  Trash2,
  CheckCircle2,
  MessageCircle,
  History,
  Sun,
  Moon,
  Calendar,
  XCircle,
  ShieldCheck,
  UserCheck,
  LogOut,
  Printer,
  Copy,
  FileText,
  Sparkles,
  Settings,
  Upload,
  SlidersHorizontal,
  Layers,
  FileSpreadsheet,
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  Lock,
  Unlock,
  RotateCcw,
  UserPlus,
  Clock,
  MapPin,
  Scale,
} from 'lucide-react';
import { useDebounce } from './hooks/useDebounce';
import { Modal } from './components/ui/Modal';
import { StatCard } from './components/ui/StatCard';
import { Badge } from './components/ui/Badge';
import { EmptyState } from './components/ui/EmptyState';
import { ToastProvider, useToast } from './components/ui/Toast';
import { ReceiptModal } from './components/receipt/ReceiptModal';
import { CheckoutConfirmModal } from './components/counter/CheckoutConfirmModal';
import { MobileCartSheet } from './components/counter/MobileCartSheet';
import { BulkImportModal } from './components/inventory/BulkImportModal';
import { PhysicalStockAuditModal } from './components/inventory/PhysicalStockAuditModal';
import { BatchAdjustModal } from './components/inventory/BatchAdjustModal';
import { CashbookSessionModal } from './components/cashbook/CashbookSessionModal';
import { TransactionCorrectionModal } from './components/cashbook/TransactionCorrectionModal';
import { WhatsAppReminderModal } from './components/debtors/WhatsAppReminderModal';
import { CustomerStatementModal } from './components/debtors/CustomerStatementModal';
import { CustomerRepaymentModal } from './components/debtors/CustomerRepaymentModal';
import { CustomerCreditModal } from './components/debtors/CustomerCreditModal';
import { FinancialMetricsOverview } from './components/analytics/FinancialMetricsOverview';
import { DailyChannelReconciliationModal } from './components/analytics/DailyChannelReconciliationModal';
import { ProfitAndLossStatement } from './components/analytics/ProfitAndLossStatement';
import { OnboardingJourneyCard } from './components/onboarding/OnboardingJourneyCard';
import { QuickStockModal } from './components/onboarding/QuickStockModal';
import { BusinessSetupModal } from './components/onboarding/BusinessSetupModal';
import { AccountStatusScreen } from './components/auth/AccountStatusScreen';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';
import { RouterProvider, useRouter } from './router/RouterContext';
import { apiFetch, setStoredToken } from './services/api';
import { formatCurrency, getCurrencySymbol } from './utils/currency';

const PAYMENT_CHANNEL_LABELS = {
  CASH: 'Cash (Notes)',
  POS: 'POS Terminal',
  BANK_TRANSFER: 'Bank Transfer',
  MOBILE_MONEY: 'Mobile Wallet',
};

const LAGOS_EXPENSE_PRESETS = [
  'Inventory Restock',
  'Generator & Power',
  'Electricity & Utilities',
  'Logistics & Transport',
  'Store Rent & Lease',
  'Staff Wages & Allowance',
  'POS & Bank Charges',
  'Security & Maintenance',
  'Packaging & Supplies',
  'Taxes & Market Levies',
  'Miscellaneous Expense',
];

const INITIAL_PRODUCT_FORM = {
  sku: '',
  name: '',
  category: 'Beverages & Dairy',
  unit: 'Pack',
  cost_price: '',
  selling_price: '',
  stock_quantity: '0',
  reorder_level: '5',
  supplier_name: '',
};

const INITIAL_CASH_FORM = {
  type: 'OUTFLOW',
  category: 'Inventory Restock',
  amount: '',
  payment_method: 'CASH',
  counterparty_name: '',
  expense_reason: '',
  description: '',
};

const ROUTE_TO_TAB = {
  '/store': 'counter',
  '/store/sell': 'counter',
  '/store/stock': 'inventory',
  '/store/cash': 'cashbook',
  '/store/history': 'history',
  '/store/debtors': 'debtors',
  '/store/summary': 'analytics',
};

const TAB_TO_ROUTE = {
  counter: '/store/sell',
  inventory: '/store/stock',
  cashbook: '/store/cash',
  history: '/store/history',
  debtors: '/store/debtors',
  analytics: '/store/summary',
};

export default function App() {
  return (
    <RouterProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </RouterProvider>
  );
}

function AppShell() {
  const { path, navigate } = useRouter();

  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem('stockflow_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('stockflow_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage quota errors
    }
  }, [darkMode]);

  const basketRef = useRef(null);
  const tabSectionRef = useRef(null);

  // Authenticated SaaS User State
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  const currencyCode = currentUser?.currency || 'NGN';
  const currencySymbol = getCurrencySymbol(currencyCode);
  const formatNaira = useCallback(
    (val) => formatCurrency(val, currencyCode),
    [currencyCode]
  );

  const [activeTab, setActiveTab] = useState(() => ROUTE_TO_TAB[path] || 'counter');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // Keep activeTab synchronized when user navigates via URL (/store/sell, /store/stock, etc.)
  useEffect(() => {
    if (ROUTE_TO_TAB[path]) {
      setActiveTab(ROUTE_TO_TAB[path]);
    }
  }, [path]);

  // Server Data
  const [dashboard, setDashboard] = useState({});
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cashbookSession, setCashbookSession] = useState(null);
  const [movements, setMovements] = useState([]);
  const [credits, setCredits] = useState([]);
  const [customerLedgers, setCustomerLedgers] = useState([]);

  // Debtor Views & Filter States
  const [debtorViewMode, setDebtorViewMode] = useState('ACCOUNTS'); // 'ACCOUNTS' | 'SLIPS'
  const [debtorFilter, setDebtorFilter] = useState('ALL'); // 'ALL' | 'OWING' | 'OVERDUE' | 'SETTLED'
  const [debtorSearch, setDebtorSearch] = useState('');
  const debouncedDebtorSearch = useDebounce(debtorSearch, 150);

  // Debtor Modals
  const [whatsAppModalTarget, setWhatsAppModalTarget] = useState(null);
  const [statementModalCustomer, setStatementModalCustomer] = useState(null);
  const [repaymentModalTarget, setRepaymentModalTarget] = useState(null);
  const [showAddCreditModal, setShowAddCreditModal] = useState(false);

  // Quick Counter Sale Basket State
  const [cart, setCart] = useState({});
  const [checkoutMethod, setCheckoutMethod] = useState('CASH');
  const [isPartPayment, setIsPartPayment] = useState(false);
  const [amountPaidNow, setAmountPaidNow] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 150);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [cashFilter, setCashFilter] = useState('ALL');
  const [channelFilter, setChannelFilter] = useState('ALL');
  const [cashDateRange, setCashDateRange] = useState('ALL'); // 'ALL' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
  const [cashStartDate, setCashStartDate] = useState('');
  const [cashEndDate, setCashEndDate] = useState('');
  const [cashCategoryFilter, setCashCategoryFilter] = useState('ALL');
  const [cashSearch, setCashSearch] = useState('');
  const debouncedCashSearch = useDebounce(cashSearch, 150);
  const [showAuditTrail, setShowAuditTrail] = useState(true);

  // Check History Filters
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL');
  const [historyProductFilter, setHistoryProductFilter] = useState('ALL');
  const [historyDateRange, setHistoryDateRange] = useState('ALL');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyCustomDate, setHistoryCustomDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const debouncedHistorySearch = useDebounce(historySearch, 150);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionModalMode, setSessionModalMode] = useState('OPEN');
  const [correctingTx, setCorrectingTx] = useState(null);
  const [repayingCredit, setRepayingCredit] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('CASH');

  // Analytics & Daily Channel Reconciliation State
  const [analyticsDateRange, setAnalyticsDateRange] = useState('TODAY'); // 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
  const [analyticsStartDate, setAnalyticsStartDate] = useState('');
  const [analyticsEndDate, setAnalyticsEndDate] = useState('');
  const [showReconcileModal, setShowReconcileModal] = useState(false);

  // Discretionary MVP Feature Modals
  const [lastReceipt, setLastReceipt] = useState(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showBatchAdjustModal, setShowBatchAdjustModal] = useState(false);
  const [showBusinessSetupModal, setShowBusinessSetupModal] = useState(false);
  const [showQuickStockModal, setShowQuickStockModal] = useState(false);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(() => {
    try {
      return localStorage.getItem('stockflow_hide_onboarding') === 'true';
    } catch {
      return false;
    }
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    business_name: '',
    phone: '',
    location: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
  });

  // Forms
  const [productForm, setProductForm] = useState(INITIAL_PRODUCT_FORM);
  const [movementForm, setMovementForm] = useState({
    movement_type: 'RESTOCK',
    quantity: '',
    record_cash: true,
    amount_paid: '',
    payment_method: 'CASH',
    counterparty_name: '',
    note: '',
  });
  const [cashForm, setCashForm] = useState(INITIAL_CASH_FORM);
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  const showSuccessToast = useCallback((msg) => {
    setToast(msg);
    toastSuccess?.(msg);
    setTimeout(() => setToast(''), 4200);
  }, [toastSuccess]);

  const handleSelectTab = (tabId, scrollOnMobile = false) => {
    setActiveTab(tabId);
    const targetRoute = TAB_TO_ROUTE[tabId] || '/store/sell';
    navigate(targetRoute);
    if (scrollOnMobile && typeof window !== 'undefined' && window.innerWidth < 768) {
      setTimeout(() => {
        tabSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  };

  // Check active session on mount
  const checkAuthSession = useCallback(async () => {
    try {
      const data = await apiFetch('/api/v1/auth/me');
      if (data?.user) {
        setCurrentUser(data.user);
        setProfileForm({
          full_name: data.user.full_name || '',
          business_name: data.user.business_name || '',
          phone: data.user.phone || '',
          location: data.user.location || 'Lagos, Nigeria',
        });
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuthSession();
  }, [checkAuthSession]);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network error on logout
    }
    setStoredToken('');
    setCurrentUser(null);
    setCart({});
    setShowProfileModal(false);
    setActiveTab('counter');
    navigate('/login');
  };

  const isApprovedStoreAccess = Boolean(
    currentUser && (currentUser.status === 'APPROVED' || currentUser.role === 'ADMIN')
  );

  const fetchAllData = useCallback(
    async (signal) => {
      if (!isApprovedStoreAccess) return;
      try {
        setError('');
        const [dashData, prodData, txData, sessData, movData, credData, custData] = await Promise.all([
          apiFetch('/api/v1/dashboard', { signal }),
          apiFetch('/api/v1/products', { signal }),
          apiFetch('/api/v1/transactions?limit=500', { signal }),
          apiFetch('/api/v1/cashbook/sessions', { signal }).catch(() => null),
          apiFetch('/api/v1/inventory/movements?limit=1000', { signal }),
          apiFetch('/api/v1/credits', { signal }),
          apiFetch('/api/v1/credits/customers', { signal }).catch(() => []),
        ]);

        setDashboard(dashData || {});
        setProducts(Array.isArray(prodData) ? prodData : []);
        setTransactions(Array.isArray(txData) ? txData : []);
        if (sessData) setCashbookSession(sessData);
        setMovements(Array.isArray(movData) ? movData : []);
        setCredits(Array.isArray(credData) ? credData : []);
        setCustomerLedgers(Array.isArray(custData) ? custData : []);
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          checkAuthSession();
          return;
        }
        if (err.name !== 'AbortError') {
          setError('Cannot connect to server. Please check your connection and try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [isApprovedStoreAccess, checkAuthSession]
  );

  const refreshDebtors = useCallback(async () => {
    try {
      const [credData, custData, dashData, txData] = await Promise.all([
        apiFetch('/api/v1/credits'),
        apiFetch('/api/v1/credits/customers').catch(() => []),
        apiFetch('/api/v1/dashboard').catch(() => null),
        apiFetch('/api/v1/transactions?limit=500').catch(() => null),
      ]);
      setCredits(Array.isArray(credData) ? credData : []);
      setCustomerLedgers(Array.isArray(custData) ? custData : []);
      if (dashData) setDashboard(dashData);
      if (Array.isArray(txData)) setTransactions(txData);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (!isApprovedStoreAccess) return;
    const controller = new AbortController();
    fetchAllData(controller.signal);
    return () => controller.abort();
  }, [fetchAllData, isApprovedStoreAccess]);

  // Categories & Filtered Products
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['ALL', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    return products.filter((p) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (lowStockOnly && Number(p.stock_quantity) > Number(p.reorder_level)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.supplier_name && p.supplier_name.toLowerCase().includes(q))
      );
    });
  }, [products, debouncedSearch, categoryFilter, lowStockOnly]);

  // Low-Stock Restock Generator Items (Discretionary MVP Feature)
  const lowStockRestockPlan = useMemo(() => {
    return products
      .filter((p) => Number(p.stock_quantity) <= Number(p.reorder_level))
      .map((p) => {
        const current = Number(p.stock_quantity || 0);
        const reorder = Number(p.reorder_level || 5);
        const recommendedQty = Math.max(reorder * 2 - current, reorder, 5);
        const unitCost = Number(p.cost_price || 0);
        return {
          ...p,
          recommendedQty,
          estimatedCost: recommendedQty * unitCost,
        };
      });
  }, [products]);

  const totalRestockBudget = useMemo(
    () => lowStockRestockPlan.reduce((sum, item) => sum + item.estimatedCost, 0),
    [lowStockRestockPlan]
  );

  // Filtered History Movements + Period Summary
  const filteredMovements = useMemo(() => {
    const q = debouncedHistorySearch.toLowerCase().trim();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return movements.filter((m) => {
      // Type Filter
      if (historyTypeFilter !== 'ALL') {
        const mType = String(m.movement_type || '').toUpperCase();
        if (historyTypeFilter === 'DAMAGED') {
          if (mType !== 'DAMAGED' && mType !== 'DAMAGE') return false;
        } else if (mType !== historyTypeFilter) {
          return false;
        }
      }

      // Product Filter
      if (historyProductFilter !== 'ALL') {
        if (String(m.product_id) !== String(historyProductFilter)) {
          return false;
        }
      }

      // Date Range Filter
      const itemTime = new Date(m.created_at).getTime();
      if (historyDateRange === 'TODAY' && itemTime < startOfToday) {
        return false;
      }
      if (historyDateRange === '7DAYS' && itemTime < now.getTime() - 7 * 86400000) {
        return false;
      }
      if (historyDateRange === '30DAYS' && itemTime < now.getTime() - 30 * 86400000) {
        return false;
      }
      if (historyDateRange === 'CUSTOM') {
        if (historyStartDate) {
          const startTime = new Date(historyStartDate).setHours(0, 0, 0, 0);
          if (itemTime < startTime) return false;
        }
        if (historyEndDate) {
          const endTime = new Date(historyEndDate).setHours(23, 59, 59, 999);
          if (itemTime > endTime) return false;
        }
        if (historyCustomDate && !historyStartDate && !historyEndDate) {
          const itemDateStr = new Date(m.created_at).toISOString().slice(0, 10);
          if (itemDateStr !== historyCustomDate) return false;
        }
      }

      if (!q) return true;
      return (
        (m.product_name && m.product_name.toLowerCase().includes(q)) ||
        (m.sku && m.sku.toLowerCase().includes(q)) ||
        (m.counterparty_name && m.counterparty_name.toLowerCase().includes(q)) ||
        (m.note && m.note.toLowerCase().includes(q))
      );
    });
  }, [
    movements,
    historyTypeFilter,
    historyProductFilter,
    historyDateRange,
    historyStartDate,
    historyEndDate,
    historyCustomDate,
    debouncedHistorySearch,
  ]);

  const historySummary = useMemo(() => {
    return filteredMovements.reduce(
      (acc, m) => {
        const val = Number(m.total_value || 0);
        const t = String(m.movement_type || '').toUpperCase();
        if (t === 'SALE') {
          acc.salesCount += 1;
          acc.salesValue += val;
        } else if (t === 'RESTOCK') {
          acc.restockCount += 1;
          acc.restockValue += val;
        } else if (['DAMAGED', 'DAMAGE', 'EXPIRED', 'MISSING'].includes(t)) {
          acc.lossCount += 1;
          acc.lossValue += val;
        } else if (t === 'ADJUSTMENT' || t === 'SURPLUS') {
          acc.auditCount += 1;
        }
        return acc;
      },
      { salesCount: 0, salesValue: 0, restockCount: 0, restockValue: 0, lossCount: 0, lossValue: 0, auditCount: 0 }
    );
  }, [filteredMovements]);

  const getMovementBadgeInfo = (movementType) => {
    const norm = String(movementType || '').toUpperCase();
    switch (norm) {
      case 'SALE':
        return { variant: 'info', label: 'SALE OUT' };
      case 'RESTOCK':
        return { variant: 'success', label: 'RESTOCK' };
      case 'DAMAGE':
      case 'DAMAGED':
        return { variant: 'danger', label: 'DAMAGED' };
      case 'EXPIRED':
        return { variant: 'warning', label: 'EXPIRED' };
      case 'MISSING':
        return { variant: 'danger', label: 'MISSING' };
      case 'SURPLUS':
        return { variant: 'info', label: 'SURPLUS' };
      case 'ADJUSTMENT':
        return { variant: 'neutral', label: 'SHELF COUNT' };
      default:
        return { variant: 'neutral', label: norm };
    }
  };

  // Distinct Payment Channel Visual Metadata (Cash vs POS vs Bank Transfer vs Mobile Wallet)
  const getChannelBadgeMeta = (paymentMethod) => {
    const ch = String(paymentMethod || 'CASH').toUpperCase();
    switch (ch) {
      case 'CASH':
        return {
          label: 'Cash (Notes)',
          shortLabel: 'CASH',
          icon: Banknote,
          variant: 'success',
          pillClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35',
        };
      case 'POS':
        return {
          label: 'POS Terminal',
          shortLabel: 'POS',
          icon: CreditCard,
          variant: 'info',
          pillClass: 'bg-sky-500/15 text-sky-400 border-sky-500/35',
        };
      case 'BANK_TRANSFER':
        return {
          label: 'Bank Transfer',
          shortLabel: 'TRANSFER',
          icon: Landmark,
          variant: 'info',
          pillClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/35',
        };
      case 'MOBILE_MONEY':
        return {
          label: 'Mobile Wallet',
          shortLabel: 'WALLET',
          icon: Smartphone,
          variant: 'warning',
          pillClass: 'bg-amber-500/15 text-amber-400 border-amber-500/35',
        };
      default:
        return {
          label: ch,
          shortLabel: ch,
          icon: Wallet,
          variant: 'neutral',
          pillClass: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  // Cashbook Period Boundaries (Daily, Weekly, Monthly, Custom, All)
  const cashPeriodBounds = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (cashDateRange === 'DAILY') {
      return { startMs: startOfToday, endMs: Infinity, label: 'Daily Report (Today)' };
    }
    if (cashDateRange === 'WEEKLY') {
      return {
        startMs: startOfToday - 6 * 86400000,
        endMs: Infinity,
        label: 'Weekly Report (Last 7 Days)',
      };
    }
    if (cashDateRange === 'MONTHLY') {
      return {
        startMs: startOfToday - 29 * 86400000,
        endMs: Infinity,
        label: 'Monthly Report (Last 30 Days)',
      };
    }
    if (cashDateRange === 'CUSTOM') {
      const sMs = cashStartDate ? new Date(cashStartDate).setHours(0, 0, 0, 0) : -Infinity;
      const eMs = cashEndDate ? new Date(cashEndDate).setHours(23, 59, 59, 999) : Infinity;
      return {
        startMs: sMs,
        endMs: eMs,
        label: `Custom Range (${cashStartDate || 'Start'} to ${cashEndDate || 'Now'})`,
      };
    }
    return { startMs: -Infinity, endMs: Infinity, label: 'All-Time Cashbook Report' };
  }, [cashDateRange, cashStartDate, cashEndDate]);

  // Distinct Cashbook Categories for Filter Dropdown
  const cashbookCategories = useMemo(() => {
    const set = new Set(LAGOS_EXPENSE_PRESETS);
    set.add('Counter Sales');
    set.add('Credit Repayment');
    transactions.forEach((tx) => {
      if (tx.category) set.add(tx.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [transactions]);

  // Filtered Cashbook Transactions (supports Type, Channel, Category, Date Range, Search & Audit Trail)
  const filteredTransactions = useMemo(() => {
    const q = debouncedCashSearch.toLowerCase().trim();
    const { startMs, endMs } = cashPeriodBounds;

    return transactions.filter((tx) => {
      const txStatus = tx.status || 'ACTIVE';
      if (!showAuditTrail && txStatus !== 'ACTIVE') return false;

      if (cashFilter !== 'ALL' && tx.type !== cashFilter) return false;
      if (channelFilter !== 'ALL' && tx.payment_method !== channelFilter) return false;
      if (cashCategoryFilter !== 'ALL' && tx.category !== cashCategoryFilter) return false;

      const txTime = new Date(tx.transaction_date).getTime();
      if (txTime < startMs || txTime > endMs) return false;

      if (!q) return true;
      return (
        (tx.category && tx.category.toLowerCase().includes(q)) ||
        (tx.description && tx.description.toLowerCase().includes(q)) ||
        (tx.expense_reason && tx.expense_reason.toLowerCase().includes(q)) ||
        (tx.counterparty_name && tx.counterparty_name.toLowerCase().includes(q)) ||
        (tx.correction_reason && tx.correction_reason.toLowerCase().includes(q)) ||
        String(tx.id).includes(q)
      );
    });
  }, [
    transactions,
    showAuditTrail,
    cashFilter,
    channelFilter,
    cashCategoryFilter,
    cashPeriodBounds,
    debouncedCashSearch,
  ]);

  // Comprehensive Period Cashbook Report (Opening Balance, Inflow, Outflow, Closing Balance, Channels & Expense Breakdown)
  const cashbookReportSummary = useMemo(() => {
    const { startMs, endMs } = cashPeriodBounds;
    let priorNet = 0;
    let periodInflow = 0;
    let periodOutflow = 0;
    let activeCount = 0;
    let auditCount = 0;

    const byChannel = {
      CASH: { inflow: 0, outflow: 0, net: 0, count: 0 },
      POS: { inflow: 0, outflow: 0, net: 0, count: 0 },
      BANK_TRANSFER: { inflow: 0, outflow: 0, net: 0, count: 0 },
      MOBILE_MONEY: { inflow: 0, outflow: 0, net: 0, count: 0 },
    };

    const expenseCatMap = {};

    for (const tx of transactions) {
      const txStatus = tx.status || 'ACTIVE';
      const txTime = new Date(tx.transaction_date).getTime();
      const amt = Number(tx.amount || 0);

      if (txStatus !== 'ACTIVE') {
        if (txTime >= startMs && txTime <= endMs) {
          auditCount++;
        }
        continue;
      }

      if (txTime < startMs) {
        priorNet += tx.type === 'INFLOW' ? amt : -amt;
        continue;
      }

      if (txTime >= startMs && txTime <= endMs) {
        activeCount++;
        const ch = byChannel[tx.payment_method] ? tx.payment_method : 'CASH';
        byChannel[ch].count += 1;

        if (tx.type === 'INFLOW') {
          periodInflow += amt;
          byChannel[ch].inflow += amt;
          byChannel[ch].net += amt;
        } else {
          periodOutflow += amt;
          byChannel[ch].outflow += amt;
          byChannel[ch].net -= amt;

          const cat = tx.category || 'Miscellaneous Expense';
          if (!expenseCatMap[cat]) {
            expenseCatMap[cat] = { category: cat, amount: 0, count: 0 };
          }
          expenseCatMap[cat].amount += amt;
          expenseCatMap[cat].count += 1;
        }
      }
    }

    // Determine effective Opening Balance for the selected period
    let openingBalance = priorNet;
    if (
      cashDateRange === 'DAILY' &&
      cashbookSession?.todaySession?.opening_balance !== undefined &&
      cashbookSession?.todaySession?.opening_balance !== null
    ) {
      openingBalance = Number(cashbookSession.todaySession.opening_balance);
    } else if (cashDateRange === 'ALL' && cashbookSession?.todaySession?.opening_balance) {
      // Include any initial float difference if explicitly set
      openingBalance = 0;
    }

    const closingBalance = openingBalance + periodInflow - periodOutflow;
    const expensesByCategory = Object.values(expenseCatMap).sort((a, b) => b.amount - a.amount);

    return {
      openingBalance,
      periodInflow,
      periodOutflow,
      closingBalance,
      activeCount,
      auditCount,
      byChannel,
      expensesByCategory,
    };
  }, [transactions, cashPeriodBounds, cashDateRange, cashbookSession]);

  // Debtor Book & Customer Ledgers Calculations
  const debtorMetrics = useMemo(() => {
    let totalOwed = 0;
    let totalOverdue = 0;
    let overdueCount = 0;
    let owingCustomersCount = 0;
    let totalCollected = 0;

    if (customerLedgers.length > 0) {
      for (const l of customerLedgers) {
        const bal = Number(l.total_balance_due || 0);
        totalCollected += Number(l.total_paid || 0);
        if (bal > 0) {
          totalOwed += bal;
          owingCustomersCount += 1;
          if (l.is_overdue) {
            totalOverdue += bal;
            overdueCount += 1;
          }
        }
      }
    } else {
      for (const c of credits) {
        const bal = Number(c.balance_due || 0);
        totalCollected += Number(c.amount_paid || 0);
        if (c.status === 'OWING' && bal > 0) {
          totalOwed += bal;
          owingCustomersCount += 1;
          if (c.is_overdue) {
            totalOverdue += bal;
            overdueCount += 1;
          }
        }
      }
    }

    return {
      totalOwed,
      totalOverdue,
      overdueCount,
      owingCustomersCount,
      totalCollected,
    };
  }, [customerLedgers, credits]);

  const filteredLedgers = useMemo(() => {
    const q = debouncedDebtorSearch.trim().toLowerCase();
    return customerLedgers.filter((l) => {
      if (q) {
        const matchName = (l.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (l.phone || '').toLowerCase().includes(q);
        const matchAddress = (l.customer_address || '').toLowerCase().includes(q);
        const matchNotes = (l.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchAddress && !matchNotes) return false;
      }
      if (debtorFilter === 'OWING') return Number(l.total_balance_due) > 0;
      if (debtorFilter === 'OVERDUE') return l.is_overdue && Number(l.total_balance_due) > 0;
      if (debtorFilter === 'SETTLED') return Number(l.total_balance_due) <= 0;
      return true;
    });
  }, [customerLedgers, debouncedDebtorSearch, debtorFilter]);

  const filteredCredits = useMemo(() => {
    const q = debouncedDebtorSearch.trim().toLowerCase();
    return credits.filter((c) => {
      if (q) {
        const matchName = (c.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (c.phone || '').toLowerCase().includes(q);
        const matchItems = (c.items_summary || '').toLowerCase().includes(q);
        const matchAddress = (c.customer_address || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchItems && !matchAddress) return false;
      }
      const isOwing = c.status === 'OWING' && Number(c.balance_due) > 0;
      if (debtorFilter === 'OWING') return isOwing;
      if (debtorFilter === 'OVERDUE') return c.is_overdue && isOwing;
      if (debtorFilter === 'SETTLED') return !isOwing;
      return true;
    });
  }, [credits, debouncedDebtorSearch, debtorFilter]);

  // Analytics & Profit & Loss Period Calculations
  const analyticsPeriodBounds = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    if (analyticsDateRange === 'TODAY') {
      return {
        startMs: startOfToday,
        endMs: endOfToday,
        label: "Today's Trading",
      };
    }
    if (analyticsDateRange === 'WEEK') {
      return {
        startMs: now.getTime() - 7 * 86400000,
        endMs: endOfToday,
        label: 'Last 7 Days (This Week)',
      };
    }
    if (analyticsDateRange === 'MONTH') {
      return {
        startMs: now.getTime() - 30 * 86400000,
        endMs: endOfToday,
        label: 'Last 30 Days (This Month)',
      };
    }
    if (analyticsDateRange === 'CUSTOM') {
      const s = analyticsStartDate ? new Date(`${analyticsStartDate}T00:00:00.000`).getTime() : 0;
      const e = analyticsEndDate ? new Date(`${analyticsEndDate}T23:59:59.999`).getTime() : endOfToday;
      return {
        startMs: s,
        endMs: e,
        label: analyticsStartDate && analyticsEndDate ? `${analyticsStartDate} to ${analyticsEndDate}` : 'Custom Date Range',
      };
    }
    return {
      startMs: startOfToday,
      endMs: endOfToday,
      label: "Today's Trading",
    };
  }, [analyticsDateRange, analyticsStartDate, analyticsEndDate]);

  const analyticsFinancials = useMemo(() => {
    const { startMs, endMs, label } = analyticsPeriodBounds;

    // 1. Calculate Sales from movements in period
    const periodMovements = movements.filter((m) => {
      const t = new Date(m.created_at).getTime();
      return t >= startMs && t <= endMs;
    });

    const saleMovements = periodMovements.filter((m) => m.movement_type === 'SALE');

    let movementSalesTotal = 0;
    let movementCogsTotal = 0;
    for (const sm of saleMovements) {
      const qty = Math.abs(Number(sm.quantity_change || sm.quantity || 0));
      const lineVal = Number(sm.total_value || qty * Number(sm.unit_price || 0));
      const unitCost = Number(sm.cost_price || 0);
      movementSalesTotal += lineVal;
      movementCogsTotal += qty * unitCost;
    }

    // 2. Calculate Inflows & Outflows from cash_transactions in period
    const periodTxs = transactions.filter((tx) => {
      if ((tx.status || 'ACTIVE') !== 'ACTIVE') return false;
      const t = new Date(tx.transaction_date).getTime();
      return t >= startMs && t <= endMs;
    });

    let salesInflowTotal = 0;
    let operatingExpensesTotal = 0;
    let salesTxCount = 0;
    let expenseTxCount = 0;

    const channelMap = {
      CASH: { payment_method: 'CASH', label: 'Cash (Drawer)', inflow: 0, outflow: 0, salesCount: 0 },
      POS: { payment_method: 'POS', label: 'POS Terminal', inflow: 0, outflow: 0, salesCount: 0 },
      BANK_TRANSFER: { payment_method: 'BANK_TRANSFER', label: 'Bank Transfer', inflow: 0, outflow: 0, salesCount: 0 },
      MOBILE_MONEY: { payment_method: 'MOBILE_MONEY', label: 'Mobile Wallet', inflow: 0, outflow: 0, salesCount: 0 },
    };

    const expenseCategoriesMap = new Map();

    for (const tx of periodTxs) {
      const amt = Number(tx.amount || 0);
      const method = tx.payment_method || 'CASH';
      if (!channelMap[method]) {
        channelMap[method] = { payment_method: method, label: method, inflow: 0, outflow: 0, salesCount: 0 };
      }

      if (tx.type === 'INFLOW') {
        channelMap[method].inflow += amt;
        salesInflowTotal += amt;
        salesTxCount += 1;
        channelMap[method].salesCount += 1;
      } else if (tx.type === 'OUTFLOW') {
        channelMap[method].outflow += amt;
        operatingExpensesTotal += amt;
        expenseTxCount += 1;

        const cat = tx.category || 'General Expense';
        const currentCatAmt = expenseCategoriesMap.get(cat) || 0;
        expenseCategoriesMap.set(cat, currentCatAmt + amt);
      }
    }

    // Sales Revenue: Prefer movementSalesTotal when sale movements exist, otherwise use recorded cash sales inflows
    const salesRevenue = movementSalesTotal > 0 ? movementSalesTotal : salesInflowTotal;
    const cogs = movementCogsTotal;
    const grossProfit = Number((salesRevenue - cogs).toFixed(2));
    const grossMarginPercent = salesRevenue > 0 ? (grossProfit / salesRevenue) * 100 : 0;

    const operatingExpenses = Number(operatingExpensesTotal.toFixed(2));
    const netOperatingProfit = Number((grossProfit - operatingExpenses).toFixed(2));
    const netMarginPercent = salesRevenue > 0 ? (netOperatingProfit / salesRevenue) * 100 : 0;

    // Liquid Cash Available Position (current physical drawer + bank/pos from cashbook dashboard)
    const netCashBal = Number(dashboard.net_cash_balance || 0);
    const channels = dashboard.channels || [];
    const cashDrawerCh = channels.find((c) => c.payment_method === 'CASH');
    const posCh = channels.find((c) => c.payment_method === 'POS');
    const bankCh = channels.find((c) => c.payment_method === 'BANK_TRANSFER');

    const cashInDrawer = cashDrawerCh ? Number(cashDrawerCh.net || 0) : Number(cashbookSession?.effectiveOpeningCash || 0);
    const posBalance = posCh ? Number(posCh.net || 0) : 0;
    const bankBalance = bankCh ? Number(bankCh.net || 0) : Number(cashbookSession?.effectiveOpeningBankPos || 0);
    const cashAvailable = netCashBal > 0 ? netCashBal : Number((cashInDrawer + posBalance + bankBalance).toFixed(2));

    // Inventory Valuation
    const inventoryCostValue = Number(dashboard.inventory_cost_value || 0);
    const inventoryRetailValue = Number(dashboard.inventory_retail_value || 0);
    const unrealizedMargin = Number(dashboard.projected_gross_margin || 0);

    const expenseBreakdown = Array.from(expenseCategoriesMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const channelBreakdown = Object.values(channelMap).filter((ch) => ch.inflow > 0 || ch.outflow > 0);

    return {
      dateRangeLabel: label,
      metrics: {
        salesRevenue: Number(salesRevenue.toFixed(2)),
        cogs: Number(cogs.toFixed(2)),
        grossProfit,
        grossMarginPercent,
        operatingExpenses,
        netOperatingProfit,
        netMarginPercent,
        cashAvailable,
        cashInDrawer,
        posBalance,
        bankBalance,
        inventoryCostValue,
        inventoryRetailValue,
        unrealizedMargin,
        salesCount: saleMovements.length || salesTxCount,
        expenseCount: expenseTxCount,
      },
      expenseBreakdown,
      channelBreakdown,
    };
  }, [movements, transactions, dashboard, cashbookSession, analyticsPeriodBounds]);

  // Cart Calculations
  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product || qty <= 0) return null;
        return {
          product,
          quantity: Number(qty),
          lineTotal: Number(product.selling_price) * Number(qty),
        };
      })
      .filter(Boolean);
  }, [cart, products]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [cartItems]
  );

  const cartItemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const addToCart = (product) => {
    const currentInCart = Number(cart[product.id] || 0);
    const available = Number(product.stock_quantity);
    if (available <= 0) {
      toastWarning?.(`"${product.name}" is currently out of stock.`);
      return;
    }
    if (currentInCart + 1 > available) {
      toastWarning?.(`Only ${available} ${product.unit} of "${product.name}" available in stock!`);
      return;
    }
    setCart((prev) => ({ ...prev, [product.id]: currentInCart + 1 }));
  };

  const removeFromCart = (productId) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  const clearCart = () => {
    setCart({});
    setIsPartPayment(false);
    setAmountPaidNow('');
  };

  const updateCartQty = (productId, delta, maxStock) => {
    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      if (next > maxStock) {
        toastWarning?.(`Cannot exceed available shelf stock of ${maxStock}!`);
        return prev;
      }
      return { ...prev, [productId]: next };
    });
  };

  // Step 1: Validate and open the confirmation step
  const handleInitiateCheckout = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (cartItems.length === 0) {
      toastWarning?.('Your customer basket is empty. Tap products to add them.');
      return;
    }

    const paid = isPartPayment ? Number(amountPaidNow || 0) : cartTotal;
    const balance = cartTotal - paid;

    if (balance > 0 && !customerName.trim()) {
      toastError?.('Please enter Customer Name to record the unpaid balance in the Credit Book.');
      return;
    }

    // Verify available stock for all items
    for (const item of cartItems) {
      const available = Number(item.product.stock_quantity);
      if (item.quantity > available) {
        toastError?.(`Insufficient stock for "${item.product.name}"! Only ${available} available on shelf.`);
        return;
      }
    }

    setIsConfirmModalOpen(true);
  };

  // Step 2: Atomic Checkout execution (with rollback on error & state preservation)
  const handleConfirmCheckout = async () => {
    if (cartItems.length === 0) return;

    const paid = isPartPayment ? Number(amountPaidNow || 0) : cartTotal;
    const balance = Math.max(0, cartTotal - paid);

    const receiptItemsSnapshot = cartItems.map((i) => ({
      name: i.product.name,
      unit: i.product.unit,
      quantity: i.quantity,
      unitPrice: Number(i.product.selling_price),
      lineTotal: i.lineTotal,
    }));

    setSubmitting(true);
    try {
      await apiFetch('/api/v1/sales/checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: cartItems.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
          })),
          payment_method: checkoutMethod,
          amount_paid: paid,
          customer_name: customerName,
          customer_phone: customerPhone,
        }),
      });

      // Build and open Instant Digital Receipt
      setLastReceipt({
        receiptNo: `SFL-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toLocaleString(),
        businessName: currentUser?.business_name || 'StockFlow Lagos Store',
        location: currentUser?.location || 'Lagos, Nigeria',
        cashierName: currentUser?.full_name || 'Store Owner',
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || '',
        paymentMethod: checkoutMethod,
        items: receiptItemsSnapshot,
        totalBill: cartTotal,
        amountPaid: paid,
        balanceDue: balance,
      });

      // Transaction successfully committed: reset cart and close modals
      setCart({});
      setIsPartPayment(false);
      setAmountPaidNow('');
      setCustomerName('');
      setCustomerPhone('');
      setIsConfirmModalOpen(false);
      setIsMobileCartOpen(false);

      showSuccessToast(
        balance > 0
          ? `Sale saved! ${formatNaira(paid)} received, ${formatNaira(balance)} added to Credit Book.`
          : `Sale completed! ${formatNaira(cartTotal)} recorded in ${PAYMENT_CHANNEL_LABELS[checkoutMethod] || checkoutMethod}.`
      );
      fetchAllData();
    } catch (err) {
      // NOTE: Cart and form inputs are intentionally NOT wiped on failure,
      // allowing the cashier to adjust quantities and retry!
      setIsConfirmModalOpen(false);
      toastError?.(err.message || 'Checkout failed. Your cart was preserved.');
    } finally {
      setSubmitting(false);
    }
  };

  const openReceiptForMovement = (m) => {
    setLastReceipt({
      receiptNo: `SFL-${String(m.id).padStart(6, '0')}`,
      timestamp: new Date(m.created_at).toLocaleString(),
      businessName: currentUser?.business_name || 'StockFlow Lagos Store',
      location: currentUser?.location || 'Lagos, Nigeria',
      cashierName: currentUser?.full_name || 'Store Owner',
      customerName: m.counterparty_name || 'Walk-in Customer',
      customerPhone: '',
      paymentMethod: 'CASH',
      items: [
        {
          name: m.product_name,
          unit: m.unit,
          quantity: Math.abs(Number(m.quantity_change)),
          unitPrice: Number(m.unit_price || 0),
          lineTotal: Number(m.total_value || 0),
        },
      ],
      totalBill: Number(m.total_value || 0),
      amountPaid: Number(m.total_value || 0),
      balanceDue: 0,
    });
  };

  // Expected value inside Stock Movement modal
  const expectedMovementValue = useMemo(() => {
    if (!selectedProduct || !movementForm.quantity) return 0;
    const qty = Number(movementForm.quantity);
    if (Number.isNaN(qty) || qty <= 0) return 0;
    const price =
      movementForm.movement_type === 'SALE'
        ? Number(selectedProduct.selling_price)
        : Number(selectedProduct.cost_price);
    return qty * price;
  }, [selectedProduct, movementForm.quantity, movementForm.movement_type]);

  // Save Product
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingProduct
        ? `/api/v1/products/${editingProduct.id}`
        : '/api/v1/products';
      const method = editingProduct ? 'PUT' : 'POST';
      const autoSku =
        productForm.sku.trim() || `PRV-${Math.floor(100 + Math.random() * 900)}`;

      await apiFetch(url, {
        method,
        body: JSON.stringify({ ...productForm, sku: autoSku }),
      });

      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm(INITIAL_PRODUCT_FORM);
      showSuccessToast(editingProduct ? 'Product updated!' : 'New product added to shelf!');
      fetchAllData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (product) => {
    if (
      !window.confirm(
        `Remove "${product.name}" and its movement history from your store shelf?`
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/products/${product.id}`, {
        method: 'DELETE',
      });
      setShowProductModal(false);
      setEditingProduct(null);
      showSuccessToast(`"${product.name}" removed from shelf.`);
      fetchAllData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Seed Starter Catalog
  const handleSeedStarterCatalog = async () => {
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/products/seed-starter', {
        method: 'POST',
      });
      showSuccessToast('Lagos Provision Starter Catalog loaded (0 stock)!');
      fetchAllData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Record Stock Movement (Restock / Shelf Count / Damaged)
  const handleRecordMovement = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/inventory/movements', {
        method: 'POST',
        headers: {
          'Idempotency-Key': `${selectedProduct.id}-${Date.now()}`,
        },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          ...movementForm,
        }),
      });

      setSelectedProduct(null);
      showSuccessToast('Stock level updated and logged in History!');
      fetchAllData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Record Direct Cash Entry
  const handleCreateCashTx = async (e) => {
    e.preventDefault();
    const reasonText = (cashForm.expense_reason || cashForm.description || '').trim();
    if (cashForm.type === 'OUTFLOW' && !reasonText) {
      toastWarning?.('Please enter a specific reason or purpose for this expense.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...cashForm,
          expense_reason: reasonText || cashForm.category,
          description: reasonText || cashForm.category,
          idempotency_key: `cash-${Date.now()}`,
        }),
      });

      setShowCashModal(false);
      setCashForm(INITIAL_CASH_FORM);
      showSuccessToast('Cashbook entry saved!');
      fetchAllData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Collect Customer Debt Repayment
  const handleRepayDebt = async (e) => {
    e.preventDefault();
    if (!repayingCredit) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/v1/credits/${repayingCredit.id}/repay`, {
        method: 'POST',
        body: JSON.stringify({
          amount: repayAmount,
          payment_method: repayMethod,
        }),
      });

      setRepayingCredit(null);
      setRepayAmount('');
      showSuccessToast(`Collected ${formatNaira(repayAmount)} and added to Cashbook!`);
      fetchAllData();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Opens Audit-Safe Correction / Void Modal instead of permanently deleting financial records
  const handleOpenCorrectTx = (tx) => {
    setCorrectingTx(tx);
  };

  // Update Store Profile
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiFetch('/api/v1/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      });
      setCurrentUser(data.user);
      showSuccessToast('Store profile updated!');
      setShowProfileModal(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Change Account Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/auth/password', {
        method: 'POST',
        body: JSON.stringify(passwordForm),
      });
      setPasswordForm({ current_password: '', new_password: '' });
      showSuccessToast('Account password updated!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Export CSV (Cross-OS compatible with UTF-8 BOM)
  const exportToCSV = (rows, filename) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(',');
    const csv = [
      headers,
      ...rows.map((r) =>
        Object.values(r)
          .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const navItems = useMemo(
    () => [
      {
        id: 'counter',
        route: '/store/sell',
        label: 'Point of Sale',
        shortLabel: 'POS',
        title: 'Point of Sale & Checkout',
        subtitle: 'Select products to build a customer order, process payment, and issue a receipt.',
        icon: ShoppingCart,
      },
      {
        id: 'inventory',
        route: '/store/stock',
        label: 'Inventory',
        shortLabel: 'Stock',
        title: 'Inventory & Stock Management',
        subtitle: 'Manage product quantities, cost and selling prices, unit margins, and restock alerts.',
        icon: ClipboardCheck,
      },
      {
        id: 'cashbook',
        route: '/store/cash',
        label: 'Cashbook',
        shortLabel: 'Cash',
        title: 'Cashbook & Expense Ledger',
        subtitle: 'Track inflows and operating expenses across Cash, POS terminals, and Bank Transfers.',
        icon: Wallet,
      },
      {
        id: 'history',
        route: '/store/history',
        label: 'Activity',
        shortLabel: 'Activity',
        title: 'Activity & Movement Ledger',
        subtitle: 'Review past sales, restocks, stock adjustments, and damaged inventory records.',
        icon: History,
      },
      {
        id: 'debtors',
        route: '/store/debtors',
        label: `Credit Book (${dashboard.active_debtors_count || 0})`,
        shortLabel: 'Credit',
        title: 'Customer Credit & Receivables',
        subtitle: 'Track outstanding customer balances, send reminders, and record repayments.',
        icon: Users,
      },
      {
        id: 'analytics',
        route: '/store/summary',
        label: 'Analytics',
        shortLabel: 'Summary',
        title: 'Channel Reconciliation & Category Valuation',
        subtitle: 'Compare physical cash against POS and transfer balances and review capital by category.',
        icon: BarChart3,
      },
    ],
    [dashboard.active_debtors_count]
  );

  const currentPageMeta = useMemo(
    () => navItems.find((item) => item.id === activeTab) || navItems[0],
    [navItems, activeTab]
  );

  const handleAuthenticatedUser = useCallback(
    (user) => {
      setCurrentUser(user);
      setProfileForm({
        full_name: user.full_name || '',
        business_name: user.business_name || '',
        phone: user.phone || '',
        location: user.location || '',
      });
      if (user.role === 'ADMIN') {
        showSuccessToast(`Welcome back, ${user.full_name}`);
        navigate('/admin');
      } else if (user.status !== 'APPROVED') {
        navigate('/pending');
      } else {
        showSuccessToast(`Signed in to ${user.business_name || 'Workspace'}`);
        navigate('/store/sell');
      }
    },
    [navigate, showSuccessToast]
  );

  // 1. Loading Session State
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="liquid-glass rounded-3xl px-8 py-6 text-center space-y-2">
          <div className="w-10 h-10 mx-auto rounded-2xl liquid-btn-primary flex items-center justify-center animate-pulse">
            <Package className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-theme-secondary">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated -> Render Dedicated Standalone /signup Page OR Dedicated Standalone /login Page
  if (!currentUser) {
    if (path === '/signup') {
      return (
        <SignupPage
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onAuthenticated={handleAuthenticatedUser}
          onNavigate={navigate}
        />
      );
    }
    return (
      <LoginPage
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onAuthenticated={handleAuthenticatedUser}
        onNavigate={navigate}
      />
    );
  }

  // 3. Dedicated Standalone Settings Page (/settings) for both Admin and User accounts
  if (path === '/settings' || path === '/store/settings' || path === '/admin/settings') {
    return (
      <SettingsPage
        currentUser={currentUser}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
    );
  }

  // 4. Pending Approval / Suspended / Rejected -> Render Dedicated Standalone Account Governance Page (/pending)
  if (currentUser.status !== 'APPROVED' && currentUser.role !== 'ADMIN') {
    return (
      <AccountStatusScreen
        user={currentUser}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onUserUpdated={(updated) => {
          setCurrentUser(updated);
          if (updated.status === 'APPROVED') {
            navigate('/store/sell');
          }
        }}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
    );
  }

  // 5. Dedicated Standalone Executive Admin Governance Page (/admin)
  //    Restricted to the single platform owner. The server independently enforces this on every admin API.
  const isPlatformOwner = currentUser.role === 'ADMIN' && currentUser.status === 'APPROVED';
  if (path === '/admin' || path.startsWith('/admin/')) {
    if (!isPlatformOwner) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="liquid-glass-elevated rounded-3xl p-8 max-w-md w-full text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-extrabold font-luxury text-theme-primary">Access Restricted</h1>
            <p className="text-xs text-theme-secondary">
              This area is reserved for the platform owner. You do not have permission to view it.
            </p>
            <button
              type="button"
              onClick={() => navigate('/store/sell')}
              className="liquid-btn-primary px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer"
            >
              Return to My Store
            </button>
          </div>
        </div>
      );
    }
    return (
      <AdminPage
        currentUser={currentUser}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onNavigate={navigate}
        onLogout={handleLogout}
        toast={toast}
        onToast={showSuccessToast}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      {/* Top Navigation Header */}
      <header className="liquid-glass-header text-slate-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-2xl liquid-btn-primary shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-xl font-extrabold font-luxury tracking-tight truncate text-white">
                  {currentUser.business_name || 'StockFlow'}
                </h1>
                <span className="hidden xs:inline-block text-[10px] sm:text-[11px] bg-sky-400/20 text-sky-200 border border-sky-300/35 px-2.5 py-0.5 rounded-full font-extrabold">
                  {currentUser.role === 'ADMIN' ? 'Admin' : 'Verified'} • {currencyCode} ({currencySymbol})
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300/90 truncate font-medium">
                {currentUser.full_name} {currentUser.location ? `• ${currentUser.location}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Navigate to Admin Console (For Admin Users) */}
            {currentUser.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="liquid-btn-primary flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin Console</span>
              </button>
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle color theme"
              className="flex items-center gap-1.5 bg-white/12 hover:bg-white/20 text-slate-100 border border-white/25 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-sky-300" />
                  <span className="hidden lg:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-sky-200" />
                  <span className="hidden lg:inline">Dark</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setEditingProduct(null);
                setProductForm(INITIAL_PRODUCT_FORM);
                setShowProductModal(true);
              }}
              className="flex items-center gap-1 bg-white/12 hover:bg-white/20 text-slate-100 border border-white/25 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden xs:inline">New</span>
              <span>Product</span>
            </button>

            <button
              onClick={() => {
                setCashForm(INITIAL_CASH_FORM);
                setShowCashModal(true);
              }}
              className="liquid-btn-primary flex items-center gap-1 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              <span className="hidden xs:inline">Record</span>
              <span>Entry</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              title="Account & Currency Settings"
              className="flex items-center gap-1 bg-white/12 hover:bg-white/20 text-slate-100 border border-white/25 px-2.5 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
            >
              <Settings className="w-4 h-4 text-sky-300" />
              <span className="hidden md:inline">Settings</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center gap-1 bg-rose-500/25 hover:bg-rose-500/40 text-slate-100 border border-rose-300/35 px-2.5 py-2 rounded-xl text-xs font-bold backdrop-blur-md cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-200" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Toast Alert */}
        {toast && (
          <div className="liquid-btn-primary px-4 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-200 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {error && (
          <div className="liquid-glass px-4 py-3 rounded-2xl text-sm flex items-center justify-between gap-2 text-theme-outflow">
            <span>{error}</span>
            <button
              onClick={() => fetchAllData()}
              className="text-xs font-bold underline cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* 4 KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <StatCard
            title="Net Balance"
            value={formatNaira(dashboard.net_cash_balance)}
            icon={Wallet}
            loading={loading}
            subtitle={
              <span>
                Today In:{' '}
                <strong className="text-theme-inflow tabular-nums">
                  +{formatNaira(dashboard.today_inflow)}
                </strong>{' '}
                | Out:{' '}
                <strong className="text-theme-outflow tabular-nums">
                  -{formatNaira(dashboard.today_outflow)}
                </strong>
              </span>
            }
          />
          <StatCard
            title="Inventory Value"
            value={formatNaira(dashboard.inventory_retail_value)}
            icon={Package}
            loading={loading}
            subtitle={
              <span>
                Cost:{' '}
                <strong className="text-theme-primary tabular-nums">
                  {formatNaira(dashboard.inventory_cost_value)}
                </strong>{' '}
                | Margin:{' '}
                <strong className="text-theme-inflow tabular-nums">
                  +{formatNaira(dashboard.projected_gross_margin)}
                </strong>
              </span>
            }
          />
          <StatCard
            title="Receivables"
            value={formatNaira(dashboard.total_credit_owed)}
            valueColor={
              Number(dashboard.total_credit_owed) > 0
                ? 'text-theme-outflow'
                : 'text-theme-primary'
            }
            icon={Users}
            loading={loading}
            subtitle={
              <span>
                <strong className="text-theme-primary">
                  {dashboard.active_debtors_count || 0} account(s)
                </strong>{' '}
                outstanding
              </span>
            }
          />
          <StatCard
            title="Restock Alerts"
            value={`${dashboard.low_stock_count || 0} Low Stock`}
            valueColor={
              Number(dashboard.low_stock_count) > 0
                ? 'text-theme-warning'
                : 'text-theme-inflow'
            }
            icon={AlertTriangle}
            loading={loading}
            subtitle={
              <button
                type="button"
                onClick={() => setShowRestockModal(true)}
                className="text-theme-brand font-extrabold underline cursor-pointer"
              >
                View Restock Plan →
              </button>
            }
          />
        </section>

        {/* Workspace Navigation Bar */}
        <div
          ref={tabSectionRef}
          style={{ scrollMarginTop: '4.5rem' }}
          className="liquid-glass p-1.5 rounded-2xl"
        >
          <div className="grid grid-cols-3 md:flex gap-1.5 w-full">
            {navItems.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectTab(t.id, false)}
                  className={`md:flex-1 py-2.5 px-2 sm:px-3 text-[11px] sm:text-xs md:text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'liquid-btn-primary shadow-sm'
                      : 'text-theme-secondary hover:text-theme-primary hover:bg-white/30 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="md:hidden truncate">{t.shortLabel}</span>
                  <span className="hidden md:inline">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Header */}
        <div className="liquid-glass-subtle px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold font-luxury text-theme-primary">
              {currentPageMeta.title}
            </h2>
            <p className="text-xs text-theme-secondary mt-0.5">{currentPageMeta.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="text-xs font-extrabold text-theme-brand hover:underline cursor-pointer flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Currency: {currencyCode} ({currencySymbol})</span>
          </button>
        </div>

        {/* Onboarding Launch Journey Card */}
        <OnboardingJourneyCard
          currentUser={currentUser}
          products={products}
          transactions={transactions}
          movements={movements}
          cashbookSession={cashbookSession}
          onOpenBusinessSetup={() => setShowBusinessSetupModal(true)}
          onSeedStarter={handleSeedStarterCatalog}
          onAddProduct={() => {
            setEditingProduct(null);
            setProductForm(INITIAL_PRODUCT_FORM);
            setShowProductModal(true);
          }}
          onOpenQuickStock={() => setShowQuickStockModal(true)}
          onGoToCounter={() => handleSelectTab('counter', false)}
          isDismissed={isOnboardingDismissed}
          onToggleDismiss={() => {
            setIsOnboardingDismissed((prev) => {
              const next = !prev;
              try {
                localStorage.setItem('stockflow_hide_onboarding', String(next));
              } catch {
                // ignore
              }
              return next;
            });
          }}
          formatCurrency={formatNaira}
        />

        {/* TAB 1: QUICK SELL (SHOP COUNTER) */}
        {activeTab === 'counter' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-start">
            {/* Left 2 Columns: Tap Products to Sell */}
            <div className="lg:col-span-2 liquid-glass rounded-3xl p-3.5 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <input
                    type="text"
                    placeholder="Search provision (Peak, Indomie, Sugar, Bread)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="liquid-input w-full pl-10 pr-4 py-2.5 text-sm rounded-2xl backdrop-blur-md"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="liquid-input text-xs rounded-2xl px-3.5 py-2.5 font-bold backdrop-blur-md"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? 'All Shop Categories' : c}
                    </option>
                  ))}
                </select>
              </div>

              {products.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Your store shelf is empty"
                  description="Add your first provision item or load the 12-item Lagos Starter Catalog (with 0 stock) to begin."
                  actionLabel="Load Lagos Starter Catalog"
                  onAction={handleSeedStarterCatalog}
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredProducts.map((p) => {
                    const inBasket = cart[p.id] || 0;
                    const stock = Number(p.stock_quantity);
                    const isLow = stock <= Number(p.reorder_level);
                    return (
                      <div
                        key={p.id}
                        onClick={() => stock > 0 && addToCart(p)}
                        style={
                          inBasket > 0
                            ? {
                                backgroundColor: 'var(--brand-blue-soft)',
                                borderColor: 'var(--brand-blue-border)',
                              }
                            : undefined
                        }
                        className={`liquid-glass-subtle p-4 rounded-2xl flex items-center justify-between gap-3 cursor-pointer select-none ${
                          stock <= 0
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:-translate-y-0.5 active:scale-[0.99]'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="font-extrabold font-luxury text-sm leading-snug break-words text-theme-primary">
                            {p.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-extrabold tabular-nums text-theme-brand">
                              {formatNaira(p.selling_price)} / {p.unit}
                            </span>
                            <Badge
                              variant={
                                stock <= 0 ? 'danger' : isLow ? 'warning' : 'success'
                              }
                            >
                              {stock <= 0
                                ? 'Out of Stock (0)'
                                : `Available: ${stock} ${p.unit}`}
                            </Badge>
                            {inBasket > 0 && (
                              <Badge variant="info">
                                In Cart: {inBasket} ({stock - inBasket} left)
                              </Badge>
                            )}
                          </div>
                        </div>

                        {stock <= 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(p);
                              setMovementForm({
                                movement_type: 'RESTOCK',
                                quantity: '',
                                record_cash: true,
                                amount_paid: '',
                                payment_method: 'CASH',
                                counterparty_name: p.supplier_name || '',
                                note: '',
                              });
                            }}
                            className="liquid-glass-subtle shrink-0 px-3 py-2 rounded-xl text-xs font-extrabold text-theme-brand cursor-pointer"
                          >
                            + Restock
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (stock > 0) addToCart(p);
                            }}
                            className="liquid-btn-primary shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {inBasket > 0 ? `Added (${inBasket})` : 'Sell'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Liquid Glass Customer Basket */}
            <div
              ref={basketRef}
              className="liquid-glass-elevated rounded-3xl p-4 sm:p-5 space-y-4 lg:sticky lg:top-20"
            >
              <div
                style={{ borderColor: 'var(--border-outer)' }}
                className="flex items-center justify-between border-b pb-3"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-theme-brand" />
                  <h2 className="font-extrabold font-luxury text-base">
                    Customer Basket
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {lastReceipt && (
                    <button
                      type="button"
                      onClick={() => setLastReceipt({ ...lastReceipt })}
                      className="text-[11px] font-bold text-theme-brand hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> Last Receipt
                    </button>
                  )}
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart({})}
                      className="text-xs font-bold text-theme-outflow hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {cartItems.length === 0 ? (
                <div className="py-10 text-center space-y-2 text-theme-secondary">
                  <ShoppingCart className="w-8 h-8 mx-auto stroke-1 opacity-60" />
                  <p className="text-xs font-medium">
                    Tap any provision item with stock to add it to the customer&apos;s basket.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInitiateCheckout} className="space-y-4">
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {cartItems.map(({ product, quantity, lineTotal }) => {
                      const stock = Number(product.stock_quantity);
                      const remaining = stock - quantity;
                      const isAtMax = quantity >= stock;

                      return (
                        <div
                          key={product.id}
                          className="liquid-glass-subtle p-3 rounded-2xl space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold truncate text-theme-primary">
                                {product.name}
                              </div>
                              <div className="text-[11px] tabular-nums text-theme-secondary">
                                {formatNaira(product.selling_price)} × {quantity} {product.unit} ={' '}
                                <strong className="text-theme-primary">
                                  {formatNaira(lineTotal)}
                                </strong>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(product.id)}
                              className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                              title="Remove item from basket"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Live Available Stock Indicator */}
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-theme-secondary">
                              Available Stock: <strong className="text-theme-primary">{stock} {product.unit}</strong>
                            </span>
                            <span
                              className={
                                remaining <= Number(product.reorder_level)
                                  ? 'text-amber-500 font-bold'
                                  : 'text-emerald-500 font-bold'
                              }
                            >
                              {remaining} left after sale
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t theme-divider">
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartQty(product.id, -1, stock)
                                }
                                className="liquid-input p-1.5 rounded-xl hover:opacity-80 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-extrabold tabular-nums w-6 text-center text-theme-primary">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                disabled={isAtMax}
                                onClick={() =>
                                  updateCartQty(product.id, 1, stock)
                                }
                                className="liquid-input p-1.5 rounded-xl hover:opacity-80 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isAtMax ? 'Maximum available shelf stock in basket' : 'Add another unit'}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <span className="text-xs font-black font-luxury text-theme-primary tabular-nums">
                              {formatNaira(lineTotal)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Bill Banner */}
                  <div className="liquid-glass-header text-white p-4 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-200">
                      Total Customer Bill
                    </span>
                    <span className="text-xl font-extrabold font-luxury tabular-nums text-white">
                      {formatNaira(cartTotal)}
                    </span>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-theme-primary">
                      How is the customer paying?
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'CASH', label: 'Cash (Naira)' },
                        { id: 'POS', label: 'POS (Moniepoint/OPay)' },
                        { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
                        { id: 'MOBILE_MONEY', label: 'USSD / Wallet' },
                      ].map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => setCheckoutMethod(m.id)}
                          className={`py-2.5 px-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                            checkoutMethod === m.id
                              ? 'liquid-btn-primary'
                              : 'liquid-glass-subtle hover:opacity-90'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Credit / Part Payment Toggle */}
                  <div className="liquid-glass-subtle p-3.5 rounded-2xl space-y-2.5">
                    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-theme-primary">
                      <input
                        type="checkbox"
                        checked={isPartPayment}
                        onChange={(e) => {
                          setIsPartPayment(e.target.checked);
                          if (!e.target.checked) setAmountPaidNow('');
                        }}
                      />
                      Customer is buying on Credit or Part-Payment
                    </label>

                    {isPartPayment && (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold mb-1 text-theme-secondary">
                            How much did they pay right now? (Enter 0 if full credit)
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            max={cartTotal}
                            value={amountPaidNow}
                            onChange={(e) => setAmountPaidNow(e.target.value)}
                            placeholder="e.g. 2000"
                            className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            required
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Customer Name"
                            className="liquid-input rounded-xl px-2.5 py-2 text-xs"
                          />
                          <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Phone (0803...)"
                            className="liquid-input rounded-xl px-2.5 py-2 text-xs"
                          />
                        </div>
                        <p className="text-[11px] font-bold tabular-nums text-theme-outflow">
                          Balance Owing:{' '}
                          {formatNaira(Math.max(0, cartTotal - Number(amountPaidNow || 0)))}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="liquid-btn-primary w-full py-3.5 rounded-2xl font-bold text-sm disabled:opacity-50 cursor-pointer"
                  >
                    {submitting
                      ? 'Processing Sale...'
                      : `Review & Complete Sale (${formatNaira(cartTotal)})`}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MY SHELF STOCK & STOCK-TAKING */}
        {activeTab === 'inventory' && (
          <div className="liquid-glass rounded-3xl overflow-hidden">
            <div
              style={{ borderColor: 'var(--border-outer)' }}
              className="p-3.5 sm:p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
            >
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                <input
                  type="text"
                  placeholder="Search goods by name, category, or supplier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="liquid-input w-full pl-10 pr-4 py-2 text-sm rounded-2xl"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkImportModal(true)}
                  className="liquid-glass-subtle flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 cursor-pointer"
                  title="Import goods in bulk via CSV or Excel paste"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Import</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(true)}
                  className="liquid-glass-subtle flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-sky-400 hover:bg-sky-500/10 border border-sky-500/30 cursor-pointer"
                  title="Physical shelf stock count audit comparing expected vs physical count"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>Stock Audit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchAdjustModal(true)}
                  className="liquid-glass-subtle flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/30 cursor-pointer"
                  title="Fast multi-product stock adjust (restock, damage, expired, missing)"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Batch Adjust</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRestockModal(true)}
                  className="liquid-btn-primary flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Market Order ({lowStockRestockPlan.length})
                </button>
                <button
                  onClick={() => setLowStockOnly(!lowStockOnly)}
                  className={`flex-1 sm:flex-initial justify-center flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold cursor-pointer ${
                    lowStockOnly ? 'liquid-btn-primary' : 'liquid-glass-subtle'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {lowStockOnly ? 'Showing Low Stock Only' : 'Filter Low Stock'}
                </button>
                <button
                  onClick={() =>
                    exportToCSV(
                      filteredProducts,
                      `shop-stock-${new Date().toISOString().slice(0, 10)}.csv`
                    )
                  }
                  className="liquid-glass-subtle flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-2xl hover:opacity-85 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            {/* Mobile Card View (< 768px) */}
            <div className="md:hidden divide-y theme-divider">
              {filteredProducts.map((p) => {
                const isLow = Number(p.stock_quantity) <= Number(p.reorder_level);
                const gain = Number(p.selling_price) - Number(p.cost_price);
                return (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold font-luxury text-sm text-theme-primary">
                          {p.name}
                        </div>
                        <div className="text-xs mt-0.5 text-theme-secondary">
                          {p.category} • {p.supplier_name || 'Local Market'}
                        </div>
                      </div>
                      <Badge
                        variant={isLow ? 'warning' : 'success'}
                        icon={isLow ? AlertTriangle : undefined}
                      >
                        {Number(p.stock_quantity)} {p.unit}
                      </Badge>
                    </div>

                    <div className="liquid-glass-subtle grid grid-cols-3 gap-2 text-xs p-2.5 rounded-2xl tabular-nums">
                      <div>
                        <span className="block text-theme-secondary">Cost</span>
                        <strong className="text-theme-primary">
                          {formatNaira(p.cost_price)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-theme-secondary">Selling</span>
                        <strong className="text-theme-primary">
                          {formatNaira(p.selling_price)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-theme-secondary">Gain/{p.unit}</span>
                        <strong className="text-theme-inflow">
                          +{formatNaira(gain)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setHistorySearch(p.name);
                          setHistoryTypeFilter('ALL');
                          setHistoryDateRange('ALL');
                          setActiveTab('history');
                        }}
                        className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5" /> History
                      </button>
                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          setProductForm({
                            sku: p.sku,
                            name: p.name,
                            category: p.category,
                            unit: p.unit,
                            cost_price: p.cost_price,
                            selling_price: p.selling_price,
                            stock_quantity: p.stock_quantity,
                            reorder_level: p.reorder_level,
                            supplier_name: p.supplier_name || '',
                          });
                          setShowProductModal(true);
                        }}
                        className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setMovementForm({
                            movement_type: 'RESTOCK',
                            quantity: '',
                            record_cash: true,
                            amount_paid: '',
                            payment_method: 'CASH',
                            counterparty_name: p.supplier_name || '',
                            note: '',
                          });
                        }}
                        className="liquid-btn-primary px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Restock / Count
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tablet & Desktop Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border-outer)',
                  }}
                  className="border-b text-[11px] font-bold uppercase tracking-wider text-theme-secondary"
                >
                  <tr>
                    <th className="py-3.5 px-4">Provision / Goods Name</th>
                    <th className="py-3.5 px-4">Category & Market</th>
                    <th className="py-3.5 px-4 text-right">Market Cost</th>
                    <th className="py-3.5 px-4 text-right">Selling Price</th>
                    <th className="py-3.5 px-4 text-right">Gain / Unit</th>
                    <th className="py-3.5 px-4 text-center">Remaining</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y theme-divider">
                  {filteredProducts.map((p) => {
                    const isLow = Number(p.stock_quantity) <= Number(p.reorder_level);
                    const gain = Number(p.selling_price) - Number(p.cost_price);
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-white/30 dark:hover:bg-white/5"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold font-luxury text-theme-primary">
                            {p.name}
                          </div>
                          <div className="text-xs text-theme-secondary">
                            Unit: {p.unit} • {p.sku}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant="neutral">{p.category}</Badge>
                          {p.supplier_name && (
                            <div className="text-xs mt-1 text-theme-secondary">
                              {p.supplier_name}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right tabular-nums text-theme-secondary">
                          {formatNaira(p.cost_price)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold tabular-nums text-theme-primary">
                          {formatNaira(p.selling_price)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-xs font-extrabold tabular-nums text-theme-inflow">
                          +{formatNaira(gain)}
                        </td>
                        <td className="py-3.5 px-4 text-center tabular-nums">
                          <Badge
                            variant={isLow ? 'warning' : 'success'}
                            icon={isLow ? AlertTriangle : undefined}
                          >
                            {Number(p.stock_quantity)} {p.unit}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setHistorySearch(p.name);
                                setHistoryTypeFilter('ALL');
                                setHistoryDateRange('ALL');
                                setActiveTab('history');
                              }}
                              className="liquid-glass-subtle p-1.5 hover:opacity-80 rounded-xl cursor-pointer text-theme-secondary"
                              title={`Check history for ${p.name}`}
                            >
                              <History className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setProductForm({
                                  sku: p.sku,
                                  name: p.name,
                                  category: p.category,
                                  unit: p.unit,
                                  cost_price: p.cost_price,
                                  selling_price: p.selling_price,
                                  stock_quantity: p.stock_quantity,
                                  reorder_level: p.reorder_level,
                                  supplier_name: p.supplier_name || '',
                                });
                                setShowProductModal(true);
                              }}
                              className="liquid-glass-subtle p-1.5 hover:opacity-80 rounded-xl cursor-pointer text-theme-secondary"
                              title="Edit price or details"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProduct(p);
                                setMovementForm({
                                  movement_type: 'RESTOCK',
                                  quantity: '',
                                  record_cash: true,
                                  amount_paid: '',
                                  payment_method: 'CASH',
                                  counterparty_name: p.supplier_name || '',
                                  note: '',
                                });
                              }}
                              className="liquid-btn-primary px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                            >
                              Restock / Count
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: MONEY IN & MONEY OUT (CASHBOOK) */}
        {activeTab === 'cashbook' && (
          <div className="space-y-4">
            {/* 1. DAILY OPENING & CLOSING BALANCE REGISTER BAR */}
            <div className="liquid-glass p-4 rounded-3xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 border border-emerald-500/20">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold font-luxury text-sm sm:text-base text-theme-primary">
                      Daily Cash Register ({cashbookSession?.targetDate || new Date().toISOString().slice(0, 10)})
                    </span>
                    <Badge
                      variant={
                        cashbookSession?.todaySession?.status === 'CLOSED' ? 'success' : 'info'
                      }
                    >
                      {cashbookSession?.todaySession?.status === 'CLOSED'
                        ? 'RECONCILED & CLOSED'
                        : 'REGISTER OPEN'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-theme-secondary mt-1 tabular-nums">
                    <span>
                      Opening Float:{' '}
                      <strong className="text-theme-primary">
                        {formatNaira(cashbookSession?.effectiveOpeningBalance || 0)}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Today In:{' '}
                      <strong className="text-theme-inflow">
                        +{formatNaira(cashbookSession?.dayInflow || 0)}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Today Out:{' '}
                      <strong className="text-theme-outflow">
                        -{formatNaira(cashbookSession?.dayOutflow || 0)}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Expected Closing:{' '}
                      <strong className="text-sky-400">
                        {formatNaira(cashbookSession?.expectedClosingBalance || 0)}
                      </strong>
                    </span>
                    {cashbookSession?.todaySession?.status === 'CLOSED' && (
                      <>
                        <span>•</span>
                        <span>
                          Counted Closing:{' '}
                          <strong className="text-emerald-400">
                            {formatNaira(cashbookSession?.todaySession?.actual_closing_balance || 0)}
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSessionModalMode('OPEN');
                    setShowSessionModal(true);
                  }}
                  className="liquid-glass-subtle px-3.5 py-2 rounded-2xl text-xs font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500/10"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Opening Balance
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSessionModalMode('CLOSE');
                    setShowSessionModal(true);
                  }}
                  className="liquid-btn-primary px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Reconcile & Close Day
                </button>
              </div>
            </div>

            {/* 2. PERIOD BALANCE & REPORT SUMMARY CARDS (OPENING -> INFLOW -> OUTFLOW -> CLOSING) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="liquid-glass p-4 rounded-2xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary">
                  Period Opening Balance
                </p>
                <p className="text-lg sm:text-xl font-extrabold font-luxury tabular-nums mt-1 text-theme-primary">
                  {formatNaira(cashbookReportSummary.openingBalance)}
                </p>
                <p className="text-[11px] mt-0.5 text-theme-secondary truncate">
                  {cashPeriodBounds.label}
                </p>
              </div>

              <div className="liquid-glass p-4 rounded-2xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary">
                  Period Money In (+)
                </p>
                <p className="text-lg sm:text-xl font-extrabold font-luxury tabular-nums mt-1 text-theme-inflow">
                  +{formatNaira(cashbookReportSummary.periodInflow)}
                </p>
                <p className="text-[11px] mt-0.5 text-theme-secondary">
                  Sales, repayments & inflows
                </p>
              </div>

              <div className="liquid-glass p-4 rounded-2xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary">
                  Period Expenses & Out (-)
                </p>
                <p className="text-lg sm:text-xl font-extrabold font-luxury tabular-nums mt-1 text-theme-outflow">
                  -{formatNaira(cashbookReportSummary.periodOutflow)}
                </p>
                <p className="text-[11px] mt-0.5 text-theme-secondary">
                  Across {cashbookReportSummary.expensesByCategory.length} expense category(s)
                </p>
              </div>

              <div className="liquid-glass p-4 rounded-2xl border border-sky-500/25">
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  Period Closing Balance
                </p>
                <p className="text-lg sm:text-xl font-extrabold font-luxury tabular-nums mt-1 text-sky-300">
                  {formatNaira(cashbookReportSummary.closingBalance)}
                </p>
                <p className="text-[11px] mt-0.5 text-theme-secondary">
                  Opening + Inflow − Outflow
                </p>
              </div>
            </div>

            {/* 3. PAYMENT CHANNEL BREAKDOWN CARDS (CASH vs POS vs BANK TRANSFER vs MOBILE WALLET) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {['CASH', 'POS', 'BANK_TRANSFER', 'MOBILE_MONEY'].map((chKey) => {
                const meta = getChannelBadgeMeta(chKey);
                const chStats = cashbookReportSummary.byChannel[chKey] || {
                  inflow: 0,
                  outflow: 0,
                  net: 0,
                  count: 0,
                };
                const Icon = meta.icon;
                const isSelected = channelFilter === chKey;
                return (
                  <button
                    type="button"
                    key={chKey}
                    onClick={() => setChannelFilter(isSelected ? 'ALL' : chKey)}
                    className={`liquid-glass p-3 rounded-2xl text-left transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-emerald-400 ring-1 ring-emerald-400/40'
                        : 'border-transparent hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${meta.pillClass}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>
                      <span className="text-[10px] font-bold text-theme-secondary">
                        {chStats.count} tx
                      </span>
                    </div>
                    <div className="text-sm sm:text-base font-extrabold font-luxury tabular-nums text-theme-primary">
                      {formatNaira(chStats.net)}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-theme-secondary mt-1 tabular-nums">
                      <span className="text-theme-inflow">In: +{formatNaira(chStats.inflow)}</span>
                      <span className="text-theme-outflow">Out: -{formatNaira(chStats.outflow)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 4. EXPENSE BREAKDOWN BY CATEGORY STRIP (WHEN EXPENSES EXIST IN PERIOD) */}
            {cashbookReportSummary.expensesByCategory.length > 0 && (
              <div className="liquid-glass px-4 py-3 rounded-2xl flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary mr-1">
                  Expenses by Category:
                </span>
                {cashbookReportSummary.expensesByCategory.map((exp) => (
                  <button
                    type="button"
                    key={exp.category}
                    onClick={() =>
                      setCashCategoryFilter(
                        cashCategoryFilter === exp.category ? 'ALL' : exp.category
                      )
                    }
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                      cashCategoryFilter === exp.category
                        ? 'liquid-btn-primary'
                        : 'liquid-glass-subtle hover:opacity-90'
                    }`}
                  >
                    <span>{exp.category}:</span>
                    <span className="text-theme-outflow tabular-nums">
                      {formatNaira(exp.amount)}
                    </span>
                    <span className="text-[10px] opacity-70">({exp.count})</span>
                  </button>
                ))}
                {cashCategoryFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setCashCategoryFilter('ALL')}
                    className="text-xs font-bold text-emerald-400 hover:underline ml-1 cursor-pointer"
                  >
                    Reset Category
                  </button>
                )}
              </div>
            )}

            {/* 5. MAIN CASHBOOK LEDGER & FILTERS */}
            <div className="liquid-glass rounded-3xl overflow-hidden">
              <div
                style={{ borderColor: 'var(--border-outer)' }}
                className="p-3.5 sm:p-4 border-b space-y-3"
              >
                {/* Row 1: Date Range Report Presets (Daily, Weekly, Monthly, Custom, All) & Type Filter */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary mr-1">
                      Report Period:
                    </span>
                    {[
                      { id: 'ALL', label: 'All Time' },
                      { id: 'DAILY', label: 'Daily (Today)' },
                      { id: 'WEEKLY', label: 'Weekly (7d)' },
                      { id: 'MONTHLY', label: 'Monthly (30d)' },
                      { id: 'CUSTOM', label: 'Custom Range' },
                    ].map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setCashDateRange(p.id);
                          if (p.id !== 'CUSTOM') {
                            setCashStartDate('');
                            setCashEndDate('');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          cashDateRange === p.id ? 'liquid-btn-primary' : 'liquid-glass-subtle'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}

                    {cashDateRange === 'CUSTOM' && (
                      <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800 text-xs">
                        <span className="text-[11px] text-theme-secondary">From:</span>
                        <input
                          type="date"
                          value={cashStartDate}
                          onChange={(e) => setCashStartDate(e.target.value)}
                          className="liquid-input text-xs rounded-lg px-2 py-1"
                        />
                        <span className="text-[11px] text-theme-secondary">To:</span>
                        <input
                          type="date"
                          value={cashEndDate}
                          onChange={(e) => setCashEndDate(e.target.value)}
                          className="liquid-input text-xs rounded-lg px-2 py-1"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'All Money' },
                      { id: 'INFLOW', label: 'Money In (+)' },
                      { id: 'OUTFLOW', label: 'Expenses Out (-)' },
                    ].map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setCashFilter(t.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          cashFilter === t.id ? 'liquid-btn-primary' : 'liquid-glass-subtle'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Row 2: Payment Channel Pills, Category Select, Search, Audit Trail Toggle & Export */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t theme-divider">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'All Channels' },
                      { id: 'CASH', label: 'Cash' },
                      { id: 'POS', label: 'POS' },
                      { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
                      { id: 'MOBILE_MONEY', label: 'Mobile Wallet' },
                    ].map((ch) => (
                      <button
                        type="button"
                        key={ch.id}
                        onClick={() => setChannelFilter(ch.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          channelFilter === ch.id
                            ? 'liquid-btn-primary'
                            : 'liquid-glass-subtle'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}

                    <select
                      value={cashCategoryFilter}
                      onChange={(e) => setCashCategoryFilter(e.target.value)}
                      className="liquid-input text-xs rounded-xl px-2.5 py-1.5 font-bold max-w-[175px]"
                    >
                      {cashbookCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat === 'ALL' ? 'All Categories' : cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                      <input
                        type="text"
                        placeholder="Search reason, category, payer..."
                        value={cashSearch}
                        onChange={(e) => setCashSearch(e.target.value)}
                        className="liquid-input w-full pl-8 pr-3 py-1.5 text-xs rounded-xl"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAuditTrail(!showAuditTrail)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer ${
                        showAuditTrail
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'liquid-glass-subtle text-theme-secondary'
                      }`}
                      title="Toggle visibility of corrected and voided audit trail entries"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Audit Trail</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        exportToCSV(
                          filteredTransactions,
                          `cashbook-${cashDateRange.toLowerCase()}-${new Date()
                            .toISOString()
                            .slice(0, 10)}.csv`
                        )
                      }
                      className="liquid-glass-subtle flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl hover:opacity-80 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                  </div>
                </div>
              </div>

              {filteredTransactions.length === 0 ? (
                <EmptyState
                  icon={Wallet}
                  title="No cashbook entries match your current filter"
                  description="Try switching to 'All Time' or 'All Channels', or record a new shop expense or sale."
                  actionLabel="Reset Cashbook Filters"
                  onAction={() => {
                    setCashFilter('ALL');
                    setChannelFilter('ALL');
                    setCashDateRange('ALL');
                    setCashStartDate('');
                    setCashEndDate('');
                    setCashCategoryFilter('ALL');
                    setCashSearch('');
                    setShowAuditTrail(true);
                  }}
                />
              ) : (
                <>
                  {/* Mobile Card View (< 768px) */}
                  <div className="md:hidden divide-y theme-divider">
                    {filteredTransactions.map((tx) => {
                      const txStatus = tx.status || 'ACTIVE';
                      const isInactive = txStatus !== 'ACTIVE';
                      const chMeta = getChannelBadgeMeta(tx.payment_method);
                      const ChIcon = chMeta.icon;
                      const reasonText = tx.expense_reason || tx.description;

                      return (
                        <div
                          key={tx.id}
                          className={`p-4 space-y-2 ${isInactive ? 'opacity-60 bg-slate-950/30' : ''}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge
                                variant={tx.type === 'INFLOW' ? 'success' : 'danger'}
                                icon={tx.type === 'INFLOW' ? ArrowUpRight : ArrowDownRight}
                              >
                                {tx.type === 'INFLOW' ? 'MONEY IN' : 'EXPENSE'}
                              </Badge>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border ${chMeta.pillClass}`}
                              >
                                <ChIcon className="w-3 h-3" />
                                {chMeta.label}
                              </span>
                              {tx.parent_transaction_id && (
                                <Badge variant="info">
                                  AMENDED (Replaces #{tx.parent_transaction_id})
                                </Badge>
                              )}
                              {txStatus === 'CORRECTED' && (
                                <Badge variant="warning">
                                  SUPERSEDED {tx.replaced_by_id ? `→ #${tx.replaced_by_id}` : ''}
                                </Badge>
                              )}
                              {txStatus === 'VOIDED' && (
                                <Badge variant="danger">VOIDED</Badge>
                              )}
                            </div>

                            <span
                              className={`text-base font-extrabold font-luxury tabular-nums ${
                                isInactive
                                  ? 'line-through text-slate-500'
                                  : tx.type === 'INFLOW'
                                  ? 'text-theme-inflow'
                                  : 'text-theme-outflow'
                              }`}
                            >
                              {tx.type === 'INFLOW' ? '+' : '-'}
                              {formatNaira(tx.amount)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-sm text-theme-primary">
                              {tx.category}
                            </span>
                            <span className="text-[11px] font-mono text-theme-secondary">
                              #{tx.id}
                            </span>
                          </div>

                          <div className="text-xs text-theme-secondary">
                            {tx.counterparty_name ? (
                              <strong className="text-theme-primary">
                                {tx.counterparty_name}:{' '}
                              </strong>
                            ) : null}
                            {reasonText}
                          </div>

                          {tx.correction_reason && (
                            <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-2.5 py-1">
                              <strong>Audit Note:</strong> {tx.correction_reason}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 text-[11px]">
                            <span className="text-theme-secondary">
                              {new Date(tx.transaction_date).toLocaleString()}
                            </span>
                            {!isInactive && (
                              <button
                                type="button"
                                onClick={() => handleOpenCorrectTx(tx)}
                                className="liquid-glass-subtle px-2.5 py-1 rounded-lg text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" /> Correct / Void
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          borderColor: 'var(--border-outer)',
                        }}
                        className="border-b text-[11px] font-bold uppercase tracking-wider text-theme-secondary"
                      >
                        <tr>
                          <th className="py-3.5 px-4">Date & Time</th>
                          <th className="py-3.5 px-4">Type & Audit Status</th>
                          <th className="py-3.5 px-4">Category</th>
                          <th className="py-3.5 px-4">Expense Reason / Details</th>
                          <th className="py-3.5 px-4">Payment Channel</th>
                          <th className="py-3.5 px-4 text-right">Amount ({currencySymbol})</th>
                          <th className="py-3.5 px-4 text-right">Audit Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y theme-divider">
                        {filteredTransactions.map((tx) => {
                          const txStatus = tx.status || 'ACTIVE';
                          const isInactive = txStatus !== 'ACTIVE';
                          const chMeta = getChannelBadgeMeta(tx.payment_method);
                          const ChIcon = chMeta.icon;
                          const reasonText = tx.expense_reason || tx.description;

                          return (
                            <tr
                              key={tx.id}
                              className={`hover:bg-white/30 dark:hover:bg-white/5 ${
                                isInactive ? 'opacity-60 bg-slate-950/30' : ''
                              }`}
                            >
                              <td className="py-3.5 px-4 text-xs tabular-nums text-theme-secondary whitespace-nowrap">
                                <div>{new Date(tx.transaction_date).toLocaleString()}</div>
                                <div className="text-[10px] font-mono opacity-75">Entry #{tx.id}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge
                                    variant={tx.type === 'INFLOW' ? 'success' : 'danger'}
                                    icon={tx.type === 'INFLOW' ? ArrowUpRight : ArrowDownRight}
                                  >
                                    {tx.type === 'INFLOW' ? 'MONEY IN' : 'EXPENSE'}
                                  </Badge>
                                  {tx.parent_transaction_id && (
                                    <Badge variant="info">
                                      AMENDED (#{tx.parent_transaction_id})
                                    </Badge>
                                  )}
                                  {txStatus === 'CORRECTED' && (
                                    <Badge variant="warning">
                                      CORRECTED {tx.replaced_by_id ? `→ #${tx.replaced_by_id}` : ''}
                                    </Badge>
                                  )}
                                  {txStatus === 'VOIDED' && (
                                    <Badge variant="danger">VOIDED</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-extrabold font-luxury text-theme-primary">
                                {tx.category}
                              </td>
                              <td className="py-3.5 px-4 text-theme-secondary max-w-md">
                                <div>
                                  {tx.counterparty_name ? (
                                    <strong className="text-theme-primary">
                                      {tx.counterparty_name}:{' '}
                                    </strong>
                                  ) : null}
                                  {reasonText}
                                </div>
                                {tx.correction_reason && (
                                  <div className="text-[11px] text-amber-300 mt-1 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5 inline-block">
                                    <strong>Audit Reason:</strong> {tx.correction_reason}
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${chMeta.pillClass}`}
                                >
                                  <ChIcon className="w-3.5 h-3.5" />
                                  {chMeta.label}
                                </span>
                              </td>
                              <td
                                className={`py-3.5 px-4 text-right font-extrabold font-luxury tabular-nums whitespace-nowrap ${
                                  isInactive
                                    ? 'line-through text-slate-500'
                                    : tx.type === 'INFLOW'
                                    ? 'text-theme-inflow'
                                    : 'text-theme-outflow'
                                }`}
                              >
                                {tx.type === 'INFLOW' ? '+' : '-'}
                                {formatNaira(tx.amount)}
                              </td>
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                {!isInactive ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCorrectTx(tx)}
                                    title="Correct or void this entry while preserving audit history"
                                    className="liquid-glass-subtle px-2.5 py-1.5 rounded-xl text-xs font-bold text-theme-primary hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>Correct</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-500 italic">
                                    Audit Locked
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: CHECK HISTORY (SALES, RESTOCKS & SHELF COUNT LOG) */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Period Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="liquid-glass p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary">
                    Sales in Selected History
                  </p>
                  <p className="text-xl font-extrabold font-luxury tabular-nums mt-1 text-theme-inflow">
                    {formatNaira(historySummary.salesValue)}
                  </p>
                  <p className="text-xs mt-0.5 text-theme-secondary">
                    Across {historySummary.salesCount} sale record(s)
                  </p>
                </div>
                <ShoppingCart className="w-6 h-6 opacity-80 text-theme-brand" />
              </div>

              <div className="liquid-glass p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary">
                    Market Restocks in History
                  </p>
                  <p className="text-xl font-extrabold font-luxury tabular-nums mt-1 text-theme-primary">
                    {formatNaira(historySummary.restockValue)}
                  </p>
                  <p className="text-xs mt-0.5 text-theme-secondary">
                    Across {historySummary.restockCount} restock record(s)
                  </p>
                </div>
                <Package className="w-6 h-6 opacity-80 text-theme-brand" />
              </div>

              <div className="liquid-glass p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary">
                    Losses, Damaged & Spoilage
                  </p>
                  <p className="text-xl font-extrabold font-luxury tabular-nums mt-1 text-theme-outflow">
                    {formatNaira(historySummary.lossValue)}
                  </p>
                  <p className="text-xs mt-0.5 text-theme-secondary">
                    Across {historySummary.lossCount} write-off(s) ({filteredMovements.length} total rows)
                  </p>
                </div>
                <History className="w-6 h-6 opacity-80 text-theme-brand" />
              </div>
            </div>

            {/* History Table & Filters Card */}
            <div className="liquid-glass rounded-3xl overflow-hidden">
              <div
                style={{ borderColor: 'var(--border-outer)' }}
                className="p-3.5 sm:p-4 border-b space-y-3"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Movement Types Filter Buttons */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'ALL', label: 'All Activity' },
                      { id: 'SALE', label: 'Sales Out' },
                      { id: 'RESTOCK', label: 'Restocks' },
                      { id: 'DAMAGED', label: 'Damaged' },
                      { id: 'EXPIRED', label: 'Expired' },
                      { id: 'MISSING', label: 'Missing' },
                      { id: 'ADJUSTMENT', label: 'Shelf Counts' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setHistoryTypeFilter(type.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          historyTypeFilter === type.id
                            ? 'liquid-btn-primary'
                            : 'liquid-glass-subtle'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {/* Product Filter Dropdown */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-theme-secondary whitespace-nowrap">
                      Product:
                    </span>
                    <select
                      value={historyProductFilter}
                      onChange={(e) => setHistoryProductFilter(e.target.value)}
                      className="liquid-input text-xs rounded-xl px-2.5 py-1.5 max-w-[200px] truncate"
                    >
                      <option value="ALL">All Goods ({products.length})</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date Filter & Search Row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t theme-divider">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'All Dates' },
                      { id: 'TODAY', label: 'Today' },
                      { id: '7DAYS', label: '7 Days' },
                      { id: '30DAYS', label: '30 Days' },
                      { id: 'CUSTOM', label: 'Date Range' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setHistoryDateRange(d.id);
                          if (d.id !== 'CUSTOM') {
                            setHistoryStartDate('');
                            setHistoryEndDate('');
                            setHistoryCustomDate('');
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          historyDateRange === d.id
                            ? 'liquid-btn-primary'
                            : 'liquid-glass-subtle'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}

                    {historyDateRange === 'CUSTOM' && (
                      <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-800 text-xs">
                        <span className="text-[11px] text-theme-secondary">From:</span>
                        <input
                          type="date"
                          value={historyStartDate}
                          onChange={(e) => setHistoryStartDate(e.target.value)}
                          className="liquid-input text-xs rounded-lg px-2 py-1"
                        />
                        <span className="text-[11px] text-theme-secondary">To:</span>
                        <input
                          type="date"
                          value={historyEndDate}
                          onChange={(e) => setHistoryEndDate(e.target.value)}
                          className="liquid-input text-xs rounded-lg px-2 py-1"
                        />
                      </div>
                    )}
                  </div>

                  <div className="relative flex-1 max-w-sm flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                      <input
                        type="text"
                        placeholder="Search item, note, supplier..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="liquid-input w-full pl-9 pr-3 py-1.5 text-xs rounded-xl"
                      />
                    </div>
                    {historySearch && (
                      <button
                        type="button"
                        onClick={() => setHistorySearch('')}
                        className="text-xs font-bold text-theme-outflow flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      exportToCSV(
                        filteredMovements,
                        `shop-history-${new Date().toISOString().slice(0, 10)}.csv`
                      )
                    }
                    className="liquid-glass-subtle flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl hover:opacity-80 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
              </div>

              {filteredMovements.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No history records match your filter"
                  description="Try resetting your movement type, product, or date filters."
                  actionLabel="Reset All History Filters"
                  onAction={() => {
                    setHistoryTypeFilter('ALL');
                    setHistoryProductFilter('ALL');
                    setHistoryDateRange('ALL');
                    setHistoryStartDate('');
                    setHistoryEndDate('');
                    setHistoryCustomDate('');
                    setHistorySearch('');
                  }}
                />
              ) : (
                <>
                  {/* Mobile History Cards (< 768px) */}
                  <div className="md:hidden divide-y theme-divider">
                    {filteredMovements.map((m) => {
                      const badgeInfo = getMovementBadgeInfo(m.movement_type);
                      return (
                        <div key={m.id} className="p-4 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={badgeInfo.variant}>
                              {badgeInfo.label}
                            </Badge>
                            <span className="font-extrabold font-luxury tabular-nums text-sm text-theme-primary">
                              {formatNaira(m.total_value)}
                            </span>
                          </div>
                          <div className="font-extrabold font-luxury text-sm text-theme-primary">
                            {m.product_name}
                          </div>
                          <div className="liquid-glass-subtle flex items-center justify-between text-xs p-2.5 rounded-2xl tabular-nums">
                            <span className="text-theme-secondary">
                              Before: {Number(m.previous_stock)}
                            </span>
                            <strong
                              className={
                                Number(m.quantity_change) >= 0
                                  ? 'text-theme-inflow'
                                  : 'text-theme-outflow'
                              }
                            >
                              {Number(m.quantity_change) > 0
                                ? `+${Number(m.quantity_change)}`
                                : Number(m.quantity_change)}{' '}
                              {m.unit}
                            </strong>
                            <span className="text-theme-primary font-bold">
                              After: {Number(m.new_stock)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-theme-secondary pt-1 border-t theme-divider">
                            <span>
                              {m.counterparty_name || m.note || 'Walk-in / Shop Log'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span>{new Date(m.created_at).toLocaleDateString()}</span>
                              {m.movement_type === 'SALE' && (
                                <button
                                  type="button"
                                  onClick={() => openReceiptForMovement(m)}
                                  className="font-bold text-theme-brand hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Receipt
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop History Table (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          borderColor: 'var(--border-outer)',
                        }}
                        className="border-b text-[11px] font-bold uppercase tracking-wider text-theme-secondary"
                      >
                        <tr>
                          <th className="py-3.5 px-4">Date & Time</th>
                          <th className="py-3.5 px-4">Provision / Goods</th>
                          <th className="py-3.5 px-4">Action</th>
                          <th className="py-3.5 px-4 text-right">Before</th>
                          <th className="py-3.5 px-4 text-right">Qty Changed</th>
                          <th className="py-3.5 px-4 text-right">After (Shelf)</th>
                          <th className="py-3.5 px-4 text-right">Value ({currencySymbol})</th>
                          <th className="py-3.5 px-4">Customer / Supplier / Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y theme-divider">
                        {filteredMovements.map((m) => {
                          const badgeInfo = getMovementBadgeInfo(m.movement_type);
                          return (
                            <tr
                              key={m.id}
                              className="hover:bg-white/30 dark:hover:bg-white/5"
                            >
                              <td className="py-3.5 px-4 text-xs whitespace-nowrap tabular-nums text-theme-secondary">
                                {new Date(m.created_at).toLocaleString()}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-extrabold font-luxury text-theme-primary">
                                  {m.product_name}
                                </div>
                                <div className="text-xs font-mono text-theme-secondary">
                                  {m.sku}
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <Badge variant={badgeInfo.variant}>
                                  {badgeInfo.label}
                                </Badge>
                              </td>
                              <td className="py-3.5 px-4 text-right tabular-nums text-theme-secondary">
                                {Number(m.previous_stock)} {m.unit}
                              </td>
                              <td
                                className={`py-3.5 px-4 text-right font-extrabold tabular-nums ${
                                  Number(m.quantity_change) >= 0
                                    ? 'text-theme-inflow'
                                    : 'text-theme-outflow'
                                }`}
                              >
                                {Number(m.quantity_change) > 0
                                  ? `+${Number(m.quantity_change)}`
                                  : Number(m.quantity_change)}{' '}
                                {m.unit}
                              </td>
                              <td className="py-3.5 px-4 text-right font-extrabold tabular-nums text-theme-primary">
                                {Number(m.new_stock)} {m.unit}
                              </td>
                              <td className="py-3.5 px-4 text-right font-extrabold font-luxury tabular-nums text-theme-primary">
                                {formatNaira(m.total_value)}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-theme-secondary">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    {m.counterparty_name ? (
                                      <strong className="text-theme-primary">
                                        {m.counterparty_name}
                                      </strong>
                                    ) : null}
                                    {m.counterparty_name && m.note ? ' — ' : ''}
                                    {m.note || (!m.counterparty_name ? '—' : '')}
                                  </div>
                                  {m.movement_type === 'SALE' && (
                                    <button
                                      type="button"
                                      onClick={() => openReceiptForMovement(m)}
                                      className="liquid-glass-subtle px-2.5 py-1 rounded-lg text-[11px] font-bold text-theme-brand hover:opacity-80 flex items-center gap-1 cursor-pointer shrink-0"
                                      title="View & Print Sales Receipt"
                                    >
                                      <FileText className="w-3 h-3" /> Slip
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: DEBTORS BOOK (CUSTOMERS OWING ME) */}
        {activeTab === 'debtors' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Top KPI Cards for Debtors */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="Total Credit Owed"
                value={formatNaira(debtorMetrics.totalOwed)}
                subtitle={`${debtorMetrics.owingCustomersCount} customers owing`}
                icon={Wallet}
                accent="red"
              />
              <StatCard
                title="Overdue Debt"
                value={formatNaira(debtorMetrics.totalOverdue)}
                subtitle={
                  debtorMetrics.overdueCount > 0
                    ? `${debtorMetrics.overdueCount} overdue accounts!`
                    : 'All due dates current'
                }
                icon={AlertTriangle}
                accent={debtorMetrics.overdueCount > 0 ? 'red' : 'emerald'}
              />
              <StatCard
                title="Total Debt Collected"
                value={formatNaira(debtorMetrics.totalCollected)}
                subtitle="Historical repayments"
                icon={CheckCircle2}
                accent="emerald"
              />
              <StatCard
                title="Credit Invoices"
                value={credits.length}
                subtitle={`${customerLedgers.length} customer ledgers`}
                icon={FileText}
                accent="blue"
              />
            </div>

            {/* Main Debtors Card & Action Center */}
            <div className="liquid-glass rounded-3xl overflow-hidden">
              {/* Header Bar */}
              <div
                style={{ borderColor: 'var(--border-outer)' }}
                className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <h3 className="font-extrabold font-luxury text-base sm:text-lg text-theme-primary flex items-center gap-2">
                    <Users className="w-5 h-5 text-theme-primary" />
                    Customers Owing the Shop (Debtors Ledger)
                  </h3>
                  <p className="text-xs text-theme-secondary mt-0.5">
                    Track customer balances, set due dates, send WhatsApp reminders, and generate statements of account.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAddCreditModal(true)}
                    className="liquid-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Plus className="w-4 h-4" /> Record Credit Sale
                  </button>
                </div>
              </div>

              {/* View Switcher, Filter Pills & Search Bar */}
              <div
                style={{ borderColor: 'var(--border-outer)', backgroundColor: 'var(--bg-subtle)' }}
                className="p-3 sm:p-4 border-b space-y-3"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* View Toggle: Accounts vs Slips */}
                  <div className="flex items-center gap-1 bg-theme-input p-1 rounded-2xl border theme-divider">
                    <button
                      type="button"
                      onClick={() => setDebtorViewMode('ACCOUNTS')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                        debtorViewMode === 'ACCOUNTS'
                          ? 'liquid-btn-primary shadow-sm'
                          : 'text-theme-secondary hover:text-theme-primary'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" /> By Customer Account ({customerLedgers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDebtorViewMode('SLIPS')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                        debtorViewMode === 'SLIPS'
                          ? 'liquid-btn-primary shadow-sm'
                          : 'text-theme-secondary hover:text-theme-primary'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Individual Slips ({credits.length})
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'All' },
                      { id: 'OWING', label: `Owing (${debtorMetrics.owingCustomersCount})` },
                      { id: 'OVERDUE', label: `Overdue (${debtorMetrics.overdueCount})` },
                      { id: 'SETTLED', label: 'Settled' },
                    ].map((f) => {
                      const active = debtorFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setDebtorFilter(f.id)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition border cursor-pointer ${
                            active
                              ? 'bg-primary/20 border-primary text-theme-primary'
                              : 'liquid-glass-subtle border-theme-border text-theme-secondary hover:text-theme-primary'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                  <input
                    type="text"
                    value={debtorSearch}
                    onChange={(e) => setDebtorSearch(e.target.value)}
                    placeholder="Search by customer name, phone number, market address, or goods taken..."
                    className="w-full pl-9 pr-9 py-2 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {debtorSearch && (
                    <button
                      type="button"
                      onClick={() => setDebtorSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-theme-muted hover:text-theme-primary cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* VIEW 1: AGGREGATE CUSTOMER ACCOUNTS */}
              {debtorViewMode === 'ACCOUNTS' && (
                <>
                  {filteredLedgers.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title={
                        debtorSearch
                          ? `No debtors match "${debtorSearch}"`
                          : debtorFilter === 'OVERDUE'
                          ? 'Great news! No overdue debtors right now'
                          : debtorFilter === 'OWING'
                          ? 'No customer is currently owing you'
                          : 'No debtor accounts found'
                      }
                      description="When customers buy on credit or part-payment at checkout, all their credit transactions will automatically group under one unified customer balance here."
                    />
                  ) : (
                    <>
                      {/* Mobile Cards for Customer Accounts (< 768px) */}
                      <div className="md:hidden divide-y theme-divider">
                        {filteredLedgers.map((l) => {
                          const isOwing = Number(l.total_balance_due) > 0;
                          return (
                            <div key={l.customer_name} className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-extrabold font-luxury text-base text-theme-primary">
                                    {l.customer_name}
                                  </div>
                                  <div className="text-xs text-theme-secondary flex items-center gap-2 mt-0.5">
                                    {l.phone && <span>{l.phone}</span>}
                                    {l.customer_address && (
                                      <span className="truncate max-w-[150px]">• {l.customer_address}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  {isOwing ? (
                                    l.is_overdue ? (
                                      <Badge variant="danger">
                                        <AlertTriangle className="w-3 h-3 mr-1 inline" />
                                        {l.max_days_overdue > 0 ? `${l.max_days_overdue}d Overdue` : 'Overdue'}
                                      </Badge>
                                    ) : (
                                      <Badge variant="warning">Owing</Badge>
                                    )
                                  ) : (
                                    <Badge variant="success">Settled</Badge>
                                  )}
                                  <div className="text-[11px] font-mono text-theme-muted mt-1">
                                    {l.active_credits_count} open {l.active_credits_count === 1 ? 'slip' : 'slips'}
                                  </div>
                                </div>
                              </div>

                              {/* Balance & Totals Grid */}
                              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-theme-input/50 border theme-divider text-center">
                                <div>
                                  <div className="text-[10px] text-theme-muted uppercase">Billed</div>
                                  <div className="text-xs font-bold text-theme-primary tabular-nums">
                                    {formatNaira(l.total_credit_taken)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-theme-muted uppercase">Paid</div>
                                  <div className="text-xs font-bold text-theme-inflow tabular-nums">
                                    {formatNaira(l.total_paid)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[10px] text-theme-muted uppercase font-bold">Balance</div>
                                  <div className="text-xs font-extrabold text-theme-outflow tabular-nums">
                                    {formatNaira(l.total_balance_due)}
                                  </div>
                                </div>
                              </div>

                              {/* Earliest Due Date notice */}
                              {isOwing && l.earliest_due_date && (
                                <div className="text-[11px] text-theme-secondary flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                                  <span>
                                    Earliest due:{' '}
                                    {new Date(l.earliest_due_date).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                </div>
                              )}

                              {/* Quick Action Buttons */}
                              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t theme-divider">
                                <button
                                  type="button"
                                  onClick={() => setWhatsAppModalTarget(l)}
                                  className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer hover:text-emerald-500"
                                  title="Send WhatsApp payment reminder"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatementModalCustomer(l.customer_name)}
                                  className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer hover:text-primary"
                                  title="View and print statement of account"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Statement
                                </button>
                                {isOwing && (
                                  <button
                                    type="button"
                                    onClick={() => setRepaymentModalTarget(l)}
                                    className="liquid-btn-primary px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer"
                                  >
                                    Collect Money
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table for Customer Accounts (>= 768px) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead
                            style={{
                              backgroundColor: 'var(--bg-subtle)',
                              borderColor: 'var(--border-outer)',
                            }}
                            className="border-b text-[11px] font-bold uppercase tracking-wider text-theme-secondary"
                          >
                            <tr>
                              <th className="py-3.5 px-4">Customer Name & Contact</th>
                              <th className="py-3.5 px-4 text-center">Open Slips</th>
                              <th className="py-3.5 px-4 text-right">Total Goods Taken</th>
                              <th className="py-3.5 px-4 text-right">Total Paid</th>
                              <th className="py-3.5 px-4 text-right">Balance Owed</th>
                              <th className="py-3.5 px-4 text-center">Status / Due Date</th>
                              <th className="py-3.5 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y theme-divider">
                            {filteredLedgers.map((l) => {
                              const isOwing = Number(l.total_balance_due) > 0;
                              return (
                                <tr
                                  key={l.customer_name}
                                  className="hover:bg-white/30 dark:hover:bg-white/5 transition"
                                >
                                  <td className="py-3.5 px-4">
                                    <div className="font-extrabold font-luxury text-theme-primary">
                                      {l.customer_name}
                                    </div>
                                    <div className="text-xs text-theme-secondary flex items-center gap-2 mt-0.5">
                                      {l.phone && <span>{l.phone}</span>}
                                      {l.customer_address && (
                                        <span className="truncate max-w-xs text-theme-muted">
                                          • {l.customer_address}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-theme-input text-xs font-mono font-bold text-theme-secondary">
                                      {l.active_credits_count} active / {l.credit_count} total
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right tabular-nums text-theme-secondary">
                                    {formatNaira(l.total_credit_taken)}
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-bold tabular-nums text-theme-inflow">
                                    {formatNaira(l.total_paid)}
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-extrabold font-luxury tabular-nums text-theme-outflow text-base">
                                    {formatNaira(l.total_balance_due)}
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    {isOwing ? (
                                      l.is_overdue ? (
                                        <div className="space-y-0.5">
                                          <Badge variant="danger">
                                            <AlertTriangle className="w-3 h-3 mr-1 inline" />
                                            {l.max_days_overdue > 0 ? `${l.max_days_overdue}d Overdue` : 'Overdue'}
                                          </Badge>
                                          {l.earliest_due_date && (
                                            <div className="text-[10px] text-rose-500 font-mono">
                                              Due {new Date(l.earliest_due_date).toLocaleDateString('en-GB')}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-0.5">
                                          <Badge variant="warning">Owing</Badge>
                                          {l.earliest_due_date && (
                                            <div className="text-[10px] text-theme-muted font-mono">
                                              Due {new Date(l.earliest_due_date).toLocaleDateString('en-GB')}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    ) : (
                                      <Badge variant="success">Settled</Badge>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setWhatsAppModalTarget(l)}
                                        className="liquid-glass-subtle p-2 rounded-xl text-xs font-semibold hover:text-emerald-500 transition cursor-pointer"
                                        title="Send WhatsApp payment reminder"
                                      >
                                        <MessageCircle className="w-4 h-4 text-emerald-500" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setStatementModalCustomer(l.customer_name)}
                                        className="liquid-glass-subtle p-2 rounded-xl text-xs font-semibold hover:text-primary transition cursor-pointer"
                                        title="View Customer Statement of Account"
                                      >
                                        <FileText className="w-4 h-4 text-theme-secondary" />
                                      </button>
                                      {isOwing && (
                                        <button
                                          type="button"
                                          onClick={() => setRepaymentModalTarget(l)}
                                          className="liquid-btn-primary px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                                        >
                                          Collect Money
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* VIEW 2: INDIVIDUAL CREDIT SLIPS */}
              {debtorViewMode === 'SLIPS' && (
                <>
                  {filteredCredits.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title={
                        debtorSearch
                          ? `No credit slips match "${debtorSearch}"`
                          : debtorFilter === 'OVERDUE'
                          ? 'No overdue credit slips'
                          : debtorFilter === 'OWING'
                          ? 'No owing credit slips'
                          : 'No credit slips recorded yet'
                      }
                      description="Individual purchases on credit or part-payment made at the counter are itemized here."
                    />
                  ) : (
                    <>
                      {/* Mobile Cards for Slips (< 768px) */}
                      <div className="md:hidden divide-y theme-divider">
                        {filteredCredits.map((c) => {
                          const isOwing = c.status === 'OWING' && Number(c.balance_due) > 0;
                          return (
                            <div key={c.id} className="p-4 space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-extrabold font-luxury text-sm text-theme-primary">
                                    {c.customer_name}
                                  </div>
                                  <div className="text-xs text-theme-secondary">
                                    {c.phone || 'No phone saved'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  {isOwing ? (
                                    c.is_overdue ? (
                                      <Badge variant="danger">
                                        <AlertTriangle className="w-3 h-3 mr-1 inline" />
                                        {c.days_overdue > 0 ? `${c.days_overdue}d Overdue` : 'Overdue'}
                                      </Badge>
                                    ) : (
                                      <Badge variant="warning">OWING {formatNaira(c.balance_due)}</Badge>
                                    )
                                  ) : (
                                    <Badge variant="success">SETTLED</Badge>
                                  )}
                                </div>
                              </div>

                              <p className="text-xs text-theme-secondary bg-theme-input/40 p-2 rounded-lg font-mono">
                                {c.items_summary}
                              </p>

                              <div className="flex items-center justify-between text-xs text-theme-muted">
                                <span>Total: {formatNaira(c.total_amount)}</span>
                                <span>Paid: {formatNaira(c.amount_paid)}</span>
                                {c.due_date && (
                                  <span className={c.is_overdue ? 'text-rose-500 font-bold' : ''}>
                                    Due: {new Date(c.due_date).toLocaleDateString('en-GB')}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1 border-t theme-divider">
                                <button
                                  type="button"
                                  onClick={() => setWhatsAppModalTarget(c)}
                                  className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer hover:text-emerald-500"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatementModalCustomer(c.customer_name)}
                                  className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" /> Statement
                                </button>
                                {isOwing && (
                                  <button
                                    type="button"
                                    onClick={() => setRepaymentModalTarget(c)}
                                    className="liquid-btn-primary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                                  >
                                    Pay Slip
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table for Slips (>= 768px) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead
                            style={{
                              backgroundColor: 'var(--bg-subtle)',
                              borderColor: 'var(--border-outer)',
                            }}
                            className="border-b text-[11px] font-bold uppercase tracking-wider text-theme-secondary"
                          >
                            <tr>
                              <th className="py-3.5 px-4">Customer Name & Phone</th>
                              <th className="py-3.5 px-4">Goods Taken</th>
                              <th className="py-3.5 px-4 text-right">Total Bill</th>
                              <th className="py-3.5 px-4 text-right">Paid So Far</th>
                              <th className="py-3.5 px-4 text-right">Balance Owing</th>
                              <th className="py-3.5 px-4 text-center">Due Date & Status</th>
                              <th className="py-3.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y theme-divider">
                            {filteredCredits.map((c) => {
                              const isOwing = c.status === 'OWING' && Number(c.balance_due) > 0;
                              return (
                                <tr
                                  key={c.id}
                                  className="hover:bg-white/30 dark:hover:bg-white/5 transition"
                                >
                                  <td className="py-3.5 px-4">
                                    <div className="font-extrabold font-luxury text-theme-primary">
                                      {c.customer_name}
                                    </div>
                                    <div className="text-xs text-theme-secondary">
                                      {c.phone || 'No phone saved'}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-xs max-w-xs text-theme-secondary">
                                    {c.items_summary}
                                  </td>
                                  <td className="py-3.5 px-4 text-right tabular-nums text-theme-secondary">
                                    {formatNaira(c.total_amount)}
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-bold tabular-nums text-theme-inflow">
                                    {formatNaira(c.amount_paid)}
                                  </td>
                                  <td className="py-3.5 px-4 text-right font-extrabold font-luxury tabular-nums text-theme-outflow">
                                    {formatNaira(c.balance_due)}
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    {isOwing ? (
                                      c.is_overdue ? (
                                        <div className="space-y-0.5">
                                          <Badge variant="danger">
                                            <AlertTriangle className="w-3 h-3 mr-1 inline" />
                                            {c.days_overdue > 0 ? `${c.days_overdue}d Overdue` : 'Overdue'}
                                          </Badge>
                                          {c.due_date && (
                                            <div className="text-[10px] text-rose-500 font-mono">
                                              Due {new Date(c.due_date).toLocaleDateString('en-GB')}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-0.5">
                                          <Badge variant="warning">OWING</Badge>
                                          {c.due_date && (
                                            <div className="text-[10px] text-theme-muted font-mono">
                                              Due {new Date(c.due_date).toLocaleDateString('en-GB')}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    ) : (
                                      <Badge variant="success">SETTLED</Badge>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setWhatsAppModalTarget(c)}
                                        className="liquid-glass-subtle p-2 rounded-xl text-xs font-semibold hover:text-emerald-500 transition cursor-pointer"
                                        title="Send WhatsApp payment reminder"
                                      >
                                        <MessageCircle className="w-4 h-4 text-emerald-500" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setStatementModalCustomer(c.customer_name)}
                                        className="liquid-glass-subtle p-2 rounded-xl text-xs font-semibold hover:text-primary transition cursor-pointer"
                                        title="View Customer Statement of Account"
                                      >
                                        <FileText className="w-4 h-4 text-theme-secondary" />
                                      </button>
                                      {isOwing && (
                                        <button
                                          type="button"
                                          onClick={() => setRepaymentModalTarget(c)}
                                          className="liquid-btn-primary px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                                        >
                                          Pay Slip
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: POS VS CASH RECONCILIATION & PROFIT (P&L) */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {/* Control & Date Filter Bar */}
            <div className="liquid-glass rounded-3xl p-4 sm:p-5 border theme-divider space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold font-luxury text-base sm:text-lg text-theme-primary flex items-center gap-2">
                    <Scale className="w-5 h-5 text-theme-primary" />
                    POS vs. Cash Reconciliation &amp; Retail Profit
                  </h3>
                  <p className="text-xs text-theme-secondary mt-0.5">
                    Clear distinction between Sales Revenue, Gross Profit, Operating Expenses, Net Profit, Liquid Cash, and Inventory Capital.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReconcileModal(true)}
                    className="liquid-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer whitespace-nowrap"
                  >
                    <Scale className="w-4 h-4" /> Reconcile Daily Cash &amp; POS
                  </button>
                </div>
              </div>

              {/* Date Filter Pills */}
              <div className="pt-2 border-t theme-divider flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-theme-secondary flex items-center gap-1 mr-1">
                    <Calendar className="w-3.5 h-3.5" /> Performance Period:
                  </span>
                  {[
                    { id: 'TODAY', label: 'Today' },
                    { id: 'WEEK', label: 'This Week (7 Days)' },
                    { id: 'MONTH', label: 'This Month (30 Days)' },
                    { id: 'CUSTOM', label: 'Custom Range' },
                  ].map((p) => {
                    const active = analyticsDateRange === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAnalyticsDateRange(p.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                          active
                            ? 'bg-primary/20 border-primary text-theme-primary'
                            : 'liquid-glass-subtle border-theme-border text-theme-secondary hover:text-theme-primary'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {analyticsDateRange === 'CUSTOM' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={analyticsStartDate}
                      onChange={(e) => setAnalyticsStartDate(e.target.value)}
                      className="px-2.5 py-1 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary focus:outline-none"
                    />
                    <span className="text-xs text-theme-secondary">to</span>
                    <input
                      type="date"
                      value={analyticsEndDate}
                      onChange={(e) => setAnalyticsEndDate(e.target.value)}
                      className="px-2.5 py-1 rounded-xl text-xs bg-theme-input border border-theme-border text-theme-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Core 6 Financial Metrics with Educational Explainer */}
            <FinancialMetricsOverview
              metrics={analyticsFinancials.metrics}
              formatNaira={formatNaira}
              dateRangeLabel={analyticsFinancials.dateRangeLabel}
              onOpenReconcile={() => setShowReconcileModal(true)}
            />

            {/* Profit & Loss Statement (Itemized P&L Table) */}
            <ProfitAndLossStatement
              metrics={analyticsFinancials.metrics}
              expenseBreakdown={analyticsFinancials.expenseBreakdown}
              channelBreakdown={analyticsFinancials.channelBreakdown}
              dateRangeLabel={analyticsFinancials.dateRangeLabel}
              formatNaira={formatNaira}
            />

            {/* Payment Channels Inflow vs Outflow & Category Shelf Inventory */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cash vs POS vs Bank Transfers in Period */}
              <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="text-base font-extrabold font-luxury text-theme-primary flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-theme-primary" />
                    Cash Drawer vs. POS Terminal &amp; Bank Transfers
                  </h3>
                  <p className="text-xs text-theme-secondary mt-0.5">
                    How money moved through each channel during {analyticsFinancials.dateRangeLabel.toLowerCase()}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        borderColor: 'var(--border-outer)',
                      }}
                      className="text-[11px] font-bold uppercase tracking-wider border-b text-theme-secondary"
                    >
                      <tr>
                        <th className="py-2.5 px-3">Payment Channel</th>
                        <th className="py-2.5 px-3 text-right">Money In</th>
                        <th className="py-2.5 px-3 text-right">Money Out</th>
                        <th className="py-2.5 px-3 text-right">Period Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y theme-divider">
                      {analyticsFinancials.channelBreakdown.length > 0 ? (
                        analyticsFinancials.channelBreakdown.map((ch) => (
                          <tr key={ch.payment_method}>
                            <td className="py-3 px-3 font-bold text-xs text-theme-primary">
                              {ch.label || PAYMENT_CHANNEL_LABELS[ch.payment_method] || ch.payment_method}
                            </td>
                            <td className="py-3 px-3 text-right font-bold tabular-nums text-theme-inflow">
                              +{formatNaira(ch.inflow)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold tabular-nums text-theme-outflow">
                              -{formatNaira(ch.outflow)}
                            </td>
                            <td className="py-3 px-3 text-right font-extrabold font-luxury tabular-nums text-theme-primary">
                              {formatNaira(ch.inflow - ch.outflow)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-xs text-theme-secondary">
                            No channel transactions recorded in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shelf Goods Value by Category */}
              <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="text-base font-extrabold font-luxury text-theme-primary flex items-center gap-2">
                    <Package className="w-4 h-4 text-theme-primary" />
                    Shelf Goods Capital by Category
                  </h3>
                  <p className="text-xs text-theme-secondary mt-0.5">
                    Physical stock capital currently locked on shelves and expected retail returns
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead
                      style={{
                        backgroundColor: 'var(--bg-subtle)',
                        borderColor: 'var(--border-outer)',
                      }}
                      className="text-[11px] font-bold uppercase tracking-wider border-b text-theme-secondary"
                    >
                      <tr>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-center">SKUs</th>
                        <th className="py-2.5 px-3 text-right">Cost Capital</th>
                        <th className="py-2.5 px-3 text-right">Selling Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y theme-divider">
                      {(dashboard.categories || []).map((cat) => (
                        <tr key={cat.category}>
                          <td className="py-3 px-3 font-extrabold font-luxury text-theme-primary">
                            {cat.category}
                          </td>
                          <td className="py-3 px-3 text-center tabular-nums text-theme-secondary">
                            {cat.sku_count}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-theme-secondary font-mono">
                            {formatNaira(cat.cost_value)}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold font-luxury tabular-nums text-theme-inflow">
                            {formatNaira(cat.retail_value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FLOATING MOBILE BASKET REVIEW & CHECKOUT BAR */}
      {activeTab === 'counter' && cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30">
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="liquid-glass-header w-full text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-white/25 flex items-center justify-between active:scale-[0.99] transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-sky-300" />
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white rounded-full text-[10px] font-black w-4 h-4 flex items-center justify-center">
                  {cartItemCount}
                </span>
              </div>
              <span className="text-xs font-bold pl-1">
                Review Basket ({cartItemCount} items)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black font-luxury tabular-nums text-sky-200">
                {formatNaira(cartTotal)}
              </span>
              <span className="text-xs bg-sky-500/30 text-sky-100 px-2.5 py-1 rounded-xl font-bold">
                Review & Pay →
              </span>
            </div>
          </button>
        </div>
      )}

      {/* LIQUID GLASS MOBILE BOTTOM NAVIGATION BAR (< 768px) */}
      <nav
        aria-label="Mobile Navigation"
        className={`md:hidden liquid-glass-elevated fixed bottom-0 left-0 right-0 z-50 border-t grid ${
          navItems.length > 6 ? 'grid-cols-7' : 'grid-cols-6'
        } pb-safe px-1 pt-1`}
      >
        {navItems.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleSelectTab(t.id, true)}
              className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer select-none ${
                isActive ? 'liquid-btn-primary shadow-sm' : 'text-theme-secondary'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">{t.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* MODAL 1: RESTOCK / PHYSICAL SHELF COUNT / DAMAGED */}
      <Modal
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name}
        subtitle={`Currently on Shelf: ${Number(selectedProduct?.stock_quantity || 0)} ${
          selectedProduct?.unit || ''
        } | Market Cost: ${formatNaira(selectedProduct?.cost_price)} | Selling: ${formatNaira(
          selectedProduct?.selling_price
        )}`}
      >
        <form onSubmit={handleRecordMovement} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {[
              { id: 'RESTOCK', label: 'Restock (+)' },
              { id: 'ADJUSTMENT', label: 'Shelf Count' },
              { id: 'DAMAGED', label: 'Damaged (-)' },
              { id: 'EXPIRED', label: 'Expired (-)' },
              { id: 'MISSING', label: 'Missing (-)' },
            ].map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setMovementForm({ ...movementForm, movement_type: t.id })}
                className={`py-2 px-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  movementForm.movement_type === t.id
                    ? 'liquid-btn-primary'
                    : 'liquid-glass-subtle'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                {movementForm.movement_type === 'ADJUSTMENT'
                  ? `How many ${selectedProduct?.unit} on the shelf?`
                  : ['DAMAGED', 'EXPIRED', 'MISSING'].includes(movementForm.movement_type)
                  ? `How many ${selectedProduct?.unit} written off?`
                  : `How many ${selectedProduct?.unit} added?`}
              </label>
              <input
                type="number"
                step="any"
                required
                value={movementForm.quantity}
                onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                placeholder="Enter number..."
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Supplier / Market Name
              </label>
              <input
                type="text"
                value={movementForm.counterparty_name}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, counterparty_name: e.target.value })
                }
                placeholder="e.g. Oke-Arin / Mushin"
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          {movementForm.movement_type === 'RESTOCK' && (
            <div className="liquid-glass-subtle p-3.5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-theme-primary">
                  <input
                    type="checkbox"
                    checked={movementForm.record_cash}
                    onChange={(e) =>
                      setMovementForm({ ...movementForm, record_cash: e.target.checked })
                    }
                  />
                  Deduct this market purchase from my Cashbook
                </label>
                <span className="text-xs font-extrabold tabular-nums shrink-0 text-theme-primary">
                  Cost: {formatNaira(expectedMovementValue)}
                </span>
              </div>

              {movementForm.record_cash && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1 text-theme-secondary">
                      Amount Paid (Blank = {formatNaira(expectedMovementValue)})
                    </label>
                    <input
                      type="number"
                      placeholder={String(expectedMovementValue)}
                      value={movementForm.amount_paid}
                      onChange={(e) =>
                        setMovementForm({ ...movementForm, amount_paid: e.target.value })
                      }
                      className="liquid-input w-full rounded-xl px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1 text-theme-secondary">
                      How did you pay?
                    </label>
                    <select
                      value={movementForm.payment_method}
                      onChange={(e) =>
                        setMovementForm({ ...movementForm, payment_method: e.target.value })
                      }
                      className="liquid-input w-full rounded-xl px-2.5 py-1.5 text-xs"
                    >
                      <option value="CASH">Cash (Naira)</option>
                      <option value="BANK_TRANSFER">Bank Transfer (OPay / Bank)</option>
                      <option value="POS">POS</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Short Note (Optional)
            </label>
            <input
              type="text"
              value={movementForm.note}
              onChange={(e) => setMovementForm({ ...movementForm, note: e.target.value })}
              placeholder="e.g. Bought from Mushin depot or weekly shelf count"
              className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="px-4 py-2 text-xs font-semibold cursor-pointer text-theme-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="liquid-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Update Shelf Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ADD OR EDIT GOODS */}
      <Modal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setEditingProduct(null);
        }}
        title={
          editingProduct ? `Update Goods: ${editingProduct.name}` : 'Add New Provision / Goods'
        }
        subtitle="Enter the price you buy from market and the price you sell at your shop"
      >
        <form onSubmit={handleSaveProduct} className="space-y-3">
          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Product Name (e.g. Peak Milk Roll, Indomie Carton, Dangote Sugar)
            </label>
            <input
              required
              placeholder="Enter item name..."
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Category
              </label>
              <select
                value={productForm.category}
                onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="Milk & Drinks">Milk & Drinks</option>
                <option value="Noodles & Pasta">Noodles & Pasta</option>
                <option value="Swallow & Grains">Swallow & Grains (Rice/Semo/Garri)</option>
                <option value="Cooking Oil">Cooking Oil & Seasoning</option>
                <option value="Canned Food">Canned Food (Sardine/Tomato)</option>
                <option value="Cereals & Snacks">Cereals, Biscuits & Snacks</option>
                <option value="Soap & Household">Soap, Detergent & Toiletries</option>
                <option value="Bread & Bakery">Bread & Bakery</option>
                <option value="Provisions">Other Provisions</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Selling Unit (How do you sell it?)
              </label>
              <select
                value={productForm.unit}
                onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="Piece">Single Piece</option>
                <option value="Roll">Roll / Dozen</option>
                <option value="Pack">Pack</option>
                <option value="Carton">Carton</option>
                <option value="Bag">Bag</option>
                <option value="Tin">Tin / Can</option>
                <option value="Loaf">Loaf</option>
                <option value="Pouch">Pouch / Bottle</option>
                <option value="Crate">Crate</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Cost Price ({currencySymbol})
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 2600"
                value={productForm.cost_price}
                onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Selling Price ({currencySymbol})
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 3000"
                value={productForm.selling_price}
                onChange={(e) =>
                  setProductForm({ ...productForm, selling_price: e.target.value })
                }
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!editingProduct && (
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-primary">
                  How many on shelf now?
                </label>
                <input
                  type="number"
                  required
                  value={productForm.stock_quantity}
                  onChange={(e) =>
                    setProductForm({ ...productForm, stock_quantity: e.target.value })
                  }
                  className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Warn me when remaining reaches:
              </label>
              <input
                type="number"
                required
                value={productForm.reorder_level}
                onChange={(e) =>
                  setProductForm({ ...productForm, reorder_level: e.target.value })
                }
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Market / Supplier (Optional)
            </label>
            <input
              placeholder="e.g. Oke-Arin, Mushin, Trade Fair, Distributor"
              value={productForm.supplier_name}
              onChange={(e) =>
                setProductForm({ ...productForm, supplier_name: e.target.value })
              }
              className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-3">
            {editingProduct ? (
              <button
                type="button"
                onClick={() => handleDeleteProduct(editingProduct)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Item
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 text-xs font-semibold cursor-pointer text-theme-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="liquid-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                {submitting ? 'Saving...' : 'Save Goods'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: RECORD SHOP EXPENSE OR CASH INFLOW */}
      <Modal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        title="Record Shop Expense or Money In"
        subtitle="Log every shop expense with a clear category, reason, and payment channel (Cash, POS, or Transfer)"
      >
        <form onSubmit={handleCreateCashTx} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setCashForm({
                  ...cashForm,
                  type: 'OUTFLOW',
                  category: 'Generator & Power',
                })
              }
              className={`py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                cashForm.type === 'OUTFLOW'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                  : 'liquid-glass-subtle'
              }`}
            >
              - MONEY OUT (EXPENSE)
            </button>
            <button
              type="button"
              onClick={() =>
                setCashForm({
                  ...cashForm,
                  type: 'INFLOW',
                  category: 'Counter Sales',
                })
              }
              className={`py-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                cashForm.type === 'INFLOW'
                  ? 'liquid-btn-primary'
                  : 'liquid-glass-subtle'
              }`}
            >
              + MONEY IN (INFLOW)
            </button>
          </div>

          {cashForm.type === 'OUTFLOW' ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-theme-primary">
                1. Select Expense Category:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {LAGOS_EXPENSE_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setCashForm({ ...cashForm, category: preset })}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                      cashForm.category === preset
                        ? 'liquid-btn-primary'
                        : 'liquid-glass-subtle'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-theme-primary">
                1. Select Money In Category:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['Counter Sales', 'Credit Repayment', 'Wholesale Order', 'Capital / Float In', 'Other Income'].map(
                  (preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setCashForm({ ...cashForm, category: preset })}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer ${
                        cashForm.category === preset
                          ? 'liquid-btn-primary'
                          : 'liquid-glass-subtle'
                      }`}
                    >
                      {preset}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Visual Payment Channel Selector */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-theme-primary">
              2. Payment Channel (Cash, POS, or Bank Transfer):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['CASH', 'POS', 'BANK_TRANSFER', 'MOBILE_MONEY'].map((chId) => {
                const meta = getChannelBadgeMeta(chId);
                const Icon = meta.icon;
                const active = cashForm.payment_method === chId;
                return (
                  <button
                    type="button"
                    key={chId}
                    onClick={() => setCashForm({ ...cashForm, payment_method: chId })}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      active
                        ? meta.pillClass
                        : 'liquid-glass-subtle text-theme-secondary hover:opacity-90'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                3. Amount ({currencySymbol})
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 5000"
                value={cashForm.amount}
                onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                {cashForm.type === 'OUTFLOW'
                  ? 'Payee / Vendor Name (Optional)'
                  : 'Payer / Customer Name (Optional)'}
              </label>
              <input
                type="text"
                value={cashForm.counterparty_name}
                onChange={(e) => setCashForm({ ...cashForm, counterparty_name: e.target.value })}
                placeholder={
                  cashForm.type === 'OUTFLOW'
                    ? 'e.g. Total Petrol Station / Market Driver'
                    : 'e.g. Walk-in Customer'
                }
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              {cashForm.type === 'OUTFLOW'
                ? '4. Specific Expense Reason / Purpose (Required)'
                : '4. Description / Reference Note'}
            </label>
            <input
              required={cashForm.type === 'OUTFLOW'}
              value={cashForm.expense_reason || cashForm.description}
              onChange={(e) =>
                setCashForm({
                  ...cashForm,
                  expense_reason: e.target.value,
                  description: e.target.value,
                })
              }
              placeholder={
                cashForm.type === 'OUTFLOW'
                  ? 'e.g. Bought 10 litres of petrol for evening shop generator'
                  : 'e.g. Bulk carton order paid via transfer'
              }
              className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCashModal(false)}
              className="px-4 py-2 text-xs font-semibold cursor-pointer text-theme-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="liquid-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save to Cashbook'}
            </button>
          </div>
        </form>
      </Modal>

      {/* DEBTOR BOOK MODALS */}
      <WhatsAppReminderModal
        isOpen={Boolean(whatsAppModalTarget)}
        onClose={() => setWhatsAppModalTarget(null)}
        debtor={whatsAppModalTarget}
        storeName={currentUser?.business_name || 'Our Provision Store'}
        storePhone={currentUser?.phone || ''}
        formatNaira={formatNaira}
      />

      <CustomerStatementModal
        isOpen={Boolean(statementModalCustomer)}
        onClose={() => setStatementModalCustomer(null)}
        customerName={statementModalCustomer}
        storeName={currentUser?.business_name || 'StockFlow Store'}
        storePhone={currentUser?.phone || ''}
        storeAddress={currentUser?.address || ''}
        apiFetch={apiFetch}
        formatNaira={formatNaira}
      />

      <CustomerRepaymentModal
        isOpen={Boolean(repaymentModalTarget || repayingCredit)}
        onClose={() => {
          setRepaymentModalTarget(null);
          setRepayingCredit(null);
        }}
        target={repaymentModalTarget || repayingCredit}
        onSuccess={() => {
          showSuccessToast('Debt payment recorded and added to Cashbook!');
          refreshDebtors();
        }}
        apiFetch={apiFetch}
        formatNaira={formatNaira}
      />

      <CustomerCreditModal
        isOpen={showAddCreditModal}
        onClose={() => setShowAddCreditModal(false)}
        onSuccess={() => {
          showSuccessToast('Credit sale recorded successfully!');
          refreshDebtors();
        }}
        apiFetch={apiFetch}
        existingCustomers={customerLedgers}
        formatNaira={formatNaira}
      />

      {/* DAILY POS, CASH & BANK RECONCILIATION MODAL */}
      <DailyChannelReconciliationModal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        sessionState={cashbookSession}
        transactions={transactions}
        apiFetch={apiFetch}
        formatNaira={formatNaira}
        storeName={currentUser?.business_name || 'StockFlow Store'}
        onSuccess={() => {
          showSuccessToast('Daily channel reconciliation recorded!');
          fetchAllData();
        }}
      />

      {/* INSTANT DIGITAL SALE RECEIPT (PRINTABLE THERMAL SLIP & WHATSAPP / SHARE) */}
      <ReceiptModal
        isOpen={Boolean(lastReceipt)}
        onClose={() => setLastReceipt(null)}
        receipt={lastReceipt}
        formatNaira={formatNaira}
      />

      {/* CHECKOUT CONFIRMATION STEP (PREVENTS ACCIDENTAL CHECKOUT & VERIFIES STOCK) */}
      <CheckoutConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmCheckout}
        isSubmitting={submitting}
        cartItems={cartItems}
        cartTotal={cartTotal}
        paymentMethod={checkoutMethod}
        isPartPayment={isPartPayment}
        amountPaidNow={amountPaidNow}
        customerName={customerName}
        customerPhone={customerPhone}
        formatNaira={formatNaira}
      />

      {/* MOBILE CART REVIEW & CHECKOUT SHEET (< 1024px) */}
      <MobileCartSheet
        isOpen={isMobileCartOpen}
        onClose={() => setIsMobileCartOpen(false)}
        cartItems={cartItems}
        cartTotal={cartTotal}
        cartItemCount={cartItemCount}
        updateCartQty={updateCartQty}
        removeFromCart={removeFromCart}
        clearCart={clearCart}
        checkoutMethod={checkoutMethod}
        setCheckoutMethod={setCheckoutMethod}
        isPartPayment={isPartPayment}
        setIsPartPayment={setIsPartPayment}
        amountPaidNow={amountPaidNow}
        setAmountPaidNow={setAmountPaidNow}
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerPhone={customerPhone}
        setCustomerPhone={setCustomerPhone}
        onProceedCheckout={() => {
          setIsMobileCartOpen(false);
          handleInitiateCheckout();
        }}
        formatNaira={formatNaira}
      />

      {/* BULK PRODUCT IMPORT MODAL (CSV & EXCEL) */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        apiFetch={apiFetch}
        formatCurrency={formatNaira}
        toastSuccess={(msg) => showSuccessToast(msg)}
        toastError={(msg) => toastError?.(msg) || alert(msg)}
        onImportSuccess={() => fetchAllData()}
      />

      {/* PHYSICAL STOCK COUNT & SHELF AUDIT MODAL */}
      <PhysicalStockAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        products={products}
        apiFetch={apiFetch}
        formatCurrency={formatNaira}
        toastSuccess={(msg) => showSuccessToast(msg)}
        toastError={(msg) => toastError?.(msg) || alert(msg)}
        onReconcileSuccess={() => fetchAllData()}
      />

      {/* QUICK MULTI-PRODUCT BATCH ADJUSTMENT MODAL */}
      <BatchAdjustModal
        isOpen={showBatchAdjustModal}
        onClose={() => setShowBatchAdjustModal(false)}
        products={products}
        apiFetch={apiFetch}
        formatCurrency={formatNaira}
        toastSuccess={(msg) => showSuccessToast(msg)}
        toastError={(msg) => toastError?.(msg) || alert(msg)}
        onSuccess={() => fetchAllData()}
      />

      {/* ONBOARDING: QUICK OPENING STOCK COUNT MODAL */}
      <QuickStockModal
        isOpen={showQuickStockModal}
        onClose={() => setShowQuickStockModal(false)}
        products={products}
        apiFetch={apiFetch}
        formatCurrency={formatNaira}
        toastSuccess={(msg) => showSuccessToast(msg)}
        toastError={(msg) => toastError?.(msg) || alert(msg)}
        onSuccess={() => fetchAllData()}
      />

      {/* ONBOARDING: STORE PROFILE & CASH FLOAT SETUP MODAL */}
      <BusinessSetupModal
        isOpen={showBusinessSetupModal}
        onClose={() => setShowBusinessSetupModal(false)}
        currentUser={currentUser}
        cashbookSession={cashbookSession}
        apiFetch={apiFetch}
        toastSuccess={(msg) => showSuccessToast(msg)}
        toastError={(msg) => toastError?.(msg) || alert(msg)}
        onSuccess={(updatedUser) => {
          if (updatedUser) setCurrentUser(updatedUser);
          fetchAllData();
        }}
      />

      {/* DAILY CASHBOOK OPENING & CLOSING BALANCE REGISTER MODAL */}
      <CashbookSessionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        initialMode={sessionModalMode}
        sessionState={cashbookSession}
        apiFetch={apiFetch}
        formatCurrency={formatNaira}
        currencySymbol={currencySymbol}
        toastSuccess={(msg) => showSuccessToast(msg)}
        toastError={(msg) => toastError?.(msg) || alert(msg)}
        onSuccess={() => fetchAllData()}
      />

      {/* AUDIT-SAFE TRANSACTION CORRECTION & VOID MODAL */}
      <TransactionCorrectionModal
        isOpen={Boolean(correctingTx)}
        onClose={() => setCorrectingTx(null)}
        transaction={correctingTx}
        apiFetch={apiFetch}
        formatCurrency={formatNaira}
        currencySymbol={currencySymbol}
        toastSuccess={(msg) => showSuccessToast(msg)}
        toastError={(msg) => toastError?.(msg) || alert(msg)}
        onSuccess={() => fetchAllData()}
      />

      {/* DISCRETIONARY MVP MODAL 6: SMART MARKET RESTOCK BUYING LIST GENERATOR */}
      <Modal
        isOpen={showRestockModal}
        onClose={() => setShowRestockModal(false)}
        title="Smart Lagos Market Restock List"
        subtitle={`Auto-calculated market shopping list for ${lowStockRestockPlan.length} low-stock goods`}
      >
        <div className="space-y-4">
          <div className="liquid-glass-header text-white p-4 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-200 block">
                Estimated Market Capital Needed
              </span>
              <span className="text-xs text-stone-300">
                Across {lowStockRestockPlan.length} provision item(s) at reorder threshold
              </span>
            </div>
            <span className="text-xl font-extrabold font-luxury tabular-nums text-white">
              {formatNaira(totalRestockBudget)}
            </span>
          </div>

          {lowStockRestockPlan.length === 0 ? (
            <p className="text-xs text-center py-6 text-theme-secondary">
              All shelf items are currently above their low-stock warning level!
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y theme-divider liquid-glass-subtle rounded-2xl p-3">
              {lowStockRestockPlan.map((item) => (
                <div
                  key={item.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-extrabold text-theme-primary">{item.name}</div>
                    <div className="text-[11px] text-theme-secondary">
                      Shelf: {Number(item.stock_quantity)} {item.unit} • Market:{' '}
                      {item.supplier_name || 'Oke-Arin / Mushin'}
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="font-extrabold text-theme-brand">
                      Buy {item.recommendedQty} {item.unit}
                    </div>
                    <div className="text-[11px] text-theme-secondary">
                      ≈ {formatNaira(item.estimatedCost)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {lowStockRestockPlan.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const text = [
                      `*MARKET RESTOCK LIST — ${currentUser.business_name}*`,
                      `Date: ${new Date().toLocaleDateString()}`,
                      `---------------------------`,
                      ...lowStockRestockPlan.map(
                        (i) =>
                          `• ${i.name}: Buy ${i.recommendedQty} ${i.unit} (~${formatNaira(
                            i.estimatedCost
                          )}) [${i.supplier_name || 'Market'}]`
                      ),
                      `---------------------------`,
                      `*Estimated Market Budget:* ${formatNaira(totalRestockBudget)}`,
                    ].join('\n');
                    navigator.clipboard?.writeText(text);
                    showSuccessToast('Market buying list copied to clipboard!');
                  }}
                  className="liquid-glass-subtle px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy List
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = [
                      `*MARKET RESTOCK LIST — ${currentUser.business_name}*`,
                      `Date: ${new Date().toLocaleDateString()}`,
                      `---------------------------`,
                      ...lowStockRestockPlan.map(
                        (i) =>
                          `• ${i.name}: Buy ${i.recommendedQty} ${i.unit} (~${formatNaira(
                            i.estimatedCost
                          )})`
                      ),
                      `---------------------------`,
                      `*Estimated Market Budget:* ${formatNaira(totalRestockBudget)}`,
                    ].join('\n');
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text)}`,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }}
                  className="liquid-btn-primary px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Send to WhatsApp
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* DISCRETIONARY MVP MODAL 7: STORE PROFILE & SECURITY SETTINGS */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Store Profile & Account Security"
        subtitle={`${currentUser.email} • ${currentUser.role} • ${currentUser.auth_provider}`}
      >
        <div className="space-y-5">
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-theme-secondary">
              Store Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-primary">
                  Shop / Business Name
                </label>
                <input
                  required
                  value={profileForm.business_name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, business_name: e.target.value })
                  }
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-primary">
                  Owner Full Name
                </label>
                <input
                  required
                  value={profileForm.full_name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, full_name: e.target.value })
                  }
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-primary">
                  WhatsApp / Phone Number
                </label>
                <input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-primary">
                  Market / Area Location
                </label>
                <input
                  value={profileForm.location}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, location: e.target.value })
                  }
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="liquid-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                Save Store Profile
              </button>
            </div>
          </form>

          <form
            onSubmit={handleChangePassword}
            className="space-y-3 border-t pt-4 theme-divider"
          >
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-theme-secondary">
              Update Account Password
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-primary">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, current_password: e.target.value })
                  }
                  placeholder="Current password"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-theme-primary">
                  New Password (Min 6 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, new_password: e.target.value })
                  }
                  placeholder="New password"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out of Device
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="liquid-glass-subtle px-4 py-2 rounded-xl text-xs font-extrabold text-theme-primary cursor-pointer"
              >
                Update Password
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
