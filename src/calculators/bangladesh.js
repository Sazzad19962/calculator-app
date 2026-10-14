// Bangladesh-specific calculators (income tax, savings certificates, FDR/DPS, gold, electricity,
// government pension and GPF). Rates are kept in the constant tables below so they are easy to
// update when the Finance Act, NSD notifications, BERC orders or Finance Division circulars change.
// Last reviewed: October 2026 (FY 2026-27).
import { num } from '../util.js';

const lakh = (n) => n * 100000;
const fmtTk = (n) => `Tk ${Math.round(n).toLocaleString('en-IN')}`;

const DISCLAIMER = `<p class="disclaimer"><strong>Disclaimer:</strong> this calculator is an estimate for general guidance
  only and is not legal, tax or financial advice. Rates are reviewed periodically but government notifications can change at
  short notice. Always confirm with the official source, your bank, the National Savings office, your utility or your
  Accounts office before acting.</p>`;

/* ------------------------------------------------------------------ */
/* 1. Income tax                                                       */
/* ------------------------------------------------------------------ */

/**
 * Individual income tax rules by income year.
 * - Income year 2025-26 (assessment year 2026-27): Finance Ordinance 2025 / Income Tax Act 2023.
 * - Income year 2026-27 (assessment year 2027-28): Finance Act 2026 (passed 29 June 2026, effective 1 July 2026).
 */
export const TAX_YEARS = {
  '2025-26': {
    label: 'Income year 2025-26 (AY 2026-27, return due 30 Nov 2026)',
    thresholds: { general: 350000, woman: 400000, senior: 400000, disabled: 475000, third: 475000, ff: 500000 },
    // [band width, rate %] after the tax-free threshold; the remainder is taxed at `top`.
    bands: [[100000, 5], [400000, 10], [500000, 15], [500000, 20], [2000000, 25]],
    top: 30,
    minTax: { dhaka: 5000, city: 4000, other: 3000 },
    newMinTax: 1000,
    rebate: { investPct: 15, incomePct: 3, cap: 1000000 },
    salaryExempt: 500000,
  },
  '2026-27': {
    label: 'Income year 2026-27 (AY 2027-28, current FY)',
    thresholds: { general: 400000, woman: 450000, senior: 450000, disabled: 525000, third: 525000, ff: 550000 },
    bands: [[300000, 10], [400000, 15], [500000, 20], [2000000, 25]],
    top: 30,
    minTax: { dhaka: 5000, city: 5000, other: 5000 },
    newMinTax: 1000,
    rebate: { investPct: 10, incomePct: 3, cap: 750000 },
    salaryExempt: 500000,
  },
};

export const DISABLED_CHILD_ALLOWANCE = 50000;

/** Pure Bangladesh individual income tax computation. */
export function bdIncomeTax({ year = '2025-26', category = 'general', disabledChildren = 0, income = 0, investment = 0, area = 'dhaka', newTaxpayer = false }) {
  const Y = TAX_YEARS[year];
  if (!Y) throw new Error('Unknown income year.');
  const base = Y.thresholds[category];
  if (base === undefined) throw new Error('Unknown taxpayer category.');
  const threshold = base + DISABLED_CHILD_ALLOWANCE * Math.max(0, Math.floor(disabledChildren));
  income = Math.max(0, income);
  const bands = [[threshold, 0], ...Y.bands, [Infinity, Y.top]];
  let rem = income;
  let gross = 0;
  let from = 0;
  const slabs = [];
  for (const [width, rate] of bands) {
    const amt = Math.min(Math.max(rem, 0), width);
    const tax = amt * rate / 100;
    slabs.push({ from, to: width === Infinity ? Infinity : from + width, rate, amount: amt, tax });
    gross += tax;
    rem -= amt;
    from += width;
  }
  const R = Y.rebate;
  const rebateLimit = Math.min(Math.max(investment, 0) * R.investPct / 100, income * R.incomePct / 100, R.cap);
  const rebate = Math.min(rebateLimit, gross);
  const afterRebate = gross - rebate;
  const taxable = income > threshold;
  const minTax = taxable ? (newTaxpayer ? Y.newMinTax : Y.minTax[area] ?? Y.minTax.other) : 0;
  const payable = taxable ? Math.max(afterRebate, minTax) : 0;
  return { threshold, slabs, gross, rebate, rebateLimit, afterRebate, minTax, minApplied: taxable && minTax > afterRebate, payable };
}

