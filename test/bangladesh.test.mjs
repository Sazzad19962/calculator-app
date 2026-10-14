import { test } from 'node:test';
import assert from 'node:assert/strict';
import bd, {
  bdIncomeTax, sanchayapatra, exciseDuty, fdr, dps, toGrams, fromGrams, goldPrice, electricityBill,
  pensionRate, gratuityRate, govtPension, gpfYearlyInterest, gpf, VORI_G,
} from '../src/calculators/bangladesh.js';

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `expected ${a} ≈ ${b}`);
const byId = Object.fromEntries(bd.map((c) => [c.id, c]));
const defaults = (c) => Object.fromEntries(c.inputs.map((i) => [i.id, i.value]));
const run = (id, over = {}) => byId[id].compute({ ...defaults(byId[id]), ...over });
const item = (r, re) => r.items.find((i) => re.test(i.label));

test('all Bangladesh calculators have metadata, Bangla keywords, money inputs and compute with defaults', () => {
  assert.ok(bd.length >= 8);
  for (const c of bd) {
    assert.equal(c.cat, 'bangladesh');
    assert.ok(c.id.startsWith('bd-'), c.id);
    assert.ok(c.name && c.desc && c.about && c.icon, c.id);
    assert.match(c.keywords, /[ঀ-৿]/, `${c.id} needs Bangla keywords`);
    assert.match(c.about, /Disclaimer/);
    assert.match(c.about, /20\d\d/, `${c.id} about should mention the year`);
    assert.ok(c.inputs.some((i) => i.money), `${c.id} has no money input`);
    assert.ok(c.inputs.some((i) => i.help), `${c.id} has no help text`);
    const r = c.compute(defaults(c));
    assert.ok(r.primary && Number.isFinite(r.primary.value), `${c.id} primary`);
  }
});

/* ---------------- Income tax ---------------- */

test('income tax IY 2025-26: general, Tk 10 lakh, no investment', () => {
  // 3.5L @0, 1L @5% = 5,000, 4L @10% = 40,000, 1.5L @15% = 22,500 → 67,500
  const r = bdIncomeTax({ year: '2025-26', income: 1000000 });
  close(r.gross, 67500);
  close(r.payable, 67500);
  assert.equal(r.threshold, 350000);
});

test('income tax IY 2026-27: general, Tk 10 lakh (5% slab removed)', () => {
  // 4L @0, 3L @10% = 30,000, 3L @15% = 45,000 → 75,000
  close(bdIncomeTax({ year: '2026-27', income: 1000000 }).gross, 75000);
});

test('income tax: thresholds by category and disabled-child allowance', () => {
  assert.equal(bdIncomeTax({ year: '2025-26', category: 'woman', income: 0 }).threshold, 400000);
  assert.equal(bdIncomeTax({ year: '2025-26', category: 'senior', income: 0 }).threshold, 400000);
  assert.equal(bdIncomeTax({ year: '2025-26', category: 'disabled', income: 0 }).threshold, 475000);
  assert.equal(bdIncomeTax({ year: '2025-26', category: 'third', income: 0 }).threshold, 475000);
  assert.equal(bdIncomeTax({ year: '2025-26', category: 'ff', income: 0 }).threshold, 500000);
  assert.equal(bdIncomeTax({ year: '2026-27', category: 'woman', income: 0 }).threshold, 450000);
  assert.equal(bdIncomeTax({ year: '2026-27', category: 'disabled', income: 0 }).threshold, 525000);
  assert.equal(bdIncomeTax({ year: '2026-27', category: 'ff', income: 0 }).threshold, 550000);
  assert.equal(bdIncomeTax({ year: '2025-26', disabledChildren: 2, income: 0 }).threshold, 450000);
  // Woman, IY 2025-26, Tk 6 lakh: 4L @0, 1L @5% = 5,000, 1L @10% = 10,000 → 15,000
  close(bdIncomeTax({ year: '2025-26', category: 'woman', income: 600000 }).gross, 15000);
  assert.throws(() => bdIncomeTax({ category: 'alien' }));
});

