import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CALCULATORS, byId, search } from '../src/registry.js';
import { evaluate } from '../src/expr.js';
import { convert, toRoman, fromRoman } from '../src/calculators/converters.js';
import { amortize, diffYMD, parseDate, addToDate } from '../src/util.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b}`);
const defaults = (c) => Object.fromEntries((c.inputs || []).map((i) => [i.id, typeof i.value === 'function' ? i.value({}) : i.value]));
const run = (id, over = {}) => byId[id].compute({ ...defaults(byId[id]), ...over });

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
