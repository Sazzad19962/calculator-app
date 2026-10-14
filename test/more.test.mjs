import { test } from 'node:test';
import assert from 'node:assert/strict';
import more, {
  parseClock, npv, irr, solveRate, parseDecimal, roundDigits, digitsToDecimal, nextEvent, isoWeek, depreciationSchedule, signChanges,
} from '../src/calculators/more.js';
import { CATEGORIES } from '../src/registry.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b}`);
const byId = Object.fromEntries(more.map((c) => [c.id, c]));
const defaults = (c) => Object.fromEntries(c.inputs.map((i) => [i.id, typeof i.value === 'function' ? i.value({}) : i.value]));
const run = (id, over = {}) => byId[id].compute({ ...defaults(byId[id]), ...over });
const item = (r, label) => {
  const it = r.items.find((i) => i.label.startsWith(label));
  assert.ok(it, `no item "${label}" in ${r.items.map((i) => i.label).join(', ')}`);
  return it.value;
};
const D = (s) => new Date(`${s}T00:00:00Z`);

test('more: metadata is complete and every calculator computes with defaults', () => {
  const cats = new Set(CATEGORIES.map((c) => c.id));
  const ids = new Set();
  assert.ok(more.length >= 18);
  for (const c of more) {
    assert.ok(!ids.has(c.id), `duplicate ${c.id}`);
    ids.add(c.id);
    assert.ok(c.name && c.desc && c.icon && c.keywords && c.about, `${c.id} missing metadata`);
    assert.ok(cats.has(c.cat), `${c.id} bad category ${c.cat}`);
    assert.match(c.about, /Example/i, `${c.id} about has no worked example`);
    const r = c.compute(defaults(c));
    assert.ok(r.primary && r.primary.label, `${c.id} no primary`);
    if (typeof r.primary.value === 'number') assert.ok(Number.isFinite(r.primary.value), `${c.id} primary not finite`);
  }
});

test('investment: lump sum and annuity (end/begin) match closed forms', () => {
  close(run('investment', { initial: 10000, contrib: 0, rate: 7, comp: '1', years: 10 }).primary.value, 19671.51);
  close(run('investment', { initial: 0, contrib: 100, freq: '12', comp: '12', rate: 12, years: 10, timing: 'end' }).primary.value, 23003.87);
  close(run('investment', { initial: 0, contrib: 100, freq: '12', comp: '12', rate: 12, years: 10, timing: 'begin' }).primary.value, 23003.87 * 1.01, 0.02);
  // Monthly compounding of a lump sum: 1000 at 6% monthly for 5y
  close(run('investment', { initial: 1000, contrib: 0, comp: '12', rate: 6, years: 5 }).primary.value, 1000 * (1.005 ** 60));
});

test('sip: 5000/month, 12%, 10 years ≈ 11,61,695', () => {
  const r = run('sip');
  close(r.primary.value, 1161695.38, 0.5);
  close(item(r, 'Total invested'), 600000);
  // step-up of 10% raises invested to 5000*12*(1.1^10-1)/0.1
  close(item(run('sip', { step: 10 }), 'Total invested'), 60000 * ((1.1 ** 10 - 1) / 0.1), 0.01);
});

test('cagr: 1000 → 2000 in 5 years = 14.87%', () => {
  close(run('cagr', { start: 1000, end: 2000, years: 5 }).primary.value, 14.8698, 0.001);
  assert.throws(() => run('cagr', { start: 0 }));
});

test('depreciation: straight-line, DDB (with SL switch) and SYD', () => {
  const sl = depreciationSchedule(10000, 1000, 5, 'sl');
  assert.deepEqual(sl.map((r) => Math.round(r.dep)), [1800, 1800, 1800, 1800, 1800]);
  const ddb = depreciationSchedule(10000, 1000, 5, 'ddb');
  assert.deepEqual(ddb.map((r) => +r.dep.toFixed(2)), [4000, 2400, 1440, 864, 296]);
  close(ddb.at(-1).book, 1000);
  const syd = depreciationSchedule(10000, 1000, 5, 'syd');
  assert.deepEqual(syd.map((r) => Math.round(r.dep)), [3000, 2400, 1800, 1200, 600]);
  const db150 = depreciationSchedule(10000, 0, 10, 'db', 1.5);
  close(db150[0].dep, 1500);
  close(db150.reduce((s, r) => s + r.dep, 0), 10000);
  close(run('depreciation', { method: 'sl' }).primary.value, 1800);
  assert.throws(() => run('depreciation', { salvage: 20000 }));
});

