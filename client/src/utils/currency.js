export const CURRENCY_OPTIONS = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira (₦)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi (₵)' },
  { code: 'KES', symbol: 'KSh ', name: 'Kenyan Shilling (KSh)' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand (R)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)' },
];

const CURRENCY_MAP = Object.fromEntries(CURRENCY_OPTIONS.map((c) => [c.code, c]));

export function getCurrencySymbol(code = 'NGN') {
  return CURRENCY_MAP[String(code || 'NGN').toUpperCase()]?.symbol || '₦';
}

export function formatCurrency(val, code = 'NGN') {
  const symbol = getCurrencySymbol(code);
  const num = Number(val || 0);
  if (Number.isNaN(num)) return `${symbol}0`;
  const isWhole = num % 1 === 0;
  const fixed = isWhole ? String(Math.round(num)) : num.toFixed(2);
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${parts.join('.')}`;
}
