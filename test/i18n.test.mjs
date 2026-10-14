// Bangla (bn) localisation: coverage of every calculator, digit handling and result localisation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CALCULATORS } from '../src/registry.js';
import dict, { clientDict } from '../src/i18n/bn.js';
import { makeTranslator, localizeResult, toBnDigits, toAsciiDigits, templateKey } from '../src/i18n.js';
import { harvest } from '../scripts/i18n-harvest.mjs';

test('every calculator has a Bangla name, description, about text and FAQ', () => {
  const missing = [];
  for (const c of CALCULATORS) {
    const b = dict.calc[c.id];
    if (!b || !b.name || !b.desc || !b.about || !Array.isArray(b.faq) || b.faq.length < 3) missing.push(c.id);
    else for (const f of b.faq) assert.ok(f.q && f.a, `${c.id}: FAQ entry needs q and a`);
  }
  assert.deepEqual(missing, []);
});

test('Bangla names and about texts are actually Bangla', () => {
  for (const c of CALCULATORS) {
    const b = dict.calc[c.id];
    assert.match(b.name, /[ঀ-৿]/, `${c.id} name`);
    assert.match(b.about, /[ঀ-৿]/, `${c.id} about`);
  }
});

test('every user-visible string a calculator can produce has a Bangla translation', () => {
  const report = {};
  for (const c of CALCULATORS) {
    const { fixed, dynamic } = harvest(c);
    const tr = makeTranslator(dict, c.id);
    const miss = [...new Set([...fixed, ...dynamic])].filter((s) => /[a-z]{2,}/.test(s) && !tr.has(s));
    if (miss.length) report[c.id] = miss.slice(0, 5);
  }
  assert.deepEqual(report, {});
});

test('digits: display conversion and input normalisation', () => {
  assert.equal(toBnDigits('৳2,547.62'), '৳২,৫৪৭.৬২');
  assert.equal(toAsciiDigits('৫,০০,০০০'), '5,00,000');
  assert.equal(toAsciiDigits('١٢٣'), '123');
  assert.equal(toAsciiDigits(toBnDigits('1234567890')), '1234567890');
});

test('translator: exact, template, pattern and word-by-word lookups', () => {
  const tr = makeTranslator(dict, 'mortgage');
  assert.equal(tr('Calculate'), 'হিসাব করুন');
  assert.equal(templateKey('PMI (first 9 months)'), 'PMI (first # months)');
  assert.equal(makeTranslator(dict, 'percent-error')('−3.16% (underestimate)'), '−3.16% (প্রকৃত মানের চেয়ে কম)');
  assert.equal(makeTranslator(dict, 'day-of-week')('2nd Wednesday of the month'), 'মাসের দ্বিতীয় বুধবার');
  assert.equal(tr('Enter a home price.'), `${tr('Home price')} লিখুন।`);
  assert.equal(tr('Unknown string stays English'), 'Unknown string stays English');
});

test('localizeResult translates labels but keeps numbers and mono values', () => {
  const sleep = CALCULATORS.find((c) => c.id === 'sleep');
  const res = sleep.compute({ mode: 'wake', time: '07:00', fall: '15', cycle: '90' });
  const out = localizeResult(res, makeTranslator(dict, 'sleep'));
  assert.equal(out.primary.label, 'ঘুমাতে যান');
  assert.match(out.primary.value, /9:45 পিএম/);
  assert.equal(out.table.title, 'সব বিকল্প');
  assert.equal(out.table.rows[0][1], res.table.rows[0][1]);
  const sci = CALCULATORS.find((c) => c.id === 'scientific-notation');
  const r2 = localizeResult(sci.compute({ n: '0.00045' }), makeTranslator(dict, 'scientific-notation'));
  assert.equal(r2.primary.value, '4.5 × 10⁻⁴');
});

test('client dictionary leaves out the long about/FAQ prose', () => {
  const slim = clientDict();
  assert.ok(slim.calc.mortgage.name);
  assert.equal(slim.calc.mortgage.about, undefined);
  assert.equal(slim.calc.mortgage.faq, undefined);
});