test('rent vs buy: cash purchase vs rent with zero growth = rent saved', () => {
  const r = run('rent-vs-buy', { price: 100000, down: 100, closing: 0, tax: 0, maint: 0, ins: 0, hoa: 0, appr: 0, sell: 0, rent: 1000, rentInc: 0, rentIns: 0, inv: 0, years: 1 });
  close(item(r, 'Net worth if you buy'), 112000);
  close(item(r, 'Net worth if you rent'), 100000);
  assert.match(r.primary.label, /Buying/);
  close(r.primary.value, 12000);
  // Very cheap rent and expensive ownership → renting wins
  const r2 = run('rent-vs-buy', { rent: 500, rentInc: 0, appr: 0, years: 5 });
  assert.match(r2.primary.label, /Renting/);
});

test('debt-to-income ratios', () => {
  const r = run('debt-to-income');
  close(r.primary.value, 35);
  close(item(r, 'Front-end'), 1800 / 7000 * 100);
  assert.throws(() => run('debt-to-income', { income: 0 }));
});

test('net worth', () => {
  const r = run('net-worth');
  close(r.primary.value, 225000);
  close(item(r, 'Total assets'), 490000);
  close(item(r, 'Total liabilities'), 265000);
});

test('npv / irr / payback', () => {
  close(npv(0.1, [-1000, 500, 400, 300]), 10.5184, 0.001);
  close(irr([-1000, 500, 400, 300]), 0.106517, 1e-5);
  close(irr([-100, 30, 35, 40, 45]), 0.170937, 1e-5);
  close(npv(irr([-5000, 1200, 1500, 1800, 2500]), [-5000, 1200, 1500, 1800, 2500]), 0, 1e-6);
  assert.ok(Number.isNaN(irr([100, 200])));
  assert.equal(signChanges([-100, 50, 0, 60]), 1);
  assert.equal(signChanges([-100, 230, -132]), 2);
  const r = run('npv-irr', { initial: 1000, flows: '500\n400\n300', rate: 10 });
  close(r.primary.value, 10.52);
  close(item(r, 'Internal rate'), 10.6517, 0.001);
  assert.equal(item(r, 'Payback period'), '2.33 periods');
  assert.ok(run('npv-irr', { initial: 100, flows: '230, -132', rate: 5 }).note);
});

test('interest rate solver recovers known rates', () => {
  close(solveRate(200000, 360, 1199.10) * 12 * 100, 6, 0.001);
  close(run('interest-rate', { amount: 20000, payment: 386.66, years: 5, months: 0 }).primary.value, 6, 0.001);
  close(run('interest-rate', { amount: 12000, payment: 1000, years: 1, months: 0 }).primary.value, 0, 1e-9);
  assert.throws(() => run('interest-rate', { amount: 12000, payment: 900, years: 1 }));
});

test('house affordability satisfies the 28/36 limits', () => {
  const r = run('house-affordability');
  close(r.primary.value, 417207, 2);
  close(item(r, 'Monthly housing payment'), 2800, 0.01);
  // Heavy debts make the back-end ratio bind: 10000*0.36 - 1500 = 2100
  const r2 = run('house-affordability', { debts: 1500 });
  close(item(r2, 'Monthly housing payment'), 2100, 0.01);
  assert.match(r2.primary.badge, /back-end/);
});

