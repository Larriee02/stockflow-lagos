import React from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  CreditCard,
  User,
  Phone,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash (Naira)' },
  { id: 'POS', label: 'POS Terminal' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { id: 'MOBILE_MONEY', label: 'USSD / Wallet' },
];

/**
 * Mobile Cart Review & Checkout Sheet
 *
 * Provides mobile-optimized layout, large touch targets, live available stock
 * indicators, and seamless checkout ergonomics for retail cashiers on phones.
 */
export function MobileCartSheet({
  isOpen,
  onClose,
  cartItems,
  cartTotal,
  cartItemCount,
  updateCartQty,
  removeFromCart,
  clearCart,
  checkoutMethod,
  setCheckoutMethod,
  isPartPayment,
  setIsPartPayment,
  amountPaidNow,
  setAmountPaidNow,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  onProceedCheckout,
  formatNaira,
}) {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Customer Basket"
      subtitle={`${cartItemCount} item(s) selected • Total ${formatNaira(cartTotal)}`}
    >
      <div className="space-y-4">
        {/* Header Action: Clear Cart */}
        <div className="flex items-center justify-between pb-2 border-b theme-divider">
          <span className="text-xs font-bold text-theme-secondary uppercase tracking-wider">
            Items in Basket ({cartItemCount})
          </span>
          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs font-bold text-theme-outflow hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
        </div>

        {/* Cart Item Cards with Live Stock & Large +/- Controls */}
        <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
          {cartItems.map(({ product, quantity, lineTotal }) => {
            const stock = Number(product.stock_quantity);
            const remaining = stock - quantity;
            const isAtMax = quantity >= stock;

            return (
              <div
                key={product.id}
                className="liquid-glass-elevated p-3 rounded-2xl border space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-extrabold text-theme-primary leading-tight">
                      {product.name}
                    </p>
                    <p className="text-[11px] text-theme-secondary mt-0.5">
                      {formatNaira(product.selling_price)} per {product.unit}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(product.id)}
                    className="p-1 rounded-lg text-theme-secondary hover:text-rose-500 cursor-pointer"
                    aria-label={`Remove ${product.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Stock Indicator Line */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-theme-secondary">
                    Available Stock:{' '}
                    <strong className="text-theme-primary">{stock} {product.unit}</strong>
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

                {/* Quantity Controls & Line Total */}
                <div className="flex items-center justify-between pt-1 border-t theme-divider">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCartQty(product.id, -1, stock)}
                      className="liquid-input w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base hover:opacity-80 active:scale-95 cursor-pointer"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-black tabular-nums min-w-[28px] text-center text-theme-primary">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      disabled={isAtMax}
                      onClick={() => updateCartQty(product.id, 1, stock)}
                      className="liquid-input w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base hover:opacity-80 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black font-luxury text-theme-primary tabular-nums">
                      {formatNaira(lineTotal)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grand Total Banner */}
        <div className="liquid-glass-header text-white p-4 rounded-2xl flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-200">
            Total Customer Bill
          </span>
          <span className="text-2xl font-black font-luxury tabular-nums text-white">
            {formatNaira(cartTotal)}
          </span>
        </div>

        {/* Payment Channel Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-theme-primary">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => setCheckoutMethod(m.id)}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold cursor-pointer transition ${
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

        {/* Part-Payment / Credit Section */}
        <div className="liquid-glass-subtle p-3 rounded-2xl space-y-2">
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-theme-primary">
            <input
              type="checkbox"
              checked={isPartPayment}
              onChange={(e) => {
                setIsPartPayment(e.target.checked);
                if (!e.target.checked) setAmountPaidNow('');
              }}
            />
            Customer buying on Credit / Part-Payment
          </label>

          {isPartPayment && (
            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-theme-secondary">
                  Amount paid now (Enter 0 for full credit)
                </label>
                <input
                  type="number"
                  min="0"
                  max={cartTotal}
                  value={amountPaidNow}
                  onChange={(e) => setAmountPaidNow(e.target.value)}
                  placeholder="e.g. 5000"
                  className="liquid-input w-full rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name *"
                  className="liquid-input rounded-xl px-2.5 py-2 text-xs"
                />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number"
                  className="liquid-input rounded-xl px-2.5 py-2 text-xs"
                />
              </div>
              <p className="text-[11px] font-bold text-theme-outflow tabular-nums">
                Balance Owing:{' '}
                {formatNaira(Math.max(0, cartTotal - Number(amountPaidNow || 0)))}
              </p>
            </div>
          )}
        </div>

        {/* Proceed Button */}
        <Button
          type="button"
          variant="primary"
          size="lg"
          rightIcon={ArrowRight}
          onClick={onProceedCheckout}
          className="w-full !py-3.5"
        >
          Review & Checkout ({formatNaira(cartTotal)})
        </Button>
      </div>
    </Modal>
  );
}
