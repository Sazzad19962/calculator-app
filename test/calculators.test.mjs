import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALCULATORS, byId, search } from '../src/registry.js';
import { evaluate, factorial, doubleFactorial, nCr, nPr, mod, gamma } from '../src/expr.js';
import { convert, toRoman, fromRoman } from '../src/calculators/converters.js';
import { isPrimeBig, factorBig } from '../src/calculators/math.js';
import { businessDays, addBusinessDays } from '../src/calculators/everyday.js';
import finance from '../src/calculators/finance.js';
import health from '../src/calculators/health.js';
import mathCalcs from '../src/calculators/math.js';
import converters from '../src/calculators/converters.js';
import everyday from '../src/calculators/everyday.js';
import {
  amortize, amortizeRate, monthlyRateFrom, pmt, diffYMD, parseDate, addToDate, isoDate, parseNum, num, req, opt, round, sig,
  lcm, parseList, isLeapYear, DAY_MS,
} from '../src/util.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b}`);
const defaults = (c) => Object.fromEntries((c.inputs || []).map((i) => [i.id, typeof i.value === 'function' ? i.value({}) : i.value]));
const run = (id, over = {}) => byId[id].compute({ ...defaults(byId[id]), ...over });
const item = (r, label) => {
  const it = r.items.find((i) => (label instanceof RegExp ? label.test(i.label) : i.label === label));
  assert.ok(it, `no item ${label} in ${r.items.map((i) => i.label).join(', ')}`);
  return it.value;
};
const throwsMsg = (fn, re) => assert.throws(fn, (e) => e instanceof Error && re.test(e.message), `expected error matching ${re}`);

test('every calculator has unique id, metadata and computes with defaults', () => {
  const ids = new Set();
  for (const c of CALCULATORS) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    assert.ok(c.name && c.desc && c.cat && c.about, `${c.id} missing metadata`);
    if (c.custom) continue;
    const r = c.compute(defaults(c));
    assert.ok(r.primary, `${c.id} has no primary result`);
  }
  assert.ok(CALCULATORS.length >= 40);
});

test('amortization: 200k at 6% for 30y = 1199.10/month', () => {
  const a = amortize(200000, 6, 360);
  close(a.payment, 1199.10);
  close(a.totalInterest, 231676.38, 1);
  close(a.yearly.at(-1).balance, 0);
});

test('mortgage includes tax, insurance, HOA', () => {
  const r = run('mortgage', { price: 250000, down: 20, rate: 6, years: '30', tax: 1.2, ins: 1200, hoa: 50 });
  close(r.items[0].value, 1199.10);
  close(r.primary.value, 1199.10 + 250 + 100 + 50);
});

test('loan extra payment saves interest', () => {
  const r = run('loan', { amount: 10000, rate: 10, years: 3, extra: 100 });
  const saved = r.items.find((i) => i.label === 'Interest saved');
  assert.ok(saved.value > 0);
});

test('EMI: 1,000,000 at 10% for 60 months ≈ 21,247', () => {
  close(run('emi').primary.value, 21247.04, 0.05);
});

test('compound interest without contributions matches formula', () => {
  const r = run('compound-interest', { principal: 1000, monthly: 0, rate: 5, years: 10, n: '1' });
  close(r.primary.value, 1000 * 1.05 ** 10);
});

test('VAT add and remove are inverses', () => {
  close(run('vat', { amount: 100, rate: 15, mode: 'add' }).primary.value, 115);
  close(run('vat', { amount: 115, rate: 15, mode: 'remove' }).primary.value, 100);
});

test('credit card payoff rejects too-small payment', () => {
  assert.throws(() => run('credit-card', { balance: 10000, apr: 24, pay: 100 }));
});

test('zakat is 2.5% above nisab, zero below', () => {
  close(run('zakat', { cash: 200000, nisab: 85000 }).primary.value, 5000);
  assert.equal(run('zakat', { cash: 50000, nisab: 85000 }).primary.value, 0);
});

test('BMI metric and imperial agree', () => {
  const m = run('bmi', { units: 'metric', kg: 70, cm: 175 }).primary.value;
  close(m, 22.86);
  const i = run('bmi', { units: 'imperial', lb: 154.32, ft: 5, in: 8.9 }).primary.value;
  close(i, m, 0.05);
});

test('Mifflin–St Jeor BMR', () => {
  close(run('bmr', { units: 'metric', sex: 'male', age: 30, kg: 70, cm: 175 }).primary.value, 1649, 1);
  close(run('bmr', { units: 'metric', sex: 'female', age: 30, kg: 60, cm: 165 }).primary.value, 1320, 1);
});

test('percentage modes', () => {
  close(run('percentage', { mode: 'of', x: 20, y: 150 }).primary.value, 30);
  close(run('percentage', { mode: 'is', x: 30, y: 150 }).primary.value, 20);
  close(run('percentage', { mode: 'change', x: 100, y: 80 }).primary.value, -20);
});

test('fractions simplify', () => {
  assert.match(run('fraction', { a: 3, b: 4, op: '+', c: 5, d: 6 }).primary.value, /^19\/12/);
  assert.equal(run('fraction', { a: 1, b: 2, op: '*', c: 2, d: 1 }).primary.value, '1');
});

test('quadratic roots', () => {
  assert.equal(run('quadratic', { a: 1, b: -3, c: 2 }).primary.value, 'x₁ = 2,  x₂ = 1');
  assert.match(run('quadratic', { a: 1, b: 0, c: 1 }).primary.value, /± 1i/);
});

test('statistics', () => {
  const r = run('statistics', { data: '2 4 4 4 5 5 7 9' });
  close(r.primary.value, 5);
  close(r.items.find((i) => i.label.startsWith('Population std')).value, 2);
});

test('expression evaluator', () => {
  close(evaluate('2+3×4'), 14);
  close(evaluate('-2^2'), -4);
  close(evaluate('2^3^2'), 512);
  close(evaluate('sin(30)', { deg: true }), 0.5);
  close(evaluate('2π'), 2 * Math.PI);
  close(evaluate('√(16)+5!'), 124);
  close(evaluate('50%×200'), 100);
  close(evaluate('log(1000)+ln(e)'), 4);
  close(evaluate('3(4+1)'), 15);
  close(evaluate('Ans×2', { ans: 21 }), 42);
  close(evaluate('sin30', { deg: true }), 0.5);
  close(evaluate('1.5e3'), 1500);
  assert.ok(Number.isNaN(evaluate('tan(90)', { deg: true })));
  assert.throws(() => evaluate('2+*'));
  assert.throws(() => evaluate('alert(1)'));
});

test('unit conversions', () => {
  close(convert('length', 'mi', 'km', 1), 1.609344, 1e-9);
  close(convert('temperature', 'c', 'f', 100), 212, 1e-9);
  close(convert('temperature', 'f', 'k', 32), 273.15, 1e-9);
  close(convert('area', 'acre', 'decimal', 1), 100, 1e-9);
  close(convert('area', 'katha', 'ft2', 1), 720, 1e-6);
});

test('roman numerals round-trip', () => {
  for (const n of [1, 4, 9, 14, 40, 90, 400, 1994, 2026, 3999]) assert.equal(fromRoman(toRoman(n)), n);
  assert.equal(toRoman(1994), 'MCMXCIV');
  assert.throws(() => run('roman-numerals', { value: 'IIII' }));
});

