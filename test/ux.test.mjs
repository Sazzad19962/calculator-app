import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupDigits, regroupWithCaret, stripGrouping, formatCompact, toCSV } from '../src/format.js';
import { niceScale } from '../src/chart.js';
import { CALCULATORS } from '../src/registry.js';

test('groupDigits: western and Indian grouping, partial input preserved', () => {
  assert.equal(groupDigits('1234567'), '1,234,567');
  assert.equal(groupDigits('1234567.891'), '1,234,567.891');
  assert.equal(groupDigits('1234.'), '1,234.');
  assert.equal(groupDigits('-9876543'), '-9,876,543');
  assert.equal(groupDigits('999'), '999');
  assert.equal(groupDigits(''), '');
  assert.equal(groupDigits('1,2,3,4'), '1,234');
  assert.equal(groupDigits('12345678', 'en-IN'), '1,23,45,678');
  assert.equal(groupDigits('100000', 'en-IN'), '1,00,000');
  assert.equal(groupDigits('abc'), 'abc', 'non-numeric text is left alone for validation');
  assert.equal(groupDigits('1e5'), '1e5');
});

test('regroupWithCaret keeps the caret after the same digit', () => {
  // typing "5" at the end of "1,234" → "12345|"
  assert.deepEqual(regroupWithCaret('1,2345', 6), { value: '12,345', caret: 6 });
  // inserting a digit in the middle: "1,2|34" + "9" → "1,29|34" → "12,9|34"
  assert.deepEqual(regroupWithCaret('1,2934', 4), { value: '12,934', caret: 4 });
  // deleting a digit so a separator disappears: "1,23|4" backspace → "1,2|4" → "12|4"
  assert.deepEqual(regroupWithCaret('1,24', 3), { value: '124', caret: 2 });
  // caret at start stays at start
  assert.deepEqual(regroupWithCaret('91234', 0), { value: '91,234', caret: 0 });
  // unchanged value keeps caret
  assert.deepEqual(regroupWithCaret('1,234', 2), { value: '1,234', caret: 2 });
  assert.deepEqual(regroupWithCaret('1234567', 7, 'en-IN'), { value: '12,34,567', caret: 9 });
});

test('stripGrouping removes separators and spaces', () => {
  assert.equal(stripGrouping('1,23,456.7'), '123456.7');
  assert.equal(stripGrouping(' 12 345 '), '12345');
  assert.equal(Number(stripGrouping(groupDigits('987654321.25'))), 987654321.25);
});

test('formatCompact for chart axes', () => {
  assert.equal(formatCompact(0, 'USD'), '$0');
  assert.equal(formatCompact(1500, 'USD'), '$1.5K');
  assert.equal(formatCompact(250000, 'USD'), '$250K');
  assert.equal(formatCompact(1200000, 'USD'), '$1.2M');
  assert.equal(formatCompact(2500000000, 'USD'), '$2.5B');
  assert.equal(formatCompact(150000, 'BDT'), '৳1.5L');
  assert.equal(formatCompact(25000000, 'INR'), '₹2.5Cr');
  assert.equal(formatCompact(-3000, 'EUR'), '−€3K');
});

test('toCSV escapes cells and keeps numbers machine-readable', () => {
  const csv = toCSV(['Year', 'Note', 'Balance'], [[1, 'a, "b"', 1234.5678], [2, 'line\nbreak', 0]], ['int', 'text', 'money']);
  assert.equal(csv, 'Year,Note,Balance\r\n1,"a, ""b""",1234.57\r\n2,"line\nbreak",0');
});

test('niceScale gives round axis maxima', () => {
  assert.deepEqual(niceScale(950), { max: 1000, step: 250 });
  assert.deepEqual(niceScale(1234567), { max: 1500000, step: 500000 });
  assert.deepEqual(niceScale(8), { max: 8, step: 2 });
  const s = niceScale(0);
  assert.ok(s.max > 0 && s.step > 0);
});

test('every numeric input default is a valid plain number (validation will not flag defaults)', () => {
  const NUM_RE = /^[-−+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
  for (const c of CALCULATORS) {
    const state = {};
    for (const inp of c.inputs || []) {
      const v = typeof inp.value === 'function' ? inp.value(state) : inp.value;
      state[inp.id] = v;
      if (inp.type !== 'number' || v === '' || v === undefined) continue;
      assert.ok(NUM_RE.test(String(v)), `${c.id}.${inp.id} default "${v}" is not a plain number`);
      if (typeof inp.min === 'number') assert.ok(Number(v) >= inp.min, `${c.id}.${inp.id} default below min`);
      if (typeof inp.max === 'number') assert.ok(Number(v) <= inp.max, `${c.id}.${inp.id} default above max`);
    }
  }
});