test('sleep: bedtimes and wake times from 90-minute cycles', () => {
  const r = run('sleep', { mode: 'wake', time: '07:00', fall: 15 });
  assert.equal(item(r, 'For 6 cycles'), '9:45 PM');
  assert.equal(item(r, 'For 5 cycles'), '11:15 PM');
  const b = run('sleep', { mode: 'bed', time: '22:00', fall: 15 });
  assert.equal(item(b, 'After 6 cycles'), '7:15 AM');
  assert.equal(item(b, 'After 5 cycles'), '5:45 AM');
  assert.equal(parseClock('12am'), 0);
  assert.equal(parseClock('12:30pm'), 750);
  assert.equal(parseClock('5:30 PM'), 1050);
  assert.equal(parseClock('25:00'), null);
});

test('macro: Mifflin-St Jeor and macro grams', () => {
  const r = run('macro', { units: 'metric', sex: 'male', age: 30, kg: 80, cm: 180, act: '1.55', goal: '0', split: '30-40-30' });
  assert.equal(r.primary.value, 2759);
  assert.equal(item(r, 'Protein'), 207);
  assert.equal(item(r, 'Carbohydrates'), 276);
  assert.equal(item(r, 'Fat'), 92);
  assert.equal(item(r, 'BMR'), 1780);
  // Female: 10*60 + 6.25*165 - 5*25 - 161 = 1345.25
  assert.equal(item(run('macro', { sex: 'female', age: 25, kg: 60, cm: 165, act: '1.2', goal: '0' }), 'BMR'), 1345);
  // Imperial input converts to the same result (176.37 lb ≈ 80 kg, 5 ft 10.866 in ≈ 180 cm)
  const imp = run('macro', { units: 'imperial', lb: 80 / 0.45359237, ft: 5, in: 180 / 2.54 - 60 });
  assert.equal(imp.primary.value, 2759);
  assert.throws(() => run('macro', { age: 15 }));
});

test('ovulation: 28-day cycle from 1 Jan', () => {
  const r = run('ovulation', { lmp: '2026-01-01', cycle: 28, luteal: 14 });
  assert.match(r.primary.value, /January 15, 2026/);
  assert.match(item(r, 'Fertile window'), /Jan 10, 2026 – .*Jan 16, 2026/);
  assert.match(item(r, 'Next period'), /Jan 29, 2026/);
  const r2 = run('ovulation', { lmp: '2026-01-01', cycle: 32, luteal: 14 });
  assert.match(r2.primary.value, /January 19, 2026/);
  assert.throws(() => run('ovulation', { cycle: 60 }));
});

test('logarithms and exponents', () => {
  assert.equal(run('logarithm', { base: '10', x: '1000' }).primary.value, 3);
  assert.equal(run('logarithm', { base: '2', x: '8' }).primary.value, 3);
  assert.equal(run('logarithm', { base: '5', x: '125' }).primary.value, 3);
  close(run('logarithm', { base: 'e', x: String(Math.E ** 2) }).primary.value, 2, 1e-12);
  close(run('logarithm', { mode: 'pow', base: '10', y: '2' }).primary.value, 100, 1e-9);
  assert.throws(() => run('logarithm', { base: '1' }));
  assert.throws(() => run('logarithm', { x: '-5' }));
});

test('parseDecimal / significant figures', () => {
  const sf = (s) => parseDecimal(s).sig;
  assert.equal(sf('0.004560'), 4);
  assert.equal(sf('1200'), 2);
  assert.equal(sf('1200.'), 4);
  assert.equal(sf('10.05'), 4);
  assert.equal(sf('6.020e23'), 4);
  assert.equal(sf('6.020 x 10^23'), 4);
  assert.equal(sf('-0.00012'), 2);
  assert.equal(sf('1,234,000.0'), 8);
  assert.equal(parseDecimal('abc'), null);
  assert.deepEqual(roundDigits('2675', 0, 3), { digits: '268', exp: 0 });
  assert.deepEqual(roundDigits('9996', 3, 3), { digits: '100', exp: 4 });
  assert.equal(digitsToDecimal(1, '46', -3), '0.0046');
  assert.equal(digitsToDecimal(-1, '99', 4), '-99000');
  const r = run('sig-figs', { n: '0.004560', to: 2 });
  assert.equal(r.primary.value, 4);
  assert.equal(item(r, 'Rounded'), '0.0046');
  assert.equal(item(run('sig-figs', { n: '98760', to: 2 }), 'Rounded'), '99000');
  assert.equal(item(run('sig-figs', { n: '99.96', to: 3 }), 'Rounded'), '100.');
  assert.equal(item(run('sig-figs', { n: '2.675', to: 3 }), 'Rounded'), '2.68');
  assert.equal(item(run('sig-figs', { n: '1.5', to: 4 }), 'Rounded'), '1.500');
});