test('base converter handles big numbers', () => {
  const r = run('base-converter', { value: 'ff', from: 16 });
  assert.equal(r.primary.value, '255');
  assert.equal(run('base-converter', { value: '18446744073709551616', from: 10 }).items[2].value, '10000000000000000');
});

test('date helpers', () => {
  assert.deepEqual(diffYMD(parseDate('2000-01-31'), parseDate('2000-03-01')), { years: 0, months: 1, days: 1, sign: 1 });
  assert.equal(addToDate(parseDate('2024-01-31'), { months: 1 }).toISOString().slice(0, 10), '2024-02-29');
  assert.match(run('age', { dob: '1990-05-20', on: '2026-10-13' }).primary.value, /^36 years, 4 months, 23 days/);
});

test('password generator respects options', () => {
  const pw = run('password', { len: 24, upper: false, lower: true, digits: true, symbols: false, similar: false }).primary.value;
  assert.equal(pw.length, 24);
  assert.match(pw, /^[a-z0-9]+$/);
});

test('random unique numbers', () => {
  const r = run('random', { min: 1, max: 10, count: 10, unique: true }).primary.value.split(', ').map(Number);
  assert.equal(new Set(r).size, 10);
});

test('search ranks by name', () => {
  assert.equal(search('mortgage')[0].id, 'mortgage');
  assert.equal(search('bmi')[0].id, 'bmi');
  assert.ok(search('katha').some((c) => c.id === 'unit-converter'));
});


// ───────────────────────────── util ─────────────────────────────

test('parseNum is strict but forgiving of formatting', () => {
  assert.equal(parseNum('1,234.5'), 1234.5);
  assert.equal(parseNum(' $1 000 '), 1000);
  assert.equal(parseNum('৳5,00,000'), 500000);
  assert.equal(parseNum('−5'), -5);
  assert.equal(parseNum('15%'), 15);
  assert.equal(parseNum('1e3'), 1000);
  assert.ok(Number.isNaN(parseNum('')));
  assert.ok(Number.isNaN(parseNum('abc')));
  assert.ok(Number.isNaN(parseNum('12abc')));
  assert.ok(Number.isNaN(parseNum('0x10')));
  assert.ok(Number.isNaN(parseNum('1e999')));
  assert.equal(num('12abc'), 12); // legacy lenient helper unchanged
  assert.equal(num(''), 0);
});