const incomeTax = {
  id: 'bd-income-tax',
  name: 'Bangladesh Income Tax Calculator',
  cat: 'bangladesh',
  currency: 'BDT', // Taka-denominated rules: always show ৳ regardless of the visitor's currency setting
  icon: '🧾',
  desc: 'Calculate individual income tax in Bangladesh for AY 2026-27 and FY 2026-27: tax-free threshold by category, slab-by-slab tax, investment rebate and minimum tax.',
  keywords: 'bangladesh income tax calculator nbr tax slab return rebate salary tin আয়কর কর হিসাব করমুক্ত আয়সীমা রিটার্ন বিনিয়োগ রেয়াত ২০২৬-২৭',
  inputs: [
    { id: 'year', label: 'Income year', type: 'select', value: '2025-26', options: Object.entries(TAX_YEARS).map(([k, y]) => [k, y.label]), help: 'Returns filed by 30 November 2026 are for income year 2025-26 (assessment year 2026-27).' },
    { id: 'category', label: 'Taxpayer category', type: 'select', value: 'general', options: [
      ['general', 'General (male, under 65)'], ['woman', 'Woman'], ['senior', 'Aged 65 or above'], ['disabled', 'Person with disability'],
      ['third', 'Third gender'], ['ff', 'Gazetted war-wounded freedom fighter / gazetted July warrior']],
    help: 'Determines your tax-free income threshold.' },
    { id: 'disabledChildren', label: 'Dependent children/wards with disability', type: 'number', value: 0, min: 0, help: 'Parents/guardians get Tk 50,000 extra threshold for each (only one parent may claim).' },
    { id: 'salary', label: 'Annual salary income (gross)', type: 'number', value: 900000, money: true, help: 'Total of basic, allowances and bonuses for the year.' },
    { id: 'salaryExempt', label: 'Apply salary exemption (1/3 of salary, max Tk 5,00,000)', type: 'checkbox', value: true },
    { id: 'other', label: 'Other taxable income', type: 'number', value: 0, money: true, help: 'Business, house rent, interest (gross), etc. Exclude income taxed under final settlement.' },
    { id: 'investment', label: 'Eligible investment & donation', type: 'number', value: 100000, money: true, help: 'Sanchayapatra, DPS (up to Tk 1.2 lakh/yr), GPF/PF contribution, life insurance premium, listed shares/mutual funds, approved donations, etc.' },
    { id: 'area', label: 'Location (for minimum tax)', type: 'select', value: 'dhaka', options: [['dhaka', 'Dhaka / Chattogram city corporation'], ['city', 'Other city corporation'], ['other', 'Elsewhere']] },
    { id: 'newTaxpayer', label: 'First-time taxpayer (minimum tax Tk 1,000)', type: 'checkbox', value: false },
    { id: 'paid', label: 'Tax already paid (TDS / AIT / advance)', type: 'number', value: 0, money: true, help: 'Tax deducted from salary, bank interest, savings certificates, vehicle AIT, etc.' },
  ],
  compute(v) {
    const Y = TAX_YEARS[v.year] || TAX_YEARS['2025-26'];
    const salary = Math.max(0, num(v.salary));
    const exempt = v.salaryExempt ? Math.min(salary / 3, Y.salaryExempt) : 0;
    const income = salary - exempt + Math.max(0, num(v.other));
    const r = bdIncomeTax({
      year: v.year in TAX_YEARS ? v.year : '2025-26', category: v.category, disabledChildren: num(v.disabledChildren),
      income, investment: num(v.investment), area: v.area, newTaxpayer: Boolean(v.newTaxpayer),
    });
    const paid = Math.max(0, num(v.paid));
    const balance = r.payable - paid;
    const items = [
      { label: 'Total taxable income', value: income, type: 'money' },
      { label: 'Salary exemption', value: exempt, type: 'money' },
      { label: 'Tax-free threshold', value: r.threshold, type: 'money' },
      { label: 'Gross tax on slabs', value: r.gross, type: 'money' },
      { label: 'Investment rebate', value: r.rebate, type: 'money' },
      { label: 'Minimum tax for you', value: r.minTax, type: 'money' },
      { label: 'Effective tax rate', value: income ? r.payable / income * 100 : 0, type: 'percent' },
      { label: 'Monthly tax (÷12)', value: r.payable / 12, type: 'money' },
      { label: balance >= 0 ? 'Balance payable with return' : 'Refundable / excess paid', value: Math.abs(balance), type: 'money' },
    ];
    const notes = [];
    if (income <= r.threshold) notes.push('Your income is within the tax-free threshold — no tax is payable, but you may still need to file a return (e.g. if you hold a TIN).');
    if (r.minApplied) notes.push(`Minimum tax of ${fmtTk(r.minTax)} applies because your computed tax after rebate is lower.`);
    if (r.rebate < r.rebateLimit) notes.push('Rebate is limited to the tax on slabs.');
    const R = Y.rebate;
    notes.push(`Rebate = lowest of ${R.investPct}% of eligible investment, ${R.incomePct}% of taxable income and ${fmtTk(R.cap)}.`);
    return {
      primary: { label: 'Income tax payable', value: r.payable, type: 'money', badge: r.payable ? `${(income ? r.payable / income * 100 : 0).toFixed(2)}% effective` : 'No tax' },
      items,
      note: notes.join(' '),
      chart: { type: 'donut', data: [{ label: 'Income after tax', value: Math.max(income - r.payable, 0) }, { label: 'Income tax', value: r.payable }] },
      table: {
        title: 'Slab-by-slab tax computation',
        head: ['Income slab', 'Rate', 'Income in slab', 'Tax'],
        types: ['text', 'percent', 'money', 'money'],
        rows: r.slabs.map((s, i) => [
          i === 0 ? `First ${fmtTk(s.to)}` : s.to === Infinity ? `Above ${fmtTk(s.from)}` : `Next ${fmtTk(s.to - s.from)}`,
          s.rate, s.amount, s.tax,
        ]),
      },
    };
  },
  about: `<p>Computes personal income tax under the <strong>Income Tax Act 2023</strong> for resident individuals. Choose the
    income year: <strong>2025-26</strong> (assessment year 2026-27 — the return you file by <strong>30 November 2026</strong>) uses
    the Finance Ordinance 2025 rates; <strong>2026-27</strong> (current fiscal year, return due in 2027) uses the
    <strong>Finance Act 2026</strong>, passed by the Jatiya Sangsad on 29 June 2026.</p>
    <h3>Tax-free threshold</h3>
    <table><thead><tr><th>Category</th><th>IY 2025-26</th><th>IY 2026-27</th></tr></thead><tbody>
    <tr><td>General</td><td>Tk 3,50,000</td><td>Tk 4,00,000</td></tr>
    <tr><td>Women and persons aged 65+</td><td>Tk 4,00,000</td><td>Tk 4,50,000</td></tr>
    <tr><td>Persons with disability, third gender</td><td>Tk 4,75,000</td><td>Tk 5,25,000</td></tr>
    <tr><td>Gazetted war-wounded freedom fighters / July warriors</td><td>Tk 5,00,000</td><td>Tk 5,50,000</td></tr>
    </tbody></table>
    <p>Parents or legal guardians of a person with disability get a further Tk 50,000 per child/ward.</p>
    <h3>Slabs</h3>
    <p><strong>IY 2025-26:</strong> threshold 0%, next Tk 1 lakh 5%, next Tk 4 lakh 10%, next Tk 5 lakh 15%, next Tk 5 lakh 20%,
    next Tk 20 lakh 25%, rest 30%.<br><strong>IY 2026-27:</strong> the 5% slab is abolished — threshold 0%, next Tk 3 lakh 10%,
    next Tk 4 lakh 15%, next Tk 5 lakh 20%, next Tk 20 lakh 25%, rest 30%.</p>
    <h3>Investment rebate &amp; minimum tax</h3>
    <p>Rebate is the <em>lowest</em> of 3% of taxable income, 15% of eligible investment (10% from IY 2026-27) and
    Tk 10 lakh (Tk 7.5 lakh from IY 2026-27). If your income exceeds the threshold you pay at least the minimum tax:
    for IY 2025-26 Tk 5,000 in Dhaka and Chattogram city corporations, Tk 4,000 in other city corporations and Tk 3,000
    elsewhere; from IY 2026-27 a flat Tk 5,000 everywhere. First-time taxpayers pay a minimum of Tk 1,000.</p>
    <p>Not covered: net-wealth surcharge, income taxed at reduced/final rates (e.g. capital gains on listed shares),
    non-resident rates and the early-filing incentive.</p>
    <p>Sources: National Board of Revenue (<a href="https://nbr.gov.bd" rel="nofollow noopener">nbr.gov.bd</a>) — Income Tax Act 2023,
    Finance Ordinance 2025, Finance Act 2026 (Ministry of Finance budget documents, <a href="https://mof.gov.bd" rel="nofollow noopener">mof.gov.bd</a>).
    Category thresholds for IY 2026-27 reflect the enacted Finance Act as reported in June 2026 — check the official gazette.</p>
    ${DISCLAIMER}`,
};

/* ------------------------------------------------------------------ */
/* 2. Sanchayapatra (National Savings Certificates)                    */
/* ------------------------------------------------------------------ */

/** Rates effective 1 July 2025, kept unchanged for Jan–Jun 2026 and Jul–Dec 2026 (Finance Division / NSD). */
export const SANCHAYAPATRA = {
  bsp5: { name: '5-year Bangladesh Sanchayapatra', r1: 11.83, r2: 11.80, years: 5, perYear: 0, limit: lakh(30) },
  q3: { name: '3-month profit-based Sanchayapatra', r1: 11.82, r2: 11.77, years: 3, perYear: 4, limit: lakh(30) },
  paribar: { name: 'Paribar Sanchayapatra (Family)', r1: 11.93, r2: 11.80, years: 5, perYear: 12, limit: lakh(45) },
  pensioner: { name: 'Pensioner Sanchayapatra', r1: 11.98, r2: 11.80, years: 5, perYear: 4, limit: lakh(50) },
};
export const SP_SLAB = lakh(7.5);

/** Profit schedule for a savings certificate. */
export function sanchayapatra({ scheme = 'bsp5', amount = 0, existing = 0, tds = 10 }) {
  const S = SANCHAYAPATRA[scheme];
  if (!S) throw new Error('Unknown scheme.');
  const P = Math.max(0, amount);
  const rate = P + Math.max(0, existing) <= SP_SLAB ? S.r1 : S.r2;
  const n = S.perYear ? S.years * S.perYear : 1;
  const per = S.perYear ? P * rate / 100 / S.perYear : P * rate / 100 * S.years;
  const perTds = per * tds / 100;
  const payouts = Array.from({ length: n }, (_, i) => ({ no: i + 1, month: S.perYear ? (i + 1) * 12 / S.perYear : S.years * 12, gross: per, tds: perTds, net: per - perTds }));
  const gross = per * n;
  return { rate, per, perTds, perNet: per - perTds, n, gross, tdsTotal: perTds * n, net: gross - perTds * n, payouts, S };
}