test('scientific notation conversion is exact', () => {
  const r = run('scientific-notation', { n: '299792458' });
  assert.equal(r.primary.value, '2.99792458 × 10⁸');
  assert.equal(item(r, 'E-notation'), '2.99792458e8');
  const s = run('scientific-notation', { n: '0.00045' });
  assert.equal(s.primary.value, '4.5 × 10⁻⁴');
  assert.equal(item(s, 'Engineering'), '450 × 10⁻⁶');
  assert.equal(item(run('scientific-notation', { n: '6.02e23' }), 'Decimal'), '602000000000000000000000');
  assert.equal(item(run('scientific-notation', { n: '1.2 x 10^-3' }), 'Decimal'), '0.0012');
  assert.throws(() => run('scientific-notation', { n: '1.2.3' }));
});

test('ratio / proportion', () => {
  assert.equal(run('ratio', { a: 3, b: 4, c: 9, d: '' }).primary.value, 12);
  assert.equal(run('ratio', { a: '', b: 4, c: 9, d: 12 }).primary.value, 3);
  assert.equal(run('ratio', { a: 1920, b: 1080, c: '', d: '' }).primary.value, '16 : 9');
  assert.equal(run('ratio', { a: 1.5, b: 2.5, c: '', d: '' }).primary.value, '3 : 5');
  assert.match(run('ratio', { a: 2, b: 3, c: 4, d: 6 }).primary.value, /^Yes/);
  assert.match(run('ratio', { a: 2, b: 3, c: 4, d: 7 }).primary.value, /^No/);
  assert.throws(() => run('ratio', { a: '', b: '', c: 1, d: 2 }));
});

test('weighted average', () => {
  assert.equal(run('weighted-average').primary.value, 81);
  close(run('weighted-average', { data: '3.7, 3\n4.0, 4\n2.7 2' }).primary.value, (3.7 * 3 + 16 + 5.4) / 9);
  assert.throws(() => run('weighted-average', { data: 'abc' }));
});

test('percent error', () => {
  close(run('percent-error').primary.value, 3.1600, 0.0001);
  close(run('percent-error', { measured: 110, actual: 100 }).primary.value, 10);
  assert.throws(() => run('percent-error', { actual: 0 }));
});

test('day of week, day of year and ISO week', () => {
  assert.equal(run('day-of-week', { date: '1776-07-04' }).primary.value, 'Thursday');
  assert.equal(run('day-of-week', { date: '2000-01-01' }).primary.value, 'Saturday');
  const r = run('day-of-week', { date: '2026-10-13' });
  assert.equal(r.primary.value, 'Tuesday');
  assert.equal(item(r, 'Day of the year'), '286 of 365');
  assert.equal(item(r, 'ISO week'), 'Week 42 of 2026');
  assert.deepEqual(isoWeek(D('2021-01-03')), { week: 53, year: 2020 });
  assert.deepEqual(isoWeek(D('2024-12-30')), { week: 1, year: 2025 });
  assert.equal(item(run('day-of-week', { date: '2024-02-29' }), 'Leap year'), 'Yes');
});