test('income tax: rebate is the lowest of the three limits (IY 2025-26)', () => {
  // income 10L, investment 1L: 15% = 15,000; 3% of income = 30,000; cap 10L → 15,000
  let r = bdIncomeTax({ year: '2025-26', income: 1000000, investment: 100000 });
  close(r.rebate, 15000);
  close(r.payable, 52500);
  // investment 5L: 15% = 75,000 but 3% of income = 30,000 → 30,000
  r = bdIncomeTax({ year: '2025-26', income: 1000000, investment: 500000 });
  close(r.rebate, 30000);
  close(r.payable, 37500);
});

test('income tax: rebate rules IY 2026-27 (10%, cap 7.5 lakh)', () => {
  // income 10L, investment 1L → 10% = 10,000 → 75,000 − 10,000 = 65,000
  close(bdIncomeTax({ year: '2026-27', income: 1000000, investment: 100000 }).payable, 65000);
  // income 5 crore, investment 2 crore: 10% = 20L, 3% = 15L, cap 7.5L → 7.5L
  close(bdIncomeTax({ year: '2026-27', income: 50000000, investment: 20000000 }).rebate, 750000);
});

test('income tax: minimum tax by area and for new taxpayers', () => {
  // 4L income IY 2025-26 general: 50,000 @5% = 2,500 < min
  let r = bdIncomeTax({ year: '2025-26', income: 400000, area: 'dhaka' });
  close(r.gross, 2500);
  close(r.payable, 5000);
  assert.ok(r.minApplied);
  close(bdIncomeTax({ year: '2025-26', income: 400000, area: 'city' }).payable, 4000);
  close(bdIncomeTax({ year: '2025-26', income: 400000, area: 'other' }).payable, 3000);
  close(bdIncomeTax({ year: '2025-26', income: 400000, newTaxpayer: true }).payable, 2500);
  close(bdIncomeTax({ year: '2025-26', income: 360000, newTaxpayer: true }).payable, 1000);
  close(bdIncomeTax({ year: '2026-27', income: 420000, area: 'other' }).payable, 5000);
  // At/below threshold no minimum tax
  assert.equal(bdIncomeTax({ year: '2025-26', income: 350000 }).payable, 0);
});

test('income tax: top slab', () => {
  // IY 2025-26, 1 crore: 0 + 5,000 + 40,000 + 75,000 + 1,00,000 + 5,00,000 (20L@25%) + (1cr − 38.5L)=61.5L @30% = 18,45,000
  close(bdIncomeTax({ year: '2025-26', income: 10000000 }).gross, 2565000);
});

test('income tax calculator: salary exemption, TDS and slab table', () => {
  // salary 9L → exempt 3L → taxable 6L; IY 2025-26: 1L@5% + 1.5L@10% = 5,000 + 15,000 = 20,000;
  // rebate on 1L investment: min(15,000, 18,000) = 15,000 → 5,000 = minimum (Dhaka) → 5,000
  const r = run('bd-income-tax', { salary: 900000, investment: 100000, other: 0 });
  close(item(r, /Total taxable income/).value, 600000);
  close(r.primary.value, 5000);
  assert.equal(r.table.rows.length, 7);
  close(r.table.rows[1][3], 5000);
  // Salary 24L → exemption capped at 5L
  const r2 = run('bd-income-tax', { salary: 2400000, investment: 0, paid: 100000 });
  close(item(r2, /Salary exemption/).value, 500000);
  // taxable 19L: 5,000 + 40,000 + 75,000 + 1,00,000 (5L@20%) + 12,500 (0.5L@25%) = 2,32,500; minus paid 1,00,000 → 1,32,500
  close(r2.primary.value, 232500);
  close(item(r2, /Balance payable/).value, 132500);
});

/* ---------------- Sanchayapatra ---------------- */

