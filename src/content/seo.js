// SEO copy used by scripts/build.mjs: search titles, meta descriptions and category hub intros.
// Titles/descriptions fall back to the calculator's own name/desc, so new calculators need no entry.

/** Keyword-focused <title> text (without the site name). Keep under ~50 chars so " | CalcHub" fits in 60. */
export const TITLES = {
  mortgage: 'Mortgage Calculator with Taxes, PMI & Extra Payments',
  loan: 'Loan Calculator: Payment, Interest & Payoff Date',
  emi: 'EMI Calculator for Home, Car & Personal Loans',
  'auto-loan': 'Auto Loan Calculator with Trade-In & Sales Tax',
  'compound-interest': 'Compound Interest Calculator with Contributions',
  'simple-interest': 'Simple Interest Calculator (P × R × T)',
  retirement: 'Retirement Calculator: How Much Do I Need?',
  'savings-goal': 'Savings Goal Calculator: Monthly Amount Needed',
  roi: 'ROI Calculator: Return on Investment & CAGR',
  inflation: 'Inflation Calculator: Future Value of Money',
  salary: 'Salary Converter: Hourly to Annual & Monthly',
  discount: 'Discount Calculator: Sale Price & Savings',
  tip: 'Tip Calculator & Bill Splitter',
  vat: 'VAT Calculator: Add or Remove VAT / Sales Tax',
  'credit-card': 'Credit Card Payoff Calculator',
  'profit-margin': 'Profit Margin & Markup Calculator',
  'break-even': 'Break-Even Point Calculator',
  zakat: 'Zakat Calculator: Nisab & 2.5% Zakat Due',
  investment: 'Investment Calculator: Growth with Contributions',
  sip: 'SIP Calculator with Annual Step-Up',
  cagr: 'CAGR Calculator: Compound Annual Growth Rate',
  depreciation: 'Depreciation Calculator: Straight-Line & DDB',
  'rent-vs-buy': 'Rent vs Buy Calculator: Should I Buy a House?',
  'debt-to-income': 'Debt-to-Income Ratio (DTI) Calculator',
  'net-worth': 'Net Worth Calculator: Assets minus Liabilities',
  'npv-irr': 'NPV & IRR Calculator with Payback Period',
  'interest-rate': 'Interest Rate Calculator: Find Your Loan APR',
  'house-affordability': 'House Affordability Calculator (28/36 Rule)',
  bmi: 'BMI Calculator: Body Mass Index for Adults',
  calorie: 'Calorie Calculator: Daily Calories (TDEE)',
  bmr: 'BMR Calculator: Basal Metabolic Rate',
  'body-fat': 'Body Fat Calculator (U.S. Navy Method)',
  'ideal-weight': 'Ideal Weight Calculator by Height',
  pace: 'Pace Calculator for Running: Min/Km & Min/Mile',
  'due-date': 'Pregnancy Due Date Calculator & Week by Week',
  'heart-rate': 'Heart Rate Zone Calculator (Karvonen)',
  sleep: 'Sleep Calculator: Best Bedtime & Wake-Up Time',
  macro: 'Macro Calculator: Protein, Carbs & Fat Grams',
  ovulation: 'Ovulation Calculator & Fertile Window',
  scientific: 'Scientific Calculator Online (Free)',
  percentage: 'Percentage Calculator: % Of, Change & Increase',
  fraction: 'Fraction Calculator with Steps & Mixed Numbers',
  quadratic: 'Quadratic Equation Solver (Formula Calculator)',
  statistics: 'Statistics Calculator: Mean, Median, SD',
  'gcd-lcm': 'GCF & LCM Calculator',
  prime: 'Prime Number Checker & Prime Factorization',
  random: 'Random Number Generator (Secure)',
  triangle: 'Right Triangle Calculator: Sides & Angles',
  'area-volume': 'Area & Volume Calculator for Shapes',
  logarithm: 'Log Calculator: Log Base 10, ln & Any Base',
  'scientific-notation': 'Scientific Notation Converter & Calculator',
  'sig-figs': 'Significant Figures (Sig Fig) Calculator',
  ratio: 'Ratio & Proportion Calculator',
  'weighted-average': 'Weighted Average Calculator',
  'percent-error': 'Percent Error Calculator',
  'unit-converter': 'Unit Converter: Length, Weight, Area & More',
  'base-converter': 'Binary, Hex & Decimal Converter',
  'roman-numerals': 'Roman Numeral Converter (1–3999)',
  'bd-income-tax': 'Bangladesh Income Tax Calculator 2026-27',
  'bd-sanchayapatra': 'Sanchayapatra Profit Calculator Bangladesh',
  'bd-fdr': 'FDR Calculator Bangladesh: Interest & Tax',
  'bd-dps': 'DPS Calculator Bangladesh: Maturity Amount',
  'bd-gold-price': 'Gold Price Calculator BD: Vori, Ana & Gram',
  'bd-electricity-bill': 'Electricity Bill Calculator Bangladesh',
  'bd-govt-pension': 'Govt Pension & Gratuity Calculator BD',
  'bd-gpf': 'GPF Interest Calculator Bangladesh',
  age: 'Age Calculator: Exact Age in Years, Months, Days',
  'date-difference': 'Date Difference Calculator: Days Between Dates',
  'date-add': 'Add or Subtract Days to a Date',
  'time-duration': 'Time Duration Calculator: Hours Between Times',
  gpa: 'GPA Calculator (4.0 Scale)',
  'fuel-cost': 'Fuel Cost Calculator for Trips',
  electricity: 'Electricity Cost Calculator for Appliances',
  password: 'Strong Password Generator (Secure & Private)',
  'day-of-week': 'Day of the Week Calculator for Any Date',
  countdown: 'Days Until Calculator: Countdown to Any Date',
  'time-card': 'Time Card Calculator with Overtime',
  concrete: 'Concrete Calculator: Cubic Yards & Bags',
  tile: 'Tile Calculator: How Many Tiles Do I Need?',
  'square-footage': 'Square Footage Calculator',
  'final-grade': 'Final Grade Calculator: What Do I Need?',
};

