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
import { AccountStatusScreen } from './components/auth/AccountStatusScreen';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AdminPage } from './pages/AdminPage';
import { SettingsPage } from './pages/SettingsPage';
import { RouterProvider, useRouter } from './router/RouterContext';
import { apiFetch, setStoredToken } from './services/api';
import { formatCurrency, getCurrencySymbol } from './utils/currency';

const PAYMENT_CHANNEL_LABELS = {
  CASH: 'Cash',
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
  'POS & Bank Charges',
  'Security & Maintenance',
  'Packaging & Supplies',
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
  const [movements, setMovements] = useState([]);
  const [credits, setCredits] = useState([]);

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

  // Check History Filters
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL');
  const [historyDateRange, setHistoryDateRange] = useState('ALL');
  const [historyCustomDate, setHistoryCustomDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const debouncedHistorySearch = useDebounce(historySearch, 150);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [repayingCredit, setRepayingCredit] = useState(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('CASH');

  // Discretionary MVP Feature Modals
  const [lastReceipt, setLastReceipt] = useState(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
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
        const txParams = new URLSearchParams();
        if (cashFilter !== 'ALL') txParams.set('type', cashFilter);
        if (channelFilter !== 'ALL') txParams.set('paymentMethod', channelFilter);

        const [dashData, prodData, txData, movData, credData] = await Promise.all([
          apiFetch('/api/v1/dashboard', { signal }),
          apiFetch('/api/v1/products', { signal }),
          apiFetch(`/api/v1/transactions?${txParams.toString()}`, { signal }),
          apiFetch('/api/v1/inventory/movements?limit=250', { signal }),
          apiFetch('/api/v1/credits', { signal }),
        ]);

        setDashboard(dashData || {});
        setProducts(Array.isArray(prodData) ? prodData : []);
        setTransactions(Array.isArray(txData) ? txData : []);
        setMovements(Array.isArray(movData) ? movData : []);
        setCredits(Array.isArray(credData) ? credData : []);
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
    [cashFilter, channelFilter, isApprovedStoreAccess, checkAuthSession]
  );

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
      if (historyTypeFilter !== 'ALL' && m.movement_type !== historyTypeFilter) {
        return false;
      }

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
      if (historyDateRange === 'CUSTOM' && historyCustomDate) {
        const itemDateStr = new Date(m.created_at).toISOString().slice(0, 10);
        if (itemDateStr !== historyCustomDate) return false;
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
    historyDateRange,
    historyCustomDate,
    debouncedHistorySearch,
  ]);

  const historySummary = useMemo(() => {
    return filteredMovements.reduce(
      (acc, m) => {
        const val = Number(m.total_value || 0);
        if (m.movement_type === 'SALE') {
          acc.salesCount += 1;
          acc.salesValue += val;
        } else if (m.movement_type === 'RESTOCK') {
          acc.restockCount += 1;
          acc.restockValue += val;
        } else if (m.movement_type === 'DAMAGE') {
          acc.damageValue += val;
        }
        return acc;
      },
      { salesCount: 0, salesValue: 0, restockCount: 0, restockValue: 0, damageValue: 0 }
    );
  }, [filteredMovements]);

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
    setSubmitting(true);
    try {
      await apiFetch('/api/v1/transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...cashForm,
          description: cashForm.description.trim() || cashForm.category,
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

  const handleDeleteCashTx = async (id) => {
    if (!window.confirm('Delete this cashbook entry?')) return;
    try {
      await apiFetch(`/api/v1/transactions/${id}`, {
        method: 'DELETE',
      });
      fetchAllData();
    } catch {
      alert('Could not delete transaction.');
    }
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
                  onClick={() => setShowRestockModal(true)}
                  className="liquid-btn-primary flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Market Restock Order ({lowStockRestockPlan.length})
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
          <div className="liquid-glass rounded-3xl overflow-hidden">
            <div
              style={{ borderColor: 'var(--border-outer)' }}
              className="p-3.5 sm:p-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
            >
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'ALL', label: 'All Money' },
                  { id: 'INFLOW', label: 'Money In' },
                  { id: 'OUTFLOW', label: 'Money Out' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCashFilter(t.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      cashFilter === t.id ? 'liquid-btn-primary' : 'liquid-glass-subtle'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="liquid-input text-xs rounded-2xl px-3.5 py-2 font-bold"
              >
                <option value="ALL">All Payment Methods</option>
                <option value="CASH">Cash (Naira Notes)</option>
                <option value="POS">POS (Moniepoint / OPay)</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="MOBILE_MONEY">Mobile Wallet / USSD</option>
              </select>
            </div>

            {transactions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No cashbook entries recorded yet"
                description="Sales at the counter, market restocks, and shop expenses will automatically appear here."
              />
            ) : (
              <>
                {/* Mobile Card View (< 768px) */}
                <div className="md:hidden divide-y theme-divider">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant={tx.type === 'INFLOW' ? 'success' : 'danger'}
                          icon={tx.type === 'INFLOW' ? ArrowUpRight : ArrowDownRight}
                        >
                          {tx.type === 'INFLOW' ? 'MONEY IN' : 'MONEY OUT'}
                        </Badge>
                        <span
                          className={`text-base font-extrabold font-luxury tabular-nums ${
                            tx.type === 'INFLOW'
                              ? 'text-theme-inflow'
                              : 'text-theme-outflow'
                          }`}
                        >
                          {tx.type === 'INFLOW' ? '+' : '-'}
                          {formatNaira(tx.amount)}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-theme-primary">
                        {tx.category}
                      </div>
                      <div className="text-xs text-theme-secondary">
                        {tx.counterparty_name ? `${tx.counterparty_name}: ` : ''}
                        {tx.description}
                      </div>
                      <div className="flex items-center justify-between pt-1 text-[11px]">
                        <Badge variant="neutral">
                          {PAYMENT_CHANNEL_LABELS[tx.payment_method] || tx.payment_method}
                        </Badge>
                        <span className="text-theme-secondary">
                          {new Date(tx.transaction_date).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
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
                        <th className="py-3.5 px-4">Type</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4">Details</th>
                        <th className="py-3.5 px-4">Payment Channel</th>
                        <th className="py-3.5 px-4 text-right">Amount ({currencySymbol})</th>
                        <th className="py-3.5 px-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y theme-divider">
                      {transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className="hover:bg-white/30 dark:hover:bg-white/5"
                        >
                          <td className="py-3.5 px-4 text-xs tabular-nums text-theme-secondary">
                            {new Date(tx.transaction_date).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={tx.type === 'INFLOW' ? 'success' : 'danger'}
                              icon={tx.type === 'INFLOW' ? ArrowUpRight : ArrowDownRight}
                            >
                              {tx.type === 'INFLOW' ? 'MONEY IN' : 'MONEY OUT'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 font-extrabold font-luxury text-theme-primary">
                            {tx.category}
                          </td>
                          <td className="py-3.5 px-4 text-theme-secondary">
                            {tx.counterparty_name ? (
                              <strong className="text-theme-primary">
                                {tx.counterparty_name}:{' '}
                              </strong>
                            ) : null}
                            {tx.description}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant="neutral">
                              {PAYMENT_CHANNEL_LABELS[tx.payment_method] || tx.payment_method}
                            </Badge>
                          </td>
                          <td
                            className={`py-3.5 px-4 text-right font-extrabold font-luxury tabular-nums ${
                              tx.type === 'INFLOW'
                                ? 'text-theme-inflow'
                                : 'text-theme-outflow'
                            }`}
                          >
                            {tx.type === 'INFLOW' ? '+' : '-'}
                            {formatNaira(tx.amount)}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteCashTx(tx.id)}
                              title="Delete cash entry"
                              className="p-1 text-theme-secondary hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
                    Spoiled / Damaged Goods
                  </p>
                  <p className="text-xl font-extrabold font-luxury tabular-nums mt-1 text-theme-outflow">
                    {formatNaira(historySummary.damageValue)}
                  </p>
                  <p className="text-xs mt-0.5 text-theme-secondary">
                    Total Matching Records: {filteredMovements.length}
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
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'ALL', label: 'All Activity' },
                      { id: 'SALE', label: 'Sales Out' },
                      { id: 'RESTOCK', label: 'Market Restocks' },
                      { id: 'ADJUSTMENT', label: 'Shelf Counts' },
                      { id: 'DAMAGE', label: 'Damaged' },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setHistoryTypeFilter(type.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          historyTypeFilter === type.id
                            ? 'liquid-btn-primary'
                            : 'liquid-glass-subtle'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: 'All Dates' },
                      { id: 'TODAY', label: 'Today' },
                      { id: '7DAYS', label: '7 Days' },
                      { id: '30DAYS', label: '30 Days' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setHistoryDateRange(d.id);
                          setHistoryCustomDate('');
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          historyDateRange === d.id
                            ? 'liquid-btn-primary'
                            : 'liquid-glass-subtle'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}

                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-theme-secondary" />
                      <input
                        type="date"
                        value={historyCustomDate}
                        onChange={(e) => {
                          setHistoryCustomDate(e.target.value);
                          setHistoryDateRange(e.target.value ? 'CUSTOM' : 'ALL');
                        }}
                        className="liquid-input text-xs rounded-xl px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                </div>

                {/* Search within History & Export */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="relative flex-1 max-w-md flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-secondary" />
                      <input
                        type="text"
                        placeholder="Search history by item, customer, supplier, or note..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        className="liquid-input w-full pl-10 pr-4 py-2 text-sm rounded-2xl"
                      />
                    </div>
                    {historySearch && (
                      <button
                        type="button"
                        onClick={() => setHistorySearch('')}
                        className="text-xs font-bold text-theme-outflow flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <XCircle className="w-4 h-4" /> Clear
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
                    className="liquid-glass-subtle flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-2xl hover:opacity-80 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Export History CSV
                  </button>
                </div>
              </div>

              {filteredMovements.length === 0 ? (
                <EmptyState
                  icon={History}
                  title="No history records match your filter"
                  description="Try switching to 'All Activity' or 'All Dates' to see all past sales, restocks, and shelf counts."
                  actionLabel="Reset History Filters"
                  onAction={() => {
                    setHistoryTypeFilter('ALL');
                    setHistoryDateRange('ALL');
                    setHistoryCustomDate('');
                    setHistorySearch('');
                  }}
                />
              ) : (
                <>
                  {/* Mobile History Cards (< 768px) */}
                  <div className="md:hidden divide-y theme-divider">
                    {filteredMovements.map((m) => (
                      <div key={m.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant={
                              m.movement_type === 'SALE'
                                ? 'info'
                                : m.movement_type === 'RESTOCK'
                                ? 'success'
                                : m.movement_type === 'DAMAGE'
                                ? 'danger'
                                : 'neutral'
                            }
                          >
                            {m.movement_type === 'ADJUSTMENT'
                              ? 'SHELF COUNT'
                              : m.movement_type}
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
                    ))}
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
                        {filteredMovements.map((m) => (
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
                              <Badge
                                variant={
                                  m.movement_type === 'SALE'
                                    ? 'info'
                                    : m.movement_type === 'RESTOCK'
                                    ? 'success'
                                    : m.movement_type === 'DAMAGE'
                                    ? 'danger'
                                    : 'neutral'
                                }
                              >
                                {m.movement_type === 'ADJUSTMENT'
                                  ? 'SHELF COUNT'
                                  : m.movement_type}
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
                        ))}
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
          <div className="liquid-glass rounded-3xl overflow-hidden">
            <div
              style={{ borderColor: 'var(--border-outer)' }}
              className="p-4 border-b flex items-center justify-between"
            >
              <div>
                <h3 className="font-extrabold font-luxury text-base text-theme-primary">
                  Customers Owing the Shop (Credit Book)
                </h3>
                <p className="text-xs text-theme-secondary">
                  When a customer pays their balance, tap &ldquo;Collect Money&rdquo; to automatically
                  add it to your Cashbook.
                </p>
              </div>
            </div>

            {credits.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customer is owing you right now"
                description="When someone buys on credit or part-payment at the counter, their name and balance will appear here."
              />
            ) : (
              <>
                {/* Mobile Debtor Cards (< 768px) */}
                <div className="md:hidden divide-y theme-divider">
                  {credits.map((c) => {
                    const isOwing = c.status === 'OWING' && Number(c.balance_due) > 0;
                    const cleanPhone = (c.phone || '')
                      .replace(/\D/g, '')
                      .replace(/^0/, '234');
                    const whatsappMsg = encodeURIComponent(
                      `Hello ${c.customer_name}, friendly reminder from ${
                        currentUser.business_name || 'our provision store'
                      } regarding your balance of ${formatNaira(
                        c.balance_due
                      )} for (${c.items_summary}). Thank you!`
                    );
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
                          <Badge variant={isOwing ? 'danger' : 'success'}>
                            {isOwing ? `OWING ${formatNaira(c.balance_due)}` : 'SETTLED'}
                          </Badge>
                        </div>
                        <p className="text-xs text-theme-secondary">{c.items_summary}</p>
                        {isOwing && (
                          <div className="flex items-center justify-end gap-2 pt-1">
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/${cleanPhone}?text=${whatsappMsg}`}
                                target="_blank"
                                rel="noreferrer"
                                className="liquid-glass-subtle px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1"
                              >
                                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setRepayingCredit(c);
                                setRepayAmount(String(c.balance_due));
                                setRepayMethod('CASH');
                              }}
                              className="liquid-btn-primary px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                            >
                              Collect Money
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Debtor Table (>= 768px) */}
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
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y theme-divider">
                      {credits.map((c) => {
                        const isOwing = c.status === 'OWING' && Number(c.balance_due) > 0;
                        const cleanPhone = (c.phone || '')
                          .replace(/\D/g, '')
                          .replace(/^0/, '234');
                        const whatsappMsg = encodeURIComponent(
                          `Hello ${c.customer_name}, friendly reminder from ${
                            currentUser.business_name || 'our provision store'
                          } regarding your balance of ${formatNaira(
                            c.balance_due
                          )} for (${c.items_summary}). Thank you!`
                        );
                        return (
                          <tr
                            key={c.id}
                            className="hover:bg-white/30 dark:hover:bg-white/5"
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
                              <Badge variant={isOwing ? 'danger' : 'success'}>
                                {isOwing ? 'OWING' : 'SETTLED'}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {isOwing && (
                                <div className="inline-flex items-center gap-2">
                                  {cleanPhone && (
                                    <a
                                      href={`https://wa.me/${cleanPhone}?text=${whatsappMsg}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="liquid-glass-subtle p-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1"
                                      title="Send WhatsApp reminder"
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => {
                                      setRepayingCredit(c);
                                      setRepayAmount(String(c.balance_due));
                                      setRepayMethod('CASH');
                                    }}
                                    className="liquid-btn-primary px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                                  >
                                    Collect Money
                                  </button>
                                </div>
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
        )}

        {/* TAB 6: POS VS CASH RECONCILIATION & PROFIT */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="text-base font-extrabold font-luxury text-theme-primary">
                  Cash in Hand vs. POS & Bank Transfers
                </h3>
                <p className="text-xs text-theme-secondary">
                  Check how much physical Naira should be in your shop drawer vs your Moniepoint /
                  OPay account
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
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3 text-right">Money In</th>
                      <th className="py-2.5 px-3 text-right">Money Out</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-divider">
                    {(dashboard.channels || []).map((ch) => (
                      <tr key={ch.payment_method}>
                        <td className="py-3 px-3 font-bold text-xs text-theme-primary">
                          {PAYMENT_CHANNEL_LABELS[ch.payment_method] || ch.payment_method}
                        </td>
                        <td className="py-3 px-3 text-right font-bold tabular-nums text-theme-inflow">
                          +{formatNaira(ch.inflow)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold tabular-nums text-theme-outflow">
                          -{formatNaira(ch.outflow)}
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold font-luxury tabular-nums text-theme-primary">
                          {formatNaira(ch.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="liquid-glass rounded-3xl p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="text-base font-extrabold font-luxury text-theme-primary">
                  Shelf Goods Value by Category
                </h3>
                <p className="text-xs text-theme-secondary">
                  See which provision categories hold your capital and expected sales value
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
                      <th className="py-2.5 px-3 text-center">Items</th>
                      <th className="py-2.5 px-3 text-right">Market Cost</th>
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
                        <td className="py-3 px-3 text-right tabular-nums text-theme-secondary">
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
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'RESTOCK', label: 'Restock' },
              { id: 'ADJUSTMENT', label: 'Stock Count' },
              { id: 'DAMAGE', label: 'Damaged' },
            ].map((t) => (
              <button
                type="button"
                key={t.id}
                onClick={() => setMovementForm({ ...movementForm, movement_type: t.id })}
                className={`py-2.5 px-2 rounded-xl text-xs font-bold cursor-pointer ${
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
                  : `How many ${selectedProduct?.unit}?`}
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
        title="Record Shop Expense or Cash In"
        subtitle="Keep track of generator fuel, Nepa light, market transport, shop rent, or extra cash"
      >
        <form onSubmit={handleCreateCashTx} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setCashForm({
                  ...cashForm,
                  type: 'OUTFLOW',
                  category: 'Generator Fuel / Petrol',
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
              + MONEY IN (SALES)
            </button>
          </div>

          {cashForm.type === 'OUTFLOW' && (
            <div>
              <label className="block text-xs font-bold mb-1.5 text-theme-primary">
                Quick Lagos Shop Expense Type:
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
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Amount ({currencySymbol})
              </label>
              <input
                type="number"
                required
                placeholder="e.g. 5000"
                value={cashForm.amount}
                onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Payment Channel
              </label>
              <select
                value={cashForm.payment_method}
                onChange={(e) => setCashForm({ ...cashForm, payment_method: e.target.value })}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="CASH">Cash</option>
                <option value="POS">POS Terminal</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="MOBILE_MONEY">Mobile Wallet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-theme-primary">
              Short Note (Optional)
            </label>
            <input
              value={cashForm.description}
              onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
              placeholder="e.g. 5 litres fuel for evening generator"
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

      {/* MODAL 4: COLLECT DEBT FROM CUSTOMER */}
      <Modal
        isOpen={Boolean(repayingCredit)}
        onClose={() => setRepayingCredit(null)}
        title={`Collect Money from ${repayingCredit?.customer_name}`}
        subtitle={`Goods taken: ${repayingCredit?.items_summary} | Balance Owing: ${formatNaira(
          repayingCredit?.balance_due
        )}`}
      >
        <form onSubmit={handleRepayDebt} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Amount Paid ({currencySymbol})
              </label>
              <input
                type="number"
                required
                max={repayingCredit?.balance_due}
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1 text-theme-primary">
                Payment Channel
              </label>
              <select
                value={repayMethod}
                onChange={(e) => setRepayMethod(e.target.value)}
                className="liquid-input w-full rounded-xl px-3 py-2 text-sm"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="POS">POS Terminal</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRepayingCredit(null)}
              className="px-4 py-2 text-xs font-semibold cursor-pointer text-theme-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="liquid-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Confirm & Add to Cashbook'}
            </button>
          </div>
        </form>
      </Modal>

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