test('Paribar Sanchayapatra Tk 10 lakh: monthly profit at 11.80%', () => {
  // 10,00,000 × 11.80% / 12 = 9,833.33; TDS 10% = 983.33; net 8,850
  const r = sanchayapatra({ scheme: 'paribar', amount: 1000000, tds: 10 });
  assert.equal(r.rate, 11.80);
  close(r.per, 9833.33);
  close(r.perNet, 8850);
  assert.equal(r.n, 60);
  close(r.net, 531000);
});

test('Sanchayapatra slab at Tk 7.5 lakh including existing holdings', () => {
  // Paribar 5L alone → 11.93%; 5L with 3L existing → 11.80%
  assert.equal(sanchayapatra({ scheme: 'paribar', amount: 500000 }).rate, 11.93);
  assert.equal(sanchayapatra({ scheme: 'paribar', amount: 750000 }).rate, 11.93);
  assert.equal(sanchayapatra({ scheme: 'paribar', amount: 500000, existing: 300000 }).rate, 11.80);
  // Pensioner 5L quarterly: 5,00,000 × 11.98% / 4 = 14,975
  close(sanchayapatra({ scheme: 'pensioner', amount: 500000, tds: 10 }).per, 14975);
});

test('5-year Bangladesh Sanchayapatra pays simple profit at maturity; 3-month pays quarterly for 3 years', () => {
  // 5L × 11.83% × 5 = 2,95,750; TDS 10% → net 2,66,175
  const r = sanchayapatra({ scheme: 'bsp5', amount: 500000, tds: 10 });
  assert.equal(r.n, 1);
  close(r.gross, 295750);
  close(r.net, 266175);
  const q = sanchayapatra({ scheme: 'q3', amount: 1000000, tds: 10 });
  assert.equal(q.n, 12);
  close(q.per, 29425); // 10L × 11.77% / 4
  const calc = run('bd-sanchayapatra', { scheme: 'q3', amount: 1000000 });
  assert.equal(calc.table.rows.length, 12);
  close(calc.primary.value, 26482.5);
});

/* ---------------- FDR / DPS / excise ---------------- */

test('excise duty slabs (FY 2026-27)', () => {
  assert.equal(exciseDuty(400000), 0);
  assert.equal(exciseDuty(400001), 150);
  assert.equal(exciseDuty(500000), 150);
  assert.equal(exciseDuty(1000000), 500);
  assert.equal(exciseDuty(1000001), 3000);
  assert.equal(exciseDuty(5000001), 5000);
  assert.equal(exciseDuty(10000001), 10000);
  assert.equal(exciseDuty(20000001), 20000);
  assert.equal(exciseDuty(60000000), 50000);
});

test('FDR simple 1 year: Tk 5 lakh at 10%', () => {
  // interest 50,000; TDS 10% 5,000; balance 5,45,000 → excise 500 (5L–10L) → 5,44,500
  const r = fdr({ amount: 500000, rate: 10, months: 12, period: 0, tds: 10 });
  close(r.grossInt, 50000);
  close(r.tdsTotal, 5000);
  assert.equal(r.excise, 500);
  close(r.maturity, 544500);
  // without TIN: 15%
  close(fdr({ amount: 500000, rate: 10, months: 12, tds: 15 }).maturity, 500000 + 42500 - 500);
});

test('FDR auto-renewed quarterly compounds net of tax', () => {
  // 1L at 8% for 12 months, quarterly: each quarter interest 2% × (1 − 10%) = 1.8% net
  const r = fdr({ amount: 100000, rate: 8, months: 12, period: 3, tds: 10 });
  close(r.maturity, 100000 * 1.018 ** 4, 0.01);
  assert.equal(r.excise, 0);
});

