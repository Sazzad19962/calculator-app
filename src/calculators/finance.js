import { num, req, opt, amortizeRate, monthlyRateFrom, pmt, parseDate, todayISO, addToDate, plural } from '../util.js';

const termOptions = [
  ['40', '40 years'], ['30', '30 years'], ['25', '25 years'], ['20', '20 years'], ['15', '15 years'], ['10', '10 years'],
];

const compoundOptions = [['12', 'Monthly (APR)'], ['1', 'Annually (APY)'], ['2', 'Semi-annually'], ['4', 'Quarterly'], ['365', 'Daily'], ['c', 'Continuously']];

const monthYear = (d) => d.toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', year: 'numeric' });

/** Yearly amortization table; with a first-payment date the month each loan year ends is shown. */
function scheduleTable(sched, start) {
  const { yearly, months } = sched;
  const withDate = Boolean(start);
  return {
    title: 'Amortization schedule (yearly)',
    head: withDate ? ['Year', 'Through', 'Interest', 'Principal', 'Balance'] : ['Year', 'Interest', 'Principal', 'Balance'],
    types: withDate ? ['int', 'text', 'money', 'money', 'money'] : ['int', 'money', 'money', 'money'],
    rows: yearly.map((r) => (withDate
      ? [r.year, monthYear(addToDate(start, { months: Math.min(r.year * 12, months) - 1 })), r.interest, r.principal, r.balance]
      : [r.year, r.interest, r.principal, r.balance])),
  };
}

/** Parses an optional first-payment date input. */
function startDate(v) {
  if (!v) return null;
  const d = parseDate(v);
  if (!d) throw new Error('Enter a valid first payment date.');
  return d;
}

const rateField = (v, label = 'Interest rate') => req(v, label, { min: 0, max: 100 });

