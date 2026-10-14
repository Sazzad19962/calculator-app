// Calculators that close the gap with calculator.net's most-searched tools.
// See src/calculators/finance.js for the definition shape.
import { num, pmt, parseDate, todayISO, diffYMD, gcd, DAY_MS } from '../util.js';

/* ----------------------------------------------------------------------------
 * Shared helpers (exported for tests)
 * ------------------------------------------------------------------------- */

const fmtDate = (d) => d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
const fmtDateLong = (d) => d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const blank = (x) => String(x ?? '').trim() === '';
const ceilSafe = (x) => Math.ceil(x - 1e-9);

/** Splits a textarea into non-empty, non-comment lines. */
const lines = (text) => String(text ?? '').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));

/** Parses a clock time: "9", "09:30", "9:30pm", "21:05", "12am". Returns minutes after midnight or null. */
export function parseClock(s) {
  const m = String(s ?? '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  if (min > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    const pm = m[3].startsWith('p');
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  } else if (h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

const clockStr = (mins) => {
  const t = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const hm = (mins) => `${Math.floor(mins / 60)} h ${String(Math.round(mins % 60)).padStart(2, '0')} min`;

/** Net present value of cash flows cf[0..n] (cf[0] at time 0) at periodic rate r. */
export function npv(rate, cfs) {
  return cfs.reduce((s, c, t) => s + c / Math.pow(1 + rate, t), 0);
}

/** Number of sign changes in a cash-flow series (zeros ignored). */
export function signChanges(cfs) {
  const signs = cfs.filter((c) => c !== 0).map(Math.sign);
  return signs.slice(1).filter((s, i) => s !== signs[i]).length;
}

/** Internal rate of return by bracketing + bisection. Returns NaN when no sign change is found. */
export function irr(cfs) {
  if (!cfs.some((c) => c > 0) || !cfs.some((c) => c < 0)) return NaN;
  const f = (r) => npv(r, cfs);
  // Scan for the first sign change from just above -100% upward.
  const grid = [-0.9999];
  for (let r = -0.99; r < 0; r += 0.01) grid.push(r);
  for (let r = 0; r <= 1; r += 0.005) grid.push(r);
  for (let r = 1.05; r <= 100; r *= 1.05) grid.push(r);
  // Prefer the root closest to 0 (the economically meaningful one in normal cases).
  let best = NaN;
  for (let i = 1; i < grid.length; i++) {
    let a = grid[i - 1];
    let b = grid[i];
    let fa = f(a);
    const fb = f(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (fa === 0) return a;
    if (fa * fb > 0) continue;
    for (let k = 0; k < 200; k++) {
      const m = (a + b) / 2;
      const fm = f(m);
      if (fa * fm <= 0) b = m;
      else { a = m; fa = fm; }
      if (b - a < 1e-12) break;
    }
    const root = (a + b) / 2;
    if (Number.isNaN(best) || Math.abs(root) < Math.abs(best)) best = root;
    if (root >= 0) break;
  }
  return best;
}

/** Solves the periodic interest rate for a loan given principal, number of payments and payment. */
export function solveRate(principal, n, payment) {
  if (principal <= 0 || n <= 0 || payment <= 0) return NaN;
  if (payment * n < principal - 1e-9) return NaN;
  if (Math.abs(payment * n - principal) < 1e-9) return 0;
  let lo = 0;
  let hi = 1;
  while (pmt(hi, n, principal) < payment && hi < 1e6) hi *= 2;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (pmt(mid, n, principal) > payment) hi = mid;
    else lo = mid;
    if (hi - lo < 1e-15) break;
  }
  return (lo + hi) / 2;
}

/**
 * Parses a decimal number string exactly (no binary rounding).
 * Accepts "1,234.50", "-0.00450", "6.02e23", "1.2 x 10^3", "3×10^-4".
 * @returns {{sign:1|-1, digits:string, exp:number, sig:number, ambiguous:boolean, zero:boolean}|null}
 *   digits = significant digits (no leading zeros), exp = power of ten of the first digit.
 */
export function parseDecimal(input) {
  let s = String(input ?? '').trim().replace(/[,\s_]/g, '').replace(/−/g, '-');
  s = s.replace(/(?:[x×*]|·)10\^?/i, 'e').replace(/e\+/i, 'e');
  const m = s.match(/^([+-])?(\d*)(?:\.(\d*))?(?:e(-?\d+))?$/i);
  if (!m || (!m[2] && !m[3])) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const intPart = m[2] || '';
  const frac = m[3] ?? '';
  const hasPoint = m[3] !== undefined;
  const E = Number(m[4] || 0);
  const all = intPart + frac;
  const first = all.search(/[1-9]/);
  if (first === -1) {
    // Zero: significant figures are the zeros after the decimal point (e.g. "0.00" → 2 is a common convention).
    return { sign: 1, digits: '0', exp: 0, sig: hasPoint ? Math.max(frac.length, 1) : 1, ambiguous: false, zero: true };
  }
  const exp = intPart.length - first - 1 + E;
  let digits = all.slice(first);
  let ambiguous = false;
  if (!hasPoint) {
    const trimmed = digits.replace(/0+$/, '');
    if (trimmed.length !== digits.length) ambiguous = true;
    digits = trimmed;
  }
  return { sign, digits, exp, sig: digits.length, ambiguous, zero: false };
}

/** Rounds a significant-digit string to n digits (half up). Returns { digits, exp }. */
export function roundDigits(digits, exp, n) {
  if (digits.length <= n) return { digits: digits.padEnd(n, '0'), exp };
  const head = digits.slice(0, n).split('').map(Number);
  if (Number(digits[n]) >= 5) {
    let i = n - 1;
    while (i >= 0) {
      if (head[i] === 9) { head[i] = 0; i--; } else { head[i]++; break; }
    }
    if (i < 0) { head.unshift(1); head.pop(); exp++; }
  }
  return { digits: head.join(''), exp };
}

/** Writes significant digits + exponent as a plain decimal string. */
export function digitsToDecimal(sign, digits, exp) {
  let out;
  if (exp >= 0) {
    const ip = digits.slice(0, exp + 1).padEnd(exp + 1, '0');
    const fp = digits.slice(exp + 1);
    out = fp ? `${ip}.${fp}` : ip;
  } else {
    out = `0.${'0'.repeat(-exp - 1)}${digits}`;
  }
  return (sign < 0 ? '-' : '') + out;
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const mant = (sign, digits) => (sign < 0 ? '-' : '') + digits[0] + (digits.length > 1 ? `.${digits.slice(1)}` : '');

/** Number of decimal places in a numeric string (for exact ratio simplification). */
const decimals = (s) => {
  const p = parseDecimal(s);
  if (!p || p.zero) return 0;
  return Math.max(0, p.digits.length - 1 - p.exp);
};

/** Next occurrence (on or after `from`) of a named yearly event. */
export function nextEvent(key, from) {
  const y0 = from.getUTCFullYear();
  const make = (y) => {
    switch (key) {
      case 'newyear': return new Date(Date.UTC(y, 0, 1));
      case 'valentine': return new Date(Date.UTC(y, 1, 14));
      case 'halloween': return new Date(Date.UTC(y, 9, 31));
      case 'christmas': return new Date(Date.UTC(y, 11, 25));
      case 'thanksgiving': { // US: fourth Thursday of November
        const first = new Date(Date.UTC(y, 10, 1)).getUTCDay();
        return new Date(Date.UTC(y, 10, 1 + ((4 - first + 7) % 7) + 21));
      }
      case 'easter': { // Western (Gregorian) Easter — anonymous Gregorian algorithm (Meeus/Jones/Butcher)
        const a = y % 19; const b = Math.floor(y / 100); const c = y % 100;
        const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(Date.UTC(y, month - 1, day));
      }
      default: return null;
    }
  };
  const d = make(y0);
  return d && d >= from ? d : make(y0 + 1);
}

/** ISO-8601 week number and week-year for a UTC date. */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this week decides the year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d - yearStart) / DAY_MS + 1) / 7), year: d.getUTCFullYear() };
}