const sanchayapatraCalc = {
  id: 'bd-sanchayapatra',
  name: 'Sanchayapatra Profit Calculator',
  cat: 'bangladesh',
  currency: 'BDT', // Taka-denominated rules: always show ৳ regardless of the visitor's currency setting
  icon: '📜',
  desc: 'National Savings Certificate profit calculator for Bangladesh: 5-year, 3-month, Paribar and Pensioner Sanchayapatra with current rates, source tax and monthly/quarterly payouts.',
  keywords: 'sanchayapatra savings certificate national savings paribar pensioner family 3 month profit nsd সঞ্চয়পত্র পরিবার সঞ্চয়পত্র পেনশনার সঞ্চয়পত্র মুনাফা তিন মাস অন্তর',
  inputs: [
    { id: 'scheme', label: 'Scheme', type: 'select', value: 'paribar', options: Object.entries(SANCHAYAPATRA).map(([k, s]) => [k, s.name]),
      help: 'Paribar: women 18+, persons with disability and men/women 65+. Pensioner: retired government employees and family pensioners.' },
    { id: 'amount', label: 'Investment amount', type: 'number', value: 1000000, money: true },
    { id: 'existing', label: 'Sanchayapatra you already hold', type: 'number', value: 0, money: true, help: 'The lower rate applies when your total investment exceeds Tk 7.5 lakh.' },
    { id: 'tds', label: 'Source tax (TDS) on profit', type: 'number', value: 10, suffix: '%', step: 0.5, help: 'Finance Act 2026: 10% advance tax on all savings-certificate profit (earlier: 5% up to Tk 5 lakh).' },
  ],
  compute(v) {
    const r = sanchayapatra({ scheme: v.scheme in SANCHAYAPATRA ? v.scheme : 'bsp5', amount: num(v.amount), existing: num(v.existing), tds: num(v.tds) });
    const S = r.S;
    const freq = S.perYear === 12 ? 'Monthly' : S.perYear === 4 ? 'Quarterly' : 'At maturity';
    const notes = [];
    if (num(v.amount) > S.limit) notes.push(`Note: the single-name investment limit for this scheme is ${fmtTk(S.limit)} (double for joint names where allowed); the overall ceiling across schemes is Tk 50 lakh single / Tk 1 crore joint.`);
    if (num(v.amount) > lakh(5)) notes.push('Investments above Tk 5 lakh need proof of return submission (PSR).');
    if (!S.perYear) notes.push('Profit is paid in one lump sum at maturity (simple interest). Encashing early earns lower rates.');
    return {
      primary: { label: S.perYear ? `${freq} profit (after tax)` : 'Profit at maturity (after tax)', value: r.perNet, type: 'money', badge: `${r.rate}% p.a.` },
      items: [
        { label: 'Profit rate applied', value: r.rate, type: 'percent' },
        { label: `${freq} profit before tax`, value: r.per, type: 'money' },
        { label: 'Source tax per payout', value: r.perTds, type: 'money' },
        { label: 'Number of payouts', value: r.n, type: 'int' },
        { label: 'Total profit before tax', value: r.gross, type: 'money' },
        { label: 'Total source tax', value: r.tdsTotal, type: 'money' },
        { label: 'Total net profit', value: r.net, type: 'money' },
        { label: 'Total received (principal + net profit)', value: num(v.amount) + r.net, type: 'money' },
        { label: 'Average monthly income (net)', value: r.net / (S.years * 12), type: 'money' },
      ],
      note: notes.join(' '),
      chart: { type: 'donut', data: [{ label: 'Principal', value: num(v.amount) }, { label: 'Net profit', value: r.net }, { label: 'Source tax', value: r.tdsTotal }] },
      table: {
        title: 'Payout schedule',
        head: ['#', 'Month', 'Gross profit', 'Source tax', 'Net profit'],
        types: ['int', 'int', 'money', 'money', 'money'],
        rows: r.payouts.map((p) => [p.no, p.month, p.gross, p.tds, p.net]),
      },
    };
  },
  about: `<p>Profit rates are those set by the Finance Division (Internal Resources Division) and administered by the
    <strong>Department of National Savings</strong>. Rates effective from 1 July 2025 were kept unchanged for January–June 2026
    and again for <strong>July–December 2026</strong> (notification of 2 July 2026). Since 2025 each scheme has two slabs:
    a higher rate when your total investment is up to Tk 7.5 lakh, and a lower one above that.</p>
    <table><thead><tr><th>Scheme</th><th>Up to Tk 7.5 lakh</th><th>Above Tk 7.5 lakh</th><th>Term / payout</th></tr></thead><tbody>
    <tr><td>5-year Bangladesh Sanchayapatra</td><td>11.83%</td><td>11.80%</td><td>5 yrs, at maturity</td></tr>
    <tr><td>3-month profit-based</td><td>11.82%</td><td>11.77%</td><td>3 yrs, quarterly</td></tr>
    <tr><td>Paribar Sanchayapatra</td><td>11.93%</td><td>11.80%</td><td>5 yrs, monthly</td></tr>
    <tr><td>Pensioner Sanchayapatra</td><td>11.98%</td><td>11.80%</td><td>5 yrs, quarterly</td></tr></tbody></table>
    <p>Payout = principal × rate ÷ payouts per year. Under the <strong>Finance Act 2026 (FY 2026-27)</strong> source tax on
    savings-certificate profit is a flat 10% and is treated as adjustable advance tax — the profit is added to your total
    income and taxed at slab rates in your return, with the 10% credited. Rates for premature encashment are lower and not
    modelled here.</p>
    <p>Sources: Department of National Savings (<a href="https://nationalsavings.gov.bd" rel="nofollow noopener">nationalsavings.gov.bd</a>),
    Finance Division, Ministry of Finance; Finance Act 2026 (NBR).</p>${DISCLAIMER}`,
};

/* ------------------------------------------------------------------ */
/* 3. FDR & DPS                                                        */
/* ------------------------------------------------------------------ */

/** Bank account excise duty (Excise and Salt Act), based on the highest balance in a calendar year. FY 2026-27 slabs. */
export const EXCISE_SLABS = [
  [lakh(4), 0], [lakh(5), 150], [lakh(10), 500], [lakh(50), 3000], [lakh(100), 5000], [lakh(200), 10000], [lakh(500), 20000], [Infinity, 50000],
];
export function exciseDuty(balance) {
  for (const [upTo, duty] of EXCISE_SLABS) if (balance <= upTo) return duty;
  return 0;
}

const tinOptions = [['10', 'Yes — 10% source tax'], ['15', 'No — 15% source tax']];

/** FDR simulation: interest accrues monthly and is credited every `period` months (0 = simple, at maturity; -1 = paid out monthly). */
export function fdr({ amount, rate, months, period = 0, tds = 10 }) {
  const P = Math.max(0, amount);
  const r = rate / 100 / 12;
  let bal = P;
  let accrued = 0;
  let grossInt = 0;
  let tdsTotal = 0;
  let paidOut = 0;
  let excise = 0;
  let yearMax = bal;
  const rows = [];
  let yInt = 0;
  for (let m = 1; m <= months; m++) {
    accrued += bal * r;
    const credit = period === -1 || m === months || (period > 0 && m % period === 0);
    if (credit) {
      const t = accrued * tds / 100;
      grossInt += accrued;
      yInt += accrued;
      tdsTotal += t;
      if (period === -1) paidOut += accrued - t;
      else bal += accrued - t;
      accrued = 0;
    }
    yearMax = Math.max(yearMax, bal);
    if (m % 12 === 0 || m === months) {
      const d = exciseDuty(yearMax);
      excise += d;
      rows.push([Math.ceil(m / 12), yInt, d, bal]);
      yInt = 0;
      yearMax = bal;
    }
  }
  return { grossInt, tdsTotal, excise, paidOut, maturity: bal - excise, netGain: bal - P + paidOut - excise, rows };
}