test('countdown and holiday dates', () => {
  assert.equal(run('countdown', { event: 'christmas', from: '2026-10-13' }).primary.value, '73 days');
  assert.equal(run('countdown', { event: 'christmas', from: '2026-12-26' }).primary.value, '364 days');
  assert.equal(nextEvent('thanksgiving', D('2026-01-01')).toISOString().slice(0, 10), '2026-11-26');
  assert.equal(nextEvent('thanksgiving', D('2025-01-01')).toISOString().slice(0, 10), '2025-11-27');
  assert.equal(nextEvent('easter', D('2026-01-01')).toISOString().slice(0, 10), '2026-04-05');
  assert.equal(nextEvent('easter', D('2024-01-01')).toISOString().slice(0, 10), '2024-03-31');
  assert.equal(nextEvent('easter', D('2025-01-01')).toISOString().slice(0, 10), '2025-04-20');
  const r = run('countdown', { event: 'custom', target: '2026-01-01', from: '2026-01-15' });
  assert.match(r.primary.label, /since/);
  assert.equal(r.primary.value, '14 days');
});

test('time card with overtime', () => {
  const sheet = 'Mon, 9:00, 17:30, 30\nTue, 9:00, 17:30, 30\nWed, 9:00, 17:30, 30\nThu, 9:00, 17:30, 30\nFri, 9:00, 17:30, 30\nSat 9:00am 1:00pm';
  const r = run('time-card', { times: sheet, rate: 20, otAfter: 40, otMult: 1.5 });
  close(item(r, 'Regular hours'), 40);
  close(item(r, 'Overtime hours'), 4);
  close(item(r, 'Gross pay'), 920);
  const night = run('time-card', { times: 'Night, 22:00, 6:00, 30', otAfter: 40 });
  close(item(night, 'Regular hours'), 7.5);
  assert.throws(() => run('time-card', { times: 'Mon, nine, five' }));
});

test('concrete volume and bags', () => {
  const r = run('concrete', { shape: 'slab', units: 'us', len: 10, wid: 10, thick: 4, qty: 1, waste: 0 });
  close(r.primary.value, 1.2346, 0.0001);
  assert.equal(item(r, 'Premix: 80 lb'), 56);
  const m = run('concrete', { shape: 'slab', units: 'metric', len: 5, wid: 4, thick: 10, qty: 1, waste: 0 });
  close(m.primary.value, 2);
  const col = run('concrete', { shape: 'round', units: 'metric', dia: 30, height: 3, qty: 2, waste: 0 });
  close(col.primary.value, Math.PI * 0.15 ** 2 * 3 * 2, 1e-9);
});

test('tile count', () => {
  assert.equal(run('tile', { units: 'us', len: 12, wid: 10, tl: 12, tw: 12, gap: 0, waste: 10, perBox: 10 }).primary.value, 132);
  assert.equal(item(run('tile', { units: 'us', len: 12, wid: 10, tl: 12, tw: 12, gap: 0, waste: 10, perBox: 10 }), 'Boxes'), 14);
  // Metric: 4 m × 3 m, 60 × 60 cm tiles, no gap → 33.33 → 34 tiles
  assert.equal(run('tile', { units: 'metric', len: 4, wid: 3, tl: 60, tw: 60, gap: 0, waste: 0 }).primary.value, 34);
});

test('square footage', () => {
  const r = run('square-footage');
  close(r.primary.value, 504);
  close(item(r, 'Square metres'), 46.823, 0.001);
  close(run('square-footage', { units: 'ft', rooms: 'Nook, 6, 4, t\n10 x 10' }).primary.value, 112);
  close(run('square-footage', { units: 'm', rooms: '5, 4' }).primary.value, 20 * 10.7639104, 0.001);
  close(run('square-footage', { units: 'ft', rooms: 'Rug, 8' }).primary.value, Math.PI * 16);
  close(run('square-footage', { units: 'ft', rooms: 'Box room, 10, 8' }).primary.value, 80);
});

test('final grade needed', () => {
  close(run('final-grade', { current: 85, target: 90, weight: 25 }).primary.value, 105);
  close(run('final-grade', { current: 85, target: 80, weight: 25 }).primary.value, 65);
  close(run('final-grade', { current: 85, target: 90, weight: 20 }).primary.value, 110);
  assert.throws(() => run('final-grade', { weight: 0 }));
});