export default [
  {
    id: 'mortgage',
    name: 'Mortgage Calculator',
    cat: 'finance',
    icon: '🏠',
    desc: 'Estimate your monthly mortgage payment including taxes, insurance, PMI and HOA, see your payoff date and how extra payments save interest.',
    keywords: 'home loan house payment amortization pmi extra payment payoff date',
    inputs: [
      { id: 'price', label: 'Home price', type: 'number', value: 400000, money: true },
      { id: 'down', label: 'Down payment', type: 'number', value: 20, suffix: '%', help: 'Below 20% most conventional lenders require PMI.' },
      { id: 'rate', label: 'Interest rate', type: 'number', value: 6.5, suffix: '%', step: 0.01 },
      { id: 'years', label: 'Loan term', type: 'select', value: '30', options: termOptions },
      { id: 'start', label: 'First payment date', type: 'date', value: () => todayISO() },
      { id: 'tax', label: 'Property tax (yearly)', type: 'number', value: 1.2, suffix: '%', step: 0.01 },
      { id: 'ins', label: 'Home insurance (yearly)', type: 'number', value: 1500, money: true },
      { id: 'pmi', label: 'PMI rate (yearly)', type: 'number', value: 0.5, suffix: '%', step: 0.01, help: 'Typically 0.3%–1.5% of the loan per year. Only charged when the down payment is under 20%.' },
      { id: 'hoa', label: 'HOA fee (monthly)', type: 'number', value: 0, money: true },
      { id: 'extra', label: 'Extra payment (monthly)', type: 'number', value: 0, money: true },
    ],
    compute(v) {
      const price = req(v.price, 'Home price', { gt: 0 });
      const downPct = opt(v.down, 'Down payment', { min: 0, max: 100 });
      const rate = rateField(v.rate);
      const years = req(v.years, 'Loan term', { gt: 0, max: 50 });
      const taxPct = opt(v.tax, 'Property tax', { min: 0, max: 25 });
      const insYear = opt(v.ins, 'Home insurance', { min: 0 });
      const pmiPct = opt(v.pmi, 'PMI rate', { min: 0, max: 5 });
      const hoa = opt(v.hoa, 'HOA fee', { min: 0 });
      const extra = opt(v.extra, 'Extra payment', { min: 0 });
      const start = startDate(v.start);

      const downAmt = price * downPct / 100;
      const loan = Math.max(price - downAmt, 0);
      const months = Math.round(years * 12);
      const r = rate / 100 / 12;
      const base = amortizeRate(loan, r, months);
      const a = extra > 0 ? amortizeRate(loan, r, months, extra) : base;

      // PMI: required when the loan-to-value ratio starts above 80%; under the US Homeowners Protection
      // Act it terminates automatically once the balance reaches 78% of the original home value.
      const pmiMonthly = loan / price > 0.8 ? loan * pmiPct / 100 / 12 : 0;
      let pmiMonths = 0;
      if (pmiMonthly > 0) {
        let bal = loan;
        for (const row of a.monthly) {
          if (bal <= 0.78 * price) break;
          pmiMonths++;
          bal = row.balance;
        }
      }
      const tax = price * taxPct / 100 / 12;
      const ins = insYear / 12;
      const total = a.payment + tax + ins + pmiMonthly + hoa;
      const paid = a.months;
      const items = [
        { label: 'Principal & interest', value: a.payment, type: 'money' },
        { label: 'Property tax', value: tax, type: 'money' },
        { label: 'Home insurance', value: ins, type: 'money' },
      ];
      if (pmiMonthly > 0) items.push({ label: `PMI (first ${plural(pmiMonths, 'month')})`, value: pmiMonthly, type: 'money' });
      items.push(
        { label: 'HOA', value: hoa, type: 'money' },
        { label: 'Loan amount', value: loan, type: 'money' },
        { label: 'Down payment', value: downAmt, type: 'money' },
        { label: 'Total interest', value: a.totalInterest, type: 'money' },
        { label: 'Total of all payments', value: a.totalPaid + (tax + ins + hoa) * paid + pmiMonthly * pmiMonths, type: 'money' },
        { label: 'Number of payments', value: paid, type: 'int' },
      );
      if (start && paid > 0) items.push({ label: 'Payoff date', value: monthYear(addToDate(start, { months: paid - 1 })), type: 'text' });
      if (extra > 0) {
        items.push(
          { label: 'Interest saved with extra payments', value: base.totalInterest - a.totalInterest, type: 'money' },
          { label: 'Paid off sooner by', value: `${Math.floor((base.months - a.months) / 12)} yr ${(base.months - a.months) % 12} mo`, type: 'text' },
        );
      }
      let note;
      if (loan === 0) note = 'With a 100% down payment no mortgage is needed.';
      else if (pmiMonthly > 0) note = `Your down payment is under 20%, so PMI of about ${Math.round(pmiMonthly)} a month is included until the balance reaches 78% of the home price (≈ ${plural(pmiMonths, 'payment')}).`;
      return {
        primary: { label: 'Monthly payment', value: total, type: 'money' },
        items,
        chart: {
          type: 'donut',
          data: [
            { label: 'Principal & interest', value: a.payment },
            { label: 'Tax', value: tax },
            { label: 'Insurance', value: ins },
            { label: 'PMI', value: pmiMonthly },
            { label: 'HOA', value: hoa },
          ].filter((d) => d.value > 0),
        },
        note,
        table: scheduleTable(a, start),
      };
    },
    about: `<p>The monthly principal and interest is calculated with the standard amortization formula
      <code>M = P·r(1+r)<sup>n</sup> / ((1+r)<sup>n</sup> − 1)</code>, where <em>P</em> is the loan amount,
      <em>r</em> the monthly interest rate (annual rate ÷ 12) and <em>n</em> the number of monthly payments. Property tax,
      insurance, PMI and HOA dues are added on top to give your full housing payment.</p>
      <p><strong>PMI.</strong> Conventional lenders usually require private mortgage insurance when you put down less than 20%.
      It is estimated here as a yearly percentage of the original loan amount and is dropped once the balance reaches 78% of the
      home's original value — the point at which the U.S. Homeowners Protection Act of 1998 requires automatic cancellation
      (<a href="https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/" rel="nofollow noopener">CFPB</a>).
      You can usually ask your lender to cancel it earlier, at 80%. FHA loans use a different mortgage insurance premium (MIP).</p>
      <p><strong>Extra payments</strong> go straight to principal, shortening the loan and cutting total interest; the calculator
      shows the interest saved and your new payoff date.</p>`,
  },
  {
    id: 'loan',
    name: 'Loan Calculator',
    cat: 'finance',
    icon: '💳',
    desc: 'Calculate the payment, total interest and payoff date for any fixed-rate loan, with any compounding — and see how extra payments save money.',
    keywords: 'personal loan payment interest extra payment payoff compounding apr apy',
    inputs: [
      { id: 'amount', label: 'Loan amount', type: 'number', value: 25000, money: true },
      { id: 'rate', label: 'Interest rate (yearly)', type: 'number', value: 8, suffix: '%', step: 0.01 },
      { id: 'compound', label: 'Compounding', type: 'select', value: '12', options: compoundOptions },
      { id: 'years', label: 'Loan term', type: 'number', value: 5, suffix: 'years' },
      { id: 'extra', label: 'Extra monthly payment', type: 'number', value: 0, money: true },
      { id: 'start', label: 'First payment date', type: 'date', value: () => todayISO() },
    ],
    compute(v) {
      const P = req(v.amount, 'Loan amount', { gt: 0 });
      const rate = rateField(v.rate);
      const years = req(v.years, 'Loan term', { gt: 0, max: 100 });
      const extra = opt(v.extra, 'Extra monthly payment', { min: 0 });
      const start = startDate(v.start);
      const months = Math.round(years * 12);
      if (months <= 0) throw new Error('Loan term must be at least one month.');
      const n = v.compound === 'c' ? 'c' : num(v.compound) || 12;
      const r = monthlyRateFrom(rate, n);
      const base = amortizeRate(P, r, months);
      const withExtra = extra > 0 ? amortizeRate(P, r, months, extra) : base;
      const items = [
        { label: 'Total interest', value: withExtra.totalInterest, type: 'money' },
        { label: 'Total paid', value: withExtra.totalPaid, type: 'money' },
        { label: 'Number of payments', value: withExtra.months, type: 'int' },
        { label: 'Effective annual rate (APY)', value: (Math.pow(1 + r, 12) - 1) * 100, type: 'percent' },
      ];
      if (start) items.push({ label: 'Payoff date', value: monthYear(addToDate(start, { months: withExtra.months - 1 })), type: 'text' });
      if (extra > 0) {
        items.unshift({ label: 'Total monthly payment incl. extra', value: base.payment + extra, type: 'money' });
        items.push(
          { label: 'Interest saved', value: base.totalInterest - withExtra.totalInterest, type: 'money' },
          { label: 'Months saved', value: base.months - withExtra.months, type: 'int' },
        );
      }
      return {
        primary: { label: 'Monthly payment', value: base.payment, type: 'money' },
        items,
        chart: { type: 'donut', data: [{ label: 'Principal', value: P }, { label: 'Interest', value: withExtra.totalInterest }] },
        table: scheduleTable(withExtra, start),
      };
    },
    about: `<p>Uses the standard amortization formula <code>M = P·r / (1 − (1+r)<sup>−n</sup>)</code> to find the fixed monthly
      payment. When interest compounds other than monthly, the yearly rate is first converted to the equivalent monthly rate
      <code>r = (1 + i/k)<sup>k/12</sup> − 1</code> (k = compounding periods per year; continuous compounding uses
      <code>e<sup>i/12</sup> − 1</code>). Any extra payment is applied directly to principal, which shortens the loan and reduces
      total interest — the calculator shows exactly how much you save.</p>`,
  },
  {
    id: 'emi',
    name: 'EMI Calculator',
    cat: 'finance',
    icon: '🏦',
    desc: 'Equated Monthly Instalment (EMI) for home, car or personal loans with tenure in months.',
    keywords: 'equated monthly instalment bank loan tenure bangladesh india',
    inputs: [
      { id: 'amount', label: 'Loan amount', type: 'number', value: 1000000, money: true },
      { id: 'rate', label: 'Interest rate (yearly)', type: 'number', value: 10, suffix: '%', step: 0.01 },
      { id: 'months', label: 'Tenure', type: 'number', value: 60, suffix: 'months' },
    ],
    compute(v) {
      const P = req(v.amount, 'Loan amount', { gt: 0 });
      const rate = rateField(v.rate);
      const n = Math.round(req(v.months, 'Tenure', { min: 1, max: 1200 }));
      const a = amortizeRate(P, rate / 100 / 12, n);
      return {
        primary: { label: 'Monthly EMI', value: a.payment, type: 'money' },
        items: [
          { label: 'Total interest', value: a.totalInterest, type: 'money' },
          { label: 'Total payable', value: a.totalPaid, type: 'money' },
          { label: 'Interest share', value: a.totalPaid ? a.totalInterest / a.totalPaid * 100 : 0, type: 'percent' },
          { label: 'Tenure', value: `${Math.floor(n / 12)} yr ${n % 12} mo`, type: 'text' },
        ],
        chart: { type: 'donut', data: [{ label: 'Principal', value: P }, { label: 'Interest', value: a.totalInterest }] },
        table: scheduleTable(a),
      };
    },
    about: `<p><code>EMI = P·r(1+r)<sup>n</sup> / ((1+r)<sup>n</sup> − 1)</code>, where <em>r</em> is the yearly rate
      divided by 12 and <em>n</em> is the tenure in months. Banks in Bangladesh, India and elsewhere use this reducing-balance
      method for most retail loans. A flat-rate loan (interest charged on the original principal for the whole tenure) costs
      noticeably more than the same headline rate on a reducing balance.</p>`,
  },
  {
    id: 'auto-loan',
    name: 'Auto Loan Calculator',
    cat: 'finance',
    icon: '🚗',
    desc: 'Work out your car payment including sales tax, fees, down payment, trade-in value and any amount still owed on your trade-in.',
    keywords: 'car loan vehicle financing payment trade in',
    inputs: [
      { id: 'price', label: 'Vehicle price', type: 'number', value: 35000, money: true },
      { id: 'down', label: 'Down payment', type: 'number', value: 5000, money: true },
      { id: 'trade', label: 'Trade-in value', type: 'number', value: 0, money: true },
      { id: 'owed', label: 'Amount owed on trade-in', type: 'number', value: 0, money: true },
      { id: 'tax', label: 'Sales tax', type: 'number', value: 7, suffix: '%', step: 0.01 },
      { id: 'fees', label: 'Title, registration & other fees', type: 'number', value: 0, money: true, help: 'Added to the amount financed.' },
      { id: 'rate', label: 'Interest rate', type: 'number', value: 6.9, suffix: '%', step: 0.01 },
      { id: 'months', label: 'Loan term', type: 'select', value: '60', options: [['24', '24 months'], ['36', '36 months'], ['48', '48 months'], ['60', '60 months'], ['72', '72 months'], ['84', '84 months'], ['96', '96 months']] },
    ],
    compute(v) {
      const price = req(v.price, 'Vehicle price', { gt: 0 });
      const down = opt(v.down, 'Down payment', { min: 0 });
      const trade = opt(v.trade, 'Trade-in value', { min: 0 });
      const owed = opt(v.owed, 'Amount owed on trade-in', { min: 0 });
      const taxPct = opt(v.tax, 'Sales tax', { min: 0, max: 50 });
      const fees = opt(v.fees, 'Fees', { min: 0 });
      const rate = rateField(v.rate);
      const months = Math.round(req(v.months, 'Loan term', { min: 1, max: 120 }));
      const taxAmt = Math.max(price - trade, 0) * taxPct / 100;
      const loan = Math.max(price + taxAmt + fees + owed - down - trade, 0);
      const a = amortizeRate(loan, rate / 100 / 12, months);
      return {
        primary: { label: 'Monthly payment', value: a.payment, type: 'money' },
        items: [
          { label: 'Amount financed', value: loan, type: 'money' },
          { label: 'Sales tax', value: taxAmt, type: 'money' },
          { label: 'Upfront payment (down + trade-in)', value: down + trade, type: 'money' },
          { label: 'Total interest', value: a.totalInterest, type: 'money' },
          { label: 'Total of loan payments', value: a.totalPaid, type: 'money' },
          { label: 'Total cost (price, tax, fees, interest)', value: price + taxAmt + fees + a.totalInterest, type: 'money' },
        ],
        chart: { type: 'donut', data: [{ label: 'Principal', value: loan }, { label: 'Interest', value: a.totalInterest }] },
        note: loan === 0 ? 'Your down payment and trade-in cover the full cost — no loan is needed.' : owed > 0 ? `The ${owed.toLocaleString()} still owed on your trade-in is rolled into the new loan (negative equity).` : undefined,
        table: scheduleTable(a),
      };
    },
    about: `<p>Sales tax is applied to the price after the trade-in credit, as in most US states (a few states, such as California,
      tax the full price — set the trade-in to 0 and reduce the down payment accordingly). The amount financed is
      <code>price + tax + fees + amount owed on trade-in − down payment − trade-in value</code>, repaid with the standard
      monthly amortization formula.</p>`,
  },
  {
    id: 'compound-interest',
    name: 'Compound Interest Calculator',
    cat: 'finance',
    icon: '📈',
    desc: 'See how your savings grow with compound interest and regular monthly contributions.',
    keywords: 'investment growth savings future value interest on interest apy',
    inputs: [
      { id: 'principal', label: 'Initial deposit', type: 'number', value: 10000, money: true },
      { id: 'monthly', label: 'Monthly contribution', type: 'number', value: 200, money: true },
      { id: 'timing', label: 'Contributions made at', type: 'select', value: 'end', options: [['end', 'End of each month'], ['begin', 'Start of each month']] },
      { id: 'rate', label: 'Annual interest rate', type: 'number', value: 7, suffix: '%', step: 0.01 },
      { id: 'years', label: 'Years', type: 'number', value: 20, step: 0.5 },
      { id: 'n', label: 'Compounding', type: 'select', value: '12', options: [['1', 'Yearly'], ['2', 'Half-yearly'], ['4', 'Quarterly'], ['12', 'Monthly'], ['365', 'Daily'], ['c', 'Continuously']] },
    ],
    compute(v) {
      const P = opt(v.principal, 'Initial deposit', { min: 0 });
      const pm = opt(v.monthly, 'Monthly contribution', { min: 0 });
      const rate = req(v.rate, 'Interest rate', { min: -99, max: 100 });
      const years = req(v.years, 'Years', { min: 0, max: 100 });
      const months = Math.round(years * 12);
      const n = v.n === 'c' ? 'c' : num(v.n) || 12;
      const mr = monthlyRateFrom(rate, n); // effective monthly rate
      const begin = v.timing === 'begin';
      let bal = P;
      let contributed = P;
      const rows = [];
      const bars = [];
      for (let m = 1; m <= months; m++) {
        if (begin) bal = (bal + pm) * (1 + mr);
        else bal = bal * (1 + mr) + pm;
        contributed += pm;
        if (m % 12 === 0 || m === months) {
          const y = m % 12 === 0 ? String(m / 12) : (m / 12).toFixed(1);
          rows.push([y, contributed, bal - contributed, bal]);
          bars.push({ label: y, value: bal, parts: [contributed, Math.max(bal - contributed, 0)] });
        }
      }
      const yLabel = Number.isInteger(years) ? plural(years, 'year') : `${years} years`;
      const ear = n === 'c' ? Math.expm1(rate / 100) : Math.pow(1 + rate / 100 / n, n) - 1;
      return {
        primary: { label: `Balance after ${yLabel}`, value: bal, type: 'money' },
        items: [
          { label: 'Total contributions', value: contributed, type: 'money' },
          { label: 'Total interest earned', value: bal - contributed, type: 'money' },
          { label: 'Effective annual rate (APY)', value: ear * 100, type: 'percent' },
        ],
        chart: bars.length ? { type: 'stacked', legend: ['Contributions', 'Interest'], data: bars } : undefined,
        table: { title: 'Growth by year', head: ['Year', 'Contributions', 'Interest', 'Balance'], types: ['text', 'money', 'money', 'money'], rows },
      };
    },
    about: `<p>Compound interest means you earn interest on previously earned interest. For a lump sum
      <code>A = P(1 + r/n)<sup>nt</sup></code> (continuous compounding: <code>A = Pe<sup>rt</sup></code>). Monthly contributions
      grow at the equivalent monthly rate <code>(1 + r/n)<sup>n/12</sup> − 1</code>, so the effective annual yield (APY) is the same
      whichever compounding you pick. Choose whether deposits are made at the start or the end of each month — start-of-month
      deposits earn one extra month of interest.</p>`,
  },
  {
    id: 'simple-interest',
    name: 'Simple Interest Calculator',
    cat: 'finance',
    icon: '➗',
    desc: 'Calculate simple interest and the total amount for a principal, rate and time period.',
    keywords: 'interest principal rate time',
    inputs: [
      { id: 'p', label: 'Principal', type: 'number', value: 10000, money: true },
      { id: 'r', label: 'Annual rate', type: 'number', value: 5, suffix: '%', step: 0.01 },
      { id: 't', label: 'Time', type: 'number', value: 3, step: 0.01 },
      { id: 'unit', label: 'Time unit', type: 'select', value: 'y', options: [['y', 'Years'], ['m', 'Months'], ['d', 'Days (365-day year)']] },
    ],
    compute(v) {
      const p = req(v.p, 'Principal', { min: 0 });
      const r = req(v.r, 'Annual rate', { min: 0, max: 1000 });
      const t = req(v.t, 'Time', { min: 0 });
      const years = v.unit === 'm' ? t / 12 : v.unit === 'd' ? t / 365 : t;
      const I = p * r / 100 * years;
      return {
        primary: { label: 'Interest', value: I, type: 'money' },
        items: [
          { label: 'Total amount', value: p + I, type: 'money' },
          { label: 'Interest per year', value: p * r / 100, type: 'money' },
        ],
      };
    },
    about: '<p><code>I = P × r × t</code> with <em>t</em> in years (months ÷ 12, days ÷ 365). Unlike compound interest, simple interest is only earned on the original principal.</p>',
  },
  {
    id: 'retirement',
    name: 'Retirement Calculator',
    cat: 'finance',
    icon: '🏖️',
    desc: 'Project your retirement savings and estimate a sustainable monthly income in today\'s money.',
    keywords: 'pension nest egg 401k savings 4% rule',
    inputs: [
      { id: 'age', label: 'Current age', type: 'number', value: 30 },
      { id: 'retire', label: 'Retirement age', type: 'number', value: 60 },
      { id: 'saved', label: 'Current savings', type: 'number', value: 20000, money: true },
      { id: 'monthly', label: 'Monthly saving', type: 'number', value: 500, money: true },
      { id: 'ret', label: 'Expected return', type: 'number', value: 7, suffix: '%', step: 0.1 },
      { id: 'inf', label: 'Inflation', type: 'number', value: 3, suffix: '%', step: 0.1 },
      { id: 'wd', label: 'Withdrawal rate', type: 'number', value: 4, suffix: '%', step: 0.1 },
    ],
    compute(v) {
      const age = req(v.age, 'Current age', { min: 0, max: 120 });
      const retire = req(v.retire, 'Retirement age', { min: 0, max: 120 });
      const saved = opt(v.saved, 'Current savings', { min: 0 });
      const monthly = opt(v.monthly, 'Monthly saving', { min: 0 });
      const ret = req(v.ret, 'Expected return', { min: -50, max: 50 });
      const inf = opt(v.inf, 'Inflation', { min: -50, max: 50 });
      const wd = req(v.wd, 'Withdrawal rate', { min: 0, max: 100 });
      const months = Math.round((retire - age) * 12);
      if (months <= 0) throw new Error('Retirement age must be greater than current age.');
      const years = months / 12;
      const mr = Math.pow(1 + ret / 100, 1 / 12) - 1;
      let bal = saved;
      let contrib = bal;
      const bars = [];
      for (let m = 1; m <= months; m++) {
        bal = bal * (1 + mr) + monthly;
        contrib += monthly;
        if (m % 12 === 0 || m === months) bars.push({ label: String(Math.floor(age + m / 12)), value: bal, parts: [contrib, Math.max(bal - contrib, 0)] });
      }
      const real = bal / Math.pow(1 + inf / 100, years);
      return {
        primary: { label: `Savings at age ${retire}`, value: bal, type: 'money' },
        items: [
          { label: "In today's money", value: real, type: 'money' },
          { label: 'Monthly income (today\'s money)', value: real * wd / 100 / 12, type: 'money' },
          { label: 'Monthly income (future money)', value: bal * wd / 100 / 12, type: 'money' },
          { label: 'Total contributed', value: contrib, type: 'money' },
          { label: 'Investment growth', value: bal - contrib, type: 'money' },
        ],
        chart: { type: 'stacked', legend: ['Contributions', 'Growth'], data: bars },
      };
    },
    about: `<p>Savings grow at your expected yearly return, converted to the equivalent monthly rate and compounded monthly, with
      your saving added at the end of each month. The result is then deflated by inflation —
      <code>real = nominal ÷ (1 + inflation)<sup>years</sup></code> — to show its purchasing power today. The monthly income uses the
      chosen withdrawal rate (the popular "4% rule" from the 1998 Trinity study suggests withdrawing 4% of the portfolio in the
      first year).</p><p>Projections are estimates, not guarantees; real returns vary from year to year.</p>`,
  },
  {
    id: 'savings-goal',
    name: 'Savings Goal Calculator',
    cat: 'finance',
    icon: '🎯',
    desc: 'Find out how much you need to save each month to reach a target amount.',
    keywords: 'save target monthly deposit plan',
    inputs: [
      { id: 'goal', label: 'Savings goal', type: 'number', value: 50000, money: true },
      { id: 'current', label: 'Current savings', type: 'number', value: 5000, money: true },
      { id: 'years', label: 'Time to goal', type: 'number', value: 5, suffix: 'years', step: 0.5 },
      { id: 'rate', label: 'Annual return', type: 'number', value: 5, suffix: '%', step: 0.1 },
    ],
    compute(v) {
      const goal = req(v.goal, 'Savings goal', { gt: 0 });
      const current = opt(v.current, 'Current savings', { min: 0 });
      const years = req(v.years, 'Time to goal', { gt: 0, max: 100 });
      const rate = req(v.rate, 'Annual return', { min: -50, max: 100 });
      const n = Math.round(years * 12);
      if (n <= 0) throw new Error('Time to goal must be at least one month.');
      const i = rate / 100 / 12;
      const grow = Math.pow(1 + i, n);
      const fvCurrent = current * grow;
      const need = goal - fvCurrent;
      const monthly = need <= 0 ? 0 : i === 0 ? need / n : need * i / (grow - 1);
      const deposits = monthly * n;
      return {
        primary: { label: 'Required monthly saving', value: monthly, type: 'money' },
        items: [
          { label: 'Total deposits', value: deposits + current, type: 'money' },
          { label: 'Interest earned', value: need <= 0 ? fvCurrent - current : goal - deposits - current, type: 'money' },
          { label: 'Current savings will grow to', value: fvCurrent, type: 'money' },
        ],
        note: need <= 0 ? 'Your current savings will reach the goal on their own. 🎉' : undefined,
      };
    },
    about: '<p>Solves the future-value-of-annuity formula for the payment: <code>PMT = (FV − PV(1+i)<sup>n</sup>) · i / ((1+i)<sup>n</sup> − 1)</code>, where <em>i</em> is the annual return ÷ 12 and deposits are made at the end of each month.</p>',
  },
  {
    id: 'roi',
    name: 'ROI Calculator',
    cat: 'finance',
    icon: '💹',
    desc: 'Return on investment and annualized return (CAGR) for any investment.',
    keywords: 'return on investment cagr annualized profit',
    inputs: [
      { id: 'cost', label: 'Amount invested', type: 'number', value: 10000, money: true },
      { id: 'value', label: 'Amount returned', type: 'number', value: 15000, money: true },
      { id: 'years', label: 'Investment length', type: 'number', value: 3, suffix: 'years', step: 0.1 },
    ],
    compute(v) {
      const c = req(v.cost, 'Amount invested', { gt: 0 });
      const end = req(v.value, 'Amount returned', { min: 0 });
      const y = opt(v.years, 'Investment length', { min: 0, max: 1000 });
      const gain = end - c;
      const items = [{ label: 'Investment gain', value: gain, type: 'money' }];
      if (y > 0) {
        const cagr = (Math.pow(end / c, 1 / y) - 1) * 100;
        items.push({ label: 'Annualized return (CAGR)', value: Number.isFinite(cagr) ? cagr : 'Too large to annualize', type: Number.isFinite(cagr) ? 'percent' : 'text' });
      }
      return {
        primary: { label: 'ROI', value: gain / c * 100, type: 'percent' },
        items,
        note: y > 0 ? undefined : 'Enter the investment length to see the annualized return.',
      };
    },
    about: '<p><code>ROI = (Return − Cost) / Cost</code>. CAGR spreads the return evenly over the years: <code>(End/Start)<sup>1/years</sup> − 1</code>. Losing everything is −100% ROI and −100% CAGR.</p>',
  },
  {
    id: 'inflation',
    name: 'Inflation Calculator',
    cat: 'finance',
    icon: '🎈',
    desc: 'See what money will cost in the future and how inflation erodes purchasing power.',
    keywords: 'price increase purchasing power cost of living',
    inputs: [
      { id: 'amount', label: 'Amount today', type: 'number', value: 1000, money: true },
      { id: 'rate', label: 'Inflation rate', type: 'number', value: 5, suffix: '%', step: 0.1 },
      { id: 'years', label: 'Years', type: 'number', value: 10 },
    ],
    compute(v) {
      const amount = req(v.amount, 'Amount', { min: 0 });
      const rate = req(v.rate, 'Inflation rate', { gt: -100, max: 1000 });
      const years = req(v.years, 'Years', { min: 0, max: 500 });
      const f = Math.pow(1 + rate / 100, years);
      return {
        primary: { label: 'Equivalent future cost', value: amount * f, type: 'money' },
        items: [
          { label: 'Future purchasing power of today\'s amount', value: amount / f, type: 'money' },
          { label: 'Cumulative inflation', value: (f - 1) * 100, type: 'percent' },
          { label: 'Loss of purchasing power', value: (1 - 1 / f) * 100, type: 'percent' },
        ],
      };
    },
    about: '<p>Future cost = amount × (1 + inflation)<sup>years</sup>. Purchasing power is the reverse: what today\'s money will buy in the future, amount ÷ (1 + inflation)<sup>years</sup>.</p>',
  },
  {
    id: 'salary',
    name: 'Salary Converter',
    cat: 'finance',
    icon: '💼',
    desc: 'Convert pay between hourly, daily, weekly, monthly and yearly amounts.',
    keywords: 'wage hourly annual pay income convert',
    inputs: [
      { id: 'amount', label: 'Salary amount', type: 'number', value: 50000, money: true },
      { id: 'per', label: 'Per', type: 'select', value: 'year', options: [['hour', 'Hour'], ['day', 'Day'], ['week', 'Week'], ['biweek', 'Bi-week'], ['semimonth', 'Semi-month'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year']] },
      { id: 'hours', label: 'Hours per week', type: 'number', value: 40 },
      { id: 'days', label: 'Days per week', type: 'number', value: 5 },
    ],
    compute(v) {
      const amount = req(v.amount, 'Salary amount', { min: 0 });
      const h = req(v.hours, 'Hours per week', { gt: 0, max: 168 });
      const d = req(v.days, 'Days per week', { gt: 0, max: 7 });
      const perYear = { hour: h * 52, day: d * 52, week: 52, biweek: 26, semimonth: 24, month: 12, quarter: 4, year: 1 };
      const yearly = amount * (perYear[v.per] ?? 1);
      const rows = [['Hourly', yearly / perYear.hour], ['Daily', yearly / perYear.day], ['Weekly', yearly / 52], ['Bi-weekly', yearly / 26], ['Semi-monthly', yearly / 24], ['Monthly', yearly / 12], ['Quarterly', yearly / 4], ['Yearly', yearly]];
      return {
        primary: { label: 'Yearly salary', value: yearly, type: 'money' },
        items: rows.map(([label, value]) => ({ label, value, type: 'money' })),
      };
    },
    about: '<p>Assumes 52 paid working weeks per year (no unpaid leave): yearly = hourly × hours/week × 52. Bi-weekly pay has 26 pay periods a year and semi-monthly has 24. Adjust hours and days to match your contract.</p>',
  },
  {
    id: 'discount',
    name: 'Discount Calculator',
    cat: 'finance',
    icon: '🏷️',
    desc: 'Sale price after a percentage discount, optionally with sales tax or VAT.',
    keywords: 'sale percent off price shopping',
    inputs: [
      { id: 'price', label: 'Original price', type: 'number', value: 120, money: true },
      { id: 'off', label: 'Discount', type: 'number', value: 25, suffix: '%' },
      { id: 'off2', label: 'Extra discount (stacked)', type: 'number', value: 0, suffix: '%', help: 'A second discount applied to the already-reduced price, e.g. "extra 10% off sale items".' },
      { id: 'tax', label: 'Tax / VAT', type: 'number', value: 0, suffix: '%' },
    ],
    compute(v) {
      const price = req(v.price, 'Original price', { min: 0 });
      const off = opt(v.off, 'Discount', { min: 0, max: 100 });
      const off2 = opt(v.off2, 'Extra discount', { min: 0, max: 100 });
      const taxPct = opt(v.tax, 'Tax', { min: 0, max: 100 });
      const sale = price * (1 - off / 100) * (1 - off2 / 100);
      const tax = sale * taxPct / 100;
      const items = [
        { label: 'You save', value: price - sale, type: 'money' },
        { label: 'Price before tax', value: sale, type: 'money' },
        { label: 'Tax', value: tax, type: 'money' },
      ];
      if (off2 > 0) items.push({ label: 'Combined discount', value: price ? (1 - sale / price) * 100 : 0, type: 'percent' });
      return { primary: { label: 'Final price', value: sale + tax, type: 'money' }, items };
    },
    about: '<p>Sale price = original × (1 − discount%). Stacked discounts multiply: 25% off then an extra 10% off is 32.5% off in total, not 35%. Tax is applied to the discounted price.</p>',
  },
  {
    id: 'tip',
    name: 'Tip Calculator',
    cat: 'finance',
    icon: '🍽️',
    desc: 'Calculate the tip and split the bill between any number of people.',
    keywords: 'gratuity restaurant split bill',
    inputs: [
      { id: 'bill', label: 'Bill amount', type: 'number', value: 85, money: true },
      { id: 'pct', label: 'Tip', type: 'number', value: 15, suffix: '%' },
      { id: 'people', label: 'Number of people', type: 'number', value: 2, min: 1 },
    ],
    compute(v) {
      const bill = req(v.bill, 'Bill amount', { min: 0 });
      const pct = opt(v.pct, 'Tip', { min: 0, max: 100 });
      const p = req(v.people, 'Number of people', { min: 1, max: 1000, int: true });
      const tip = bill * pct / 100;
      return {
        primary: { label: p > 1 ? 'Each person pays' : 'Total to pay', value: (bill + tip) / p, type: 'money' },
        items: [
          { label: 'Tip amount', value: tip, type: 'money' },
          { label: 'Total bill', value: bill + tip, type: 'money' },
          { label: 'Tip per person', value: tip / p, type: 'money' },
        ],
        table: { title: 'Other tip amounts', head: ['Tip', 'Tip amount', 'Total', 'Per person'], types: ['text', 'money', 'money', 'money'], rows: [10, 15, 18, 20, 25].map((t) => [`${t}%`, bill * t / 100, bill * (1 + t / 100), bill * (1 + t / 100) / p]) },
      };
    },
    about: '<p>Tip = bill × tip%. The total is divided equally between everyone. In the US, 15–20% of the pre-tax bill is customary for table service.</p>',
  },
  {
    id: 'vat',
    name: 'VAT / Sales Tax Calculator',
    cat: 'finance',
    icon: '🧾',
    desc: 'Add or remove VAT / sales tax from a price.',
    keywords: 'gst vat sales tax inclusive exclusive bangladesh 15%',
    inputs: [
      { id: 'amount', label: 'Amount', type: 'number', value: 1000, money: true },
      { id: 'rate', label: 'Tax rate', type: 'number', value: 15, suffix: '%', step: 0.01 },
      { id: 'mode', label: 'Mode', type: 'select', value: 'add', options: [['add', 'Add tax (amount is net)'], ['remove', 'Remove tax (amount is gross)']] },
    ],
    compute(v) {
      const amount = req(v.amount, 'Amount', { min: 0 });
      const r = req(v.rate, 'Tax rate', { min: 0, max: 100 }) / 100;
      const add = v.mode !== 'remove';
      const net = add ? amount : amount / (1 + r);
      const gross = net * (1 + r);
      return {
        primary: { label: add ? 'Gross amount (incl. tax)' : 'Net amount (excl. tax)', value: add ? gross : net, type: 'money' },
        items: [
          { label: 'Tax amount', value: gross - net, type: 'money' },
          { label: 'Net', value: net, type: 'money' },
          { label: 'Gross', value: gross, type: 'money' },
        ],
      };
    },
    about: '<p>Adding tax: gross = net × (1 + rate). Removing tax: net = gross ÷ (1 + rate), so the tax inside a gross price is gross × rate ÷ (1 + rate). Note that removing 15% VAT is <em>not</em> the same as subtracting 15%: the VAT inside 115 is 15, which is only 13.04% of 115.</p>',
  },
  {
    id: 'credit-card',
    name: 'Credit Card Payoff Calculator',
    cat: 'finance',
    icon: '💳',
    desc: 'How long will it take to pay off your credit card, how much interest will you pay, and what payment clears it by a target date?',
    keywords: 'debt payoff apr balance',
    inputs: [
      { id: 'balance', label: 'Card balance', type: 'number', value: 5000, money: true },
      { id: 'apr', label: 'APR', type: 'number', value: 22, suffix: '%', step: 0.01 },
      { id: 'pay', label: 'Monthly payment', type: 'number', value: 200, money: true },
    ],
    compute(v) {
      const balance = req(v.balance, 'Card balance', { gt: 0 });
      const apr = req(v.apr, 'APR', { min: 0, max: 200 });
      const pay = req(v.pay, 'Monthly payment', { gt: 0 });
      const r = apr / 100 / 12;
      if (pay <= balance * r) throw new Error(`Your payment must be more than the first month's interest (${(balance * r).toFixed(2)}) or the debt will never be paid off.`);
      let bal = balance;
      let months = 0;
      let interest = 0;
      while (bal > 0.005 && months < 1200) {
        const i = bal * r;
        interest += i;
        bal = bal + i - Math.min(pay, bal + i);
        months++;
      }
      if (bal > 0.005) throw new Error('At this payment the card would take more than 100 years to pay off. Increase the payment.');
      return {
        primary: { label: 'Time to pay off', value: `${Math.floor(months / 12)} yr ${months % 12} mo`, type: 'text' },
        items: [
          { label: 'Number of payments', value: months, type: 'int' },
          { label: 'Total interest', value: interest, type: 'money' },
          { label: 'Total paid', value: balance + interest, type: 'money' },
        ],
        chart: { type: 'donut', data: [{ label: 'Balance', value: balance }, { label: 'Interest', value: interest }] },
        table: {
          title: 'Payment needed to be debt-free in…', head: ['Payoff time', 'Monthly payment', 'Total interest'], types: ['text', 'money', 'money'],
          rows: [12, 24, 36, 48, 60].map((n) => { const p = pmt(r, n, balance); return [`${n} months`, p, p * n - balance]; }),
        },
      };
    },
    about: '<p>Interest is charged monthly at APR ÷ 12 on the remaining balance, assuming no new purchases. Paying even a little more each month can dramatically shorten payoff time. The table uses the amortization formula to find the fixed payment that clears the balance in a set number of months.</p>',
  },
  {
    id: 'profit-margin',
    name: 'Profit Margin Calculator',
    cat: 'finance',
    icon: '📊',
    desc: 'Gross profit, margin and markup from cost and selling price.',
    keywords: 'markup margin business price cost revenue',
    inputs: [
      { id: 'cost', label: 'Cost', type: 'number', value: 60, money: true },
      { id: 'price', label: 'Selling price', type: 'number', value: 100, money: true },
    ],
    compute(v) {
      const c = req(v.cost, 'Cost', { min: 0 });
      const p = req(v.price, 'Selling price', { gt: 0 });
      const profit = p - c;
      const items = [{ label: 'Gross profit', value: profit, type: 'money' }];
      if (c > 0) items.push({ label: 'Markup', value: profit / c * 100, type: 'percent' });
      return {
        primary: { label: 'Profit margin', value: profit / p * 100, type: 'percent' },
        items,
        note: profit < 0 ? 'You are selling below cost (a loss).' : undefined,
      };
    },
    about: '<p>Margin = profit ÷ price. Markup = profit ÷ cost. A 50% markup equals a 33.3% margin; margin can never reach 100% unless the cost is zero.</p>',
  },
  {
    id: 'break-even',
    name: 'Break-Even Calculator',
    cat: 'finance',
    icon: '⚖️',
    desc: 'How many units you need to sell to cover your costs.',
    keywords: 'business fixed cost variable cost units',
    inputs: [
      { id: 'fixed', label: 'Fixed costs', type: 'number', value: 10000, money: true },
      { id: 'price', label: 'Price per unit', type: 'number', value: 50, money: true },
      { id: 'var', label: 'Variable cost per unit', type: 'number', value: 30, money: true },
    ],
    compute(v) {
      const fixed = req(v.fixed, 'Fixed costs', { min: 0 });
      const price = req(v.price, 'Price per unit', { gt: 0 });
      const vc = opt(v.var, 'Variable cost per unit', { min: 0 });
      const cm = price - vc;
      if (cm <= 0) throw new Error('Price per unit must exceed variable cost per unit.');
      const units = fixed / cm;
      return {
        primary: { label: 'Break-even units', value: Math.ceil(units - 1e-9), type: 'int' },
        items: [
          { label: 'Break-even revenue', value: fixed / (cm / price), type: 'money' },
          { label: 'Contribution margin / unit', value: cm, type: 'money' },
          { label: 'Contribution margin ratio', value: cm / price * 100, type: 'percent' },
        ],
      };
    },
    about: '<p>Break-even units = fixed costs ÷ (price − variable cost per unit), rounded up to a whole unit. Break-even revenue = fixed costs ÷ contribution margin ratio.</p>',
  },
  {
    id: 'zakat',
    name: 'Zakat Calculator',
    cat: 'finance',
    icon: '🌙',
    desc: 'Calculate Zakat (2.5%) on your net zakatable wealth above the Nisab threshold.',
    keywords: 'zakat nisab islam gold silver charity যাকাত',
    inputs: [
      { id: 'cash', label: 'Cash & bank balance', type: 'number', value: 200000, money: true },
      { id: 'gold', label: 'Value of gold', type: 'number', value: 0, money: true },
      { id: 'silver', label: 'Value of silver', type: 'number', value: 0, money: true },
      { id: 'invest', label: 'Investments & shares', type: 'number', value: 0, money: true },
      { id: 'business', label: 'Business stock / receivables', type: 'number', value: 0, money: true },
      { id: 'debts', label: 'Debts due now', type: 'number', value: 0, money: true },
      // No fixed default: Nisab depends on today's metal price and the currency, so a hard-coded number would
      // be wrong almost everywhere. Without it the result shows 2.5% and asks for the Nisab to confirm liability.
      { id: 'nisab', label: 'Nisab threshold', type: 'number', value: '', money: true, placeholder: 'Silver price per gram × 612.36', help: 'Value of 612.36 g (52.5 tola) of silver or 87.48 g (7.5 tola) of gold at today\'s local price.' },
    ],
    compute(v) {
      const labels = { cash: 'Cash', gold: 'Gold value', silver: 'Silver value', invest: 'Investments', business: 'Business stock' };
      const assets = Object.keys(labels).reduce((s, k) => s + opt(v[k], labels[k], { min: 0 }), 0);
      const debts = opt(v.debts, 'Debts', { min: 0 });
      const nisab = opt(v.nisab, 'Nisab threshold', { gt: 0, def: NaN });
      const net = assets - debts;
      if (!Number.isFinite(nisab)) {
        return {
          primary: { label: 'Zakat if your wealth is above the Nisab', value: Math.max(net, 0) * 0.025, type: 'money' },
          items: [
            { label: 'Total assets', value: assets, type: 'money' },
            { label: 'Net zakatable wealth', value: net, type: 'money' },
          ],
          note: 'Enter the Nisab threshold (today\'s value of 612.36 g of silver or 87.48 g of gold) to check whether Zakat is obligatory.',
        };
      }
      const due = net >= nisab ? net * 0.025 : 0;
      return {
        primary: { label: 'Zakat payable', value: due, type: 'money' },
        items: [
          { label: 'Total assets', value: assets, type: 'money' },
          { label: 'Net zakatable wealth', value: net, type: 'money' },
          { label: 'Above / below Nisab by', value: net - nisab, type: 'money' },
        ],
        note: due === 0 ? 'Your net wealth is below the Nisab, so Zakat is not obligatory.' : 'Zakat is due when this wealth has been held for one lunar year (hawl).',
      };
    },
    about: '<p>Zakat is 2.5% of net zakatable wealth held for one lunar (Hijri) year, if it is at or above the Nisab. Some scholars use 2.577% when the hawl is tracked on the solar calendar, since a solar year is about 11 days longer. Enter the Nisab using today\'s gold or silver price in your country (612.36 g of silver or 87.48 g of gold; in Bangladesh, 52.5 vori of silver or 7.5 vori of gold at the current BAJUS rate). Until you enter it, the calculator shows 2.5% of your net wealth without confirming that Zakat is obligatory. Consult a scholar for specific situations.</p>',
  },
];