/** DPS: deposit at the start of each month, interest compounded every `period` months, source tax at maturity. */
export function dps({ monthly, rate, years, period = 1, tds = 10 }) {
  const D = Math.max(0, monthly);
  const n = Math.round(years * 12);
  const r = rate / 100 / 12;
  let bal = 0;
  let accrued = 0;
  let excise = 0;
  const rows = [];
  let yInt = 0;
  let totalInt = 0;
  for (let m = 1; m <= n; m++) {
    bal += D;
    const i = bal * r;
    accrued += i;
    yInt += i;
    totalInt += i;
    if (m % period === 0 || m === n) { bal += accrued; accrued = 0; }
    if (m % 12 === 0 || m === n) {
      const d = exciseDuty(bal);
      excise += d;
      rows.push([Math.ceil(m / 12), D * m, yInt, d, bal]);
      yInt = 0;
    }
  }
  const tdsAmt = totalInt * tds / 100;
  return { deposits: D * n, interest: totalInt, tds: tdsAmt, excise, gross: bal, net: bal - tdsAmt - excise, rows };
}

const fdrCalc = {
  id: 'bd-fdr',
  name: 'FDR Calculator Bangladesh',
  cat: 'bangladesh',
  currency: 'BDT', // Taka-denominated rules: always show ৳ regardless of the visitor's currency setting
  icon: '🏦',
  desc: 'Fixed Deposit Receipt (FDR) maturity and monthly income calculator for Bangladeshi banks, with source tax (10%/15%) and yearly excise duty.',
  keywords: 'fdr fixed deposit term deposit bank interest monthly income scheme excise duty source tax tds এফডিআর স্থায়ী আমানত ব্যাংক সুদ আবগারি শুল্ক',
  inputs: [
    { id: 'amount', label: 'Deposit amount', type: 'number', value: 500000, money: true },
    { id: 'rate', label: 'Interest rate (yearly)', type: 'number', value: 10, suffix: '%', step: 0.01, help: 'Check your bank\'s current FDR rate card.' },
    { id: 'months', label: 'Tenure', type: 'select', value: '12', options: [['3', '3 months'], ['6', '6 months'], ['12', '1 year'], ['24', '2 years'], ['36', '3 years'], ['60', '5 years']] },
    { id: 'period', label: 'Interest handling', type: 'select', value: '0', options: [
      ['0', 'Paid at maturity (simple)'], ['3', 'Auto-renewed every 3 months (compounded)'], ['6', 'Auto-renewed every 6 months'], ['12', 'Auto-renewed yearly'], ['-1', 'Paid out monthly (monthly income)']] },
    { id: 'tin', label: 'Do you have a TIN / return proof?', type: 'select', value: '10', options: tinOptions },
  ],
  compute(v) {
    const months = Math.max(1, Math.round(num(v.months)));
    const period = Math.round(num(v.period));
    const r = fdr({ amount: num(v.amount), rate: num(v.rate), months, period, tds: num(v.tin) || 10 });
    const monthlyIncome = period === -1;
    const items = [
      { label: 'Gross interest', value: r.grossInt, type: 'money' },
      { label: `Source tax (${num(v.tin) || 10}%)`, value: r.tdsTotal, type: 'money' },
      { label: 'Excise duty (bank)', value: r.excise, type: 'money' },
      { label: 'Net gain', value: r.netGain, type: 'money' },
      { label: 'Effective yearly return (after tax)', value: num(v.amount) ? r.netGain / num(v.amount) / (months / 12) * 100 : 0, type: 'percent' },
    ];
    if (monthlyIncome) items.unshift({ label: 'Principal returned at maturity', value: r.maturity, type: 'money' });
    return {
      primary: monthlyIncome
        ? { label: 'Monthly income (after tax)', value: r.paidOut / months, type: 'money' }
        : { label: 'Maturity amount (after tax & duty)', value: r.maturity, type: 'money' },
      items,
      chart: { type: 'donut', data: [{ label: 'Principal', value: num(v.amount) }, { label: 'Net interest', value: Math.max(r.netGain, 0) }, { label: 'Tax & duty', value: r.tdsTotal + r.excise }] },
      table: { title: 'Year by year', head: ['Year', 'Interest', 'Excise duty', 'Balance'], types: ['int', 'money', 'money', 'money'], rows: r.rows },
    };
  },
  about: `<p>Interest accrues monthly at the yearly rate ÷ 12 and is credited at maturity, at each auto-renewal (compounding) or
    paid out monthly. Banks deduct <strong>source tax</strong> on interest under section 102 of the Income Tax Act 2023:
    <strong>10%</strong> if you have a TIN / proof of return, <strong>15%</strong> otherwise (companies, trusts and AOPs: 20%).
    This tax is adjustable against your final tax liability.</p>
    <p><strong>Excise duty</strong> is charged once per calendar year on each account, based on the highest balance at any time
    in the year. From FY 2026-27 (Finance Act 2026) balances up to Tk 4 lakh are exempt (was Tk 3 lakh); above that:
    Tk 150 (to Tk 5 lakh), Tk 500 (to Tk 10 lakh), Tk 3,000 (to Tk 50 lakh), Tk 5,000 (to Tk 1 crore), Tk 10,000 (to Tk 2 crore),
    Tk 20,000 (to Tk 5 crore) and Tk 50,000 above Tk 5 crore. This calculator applies duty for each 12-month block of the tenure.</p>
    <p>Sources: NBR (Income Tax Act 2023, Finance Act 2026), Bangladesh Bank; your bank's schedule of charges.</p>${DISCLAIMER}`,
};

