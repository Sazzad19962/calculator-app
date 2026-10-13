// Renders a declarative calculator definition into a live form + results panel.
import { format, getCurrency, CURRENCIES } from './format.js';
import { donut, stacked, gauge } from './chart.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const resolve = (x, state) => (typeof x === 'function' ? x(state) : x);

function defaults(calc) {
  const s = {};
  for (const inp of calc.inputs) s[inp.id] = inp.type === 'checkbox' ? Boolean(resolve(inp.value)) : String(resolve(inp.value, s) ?? '');
  return s;
}

function readURL(calc, state) {
  const params = new URLSearchParams(location.search);
  for (const inp of calc.inputs) {
    if (!params.has(inp.id)) continue;
    const raw = params.get(inp.id);
    state[inp.id] = inp.type === 'checkbox' ? raw === '1' : raw;
  }
}

function optionsFor(inp, state) {
  return (resolve(inp.options, state) || []).map((o) => (Array.isArray(o) ? o : [o, o]));
}

/** Ensures select values are valid for their (possibly dynamic) option lists. */
function normalise(calc, state, changedId) {
  for (const inp of calc.inputs) {
    if (inp.type !== 'select') continue;
    const opts = optionsFor(inp, state);
    const valid = opts.some(([v]) => v === state[inp.id]);
    if (!valid || (changedId && inp.defaultFn && changedId !== inp.id && calc.inputs.find((i) => i.id === changedId)?.rerender)) {
      state[inp.id] = inp.defaultFn ? inp.defaultFn(state) : opts[0]?.[0] ?? '';
    }
  }
}

function fieldHTML(inp, state) {
  const label = esc(resolve(inp.labelFn, state) || inp.label);
  const id = `f-${inp.id}`;
  const help = inp.help ? `<small class="help">${esc(inp.help)}</small>` : '';
  const val = state[inp.id];
  if (inp.type === 'checkbox') {
    return `<label class="field check" for="${id}"><input type="checkbox" id="${id}" name="${inp.id}" ${val ? 'checked' : ''}><span>${label}</span></label>`;
  }
  let control;
  if (inp.type === 'select') {
    control = `<select id="${id}" name="${inp.id}">${optionsFor(inp, state).map(([v, l]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  } else if (inp.type === 'textarea') {
    control = `<textarea id="${id}" name="${inp.id}" rows="5" spellcheck="false">${esc(val)}</textarea>`;
  } else {
    const isNum = inp.type === 'number';
    const prefix = inp.money ? `<span class="affix">${esc(CURRENCIES[getCurrency()].symbol.trim())}</span>` : '';
    const suffix = inp.suffix ? `<span class="affix">${esc(inp.suffix)}</span>` : '';
    const attrs = isNum
      ? `type="text" inputmode="decimal" autocomplete="off" ${inp.min !== undefined ? `data-min="${inp.min}"` : ''}`
      : `type="${inp.type}"`;
    control = `<div class="input-group">${prefix}<input id="${id}" name="${inp.id}" ${attrs} value="${esc(val)}">${suffix}</div>`;
  }
  return `<div class="field"><label for="${id}">${label}</label>${control}${help}</div>`;
}

function resultsHTML(res) {
  const p = res.primary;
  let html = '';
  if (p) {
    html += `<div class="result-primary">
      <div class="rp-label">${esc(p.label)}</div>
      <div class="rp-value ${p.type === 'mono' ? 'mono' : ''}" id="rp-value">${esc(format(p.value, p.type))}${p.unit ? ` <span class="unit">${esc(p.unit)}</span>` : ''}</div>
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      <button type="button" class="icon-btn copy-btn" data-copy="#rp-value" title="Copy result" aria-label="Copy result">⧉</button>
    </div>`;
  }
  if (res.gauge) html += '<div class="chart" data-chart="gauge"></div>';
  if (res.items?.length) {
    html += `<dl class="result-items">${res.items.map((it) => `<div><dt>${esc(it.label)}</dt><dd>${esc(format(it.value, it.type))}${it.unit ? ` <span class="unit">${esc(it.unit)}</span>` : ''}</dd></div>`).join('')}</dl>`;
  }
  if (res.chart) html += `<div class="chart" data-chart="${res.chart.type}"></div>`;
  if (res.note) html += `<p class="note">${esc(res.note)}</p>`;
  if (res.table) {
    const t = res.table;
    html += `<details class="table-wrap" ${t.rows.length <= 12 ? 'open' : ''}><summary>${esc(t.title || 'Details')}</summary>
      <div class="scroll"><table><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map((r) => `<tr>${r.map((c, i) => `<td>${esc(format(c, t.types?.[i] || 'text'))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }
  return html;
}

function resultsText(calc, res) {
  const lines = [calc.name];
  if (res.primary) lines.push(`${res.primary.label}: ${format(res.primary.value, res.primary.type)}${res.primary.unit ? ` ${res.primary.unit}` : ''}`);
  (res.items || []).forEach((it) => lines.push(`${it.label}: ${format(it.value, it.type)}${it.unit ? ` ${it.unit}` : ''}`));
  lines.push(location.href);
  return lines.join('\n');
}

export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      const old = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('ok');
      setTimeout(() => { btn.textContent = old; btn.classList.remove('ok'); }, 1200);
    }
  } catch { /* clipboard blocked */ }
}

