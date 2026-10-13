// Shared math helpers used by calculator definitions. Pure functions only —
// these run both in the browser and in Node (tests, build script).

export const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const round = (n, d = 2) => {
  const f = 10 ** d;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** Monthly payment for a fully amortizing loan. */
export function pmt(monthlyRate, months, principal) {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

/**
 * Builds an amortization schedule.
 * @returns {{payment:number,totalInterest:number,totalPaid:number,months:number,yearly:Array,monthly:Array}}
 */
export function amortize(principal, annualRatePct, months, extraMonthly = 0) {
  const r = annualRatePct / 100 / 12;
  const payment = pmt(r, months, principal);
  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  let m = 0;
  const yearly = [];
  const monthly = [];
  let yInt = 0;
  let yPrin = 0;
  while (balance > 0.005 && m < months) {
    m++;
    const interest = balance * r;
    const principalPart = Math.min(payment - interest + extraMonthly, balance);
    balance -= principalPart;
    totalInterest += interest;
    totalPaid += interest + principalPart;
    yInt += interest;
    yPrin += principalPart;
    monthly.push({ month: m, interest, principal: principalPart, balance: Math.max(balance, 0) });
    if (m % 12 === 0 || balance <= 0.005 || m === months) {
      yearly.push({ year: Math.ceil(m / 12), interest: yInt, principal: yPrin, balance: Math.max(balance, 0) });
      yInt = 0;
      yPrin = 0;
    }
  }
  return { payment, totalInterest, totalPaid, months: m, yearly, monthly };
}

export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export const lcm = (a, b) => (a && b ? Math.abs(a * b) / gcd(a, b) : 0);

/** Parses "1, 2 3;4" style lists into numbers, ignoring junk. */
export function parseList(text) {
  return String(text ?? '')
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}

export function parseDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function todayISO() {
  const d = new Date();
  return isoDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

export const DAY_MS = 86400000;

/** Calendar difference between two UTC dates as years/months/days. */
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
  const targetMonth = d.getUTCMonth() + months + years * 12;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(targetMonth);
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, dim));
  return new Date(d.getTime() + days * DAY_MS);
}

/** Format a number with up to `sig` significant digits, no trailing zeros. */
export function sig(n, digits = 10) {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-7) return n.toExponential(digits - 4).replace(/\.?0+e/, 'e');
  return String(parseFloat(n.toPrecision(digits)));
}