const dpsCalc = {
  id: 'bd-dps',
  name: 'DPS Calculator Bangladesh',
  cat: 'bangladesh',
  currency: 'BDT', // Taka-denominated rules: always show ৳ regardless of the visitor's currency setting
  icon: '🐖',
  desc: 'Deposit Pension Scheme (DPS) maturity calculator for Bangladeshi banks with monthly deposits, compounding, source tax and excise duty.',
  keywords: 'dps deposit pension scheme monthly savings bank recurring deposit maturity ডিপিএস মাসিক সঞ্চয় স্কিম',
  inputs: [
    { id: 'monthly', label: 'Monthly instalment', type: 'number', value: 5000, money: true },
    { id: 'rate', label: 'Interest rate (yearly)', type: 'number', value: 9, suffix: '%', step: 0.01 },
    { id: 'years', label: 'Term', type: 'select', value: '5', options: [['3', '3 years'], ['5', '5 years'], ['7', '7 years'], ['10', '10 years'], ['12', '12 years'], ['15', '15 years']] },
    { id: 'period', label: 'Compounding', type: 'select', value: '1', options: [['1', 'Monthly'], ['3', 'Quarterly'], ['6', 'Half-yearly'], ['12', 'Yearly']], help: 'See your bank\'s DPS rules; most compound monthly or quarterly.' },
    { id: 'tin', label: 'Do you have a TIN / return proof?', type: 'select', value: '10', options: tinOptions },
  ],
  compute(v) {
    const years = Math.max(1, num(v.years));
    const r = dps({ monthly: num(v.monthly), rate: num(v.rate), years, period: Math.max(1, Math.round(num(v.period))), tds: num(v.tin) || 10 });
    return {
      primary: { label: 'Maturity amount (after tax & duty)', value: r.net, type: 'money' },
      items: [
        { label: 'Total deposits', value: r.deposits, type: 'money' },
        { label: 'Gross interest', value: r.interest, type: 'money' },
        { label: 'Maturity before deductions', value: r.gross, type: 'money' },
        { label: `Source tax (${num(v.tin) || 10}%)`, value: r.tds, type: 'money' },
        { label: 'Excise duty (all years)', value: r.excise, type: 'money' },
        { label: 'Net interest earned', value: r.net - r.deposits, type: 'money' },
      ],
      note: 'DPS instalments up to Tk 1,20,000 a year count as eligible investment for the income tax rebate.',
      chart: { type: 'stacked', legend: ['Deposits', 'Interest'], data: r.rows.map((row) => ({ label: `Y${row[0]}`, value: row[4], parts: [row[1], Math.max(row[4] - row[1], 0)] })) },
      table: { title: 'Year by year', head: ['Year', 'Deposited', 'Interest this year', 'Excise duty', 'Balance'], types: ['int', 'money', 'money', 'money', 'money'], rows: r.rows },
    };
  },
  about: `<p>Each instalment is deposited at the start of the month; interest accrues monthly on the running balance at the
    yearly rate ÷ 12 and is added to the balance at the chosen compounding interval. With monthly compounding this equals
    <code>FV = D × ((1+i)<sup>n</sup> − 1) / i × (1+i)</code>.</p>
    <p>Source tax on interest (10% with TIN / return proof, 15% without — Income Tax Act 2023, s.102) is deducted at maturity.
    Excise duty is charged once per calendar year based on the highest balance: nil up to Tk 4 lakh from FY 2026-27, then
    Tk 150, 500, 3,000 … (see the FDR calculator for all slabs). Banks may round or credit interest differently, so your
    bank's maturity table can differ slightly.</p>
    <p>Sources: NBR (Income Tax Act 2023, Finance Act 2026), Bangladesh Bank.</p>${DISCLAIMER}`,
};

/* ------------------------------------------------------------------ */
/* 4. Gold / silver                                                    */
/* ------------------------------------------------------------------ */

export const VORI_G = 11.664; // 1 vori (bhori/tola) as used by BAJUS
export const ANA_G = VORI_G / 16; // 0.729 g
export const RATI_G = ANA_G / 6; // 0.1215 g
export const POINT_G = RATI_G / 10; // 0.01215 g

export function toGrams({ vori = 0, ana = 0, rati = 0, point = 0 }) {
  return vori * VORI_G + ana * ANA_G + rati * RATI_G + point * POINT_G;
}

export function fromGrams(g) {
  let pts = Math.round(g / POINT_G * 100) / 100;
  const vori = Math.floor(pts / 960); pts -= vori * 960;
  const ana = Math.floor(pts / 60); pts -= ana * 60;
  const rati = Math.floor(pts / 10); pts -= rati * 10;
  return { vori, ana, rati, point: Math.round(pts * 100) / 100 };
}

export function goldPrice({ grams, pricePerVori, makingPct = 0, makingFlat = 0, vatPct = 5, vatOnMaking = false }) {
  const metal = grams / VORI_G * pricePerVori;
  const making = metal * makingPct / 100 + makingFlat;
  const vat = (metal + (vatOnMaking ? making : 0)) * vatPct / 100;
  return { metal, making, vat, total: metal + making + vat };
}

const isGold = (s) => s.metal !== 'silver';
const isVori = (s) => s.unit !== 'gram';
const goldCalc = {
  id: 'bd-gold-price',
  name: 'Gold Price Calculator (Vori / Gram)',
  cat: 'bangladesh',
  currency: 'BDT', // Taka-denominated rules: always show ৳ regardless of the visitor's currency setting
  icon: '🪙',
  desc: 'Calculate gold or silver jewellery price in Bangladesh by vori, ana, rati, point or grams for 22K, 21K, 18K and traditional gold, with making charge and 5% VAT.',
  keywords: 'gold price bangladesh vori bhori tola ana rati gram 22 karat 21 karat 18 karat silver bajus jewellery making charge সোনার দাম স্বর্ণের দাম ভরি আনা রতি রুপা গহনা মজুরি',
  inputs: [
    { id: 'metal', label: 'Metal', type: 'select', value: 'gold', rerender: true, options: [['gold', 'Gold (স্বর্ণ)'], ['silver', 'Silver (রুপা)']] },
    { id: 'karat', label: 'Purity', type: 'select', value: '22', rerender: true, options: [['22', '22 karat'], ['21', '21 karat'], ['18', '18 karat'], ['trad', 'Traditional (সনাতন)']], showIf: isGold },
    { id: 'p22', label: '22K price per vori', type: 'number', value: 228031, money: true, showIf: (s) => isGold(s) && s.karat === '22', help: 'BAJUS rate announced 13 Oct 2026 — update with today\'s rate.' },
    { id: 'p21', label: '21K price per vori', type: 'number', value: 217767, money: true, showIf: (s) => isGold(s) && s.karat === '21', help: 'BAJUS rate announced 13 Oct 2026 — update with today\'s rate.' },
    { id: 'p18', label: '18K price per vori', type: 'number', value: 187032, money: true, showIf: (s) => isGold(s) && s.karat === '18', help: 'BAJUS rate announced 13 Oct 2026 — update with today\'s rate.' },
    { id: 'ptrad', label: 'Traditional gold price per vori', type: 'number', value: 152000, money: true, showIf: (s) => isGold(s) && s.karat === 'trad', help: 'Approximate — check today\'s BAJUS rate.' },
    { id: 'psilver', label: 'Silver price per vori', type: 'number', value: 6000, money: true, showIf: (s) => !isGold(s), help: 'Enter today\'s BAJUS silver rate for your purity.' },
    { id: 'unit', label: 'Enter weight in', type: 'select', value: 'vori', rerender: true, options: [['vori', 'Vori / ana / rati / point'], ['gram', 'Grams']] },
    { id: 'vori', label: 'Vori (ভরি)', type: 'number', value: 1, showIf: isVori },
    { id: 'ana', label: 'Ana (আনা)', type: 'number', value: 0, showIf: isVori, help: '16 ana = 1 vori' },
    { id: 'rati', label: 'Rati (রতি)', type: 'number', value: 0, showIf: isVori, help: '6 rati = 1 ana' },
    { id: 'point', label: 'Point (পয়েন্ট)', type: 'number', value: 0, showIf: isVori, help: '10 point = 1 rati' },
    { id: 'grams', label: 'Weight', type: 'number', value: 11.664, suffix: 'g', step: 0.001, showIf: (s) => !isVori(s) },
    { id: 'making', label: 'Making charge (মজুরি)', type: 'number', value: 6, suffix: '%', step: 0.1, help: 'BAJUS minimum is 6% of the gold price; shops may charge more.' },
    { id: 'makingFlat', label: 'Extra fixed making charge', type: 'number', value: 0, money: true },
    { id: 'vat', label: 'VAT', type: 'number', value: 5, suffix: '%', step: 0.1 },
    { id: 'vatOnMaking', label: 'Charge VAT on making charge too', type: 'checkbox', value: false },
  ],
  compute(v) {
    const gold = isGold(v);
    const price = gold ? num({ 22: v.p22, 21: v.p21, 18: v.p18, trad: v.ptrad }[v.karat] ?? v.p22) : num(v.psilver);
    const grams = isVori(v) ? toGrams({ vori: num(v.vori), ana: num(v.ana), rati: num(v.rati), point: num(v.point) }) : num(v.grams);
    if (grams < 0 || price < 0) throw new Error('Weight and price must be positive.');
    const r = goldPrice({ grams, pricePerVori: price, makingPct: num(v.making), makingFlat: num(v.makingFlat), vatPct: num(v.vat), vatOnMaking: Boolean(v.vatOnMaking) });
    const w = fromGrams(grams);
    return {
      primary: { label: 'Total price', value: r.total, type: 'money' },
      items: [
        { label: `${gold ? 'Gold' : 'Silver'} value`, value: r.metal, type: 'money' },
        { label: 'Making charge', value: r.making, type: 'money' },
        { label: 'VAT', value: r.vat, type: 'money' },
        { label: 'Weight in grams', value: grams, type: 'number', unit: 'g' },
        { label: 'Weight in vori-ana-rati-point', value: `${w.vori} vori ${w.ana} ana ${w.rati} rati ${w.point} point`, type: 'text' },
        { label: 'Price per gram', value: price / VORI_G, type: 'money' },
        { label: 'Price per ana', value: price / 16, type: 'money' },
      ],
      chart: { type: 'donut', data: [{ label: gold ? 'Gold' : 'Silver', value: r.metal }, { label: 'Making charge', value: r.making }, { label: 'VAT', value: r.vat }] },
    };
  },
  about: `<p>Bangladeshi jewellers weigh gold in the traditional system used by the Bangladesh Jewellers Association
    (<strong>BAJUS</strong>): <strong>1 vori (ভরি) = 11.664 g = 16 ana</strong>, 1 ana = 6 rati (0.729 g), 1 rati = 10 point
    (0.1215 g). Price = weight in vori × today's price per vori for the chosen purity (22K, 21K, 18K or traditional).</p>
    <p>BAJUS sets prices daily and its pricing rule adds <strong>5% VAT</strong> (government) and a minimum
    <strong>6% making charge</strong> to the gold price, i.e. about 11% on top. By default VAT here is charged on the metal value
    only, as in the BAJUS rule; tick the box if your shop also charges VAT on the making charge. Default prices are the BAJUS
    rates announced on 13 October 2026 — prices change often, so enter the current rate from
    <a href="https://www.bajus.org" rel="nofollow noopener">bajus.org</a> or your shop.</p>${DISCLAIMER}`,
};

