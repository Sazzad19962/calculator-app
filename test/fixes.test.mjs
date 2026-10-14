// Regression tests for issues found in review (charts on Bangla pages, pinned currency, e-notation, unit symbols).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizeResult, makeTranslator, templateKey } from '../src/i18n.js';
import { format, getCurrency, pinCurrency, sciNotation } from '../src/format.js';
import { CALCULATORS, byId } from '../src/registry.js';
import bn, { clientDict } from '../src/i18n/bn.js';

test('localizeResult keeps numeric stacked-chart parts (Bangla bar charts were empty)', () => {
  const tr = makeTranslator(bn, 'bd-dps');
  const res = { chart: { type: 'stacked', legend: ['Deposits', 'Interest'], data: [{ label: 'Y1', parts: [1000, 50] }, { label: 'Y2', parts: [{ label: 'Deposits', value: 5 }] }] } };
  const out = localizeResult(res, tr);
  assert.deepEqual(out.chart.data[0].parts, [1000, 50]);
  assert.equal(out.chart.data[1].parts[0].value, 5);
  assert.notEqual(out.chart.data[1].parts[0].label, 'Deposits');
});

test('every stacked chart part survives localisation as a finite number', () => {
  for (const c of CALCULATORS) {
    if (typeof c.compute !== 'function') continue;
    const s = {};
    for (const inp of c.inputs) s[inp.id] = inp.type === 'checkbox' ? Boolean(inp.value) : String((typeof inp.value === 'function' ? inp.value(s) : inp.value) ?? '');
    let res;
    try { res = c.compute({ ...s }); } catch { continue; }
    if (res?.chart?.type !== 'stacked') continue;
    const out = localizeResult(res, makeTranslator(bn, c.id));
    for (const d of out.chart.data) for (const p of d.parts || []) {
      const v = typeof p === 'number' ? p : p?.value;
      assert.ok(Number.isFinite(v), `${c.id}: chart part became ${JSON.stringify(p)}`);
    }
  }
});

test('number templates match e-notation, so huge values still translate', () => {
  assert.equal(templateKey('Cost at 1e+300 per ft²'), 'Cost at # per ft²');
  assert.equal(templateKey('1.0e+300 vori'), '# vori');
});

test('format shows very large/small numbers as × 10ⁿ, not raw e-notation', () => {
  assert.equal(sciNotation(3.064501299e24), '3.064501299 × 10²⁴');
  assert.equal(format(2.32e-10), '2.32 × 10⁻¹⁰');
  assert.equal(format(1234.5), '1,234.5');
});

test('Bangladesh calculators pin Taka regardless of the visitor currency', () => {
  for (const c of CALCULATORS.filter((x) => x.cat === 'bangladesh')) assert.equal(c.currency, 'BDT', c.id);
  try {
    pinCurrency('BDT');
    assert.equal(getCurrency(), 'BDT');
    assert.match(format(500000, 'money'), /^৳5,00,000\.00$/);
    pinCurrency('');
    assert.notEqual(getCurrency(), undefined);
  } finally { pinCurrency(''); }
});

test('unit converter shows symbols, not internal ids', () => {
  const uc = byId['unit-converter'];
  const labels = uc.inputs.find((i) => i.id === 'from').options({ cat: 'volume' }).map((o) => o[1]);
  assert.ok(labels.includes('Cubic foot (ft³)'));
  assert.ok(labels.includes('Gallon (Imperial) (imp gal)'));
  assert.ok(!labels.some((l) => /\((ft3|m3|floz|igal)\)/.test(l)));
  const speed = uc.inputs.find((i) => i.id === 'from').options({ cat: 'speed' }).map((o) => o[1]);
  assert.ok(speed.includes('Kilometre/hour (km/h)'));
});

test('Bangla edition ships localized default text for textarea calculators', () => {
  const d = clientDict();
  assert.match(d.calc['square-footage'].defaults.rooms, /বসার ঘর/);
  assert.match(d.calc['time-card'].defaults.times, /রবি/);
  const r = byId['square-footage'].compute({ ...Object.fromEntries(byId['square-footage'].inputs.map((i) => [i.id, String(i.value ?? '')])), rooms: d.calc['square-footage'].defaults.rooms });
  assert.equal(r.primary.value, 504);
});

test('error and note strings reached by unusual inputs are translated', () => {
  const tr = makeTranslator(bn, 'time-duration');
  for (const s of ['The end time is earlier than the start, so the shift is assumed to run past midnight.', 'Only whole numbers are supported.', 'Date of birth must be on or before the "age on" date.', "The first day of your last period can't be in the future.", 'Business days (Mon–Fri)']) {
    assert.ok(!/[A-Za-z]{3}/.test(tr(s)), `untranslated: ${s} → ${tr(s)}`);
  }
});
