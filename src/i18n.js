// Runtime localisation helpers shared by the browser (engine/app) and Node (build, tests).
// English is the source language: every UI string and every label returned by a calculator's compute()
// is looked up in a dictionary (see src/i18n/bn.js) and falls back to English when no translation exists.
//
// Lookup order for a string s:
//   1. exact match (calculator-specific strings, then shared strings, then UI strings)
//   2. "template" match: numbers (with an optional currency symbol) are replaced by "#", e.g.
//      "PMI (first 9 months)" → "PMI (first # months)"; the translation uses {1}, {2}… for those numbers
//   3. the same template with singular/plural noun variants ("# month" ↔ "# months")
//   4. regex patterns (validation messages that embed a field name)
//   5. word-by-word (dates like "Oct 2026", durations like "3 yr 4 mo") when every word is known

const NUM_TOKEN = /(?:C\$|A\$|Rs |AED |SAR |[$€£৳₹¥])?[-−+]?\d+(?:[.,]\d+)*(?:e[-+]?\d+)?/g;
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/** "PMI (first 9 months)" → "PMI (first # months)" */
export const templateKey = (s) => String(s).replace(NUM_TOKEN, '#');

/** ASCII digits → Bangla digits (display only). */
export const toBnDigits = (s) => String(s).replace(/[0-9]/g, (d) => BN_DIGITS[d]);

/** Bangla (and Arabic-Indic) digits → ASCII digits, so inputs accept both. */
export const toAsciiDigits = (s) => String(s ?? '').replace(/[০-৯]/g, (d) => String(d.charCodeAt(0) - 0x09e6)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

function fill(tpl, values) {
  let i = 0;
  return tpl.replace(/\{(\d)\}|#/g, (m, k) => {
    if (k) return values[Number(k) - 1] ?? '';
    return values[i++] ?? '';
  });
}

