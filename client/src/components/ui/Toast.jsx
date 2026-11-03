import React, { createContext, useContext, useState, useCallback, useId } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext({
  toasts: [],
  showToast: () => {},
  removeToast: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES = {
  success: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    border: 'border-emerald-500/30 dark:border-emerald-500/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/20',
    border: 'border-rose-500/30 dark:border-rose-500/40',
    text: 'text-rose-700 dark:text-rose-300',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
  warning: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    border: 'border-amber-500/30 dark:border-amber-500/40',
    text: 'text-amber-700 dark:text-amber-300',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    border: 'border-blue-500/30 dark:border-blue-500/40',
    text: 'text-blue-700 dark:text-blue-300',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, type = 'info', duration = 4000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast = { id, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (msg, duration) => showToast({ message: msg, type: 'success', duration }),
    [showToast]
  );
  const error = useCallback(
    (msg, duration) => showToast({ message: msg, type: 'error', duration }),
    [showToast]
  );
  const warning = useCallback(
    (msg, duration) => showToast({ message: msg, type: 'warning', duration }),
    [showToast]
  );
  const info = useCallback(
    (msg, duration) => showToast({ message: msg, type: 'info', duration }),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, removeToast, success, error, warning, info }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type] || TOAST_ICONS.info;
        const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;

        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border backdrop-blur-xl shadow-xl transition-all duration-300 animate-slide-up ${style.bg} ${style.border}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.iconColor}`} />
            <div className={`text-xs font-bold leading-relaxed flex-1 ${style.text}`}>
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
              className="p-1 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