test('req/opt give friendly validation errors', () => {
  throwsMsg(() => req('', 'Loan amount'), /^Enter a loan amount\.$/);
  throwsMsg(() => req('', 'Interest rate'), /^Enter an interest rate\.$/);
  throwsMsg(() => req('abc', 'Rate'), /must be a number/);
  throwsMsg(() => req('-1', 'Rate', { min: 0 }), /can't be negative/);
  throwsMsg(() => req('0', 'Term', { gt: 0 }), /greater than zero/);
  throwsMsg(() => req('2.5', 'People', { int: true }), /whole number/);
  throwsMsg(() => req('1e16', 'Price'), /too large/);
  assert.equal(opt('', 'Extra'), 0);
  assert.equal(opt('', 'Extra', { def: null }), null);
  assert.equal(opt('5', 'Extra'), 5);
});

test('round and sig', () => {
  assert.equal(round(1.005, 2), 1.01);
  assert.equal(round(-1.005, 2), -1.01);
  assert.equal(sig(0.1 + 0.2), '0.3');
  assert.equal(sig(-0), '0');
  assert.equal(sig(1e21), '1e+21');
  assert.equal(sig(NaN), 'NaN');
  assert.equal(sig(Infinity), '∞');
});

test('pmt is stable for tiny and zero rates', () => {
  close(pmt(0, 12, 1200), 100, 1e-12);
  close(pmt(1e-12, 12, 1200), 100, 1e-6);
  close(pmt(0.005, 360, 200000), 1199.101050, 1e-5);
});

test('monthlyRateFrom handles compounding conventions', () => {
  close(monthlyRateFrom(12, 12), 0.01, 1e-15);
  close(Math.pow(1 + monthlyRateFrom(12, 1), 12) - 1, 0.12, 1e-12); // annual compounding → APY = 12%
  close(Math.pow(1 + monthlyRateFrom(10, 'c'), 12), Math.exp(0.1), 1e-12);
  close(Math.pow(1 + monthlyRateFrom(12, 4), 12), 1.03 ** 4, 1e-12);
});

test('amortization schedule pays off exactly, with and without extra', () => {
  const a = amortizeRate(10000, 0.01, 12);
  close(a.payment, 888.49, 0.005);
  assert.equal(a.monthly.at(-1).balance, 0);
  close(a.totalPaid - a.totalInterest, 10000, 1e-6);
  const b = amortizeRate(10000, 0.01, 12, 500);
  assert.ok(b.months < 12 && b.monthly.at(-1).balance === 0);
  close(b.totalPaid - b.totalInterest, 10000, 1e-6);
  assert.equal(amortize(0, 5, 360).months, 0);
});

test('parseDate rejects impossible dates and handles years < 100', () => {
  assert.equal(parseDate('2023-02-29'), null);
  assert.equal(parseDate('2024-13-01'), null);
  assert.equal(parseDate('2024-04-31'), null);
  assert.equal(parseDate('garbage'), null);
  assert.equal(parseDate(''), null);
  assert.equal(isoDate(parseDate('2024-02-29')), '2024-02-29');
  assert.equal(isoDate(parseDate('0050-06-01')), '0050-06-01');
  assert.equal(parseDate('0050-06-01').getUTCFullYear(), 50);
});

test('leap years and month-end date arithmetic', () => {
  assert.ok(isLeapYear(2000) && isLeapYear(2024) && !isLeapYear(1900) && !isLeapYear(2023));
  assert.equal(isoDate(addToDate(parseDate('2024-02-29'), { years: 1 })), '2025-02-28');
  assert.equal(isoDate(addToDate(parseDate('2024-02-29'), { years: 4 })), '2028-02-29');
  assert.equal(isoDate(addToDate(parseDate('2024-03-31'), { months: -1 })), '2024-02-29');
  assert.equal(isoDate(addToDate(parseDate('2024-12-31'), { days: 1 })), '2025-01-01');
  assert.equal(isoDate(addToDate(parseDate('0099-12-31'), { days: 1 })), '0100-01-01');
  assert.deepEqual(diffYMD(parseDate('2000-02-29'), parseDate('2001-02-28')), { years: 1, months: 0, days: 0, sign: 1 });
  assert.deepEqual(diffYMD(parseDate('2024-03-01'), parseDate('2024-01-01')), { years: 0, months: 2, days: 0, sign: -1 });
});

test('lcm and parseList', () => {
  assert.equal(lcm(4, 6), 12);
  assert.equal(lcm(0, 6), 0);
  assert.deepEqual(parseList('1, 2 3;4 x 1e2 −5'), [1, 2, 3, 4, 100, -5]);
});

// ───────────────────────────── expression parser ─────────────────────────────

test('expression parser: operators, precedence and implicit multiplication', () => {
  close(evaluate('2+3*4^2'), 50);
  close(evaluate('(2+3)*4'), 20);
  close(evaluate('2^-1'), 0.5);
  close(evaluate('-3!'), -6);
  close(evaluate('2(3)(4)'), 24);
  close(evaluate('2 x 3'), 6);
  close(evaluate('2·3÷4'), 1.5);
  close(evaluate('3²+4³'), 73);
  close(evaluate('2**10'), 1024);
  close(evaluate('2*(3+4'), 14); // missing closing paren tolerated
  close(evaluate('√16'), 4);
  close(evaluate('cbrt(-27)'), -3);
  close(evaluate('  '), 0);
  assert.equal(Object.is(evaluate('-0'), -0), false);
});

test('expression parser: factorial, double factorial and gamma', () => {
  assert.equal(evaluate('5!!'), 15);
  assert.equal(evaluate('6!!'), 48);
  assert.equal(evaluate('0!'), 1);
  assert.equal(evaluate('(5!)!'), factorial(120));
  close(evaluate('0.5!'), Math.sqrt(Math.PI) / 2, 1e-12);
  close(gamma(5), 24, 1e-10);
  assert.ok(Number.isNaN(evaluate('(-1)!')));
  assert.equal(evaluate('171!'), Infinity);
  assert.equal(doubleFactorial(0), 1);
  assert.equal(doubleFactorial(-1), 1);
});

test('expression parser: mod, nCr, nPr and multi-argument functions', () => {
  assert.equal(evaluate('7 mod 3'), 1);
  assert.equal(evaluate('-7 mod 3'), 2); // floored: sign of divisor
  assert.equal(evaluate('7 mod -3'), -2);
  assert.equal(evaluate('mod(10, 4)'), 2);
  assert.ok(Number.isNaN(evaluate('5 mod 0')));
  close(evaluate('5.5 mod 2'), 1.5, 1e-12);
  assert.equal(evaluate('nCr(5, 2)'), 10);
  assert.equal(evaluate('52 nCr 5'), 2598960);
  assert.equal(evaluate('nPr(10, 3)'), 720);
  assert.equal(evaluate('10 nPr 3 + 1'), 721);
  assert.equal(evaluate('nCr(5, 7)'), 0);
  assert.equal(nCr(60, 30), 118264581564861424);
  assert.equal(nPr(5, 0), 1);
  assert.equal(mod(-1, 5), 4);
  assert.equal(evaluate('gcd(12, 18, 30)'), 6);
  assert.equal(evaluate('lcm(4, 6)'), 12);
  assert.equal(evaluate('max(1, 7, 3) - min(4, 2)'), 5);
  close(evaluate('log(8, 2)'), 3, 1e-12);
  close(evaluate('log2(1024)'), 10, 1e-12);
  close(evaluate('root(32, 5)'), 2, 1e-12);
  close(evaluate('root(-8, 3)'), -2, 1e-12);
  throwsMsg(() => evaluate('nCr(5.5, 2)'), /whole numbers/);
});

test('expression parser: trig snaps floating-point noise', () => {
  assert.equal(evaluate('sin(180)', { deg: true }), 0);
  assert.equal(evaluate('cos(90)', { deg: true }), 0);
  assert.equal(evaluate('cos(-270)', { deg: true }), 0);
  assert.equal(evaluate('sin(π)'), 0);
  assert.equal(evaluate('tan(π)'), 0);
  assert.ok(Number.isNaN(evaluate('tan(π/2)')));
  assert.ok(Number.isNaN(evaluate('tan(270)', { deg: true })));
  close(evaluate('sin(1e-10)'), 1e-10, 1e-20); // tiny angles are not snapped
  close(evaluate('asin(1)', { deg: true }), 90, 1e-12);
  close(evaluate('cos(π/3)'), 0.5, 1e-15);
});

test('expression parser: large numbers and domain errors', () => {
  assert.equal(evaluate('1e308*10'), Infinity);
  assert.equal(evaluate('9^9^9'), Infinity);
  close(evaluate('123456789*987654321'), 121932631112635269, 1e3);
  assert.ok(Number.isNaN(evaluate('sqrt(-1)')));
  assert.ok(Number.isNaN(evaluate('ln(-1)')));
  assert.equal(evaluate('ln(0)'), -Infinity);
  assert.equal(evaluate('1/0'), Infinity);
});

test('expression parser: helpful syntax error messages', () => {
  throwsMsg(() => evaluate('2^^3'), /Two "\^" in a row/);
  throwsMsg(() => evaluate('2+3)'), /Unmatched "\)"/);
  throwsMsg(() => evaluate('()'), /Empty parentheses/);
  throwsMsg(() => evaluate('sin()'), /Empty parentheses/);
  throwsMsg(() => evaluate('1.2.3'), /Invalid number "1\.2\.3"/);
  throwsMsg(() => evaluate('2..3'), /Invalid number/);
  throwsMsg(() => evaluate('2+'), /Missing number after "\+"/);
  throwsMsg(() => evaluate('('), /Incomplete expression/);
  throwsMsg(() => evaluate('2^'), /Missing exponent/);
  throwsMsg(() => evaluate('*3'), /Missing number before "\*"/);
  throwsMsg(() => evaluate('2+*3'), /Missing number after "\+"/);
  throwsMsg(() => evaluate('!5'), /must follow a number/);
  throwsMsg(() => evaluate('1,2'), /commas only separate function arguments/);
  throwsMsg(() => evaluate('nPr(5)'), /nPr\(\) takes 2 arguments, got 1/);
  throwsMsg(() => evaluate('nCr 5'), /Missing number before "nCr" — write e\.g\. 7 nCr 3 or nCr\(7, 3\)/);
  throwsMsg(() => evaluate('sqrt'), /Missing value after "sqrt"/);
  throwsMsg(() => evaluate('mod 3'), /Missing number before "mod"/);
  throwsMsg(() => evaluate('foo(2)'), /Unknown name "foo"/);
  throwsMsg(() => evaluate('2 # 3'), /Unexpected "#" at position 3/);
  throwsMsg(() => evaluate('('.repeat(500) + '1'), /nested too deeply/);
  throwsMsg(() => evaluate('1+'.repeat(1500) + '1'), /too long/);
});

// ───────────────────────────── finance ─────────────────────────────

test('mortgage: PMI applies below 20% down and stops at 78% LTV', () => {
  const r = run('mortgage', { price: 300000, down: 10, rate: 6, years: '30', tax: 0, ins: 0, hoa: 0, pmi: 0.5, start: '2026-01-01' });
  const pmiItem = r.items.find((i) => i.label.startsWith('PMI'));
  close(pmiItem.value, 270000 * 0.005 / 12);
  const months = Number(pmiItem.label.match(/first (\d+)/)[1]);
  // Balance after that many payments must be at or below 78% of value, and above it one payment earlier.
  const a = amortize(270000, 6, 360);
  assert.ok(a.monthly[months - 1].balance <= 0.78 * 300000);
  assert.ok(a.monthly[months - 2].balance > 0.78 * 300000);
  close(r.primary.value, a.payment + 112.5);
  assert.match(item(r, 'Payoff date'), /2055/);
  // 20% down → no PMI line
  assert.ok(!run('mortgage', { down: 20 }).items.some((i) => i.label.startsWith('PMI')));
});

test('mortgage: extra payments shorten the loan; 100% down needs no loan', () => {
  const r = run('mortgage', { price: 250000, down: 20, rate: 6, years: '30', extra: 200 });
  assert.ok(item(r, 'Interest saved with extra payments') > 50000);
  assert.ok(item(r, 'Number of payments') < 360);
  const z = run('mortgage', { down: 100 });
  assert.equal(item(z, 'Loan amount'), 0);
  assert.match(z.note, /100% down/);
  throwsMsg(() => run('mortgage', { price: '' }), /Enter a home price/);
  throwsMsg(() => run('mortgage', { down: 120 }), /at most 100/);
  throwsMsg(() => run('mortgage', { rate: -1 }), /negative/);
  close(run('mortgage', { price: 120000, down: 0, rate: 0, years: '10', tax: 0, ins: 0, pmi: 0 }).items[0].value, 1000);
});

test('loan: compounding options and 0% rate', () => {
  const m = run('loan', { amount: 10000, rate: 0, years: 1 });
  close(m.primary.value, 833.33);
  const annual = run('loan', { amount: 10000, rate: 12, years: 1, compound: '1' });
  close(item(annual, 'Effective annual rate (APY)'), 12, 1e-9);
  close(annual.primary.value, pmt(Math.pow(1.12, 1 / 12) - 1, 12, 10000), 1e-9);
  const cont = run('loan', { amount: 10000, rate: 10, years: 1, compound: 'c' });
  close(item(cont, 'Effective annual rate (APY)'), (Math.exp(0.1) - 1) * 100, 1e-9);
  const monthly = run('loan', { amount: 25000, rate: 8, years: 5, start: '2026-11-01' });
  close(monthly.primary.value, 506.91);
  assert.match(item(monthly, 'Payoff date'), /2031/);
  throwsMsg(() => run('loan', { years: 0 }), /greater than zero/);
});

test('EMI validation', () => {
  throwsMsg(() => run('emi', { months: 0 }), /at least 1/);
  close(run('emi', { amount: 120000, rate: 0, months: 12 }).primary.value, 10000);
});

test('auto loan: tax after trade-in, fees and negative equity', () => {
  const r = run('auto-loan', { price: 35000, down: 5000, trade: 0, owed: 0, tax: 7, fees: 0, rate: 6.9, months: '60' });
  close(item(r, 'Amount financed'), 32450);
  close(r.primary.value, 641.02);
  const t = run('auto-loan', { price: 30000, down: 0, trade: 10000, owed: 4000, tax: 10, fees: 500, rate: 0, months: '60' });
  close(item(t, 'Sales tax'), 2000);
  close(item(t, 'Amount financed'), 30000 + 2000 + 500 + 4000 - 10000);
  assert.equal(run('auto-loan', { price: 10000, down: 20000 }).primary.value, 0);
});

test('compound interest: annuity contributions, timing and continuous compounding', () => {
  close(run('compound-interest', { principal: 0, monthly: 100, rate: 12, years: 1, n: '12', timing: 'end' }).primary.value, 1268.25);
  close(run('compound-interest', { principal: 0, monthly: 100, rate: 12, years: 1, n: '12', timing: 'begin' }).primary.value, 1280.93);
  close(run('compound-interest', { principal: 1000, monthly: 0, rate: 5, years: 10, n: 'c' }).primary.value, 1000 * Math.exp(0.5));
  close(run('compound-interest', { principal: 1000, monthly: 0, rate: 6, years: 2.5, n: '12' }).primary.value, 1000 * 1.005 ** 30);
  assert.equal(run('compound-interest', { principal: 1000, monthly: 0, years: 0 }).primary.value, 1000);
  assert.match(run('compound-interest', { years: 1 }).primary.label, /1 year$/);
});

test('simple interest with time units', () => {
  close(run('simple-interest', { p: 10000, r: 5, t: 3, unit: 'y' }).primary.value, 1500);
  close(run('simple-interest', { p: 10000, r: 6, t: 6, unit: 'm' }).primary.value, 300);
  close(run('simple-interest', { p: 36500, r: 10, t: 1, unit: 'd' }).primary.value, 10);
});

test('retirement projection', () => {
  const r = run('retirement', { age: 30, retire: 31, saved: 0, monthly: 100, ret: 0, inf: 0, wd: 4 });
  close(r.primary.value, 1200);
  close(item(r, "Monthly income (today's money)"), 4);
  const g = run('retirement', { age: 30, retire: 40, saved: 1000, monthly: 0, ret: 7, inf: 0 });
  close(g.primary.value, 1000 * 1.07 ** 10);
  throwsMsg(() => run('retirement', { age: 60, retire: 60 }), /greater than current age/);
});

test('savings goal', () => {
  close(run('savings-goal', { goal: 12000, current: 0, years: 1, rate: 0 }).primary.value, 1000);
  const r = run('savings-goal', { goal: 10000, current: 0, years: 1, rate: 12 });
  close(r.primary.value, 10000 * 0.01 / (1.01 ** 12 - 1));
  assert.equal(run('savings-goal', { goal: 1000, current: 2000 }).primary.value, 0);
});

test('ROI and CAGR (including total loss)', () => {
  const r = run('roi', { cost: 10000, value: 15000, years: 3 });
  close(r.primary.value, 50);
  close(item(r, 'Annualized return (CAGR)'), (1.5 ** (1 / 3) - 1) * 100);
  close(item(run('roi', { cost: 1000, value: 0, years: 2 }), 'Annualized return (CAGR)'), -100);
  throwsMsg(() => run('roi', { cost: 0 }), /greater than zero/);
});

test('inflation', () => {
  const r = run('inflation', { amount: 1000, rate: 5, years: 10 });
  close(r.primary.value, 1628.89);
  close(item(r, "Future purchasing power of today's amount"), 613.91);
});

test('salary conversion', () => {
  const r = run('salary', { amount: 25, per: 'hour', hours: 40, days: 5 });
  close(r.primary.value, 52000);
  close(item(r, 'Bi-weekly'), 2000);
  close(item(r, 'Semi-monthly'), 52000 / 24);
  throwsMsg(() => run('salary', { hours: 0 }), /greater than zero/);
});

test('discount with stacked discounts', () => {
  const r = run('discount', { price: 120, off: 25, off2: 10, tax: 0 });
  close(r.primary.value, 81);
  close(item(r, 'Combined discount'), 32.5);
  close(run('discount', { price: 100, off: 20, off2: 0, tax: 10 }).primary.value, 88);
  throwsMsg(() => run('discount', { off: 150 }), /at most 100/);
});

test('tip split', () => {
  close(run('tip', { bill: 85, pct: 15, people: 2 }).primary.value, 48.875);
  throwsMsg(() => run('tip', { people: 0 }), /at least 1/);
  throwsMsg(() => run('tip', { people: 2.5 }), /whole number/);
});

test('VAT: tax inside gross amount', () => {
  close(item(run('vat', { amount: 115, rate: 15, mode: 'remove' }), 'Tax amount'), 15);
  close(run('vat', { amount: 100, rate: 0, mode: 'remove' }).primary.value, 100);
});

test('credit card payoff time and target payments', () => {
  const r = run('credit-card', { balance: 5000, apr: 22, pay: 200 });
  assert.equal(item(r, 'Number of payments'), 34); // n = −ln(1 − rB/P)/ln(1+r) = 33.75
  close(item(r, 'Total paid') - item(r, 'Total interest'), 5000);
  close(r.table.rows[0][1], pmt(0.22 / 12, 12, 5000));
  assert.equal(run('credit-card', { balance: 1200, apr: 0, pay: 100 }).items[0].value, 12);
  throwsMsg(() => run('credit-card', { balance: 10000, apr: 24, pay: 200 }), /more than the first month's interest/);
});

test('profit margin and markup', () => {
  const r = run('profit-margin', { cost: 60, price: 100 });
  close(r.primary.value, 40);
  close(item(r, 'Markup'), 66.67);
  assert.match(run('profit-margin', { cost: 120, price: 100 }).note, /loss/);
});

test('break-even', () => {
  const r = run('break-even', { fixed: 10000, price: 50, var: 30 });
  assert.equal(r.primary.value, 500);
  close(item(r, 'Break-even revenue'), 25000);
  assert.equal(run('break-even', { fixed: 10001, price: 50, var: 30 }).primary.value, 501);
  throwsMsg(() => run('break-even', { price: 30, var: 30 }), /must exceed variable cost/);
});

test('zakat debts and validation', () => {
  close(run('zakat', { cash: 200000, debts: 50000, nisab: 85000 }).primary.value, 3750);
  close(run('zakat', { cash: 85000, nisab: 85000 }).primary.value, 2125); // exactly at nisab is liable
  throwsMsg(() => run('zakat', { cash: -5 }), /negative/);
});

// ───────────────────────────── health ─────────────────────────────

test('BMI: categories, child note and validation', () => {
  const r = run('bmi', { units: 'metric', kg: 70, cm: 175, age: 30 });
  assert.equal(r.primary.badge, 'Normal weight');
  close(item(r, 'Ponderal index'), 70 / 1.75 ** 3);
  assert.match(item(r, 'Healthy weight range'), /56\.7 kg – 76\.6 kg/);
  const kid = run('bmi', { units: 'metric', kg: 30, cm: 135, age: 10 });
  assert.match(kid.note, /BMI-for-age/);
  assert.equal(run('bmi', { kg: 50, cm: 175 }).items.at(-1).label, 'Gain to reach BMI 18.5');
  throwsMsg(() => run('bmi', { units: 'metric', cm: 0 }), /height between/);
  throwsMsg(() => run('bmi', { units: 'metric', kg: '' }), /Enter a weight/);
});

test('calorie: TDEE, macros and formula choice', () => {
  const r = run('calorie', { units: 'metric', sex: 'male', age: 30, kg: 70, cm: 175, act: '1.55', formula: 'msj' });
  assert.equal(r.primary.value, Math.round(1648.75 * 1.55));
  close(item(r, 'Protein'), Math.round(1648.75 * 1.55 * 0.2 / 4), 0.5);
  close(item(r, 'Fat'), Math.round(1648.75 * 1.55 * 0.3 / 9), 0.5);
  const maintain = r.table.rows.find((row) => row[0] === 'Maintain weight');
  assert.equal(maintain[1], r.primary.value);
  const k = run('calorie', { units: 'metric', kg: 70, act: '1.2', formula: 'km', bf: 20 });
  assert.equal(k.primary.value, Math.round((370 + 21.6 * 56) * 1.2));
  const small = run('calorie', { units: 'metric', sex: 'female', age: 70, kg: 45, cm: 150, act: '1.2' });
  assert.ok(small.table.rows[0][1] >= 1200 && /\*/.test(small.table.rows[0][0]));
});

test('BMR: Harris–Benedict and Katch–McArdle', () => {
  const r = run('bmr', { units: 'metric', sex: 'male', age: 30, kg: 70, cm: 175, bf: 15 });
  assert.equal(item(r, 'Revised Harris–Benedict'), Math.round(88.362 + 13.397 * 70 + 4.799 * 175 - 5.677 * 30));
  assert.equal(item(r, 'Katch–McArdle'), Math.round(370 + 21.6 * 70 * 0.85));
  assert.equal(r.table.rows.length, 5);
});

test('body fat: U.S. Navy method (metric and US agree)', () => {
  close(run('body-fat', { sex: 'male', units: 'metric', cm: 178, neck: 38, waist: 85 }).primary.value, 16.436, 0.001);
  close(run('body-fat', { sex: 'female', units: 'metric', cm: 178, neck: 38, waist: 85, hip: 95 }).primary.value, 26.078, 0.001);
  const us = run('body-fat', { sex: 'male', units: 'imperial', cm: 178 / 2.54, neck: 38 / 2.54, waist: 85 / 2.54 });
  close(us.primary.value, 16.436, 0.001);
  const w = run('body-fat', { sex: 'male', units: 'metric', cm: 178, neck: 38, waist: 85, weight: 80, age: 30 });
  close(item(w, 'Fat mass') + item(w, 'Lean body mass'), 80);
  throwsMsg(() => run('body-fat', { sex: 'male', neck: 90, waist: 85 }), /Waist must be larger than neck/);
});

test('ideal weight formulas', () => {
  const r = run('ideal-weight', { sex: 'male', units: 'metric', cm: 175 });
  const over = 175 / 2.54 - 60;
  close(item(r, 'Devine (1974) formula'), 50 + 2.3 * over);
  close(item(r, 'Robinson (1983) formula'), 52 + 1.9 * over);
  const us = run('ideal-weight', { sex: 'female', units: 'imperial', ft: 5, in: 0 });
  close(item(us, 'Devine (1974) formula'), 45.5 / 0.45359237);
  assert.match(run('ideal-weight', { units: 'metric', cm: 145 }).note, /extrapolated/);
});

test('pace: rounding never produces :60 and projections are right', () => {
  const r = run('pace', { dist: 10, unit: 'km', h: 0, m: 50, s: 0 });
  assert.equal(r.primary.value, '5:00 /km');
  assert.equal(item(r, 'Pace per mile'), '8:03 /mi');
  assert.equal(r.table.rows.find((x) => x[0] === 'Marathon')[1], '3:30:59');
  assert.equal(run('pace', { dist: 1, unit: 'km', h: 0, m: 4, s: 59.7 }).primary.value, '5:00 /km');
  throwsMsg(() => run('pace', { h: 0, m: 0, s: 0 }), /Enter the time/);
});

test('due date: Naegele rule, cycle adjustment and validation', () => {
  const r = run('due-date', { lmp: '2026-01-01', cycle: 28 });
  assert.match(r.primary.value, /2026/);
  assert.match(r.primary.value, /Oct/);
  assert.match(r.primary.value, /\b8\b/);
  const longCycle = run('due-date', { lmp: '2026-01-01', cycle: 35 });
  assert.match(longCycle.primary.value, /\b15\b/);
  throwsMsg(() => run('due-date', { lmp: '2999-01-01' }), /future/);
  throwsMsg(() => run('due-date', { lmp: '2026-02-30' }), /valid date/);
  throwsMsg(() => run('due-date', { cycle: 60 }), /at most 45/);
});

test('heart rate zones (Tanaka + Karvonen)', () => {
  const r = run('heart-rate', { age: 30, rest: 65 });
  assert.equal(r.primary.value, 187);
  assert.equal(r.table.rows[0][2], `${Math.round(65 + 122 * 0.5)} – ${Math.round(65 + 122 * 0.6)} bpm`);
  assert.equal(run('heart-rate', { age: 30, rest: 60, max: 200 }).primary.value, 200);
  throwsMsg(() => run('heart-rate', { age: 100, rest: 140 }), /below your maximum/);
});

// ───────────────────────────── math ─────────────────────────────

test('percentage: new modes', () => {
  close(run('percentage', { mode: 'whole', x: 30, y: 20 }).primary.value, 150);
  close(run('percentage', { mode: 'inc', x: 100, y: 10 }).primary.value, 110);
  close(run('percentage', { mode: 'dec', x: 100, y: 10 }).primary.value, 90);
  close(run('percentage', { mode: 'diff', x: 10, y: 20 }).primary.value, 66.67);
  throwsMsg(() => run('percentage', { mode: 'is', y: 0 }), /cannot be zero/);
  throwsMsg(() => run('percentage', { x: 'abc' }), /must be a number/);
});

test('fractions: negatives, exact big integers and validation', () => {
  assert.equal(run('fraction', { a: -1, b: 2, op: '-', c: 1, d: 4 }).primary.value, '-3/4');
  assert.equal(run('fraction', { a: 1, b: 3, op: '+', c: 1, d: 6 }).primary.value, '1/2');
  assert.equal(run('fraction', { a: 1, b: -2, op: '+', c: 0, d: 1 }).primary.value, '-1/2');
  assert.equal(run('fraction', { a: -7, b: 4, op: '*', c: 1, d: 1 }).primary.value, '-7/4  =  -1 3/4');
  assert.equal(run('fraction', { a: 999999999999, b: 1000000000000, op: '*', c: 999999999999, d: 1000000000000 }).items[1].value, '999999999998000000000001/1000000000000000000000000');
  throwsMsg(() => run('fraction', { a: 1.5 }), /whole number/);
  throwsMsg(() => run('fraction', { b: 0 }), /cannot be zero/);
  throwsMsg(() => run('fraction', { op: '/', c: 0 }), /divide by zero/);
});

test('quadratic: stable roots and edge cases', () => {
  assert.equal(run('quadratic', { a: 1, b: -1e8, c: 1 }).primary.value, 'x₁ = 100000000,  x₂ = 1e-8');
  assert.equal(run('quadratic', { a: 1, b: 2, c: 1 }).primary.value, 'x = -1');
  assert.equal(run('quadratic', { a: 1, b: 0.2, c: 0.01 }).primary.value, 'x = -0.1');
  assert.equal(run('quadratic', { a: 2, b: 0, c: -8 }).primary.value, 'x₁ = 2,  x₂ = -2');
  assert.equal(run('quadratic', { a: 1, b: 0, c: 0 }).primary.value, 'x = 0');
  assert.equal(run('quadratic', { a: 0, b: 2, c: 0 }).primary.value, '0');
  assert.match(run('quadratic', { a: -1, b: 2, c: -5 }).primary.value, /1 ± 2i/);
  throwsMsg(() => run('quadratic', { a: 0, b: 0, c: 1 }), /No solution/);
});

test('statistics: quartiles, geometric mean and junk tokens', () => {
  const r = run('statistics', { data: '1 2 3 4 5 6 7 8 9' });
  assert.equal(item(r, 'Q1 / Q3'), '3 / 7');
  close(item(r, 'Median'), 5);
  close(item(run('statistics', { data: '1, 2, 4' }), 'Geometric mean'), 2);
  const junk = run('statistics', { data: '1 2 x 3' });
  close(junk.primary.value, 2);
  assert.match(junk.note, /1 entry was not a number/);
  assert.equal(item(run('statistics', { data: '5' }), 'Sample std. deviation (s)'), 0);
  throwsMsg(() => run('statistics', { data: '1e9+1 1e9+2' }), /at least one number/); // "1e9+1" is not a plain number
  close(run('statistics', { data: '1000000001 1000000002 1000000003' }).items.find((i) => i.label.startsWith('Population var')).value, 2 / 3, 1e-6);
});

test('GCF/LCM exact for big numbers', () => {
  const r = run('gcd-lcm', { data: '12, 18, 30' });
  assert.equal(r.primary.value, '6');
  assert.equal(r.items[0].value, '180');
  assert.equal(run('gcd-lcm', { data: '1152921504606846976 3' }).items[0].value, '3458764513820540928');
  throwsMsg(() => run('gcd-lcm', { data: '1.5, 3' }), /whole numbers/);
  throwsMsg(() => run('gcd-lcm', { data: '7' }), /at least two/);
});

test('prime checker: Miller–Rabin + Pollard rho', () => {
  const r = run('prime', { n: '360' });
  assert.equal(r.primary.value, 'No, it is composite');
  assert.equal(item(r, 'Prime factorization'), '2^3 × 3^2 × 5');
  assert.equal(item(r, 'Number of divisors'), 24);
  assert.equal(item(r, 'Previous prime'), '359');
  assert.equal(item(r, 'Next prime'), '367');
  assert.equal(run('prime', { n: '2' }).primary.value, 'Yes, it is prime');
  assert.equal(run('prime', { n: '1,000,000,007' }).primary.value, 'Yes, it is prime');
  assert.equal(item(run('prime', { n: '1000000016000000063' }), 'Prime factorization'), '1000000007 × 1000000009');
  assert.ok(isPrimeBig(2305843009213693951n)); // Mersenne prime 2^61 − 1
  assert.ok(!isPrimeBig(3215031751n)); // strong pseudoprime to bases 2, 3, 5, 7
  assert.deepEqual(factorBig(18446744073709551617n), [274177n, 67280421310721n]);
  throwsMsg(() => run('prime', { n: '1' }), /neither prime nor composite/);
  throwsMsg(() => run('prime', { n: '12.5' }), /whole number/);
});

test('random numbers stay in range, unique and sorted', () => {
  for (let i = 0; i < 50; i++) {
    const x = Number(run('random', { min: -3, max: 3, count: 1 }).primary.value);
    assert.ok(Number.isInteger(x) && x >= -3 && x <= 3);
  }
  const s = run('random', { min: 1, max: 1000, count: 20, unique: true, sort: true }).primary.value.split(', ').map(Number);
  assert.deepEqual(s, [...s].sort((a, b) => a - b));
  throwsMsg(() => run('random', { min: 1, max: 5, count: 6, unique: true }), /Only 5 different numbers/);
  throwsMsg(() => run('random', { min: 1.2, max: 1.8 }), /No whole numbers/);
});

test('right triangle from any two values', () => {
  close(run('triangle', { mode: 'ab', a: 3, b: 4 }).primary.value, 5);
  const ac = run('triangle', { mode: 'ac', a: 3, c: 5 });
  close(item(ac, 'Side b'), 4);
  const ca = run('triangle', { mode: 'cA', c: 2, A: 30 });
  assert.equal(ca.primary.value, '1, 1.732050808, 2');
  const aA = run('triangle', { mode: 'aA', a: 1, A: 30 });
  close(item(aA, 'Angle B'), 60, 1e-9);
  close(item(run('triangle', { mode: 'ab', a: 3, b: 4 }), 'Inradius'), 1);
  throwsMsg(() => run('triangle', { mode: 'ac', a: 5, c: 3 }), /hypotenuse must be longer/);
});

test('area & volume shapes', () => {
  close(run('area-volume', { shape: 'circle', r: 5 }).primary.value, 78.54);
  close(run('area-volume', { shape: 'heron', a: 3, b: 4, c: 5 }).primary.value, 6, 1e-12);
  close(run('area-volume', { shape: 'ellipse', a: 1, b: 1 }).items[0].value, 2 * Math.PI, 1e-9);
  close(run('area-volume', { shape: 'cone', r: 3, h: 4 }).items[0].value, Math.PI * 3 * 8);
  close(run('area-volume', { shape: 'pyramid', a: 6, h: 4 }).items[0].value, 36 + 2 * 6 * 5);
  close(run('area-volume', { shape: 'hemisphere', r: 3 }).primary.value, 18 * Math.PI);
  throwsMsg(() => run('area-volume', { shape: 'heron', a: 1, b: 2, c: 3 }), /cannot form a triangle/);
  throwsMsg(() => run('area-volume', { shape: 'circle', r: -1 }), /negative/);
});

// ───────────────────────────── converters ─────────────────────────────

test('unit converter: new categories and validation', () => {
  close(convert('fuel', 'l100', 'mpg', 8), 29.4018, 1e-4);
  close(convert('fuel', 'mpg', 'l100', 235.214583), 1, 1e-6);
  close(convert('angle', 'deg', 'rad', 180), Math.PI, 1e-12);
  close(convert('temperature', 'c', 'r', 0), 491.67, 1e-9);
  close(convert('temperature', 'f', 'c', -40), -40, 1e-12);
  close(convert('volume', 'igal', 'l', 1), 4.54609, 1e-12);
  close(convert('mass', 'tola', 'g', 1), 11.6638038, 1e-9);
  assert.equal(convert('length', 'm', 'cm', 0.1 + 0.2), 30);
  throwsMsg(() => run('unit-converter', { cat: 'temperature', from: 'k', to: 'c', x: -1 }), /below absolute zero/);
  throwsMsg(() => run('unit-converter', { cat: 'length', from: 'km', to: 'mi', x: -1 }), /can't be negative/);
  throwsMsg(() => run('unit-converter', { x: 'abc' }), /must be a number/);
  assert.equal(run('unit-converter', { cat: 'length', from: 'km', to: 'm', x: '1,500' }).primary.value, '1500000 Metre');
});

test('base converter: prefixes only for matching base, signs and errors', () => {
  assert.equal(run('base-converter', { value: '0b1', from: 16 }).primary.value, '177');
  assert.equal(run('base-converter', { value: '0x1F', from: 16 }).primary.value, '31');
  assert.equal(run('base-converter', { value: '0b1010', from: 2 }).primary.value, '10');
  assert.equal(run('base-converter', { value: '-ff', from: 16 }).primary.value, '-255');
  assert.equal(run('base-converter', { value: '1111 0000', from: 2 }).primary.value, '240');
  assert.equal(run('base-converter', { value: '-0', from: 10 }).primary.value, '0');
  assert.equal(run('base-converter', { value: '35', from: 10, to: 7 }).items.find((i) => i.label === 'Base 7').value, '50');
  throwsMsg(() => run('base-converter', { value: 'g', from: 16 }), /not a valid digit in base 16/);
  throwsMsg(() => run('base-converter', { value: '1.5', from: 10 }), /whole numbers/);
  throwsMsg(() => run('base-converter', { value: '1', from: 37 }), /at most 36/);
});

test('roman numerals validation', () => {
  assert.equal(run('roman-numerals', { value: 'mmxxvi' }).primary.value, 2026);
  assert.equal(run('roman-numerals', { value: '3999' }).primary.value, 'MMMCMXCIX');
  assert.match(run('roman-numerals', { value: '14' }).items[0].value, /X \(10\) \+ IV \(4\)/);
  throwsMsg(() => run('roman-numerals', { value: '0' }), /1 to 3999/);
  throwsMsg(() => run('roman-numerals', { value: 'MMMM' }), /not a valid Roman numeral/);
  throwsMsg(() => run('roman-numerals', { value: 'VX' }), /did you mean V\b/);
  throwsMsg(() => toRoman(0), /1 to 3999/);
});

// ───────────────────────────── everyday ─────────────────────────────

test('age: Feb 29 birthdays and future dates', () => {
  const r = run('age', { dob: '2000-02-29', on: '2001-02-28' });
  assert.equal(r.primary.value, '1 year, 0 months, 0 days');
  assert.match(r.note, /29 February/);
  assert.match(run('age', { dob: '2000-02-29', on: '2024-02-29' }).primary.value, /^24 years, 0 months, 0 days/);
  assert.match(run('age', { dob: '2000-01-31', on: '2000-02-29' }).primary.value, /^0 years, 1 month, 0 days/);
  assert.equal(item(run('age', { dob: '2000-01-01', on: '2000-01-01' }), 'Next birthday'), 'Today! 🎉');
  assert.equal(item(run('age', { dob: '2000-01-01', on: '2001-01-01' }), 'Total days'), 366);
  throwsMsg(() => run('age', { dob: '2030-01-01', on: '2026-01-01' }), /on or before/);
  throwsMsg(() => run('age', { dob: '2023-02-29' }), /valid date of birth/);
});

test('date difference and business days (any weekend)', () => {
  const r = run('date-difference', { start: '2024-01-01', end: '2024-12-31', incl: false, weekend: 'satsun' });
  assert.equal(r.primary.value, '365 days');
  assert.equal(item(r, 'Business days'), 261);
  assert.equal(item(run('date-difference', { start: '2024-01-01', end: '2024-12-31', incl: true }), 'Business days'), 262);
  assert.equal(run('date-difference', { start: '2025-03-01', end: '2024-03-01' }).primary.value, '365 days');
  // O(1) business-day count agrees with brute force for many ranges and weekend sets
  for (const weekend of [[6, 0], [5, 6], [5], []]) {
    for (let k = 0; k < 40; k++) {
      const a = new Date(Date.UTC(2024, 0, 1 + k * 3));
      const b = new Date(a.getTime() + (k * 7 + (k % 5)) * DAY_MS);
      let brute = 0;
      for (let t = a.getTime(); t < b.getTime(); t += DAY_MS) if (!weekend.includes(new Date(t).getUTCDay())) brute++;
      assert.equal(businessDays(a, b, weekend), brute);
    }
  }
});

test('add to date: month ends, business days, ISO week', () => {
  assert.equal(item(run('date-add', { start: '2024-01-31', op: '1', y: 0, m: 1, w: 0, d: 0 }), 'ISO date'), '2024-02-29');
  assert.equal(item(run('date-add', { start: '2024-03-31', op: '-1', y: 0, m: 1, w: 0, d: 0 }), 'ISO date'), '2024-02-29');
  const biz = run('date-add', { start: '2026-10-16', op: '1', y: 0, m: 0, w: 0, d: 1, biz: true, weekend: 'satsun' });
  assert.equal(item(biz, 'ISO date'), '2026-10-19');
  const bd = run('date-add', { start: '2026-10-15', op: '1', y: 0, m: 0, w: 0, d: 1, biz: true, weekend: 'frisat' });
  assert.equal(item(bd, 'ISO date'), '2026-10-18');
  assert.equal(item(run('date-add', { start: '2026-10-13', y: 0, m: 0, w: 0, d: 0 }), 'ISO week number'), 42);
  assert.equal(item(run('date-add', { start: '2021-01-03', y: 0, m: 0, w: 0, d: 0 }), 'ISO week number'), 53);
  assert.equal(item(run('date-add', { start: '2024-12-31', y: 0, m: 0, w: 0, d: 0 }), 'Day of the year'), '366 of 366');
  assert.equal(isoDate(addBusinessDays(parseDate('2026-10-19'), -1)), '2026-10-16');
  assert.equal(isoDate(addBusinessDays(parseDate('2026-01-05'), 2600)), isoDate(addToDate(parseDate('2026-01-05'), { days: 3640 })));
  throwsMsg(() => run('date-add', { y: 999999 }), /outside the supported range/);
  throwsMsg(() => run('date-add', { d: 1.5 }), /whole number/);
});

test('time duration: overnight and break validation', () => {
  const r = run('time-duration', { start: '22:00', end: '06:00', brk: 30 });
  assert.equal(r.primary.value, '7 h 30 min');
  assert.match(r.note, /past midnight/);
  close(item(run('time-duration'), 'Decimal hours'), 8);
  throwsMsg(() => run('time-duration', { start: '09:00', end: '09:20', brk: 30 }), /break is longer/);
  throwsMsg(() => run('time-duration', { start: '25:00' }), /valid start time/);
});

test('GPA: course names, numeric grades and errors', () => {
  close(run('gpa').primary.value, 42.3 / 12, 1e-9);
  const r = run('gpa', { courses: 'Calculus, A-, 3\nPhysics B 4\nLab\t3.5\t1' });
  close(r.primary.value, (3.7 * 3 + 3 * 4 + 3.5) / 8, 1e-9);
  assert.equal(r.table.rows[0][0], 'Calculus');
  throwsMsg(() => run('gpa', { courses: 'Q, 3' }), /not a grade/);
  throwsMsg(() => run('gpa', { courses: 'A, 0' }), /valid number of credits/);
  throwsMsg(() => run('gpa', { courses: '\n\n' }), /at least one course/);
});

test('fuel cost in three unit systems', () => {
  close(run('fuel-cost', { units: 'kmpl', dist: 250, eff: 12, price: 1.5, round: false }).primary.value, 31.25);
  close(run('fuel-cost', { units: 'l100', dist: 250, eff: 8, price: 1.5, round: true }).primary.value, 60);
  close(run('fuel-cost', { units: 'mpg', dist: 300, eff: 30, price: 3.5, round: false }).primary.value, 35);
  throwsMsg(() => run('fuel-cost', { eff: 0 }), /greater than zero/);
});

test('electricity cost uses the average month', () => {
  const r = run('electricity', { watts: 1000, hours: 1, qty: 1, price: 0.12 });
  close(item(r, 'Daily cost'), 0.12);
  close(item(r, 'Yearly cost'), 43.8);
  close(r.primary.value, 43.8 / 12);
  throwsMsg(() => run('electricity', { hours: 25 }), /at most 24/);
});

test('password: every chosen set is represented and length is validated', () => {
  for (let i = 0; i < 20; i++) {
    const pw = run('password', { len: 8, upper: true, lower: true, digits: true, symbols: true, similar: true }).primary.value;
    assert.equal(pw.length, 8);
    assert.match(pw, /[A-Z]/);
    assert.match(pw, /[a-z]/);
    assert.match(pw, /[0-9]/);
    assert.match(pw, /[^A-Za-z0-9]/);
    assert.doesNotMatch(pw, /[0OlI1|]/);
  }
  throwsMsg(() => run('password', { len: 3 }), /at least 4/);
  throwsMsg(() => run('password', { upper: false, lower: false, digits: false, symbols: false }), /at least one/);
});

// ───────────────────────────── robustness sweep ─────────────────────────────

test('no calculator leaks NaN/undefined or crashes on hostile inputs', () => {
  const mine = [...finance, ...health, ...mathCalcs, ...converters, ...everyday].filter((c) => !c.custom);
  const nums = ['', 'abc', '0', '-1', '1e308', '1e15', '0.0000001', '-0', ' 12 ', '1,000'];
  const dates = ['', '2023-02-29', '0001-01-01', '9999-12-31', '2000-02-29', 'x'];
  const bad = (x) => (typeof x === 'number' && Number.isNaN(x)) || x === undefined || (typeof x === 'string' && /NaN|undefined|Invalid Date|\bnull\b/.test(x));
  let runs = 0;
  for (const c of mine) {
    const def = defaults(c);
    const variants = [];
    for (const inp of c.inputs) {
      if (inp.type === 'select') {
        const opts = typeof inp.options === 'function' ? inp.options(def) : inp.options;
        opts.forEach((o) => variants.push({ ...def, [inp.id]: Array.isArray(o) ? o[0] : o }));
      } else if (inp.type === 'checkbox') variants.push({ ...def, [inp.id]: !def[inp.id] });
      else (inp.type === 'date' ? dates : inp.type === 'time' ? ['', '25:00', '00:00'] : nums).forEach((x) => variants.push({ ...def, [inp.id]: x }));
    }
    for (const st of variants) {
      runs++;
      let r;
      try {
        r = c.compute(st);
      } catch (e) {
        assert.ok(e instanceof Error && e.message.length > 5, `${c.id}: non-friendly error ${e}`);
        assert.doesNotMatch(e.message, /Cannot read|is not a function|undefined|NaN|Invalid time|BigInt/, `${c.id} ${JSON.stringify(st)}: ${e.message}`);
        continue;
      }
      for (const it of [r.primary, ...(r.items || [])].filter(Boolean)) assert.ok(!bad(it.value), `${c.id} ${JSON.stringify(st)}: ${it.label} = ${it.value}`);
      for (const cell of (r.table?.rows || []).flat()) assert.ok(!bad(cell), `${c.id}: table cell ${cell}`);
      if (r.note) assert.ok(!bad(r.note), `${c.id}: note ${r.note}`);
    }
  }
  assert.ok(runs > 1000);
});

test('every calculator in my files has a known-value test above', () => {
  const tested = ['mortgage', 'loan', 'emi', 'auto-loan', 'compound-interest', 'simple-interest', 'retirement', 'savings-goal', 'roi', 'inflation', 'salary', 'discount', 'tip', 'vat', 'credit-card', 'profit-margin', 'break-even', 'zakat',
    'bmi', 'calorie', 'bmr', 'body-fat', 'ideal-weight', 'pace', 'due-date', 'heart-rate',
    'scientific', 'percentage', 'fraction', 'quadratic', 'statistics', 'gcd-lcm', 'prime', 'random', 'triangle', 'area-volume',
    'unit-converter', 'base-converter', 'roman-numerals',
    'age', 'date-difference', 'date-add', 'time-duration', 'gpa', 'fuel-cost', 'electricity', 'password'];
  const mine = [...finance, ...health, ...mathCalcs, ...converters, ...everyday].map((c) => c.id);
  assert.deepEqual([...mine].sort(), [...tested].sort());
});