test('FDR monthly income scheme pays interest out', () => {
  // 10L at 9% → 7,500/month gross, 6,750 net; principal stays 10L, excise 500/yr
  const r = fdr({ amount: 1000000, rate: 9, months: 12, period: -1, tds: 10 });
  close(r.paidOut / 12, 6750);
  close(r.maturity, 1000000 - 500);
  const calc = run('bd-fdr', { amount: 1000000, rate: 9, months: '12', period: '-1' });
  close(calc.primary.value, 6750);
});

test('DPS with monthly compounding matches annuity-due formula', () => {
  const i = 0.09 / 12;
  const n = 60;
  const fv = 5000 * ((1 + i) ** n - 1) / i * (1 + i);
  const r = dps({ monthly: 5000, rate: 9, years: 5, period: 1, tds: 10 });
  close(r.gross, fv, 0.01);
  close(r.interest, fv - 300000, 0.01);
  close(r.tds, (fv - 300000) * 0.1, 0.01);
  assert.equal(r.excise, 0); // balance stays below Tk 4 lakh
  close(r.net, fv - (fv - 300000) * 0.1, 0.01);
});

test('DPS excise duty applies once the balance passes Tk 4 lakh', () => {
  // 10,000/month, 0% for 5 years: balances 1.2L, 2.4L, 3.6L, 4.8L (Tk 150), 6L (Tk 500)
  const r = dps({ monthly: 10000, rate: 0, years: 5, period: 1, tds: 10 });
  assert.equal(r.excise, 650);
  close(r.net, 600000 - 650);
});

/* ---------------- Gold ---------------- */

test('vori/ana/rati/point conversions', () => {
  close(toGrams({ vori: 1 }), 11.664, 1e-9);
  close(toGrams({ ana: 16 }), 11.664, 1e-9);
  close(toGrams({ ana: 1 }), 0.729, 1e-9);
  close(toGrams({ rati: 6 }), 0.729, 1e-9);
  close(toGrams({ point: 10 }), 0.1215, 1e-9);
  assert.deepEqual(fromGrams(toGrams({ vori: 2, ana: 5, rati: 3, point: 4 })), { vori: 2, ana: 5, rati: 3, point: 4 });
});

test('gold price: 1 vori 22K at Tk 2,00,000 with 6% making and 5% VAT', () => {
  // metal 2,00,000; making 12,000; VAT on metal only 10,000 → 2,22,000
  let r = goldPrice({ grams: VORI_G, pricePerVori: 200000, makingPct: 6, vatPct: 5 });
  close(r.total, 222000);
  // VAT also on making: 5% × 2,12,000 = 10,600 → 2,22,600
  r = goldPrice({ grams: VORI_G, pricePerVori: 200000, makingPct: 6, vatPct: 5, vatOnMaking: true });
  close(r.total, 222600);
  // 8 ana = half vori
  const c = run('bd-gold-price', { karat: '21', p21: 200000, vori: 0, ana: 8, making: 0, vat: 0 });
  close(c.primary.value, 100000);
  const g = run('bd-gold-price', { unit: 'gram', grams: 11.664, p22: 100000, making: 0, vat: 5 });
  close(g.primary.value, 105000);
  const s = run('bd-gold-price', { metal: 'silver', psilver: 3000, vori: 2, making: 0, vat: 5 });
  close(s.primary.value, 6300);
});

/* ---------------- Electricity ---------------- */

test('electricity: lifeline and telescopic slabs (BERC June 2026)', () => {
  // 40 units lifeline: 40 × 4.63 = 185.20; demand 2 kW × 42 = 84; VAT 5% of 269.20 = 13.46
  let r = electricityBill({ units: 40, loadKw: 2 });
  close(r.energy, 185.2);
  close(r.total, 282.66);
  // 250 units: 75×5.26=394.5 + 125×8.50=1062.5 + 50×9.10=455 → 1912; +84 = 1996; VAT 99.80 → 2095.80
  r = electricityBill({ units: 250, loadKw: 2 });
  close(r.energy, 1912);
  close(r.total, 2095.8);
  assert.equal(r.rows.length, 3);
  // 700 units: 394.5 + 1062.5 + 910 + 962 + 200×15.01=3002 + 100×17.35=1735 → 8066
  close(electricityBill({ units: 700, loadKw: 0 }).energy, 8066);
  // 51 units → no lifeline: 51 × 5.26
  close(electricityBill({ units: 51, loadKw: 0 }).energy, 268.26);
});

