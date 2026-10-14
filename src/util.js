// Shared math helpers used by calculator definitions. Pure functions only —
// these run both in the browser and in Node (tests, build script).

const NUM_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

/**
 * Strictly parses a user-entered number. Accepts thousands separators, spaces,
 * underscores, currency symbols, a trailing % and the Unicode minus sign.
 * Returns NaN for anything that is not a plain decimal number ('' → NaN).
 */
export function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'boolean' || v === null || v === undefined) return NaN;
  const s = String(v)
    .trim()
    .replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6)) // Bangla digits are accepted too
    .replace(/[−–]/g, '-')
    .replace(/[,\s_]/g, '')
    .replace(/^([+-]?)(?:[$€£৳₹¥]|tk|rs)\.?/i, '$1')
    .replace(/%$/, '');
  if (!NUM_RE.test(s)) return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Lenient number: anything unparsable becomes 0 (kept for backwards compatibility). */
export const num = (v) => {
  const n = parseNum(v);
  if (Number.isFinite(n)) return n;
  const f = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(f) ? f : 0;
};

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const fmtLimit = (n) => (Math.abs(n) >= 1e6 ? n.toExponential().replace('e+', 'e') : String(n));

// Inputs beyond ±10^15 are never meaningful here and would overflow to Infinity in products.
const HUGE = 1e15;

function check(n, label, { min = -HUGE, max = HUGE, int = false, gt } = {}) {
  if (gt !== undefined && !(n > gt)) throw new Error(gt === 0 ? `${label} must be greater than zero.` : `${label} must be greater than ${fmtLimit(gt)}.`);
  if (n < min) throw new Error(min === 0 ? `${label} can't be negative.` : min === -HUGE ? `${label} is too small.` : `${label} must be at least ${fmtLimit(min)}.`);
  if (n > max) throw new Error(max === HUGE ? `${label} is too large.` : `${label} must be at most ${fmtLimit(max)}.`);
  if (int && !Number.isInteger(n)) throw new Error(`${label} must be a whole number.`);
  return n;
}

/**
 * Required numeric input. Throws a friendly Error (shown in the UI) when the value
 * is blank, not a number, or outside the allowed range.
 * @param {*} v raw input value
 * @param {string} label human-readable field name used in the message
 * @param {{min?:number,max?:number,int?:boolean,gt?:number}} [opts]
 */
export function req(v, label, opts) {
  if (isBlank(v)) throw new Error(`Enter ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label.toLowerCase()}.`);
  const n = parseNum(v);
  if (Number.isNaN(n)) throw new Error(`${label} must be a number (you entered "${String(v).slice(0, 20)}").`);
  return check(n, label, opts);
}

/** Optional numeric input: blank means `def` (default 0); garbage or out-of-range throws. */
export function opt(v, label, opts = {}) {
  if (isBlank(v)) return 'def' in opts ? opts.def : 0;
  return req(v, label, opts);
}

export const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.sign(n) * Math.round((Math.abs(n) + Number.EPSILON) * f) / f;
};

/** Monthly (periodic) payment for a fully amortizing loan. Numerically stable for tiny rates. */
export function pmt(monthlyRate, months, principal) {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  // 1 − (1+r)^−n computed via expm1/log1p to avoid cancellation when r is tiny.
  const denom = -Math.expm1(-months * Math.log1p(monthlyRate));
  return (principal * monthlyRate) / denom;
}

/** Effective monthly rate for a nominal annual rate compounded `n` times a year ('c' or Infinity = continuous). */
export function monthlyRateFrom(annualRatePct, n = 12) {
  const r = annualRatePct / 100;
  if (n === 'c' || n === Infinity) return Math.expm1(r / 12);
  const k = Number(n) || 12;
  if (k === 12) return r / 12;
  return Math.expm1((k / 12) * Math.log1p(r / k));
}

/**
 * Builds an amortization schedule from a periodic (monthly) rate.
 * `extraMonthly` is applied to principal every month; `lumps` maps month → one-time extra payment.
 */