/* ------------------------------------------------------------------ */
/* 5. Electricity bill                                                 */
/* ------------------------------------------------------------------ */

/** BERC residential (LT-A) tariff effective June 2026 billing (BERC order, with the 0-75 unit increase withdrawn). */
export const BERC_RESIDENTIAL = {
  lifeline: { upTo: 50, rate: 4.63 },
  slabs: [[75, 5.26], [125, 8.50], [100, 9.10], [100, 9.62], [200, 15.01], [Infinity, 17.35]],
  demandPerKw: 42,
  vatPct: 5,
};

export function electricityBill({ units, loadKw = 2, meterRent = 0, tariff = BERC_RESIDENTIAL }) {
  const u = Math.max(0, units);
  const rows = [];
  let energy = 0;
  if (u <= tariff.lifeline.upTo) {
    energy = u * tariff.lifeline.rate;
    rows.push([`Lifeline (0–${tariff.lifeline.upTo})`, u, tariff.lifeline.rate, energy]);
  } else {
    let rem = u;
    let from = 0;
    for (const [w, rate] of tariff.slabs) {
      const used = Math.min(rem, w);
      if (used <= 0) break;
      const to = w === Infinity ? null : from + w;
      rows.push([to ? `${from + 1}–${to}` : `Above ${from}`, used, rate, used * rate]);
      energy += used * rate;
      rem -= used;
      from += w;
    }
  }
  const demand = Math.max(0, loadKw) * tariff.demandPerKw;
  const vat = (energy + demand + meterRent) * tariff.vatPct / 100;
  return { energy, demand, meterRent, vat, total: energy + demand + meterRent + vat, rows };
}

const electricityCalc = {
  id: 'bd-electricity-bill',
  name: 'Electricity Bill Calculator Bangladesh',
  cat: 'bangladesh',
  currency: 'BDT', // Taka-denominated rules: always show ৳ regardless of the visitor's currency setting
  icon: '💡',
  desc: 'Calculate your monthly residential electricity bill using current BERC slab tariffs (June 2026), demand charge and 5% VAT — for DESCO, DPDC, BREB/Palli Bidyut, NESCO, WZPDCL and BPDB.',
  keywords: 'electricity bill bangladesh berc tariff unit price desco dpdc palli bidyut breb nesco prepaid meter kwh বিদ্যুৎ বিল বিদ্যুতের দাম ইউনিট মূল্য পল্লী বিদ্যুৎ',
  inputs: [
    { id: 'units', label: 'Units used this month', type: 'number', value: 250, suffix: 'kWh', help: 'Present meter reading − previous reading.' },
    { id: 'load', label: 'Sanctioned load', type: 'number', value: 2, suffix: 'kW', step: 0.5, help: 'Shown on your bill / prepaid card. Demand charge is Tk 42 per kW per month.' },
    { id: 'meterRent', label: 'Meter rent (if charged)', type: 'number', value: 0, money: true, help: 'Some postpaid meters carry a monthly meter rent; prepaid usually none.' },
  ],
  compute(v) {
    const r = electricityBill({ units: num(v.units), loadKw: num(v.load), meterRent: Math.max(0, num(v.meterRent)) });
    const u = num(v.units);
    return {
      primary: { label: 'Total monthly bill', value: r.total, type: 'money' },
      items: [
        { label: 'Energy charge', value: r.energy, type: 'money' },
        { label: 'Demand charge', value: r.demand, type: 'money' },
        { label: 'Meter rent', value: r.meterRent, type: 'money' },
        { label: 'VAT (5%)', value: r.vat, type: 'money' },
        { label: 'Average cost per unit (incl. all)', value: u ? r.total / u : 0, type: 'number2', unit: 'Tk/kWh' },
      ],
      note: u <= 50 ? 'Lifeline rate applies because usage is 50 units or less.' : 'Above 50 units the lifeline rate no longer applies; slabs start at Tk 5.26 from the first unit.',
      chart: { type: 'donut', data: [{ label: 'Energy', value: r.energy }, { label: 'Demand charge', value: r.demand }, { label: 'Meter rent', value: r.meterRent }, { label: 'VAT', value: r.vat }] },
      table: { title: 'Slab-wise energy charge', head: ['Units slab', 'Units', 'Rate (Tk)', 'Charge'], types: ['text', 'int', 'number2', 'money'], rows: r.rows },
    };
  },
  about: `<p>Residential (LT-A) bills use telescopic slabs set by the <strong>Bangladesh Energy Regulatory Commission (BERC)</strong>:
    each slab's rate applies only to the units within it. Rates below apply from the <strong>June 2026</strong> billing cycle
    after BERC's tariff revision (the proposed rise for the lifeline and 0–75 unit slabs was withdrawn).</p>
    <table><thead><tr><th>Units / month</th><th>Tk per unit</th></tr></thead><tbody>
    <tr><td>Lifeline: total use 0–50</td><td>4.63</td></tr><tr><td>1–75</td><td>5.26</td></tr><tr><td>76–200</td><td>8.50</td></tr>
    <tr><td>201–300</td><td>9.10</td></tr><tr><td>301–400</td><td>9.62</td></tr><tr><td>401–600</td><td>15.01</td></tr><tr><td>Above 600</td><td>17.35</td></tr></tbody></table>
    <p>Plus a demand charge of Tk 42 per kW of sanctioned load per month and 5% VAT on the bill. Prepaid meters may show a
    small rebate and deduct charges differently. Source: BERC tariff order 2026
    (<a href="https://berc.gov.bd" rel="nofollow noopener">berc.gov.bd</a>) and your distributor's tariff page (e.g. DPDC, DESCO, BREB).</p>${DISCLAIMER}`,
};