/* ---------------- Pension ---------------- */

test('pension rate and gratuity tables', () => {
  assert.equal(pensionRate(4), 0);
  assert.equal(pensionRate(5), 21);
  assert.equal(pensionRate(9), 33);
  assert.equal(pensionRate(10), 36);
  assert.equal(pensionRate(15), 54);
  assert.equal(pensionRate(20), 72);
  assert.equal(pensionRate(25), 90);
  assert.equal(pensionRate(33), 90);
  assert.equal(gratuityRate(7), 265);
  assert.equal(gratuityRate(12), 260);
  assert.equal(gratuityRate(18), 245);
  assert.equal(gratuityRate(25), 230);
});

test('pension: basic Tk 78,000, 25 years, 50% commutation', () => {
  // gross 70,200; commuted 35,100 × 230 = 80,73,000; net 35,100; leave 18 × 78,000 = 14,04,000
  const r = govtPension({ basic: 78000, years: 25, commute: 50, medical: 1500, leaveMonths: 18, gpf: 1000000 });
  close(r.gross, 70200);
  close(r.gratuity, 8073000);
  close(r.net, 35100);
  close(r.monthly, 36600);
  close(r.leave, 1404000);
  close(r.lumpSum, 8073000 + 1404000 + 1000000);
  // 100% surrender doubles gratuity, no monthly pension
  const f = govtPension({ basic: 78000, years: 25, commute: 100, medical: 1500 });
  close(f.gratuity, 16146000);
  assert.equal(f.net, 0);
  assert.equal(f.monthly, 0);
  assert.throws(() => govtPension({ basic: 50000, years: 3 }));
  // leave encashment capped at 18 months
  close(govtPension({ basic: 10000, years: 10, leaveMonths: 24 }).leave, 180000);
});

test('pension calculator: 12 years service, overrides, projection', () => {
  // 12 yrs → 43.2%; basic 50,000 → gross 21,600; commuted 10,800 × 260 = 28,08,000
  const r = run('bd-govt-pension', { basic: 50000, years: 12 });
  close(r.primary.value, 2808000);
  close(item(r, /^Net monthly pension/).value, 10800);
  assert.equal(r.table.rows.length, 10);
  close(r.table.rows[1][1], 10800 * 1.05);
  const o = run('bd-govt-pension', { basic: 50000, years: 12, ratePct: 50, gratuityPerTk: 230 });
  close(o.primary.value, 12500 * 230);
});

/* ---------------- GPF ---------------- */

test('GPF slab interest', () => {
  close(gpfYearlyInterest(1000000), 130000);
  close(gpfYearlyInterest(2000000), 195000 + 60000);
  close(gpfYearlyInterest(4000000), 195000 + 180000 + 110000);
});

test('GPF projection: monthly balances, yearly credit', () => {
  // Opening 0, subscription 10,000/month, 1 year: balances 10k..120k → sum 7,80,000 × 13% / 12 = 8,450
  const r = gpf({ opening: 0, basic: 100000, subPct: 10, years: 1 });
  close(r.totalInt, 8450);
  close(r.balance, 128450);
  // Opening 10L, no subscription: 1,30,000 for year 1; year 2 on 11.3L → 1,46,900
  const r2 = gpf({ opening: 1000000, basic: 0, subPct: 10, years: 2 });
  close(r2.rows[0][2], 130000);
  close(r2.balance, 1130000 * 1.13);
  const c = run('bd-gpf', { opening: 0, basic: 100000, subPct: 10, years: 1, payRise: 0 });
  close(c.primary.value, 128450);
});
