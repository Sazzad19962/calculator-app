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

/* ---------- Typing helpers (pure, unit-tested) ---------- */

/** Removes grouping separators/spaces so the value can be parsed. "1,234.5" → "1234.5" */
export const stripGrouping = (s) => String(s ?? '').replace(/[,\s ]/g, '');

/** Groups the integer part of a plain numeric string. Indian locales use 12,34,567 grouping. */
export function groupDigits(raw, locale = 'en-US') {
  const s = stripGrouping(raw);
  const m = s.match(/^([-−]?)(\d*)(\.\d*)?$/);
  if (!m) return String(raw ?? '');
  const [, sign, int, dec = ''] = m;
  let g = int;
  if (int.length > 3) {
    if (locale === 'en-IN') {
      const last = int.slice(-3);
      g = `${int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last}`;
    } else {
      g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  }
  return sign + g + dec;
}

/**
 * Re-groups a value while typing and returns where the caret should go so it stays
 * after the same digit the user was editing.
 */
export function regroupWithCaret(value, caret, locale) {
  const before = String(value).slice(0, caret);
  const significant = stripGrouping(before).length;
  const next = groupDigits(value, locale);
  if (next === value) return { value, caret };
  let seen = 0;
  let pos = 0;
  while (pos < next.length && seen < significant) {
    if (next[pos] !== ',') seen++;
    pos++;
  }
  return { value: next, caret: pos };
}

/** Compact currency for chart axes: $1.2M, ৳35K, ₹1.5Cr (Indian locales use lakh/crore). */
export function formatCompact(v, currencyCode = getCurrency()) {
  const cur = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const sym = cur.symbol.trim();
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  const t = (n, s) => `${sign}${sym}${parseFloat(n.toFixed(n < 10 ? 1 : 0))}${s}`;
  if (cur.locale === 'en-IN') {
    if (a >= 1e7) return t(a / 1e7, 'Cr');
    if (a >= 1e5) return t(a / 1e5, 'L');
  } else {
    if (a >= 1e9) return t(a / 1e9, 'B');
    if (a >= 1e6) return t(a / 1e6, 'M');
  }
  if (a >= 1e3) return t(a / 1e3, 'K');
  return `${sign}${sym}${Math.round(a)}`;
}

/** RFC 4180 CSV. Numbers are written unformatted (rounded) so spreadsheets can use them. */
export function toCSV(head, rows, types = []) {
  const cell = (v, i) => {
    let s;
    if (typeof v === 'number' && Number.isFinite(v)) {
      s = types[i] === 'int' ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
    } else s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