/* ------------------------------------------------------------------ */
/* 6. Government pension & gratuity                                    */
/* ------------------------------------------------------------------ */

/** Gross pension as % of last basic pay by completed years of qualifying service (pension rate table, July 2026). */
export function pensionRate(years) {
  const y = Math.floor(years);
  if (y < 5) return 0;
  if (y < 10) return 21 + 3 * (y - 5);
  if (y >= 25) return 90;
  return Math.round(3.6 * y * 100) / 100;
}

/** Gratuity (Tk per Tk 1 of commuted monthly pension) by length of service. */
export function gratuityRate(years) {
  if (years < 5) return 0;
  if (years < 10) return 265;
  if (years < 15) return 260;
  if (years < 20) return 245;
  return 230;
}

export function govtPension({ basic, years, commute = 50, ratePct = 0, gratuityPerTk = 0, medical = 0, leaveMonths = 0, gpf = 0 }) {
  const rate = ratePct > 0 ? ratePct : pensionRate(years);
  if (!rate) throw new Error('At least 5 years of qualifying service is needed for a pension.');
  const gross = basic * rate / 100;
  const commuted = gross * commute / 100;
  const g = gratuityPerTk > 0 ? gratuityPerTk : gratuityRate(years);
  const gratuity = commuted * g;
  const net = gross - commuted;
  const leave = basic * Math.min(Math.max(leaveMonths, 0), 18);
  return { rate, gross, commuted, gRate: g, gratuity, net, monthly: net + (net > 0 ? medical : 0), leave, lumpSum: gratuity + leave + gpf };
}

const pensionCalc = {
  id: 'bd-govt-pension',
  name: 'Government Pension & Gratuity Calculator (Bangladesh)',
  cat: 'bangladesh',
  currency: 'BDT', // Taka-denominated rules: always show ৳ regardless of the visitor's currency setting
  icon: '🏛️',
  desc: 'Bangladesh government employee pension calculator: gross and net monthly pension, commutation, gratuity (anutoshik), leave encashment, medical allowance and festival bonus.',
  keywords: 'pension calculator bangladesh government employee gratuity commutation lump grant leave encashment prl pay scale 2026 পেনশন আনুতোষিক এককালীন অবসর পিআরএল ছুটি নগদায়ন সরকারি চাকরিজীবী নিট পেনশন',
  inputs: [
    { id: 'basic', label: 'Last basic pay (monthly)', type: 'number', value: 78000, money: true, help: 'Basic pay drawn on the last day of service (before PRL).' },
    { id: 'years', label: 'Qualifying service', type: 'number', value: 25, suffix: 'years', help: 'Completed years of pensionable service (minimum 5; 25+ gets the maximum 90%).' },
    { id: 'commute', label: 'Commutation (surrender)', type: 'select', value: '50', options: [['50', '50% (mandatory minimum)'], ['100', '100% (full surrender — no monthly pension)']] },
    { id: 'ratePct', label: 'Pension rate override', type: 'number', value: 0, suffix: '%', step: 0.01, help: 'Leave 0 to use the official table by years of service.' },
    { id: 'gratuityPerTk', label: 'Gratuity per Tk 1 override', type: 'number', value: 0, suffix: 'Tk', help: 'Leave 0 for auto: 5–9 yrs Tk 265, 10–14 yrs Tk 260, 15–19 yrs Tk 245, 20+ yrs Tk 230.' },
    { id: 'medical', label: 'Medical allowance (monthly)', type: 'number', value: 1500, money: true, help: 'Currently Tk 1,500 (Tk 2,500 from age 65). Revised allowances under the 2026 pay scale take effect later.' },
    { id: 'leaveMonths', label: 'Leave encashment (lump grant)', type: 'number', value: 18, suffix: 'months', help: 'Unspent earned leave paid at last basic, up to 18 months.' },
    { id: 'gpf', label: 'Final GPF balance (optional)', type: 'number', value: 0, money: true, help: 'Use the GPF calculator to estimate it.' },
    { id: 'increase', label: 'Yearly net pension increase', type: 'number', value: 5, suffix: '%', step: 0.5, help: 'Net pension rises 5% every July under the current rules.' },
  ],
  compute(v) {
    const basic = Math.max(0, num(v.basic));
    const years = num(v.years);
    const r = govtPension({ basic, years, commute: num(v.commute) || 50, ratePct: num(v.ratePct), gratuityPerTk: num(v.gratuityPerTk), medical: Math.max(0, num(v.medical)), leaveMonths: num(v.leaveMonths), gpf: Math.max(0, num(v.gpf)) });
    const inc = num(v.increase) / 100;
    const rows = [];
    let net = r.net;
    for (let y = 1; y <= 10 && r.net > 0; y++) {
      rows.push([y, net, net + Math.max(0, num(v.medical)), net * 2 + net * 0.2 + (net + Math.max(0, num(v.medical))) * 12]);
      net *= 1 + inc;
    }
    const items = [
      { label: 'Pension rate', value: r.rate, type: 'percent' },
      { label: 'Gross pension (monthly)', value: r.gross, type: 'money' },
      { label: `Commuted portion (${num(v.commute) || 50}%)`, value: r.commuted, type: 'money' },
      { label: `Gratuity rate (per Tk 1)`, value: r.gRate, type: 'int', unit: 'Tk' },
      { label: 'Gratuity (anutoshik)', value: r.gratuity, type: 'money' },
      { label: 'Net monthly pension', value: r.net, type: 'money' },
      { label: 'Monthly pension + medical allowance', value: r.monthly, type: 'money' },
      { label: 'Leave encashment (lump grant)', value: r.leave, type: 'money' },
      { label: 'Festival bonuses (2 × net pension / yr)', value: r.net * 2, type: 'money' },
      { label: 'Bangla New Year allowance (20%)', value: r.net * 0.2, type: 'money' },
      { label: 'Total one-time receipt', value: r.lumpSum, type: 'money' },
    ];
    return {
      primary: { label: 'Gratuity (one-time)', value: r.gratuity, type: 'money', badge: `Net pension ${fmtTk(r.net)}/month` },
      items,
      note: r.net > 0 ? 'Under the National Pay Scale 2026, net pension is re-fixed with a reported floor of Tk 10,000 and ceiling of Tk 70,200 — check your PPO from iBAS++.' : 'With 100% surrender you receive double gratuity but no monthly pension.',
      chart: { type: 'donut', data: [{ label: 'Gratuity', value: r.gratuity }, { label: 'Leave encashment', value: r.leave }, { label: 'GPF', value: Math.max(0, num(v.gpf)) }] },
      table: rows.length ? { title: 'Net pension projection', head: ['Year', 'Net pension', 'With medical', 'Yearly total incl. bonuses'], types: ['int', 'money', 'money', 'money'], rows } : undefined,
    };
  },
  about: `<p>For Bangladesh civil servants under the Public Servants (Retirement) Act 1974, the Bangladesh Service Rules (Part I)
    and the Pension Simplification Order 2020, as revised with the <strong>National Pay Scale 2026</strong>
    (Service (Pay and Allowances) Order 2026, effective 1 July 2026).</p>
    <ol>
    <li><strong>Gross pension</strong> = last basic pay × pension rate. The rate depends on completed qualifying service:
    5 years 21%, 6 yrs 24%, 7 yrs 27%, 8 yrs 30%, 9 yrs 33%, 10 yrs 36%, then 3.6% per year (15 yrs 54%, 20 yrs 72%) up to
    <strong>90% for 25 years or more</strong>.</li>
    <li>At least <strong>50% must be commuted</strong> (surrendered). The commuted part is paid as <strong>gratuity</strong>
    = commuted monthly pension × rate per Tk 1: Tk 265 (5–9 years), Tk 260 (10–14), Tk 245 (15–19), Tk 230 (20+).
    You may surrender 100% for double gratuity and no monthly pension.</li>
    <li><strong>Net monthly pension</strong> = gross − commuted part, plus medical allowance, two festival allowances a year
    (each equal to net pension), the Bangla New Year allowance (20%), and a 5% yearly increase.</li>
    <li><strong>Leave encashment</strong> (lump grant) of unspent leave up to 18 months' basic pay, and your GPF final payment,
    are paid along with gratuity.</li></ol>
    <p>Example: basic Tk 78,000, 25 years → gross Tk 70,200; commuted Tk 35,100 × 230 = Tk 80,73,000 gratuity; net pension Tk 35,100.</p>
    <p>Sources: Finance Division, Ministry of Finance (<a href="https://mof.gov.bd" rel="nofollow noopener">mof.gov.bd</a>) — pension
    circulars and the 2026 pay scale gazette (S.R.O. 347-Law/2026); CAFO / iBAS++ pension guidance. Some 2026 revisions
    (net pension floors and new allowance rates) are phased — use the override fields to match your PPO.</p>${DISCLAIMER}`,
};