/** Hand-written meta descriptions where the calculator's own desc is too long or too thin (≤155 chars). */
export const DESCRIPTIONS = {
  'bd-income-tax': 'Free Bangladesh income tax calculator for FY 2026-27: tax-free threshold, slab-by-slab tax, investment rebate and minimum tax under the NBR rules.',
  'bd-sanchayapatra': 'Calculate Sanchayapatra profit in Bangladesh: 5-year, 3-month, Paribar and Pensioner savings certificates with current rates and source tax.',
  'bd-gold-price': 'Gold price calculator for Bangladesh: price by vori, ana, rati or gram for 22K, 21K, 18K and traditional gold, with making charge and VAT.',
  'bd-electricity-bill': 'Calculate your monthly electricity bill in Bangladesh with BERC slab tariffs, demand charge and VAT — for DESCO, DPDC, BREB, NESCO and more.',
  'bd-govt-pension': 'Bangladesh government pension calculator: gross and net pension, commutation, gratuity, leave encashment and allowances under the 2026 pay scale.',
};

/** Intro copy for /category/<id>/ hub pages (HTML). */
export const CATEGORY_INTROS = {
  finance: `<p>Money decisions are easier when you can see the numbers. Our financial calculators cover borrowing (mortgages, car loans, EMIs and credit cards), saving and investing (compound interest, SIPs, retirement and savings goals) and running a business (profit margin, break-even, depreciation, NPV and IRR).</p>
    <p>Every calculator uses the standard formulas lenders and accountants use, shows a full schedule or chart where it helps, and lets you switch currency — including ৳ BDT and ₹ INR with lakh/crore grouping. Results are estimates; check the final figures with your bank or adviser.</p>`,
  health: `<p>Health and fitness calculators based on published, peer-reviewed formulas: BMI with WHO categories, calorie and macro targets from the Mifflin–St Jeor equation, U.S. Navy body-fat estimates, heart-rate zones with the Karvonen method, and pregnancy, ovulation and sleep-cycle planners.</p>
    <p>Each page explains the formula, its limits and where it comes from. These tools are for general information and are not a substitute for advice from a doctor or registered dietitian.</p>`,
  math: `<p>From a full scientific calculator to step-by-step fractions, percentages, quadratic equations and statistics, these math tools are built for students, teachers and anyone who needs a quick, exact answer.</p>
    <p>Calculations use exact arithmetic wherever possible (for example big-integer prime checks and exact decimal handling for significant figures), and every page explains the method so you can check your own working.</p>`,
  convert: `<p>Convert between metric and imperial units, number bases and Roman numerals instantly. The unit converter covers length, weight, temperature, area, volume, speed, time, data, energy, angle, fuel economy and pressure — including South Asian land units such as katha, bigha and decimal.</p>
    <p>Conversion factors use exact international definitions (for example 1 inch = 2.54 cm), so results are accurate to the precision shown.</p>`,
  bangladesh: `<p>Calculators built specifically for Bangladesh: personal income tax under the Income Tax Act 2023, Sanchayapatra (national savings certificate) profit, bank FDR and DPS maturity with source tax and excise duty, gold prices in vori and ana, BERC electricity bills, and government pension, gratuity and GPF.</p>
    <p>Rates come from official sources — the National Board of Revenue, the Finance Division, the Department of National Savings, Bangladesh Bank, BERC and BAJUS — and each page states the fiscal year it applies to and when it was last checked. Always confirm with the official source before acting.</p>`,
  everyday: `<p>Handy tools for daily life: exact age, days between dates, countdowns, time cards and shift durations, GPA and final-grade planners, fuel and electricity costs, home-improvement estimates for concrete, tiles and square footage, and a secure password generator.</p>
    <p>Date calculations handle leap years, month lengths and your choice of weekend (Saturday–Sunday or Friday–Saturday), and everything runs privately in your browser.</p>`,
};

const clamp = (s, n) => {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:—–-]+$/, '')}…`;
};

/** Unique, ≤60-char page title. */
export function seoTitle(c, siteName) {
  const base = TITLES[c.id] || c.name;
  for (const t of [`${base} | ${siteName}`, base, `${c.name} | ${siteName}`, c.name]) if (t.length <= 60) return t;
  return clamp(c.name, 60);
}

/** ≤155-char meta description. */
export function seoDescription(c) {
  let d = DESCRIPTIONS[c.id] || c.desc;
  if (d.length > 155) return clamp(d, 155);
  for (const tail of [' Free, instant and private — no sign-up needed.', ' Free, instant and private.', ' Free and instant.']) {
    if (d.length < 110 && (d + tail).length <= 155) { d += tail; break; }
  }
  return d;
}

export { clamp };
