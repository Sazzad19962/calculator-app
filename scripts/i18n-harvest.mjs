// Collects every user-visible English string a calculator can produce (names, inputs, option labels,
// result labels, notes, table heads, chart labels, validation errors) by running compute() over many
// input combinations. Used to find strings missing from src/i18n/bn.js:
//   node scripts/i18n-harvest.mjs            → prints a coverage report
//   node scripts/i18n-harvest.mjs --missing  → prints untranslated strings as JSON
//   node scripts/i18n-harvest.mjs --all      → prints every harvested string as JSON
import { CALCULATORS } from '../src/registry.js';
import { templateKey } from '../src/i18n.js';

const resolve = (x, s) => (typeof x === 'function' ? x(s) : x);
const opts = (inp, s) => { try { return (resolve(inp.options, s) || []).map((o) => (Array.isArray(o) ? o : [o, o])); } catch { return []; } };

function defaults(c) {
  const s = {};
  for (const inp of c.inputs) s[inp.id] = inp.type === 'checkbox' ? Boolean(resolve(inp.value)) : String(resolve(inp.value, s) ?? '');
  return s;
}
function normalise(c, s) {
  for (const inp of c.inputs) {
    if (inp.type !== 'select') continue;
    const o = opts(inp, s);
    if (!o.some(([v]) => v === s[inp.id])) s[inp.id] = inp.defaultFn ? inp.defaultFn(s) : o[0]?.[0] ?? '';
  }
}

/** Every string worth translating in a compute() result. */
export function resultStrings(res, add) {
  if (!res) return;
  const p = res.primary;
  if (p) { add(p.label); add(p.unit); add(p.badge); if (typeof p.value === 'string' && p.type !== 'mono') add(p.value); }
  for (const it of res.items || []) { add(it.label); add(it.unit); if (typeof it.value === 'string' && it.type !== 'mono') add(it.value); }
  add(res.note);
  if (res.table) {
    add(res.table.title);
    (res.table.head || []).forEach(add);
    for (const r of res.table.rows || []) r.forEach((cell, i) => { if (typeof cell === 'string' && res.table.types?.[i] !== 'mono') add(cell); });
  }
  if (res.chart) { (res.chart.data || []).forEach((d) => { add(d.label); (d.parts || []).forEach((q) => add(q.label)); }); (res.chart.legend || []).forEach(add); }
  if (res.gauge) (res.gauge.bands || []).forEach((b) => add(Array.isArray(b) ? b[1] : b.label));
}

export function harvest(c) {
  if (!Array.isArray(c.inputs) || typeof c.compute !== "function") return { fixed: [], dynamic: [] };
  const fixed = new Set();
  const dynamic = new Set();
  const addF = (s) => { if (typeof s === 'string' && /[A-Za-z]/.test(s)) fixed.add(s); };
  const addD = (s) => { if (typeof s === 'string' && /[A-Za-z]/.test(s)) dynamic.add(s); };
  const states = [];
  const base = defaults(c);
  normalise(c, base);
  states.push(base);
  const selects = c.inputs.filter((i) => i.type === 'select');
  const checks = c.inputs.filter((i) => i.type === 'checkbox');
  // Depth 1: every option of every select; depth 2: pairs of selects (bounded).
  for (const a of selects) {
    for (const [va] of opts(a, base)) {
      const s1 = { ...base, [a.id]: va };
      normalise(c, s1);
      states.push(s1);
      for (const b of selects) {
        if (b === a) continue;
        for (const [vb] of opts(b, s1).slice(0, 12)) {
          const s2 = { ...s1, [b.id]: vb };
          normalise(c, s2);
          states.push(s2);
        }
      }
    }
  }
  for (const ch of checks) for (const s of [...states].slice(0, 60)) states.push({ ...s, [ch.id]: !s[ch.id] });
  // Number variations: zero, small, large values to trigger alternate notes/badges.
  const nums = c.inputs.filter((i) => i.type === 'number');
  for (const n of nums) {
    for (const val of ['', '0', '1', '5', '17', '25', '40', '65', '100', '1000', '1000000', '-1', 'abc']) states.push({ ...base, [n.id]: val });
  }
  const texts = c.inputs.filter((i) => i.type === 'text' || i.type === 'textarea' || i.type === 'date' || i.type === 'time');
  for (const t of texts) for (const val of ['', 'abc', '2020-01-01', '1, 2, 3', '0']) states.push({ ...base, [t.id]: val });

  for (const s of states.slice(0, 4000)) {
    for (const inp of c.inputs) {
      try { addF(resolve(inp.labelFn, s)); } catch { /* ignore */ }
      for (const [, l] of opts(inp, s)) addF(l);
    }
    try { resultStrings(c.compute({ ...s }), addD); } catch (e) { addD(e.message); }
  }
  for (const inp of c.inputs) { addF(inp.label); addF(inp.help); addF(inp.suffix); addF(inp.placeholder); }
  return { fixed: [...fixed], dynamic: [...dynamic] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2] || '';
  let bn = null;
  try { bn = await import('../src/i18n/bn.js'); } catch (e) { if (mode !== '--all') console.error('bn.js not loadable:', e.message); }
  const { makeTranslator } = await import('../src/i18n.js');
  const out = {};
  let total = 0;
  let missing = 0;
  for (const c of CALCULATORS) {
    const { fixed, dynamic } = harvest(c);
    const all = [...new Set([...fixed, ...dynamic])];
    if (mode === '--all') { out[c.id] = all; continue; }
    const tr = bn ? makeTranslator(bn.default, c.id) : null;
    // Strings without a lowercase word (hex digits, Roman numerals, grades, 1.2e-7) need no translation.
    const miss = all.filter((s) => /[a-z]{2,}/.test(s) && (!tr || !tr.has(s)));
    total += all.length;
    missing += miss.length;
    if (miss.length) out[c.id] = [...new Set(miss.map((s) => (mode === '--keys' ? templateKey(s) : s)))];
  }
  if (mode === '--all' || mode === '--missing' || mode === '--keys') console.log(JSON.stringify(out, null, 1));
  else {
    for (const [id, m] of Object.entries(out)) console.log(`${id}: ${m.length} missing`);
    console.log(`\n${total - missing}/${total} strings translated (${missing} missing)`);
  }
}