function businessDays(a, b) {
  let count = 0;
  for (let t = a.getTime(); t < b.getTime(); t += DAY_MS) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

/** Depreciation schedule. method: 'sl' | 'ddb' | 'db' | 'syd'. */
export function depreciationSchedule(cost, salvage, life, method, factor = 2) {
  const base = Math.max(cost - salvage, 0);
  const rows = [];
  let book = cost;
  const n = Math.max(Math.round(life), 1);
  const sydSum = (n * (n + 1)) / 2;
  for (let y = 1; y <= n; y++) {
    let dep;
    if (method === 'sl') dep = base / n;
    else if (method === 'syd') dep = (base * (n - y + 1)) / sydSum;
    else {
      const rate = (method === 'ddb' ? 2 : factor) / n;
      const declining = book * rate;
      const straight = (book - salvage) / (n - y + 1); // switch to straight-line when it is larger
      dep = Math.max(declining, straight);
    }
    dep = Math.min(dep, Math.max(book - salvage, 0));
    const start = book;
    book -= dep;
    rows.push({ year: y, start, dep, accumulated: cost - book, book });
  }
  return rows;
}

/* ----------------------------------------------------------------------------
 * Shared input fragments
 * ------------------------------------------------------------------------- */

const freqOptions = [['12', 'Monthly'], ['4', 'Quarterly'], ['1', 'Yearly']];
const compOptions = [['1', 'Annually'], ['2', 'Semi-annually'], ['4', 'Quarterly'], ['12', 'Monthly'], ['365', 'Daily']];
const sexInput = { id: 'sex', label: 'Sex', type: 'select', value: 'male', options: [['male', 'Male'], ['female', 'Female']] };
const unitsInput = { id: 'units', label: 'Units', type: 'select', value: 'metric', rerender: true, options: [['metric', 'Metric (kg, cm)'], ['imperial', 'US (lb, ft/in)']] };
const isMetric = (v) => v.units !== 'imperial';
const isImperial = (v) => v.units === 'imperial';
const lenU = (v) => (v.units === 'metric' ? 'm' : 'ft');
const smallU = (v) => (v.units === 'metric' ? 'cm' : 'in');

/* ----------------------------------------------------------------------------
 * Definitions
 * ------------------------------------------------------------------------- */

export default [
  /* ============================== FINANCE ============================== */
  {
    id: 'investment',
    name: 'Investment Calculator',
    cat: 'finance',
    icon: '📈',
    desc: 'Project how an initial investment plus regular contributions grows with compound returns, with a year-by-year chart.',
    keywords: 'investment growth future value contributions compound return stock portfolio',
    inputs: [
      { id: 'initial', label: 'Starting amount', type: 'number', value: 10000, money: true },
      { id: 'contrib', label: 'Additional contribution', type: 'number', value: 500, money: true },
      { id: 'freq', label: 'Contribution frequency', type: 'select', value: '12', options: freqOptions },
      { id: 'timing', label: 'Contribute at the', type: 'select', value: 'end', options: [['end', 'End of each period'], ['begin', 'Beginning of each period']] },
      { id: 'rate', label: 'Expected annual return', type: 'number', value: 7, suffix: '%', step: 0.1, help: 'Long-run nominal returns of a diversified stock index have historically been around 7–10% a year, but are never guaranteed.' },
      { id: 'comp', label: 'Compounding', type: 'select', value: '1', options: compOptions },
      { id: 'years', label: 'Years', type: 'number', value: 20, suffix: 'yrs' },
    ],
    compute(v) {
      const years = Math.min(Math.max(Math.round(num(v.years)), 1), 100);
      const p = num(v.freq) || 12;
      const n = num(v.comp) || 1;
      const r = num(v.rate) / 100;
      const i = Math.pow(1 + r / n, n / p) - 1; // effective rate per contribution period
      const c = num(v.contrib);
      const begin = v.timing === 'begin';
      let bal = num(v.initial);
      let contributed = bal;
      const rows = [];
      const bars = [];
      for (let y = 1; y <= years; y++) {
        for (let k = 0; k < p; k++) {
          if (begin) bal = (bal + c) * (1 + i);
          else bal = bal * (1 + i) + c;
          contributed += c;
        }
        rows.push([y, contributed, bal - contributed, bal]);
        bars.push({ label: String(y), value: bal, parts: [contributed, Math.max(bal - contributed, 0)] });
      }
      return {
        primary: { label: `Value after ${years} years`, value: bal, type: 'money' },
        items: [
          { label: 'Total contributions', value: contributed, type: 'money' },
          { label: 'Total growth', value: bal - contributed, type: 'money' },
          { label: 'Effective annual return', value: (Math.pow(1 + r / n, n) - 1) * 100, type: 'percent' },
          { label: 'Growth share of final value', value: bal > 0 ? ((bal - contributed) / bal) * 100 : 0, type: 'percent' },
        ],
        chart: { type: 'stacked', legend: ['Contributions', 'Growth'], data: bars },
        table: { title: 'Growth by year', head: ['Year', 'Contributions', 'Growth', 'Value'], types: ['int', 'money', 'money', 'money'], rows },
      };
    },
    about: `<p>The calculator converts the annual return into an effective rate per contribution period,
      <code>i = (1 + r/n)<sup>n/p</sup> − 1</code> (r = annual rate, n = compounding periods per year, p = contributions per year),
      then grows the balance period by period. That is the same as the closed-form future value
      <code>FV = P(1+i)<sup>N</sup> + C · [(1+i)<sup>N</sup> − 1] / i</code>, multiplied by (1 + i) for contributions made at the beginning of each period.</p>
      <p><b>Example:</b> $10,000 at 7% compounded annually for 10 years with no contributions grows to 10,000 × 1.07<sup>10</sup> = <b>$19,671.51</b>.
      Investing $100 at the end of every month at 12% compounded monthly for 10 years gives 100 × (1.01<sup>120</sup> − 1)/0.01 = <b>$23,003.87</b>.</p>
      <p>Results are before taxes, fees and inflation. Use the <a href="../inflation/">inflation calculator</a> to see the value in today's money.</p>`,
  },
  {
    id: 'sip',
    name: 'SIP Calculator',
    cat: 'finance',
    icon: '🪙',
    desc: 'Estimate the maturity value of a monthly Systematic Investment Plan (SIP), with an optional yearly step-up.',
    keywords: 'sip mutual fund systematic investment plan monthly investment step up lumpsum returns india',
    inputs: [
      { id: 'monthly', label: 'Monthly investment', type: 'number', value: 5000, money: true },
      { id: 'rate', label: 'Expected annual return', type: 'number', value: 12, suffix: '%', step: 0.1 },
      { id: 'years', label: 'Time period', type: 'number', value: 10, suffix: 'yrs' },
      { id: 'step', label: 'Annual step-up', type: 'number', value: 0, suffix: '%', help: 'Increase your monthly SIP by this percentage every year (0 for a flat SIP).' },
    ],
    compute(v) {
      const years = Math.min(Math.max(Math.round(num(v.years)), 1), 60);
      const i = num(v.rate) / 100 / 12;
      const step = num(v.step) / 100;
      let amt = num(v.monthly);
      let bal = 0;
      let invested = 0;
      const rows = [];
      const bars = [];
      for (let y = 1; y <= years; y++) {
        for (let m = 0; m < 12; m++) {
          bal = (bal + amt) * (1 + i); // SIP instalments are invested at the start of each month
          invested += amt;
        }
        rows.push([y, amt, invested, bal - invested, bal]);
        bars.push({ label: String(y), value: bal, parts: [invested, Math.max(bal - invested, 0)] });
        amt *= 1 + step;
      }
      return {
        primary: { label: 'Estimated maturity value', value: bal, type: 'money' },
        items: [
          { label: 'Total invested', value: invested, type: 'money' },
          { label: 'Estimated returns', value: bal - invested, type: 'money' },
          { label: 'Wealth gained', value: invested > 0 ? bal / invested : 0, type: 'number2', unit: '× invested' },
        ],
        chart: { type: 'stacked', legend: ['Invested', 'Returns'], data: bars },
        table: { title: 'Year-by-year', head: ['Year', 'Monthly SIP', 'Invested', 'Returns', 'Value'], types: ['int', 'money', 'money', 'money', 'money'], rows },
      };
    },
    about: `<p>A flat SIP is an annuity-due: each instalment is invested at the start of the month and compounds monthly at
      <code>i = r / 12</code>. The maturity value is <code>M = P × [((1 + i)<sup>n</sup> − 1) / i] × (1 + i)</code>, where P is the monthly amount and n the number of months.
      With a step-up, the monthly amount rises by the chosen percentage after every 12 instalments.</p>
      <p><b>Example:</b> ₹5,000 a month for 10 years at 12%: i = 0.01, n = 120, so M = 5,000 × (1.01<sup>120</sup> − 1)/0.01 × 1.01 ≈ <b>₹11,61,695</b> on ₹6,00,000 invested.</p>
      <p>Mutual-fund returns are market-linked and not guaranteed; past performance does not indicate future returns. Figures are before exit loads and capital-gains tax.</p>`,
  },
  {
    id: 'cagr',
    name: 'CAGR Calculator',
    cat: 'finance',
    icon: '📊',
    desc: 'Compound annual growth rate between a starting and ending value — compare investments, revenue or any growth.',
    keywords: 'cagr compound annual growth rate average annual return annualized',
    inputs: [
      { id: 'start', label: 'Beginning value', type: 'number', value: 10000, money: true },
      { id: 'end', label: 'Ending value', type: 'number', value: 19000, money: true },
      { id: 'years', label: 'Number of years', type: 'number', value: 5, suffix: 'yrs', help: 'Fractions are allowed, e.g. 2.5 for two and a half years.' },
    ],
    compute(v) {
      const a = num(v.start);
      const b = num(v.end);
      const t = num(v.years);
      if (a <= 0 || b < 0) throw new Error('Beginning value must be positive and ending value non-negative.');
      if (t <= 0) throw new Error('Number of years must be greater than zero.');
      const cagr = Math.pow(b / a, 1 / t) - 1;
      const rows = [];
      for (let y = 0; y <= Math.min(Math.floor(t), 50); y++) rows.push([y, a * Math.pow(1 + cagr, y)]);
      return {
        primary: { label: 'CAGR', value: cagr * 100, type: 'percent' },
        items: [
          { label: 'Total growth', value: ((b - a) / a) * 100, type: 'percent' },
          { label: 'Absolute change', value: b - a, type: 'money' },
          { label: 'Growth multiple', value: b / a, type: 'number2', unit: '×' },
          { label: 'Simple average per year', value: ((b - a) / a / t) * 100, type: 'percent' },
        ],
        table: { title: 'Value path at constant CAGR', head: ['Year', 'Value'], types: ['int', 'money'], rows },
      };
    },
    about: `<p><code>CAGR = (Ending value / Beginning value)<sup>1/years</sup> − 1</code>. It is the constant yearly rate that would turn the
      beginning value into the ending value, smoothing out the ups and downs in between.</p>
      <p><b>Example:</b> $1,000 growing to $2,000 in 5 years: (2,000/1,000)<sup>1/5</sup> − 1 = <b>14.87%</b> a year — lower than the 20% "simple average" (100% ÷ 5), because growth compounds.</p>
      <p>CAGR ignores cash added or withdrawn along the way; for irregular cash flows use the <a href="../npv-irr/">NPV &amp; IRR calculator</a>.</p>`,
  },
  {
    id: 'depreciation',
    name: 'Depreciation Calculator',
    cat: 'finance',
    icon: '📉',
    desc: 'Straight-line, declining balance, double-declining (200%) and sum-of-years\'-digits depreciation schedules.',
    keywords: 'depreciation straight line declining balance double declining ddb sum of years digits asset book value',
    inputs: [
      { id: 'cost', label: 'Asset cost', type: 'number', value: 10000, money: true },
      { id: 'salvage', label: 'Salvage (residual) value', type: 'number', value: 1000, money: true },
      { id: 'life', label: 'Useful life', type: 'number', value: 5, suffix: 'yrs' },
      { id: 'method', label: 'Method', type: 'select', value: 'ddb', rerender: true, options: [['sl', 'Straight-line'], ['ddb', 'Double-declining balance (200%)'], ['db', 'Declining balance (custom %)'], ['syd', "Sum-of-years' digits"]] },
      { id: 'factor', label: 'Declining-balance factor', type: 'number', value: 1.5, suffix: '× SL rate', help: '1.5 = 150% declining balance; 2 = double-declining.', showIf: (v) => v.method === 'db' },
    ],
    compute(v) {
      const cost = num(v.cost);
      const salvage = num(v.salvage);
      const life = Math.round(num(v.life));
      if (cost <= 0) throw new Error('Enter a positive asset cost.');
      if (salvage < 0 || salvage >= cost) throw new Error('Salvage value must be between 0 and the asset cost.');
      if (life < 1 || life > 100) throw new Error('Useful life must be 1–100 years.');
      const factor = num(v.factor) || 1.5;
      const rows = depreciationSchedule(cost, salvage, life, v.method, factor);
      return {
        primary: { label: 'First-year depreciation', value: rows[0].dep, type: 'money' },
        items: [
          { label: 'Total depreciation', value: cost - salvage, type: 'money' },
          { label: 'Depreciation rate (year 1)', value: (rows[0].dep / cost) * 100, type: 'percent' },
          { label: 'Book value at end of life', value: rows.at(-1).book, type: 'money' },
        ],
        table: { title: 'Depreciation schedule', head: ['Year', 'Opening book value', 'Depreciation', 'Accumulated', 'Closing book value'], types: ['int', 'money', 'money', 'money', 'money'], rows: rows.map((r) => [r.year, r.start, r.dep, r.accumulated, r.book]) },
      };
    },
    about: `<ul>
      <li><b>Straight-line:</b> <code>(Cost − Salvage) / Life</code> every year.</li>
      <li><b>Declining balance:</b> <code>Opening book value × (Factor / Life)</code>, switching to straight-line on the remaining amount when that is larger
        (as Excel's VDB function does), and never depreciating below salvage value.</li>
      <li><b>Sum-of-years' digits:</b> <code>(Cost − Salvage) × Remaining life / (n(n+1)/2)</code>.</li></ul>
      <p><b>Example:</b> a $10,000 asset, $1,000 salvage, 5-year life. Straight-line = $1,800/yr. Double-declining: 40% rate → $4,000, $2,400, $1,440, $864, $296 (total $9,000).
      Sum-of-years' digits (sum = 15): $3,000, $2,400, $1,800, $1,200, $600.</p>
      <p>This is book (accounting) depreciation with a full year in year 1. Tax depreciation follows its own rules — e.g. MACRS in the US (IRS Publication 946) with half-year conventions — so check with your tax authority.</p>`,
  },
  {
    id: 'rent-vs-buy',
    name: 'Rent vs Buy Calculator',
    cat: 'finance',
    icon: '🏘️',
    desc: 'Compare the long-run cost of buying a home against renting and investing the difference.',
    keywords: 'rent or buy house renting vs buying home should i buy',
    inputs: [
      { id: 'price', label: 'Home price', type: 'number', value: 400000, money: true },
      { id: 'down', label: 'Down payment', type: 'number', value: 20, suffix: '%' },
      { id: 'rate', label: 'Mortgage rate', type: 'number', value: 6.5, suffix: '%', step: 0.01 },
      { id: 'term', label: 'Loan term', type: 'select', value: '30', options: [['30', '30 years'], ['20', '20 years'], ['15', '15 years']] },
      { id: 'closing', label: 'Closing costs (% of price)', type: 'number', value: 3, suffix: '%' },
      { id: 'tax', label: 'Property tax', type: 'number', value: 1.1, suffix: '%/yr', step: 0.01 },
      { id: 'maint', label: 'Maintenance', type: 'number', value: 1, suffix: '%/yr', help: 'A common rule of thumb is 1% of the home value per year.' },
      { id: 'ins', label: 'Home insurance (per year)', type: 'number', value: 1500, money: true },
      { id: 'hoa', label: 'HOA / service charge (per month)', type: 'number', value: 0, money: true },
      { id: 'appr', label: 'Home price growth', type: 'number', value: 3, suffix: '%/yr' },
      { id: 'sell', label: 'Selling costs (% of price)', type: 'number', value: 6, suffix: '%' },
      { id: 'rent', label: 'Monthly rent', type: 'number', value: 2200, money: true },
      { id: 'rentInc', label: 'Rent increase', type: 'number', value: 3, suffix: '%/yr' },
      { id: 'rentIns', label: "Renter's insurance (per month)", type: 'number', value: 15, money: true },
      { id: 'inv', label: 'Investment return on savings', type: 'number', value: 5, suffix: '%/yr', help: 'What the renter earns on the down payment and any monthly savings (and the buyer on theirs).' },
      { id: 'years', label: 'Years you plan to stay', type: 'number', value: 10, suffix: 'yrs' },
    ],
    compute(v) {
      const price = num(v.price);
      if (price <= 0) throw new Error('Enter a home price.');
      const years = Math.min(Math.max(Math.round(num(v.years)), 1), 40);
      const down = (price * Math.min(Math.max(num(v.down), 0), 100)) / 100;
      const loan = price - down;
      const termM = num(v.term) * 12;
      const mr = num(v.rate) / 100 / 12;
      const payment = pmt(mr, termM, loan);
      const appr = Math.pow(1 + num(v.appr) / 100, 1 / 12) - 1;
      const ir = Math.pow(1 + num(v.inv) / 100, 1 / 12) - 1;
      const upfront = down + (price * num(v.closing)) / 100;
      let bal = loan;
      let value = price;
      let rent = num(v.rent);
      let buyPort = 0;
      let rentPort = upfront;
      let buyPaid = upfront;
      let rentPaid = 0;
      let breakEven = null;
      const rows = [];
      for (let m = 1; m <= years * 12; m++) {
        // Housing costs this month
        let mort = 0;
        if (m <= termM && bal > 0.005) {
          const interest = bal * mr;
          mort = Math.min(payment, bal + interest);
          bal = bal + interest - mort;
        }
        const own = mort + (value * num(v.tax)) / 100 / 12 + (value * num(v.maint)) / 100 / 12 + num(v.ins) / 12 + num(v.hoa);
        const renting = rent + num(v.rentIns);
        buyPaid += own;
        rentPaid += renting;
        buyPort *= 1 + ir;
        rentPort *= 1 + ir;
        if (own > renting) rentPort += own - renting;
        else buyPort += renting - own;
        value *= 1 + appr;
        if (m % 12 === 0) {
          const equity = value * (1 - num(v.sell) / 100) - Math.max(bal, 0);
          const buyNW = equity + buyPort;
          const rentNW = rentPort;
          if (breakEven === null && buyNW >= rentNW) breakEven = m / 12;
          rows.push([m / 12, value, equity, buyNW, rentNW, buyNW - rentNW]);
          rent *= 1 + num(v.rentInc) / 100;
        }
      }
      const last = rows.at(-1);
      const diff = last[5];
      return {
        primary: { label: diff >= 0 ? `Buying comes out ahead after ${plural(years, 'year')} by` : `Renting comes out ahead after ${plural(years, 'year')} by`, value: Math.abs(diff), type: 'money' },
        items: [
          { label: 'Monthly mortgage payment (P&I)', value: payment, type: 'money' },
          { label: 'Net worth if you buy', value: last[3], type: 'money' },
          { label: 'Net worth if you rent', value: last[4], type: 'money' },
          { label: 'Home equity after selling costs', value: last[2], type: 'money' },
          { label: 'Total paid buying (incl. upfront)', value: buyPaid, type: 'money' },
          { label: 'Total rent + insurance paid', value: rentPaid, type: 'money' },
          { label: 'Break-even', value: breakEven ? `after ${plural(breakEven, 'year')}` : `not within ${years} years`, type: 'text' },
        ],
        table: { title: 'Year-by-year comparison', head: ['Year', 'Home value', 'Equity (net of sale)', 'Buy net worth', 'Rent net worth', 'Buy − Rent'], types: ['int', 'money', 'money', 'money', 'money', 'money'], rows },
      };
    },
    about: `<p>The comparison simulates both paths month by month and compares <b>net worth</b> at the end:</p>
      <ul><li><b>Buyer:</b> pays the down payment and closing costs, then mortgage principal &amp; interest, property tax, maintenance, insurance and HOA.
        At the end the home is sold: equity = home value × (1 − selling costs) − remaining loan balance.</li>
      <li><b>Renter:</b> invests the money the buyer spent up front, pays rent (rising each year) and renter's insurance.</li>
      <li>Each month, whoever has the lower housing cost invests the difference at the investment return, so both paths spend the same amount.</li></ul>
      <p><b>Example:</b> pay $100,000 cash for a home with no other costs vs $1,000/month rent, 0% growth and returns, 1 year: the buyer keeps the $12,000 that the renter spends on rent, so buying wins by $12,000.</p>
      <p>Not included: income-tax effects (e.g. the mortgage-interest deduction or capital-gains exclusions), PMI, and moving costs. Small changes in price growth and investment return can flip the answer — try a few scenarios.</p>`,
  },
  {
    id: 'debt-to-income',
    name: 'Debt-to-Income (DTI) Ratio Calculator',
    cat: 'finance',
    icon: '⚖️',
    desc: 'Front-end and back-end debt-to-income ratios — the numbers lenders use to approve mortgages and loans.',
    keywords: 'dti debt to income ratio mortgage qualify lender front end back end',
    inputs: [
      { id: 'income', label: 'Gross monthly income (before tax)', type: 'number', value: 7000, money: true, help: 'Salary plus other regular income, before taxes and deductions.' },
      { id: 'housing', label: 'Rent or mortgage payment (incl. tax, insurance, HOA)', type: 'number', value: 1800, money: true },
      { id: 'car', label: 'Car loan payments', type: 'number', value: 350, money: true },
      { id: 'student', label: 'Student loan payments', type: 'number', value: 200, money: true },
      { id: 'cards', label: 'Credit card minimum payments', type: 'number', value: 100, money: true },
      { id: 'other', label: 'Other debt payments', type: 'number', value: 0, money: true, help: 'Personal loans, child support/alimony, other monthly obligations. Exclude utilities, food and insurance premiums.' },
    ],
    compute(v) {
      const inc = num(v.income);
      if (inc <= 0) throw new Error('Enter your gross monthly income.');
      const housing = num(v.housing);
      const debts = housing + num(v.car) + num(v.student) + num(v.cards) + num(v.other);
      const back = (debts / inc) * 100;
      const front = (housing / inc) * 100;
      const badge = back <= 36 ? 'Good — within most lenders\' preferred range' : back <= 43 ? 'Manageable — may limit loan options' : back <= 50 ? 'High — hard to qualify for many loans' : 'Very high — focus on paying down debt';
      return {
        primary: { label: 'Debt-to-income ratio (back-end)', value: back, type: 'percent', badge },
        gauge: { value: back, min: 0, max: 60, bands: [[36, '≤36%'], [43, '36–43%'], [50, '43–50%'], [60, '50%+']] },
        items: [
          { label: 'Front-end (housing) ratio', value: front, type: 'percent' },
          { label: 'Total monthly debt payments', value: debts, type: 'money' },
          { label: 'Max total debt at 36%', value: inc * 0.36, type: 'money' },
          { label: 'Max total debt at 43%', value: inc * 0.43, type: 'money' },
        ],
      };
    },
    about: `<p><code>DTI = Total monthly debt payments ÷ Gross monthly income × 100</code>. The <b>front-end</b> ratio uses housing costs only;
      the <b>back-end</b> ratio includes all recurring debt payments.</p>
      <p><b>Example:</b> $1,800 housing + $650 other debts on $7,000 gross income → back-end DTI = 2,450 / 7,000 = <b>35%</b>, front-end = 25.7%.</p>
      <p>Benchmarks (US): many lenders prefer a back-end DTI of 36% or less with housing ≤ 28% (the "28/36 rule"); Fannie Mae's Selling Guide (B3-6-02)
      caps manually underwritten loans at 36%, or 45% with compensating factors, and up to 50% through Desktop Underwriter. 43% was the general
      Qualified Mortgage limit before the CFPB's 2021 rule change. See the
      <a href="https://www.consumerfinance.gov/ask-cfpb/what-is-a-debt-to-income-ratio-en-1791/" rel="nofollow noopener">CFPB's explanation</a>. Guidelines checked for 2026; lenders and countries differ.</p>`,
  },
  {
    id: 'net-worth',
    name: 'Net Worth Calculator',
    cat: 'finance',
    icon: '🧾',
    desc: 'Add up what you own and what you owe to find your net worth and debt-to-asset ratio.',
    keywords: 'net worth assets liabilities wealth balance sheet personal',
    inputs: [
      { id: 'cash', label: 'Cash & bank accounts', type: 'number', value: 15000, money: true },
      { id: 'invest', label: 'Investments (stocks, funds, bonds)', type: 'number', value: 40000, money: true },
      { id: 'retire', label: 'Retirement accounts / provident fund', type: 'number', value: 60000, money: true },
      { id: 'home', label: 'Home & other real estate (market value)', type: 'number', value: 350000, money: true },
      { id: 'vehicles', label: 'Vehicles', type: 'number', value: 20000, money: true },
      { id: 'otherA', label: 'Other assets (gold, business, valuables)', type: 'number', value: 5000, money: true },
      { id: 'mortgage', label: 'Mortgage balance', type: 'number', value: 250000, money: true },
      { id: 'auto', label: 'Car loans', type: 'number', value: 12000, money: true },
      { id: 'studentL', label: 'Student loans', type: 'number', value: 0, money: true },
      { id: 'cc', label: 'Credit card debt', type: 'number', value: 3000, money: true },
      { id: 'otherL', label: 'Other debts', type: 'number', value: 0, money: true },
    ],
    compute(v) {
      const assets = [['Cash', v.cash], ['Investments', v.invest], ['Retirement', v.retire], ['Real estate', v.home], ['Vehicles', v.vehicles], ['Other assets', v.otherA]].map(([l, x]) => ({ label: l, value: num(x) }));
      const liab = [['Mortgage', v.mortgage], ['Car loans', v.auto], ['Student loans', v.studentL], ['Credit cards', v.cc], ['Other debts', v.otherL]].map(([l, x]) => ({ label: l, value: num(x) }));
      const A = assets.reduce((s, x) => s + x.value, 0);
      const L = liab.reduce((s, x) => s + x.value, 0);
      const liquid = num(v.cash) + num(v.invest);
      return {
        primary: { label: 'Net worth', value: A - L, type: 'money' },
        items: [
          { label: 'Total assets', value: A, type: 'money' },
          { label: 'Total liabilities', value: L, type: 'money' },
          { label: 'Debt-to-asset ratio', value: A > 0 ? (L / A) * 100 : 0, type: 'percent' },
          { label: 'Liquid assets (cash + investments)', value: liquid, type: 'money' },
          { label: 'Net worth excluding home equity', value: A - L - (num(v.home) - num(v.mortgage)), type: 'money' },
        ],
        chart: { type: 'donut', data: assets },
        table: { title: 'Balance sheet', head: ['Item', 'Type', 'Amount'], types: ['text', 'text', 'money'], rows: [...assets.map((a) => [a.label, 'Asset', a.value]), ...liab.map((l) => [l.label, 'Liability', -l.value])] },
      };
    },
    about: `<p><code>Net worth = Total assets − Total liabilities</code>. Value assets at what you could sell them for today, and liabilities at the outstanding balance (not the original loan).</p>
      <p><b>Example:</b> $490,000 of assets and $265,000 of debts gives a net worth of <b>$225,000</b> and a debt-to-asset ratio of 54%.</p>
      <p>Track it once or twice a year: a rising net worth matters more than the absolute number. The chart shows how your assets are distributed.</p>`,
  },
  {
    id: 'npv-irr',
    name: 'NPV, IRR & Payback Calculator',
    cat: 'finance',
    icon: '💹',
    desc: 'Net present value, internal rate of return, profitability index and (discounted) payback period for a series of cash flows.',
    keywords: 'npv irr payback period net present value internal rate of return discounted cash flow capital budgeting',
    inputs: [
      { id: 'initial', label: 'Initial investment (outflow)', type: 'number', value: 10000, money: true },
      { id: 'flows', label: 'Cash flows, one per period (year 1, year 2, …)', type: 'textarea', value: '3000\n4200\n6800\n2000', help: 'Separate with new lines or commas. Use a minus sign for outflows, e.g. -500.' },
      { id: 'rate', label: 'Discount rate', type: 'number', value: 10, suffix: '%', step: 0.1, help: 'Your required return or cost of capital per period.' },
    ],
    compute(v) {
      const flows = String(v.flows ?? '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).map((s) => num(s));
      if (!flows.length) throw new Error('Enter at least one cash flow.');
      const c0 = -Math.abs(num(v.initial));
      const cfs = [c0, ...flows];
      const r = num(v.rate) / 100;
      if (r <= -1) throw new Error('Discount rate must be above −100%.');
      const NPV = npv(r, cfs);
      const IRR = irr(cfs);
      const pvIn = flows.reduce((s, c, t) => s + c / Math.pow(1 + r, t + 1), 0);
      const payback = (disc) => {
        let cum = c0;
        for (let t = 1; t < cfs.length; t++) {
          const cf = disc ? cfs[t] / Math.pow(1 + r, t) : cfs[t];
          if (cum < 0 && cum + cf >= 0) return t - 1 + -cum / cf;
          cum += cf;
        }
        return cum >= 0 ? 0 : null;
      };
      const pb = payback(false);
      const dpb = payback(true);
      let cum = c0;
      let dcum = c0;
      const rows = [[0, c0, c0, c0, c0]];
      flows.forEach((cf, k) => {
        const t = k + 1;
        const pv = cf / Math.pow(1 + r, t);
        cum += cf;
        dcum += pv;
        rows.push([t, cf, pv, cum, dcum]);
      });
      return {
        primary: { label: 'Net present value (NPV)', value: NPV, type: 'money', badge: NPV >= 0 ? 'Accept — earns more than the discount rate' : 'Reject — earns less than the discount rate' },
        items: [
          { label: 'Internal rate of return (IRR)', value: Number.isNaN(IRR) ? 'No IRR (cash flows never change sign)' : IRR * 100, type: Number.isNaN(IRR) ? 'text' : 'percent' },
          { label: 'Profitability index', value: c0 ? pvIn / -c0 : 0, type: 'number2' },
          { label: 'Payback period', value: pb === null ? 'Never' : `${pb.toFixed(2)} periods`, type: 'text' },
          { label: 'Discounted payback period', value: dpb === null ? 'Never' : `${dpb.toFixed(2)} periods`, type: 'text' },
          { label: 'Total undiscounted net cash', value: cfs.reduce((s, c) => s + c, 0), type: 'money' },
        ],
        note: signChanges(cfs) > 1 ? 'Cash flows change sign more than once, so more than one IRR may exist — rely on NPV.' : undefined,
        table: { title: 'Cash-flow analysis', head: ['Period', 'Cash flow', 'Present value', 'Cumulative', 'Cumulative PV'], types: ['int', 'money', 'money', 'money', 'money'], rows },
      };
    },
    about: `<p><code>NPV = Σ CF<sub>t</sub> / (1 + r)<sup>t</sup></code> for t = 0…n, where CF<sub>0</sub> is the (negative) initial investment.
      The <b>IRR</b> is the rate that makes NPV = 0 (found numerically). <b>Profitability index</b> = PV of future cash flows ÷ initial investment.
      <b>Payback</b> is the time until cumulative cash flow turns positive, interpolated within the period; discounted payback uses present values.</p>
      <p><b>Example:</b> invest $1,000, receive $500, $400 and $300 over three years at a 10% discount rate:
      NPV = −1,000 + 454.55 + 330.58 + 225.39 = <b>$10.52</b>, IRR ≈ <b>10.65%</b>, payback = 2 + 100/300 = 2.33 years.</p>
      <p>Cash flows are assumed to arrive at the end of each period. A positive NPV means the project beats your required return.</p>`,
  },
  {
    id: 'interest-rate',
    name: 'Interest Rate Calculator',
    cat: 'finance',
    icon: '🔎',
    desc: 'Find the real interest rate (APR) on a loan from the amount borrowed, the monthly payment and the term.',
    keywords: 'interest rate calculator find rate apr solve for rate loan payment what is my interest rate',
    inputs: [
      { id: 'amount', label: 'Loan amount', type: 'number', value: 20000, money: true },
      { id: 'payment', label: 'Monthly payment', type: 'number', value: 386.66, money: true },
      { id: 'years', label: 'Loan term (years)', type: 'number', value: 5, suffix: 'yrs' },
      { id: 'months', label: 'Plus months', type: 'number', value: 0, suffix: 'mo' },
    ],
    compute(v) {
      const P = num(v.amount);
      const pay = num(v.payment);
      const n = Math.round(num(v.years) * 12 + num(v.months));
      if (P <= 0 || pay <= 0 || n <= 0) throw new Error('Enter a positive loan amount, payment and term.');
      if (pay * n < P - 1e-9) throw new Error(`Total payments (${(pay * n).toFixed(2)}) are less than the loan amount — the rate would be negative.`);
      const i = solveRate(P, n, pay);
      const total = pay * n;
      return {
        primary: { label: 'Interest rate (APR)', value: i * 12 * 100, type: 'percent' },
        items: [
          { label: 'Effective annual rate', value: (Math.pow(1 + i, 12) - 1) * 100, type: 'percent' },
          { label: 'Monthly rate', value: i * 100, type: 'percent' },
          { label: 'Total of payments', value: total, type: 'money' },
          { label: 'Total interest', value: total - P, type: 'money' },
          { label: 'Number of payments', value: n, type: 'int' },
        ],
        chart: { type: 'donut', data: [{ label: 'Principal', value: P }, { label: 'Interest', value: total - P }] },
      };
    },
    about: `<p>A loan payment satisfies <code>PMT = P · i / (1 − (1 + i)<sup>−n</sup>)</code>. There is no algebraic solution for the monthly rate i,
      so the calculator finds it numerically (bisection to 15 decimal places). APR = 12 × i; the effective annual rate = (1 + i)<sup>12</sup> − 1.</p>
      <p><b>Example:</b> borrowing $200,000 and paying $1,199.10 a month for 30 years corresponds to an APR of <b>6.00%</b> (effective 6.17%).
      $20,000 repaid at $386.66/month over 5 years is a 6.00% APR.</p>
      <p>If the lender charged fees that were deducted from the amount you received, enter the amount you actually received to see the true cost.</p>`,
  },
  {
    id: 'house-affordability',
    name: 'House Affordability Calculator',
    cat: 'finance',
    icon: '🔑',
    desc: 'How much house can I afford? Maximum home price from your income, debts and down payment using the 28/36 rule.',
    keywords: 'how much house can i afford home affordability mortgage qualify 28 36 rule',
    inputs: [
      { id: 'income', label: 'Annual gross household income', type: 'number', value: 120000, money: true },
      { id: 'debts', label: 'Monthly debt payments', type: 'number', value: 500, money: true, help: 'Car, student, credit card minimums and other loans — not rent or utilities.' },
      { id: 'down', label: 'Down payment available', type: 'number', value: 60000, money: true },
      { id: 'rate', label: 'Mortgage rate', type: 'number', value: 6.5, suffix: '%', step: 0.01 },
      { id: 'term', label: 'Loan term', type: 'select', value: '30', options: [['30', '30 years'], ['20', '20 years'], ['15', '15 years']] },
      { id: 'tax', label: 'Property tax', type: 'number', value: 1.2, suffix: '%/yr', step: 0.01 },
      { id: 'ins', label: 'Home insurance (per year)', type: 'number', value: 1500, money: true },
      { id: 'hoa', label: 'HOA fee (per month)', type: 'number', value: 0, money: true },
      { id: 'front', label: 'Max housing ratio (front-end)', type: 'number', value: 28, suffix: '%' },
      { id: 'back', label: 'Max total DTI (back-end)', type: 'number', value: 36, suffix: '%' },
    ],
    compute(v) {
      const mInc = num(v.income) / 12;
      if (mInc <= 0) throw new Error('Enter your annual income.');
      const D = Math.max(num(v.down), 0);
      const limFront = (mInc * num(v.front)) / 100;
      const limBack = (mInc * num(v.back)) / 100 - num(v.debts);
      const M = Math.min(limFront, limBack);
      const I = num(v.ins) / 12 + num(v.hoa);
      const t = num(v.tax) / 100 / 12;
      if (M <= I) throw new Error('Your debts leave no room for a housing payment at these ratios.');
      const k = pmt(num(v.rate) / 100 / 12, num(v.term) * 12, 1);
      let price = (M - I + k * D) / (k + t);
      if (price < D) price = t > 0 ? Math.min(D, (M - I) / t) : D; // cash purchase within budget
      const loan = Math.max(price - D, 0);
      const pi = loan * k;
      const taxM = price * t;
      return {
        primary: { label: 'Maximum home price', value: price, type: 'money', badge: limBack < limFront ? 'Limited by your existing debts (back-end ratio)' : 'Limited by the housing ratio (front-end)' },
        items: [
          { label: 'Loan amount', value: loan, type: 'money' },
          { label: 'Down payment', value: Math.min(D, price), type: 'money' },
          { label: 'Down payment %', value: price > 0 ? (Math.min(D, price) / price) * 100 : 0, type: 'percent' },
          { label: 'Monthly housing payment (PITI + HOA)', value: pi + taxM + I, type: 'money' },
          { label: 'Principal & interest', value: pi, type: 'money' },
          { label: 'Property tax + insurance + HOA', value: taxM + I, type: 'money' },
        ],
        chart: { type: 'donut', data: [{ label: 'Principal & interest', value: pi }, { label: 'Property tax', value: taxM }, { label: 'Insurance & HOA', value: I }] },
        note: price > 0 && D / price < 0.2 ? 'With less than 20% down, most conventional US loans add private mortgage insurance (PMI), which lowers what you can afford.' : undefined,
      };
    },
    about: `<p>Your maximum monthly housing payment is the smaller of <code>income × front-end ratio</code> and <code>income × back-end ratio − other debts</code>.
      The home price P then solves <code>k·(P − Down) + P·tax/12 + insurance/12 + HOA = max payment</code>, where k is the monthly payment per $1 borrowed.</p>
      <p><b>Example:</b> $120,000 income, $500 debts, $60,000 down, 6.5% for 30 years, 1.2% tax, $1,500 insurance:
      limits are $2,800 (28%) and $3,100 (36% − $500), so $2,800 applies and the maximum price is about <b>$417,000</b>.</p>
      <p>The 28/36 rule is a widely used guideline; Fannie Mae's Selling Guide (B3-6-02, checked 2026) allows a back-end DTI up to 45–50% in some cases, but borrowing the maximum leaves little room for savings.
      Results exclude PMI and closing costs. This is an estimate, not a loan offer.</p>`,
  },

  /* =============================== HEALTH =============================== */
  {
    id: 'sleep',
    name: 'Sleep Calculator',
    cat: 'health',
    icon: '😴',
    desc: 'Best times to go to bed or wake up based on 90-minute sleep cycles, so you wake up between cycles feeling refreshed.',
    keywords: 'sleep cycle bedtime wake up time when should i go to bed rem',
    inputs: [
      { id: 'mode', label: 'I want to', type: 'select', value: 'wake', options: [['wake', 'Wake up at…'], ['bed', 'Go to bed at…']] },
      { id: 'time', label: 'Time', type: 'time', value: '07:00' },
      { id: 'fall', label: 'Time to fall asleep', type: 'number', value: 15, suffix: 'min', help: 'Most healthy adults fall asleep in 10–20 minutes.' },
      { id: 'cycle', label: 'Sleep cycle length', type: 'number', value: 90, suffix: 'min' },
    ],
    compute(v) {
      const t = parseClock(v.time);
      if (t === null) throw new Error('Enter a valid time.');
      const fall = Math.max(num(v.fall), 0);
      const cyc = Math.min(Math.max(num(v.cycle) || 90, 60), 120);
      const wake = v.mode !== 'bed';
      const rows = [6, 5, 4, 3].map((c) => {
        const sleep = c * cyc;
        const at = wake ? t - sleep - fall : t + fall + sleep;
        const rating = c >= 5 ? 'Recommended' : c === 4 ? 'OK for a short night' : 'Not enough';
        return [clockStr(at), c, hm(sleep), rating];
      });
      const best = rows.filter((r) => r[1] >= 5);
      return {
        primary: { label: wake ? 'Go to bed at' : 'Wake up at', value: wake ? `${best[0][0]} or ${best[1][0]}` : `${best[1][0]} or ${best[0][0]}`, type: 'text' },
        items: [
          { label: wake ? 'For 6 cycles (9 h of sleep)' : 'After 6 cycles', value: best[0][0], type: 'text' },
          { label: wake ? 'For 5 cycles (7.5 h of sleep)' : 'After 5 cycles', value: best[1][0], type: 'text' },
          { label: 'Time to fall asleep included', value: `${fall} min`, type: 'text' },
        ],
        table: { title: 'All options', head: [wake ? 'Bedtime' : 'Wake time', 'Cycles', 'Sleep', ''], types: ['text', 'int', 'text', 'text'], rows },
      };
    },
    about: `<p>Sleep runs in cycles of light, deep and REM sleep that average about 90 minutes (typically 80–110). Waking at the end of a cycle, rather than from deep sleep,
      usually feels easier. Bedtime = wake time − (cycles × cycle length) − time to fall asleep.</p>
      <p><b>Example:</b> to wake at 7:00 AM with 15 minutes to fall asleep, go to bed at <b>9:45 PM</b> (6 cycles, 9 h) or <b>11:15 PM</b> (5 cycles, 7.5 h).</p>
      <p>The American Academy of Sleep Medicine and Sleep Research Society recommend that adults sleep <b>7 or more hours</b> a night regularly
      (<a href="https://jcsm.aasm.org/doi/10.5664/jcsm.4758" rel="nofollow noopener">Watson et al., 2015</a>); teenagers need 8–10 hours. Cycle length varies between people and nights, so treat these times as a guide.</p>`,
  },
  {
    id: 'macro',
    name: 'Macro Calculator',
    cat: 'health',
    icon: '🥗',
    desc: 'Daily calories plus protein, carbohydrate and fat targets in grams for your goal — lose, maintain or gain weight.',
    keywords: 'macro macros protein carbs fat grams diet iifym protein intake calculator',
    inputs: [
      unitsInput,
      sexInput,
      { id: 'age', label: 'Age', type: 'number', value: 30, suffix: 'yrs' },
      { id: 'kg', label: 'Weight', type: 'number', value: 80, suffix: 'kg', showIf: isMetric },
      { id: 'cm', label: 'Height', type: 'number', value: 180, suffix: 'cm', showIf: isMetric },
      { id: 'lb', label: 'Weight', type: 'number', value: 176, suffix: 'lb', showIf: isImperial },
      { id: 'ft', label: 'Height (feet)', type: 'number', value: 5, suffix: 'ft', showIf: isImperial },
      { id: 'in', label: 'Height (inches)', type: 'number', value: 11, suffix: 'in', showIf: isImperial },
      { id: 'act', label: 'Activity level', type: 'select', value: '1.55', options: [['1.2', 'Sedentary (little or no exercise)'], ['1.375', 'Light (1–3 days/week)'], ['1.55', 'Moderate (3–5 days/week)'], ['1.725', 'Active (6–7 days/week)'], ['1.9', 'Very active (physical job or 2×/day)']] },
      { id: 'goal', label: 'Goal', type: 'select', value: '0', options: [['-500', 'Lose weight (−500 kcal/day ≈ 0.45 kg/week)'], ['-250', 'Lose slowly (−250 kcal/day)'], ['0', 'Maintain weight'], ['250', 'Gain slowly (+250 kcal/day)'], ['500', 'Gain weight (+500 kcal/day)']] },
      { id: 'split', label: 'Diet type (protein / carbs / fat)', type: 'select', value: '30-40-30', options: [['30-40-30', 'Balanced (30 / 40 / 30)'], ['25-55-20', 'Low fat (25 / 55 / 20)'], ['40-20-40', 'Low carb (40 / 20 / 40)'], ['40-35-25', 'High protein (40 / 35 / 25)'], ['20-5-75', 'Keto (20 / 5 / 75)']] },
    ],
    compute(v) {
      const kg = isImperial(v) ? num(v.lb) * 0.45359237 : num(v.kg);
      const cm = isImperial(v) ? (num(v.ft) * 12 + num(v.in)) * 2.54 : num(v.cm);
      const age = num(v.age);
      if (kg <= 0 || cm <= 0 || age <= 0) throw new Error('Enter your age, weight and height.');
      if (age < 18) throw new Error('These formulas are for adults (18+). Ask a doctor or dietitian for children and teens.');
      const bmr = 10 * kg + 6.25 * cm - 5 * age + (v.sex === 'female' ? -161 : 5);
      const tdee = bmr * num(v.act);
      const floor = v.sex === 'female' ? 1200 : 1500;
      const kcal = Math.max(tdee + num(v.goal), floor);
      const [p, c, f] = String(v.split || '30-40-30').split('-').map(Number);
      const protein = (kcal * p) / 100 / 4;
      const carbs = (kcal * c) / 100 / 4;
      const fat = (kcal * f) / 100 / 9;
      return {
        primary: { label: 'Daily calories', value: Math.round(kcal), type: 'int', unit: 'kcal' },
        items: [
          { label: `Protein (${p}%)`, value: Math.round(protein), type: 'int', unit: 'g/day' },
          { label: `Carbohydrates (${c}%)`, value: Math.round(carbs), type: 'int', unit: 'g/day' },
          { label: `Fat (${f}%)`, value: Math.round(fat), type: 'int', unit: 'g/day' },
          { label: 'Protein per kg body weight', value: protein / kg, type: 'number1', unit: 'g/kg' },
          { label: 'Protein for active adults (1.4–2.0 g/kg)', value: `${Math.round(kg * 1.4)}–${Math.round(kg * 2)} g/day`, type: 'text' },
          { label: 'Maintenance calories (TDEE)', value: Math.round(tdee), type: 'int', unit: 'kcal' },
          { label: 'BMR (Mifflin-St Jeor)', value: Math.round(bmr), type: 'int', unit: 'kcal' },
        ],
        note: kcal > tdee + num(v.goal) + 1 ? `Calories raised to a ${floor} kcal minimum — very-low-calorie diets should be medically supervised.` : undefined,
      };
    },
    about: `<p>Calories start from the Mifflin-St Jeor BMR: <code>10 × kg + 6.25 × cm − 5 × age + 5</code> (men) or <code>− 161</code> (women), multiplied by an activity factor
      to get maintenance calories (TDEE), then adjusted for your goal. Grams = calories × macro share ÷ energy density (protein and carbs 4 kcal/g, fat 9 kcal/g).</p>
      <p><b>Example:</b> a 30-year-old man, 80 kg, 180 cm, moderately active: BMR = 1,780 kcal; TDEE = 1,780 × 1.55 = 2,759 kcal. On a balanced 30/40/30 split
      that is 207 g protein, 276 g carbs and 92 g fat.</p>
      <p>Protein guidance: the RDA is 0.8 g/kg for adults (US National Academies DRI), while the International Society of Sports Nutrition suggests
      1.4–2.0 g/kg for people who exercise regularly (<a href="https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8" rel="nofollow noopener">Jäger et al., 2017</a>).
      Not medical advice — talk to a doctor or registered dietitian if you have a health condition, are pregnant, or are under 18.</p>`,
  },
  {
    id: 'ovulation',
    name: 'Ovulation Calculator',
    cat: 'health',
    icon: '🌸',
    desc: 'Predict your ovulation day, fertile window and next period from the first day of your last period.',
    keywords: 'ovulation fertile window fertility days when am i ovulating period tracker conceive',
    inputs: [
      { id: 'lmp', label: 'First day of your last period', type: 'date', value: () => todayISO() },
      { id: 'cycle', label: 'Average cycle length', type: 'number', value: 28, suffix: 'days', help: 'Count from the first day of one period to the first day of the next. Typical range 21–35 days.' },
      { id: 'luteal', label: 'Luteal phase length', type: 'number', value: 14, suffix: 'days', help: 'Days from ovulation to your next period — usually 12–16. Leave at 14 if unsure.' },
    ],
    compute(v) {
      const lmp = parseDate(v.lmp);
      if (!lmp) throw new Error('Enter the first day of your last period.');
      const cycle = Math.round(num(v.cycle));
      const luteal = Math.round(num(v.luteal)) || 14;
      if (cycle < 20 || cycle > 45) throw new Error('Cycle length should be between 20 and 45 days.');
      if (luteal < 9 || luteal > 18 || luteal >= cycle - 4) throw new Error('Luteal phase should be 9–18 days and shorter than your cycle.');
      const at = (d) => new Date(lmp.getTime() + d * DAY_MS);
      const rows = [];
      for (let k = 0; k < 6; k++) {
        const start = k * cycle;
        const ov = start + cycle - luteal;
        rows.push([fmtDate(at(start)), `${fmtDate(at(ov - 5))} – ${fmtDate(at(ov + 1))}`, fmtDate(at(ov)), fmtDate(at(start + cycle))]);
      }
      const ov = cycle - luteal;
      return {
        primary: { label: 'Estimated ovulation', value: fmtDateLong(at(ov)), type: 'text' },
        items: [
          { label: 'Fertile window', value: `${fmtDate(at(ov - 5))} – ${fmtDate(at(ov + 1))}`, type: 'text' },
          { label: 'Most fertile days', value: `${fmtDate(at(ov - 2))} – ${fmtDate(at(ov))}`, type: 'text' },
          { label: 'Next period expected', value: fmtDate(at(cycle)), type: 'text' },
          { label: 'Pregnancy test from', value: fmtDate(at(cycle + 1)), type: 'text' },
          { label: 'If conceived, estimated due date', value: fmtDate(at(280 + (cycle - 28))), type: 'text' },
        ],
        table: { title: 'Next 6 cycles', head: ['Period starts', 'Fertile window', 'Ovulation', 'Next period'], types: ['text', 'text', 'text', 'text'], rows },
        note: 'Estimate only — cycles vary. This calculator must not be used as contraception.',
      };
    },
    about: `<p>Ovulation usually happens about 14 days <i>before</i> the next period (the luteal phase is fairly constant, the first half of the cycle varies).
      So <code>Ovulation = Last period + Cycle length − Luteal phase</code>. The <b>fertile window</b> is the five days before ovulation plus ovulation day
      (sperm survive up to five days; the egg about 12–24 hours) — we show one extra day for safety.</p>
      <p><b>Example:</b> last period on 1 January with a 28-day cycle → ovulation around <b>15 January</b>, fertile window 10–16 January, next period 29 January.</p>
      <p>Sources: <a href="https://www.nhs.uk/conditions/pregnancy-and-baby/" rel="nofollow noopener">NHS</a>; Wilcox et al., <i>NEJM</i> 1995 (the six-day fertile window).
      Irregular cycles, PCOS, breastfeeding or recent hormonal contraception make predictions unreliable — ovulation tests or tracking basal body temperature are more accurate.</p>`,
  },

  /* ================================ MATH ================================ */
  {
    id: 'logarithm',
    name: 'Log Calculator',
    cat: 'math',
    icon: '㏒',
    desc: 'Logarithm of any number to any base (log₁₀, ln, log₂, custom), plus exponents and antilogs.',
    keywords: 'log logarithm ln natural log base 10 log2 antilog exponent power calculator',
    inputs: [
      { id: 'mode', label: 'Calculate', type: 'select', value: 'log', rerender: true, options: [['log', 'Logarithm  log_b(x)'], ['pow', 'Exponent / antilog  bʸ']] },
      { id: 'base', label: 'Base (b)', type: 'text', value: '10', help: 'Any positive number except 1, or "e" for the natural log.' },
      { id: 'x', label: 'Number (x)', type: 'text', value: '1000', showIf: (v) => v.mode !== 'pow' },
      { id: 'y', label: 'Exponent (y)', type: 'text', value: '3', showIf: (v) => v.mode === 'pow' },
    ],
    compute(v) {
      const bs = String(v.base ?? '').trim().toLowerCase();
      const b = bs === 'e' ? Math.E : num(bs);
      if (!(b > 0) || b === 1) throw new Error('The base must be positive and not equal to 1.');
      const bLabel = bs === 'e' ? 'e' : String(b);
      if (v.mode === 'pow') {
        const y = num(v.y);
        const r = Math.pow(b, y);
        return {
          primary: { label: `${bLabel}^${y}`, value: r, type: 'number' },
          items: [
            { label: 'Scientific notation', value: r.toExponential(8), type: 'text' },
            { label: `Check: log_${bLabel}(result)`, value: Math.log(r) / Math.log(b), type: 'number' },
          ],
        };
      }
      const x = num(v.x);
      if (!(x > 0)) throw new Error('The logarithm is only defined for positive numbers.');
      const ln = Math.log(x);
      let r = ln / Math.log(b);
      const nearest = Math.round(r);
      if (Math.abs(r - nearest) < 1e-12) r = nearest; // tidy exact powers (e.g. log10(1000) = 3)
      return {
        primary: { label: `log_${bLabel}(${x})`, value: r, type: 'number' },
        items: [
          { label: 'Natural log ln(x)', value: ln, type: 'number' },
          { label: 'Common log log₁₀(x)', value: Math.log10(x), type: 'number' },
          { label: 'Binary log log₂(x)', value: Math.log2(x), type: 'number' },
          { label: `Check: ${bLabel}^result`, value: Math.pow(b, r), type: 'number' },
        ],
      };
    },
    about: `<p>The logarithm answers "to what power must b be raised to get x?": <code>log<sub>b</sub>(x) = y ⇔ b<sup>y</sup> = x</code>.
      Any base can be computed with the change-of-base rule <code>log<sub>b</sub>(x) = ln(x) / ln(b)</code>.</p>
      <p><b>Examples:</b> log<sub>10</sub>(1000) = 3, log<sub>2</sub>(8) = 3, ln(e<sup>2</sup>) = 2, log<sub>5</sub>(125) = 3. The antilog of 2 in base 10 is 10<sup>2</sup> = 100.</p>
      <p>Useful rules: log(xy) = log x + log y, log(x/y) = log x − log y, log(x<sup>k</sup>) = k·log x, log<sub>b</sub>(1) = 0.</p>`,
  },
  {
    id: 'scientific-notation',
    name: 'Scientific Notation Converter',
    cat: 'math',
    icon: '🔬',
    desc: 'Convert numbers to and from scientific notation, E-notation and engineering notation — exactly, without rounding errors.',
    keywords: 'scientific notation standard form e notation engineering notation convert exponent power of ten',
    inputs: [
      { id: 'n', label: 'Number', type: 'text', value: '0.000045060', help: 'Decimal (123000, 0.00045) or scientific (4.5e-4, 4.5 x 10^-4).' },
    ],
    compute(v) {
      const p = parseDecimal(v.n);
      if (!p) throw new Error('Enter a number such as 123000, 0.0045 or 6.02e23.');
      if (p.zero) return { primary: { label: 'Scientific notation', value: '0 × 10⁰', type: 'mono' }, items: [{ label: 'E-notation', value: '0e0', type: 'mono' }] };
      const { sign, digits, exp } = p;
      const m = mant(sign, digits);
      const eng = Math.floor(exp / 3) * 3;
      const shift = exp - eng;
      const engM = digitsToDecimal(sign, digits, shift);
      return {
        primary: { label: 'Scientific notation', value: `${m} × 10${sup(exp)}`, type: 'mono' },
        items: [
          { label: 'E-notation', value: `${m}e${exp}`, type: 'mono' },
          { label: 'Engineering notation', value: `${engM} × 10${sup(eng)}`, type: 'mono' },
          { label: 'Decimal', value: digitsToDecimal(sign, digits, exp), type: 'mono' },
          { label: 'Significant figures', value: `${p.sig}${p.ambiguous ? ' (trailing zeros ambiguous)' : ''}`, type: 'text' },
          { label: 'Order of magnitude', value: exp, type: 'int' },
        ],
      };
    },
    about: `<p>Scientific notation writes a number as <code>a × 10<sup>b</sup></code> with 1 ≤ |a| &lt; 10 and integer b. Move the decimal point until one non-zero digit is left of it;
      b is the number of places moved (positive if you moved left, negative if right). Engineering notation restricts b to multiples of 3 (kilo, mega, milli, micro…).</p>
      <p><b>Examples:</b> 299,792,458 = 2.99792458 × 10<sup>8</sup>; 0.00045 = 4.5 × 10<sup>−4</sup> (E-notation 4.5e-4; engineering 450 × 10<sup>−6</sup>).</p>
      <p>Conversion is done on the digits as text, so long numbers keep every digit. Trailing zeros you type after a decimal point are kept because they are significant.</p>`,
  },
  {
    id: 'sig-figs',
    name: 'Significant Figures Calculator',
    cat: 'math',
    icon: '🎯',
    desc: 'Count the significant figures in a number and round it to any number of sig figs.',
    keywords: 'significant figures sig figs counter rounding sigfig digits',
    inputs: [
      { id: 'n', label: 'Number', type: 'text', value: '0.004560', help: 'Write trailing zeros as you would on paper: "1200." or "1.200e3" marks them as significant.' },
      { id: 'to', label: 'Round to (sig figs)', type: 'number', value: 2, help: 'Leave blank to only count.' },
    ],
    compute(v) {
      const p = parseDecimal(v.n);
      if (!p) throw new Error('Enter a number such as 0.00450, 1200 or 6.02e23.');
      const items = [];
      const explain = p.zero ? 'Zero — only the zeros after a decimal point are counted.'
        : p.ambiguous ? 'Trailing zeros in a whole number without a decimal point are not counted (they may only be placeholders). Write "1200." or 1.200 × 10³ to show they are significant.'
          : 'Leading zeros are never significant; all non-zero digits, zeros between them, and trailing zeros after a decimal point are.';
      if (!blank(v.to) && !p.zero) {
        const n = Math.round(num(v.to));
        if (n < 1 || n > 100) throw new Error('Round to between 1 and 100 significant figures.');
        const r = roundDigits(p.digits, p.exp, n);
        let dec = digitsToDecimal(p.sign, r.digits, r.exp);
        // A whole number whose last significant digit is a zero needs a trailing point to show it.
        if (r.exp === n - 1 && r.digits.endsWith('0')) dec += '.';
        items.push({ label: `Rounded to ${n} sig fig${n === 1 ? '' : 's'}`, value: dec, type: 'mono' });
        items.push({ label: 'In scientific notation', value: `${mant(p.sign, r.digits)} × 10${sup(r.exp)}`, type: 'mono' });
      }
      if (!p.zero) {
        items.push({ label: 'Significant digits', value: p.digits, type: 'mono' });
        items.push({ label: 'Decimal places', value: Math.max(0, p.digits.length - 1 - p.exp), type: 'int' });
      }
      return { primary: { label: 'Significant figures', value: p.sig, type: 'int' }, items, note: explain };
    },
    about: `<p><b>Rules:</b> (1) non-zero digits are significant; (2) zeros between non-zero digits are significant; (3) leading zeros are not;
      (4) trailing zeros are significant only if the number contains a decimal point. In scientific notation every digit of the mantissa counts.</p>
      <p><b>Examples:</b> 0.004560 → <b>4</b> (4, 5, 6, 0); 1,200 → 2 (ambiguous); 1,200. → 4; 6.020 × 10<sup>23</sup> → 4; 10.05 → 4.
      Rounding 0.004560 to 2 sig figs gives 0.0046; 98,760 to 2 gives 99,000 (9.9 × 10<sup>4</sup>).</p>
      <p>Rounding is half-up and done on the decimal digits directly, so there are no floating-point surprises (e.g. 2.675 → 2.68).</p>`,
  },
  {
    id: 'ratio',
    name: 'Ratio & Proportion Calculator',
    cat: 'math',
    icon: '➗',
    desc: 'Solve proportions A : B = C : D for the missing value, and simplify any ratio.',
    keywords: 'ratio proportion solve for x simplify ratio cross multiply scale aspect ratio',
    inputs: [
      { id: 'a', label: 'A', type: 'number', value: 3 },
      { id: 'b', label: 'B', type: 'number', value: 4 },
      { id: 'c', label: 'C', type: 'number', value: 9 },
      { id: 'd', label: 'D', type: 'number', value: '', help: 'Leave exactly one of C or D blank to solve A : B = C : D. Leave both blank to just simplify A : B.' },
    ],
    compute(v) {
      const fields = ['a', 'b', 'c', 'd'];
      const empty = fields.filter((k) => blank(v[k]));
      const n = Object.fromEntries(fields.map((k) => [k, num(v[k])]));
      const simplify = (x, y) => {
        const dp = Math.min(Math.max(decimals(String(+x.toPrecision(12))), decimals(String(+y.toPrecision(12)))), 9);
        const f = 10 ** dp;
        let p = Math.round(x * f);
        let q = Math.round(y * f);
        const g = gcd(p, q) || 1;
        p /= g;
        q /= g;
        return `${p} : ${q}`;
      };
      const items = [];
      let primary;
      if (empty.length > 1 && !(empty.length === 2 && empty.includes('c') && empty.includes('d'))) throw new Error('Leave only one value blank.');
      if (empty.length === 0) {
        const ok = Math.abs(n.a * n.d - n.b * n.c) <= 1e-9 * Math.max(1, Math.abs(n.a * n.d));
        primary = { label: 'Is A : B = C : D?', value: ok ? 'Yes — the ratios are equal' : 'No — the ratios are not equal', type: 'text' };
        items.push({ label: 'A × D', value: n.a * n.d, type: 'number' }, { label: 'B × C', value: n.b * n.c, type: 'number' });
      } else if (empty.length === 1) {
        const k = empty[0];
        const solve = { a: () => (n.b * n.c) / n.d, b: () => (n.a * n.d) / n.c, c: () => (n.a * n.d) / n.b, d: () => (n.b * n.c) / n.a };
        const den = { a: n.d, b: n.c, c: n.b, d: n.a }[k];
        if (!den) throw new Error('Division by zero — check the non-blank values.');
        const x = solve[k]();
        n[k] = x;
        primary = { label: `Missing value ${k.toUpperCase()}`, value: x, type: 'number' };
        items.push({ label: 'Proportion', value: `${+n.a.toPrecision(10)} : ${+n.b.toPrecision(10)} = ${+n.c.toPrecision(10)} : ${+n.d.toPrecision(10)}`, type: 'text' });
      }
      if (!n.a || !n.b) {
        if (!primary) throw new Error('Enter A and B.');
      } else {
        const s = simplify(n.a, n.b);
        if (!primary) primary = { label: 'Simplified ratio', value: s, type: 'text' };
        else items.push({ label: 'A : B simplified', value: s, type: 'text' });
        items.push(
          { label: 'As 1 : x', value: `1 : ${+(n.b / n.a).toPrecision(8)}`, type: 'text' },
          { label: 'As x : 1', value: `${+(n.a / n.b).toPrecision(8)} : 1`, type: 'text' },
          { label: 'A as % of B', value: (n.a / n.b) * 100, type: 'percent' },
          { label: 'A share of total (A + B)', value: (n.a / (n.a + n.b)) * 100, type: 'percent' },
        );
      }
      return { primary, items };
    },
    about: `<p>Two ratios are in proportion when <code>A / B = C / D</code>, i.e. <code>A × D = B × C</code> (cross-multiplication).
      Solve for the unknown: D = B × C / A, C = A × D / B, B = A × D / C, A = B × C / D.
      A ratio is simplified by dividing both terms by their greatest common divisor (decimals are scaled to whole numbers first).</p>
      <p><b>Example:</b> 3 : 4 = 9 : D → D = 4 × 9 / 3 = <b>12</b>. The ratio 1920 : 1080 simplifies to 16 : 9; 1.5 : 2.5 simplifies to 3 : 5.</p>`,
  },
  {
    id: 'weighted-average',
    name: 'Weighted Average Calculator',
    cat: 'math',
    icon: '⚖',
    desc: 'Weighted mean of values with weights, percentages or credits — for grades, portfolios and prices.',
    keywords: 'weighted average weighted mean grade average weights percentage average calculator mean',
    inputs: [
      { id: 'data', label: 'One per line: value, weight', type: 'textarea', value: '90, 30\n80, 50\n70, 20', help: 'Weights can be percentages, credits, quantities or any positive numbers — they don\'t need to add up to 100.' },
    ],
    compute(v) {
      const pairs = [];
      for (const ln of lines(v.data)) {
        const parts = ln.split(/[\s,;:\t]+/).filter(Boolean).map((s) => parseFloat(s.replace('%', '')));
        if (parts.length < 2 || !parts.slice(0, 2).every(Number.isFinite)) throw new Error(`Couldn't read "${ln}". Use: value, weight`);
        pairs.push(parts.slice(0, 2));
      }
      if (!pairs.length) throw new Error('Enter at least one value and weight.');
      const W = pairs.reduce((s, [, w]) => s + w, 0);
      if (W === 0) throw new Error('Weights must not add up to zero.');
      const sum = pairs.reduce((s, [x, w]) => s + x * w, 0);
      const mean = pairs.reduce((s, [x]) => s + x, 0) / pairs.length;
      return {
        primary: { label: 'Weighted average', value: sum / W, type: 'number' },
        items: [
          { label: 'Sum of weights', value: W, type: 'number' },
          { label: 'Sum of value × weight', value: sum, type: 'number' },
          { label: 'Unweighted (simple) average', value: mean, type: 'number' },
          { label: 'Number of values', value: pairs.length, type: 'int' },
        ],
        table: { title: 'Contribution of each value', head: ['Value', 'Weight', 'Weight share', 'Value × weight'], types: ['number', 'number', 'percent', 'number'], rows: pairs.map(([x, w]) => [x, w, (w / W) * 100, x * w]) },
      };
    },
    about: `<p><code>Weighted average = Σ(value × weight) / Σ(weight)</code>. Unlike a simple average, values with larger weights pull the result towards themselves.</p>
      <p><b>Example:</b> exam 90 (30%), project 80 (50%), quiz 70 (20%): (90×30 + 80×50 + 70×20) / 100 = <b>81</b>, while the simple average is 80.</p>
      <p>For course grades with letter grades use the <a href="../gpa/">GPA calculator</a>; to find the score you need on a final exam use the <a href="../final-grade/">final grade calculator</a>.</p>`,
  },
  {
    id: 'percent-error',
    name: 'Percent Error Calculator',
    cat: 'math',
    icon: '🧪',
    desc: 'Percentage error between a measured (experimental) value and the true (theoretical) value.',
    keywords: 'percent error percentage error experimental theoretical accepted value measurement accuracy',
    inputs: [
      { id: 'measured', label: 'Measured (experimental) value', type: 'number', value: 9.5 },
      { id: 'actual', label: 'True (accepted / theoretical) value', type: 'number', value: 9.81 },
    ],
    compute(v) {
      const m = num(v.measured);
      const t = num(v.actual);
      if (t === 0) throw new Error('The true value cannot be zero (percent error would be undefined).');
      const err = m - t;
      const pct = (Math.abs(err) / Math.abs(t)) * 100;
      return {
        primary: { label: 'Percent error', value: pct, type: 'percent' },
        items: [
          { label: 'Signed percent error', value: `${err >= 0 ? '+' : '−'}${Math.abs((err / Math.abs(t)) * 100).toFixed(4).replace(/\.?0+$/, '')}% (${err >= 0 ? 'over' : 'under'}estimate)`, type: 'text' },
          { label: 'Absolute error', value: Math.abs(err), type: 'number' },
          { label: 'Relative error', value: Math.abs(err) / Math.abs(t), type: 'number' },
          { label: 'Accuracy (100% − error)', value: Math.max(100 - pct, 0), type: 'percent' },
        ],
      };
    },
    about: `<p><code>Percent error = |Measured − True| / |True| × 100%</code>. The signed version keeps the sign to show whether the measurement was too high or too low.</p>
      <p><b>Example:</b> measuring gravity as 9.5 m/s² when the accepted value is 9.81 m/s²: |9.5 − 9.81| / 9.81 × 100 = <b>3.16%</b> (an underestimate).</p>
      <p>To compare two values when neither is "true", use percent difference: |a − b| / ((a + b)/2) × 100 — see the <a href="../percentage/">percentage calculator</a>.</p>`,
  },

  /* ============================== EVERYDAY ============================== */
  {
    id: 'day-of-week',
    name: 'Day of the Week Calculator',
    cat: 'everyday',
    icon: '📆',
    desc: 'What day of the week was (or will be) any date? Plus day of the year, ISO week number and leap-year check.',
    keywords: 'day of the week what day was i born weekday date week number day of year',
    inputs: [{ id: 'date', label: 'Date', type: 'date', value: () => todayISO() }],
    compute(v) {
      const d = parseDate(v.date);
      if (!d) throw new Error('Enter a valid date.');
      const y = d.getUTCFullYear();
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const doy = Math.round((d - Date.UTC(y, 0, 1)) / DAY_MS) + 1;
      const w = isoWeek(d);
      const dim = new Date(Date.UTC(y, d.getUTCMonth() + 1, 0)).getUTCDate();
      const nth = Math.ceil(d.getUTCDate() / 7);
      const weekday = d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' });
      const today = parseDate(todayISO());
      const delta = Math.round((d - today) / DAY_MS);
      return {
        primary: { label: fmtDateLong(d).replace(/^\w+, /, ''), value: weekday, type: 'text' },
        items: [
          { label: 'Day of the year', value: `${doy} of ${leap ? 366 : 365}`, type: 'text' },
          { label: 'ISO week number', value: `Week ${w.week} of ${w.year}`, type: 'text' },
          { label: 'Occurrence in month', value: `${['1st', '2nd', '3rd', '4th', '5th'][nth - 1]} ${weekday} of the month`, type: 'text' },
          { label: 'Quarter', value: `Q${Math.floor(d.getUTCMonth() / 3) + 1}`, type: 'text' },
          { label: 'Days in this month', value: dim, type: 'int' },
          { label: 'Leap year', value: leap ? 'Yes' : 'No', type: 'text' },
          { label: 'Relative to today', value: delta === 0 ? 'Today' : delta > 0 ? `in ${plural(delta, 'day')}` : `${plural(-delta, 'day')} ago`, type: 'text' },
        ],
      };
    },
    about: `<p>The weekday follows from counting days in the (proleptic) Gregorian calendar. By hand you can use Zeller's congruence:
      <code>h = (q + ⌊13(m+1)/5⌋ + K + ⌊K/4⌋ + ⌊J/4⌋ + 5J) mod 7</code>, where q = day, m = month (March = 3 … February = 14 of the previous year),
      K = year of the century, J = century, and h = 0 is Saturday.</p>
      <p><b>Example:</b> 4 July 1776 was a <b>Thursday</b>; 1 January 2000 was a Saturday; 13 October 2026 is a Tuesday (day 286, ISO week 42).</p>
      <p>ISO weeks start on Monday and week 1 is the week containing the year's first Thursday. Dates before 1582 use the Gregorian rules extended backwards, which differs from historical Julian-calendar dates.</p>`,
  },
  {
    id: 'countdown',
    name: 'Days Until Calculator',
    cat: 'everyday',
    icon: '⏳',
    desc: 'How many days until Christmas, New Year, a birthday, a wedding or any date — in days, weeks, months and business days.',
    keywords: 'days until countdown how many days until christmas new year birthday weeks until date',
    inputs: [
      { id: 'event', label: 'Count down to', type: 'select', value: 'custom', rerender: true, options: [['custom', 'A specific date'], ['christmas', 'Christmas (25 Dec)'], ['newyear', "New Year's Day (1 Jan)"], ['valentine', "Valentine's Day (14 Feb)"], ['easter', 'Easter Sunday (Western)'], ['halloween', 'Halloween (31 Oct)'], ['thanksgiving', 'Thanksgiving (US)']] },
      { id: 'target', label: 'Target date', type: 'date', value: () => `${new Date().getFullYear()}-12-31`, showIf: (v) => v.event === 'custom' },
      { id: 'from', label: 'Counting from', type: 'date', value: () => todayISO() },
    ],
    compute(v) {
      const from = parseDate(v.from);
      if (!from) throw new Error('Enter a valid start date.');
      const target = v.event === 'custom' ? parseDate(v.target) : nextEvent(v.event, from);
      if (!target) throw new Error('Enter a valid target date.');
      const days = Math.round((target - from) / DAY_MS);
      const past = days < 0;
      const [a, b] = past ? [target, from] : [from, target];
      const ad = Math.abs(days);
      const ymd = diffYMD(a, b);
      return {
        primary: { label: past ? `Days since ${fmtDate(target)}` : `Days until ${fmtDate(target)}`, value: plural(ad, 'day'), type: 'text', badge: ad === 0 ? 'It\'s today! 🎉' : undefined },
        items: [
          { label: 'Date', value: fmtDateLong(target), type: 'text' },
          { label: 'Weeks and days', value: `${plural(Math.floor(ad / 7), 'week')}, ${plural(ad % 7, 'day')}`, type: 'text' },
          { label: 'Months and days', value: `${ymd.years ? `${plural(ymd.years, 'year')}, ` : ''}${plural(ymd.months, 'month')}, ${plural(ymd.days, 'day')}`, type: 'text' },
          { label: 'Business days (Mon–Fri)', value: businessDays(a, b), type: 'int' },
          { label: 'Weekend days', value: ad - businessDays(a, b), type: 'int' },
          { label: 'Hours', value: ad * 24, type: 'int' },
        ],
      };
    },
    about: `<p>Days are counted from the start date to the target date, not including the start date (so "tomorrow" is 1 day away). Business days exclude Saturdays and Sundays but not public holidays.</p>
      <p><b>Example:</b> from 13 October 2026, Christmas (25 December 2026) is <b>73 days</b> away: 18 days left in October + 30 in November + 25 in December.</p>
      <p>Holiday dates are calculated each year: US Thanksgiving is the fourth Thursday of November and Western Easter uses the Gregorian computus (Meeus/Jones/Butcher algorithm).
      For the difference between any two dates see the <a href="../date-difference/">date difference calculator</a>.</p>`,
  },
  {
    id: 'time-card',
    name: 'Time Card Calculator',
    cat: 'everyday',
    icon: '🕒',
    desc: 'Weekly timesheet: add up clock-in/clock-out times and breaks, with overtime and gross pay.',
    keywords: 'time card timesheet hours worked calculator clock in out overtime weekly pay work hours',
    inputs: [
      { id: 'times', label: 'One day per line: day, in, out, break (min)', type: 'textarea', value: 'Mon, 9:00, 17:30, 30\nTue, 9:00, 17:30, 30\nWed, 8:45, 17:15, 30\nThu, 9:00, 18:00, 45\nFri, 9:00, 16:00, 30', help: 'Times like 9:00, 17:30 or 5:30pm. Overnight shifts (e.g. 22:00 to 6:00) are handled. Break is optional.' },
      { id: 'rate', label: 'Hourly pay rate', type: 'number', value: 20, money: true },
      { id: 'otAfter', label: 'Overtime after', type: 'number', value: 40, suffix: 'h/week' },
      { id: 'otMult', label: 'Overtime multiplier', type: 'number', value: 1.5, suffix: '×' },
    ],
    compute(v) {
      const rows = [];
      let total = 0;
      for (const ln of lines(v.times)) {
        const parts = ln.split(/\s*[,;\t]\s*|\s+(?=\d)/).filter(Boolean);
        // Optional leading label (anything that is not a time)
        const label = parseClock(parts[0]) === null ? parts.shift() : `Day ${rows.length + 1}`;
        const tin = parseClock(parts[0]);
        const tout = parseClock(parts[1]);
        if (tin === null || tout === null) throw new Error(`Couldn't read the times in "${ln}". Use: day, 9:00, 17:30, 30`);
        let mins = tout - tin;
        if (mins < 0) mins += 1440;
        const brk = parts[2] !== undefined ? num(parts[2]) : 0;
        mins = Math.max(mins - brk, 0);
        total += mins;
        rows.push([label, clockStr(tin), clockStr(tout), brk, hm(mins), mins / 60]);
      }
      if (!rows.length) throw new Error('Enter at least one day.');
      const hours = total / 60;
      const otAfter = Math.max(num(v.otAfter), 0);
      const ot = Math.max(hours - otAfter, 0);
      const reg = hours - ot;
      const rate = num(v.rate);
      const mult = num(v.otMult) || 1;
      const pay = reg * rate + ot * rate * mult;
      return {
        primary: { label: 'Total hours worked', value: `${hm(total)} (${hours.toFixed(2)} h)`, type: 'text' },
        items: [
          { label: 'Regular hours', value: reg, type: 'number2' },
          { label: 'Overtime hours', value: ot, type: 'number2' },
          { label: 'Regular pay', value: reg * rate, type: 'money' },
          { label: `Overtime pay (${mult}×)`, value: ot * rate * mult, type: 'money' },
          { label: 'Gross pay', value: pay, type: 'money' },
        ],
        table: { title: 'Timesheet', head: ['Day', 'In', 'Out', 'Break (min)', 'Worked', 'Decimal hours'], types: ['text', 'text', 'text', 'int', 'text', 'number2'], rows },
      };
    },
    about: `<p>Each day: <code>hours = clock-out − clock-in − unpaid break</code> (adding 24 h if the shift crosses midnight). Weekly hours above the overtime threshold are paid at the multiplier.</p>
      <p><b>Example:</b> five days of 9:00–17:30 with a 30-minute break = 8 h × 5 = 40 h. Add a 4-hour Saturday → 44 h; at $20/h that is 40 × $20 + 4 × $30 = <b>$920</b>.</p>
      <p>In the US, the Fair Labor Standards Act requires overtime of at least 1.5× the regular rate for non-exempt employees for hours over 40 in a workweek
      (<a href="https://www.dol.gov/agencies/whd/overtime" rel="nofollow noopener">U.S. Department of Labor</a>, 29 U.S.C. § 207; rule in force in 2026). Some states (e.g. California) also require daily overtime, which this calculator does not apply. Pay shown is gross, before taxes.</p>`,
  },
  {
    id: 'concrete',
    name: 'Concrete Calculator',
    cat: 'everyday',
    icon: '🧱',
    desc: 'Concrete volume for slabs, footings, columns and round piers in cubic yards / metres, plus the number of premix bags.',
    keywords: 'concrete calculator cubic yards slab footing column bags of concrete cement volume',
    inputs: [
      { id: 'shape', label: 'Shape', type: 'select', value: 'slab', rerender: true, options: [['slab', 'Slab, footing or wall (rectangular)'], ['round', 'Round column / pier / tube']] },
      { id: 'units', label: 'Units', type: 'select', value: 'us', rerender: true, options: [['us', 'US (feet, inches)'], ['metric', 'Metric (metres, cm)']] },
      { id: 'len', label: 'Length', labelFn: (v) => `Length (${lenU(v)})`, type: 'number', value: 10, showIf: (v) => v.shape !== 'round' },
      { id: 'wid', label: 'Width', labelFn: (v) => `Width (${lenU(v)})`, type: 'number', value: 10, showIf: (v) => v.shape !== 'round' },
      { id: 'thick', label: 'Thickness / depth', labelFn: (v) => `Thickness / depth (${smallU(v)})`, type: 'number', value: 4, showIf: (v) => v.shape !== 'round', help: 'Inches (US) or centimetres (metric). Typical: 4 in (10 cm) patios, 6 in (15 cm) driveways.' },
      { id: 'dia', label: 'Diameter', labelFn: (v) => `Diameter (${smallU(v)})`, type: 'number', value: 12, showIf: (v) => v.shape === 'round' },
      { id: 'height', label: 'Height / depth', labelFn: (v) => `Height / depth (${lenU(v)})`, type: 'number', value: 4, showIf: (v) => v.shape === 'round' },
      { id: 'qty', label: 'Quantity', type: 'number', value: 1 },
      { id: 'waste', label: 'Extra for waste & spillage', type: 'number', value: 10, suffix: '%', help: '5–10% is typical.' },
    ],
    compute(v) {
      const us = v.units !== 'metric';
      const qty = Math.max(Math.round(num(v.qty)), 1);
      let m3; // volume of one item in cubic metres
      if (v.shape === 'round') {
        const r = (num(v.dia) / 2) * (us ? 0.0254 : 0.01);
        const h = num(v.height) * (us ? 0.3048 : 1);
        m3 = Math.PI * r * r * h;
      } else {
        const L = num(v.len) * (us ? 0.3048 : 1);
        const W = num(v.wid) * (us ? 0.3048 : 1);
        const T = num(v.thick) * (us ? 0.0254 : 0.01);
        m3 = L * W * T;
      }
      if (!(m3 > 0)) throw new Error('Enter positive dimensions.');
      const net = m3 * qty;
      const total = net * (1 + Math.max(num(v.waste), 0) / 100);
      const ft3 = total / 0.028316846592;
      const yd3 = ft3 / 27;
      // Premix yields (typical manufacturer figures): 80 lb ≈ 0.60 ft³, 60 lb ≈ 0.45 ft³, 40 lb ≈ 0.30 ft³.
      const perKgM3 = (0.6 * 0.028316846592) / (80 * 0.45359237);
      const bags = us
        ? [['80 lb bags', ceilSafe(ft3 / 0.6)], ['60 lb bags', ceilSafe(ft3 / 0.45)], ['40 lb bags', ceilSafe(ft3 / 0.3)]]
        : [['40 kg bags', ceilSafe(total / (40 * perKgM3))], ['25 kg bags', ceilSafe(total / (25 * perKgM3))], ['20 kg bags', ceilSafe(total / (20 * perKgM3))]];
      return {
        primary: us ? { label: 'Concrete needed', value: yd3, type: 'number2', unit: 'cubic yards' } : { label: 'Concrete needed', value: total, type: 'number2', unit: 'm³' },
        items: [
          us ? { label: 'Cubic metres', value: total, type: 'number2', unit: 'm³' } : { label: 'Cubic yards', value: yd3, type: 'number2', unit: 'yd³' },
          { label: 'Cubic feet', value: ft3, type: 'number1', unit: 'ft³' },
          { label: 'Volume before waste', value: us ? net / 0.764554857984 : net, type: 'number2', unit: us ? 'yd³' : 'm³' },
          ...bags.map(([l, n]) => ({ label: `Premix: ${l}`, value: n, type: 'int' })),
        ],
        note: (us ? yd3 : total) > (us ? 1 : 0.75) ? 'For more than about 1 cubic yard (0.75 m³), ordering ready-mix concrete by truck is usually cheaper than bags.' : undefined,
      };
    },
    about: `<p>Volume = length × width × thickness for slabs, footings and walls, or <code>π × (diameter/2)² × height</code> for round columns, times the quantity, plus a waste allowance.
      1 cubic yard = 27 ft³ = 0.7646 m³.</p>
      <p><b>Example:</b> a 10 ft × 10 ft patio, 4 in thick: 10 × 10 × (4/12) = 33.3 ft³ = <b>1.23 yd³</b> (0.94 m³). Without waste that's 56 bags of 80 lb premix (0.6 ft³ each); with 10% extra, 62.</p>
      <p>Bag yields are typical figures printed on premix bags in the US (80 lb ≈ 0.60 ft³); metric bag counts use the same yield per kg. Check the label of the product you buy.</p>`,
  },
  {
    id: 'tile',
    name: 'Tile Calculator',
    cat: 'everyday',
    icon: '🔲',
    desc: 'How many tiles (and boxes) you need for a floor or wall, including grout gaps, waste and cost.',
    keywords: 'tile calculator floor tiles wall tiles how many tiles boxes grout square feet',
    inputs: [
      { id: 'units', label: 'Units', type: 'select', value: 'us', rerender: true, options: [['us', 'US (feet, inches)'], ['metric', 'Metric (metres, cm)']] },
      { id: 'len', label: 'Area length', labelFn: (v) => `Area length (${lenU(v)})`, type: 'number', value: 12 },
      { id: 'wid', label: 'Area width', labelFn: (v) => `Area width (${lenU(v)})`, type: 'number', value: 10 },
      { id: 'tl', label: 'Tile length', labelFn: (v) => `Tile length (${smallU(v)})`, type: 'number', value: 12 },
      { id: 'tw', label: 'Tile width', labelFn: (v) => `Tile width (${smallU(v)})`, type: 'number', value: 12 },
      { id: 'gap', label: 'Grout gap', labelFn: (v) => `Grout gap (${smallU(v)})`, type: 'number', value: 0.125, help: 'Typical joints: 1/16–1/8 in (2–3 mm, i.e. 0.2–0.3 cm).' },
      { id: 'waste', label: 'Waste allowance', type: 'number', value: 10, suffix: '%', help: '10% for straight layouts, 15% or more for diagonal / herringbone.' },
      { id: 'perBox', label: 'Tiles per box (optional)', type: 'number', value: 10 },
      { id: 'price', label: 'Price per box (optional)', type: 'number', value: 0, money: true },
    ],
    compute(v) {
      const us = v.units !== 'metric';
      const area = num(v.len) * num(v.wid); // ft² or m²
      const toArea = us ? 1 / 144 : 1 / 10000; // in² → ft², cm² → m²
      const g = Math.max(num(v.gap), 0);
      const tileArea = num(v.tl) * num(v.tw) * toArea;
      const cell = (num(v.tl) + g) * (num(v.tw) + g) * toArea;
      if (!(area > 0) || !(tileArea > 0)) throw new Error('Enter positive area and tile dimensions.');
      const exact = area / cell;
      const tiles = ceilSafe(exact * (1 + Math.max(num(v.waste), 0) / 100));
      const perBox = Math.round(num(v.perBox));
      const boxes = perBox > 0 ? Math.ceil(tiles / perBox) : null;
      const items = [
        { label: 'Area to cover', value: area, type: 'number2', unit: us ? 'ft²' : 'm²' },
        { label: 'Tiles without waste', value: ceilSafe(exact), type: 'int' },
        { label: 'Tile coverage (incl. grout)', value: 1 / cell, type: 'number2', unit: us ? 'tiles per ft²' : 'tiles per m²' },
      ];
      if (boxes !== null) items.push({ label: 'Boxes needed', value: boxes, type: 'int' });
      if (boxes !== null && num(v.price) > 0) items.push({ label: 'Estimated cost', value: boxes * num(v.price), type: 'money' });
      return { primary: { label: 'Tiles needed (incl. waste)', value: tiles, type: 'int' }, items };
    },
    about: `<p><code>Tiles = Area ÷ [(tile length + gap) × (tile width + gap)] × (1 + waste %)</code>, rounded up. Each tile effectively covers its own size plus one grout joint.</p>
      <p><b>Example:</b> a 12 ft × 10 ft floor (120 ft²) with 12 × 12 in tiles and no gap needs 120 tiles; with 10% waste, <b>132 tiles</b> — 14 boxes of 10.</p>
      <p>For L-shaped rooms, split the floor into rectangles and add them up (the <a href="../square-footage/">square footage calculator</a> does this). Buy all tiles from the same batch (lot) to avoid colour differences.</p>`,
  },
  {
    id: 'square-footage',
    name: 'Square Footage Calculator',
    cat: 'everyday',
    icon: '📐',
    desc: 'Total square feet (and square metres) of several rooms or areas, with optional cost per square foot.',
    keywords: 'square footage square feet sq ft area of room house flooring square meters cost per square foot',
    inputs: [
      { id: 'units', label: 'Measurements in', type: 'select', value: 'ft', options: [['ft', 'Feet'], ['m', 'Metres'], ['in', 'Inches'], ['yd', 'Yards']] },
      { id: 'rooms', label: 'One area per line: name, length, width', type: 'textarea', value: 'Living room, 18, 14\nBedroom, 12, 11\nKitchen, 12, 10', help: 'Name is optional. For a triangle add "t" (e.g. "Nook, 6, 4, t"); for a circle give one number: "Rug, 8" (diameter).' },
      { id: 'price', label: 'Price per square unit (optional)', type: 'number', value: 0, money: true, help: 'e.g. flooring cost per square foot / metre.' },
    ],
    compute(v) {
      const toFt = { ft: 1, m: 3.280839895, in: 1 / 12, yd: 3 }[v.units] || 1;
      const rows = [];
      let ft2 = 0;
      for (const ln of lines(v.rooms)) {
        const parts = ln.split(/\s*[,;\t]\s*|(?<=\d)\s*[x×*]\s*(?=\d)/i).filter(Boolean);
        const label = Number.isFinite(parseFloat(parts[0])) ? `Area ${rows.length + 1}` : parts.shift();
        const nums = parts.filter((p) => Number.isFinite(parseFloat(p))).map(parseFloat);
        const tri = parts.some((p) => /^t(ri(angle)?)?$/i.test(p));
        let a;
        let shape;
        if (nums.length >= 2) { a = nums[0] * nums[1] * (tri ? 0.5 : 1); shape = tri ? 'Triangle' : 'Rectangle'; } else if (nums.length === 1) { a = Math.PI * (nums[0] / 2) ** 2; shape = 'Circle'; } else throw new Error(`Couldn't read "${ln}". Use: name, length, width`);
        const sqft = a * toFt * toFt;
        ft2 += sqft;
        rows.push([label, shape, sqft, sqft * 0.09290304]);
      }
      if (!rows.length) throw new Error('Enter at least one area.');
      const m2 = ft2 * 0.09290304;
      const price = num(v.price);
      const unitArea = v.units === 'm' ? m2 : ft2;
      const items = [
        { label: 'Square metres', value: m2, type: 'number2', unit: 'm²' },
        { label: 'Square yards', value: ft2 / 9, type: 'number2', unit: 'yd²' },
        { label: 'Acres', value: ft2 / 43560, type: 'number', unit: 'ac' },
      ];
      if (price > 0) items.push({ label: `Cost at ${price} per ${v.units === 'm' ? 'm²' : 'ft²'}`, value: unitArea * price, type: 'money' });
      return {
        primary: { label: 'Total area', value: ft2, type: 'number2', unit: 'sq ft' },
        items,
        table: { title: 'Areas', head: ['Area', 'Shape', 'Sq ft', 'm²'], types: ['text', 'text', 'number2', 'number2'], rows },
      };
    },
    about: `<p>Rectangle: <code>length × width</code>. Triangle: <code>½ × base × height</code>. Circle: <code>π × (diameter / 2)²</code>.
      Split irregular rooms into these shapes and add them up. 1 ft² = 0.09290304 m²; 1 acre = 43,560 ft².</p>
      <p><b>Example:</b> rooms of 18 × 14, 12 × 11 and 12 × 10 ft = 252 + 132 + 120 = <b>504 ft²</b> (46.82 m²). At $4.50/ft² for flooring that is $2,268 — add 5–10% for waste.</p>`,
  },
  {
    id: 'final-grade',
    name: 'Final Grade Calculator',
    cat: 'everyday',
    icon: '📝',
    desc: 'What score do I need on my final exam? Find the grade needed to reach your target course grade.',
    keywords: 'final grade calculator final exam score needed what do i need on my final grade needed',
    inputs: [
      { id: 'current', label: 'Current grade', type: 'number', value: 85, suffix: '%' },
      { id: 'target', label: 'Grade you want', type: 'number', value: 90, suffix: '%' },
      { id: 'weight', label: 'Final exam weight', type: 'number', value: 25, suffix: '%', help: 'Share of the course grade that the final exam is worth.' },
    ],
    compute(v) {
      const cur = num(v.current);
      const tgt = num(v.target);
      const w = num(v.weight) / 100;
      if (w <= 0 || w > 1) throw new Error('Final exam weight must be between 0 and 100%.');
      const need = (g) => (g - cur * (1 - w)) / w;
      const r = need(tgt);
      const badge = r > 100 ? 'Above 100% — not reachable without extra credit' : r <= 0 ? 'Already secured — even 0% on the final reaches it' : r > 90 ? 'Challenging' : undefined;
      const rows = [['A', 90], ['B', 80], ['C', 70], ['D', 60]].map(([l, g]) => [`${l} (${g}%)`, need(g)]);
      return {
        primary: { label: 'Score needed on the final', value: r, type: 'percent', badge },
        items: [
          { label: 'Grade if you score 100%', value: cur * (1 - w) + 100 * w, type: 'percent' },
          { label: 'Grade if you score 0%', value: cur * (1 - w), type: 'percent' },
          { label: 'Grade if you match your current grade', value: cur, type: 'percent' },
        ],
        table: { title: 'Score needed for each letter grade (90/80/70/60 scale)', head: ['Course grade', 'Final exam score needed'], types: ['text', 'percent'], rows },
      };
    },
    about: `<p>The course grade is <code>current × (1 − w) + final × w</code>, where w is the final's weight. Solving for the final:
      <code>Required = (Target − Current × (1 − w)) / w</code>.</p>
      <p><b>Example:</b> current grade 85%, target 90%, final worth 25%: (90 − 85 × 0.75) / 0.25 = <b>105%</b> — out of reach. For an 80%: (80 − 63.75) / 0.25 = 65%.</p>
      <p>"Current grade" must be your weighted grade on everything except the final. If your course uses points rather than percentages, convert first, or use the <a href="../weighted-average/">weighted average calculator</a>.</p>`,
  },
];