export function mountCalculator(calc, root, { onResult } = {}) {
  const base = defaults(calc);
  const state = { ...base };
  readURL(calc, state);
  normalise(calc, state);

  root.innerHTML = `<div class="calc-grid">
    <form class="card calc-form" novalidate autocomplete="off"><div class="fields"></div>
      <div class="form-actions">
        ${calc.volatile ? '<button type="submit" class="btn primary">Recalculate</button>' : '<button type="submit" class="btn primary">Calculate</button>'}
        <button type="button" class="btn" data-act="reset">Reset</button>
      </div></form>
    <section class="card results" aria-live="polite" aria-label="Results">
      <div class="results-body"></div>
      <div class="result-actions">
        <button type="button" class="btn small" data-act="share">🔗 Share</button>
        <button type="button" class="btn small" data-act="copy">⧉ Copy results</button>
        <button type="button" class="btn small" data-act="print">🖨 Print</button>
      </div>
    </section></div>`;

  const form = root.querySelector('form');
  const fields = root.querySelector('.fields');
  const body = root.querySelector('.results-body');
  let last = null;

  function buildFields() {
    const focused = document.activeElement?.name;
    fields.innerHTML = calc.inputs.filter((i) => !i.showIf || i.showIf(state)).map((i) => fieldHTML(i, state)).join('');
    if (focused) fields.querySelector(`[name="${focused}"]`)?.focus();
  }

  function compute() {
    try {
      const res = calc.compute({ ...state });
      last = res;
      body.innerHTML = resultsHTML(res);
      const fmtMoney = (v) => format(v, 'money');
      const fmtShort = (v) => {
        const sym = CURRENCIES[getCurrency()].symbol.trim();
        const a = Math.abs(v);
        return sym + (a >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v.toFixed(0));
      };
      body.querySelectorAll('[data-chart]').forEach((el) => {
        const t = el.dataset.chart;
        if (t === 'donut') donut(el, res.chart.data, fmtMoney);
        else if (t === 'stacked') stacked(el, res.chart.data, res.chart.legend, fmtShort);
        else if (t === 'gauge') gauge(el, res.gauge);
      });
      onResult?.(res);
    } catch (err) {
      last = null;
      body.innerHTML = `<div class="error" role="alert">⚠️ ${esc(err.message || 'Please check your inputs.')}</div>`;
    }
  }

  let urlTimer;
  function syncURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const params = new URLSearchParams();
      for (const inp of calc.inputs) {
        const v = state[inp.id];
        if (inp.type === 'checkbox' ? v !== base[inp.id] : String(v) !== String(base[inp.id])) {
          params.set(inp.id, inp.type === 'checkbox' ? (v ? '1' : '0') : v);
        }
      }
      const qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : ''));
    }, 250);
  }

  function onChange(e) {
    const el = e.target;
    if (!el.name || !(el.name in state)) return;
    state[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    const inp = calc.inputs.find((i) => i.id === el.name);
    if (inp?.rerender) {
      normalise(calc, state, el.name);
      buildFields();
    }
    if (!calc.volatile || e.type === 'change') compute();
    syncURL();
  }

  form.addEventListener('input', (e) => { if (e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') onChange(e); });
  form.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onChange(e); else if (calc.volatile) compute(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); compute(); });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (btn.dataset.copy) copyText(root.querySelector(btn.dataset.copy)?.textContent.trim() || '', btn);
    else if (act === 'reset') {
      Object.assign(state, defaults(calc));
      buildFields();
      compute();
      syncURL();
    } else if (act === 'share') {
      const data = { title: calc.name, url: location.href };
      if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share(data).catch(() => {});
      else copyText(location.href, btn);
    } else if (act === 'copy' && last) copyText(resultsText(calc, last), btn);
    else if (act === 'print') window.print();
  });

  // Re-render money prefixes and values when currency changes.
  document.addEventListener('currencychange', () => { buildFields(); compute(); });
  let rw;
  window.addEventListener('resize', () => { clearTimeout(rw); rw = setTimeout(compute, 200); });

  buildFields();
  compute();
}
