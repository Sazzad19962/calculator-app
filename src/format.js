import { sig } from './util.js';

export const CURRENCIES = {
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'en-IE' },
  GBP: { symbol: '£', locale: 'en-GB' },
  BDT: { symbol: '৳', locale: 'en-IN' },
  INR: { symbol: '₹', locale: 'en-IN' },
  PKR: { symbol: 'Rs ', locale: 'en-IN' },
  AED: { symbol: 'AED ', locale: 'en-US' },
  SAR: { symbol: 'SAR ', locale: 'en-US' },
  CAD: { symbol: 'C$', locale: 'en-CA' },
  AUD: { symbol: 'A$', locale: 'en-AU' },
  JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
};

const LS_KEY = 'calc.currency';

export function guessCurrency() {
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
  const region = lang.split('-')[1]?.toUpperCase();
  return { BD: 'BDT', IN: 'INR', GB: 'GBP', PK: 'PKR', AE: 'AED', SA: 'SAR', CA: 'CAD', AU: 'AUD', JP: 'JPY', IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR' }[region] || 'USD';
}

export function getCurrency() {
  try {
    const c = localStorage.getItem(LS_KEY);
    if (c && CURRENCIES[c]) return c;
  } catch { /* storage unavailable */ }
  return (globalThis.SITE && CURRENCIES[globalThis.SITE.currency] && globalThis.SITE.currency) || guessCurrency();
}

export function setCurrency(code) {
  try { localStorage.setItem(LS_KEY, code); } catch { /* ignore */ }
}

const numFmt = (n, locale, min, max) => n.toLocaleString(locale, { minimumFractionDigits: min, maximumFractionDigits: max });

export function format(value, type = 'number', currencyCode = getCurrency()) {
  if (typeof value === 'string' && type !== 'money') return value;
  const cur = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const n = Number(value);
  if (type === 'text' || type === 'mono') return String(value);
  if (!Number.isFinite(n)) return n > 0 ? '∞' : n < 0 ? '−∞' : '—';
  switch (type) {
    case 'money':
    case 'money2': {
      const d = cur.decimals ?? 2;
      const s = numFmt(Math.abs(n), cur.locale, d, d);
      return `${n < 0 ? '−' : ''}${cur.symbol}${s}`;
    }
    case 'int': return numFmt(Math.round(n), cur.locale, 0, 0);
    case 'number1': return numFmt(n, cur.locale, 1, 1);
    case 'number2': return numFmt(n, cur.locale, 2, 2);
    case 'percent': return `${numFmt(n, cur.locale, 0, 2)}%`;
    default: {
      const a = Math.abs(n);
      if (a !== 0 && (a >= 1e15 || a < 1e-6)) return sig(n, 10);
      return numFmt(n, cur.locale, 0, a < 1 ? 8 : 4);
    }
  }
}
