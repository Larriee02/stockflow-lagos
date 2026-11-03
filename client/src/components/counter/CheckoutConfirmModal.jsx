import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Package,
  CreditCard,
  User,
  Phone,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

const PAYMENT_LABELS = {
  CASH: 'Cash',
  POS: 'POS Terminal (Moniepoint/OPay)',
  BANK_TRANSFER: 'Bank Transfer',
  MOBILE_MONEY: 'Mobile Wallet / USSD',
};

/**
 * Production Checkout Confirmation Modal
 *
 * Prevents accidental checkouts, double-charging, and verifies available
 * inventory deduction before committing financial and stock ledger records.
 */
export function CheckoutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  cartItems,
  cartTotal,
  paymentMethod,
  isPartPayment,
  amountPaidNow,
  customerName,
  customerPhone,
  formatNaira,
}) {
  if (!isOpen) return null;

  const paid = isPartPayment ? Number(amountPaidNow || 0) : cartTotal;
  const balance = Math.max(0, cartTotal - paid);
  const paymentLabel = PAYMENT_LABELS[paymentMethod] || paymentMethod;
  const isHighValue = cartTotal >= 20000;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Sale & Checkout"
      subtitle="Please review the transaction details and inventory deductions before confirming."
    >
      <div className="space-y-4">
        {/* Warning Banner for High-Value or Credit Transactions */}
        {(isHighValue || balance > 0) && (
          <div
            className={`p-3.5 rounded-2xl flex items-start gap-2.5 text-xs ${
              balance > 0
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300'
            }`}
          >
            {balance > 0 ? (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {balance > 0 ? 'Credit / Debtor Transaction' : 'High Value Transaction'}
              </p>
              <p className="text-[11px] mt-0.5 leading-snug">
                {balance > 0
                  ? `Customer will owe ${formatNaira(balance)}. An entry will be automatically created in your Credit Book under "${customerName}".`
                  : `You are processing a large sale of ${formatNaira(cartTotal)}. Please confirm payment has been received.`}
              </p>
            </div>
          </div>
        )}

        {/* Financial Overview Card */}
        <div className="liquid-glass-elevated p-4 rounded-2xl space-y-2 border">
          <div className="flex justify-between items-center text-xs font-bold text-theme-secondary">
            <span>Total Bill</span>
            <span className="text-base font-extrabold font-luxury text-theme-primary">
              {formatNaira(cartTotal)}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs text-theme-secondary">
            <span>Payment Channel</span>
            <Badge variant="neutral">{paymentLabel}</Badge>
          </div>

          <div className="flex justify-between items-center text-xs text-theme-secondary">
            <span>Amount Received Now</span>
            <span className="font-extrabold text-theme-inflow">
              {formatNaira(paid)}
            </span>
          </div>

          {balance > 0 && (
            <div className="flex justify-between items-center text-xs pt-1 border-t theme-divider font-bold text-rose-500">
              <span>Balance Owing</span>
              <span>{formatNaira(balance)}</span>
            </div>
          )}
        </div>

        {/* Customer Info (if credit or custom name) */}
        {(customerName || customerPhone) && (
          <div className="liquid-glass-subtle p-3 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-theme-secondary" />
              <span className="font-bold text-theme-primary">
                {customerName || 'Walk-in Customer'}
              </span>
            </div>
            {customerPhone && (
              <div className="flex items-center gap-1 text-theme-secondary text-[11px]">
                <Phone className="w-3 h-3" />
                <span>{customerPhone}</span>
              </div>
            )}
          </div>
        )}

        {/* Available Shelf Stock & Deduction Preview */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-theme-secondary">
            Items & Inventory Deduction ({cartItems.length} items)
          </p>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {cartItems.map(({ product, quantity, lineTotal }) => {
              const currentStock = Number(product.stock_quantity);
              const remainingStock = currentStock - quantity;
              const willBeLow = remainingStock <= Number(product.reorder_level);

              return (
                <div
                  key={product.id}
                  className="liquid-glass-subtle p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate text-theme-primary">
                      {product.name}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-theme-secondary mt-0.5">
                      <span>
                        Sold: <strong className="text-theme-primary">{quantity} {product.unit}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Stock: {currentStock} →{' '}
                        <strong
                          className={willBeLow ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}
                        >
                          {remainingStock} left
                        </strong>
                      </span>
                    </div>
                  </div>

                  <span className="font-bold text-theme-primary shrink-0 tabular-nums">
                    {formatNaira(lineTotal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel / Edit Basket
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            onClick={onConfirm}
            className="!px-5"
          >
            Confirm & Issue Receipt
          </Button>
        </div>
      </div>
    </Modal>
  );
}
