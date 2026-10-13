import { num, amortize } from '../util.js';

const termOptions = [
  ['30', '30 years'], ['25', '25 years'], ['20', '20 years'], ['15', '15 years'], ['10', '10 years'],
];

function scheduleTable(yearly) {
  return {
    title: 'Amortization schedule (yearly)',
    head: ['Year', 'Interest', 'Principal', 'Balance'],
    types: ['int', 'money', 'money', 'money'],
    rows: yearly.map((r) => [r.year, r.interest, r.principal, r.balance]),
  };
}

export default [
  {
    id: 'mortgage',
    name: 'Mortgage Calculator',
    cat: 'finance',
    icon: '🏠',
    desc: 'Estimate your monthly mortgage payment including taxes, insurance and HOA, with a full amortization schedule.',
    keywords: 'home loan house payment amortization pmi',
    inputs: [
      { id: 'price', label: 'Home price', type: 'number', value: 400000, money: true },
      { id: 'down', label: 'Down payment', type: 'number', value: 20, suffix: '%' },
      { id: 'rate', label: 'Interest rate', type: 'number', value: 6.5, suffix: '%', step: 0.01 },
      { id: 'years', label: 'Loan term', type: 'select', value: '30', options: termOptions },
      { id: 'tax', label: 'Property tax (yearly)', type: 'number', value: 1.2, suffix: '%', step: 0.01 },
      { id: 'ins', label: 'Home insurance (yearly)', type: 'number', value: 1500, money: true },
      { id: 'hoa', label: 'HOA fee (monthly)', type: 'number', value: 0, money: true },
    ],
    compute(v) {
      const price = num(v.price);
      const downAmt = price * num(v.down) / 100;
      const loan = Math.max(price - downAmt, 0);
      const months = num(v.years) * 12;
      const a = amortize(loan, num(v.rate), months);
      const tax = price * num(v.tax) / 100 / 12;
      const ins = num(v.ins) / 12;
      const hoa = num(v.hoa);
      const total = a.payment + tax + ins + hoa;
      return {
        primary: { label: 'Monthly payment', value: total, type: 'money' },
        items: [
          { label: 'Principal & interest', value: a.payment, type: 'money' },
          { label: 'Property tax', value: tax, type: 'money' },
          { label: 'Home insurance', value: ins, type: 'money' },
          { label: 'HOA', value: hoa, type: 'money' },
          { label: 'Loan amount', value: loan, type: 'money' },
          { label: 'Down payment', value: downAmt, type: 'money' },
          { label: 'Total interest', value: a.totalInterest, type: 'money' },
          { label: 'Total of all payments', value: a.totalPaid + (tax + ins + hoa) * months, type: 'money' },
        ],
        chart: {
          type: 'donut',
          data: [
            { label: 'Principal & interest', value: a.payment },
            { label: 'Tax', value: tax },
            { label: 'Insurance', value: ins },
            { label: 'HOA', value: hoa },
          ],
        },
        table: scheduleTable(a.yearly),
      };
    },
    about: `<p>The monthly principal and interest is calculated with the standard amortization formula
      <code>M = P·r(1+r)<sup>n</sup> / ((1+r)<sup>n</sup> − 1)</code>, where <em>P</em> is the loan amount,
      <em>r</em> the monthly interest rate and <em>n</em> the number of monthly payments. Property tax, insurance
      and HOA dues are added on top to give your full housing payment.</p>
      <p>Tip: a larger down payment reduces both your monthly payment and the total interest paid. In many
      markets a down payment below 20% also requires private mortgage insurance (PMI).</p>`,
  },
  {
    id: 'loan',
    name: 'Loan Calculator',
    cat: 'finance',
    icon: '💳',
    desc: 'Calculate the payment, total interest and payoff time for any fixed-rate loan — and see how extra payments save money.',
    keywords: 'personal loan payment interest extra payment payoff',
    inputs: [
      { id: 'amount', label: 'Loan amount', type: 'number', value: 25000, money: true },
      { id: 'rate', label: 'Interest rate (yearly)', type: 'number', value: 8, suffix: '%', step: 0.01 },
      { id: 'years', label: 'Loan term', type: 'number', value: 5, suffix: 'years' },
      { id: 'extra', label: 'Extra monthly payment', type: 'number', value: 0, money: true },
    ],
    compute(v) {
      const P = num(v.amount);
      const months = Math.round(num(v.years) * 12);
      if (months <= 0) throw new Error('Loan term must be greater than zero.');
      const base = amortize(P, num(v.rate), months);
      const withExtra = amortize(P, num(v.rate), months, num(v.extra));
      const items = [
        { label: 'Total interest', value: withExtra.totalInterest, type: 'money' },
        { label: 'Total paid', value: withExtra.totalPaid, type: 'money' },
        { label: 'Number of payments', value: withExtra.months, type: 'int' },
      ];
      if (num(v.extra) > 0) {
        items.push(
          { label: 'Interest saved', value: base.totalInterest - withExtra.totalInterest, type: 'money' },
          { label: 'Months saved', value: base.months - withExtra.months, type: 'int' },
        );
      }
      return {
        primary: { label: 'Monthly payment', value: base.payment + num(v.extra), type: 'money' },
        items,
        chart: { type: 'donut', data: [{ label: 'Principal', value: P }, { label: 'Interest', value: withExtra.totalInterest }] },
        table: scheduleTable(withExtra.yearly),
      };
    },
    about: `<p>Uses the standard amortization formula to find the fixed monthly payment. Any extra payment is applied
      directly to principal, which shortens the loan and reduces total interest — the calculator shows exactly how much
      you save.</p>`,
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
      const P = num(v.amount);
      const n = Math.round(num(v.months));
      if (n <= 0) throw new Error('Tenure must be at least 1 month.');
      const a = amortize(P, num(v.rate), n);
      return {
        primary: { label: 'Monthly EMI', value: a.payment, type: 'money' },
        items: [
          { label: 'Total interest', value: a.totalInterest, type: 'money' },
          { label: 'Total payable', value: a.totalPaid, type: 'money' },
          { label: 'Interest share', value: a.totalPaid ? a.totalInterest / a.totalPaid * 100 : 0, type: 'percent' },
        ],
        chart: { type: 'donut', data: [{ label: 'Principal', value: P }, { label: 'Interest', value: a.totalInterest }] },
        table: scheduleTable(a.yearly),
      };
    },
    about: `<p><code>EMI = P·r(1+r)<sup>n</sup> / ((1+r)<sup>n</sup> − 1)</code>, where <em>r</em> is the yearly rate
      divided by 12 and <em>n</em> is the tenure in months. Banks in Bangladesh, India and elsewhere use this reducing-balance
      method for most retail loans.</p>`,
  },
  {
    id: 'auto-loan',
    name: 'Auto Loan Calculator',
    cat: 'finance',
    icon: '🚗',
    desc: 'Work out your car payment including sales tax, down payment and trade-in value.',
    keywords: 'car loan vehicle financing payment',
    inputs: [
      { id: 'price', label: 'Vehicle price', type: 'number', value: 35000, money: true },
      { id: 'down', label: 'Down payment', type: 'number', value: 5000, money: true },
      { id: 'trade', label: 'Trade-in value', type: 'number', value: 0, money: true },
      { id: 'tax', label: 'Sales tax', type: 'number', value: 7, suffix: '%', step: 0.01 },
      { id: 'rate', label: 'Interest rate', type: 'number', value: 6.9, suffix: '%', step: 0.01 },
      { id: 'months', label: 'Loan term', type: 'select', value: '60', options: [['36', '36 months'], ['48', '48 months'], ['60', '60 months'], ['72', '72 months'], ['84', '84 months']] },
    ],
    compute(v) {
      const price = num(v.price);
      const taxAmt = Math.max(price - num(v.trade), 0) * num(v.tax) / 100;
      const loan = Math.max(price + taxAmt - num(v.down) - num(v.trade), 0);
      const a = amortize(loan, num(v.rate), num(v.months));
      return {
        primary: { label: 'Monthly payment', value: a.payment, type: 'money' },
        items: [
          { label: 'Amount financed', value: loan, type: 'money' },
          { label: 'Sales tax', value: taxAmt, type: 'money' },
          { label: 'Total interest', value: a.totalInterest, type: 'money' },
          { label: 'Total cost of car', value: a.totalPaid + num(v.down) + num(v.trade), type: 'money' },
        ],
        chart: { type: 'donut', data: [{ label: 'Principal', value: loan }, { label: 'Interest', value: a.totalInterest }] },
        table: scheduleTable(a.yearly),
      };
    },
    about: `<p>Sales tax is applied to the price after the trade-in credit (as in most US states). The amount financed is the
      price plus tax, minus your down payment and trade-in.</p>`,
  },
  {
    id: 'compound-interest',
    name: 'Compound Interest Calculator',
    cat: 'finance',
    icon: '📈',
    desc: 'See how your savings grow with compound interest and regular monthly contributions.',
    keywords: 'investment growth savings future value interest on interest',
    inputs: [
      { id: 'principal', label: 'Initial deposit', type: 'number', value: 10000, money: true },
      { id: 'monthly', label: 'Monthly contribution', type: 'number', value: 200, money: true },
      { id: 'rate', label: 'Annual interest rate', type: 'number', value: 7, suffix: '%', step: 0.01 },
      { id: 'years', label: 'Years', type: 'number', value: 20 },
      { id: 'n', label: 'Compounding', type: 'select', value: '12', options: [['1', 'Yearly'], ['2', 'Half-yearly'], ['4', 'Quarterly'], ['12', 'Monthly'], ['365', 'Daily']] },
    ],
    compute(v) {
      const years = Math.min(Math.max(Math.round(num(v.years)), 0), 100);
      const n = num(v.n) || 12;
      const r = num(v.rate) / 100;
      const monthlyRate = Math.pow(1 + r / n, n / 12) - 1; // effective monthly
      let bal = num(v.principal);
      let contributed = bal;
      const rows = [];
      const bars = [];
      for (let y = 1; y <= years; y++) {
        for (let m = 0; m < 12; m++) {
          bal = bal * (1 + monthlyRate) + num(v.monthly);
          contributed += num(v.monthly);
        }
        rows.push([y, contributed, bal - contributed, bal]);
        bars.push({ label: String(y), value: bal, parts: [contributed, bal - contributed] });
      }
      return {
        primary: { label: `Balance after ${years} years`, value: bal, type: 'money' },
        items: [
          { label: 'Total contributions', value: contributed, type: 'money' },
          { label: 'Total interest earned', value: bal - contributed, type: 'money' },
          { label: 'Effective annual rate', value: (Math.pow(1 + r / n, n) - 1) * 100, type: 'percent' },
        ],
        chart: { type: 'stacked', legend: ['Contributions', 'Interest'], data: bars },
        table: { title: 'Growth by year', head: ['Year', 'Contributions', 'Interest', 'Balance'], types: ['int', 'money', 'money', 'money'], rows },
      };
    },
    about: `<p>Compound interest means you earn interest on previously earned interest. The formula for a lump sum is
      <code>A = P(1 + r/n)<sup>nt</sup></code>. Monthly contributions are added at the end of each month and grow at the
      equivalent monthly rate.</p>`,
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
      { id: 't', label: 'Time', type: 'number', value: 3, suffix: 'years', step: 0.01 },
    ],
    compute(v) {
      const I = num(v.p) * num(v.r) / 100 * num(v.t);
      return {
        primary: { label: 'Interest', value: I, type: 'money' },
        items: [{ label: 'Total amount', value: num(v.p) + I, type: 'money' }],
      };
    },
    about: '<p><code>I = P × r × t</code>. Unlike compound interest, simple interest is only earned on the original principal.</p>',
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
      const years = num(v.retire) - num(v.age);
      if (years <= 0) throw new Error('Retirement age must be greater than current age.');
      const mr = Math.pow(1 + num(v.ret) / 100, 1 / 12) - 1;
      let bal = num(v.saved);
      const bars = [];
      let contrib = bal;
      for (let y = 1; y <= years; y++) {
        for (let m = 0; m < 12; m++) {
          bal = bal * (1 + mr) + num(v.monthly);
          contrib += num(v.monthly);
        }
        bars.push({ label: String(num(v.age) + y), value: bal, parts: [contrib, bal - contrib] });
      }
      const real = bal / Math.pow(1 + num(v.inf) / 100, years);
      return {
        primary: { label: `Savings at age ${num(v.retire)}`, value: bal, type: 'money' },
        items: [
          { label: "In today's money", value: real, type: 'money' },
          { label: 'Monthly income (today\'s money)', value: real * num(v.wd) / 100 / 12, type: 'money' },
          { label: 'Total contributed', value: contrib, type: 'money' },
          { label: 'Investment growth', value: bal - contrib, type: 'money' },
        ],
        chart: { type: 'stacked', legend: ['Contributions', 'Growth'], data: bars },
      };
    },
    about: `<p>Savings grow at your expected return, compounded monthly. The result is then deflated by inflation to show
      its purchasing power today. The monthly income uses the chosen withdrawal rate (the popular "4% rule" suggests
      withdrawing 4% of the portfolio in the first year).</p><p>Projections are estimates, not guarantees; real returns vary.</p>`,
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
      const n = Math.round(num(v.years) * 12);
      if (n <= 0) throw new Error('Time to goal must be greater than zero.');
      const i = num(v.rate) / 100 / 12;
      const grow = Math.pow(1 + i, n);
      const fvCurrent = num(v.current) * grow;
      const need = num(v.goal) - fvCurrent;
      const monthly = need <= 0 ? 0 : i === 0 ? need / n : need * i / (grow - 1);
      const deposits = monthly * n;
      return {
        primary: { label: 'Required monthly saving', value: monthly, type: 'money' },
        items: [
          { label: 'Total deposits', value: deposits + num(v.current), type: 'money' },
          { label: 'Interest earned', value: need <= 0 ? fvCurrent - num(v.current) : num(v.goal) - deposits - num(v.current), type: 'money' },
        ],
        note: need <= 0 ? 'Your current savings will reach the goal on their own. 🎉' : undefined,
      };
    },
    about: '<p>Solves the future-value-of-annuity formula for the payment: <code>PMT = (FV − PV(1+i)<sup>n</sup>) · i / ((1+i)<sup>n</sup> − 1)</code>.</p>',
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
      const c = num(v.cost);
      if (c <= 0) throw new Error('Amount invested must be greater than zero.');
      const gain = num(v.value) - c;
      const y = num(v.years);
      return {
        primary: { label: 'ROI', value: gain / c * 100, type: 'percent' },
        items: [
          { label: 'Investment gain', value: gain, type: 'money' },
          { label: 'Annualized return (CAGR)', value: y > 0 && num(v.value) > 0 ? (Math.pow(num(v.value) / c, 1 / y) - 1) * 100 : 0, type: 'percent' },
        ],
      };
    },
    about: '<p><code>ROI = (Return − Cost) / Cost</code>. CAGR spreads the return evenly over the years: <code>(End/Start)<sup>1/years</sup> − 1</code>.</p>',
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
      const f = Math.pow(1 + num(v.rate) / 100, num(v.years));
      return {
        primary: { label: 'Equivalent future cost', value: num(v.amount) * f, type: 'money' },
        items: [
          { label: 'Future purchasing power of today\'s amount', value: num(v.amount) / f, type: 'money' },
          { label: 'Cumulative inflation', value: (f - 1) * 100, type: 'percent' },
        ],
      };
    },
    about: '<p>Future cost = amount × (1 + inflation)<sup>years</sup>. Purchasing power is the reverse: what today\'s money will buy in the future.</p>',
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
      { id: 'per', label: 'Per', type: 'select', value: 'year', options: [['hour', 'Hour'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']] },
      { id: 'hours', label: 'Hours per week', type: 'number', value: 40 },
      { id: 'days', label: 'Days per week', type: 'number', value: 5 },
    ],
    compute(v) {
      const h = num(v.hours) || 40;
      const d = num(v.days) || 5;
      const perYear = { hour: h * 52, day: d * 52, week: 52, month: 12, year: 1 };
      const yearly = num(v.amount) * perYear[v.per];
      const rows = [['Hourly', yearly / perYear.hour], ['Daily', yearly / perYear.day], ['Weekly', yearly / 52], ['Bi-weekly', yearly / 26], ['Monthly', yearly / 12], ['Yearly', yearly]];
      return {
        primary: { label: 'Yearly salary', value: yearly, type: 'money' },
        items: rows.map(([label, value]) => ({ label, value, type: 'money' })),
      };
    },
    about: '<p>Assumes 52 working weeks per year and no unpaid leave. Adjust hours and days to match your contract.</p>',
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
      { id: 'tax', label: 'Tax / VAT', type: 'number', value: 0, suffix: '%' },
    ],
    compute(v) {
      const sale = num(v.price) * (1 - num(v.off) / 100);
      const tax = sale * num(v.tax) / 100;
      return {
        primary: { label: 'Final price', value: sale + tax, type: 'money' },
        items: [
          { label: 'You save', value: num(v.price) - sale, type: 'money' },
          { label: 'Price before tax', value: sale, type: 'money' },
          { label: 'Tax', value: tax, type: 'money' },
        ],
      };
    },
    about: '<p>Sale price = original × (1 − discount%). Tax is applied to the discounted price.</p>',
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
      const tip = num(v.bill) * num(v.pct) / 100;
      const p = Math.max(Math.round(num(v.people)), 1);
      return {
        primary: { label: 'Each person pays', value: (num(v.bill) + tip) / p, type: 'money' },
        items: [
          { label: 'Tip amount', value: tip, type: 'money' },
          { label: 'Total bill', value: num(v.bill) + tip, type: 'money' },
          { label: 'Tip per person', value: tip / p, type: 'money' },
        ],
      };
    },
    about: '<p>Tip = bill × tip%. The total is divided equally between everyone.</p>',
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
      const r = num(v.rate) / 100;
      const net = v.mode === 'add' ? num(v.amount) : num(v.amount) / (1 + r);
      const gross = net * (1 + r);
      return {
        primary: { label: v.mode === 'add' ? 'Gross amount (incl. tax)' : 'Net amount (excl. tax)', value: v.mode === 'add' ? gross : net, type: 'money' },
        items: [
          { label: 'Tax amount', value: gross - net, type: 'money' },
          { label: 'Net', value: net, type: 'money' },
          { label: 'Gross', value: gross, type: 'money' },
        ],
      };
    },
    about: '<p>Adding tax: gross = net × (1 + rate). Removing tax: net = gross ÷ (1 + rate). Note that removing 15% VAT is <em>not</em> the same as subtracting 15%.</p>',
  },
  {
    id: 'credit-card',
    name: 'Credit Card Payoff Calculator',
    cat: 'finance',
    icon: '💳',
    desc: 'How long will it take to pay off your credit card, and how much interest will you pay?',
    keywords: 'debt payoff apr balance',
    inputs: [
      { id: 'balance', label: 'Card balance', type: 'number', value: 5000, money: true },
      { id: 'apr', label: 'APR', type: 'number', value: 22, suffix: '%', step: 0.01 },
      { id: 'pay', label: 'Monthly payment', type: 'number', value: 200, money: true },
    ],
    compute(v) {
      let bal = num(v.balance);
      const r = num(v.apr) / 100 / 12;
      const pay = num(v.pay);
      if (pay <= bal * r) throw new Error(`Your payment must be more than the monthly interest (${(bal * r).toFixed(2)}) or the debt will never be paid off.`);
      let months = 0;
      let interest = 0;
      while (bal > 0.005 && months < 1200) {
        const i = bal * r;
        interest += i;
        bal = bal + i - Math.min(pay, bal + i);
        months++;
      }
      return {
        primary: { label: 'Time to pay off', value: `${Math.floor(months / 12)} yr ${months % 12} mo`, type: 'text' },
        items: [
          { label: 'Number of payments', value: months, type: 'int' },
          { label: 'Total interest', value: interest, type: 'money' },
          { label: 'Total paid', value: num(v.balance) + interest, type: 'money' },
        ],
        chart: { type: 'donut', data: [{ label: 'Balance', value: num(v.balance) }, { label: 'Interest', value: interest }] },
      };
    },
    about: '<p>Interest is charged monthly at APR ÷ 12 on the remaining balance. Paying even a little more each month can dramatically shorten payoff time.</p>',
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
      const c = num(v.cost);
      const p = num(v.price);
      const profit = p - c;
      return {
        primary: { label: 'Profit margin', value: p ? profit / p * 100 : 0, type: 'percent' },
        items: [
          { label: 'Gross profit', value: profit, type: 'money' },
          { label: 'Markup', value: c ? profit / c * 100 : 0, type: 'percent' },
        ],
      };
    },
    about: '<p>Margin = profit ÷ price. Markup = profit ÷ cost. A 50% markup equals a 33.3% margin.</p>',
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
      const cm = num(v.price) - num(v.var);
      if (cm <= 0) throw new Error('Price per unit must exceed variable cost per unit.');
      const units = num(v.fixed) / cm;
      return {
        primary: { label: 'Break-even units', value: Math.ceil(units), type: 'int' },
        items: [
          { label: 'Break-even revenue', value: Math.ceil(units) * num(v.price), type: 'money' },
          { label: 'Contribution margin / unit', value: cm, type: 'money' },
          { label: 'Contribution margin ratio', value: cm / num(v.price) * 100, type: 'percent' },
        ],
      };
    },
    about: '<p>Break-even units = fixed costs ÷ (price − variable cost per unit).</p>',
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
      { id: 'nisab', label: 'Nisab threshold', type: 'number', value: 85000, money: true, help: 'Value of 612.36 g (52.5 tola) of silver or 87.48 g (7.5 tola) of gold at today\'s local price.' },
    ],
    compute(v) {
      const assets = ['cash', 'gold', 'silver', 'invest', 'business'].reduce((s, k) => s + num(v[k]), 0);
      const net = assets - num(v.debts);
      const due = net >= num(v.nisab) ? net * 0.025 : 0;
      return {
        primary: { label: 'Zakat payable', value: due, type: 'money' },
        items: [
          { label: 'Total assets', value: assets, type: 'money' },
          { label: 'Net zakatable wealth', value: net, type: 'money' },
        ],
        note: due === 0 ? 'Your net wealth is below the Nisab, so Zakat is not obligatory.' : 'Zakat is due when this wealth has been held for one lunar year (hawl).',
      };
    },
    about: '<p>Zakat is 2.5% of net zakatable wealth held for one lunar year, if it is at or above the Nisab. Enter the Nisab using today\'s gold or silver price in your country. Consult a scholar for specific situations.</p>',
  },
];