export function amortizeRate(principal, monthlyRate, months, extraMonthly = 0, { lumps = {} } = {}) {
  const r = monthlyRate;
  const n = Math.max(Math.round(months), 0);
  const payment = pmt(r, n, principal);
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let m = 0;
  const yearly = [];
  const monthly = [];
  let yInt = 0;
  let yPrin = 0;
  while (balance > 0.005 && m < n) {
    m++;
    const interest = balance * r;
    let principalPart = payment - interest + extraMonthly + (lumps[m] || 0);
    // Final instalment: pay off whatever is left (also absorbs floating-point residue).
    if (principalPart > balance || m === n) principalPart = balance;
    balance -= principalPart;
    if (balance < 0.005) balance = 0;
    totalInterest += interest;
    totalPaid += interest + principalPart;
    yInt += interest;
    yPrin += principalPart;
    monthly.push({ month: m, interest, principal: principalPart, payment: interest + principalPart, balance });
    if (m % 12 === 0 || balance === 0 || m === n) {
      yearly.push({ year: Math.ceil(m / 12), interest: yInt, principal: yPrin, balance });
      yInt = 0;
      yPrin = 0;
    }
  }
  return { payment, totalInterest, totalPaid, months: m, yearly, monthly };
}

/**
 * Builds an amortization schedule (nominal annual rate, monthly compounding).
 * @returns {{payment:number,totalInterest:number,totalPaid:number,months:number,yearly:Array,monthly:Array}}
 */
export function amortize(principal, annualRatePct, months, extraMonthly = 0) {
  return amortizeRate(principal, annualRatePct / 100 / 12, months, extraMonthly);
}

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export const lcm = (a, b) => (a && b ? Math.abs(a / gcd(a, b) * b) : 0);

/** Parses "1, 2 3;4" style lists into numbers, ignoring junk. */
export function parseList(text) {
  return String(text ?? '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseNum(s))
    .filter(Number.isFinite);
}

/**
 * Parses an ISO "YYYY-MM-DD" string into a UTC-midnight Date. Returns null for
 * malformed or impossible dates (e.g. 2023-02-29, 2024-13-01). Years 1–9999.
 */
export function parseDate(s) {
  if (!s) return null;
  if (s instanceof Date) return Number.isNaN(s.getTime()) ? null : s;
  const m = String(s).trim().match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return null;
  const dt = new Date(Date.UTC(2000, mo - 1, d));
  dt.setUTCFullYear(y); // avoid Date.UTC's 0–99 → 1900s mapping
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function isoDate(d) {
  const y = d.getUTCFullYear();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(y, 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Today's date in the visitor's local time zone, as an ISO string. */
export function todayISO() {
  const d = new Date();
  return isoDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

export const DAY_MS = 86400000;

export const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Whole days between two UTC-midnight dates (b − a). */
export const daysBetween = (a, b) => Math.round((b - a) / DAY_MS);

/**
 * Calendar difference between two UTC dates as years/months/days.
 * Month arithmetic clamps to the end of shorter months (31 Jan + 1 month = 28/29 Feb).
 */
export function diffYMD(a, b) {
  let sign = 1;
  if (b < a) [a, b, sign] = [b, a, -1];
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
  if (addToDate(a, { months }) > b) months--;
  const days = Math.round((b - addToDate(a, { months })) / DAY_MS);
  return { years: Math.floor(months / 12), months: months % 12, days, sign };
}

export function addToDate(date, { years = 0, months = 0, days = 0 }) {
  const d = new Date(date.getTime());
  const targetMonth = d.getUTCMonth() + Math.trunc(months) + Math.trunc(years) * 12;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(targetMonth);
  const dim = new Date(Date.UTC(2000, d.getUTCMonth() + 1, 0));
  dim.setUTCFullYear(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
  d.setUTCDate(Math.min(day, dim.getUTCDate()));
  return new Date(d.getTime() + Math.round(days) * DAY_MS);
}

/** Valid, displayable date (year 1–9999)? */
export const validDate = (d) => d instanceof Date && Number.isFinite(d.getTime()) && d.getUTCFullYear() >= 1 && d.getUTCFullYear() <= 9999;

/** Format a number with up to `sig` significant digits, no trailing zeros. */
export function sig(n, digits = 10) {
  if (!Number.isFinite(n)) return Number.isNaN(n) ? 'NaN' : n > 0 ? '∞' : '−∞';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-7) {
    const s = n.toExponential(Math.max(digits - 1, 0));
    return s.replace(/\.?0+e/, 'e');
  }
  return String(parseFloat(n.toPrecision(digits)));
}

/** "1 year", "2 years". */
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