/* ------------------------------------------------------------------ */
/* 7. GPF                                                              */
/* ------------------------------------------------------------------ */

/** GPF profit slabs on balance (Finance Division; unchanged for FY 2025-26 and FY 2026-27). */
export const GPF_SLABS = [[lakh(15), 13], [lakh(30), 12], [Infinity, 11]];

/** Yearly interest on a balance, slab-wise (each slab's rate applies only to the part in that slab). */
export function gpfYearlyInterest(balance) {
  let prev = 0;
  let total = 0;
  for (const [upTo, rate] of GPF_SLABS) {
    const part = Math.max(0, Math.min(balance, upTo) - prev);
    total += part * rate / 100;
    prev = upTo;
    if (balance <= upTo) break;
  }
  return total;
}

export function gpf({ opening = 0, basic = 0, subPct = 10, years = 1, payRise = 0 }) {
  let bal = Math.max(0, opening);
  let pay = Math.max(0, basic);
  let totalSub = 0;
  let totalInt = 0;
  const rows = [];
  const n = Math.max(0, Math.round(years));
  for (let y = 1; y <= n; y++) {
    const sub = pay * subPct / 100;
    let interest = 0;
    let ySub = 0;
    for (let m = 0; m < 12; m++) {
      bal += sub;
      ySub += sub;
      interest += gpfYearlyInterest(bal) / 12;
    }
    bal += interest;
    totalSub += ySub;
    totalInt += interest;
    rows.push([y, ySub, interest, bal]);
    pay *= 1 + payRise / 100;
  }
  return { balance: bal, totalSub, totalInt, rows };
}

const gpfCalc = {
  id: 'bd-gpf',
  name: 'GPF Interest Calculator (Bangladesh)',
  cat: 'bangladesh',
  currency: 'BDT', // Taka-denominated rules: always show ৳ regardless of the visitor's currency setting
  icon: '📒',
  desc: 'Estimate your General Provident Fund (GPF) balance and yearly profit with the slab rates for Bangladesh government employees (13% / 12% / 11%).',
  keywords: 'gpf general provident fund interest profit government employee cafo ibas provident fund cpf জিপিএফ সাধারণ ভবিষ্য তহবিল মুনাফা সুদ',
  inputs: [
    { id: 'opening', label: 'Current GPF balance', type: 'number', value: 500000, money: true, help: 'From your latest GPF statement (CAFO / iBAS++).' },
    { id: 'basic', label: 'Monthly basic pay', type: 'number', value: 50000, money: true },
    { id: 'subPct', label: 'Monthly subscription', type: 'number', value: 10, suffix: '% of basic', step: 1, help: 'Minimum 5%, maximum 25% of basic pay.' },
    { id: 'years', label: 'Years to project', type: 'number', value: 10, suffix: 'years' },
    { id: 'payRise', label: 'Yearly increment', type: 'number', value: 5, suffix: '%', step: 0.5, help: 'Annual increment on basic pay (5% in the national pay scale).' },
  ],
  compute(v) {
    const sub = num(v.subPct);
    const years = Math.min(Math.max(num(v.years), 1), 40);
    const r = gpf({ opening: num(v.opening), basic: num(v.basic), subPct: sub, years, payRise: num(v.payRise) });
    const first = r.rows[0];
    return {
      primary: { label: `GPF balance after ${Math.round(years)} years`, value: r.balance, type: 'money' },
      items: [
        { label: 'Total subscriptions', value: r.totalSub, type: 'money' },
        { label: 'Total profit (interest)', value: r.totalInt, type: 'money' },
        { label: 'First-year profit', value: first ? first[2] : 0, type: 'money' },
        { label: 'Monthly subscription now', value: num(v.basic) * sub / 100, type: 'money' },
        { label: 'Effective rate on current balance', value: num(v.opening) ? gpfYearlyInterest(num(v.opening)) / num(v.opening) * 100 : 13, type: 'percent' },
      ],
      note: sub < 5 || sub > 25 ? 'GPF subscription must be between 5% and 25% of basic pay.' : 'GPF profit is tax-exempt and your subscription counts as eligible investment for the tax rebate.',
      chart: { type: 'stacked', legend: ['Opening + subscriptions', 'Accumulated profit'], data: r.rows.map((row) => {
        const idx = row[0];
        const subs = num(v.opening) + r.rows.slice(0, idx).reduce((s, x) => s + x[1], 0);
        return { label: `Y${idx}`, value: row[3], parts: [subs, Math.max(row[3] - subs, 0)] };
      }) },
      table: { title: 'Year by year', head: ['Year', 'Subscription', 'Profit', 'Closing balance'], types: ['int', 'money', 'money', 'money'], rows: r.rows },
    };
  },
  about: `<p>The Finance Division sets the GPF / CPF profit rate each fiscal year; the slab structure introduced in 2021 was kept
    unchanged for <strong>FY 2025-26 and FY 2026-27</strong>: <strong>13%</strong> on the balance up to Tk 15 lakh,
    <strong>12%</strong> on the part from Tk 15 lakh to Tk 30 lakh and <strong>11%</strong> on the part above Tk 30 lakh.</p>
    <p>Profit is worked out on the monthly balance (balance × slab rate ÷ 12 each month) and credited at the end of the fiscal
    year, so it compounds yearly. Example: a Tk 20 lakh balance earns 15 lakh × 13% + 5 lakh × 12% = Tk 2,55,000 a year.
    Your Accounts office (CAFO / iBAS++) uses the lowest balance between the 5th and the end of each month, so small
    differences are normal.</p>
    <p>Sources: Finance Division, Ministry of Finance GPF profit-rate notification; General Provident Fund Rules 1979;
    <a href="https://www.cafopfm.gov.bd/gpf-faq.php" rel="nofollow noopener">CAFO GPF FAQ</a>.</p>${DISCLAIMER}`,
};

export default [incomeTax, sanchayapatraCalc, fdrCalc, dpsCalc, goldCalc, electricityCalc, pensionCalc, gpfCalc];