const variants = (key) => {
  const out = [];
  const sing = key.replace(/# ([A-Za-z]+?)s\b/g, '# $1');
  if (sing !== key) out.push(sing);
  const plur = key.replace(/# (year|month|week|day|hour|minute|second|payment|period|cycle|bag|box|tile|row|kWh|unit|item|deposit|instalment|installment)\b/g, '# $1s');
  if (plur !== key) out.push(plur);
  return out;
};

/**
 * Builds a translator for one calculator (or for UI only when calcId is empty).
 * @param {object} dict  bn.js default export: { ui, strings, words, patterns, calc }
 * @param {string} [calcId]
 */
export function makeTranslator(dict, calcId = '') {
  const c = (calcId && dict.calc?.[calcId]) || {};
  const inputLabels = {};
  const calcDef = c.inputs || {};
  for (const [, v] of Object.entries(calcDef)) if (v && v.en && v.label) inputLabels[v.en] = v.label;
  const tables = [c.strings || {}, inputLabels, dict.strings || {}, dict.ui || {}];
  const lower = new Map();
  for (const tb of tables) for (const [k, v] of Object.entries(tb)) if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), v);
  const words = dict.words || {};
  const patterns = (dict.patterns || []).map((p) => ({ ...p, re: typeof p.re === 'string' ? new RegExp(p.re, p.flags || '') : p.re }));

  const exact = (k) => {
    for (const tb of tables) if (Object.prototype.hasOwnProperty.call(tb, k)) return tb[k];
    return undefined;
  };

  function lookup(s, loose) {
    if (s == null || s === '') return undefined;
    const str = String(s);
    let hit = exact(str);
    if (hit !== undefined) return hit;
    const values = str.match(NUM_TOKEN) || [];
    const key = templateKey(str);
    if (values.length) {
      hit = exact(key);
      if (hit !== undefined) return fill(hit, values);
      for (const k of variants(key)) { hit = exact(k); if (hit !== undefined) return fill(hit, values); }
    }
    if (loose) {
      hit = lower.get(str.toLowerCase()) ?? lower.get(key.toLowerCase());
      if (hit !== undefined) return values.length ? fill(hit, values) : hit;
    }
    for (const p of patterns) {
      const m = str.match(p.re);
      if (!m) continue;
      const parts = m.slice(1).map((g, i) => (p.keep?.includes(i + 1) ? g : (lookup(g, true) ?? null)));
      if (parts.some((x) => x === null)) continue;
      return p.to.replace(/\$(\d)/g, (_, n) => parts[Number(n) - 1] ?? '');
    }
    // Notes built from several sentences: translate sentence by sentence when every sentence is known.
    const sentences = str.split(/(?<=[.!?)])\s+(?=[A-Z*(])/);
    if (sentences.length > 1) {
      const parts = sentences.map((x) => lookup(x, false));
      if (parts.every((x) => x !== undefined)) return parts.join(' ');
    }
    // Word-by-word, only when every alphabetic word is known (dates, short durations).
    const tokens = str.split(/([A-Za-z][A-Za-z.']*)/);
    let known = true;
    let any = false;
    const outw = tokens.map((tok, i) => {
      if (i % 2 === 0) return tok;
      any = true;
      const w = words[tok] ?? words[tok.replace(/\.$/, '')];
      if (w === undefined) { known = false; return tok; }
      return w;
    });
    if (any && known) return outw.join('');
    return undefined;
  }

  const tr = (s) => {
    if (typeof s !== 'string' || !/[A-Za-z]/.test(s)) return s;
    const hit = lookup(s, false);
    return hit === undefined ? s : hit;
  };
  tr.has = (s) => typeof s !== 'string' || !/[A-Za-z]/.test(s) || lookup(s, false) !== undefined;
  tr.calc = c;
  tr.input = (inp) => {
    const t = calcDef[inp.id] || {};
    return {
      label: t.label || tr(inp.label),
      help: inp.help ? (t.help || tr(inp.help)) : '',
      suffix: inp.suffix ? (t.suffix || tr(inp.suffix)) : '',
      option: (value, label) => (t.options && t.options[value] !== undefined ? t.options[value] : tr(label)),
    };
  };
  return tr;
}

/** Returns a translated deep copy of a compute() result. */
export function localizeResult(res, tr, digits = (s) => s) {
  if (!res || !tr) return res;
  const T = (s) => (typeof s === 'string' ? tr(s) : s);
  const V = (v, type) => (typeof v === 'string' && type !== 'mono' ? tr(v) : v);
  const out = { ...res };
  if (res.primary) out.primary = { ...res.primary, label: T(res.primary.label), unit: T(res.primary.unit), badge: T(res.primary.badge), value: V(res.primary.value, res.primary.type) };
  if (res.items) out.items = res.items.map((it) => ({ ...it, label: T(it.label), unit: T(it.unit), value: V(it.value, it.type) }));
  if (res.note) out.note = T(res.note);
  if (res.table) {
    const types = res.table.types || [];
    out.table = { ...res.table, title: T(res.table.title), head: (res.table.head || []).map(T), rows: (res.table.rows || []).map((r) => r.map((cell, i) => (typeof cell === 'string' && types[i] !== 'mono' ? tr(cell) : cell))) };
  }
  if (res.chart) {
    out.chart = {
      ...res.chart,
      data: (res.chart.data || []).map((d) => ({ ...d, label: digits(T(String(d.label))), ...(d.parts ? { parts: d.parts.map((q) => (q && typeof q === 'object' ? { ...q, label: T(q.label) } : q)) } : {}) })),
      ...(res.chart.legend ? { legend: res.chart.legend.map(T) } : {}),
    };
  }
  if (res.gauge) out.gauge = { ...res.gauge, bands: (res.gauge.bands || []).map((b) => (Array.isArray(b) ? [b[0], T(b[1]), ...b.slice(2)] : { ...b, label: T(b.label) })) };
  return out;
}

/* ---------- Browser-side current locale ---------- */
let current = null;
const DIGIT_KEY = 'calc.digits';

export function setTranslator(tr) { current = tr; }
export const getTranslator = () => current;
export const isBangla = () => Boolean(current);

/** Translate a UI string (identity on English pages). */
export const t = (s) => (current ? current(s) : s);

/** Whether Bangla numerals are shown (Bangla pages only; toggle remembered per visitor). */
export function bnDigitsOn() {
  if (!current) return false;
  try { return localStorage.getItem(DIGIT_KEY) !== 'en'; } catch { return true; }
}
export function setBnDigits(on) {
  try { localStorage.setItem(DIGIT_KEY, on ? 'bn' : 'en'); } catch { /* ignore */ }
}
/** Converts digits for display when Bangla numerals are on. */
export const D = (s) => (bnDigitsOn() ? toBnDigits(s) : String(s));

/** Converts digits in every text node under el (display only; never touches form fields). */
export function digitsInDOM(el) {
  if (!el || !bnDigitsOn() || typeof document === 'undefined') return;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    if (n.parentElement?.closest('input, textarea, select, code, .mono, script, style')) continue;
    if (/[0-9]/.test(n.nodeValue)) n.nodeValue = toBnDigits(n.nodeValue);
  }
}
