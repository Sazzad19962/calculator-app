// Renders a declarative calculator definition into a live form + results panel.
import { format, getCurrency, CURRENCIES, groupDigits, regroupWithCaret, stripGrouping, formatCompact, toCSV } from './format.js';
import { donut, stacked, gauge } from './chart.js';
import { t, D, digitsInDOM, localizeResult, getTranslator, toAsciiDigits } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const resolve = (x, state) => (typeof x === 'function' ? x(state) : x);
const narrow = () => matchMedia('(max-width: 820px)').matches;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const locale = () => CURRENCIES[getCurrency()].locale;
const NUM_RE = /^[-−+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;

function defaults(calc) {
  const s = {};
  // A language may supply its own default text (e.g. Bangla room/day names in textareas).
  const local = getTranslator()?.calc?.defaults || {};
  for (const inp of calc.inputs) {
    s[inp.id] = inp.type === 'checkbox' ? Boolean(resolve(inp.value)) : String(local[inp.id] ?? resolve(inp.value, s) ?? '');
  }
  return s;
}

function readURL(calc, state) {
  const params = new URLSearchParams(location.search);
  for (const inp of calc.inputs) {
    if (!params.has(inp.id)) continue;
    const raw = toAsciiDigits(params.get(inp.id));
    state[inp.id] = inp.type === 'checkbox' ? raw === '1' : inp.money ? stripGrouping(raw) : raw;
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

/** Returns an error message for a numeric field, or '' when the value is acceptable. */
export function validateNumber(inp, raw, state) {
  const s = stripGrouping(toAsciiDigits(raw)).trim();
  if (s === '') return '';
  if (!NUM_RE.test(s)) return t('Enter a number, e.g. 1250 or 3.5');
  const n = parseFloat(s.replace('−', '-'));
  const min = resolve(inp.min, state);
  const max = resolve(inp.max, state);
  const show = (x) => (inp.money ? format(x, 'money') : format(x));
  if (min !== undefined && n < min) return D(t(`Must be at least ${show(min)}`));
  if (max !== undefined && n > max) return D(t(`Must be at most ${show(max)}`));
  return '';
}

const hasSlider = (inp) => inp.type === 'number' && inp.min !== undefined && inp.max !== undefined && typeof inp.min !== 'function' && typeof inp.max !== 'function';

const fieldLabel = (inp, state) => D(t(resolve(inp.labelFn, state) || inp.label));

function fieldHTML(inp, state) {
  const label = esc(fieldLabel(inp, state));
  const id = `f-${inp.id}`;
  const help = inp.help ? `<small class="help" id="h-${inp.id}">${esc(D(t(inp.help)))}</small>` : '';
  const val = state[inp.id];
  if (inp.type === 'checkbox') {
    return `<label class="field check" for="${id}"><input type="checkbox" id="${id}" name="${inp.id}" ${val ? 'checked' : ''}><span>${label}</span></label>`;
  }
  const describedBy = [inp.help && `h-${inp.id}`, `e-${inp.id}`].filter(Boolean).join(' ');
  let control;
  let extra = '';
  if (inp.type === 'select') {
    control = `<select id="${id}" name="${inp.id}" ${inp.help ? `aria-describedby="h-${inp.id}"` : ''}>${optionsFor(inp, state).map(([v, l]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(D(t(l)))}</option>`).join('')}</select>`;
  } else if (inp.type === 'textarea') {
    control = `<textarea id="${id}" name="${inp.id}" rows="5" spellcheck="false" aria-describedby="${describedBy}">${esc(val)}</textarea>`;
  } else {
    const isNum = inp.type === 'number';
    const prefix = inp.money ? `<span class="affix" aria-hidden="true">${esc(CURRENCIES[getCurrency()].symbol.trim())}</span>` : '';
    const suffix = inp.suffix ? `<span class="affix" aria-hidden="true">${esc(t(inp.suffix))}</span>` : '';
    const shown = inp.money ? groupDigits(val, locale()) : val;
    const attrs = isNum
      ? `type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" ${inp.money ? 'data-money="1"' : ''}`
      : `type="${inp.type}"`;
    const err = isNum ? validateNumber(inp, val, state) : '';
    const unit = [inp.money && getCurrency(), inp.suffix && t(inp.suffix)].filter(Boolean).join(' ');
    control = `<div class="input-group">${prefix}<input id="${id}" name="${inp.id}" ${attrs} value="${esc(shown)}"${inp.placeholder ? ` placeholder="${esc(t(inp.placeholder))}"` : ''} aria-describedby="${describedBy}"${err ? ' aria-invalid="true"' : ''}${unit ? ` data-unit="${esc(unit)}"` : ''}>${suffix}</div>`;
    if (hasSlider(inp)) {
      const n = parseFloat(stripGrouping(val));
      const step = inp.step ?? (Number.isInteger(inp.min) && Number.isInteger(inp.max) ? 1 : 'any');
      extra = `<input type="range" class="slider" data-for="${inp.id}" min="${inp.min}" max="${inp.max}" step="${step}" value="${Number.isFinite(n) ? n : inp.min}" tabindex="-1" aria-hidden="true">`;
    }
    extra += `<small class="err" id="e-${inp.id}">${esc(err)}</small>`;
    return `<div class="field${err ? ' invalid' : ''}"><label for="${id}">${label}${unit ? `<span class="sr-only"> (${esc(unit)})</span>` : ''}</label>${control}${extra}${help}</div>`;
  }
  return `<div class="field"><label for="${id}">${label}</label>${control}${help}</div>`;
}

function tableHTML(tb, open) {
  const title = tb.title || t('Details');
  return `<details class="table-wrap" ${open ? 'open' : ''}><summary>${esc(title)} <span class="count">${esc(t(`${tb.rows.length} rows`))}</span></summary>
    <div class="table-tools"><button type="button" class="btn small" data-act="csv">⤓ ${esc(t('Download CSV'))}</button></div>
    <div class="scroll" tabindex="0" role="region" aria-label="${esc(title)}"><table><thead><tr>${tb.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${tb.rows.map((r) => `<tr>${r.map((c, i) => `<td${tb.types?.[i] === 'mono' ? ' class="mono"' : ''}>${esc(format(c, tb.types?.[i] || 'text'))}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}

function resultsHTML(res, tableOpen) {
  const p = res.primary;
  let html = '';
  if (p) {
    html += `<div class="result-primary">
      <div class="rp-label">${esc(p.label)}</div>
      <div class="rp-value ${p.type === 'mono' ? 'mono' : ''}" id="rp-value">${esc(format(p.value, p.type))}${p.unit ? ` <span class="unit">${esc(p.unit)}</span>` : ''}</div>
      ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}
      <button type="button" class="icon-btn copy-btn" data-copy="#rp-value" title="${esc(t('Copy result'))}" aria-label="${esc(t('Copy result'))}: ${esc(p.label)}">⧉</button>
    </div>`;
  }
  if (res.gauge) html += '<div class="chart" data-chart="gauge"></div>';
  if (res.items?.length) {
    html += `<dl class="result-items">${res.items.map((it) => `<div><dt>${esc(it.label)}</dt><dd${it.type === 'mono' ? ' class="mono"' : ''}>${esc(format(it.value, it.type))}${it.unit ? ` <span class="unit">${esc(it.unit)}</span>` : ''}</dd></div>`).join('')}</dl>`;
  }
  if (res.chart) html += `<div class="chart" data-chart="${esc(res.chart.type)}"></div>`;
  if (res.note) html += `<p class="note">${esc(res.note)}</p>`;
  if (res.table) html += tableHTML(res.table, tableOpen ?? res.table.rows.length <= 12);
  return html;
}

const calcName = (calc) => getTranslator()?.calc?.name || calc.name;

function resultsText(calc, res) {
  const lines = [calcName(calc)];
  if (res.primary) lines.push(`${res.primary.label}: ${format(res.primary.value, res.primary.type)}${res.primary.unit ? ` ${res.primary.unit}` : ''}`);
  (res.items || []).forEach((it) => lines.push(`${it.label}: ${format(it.value, it.type)}${it.unit ? ` ${it.unit}` : ''}`));
  return `${D(lines.join('\n'))}\n${location.href}`;
}

/* ---------- Toasts ---------- */
let toastEl;
let toastTimer;
export function toast(msg, kind = 'ok') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.dataset.kind = kind;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* unsupported */ }
  ta.remove();
  return ok;
}

export async function copyText(text, btn, msg = t('Copied to clipboard')) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch { ok = legacyCopy(text); }
  if (!ok) { toast(t('Copy failed — select the text and copy manually'), 'err'); return false; }
  toast(msg);
  if (btn) {
    btn.classList.add('ok');
    setTimeout(() => btn.classList.remove('ok'), 1200);
  }
  return true;
}

function download(name, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountCalculator(calc, root, { onResult } = {}) {
  const base = defaults(calc);
  const state = { ...base };
  readURL(calc, state);
  normalise(calc, state);

  root.innerHTML = `<div class="calc-grid">
    <form class="card calc-form" novalidate autocomplete="off" aria-label="${esc(getTranslator() ? `${calcName(calc)} — ${t('inputs')}` : `${calc.name} inputs`)}"><div class="fields"></div>
      <div class="form-actions">
        <button type="submit" class="btn primary">${esc(t(calc.volatile ? 'Recalculate' : 'Calculate'))}</button>
        <button type="button" class="btn" data-act="reset">${esc(t('Reset'))}</button>
      </div></form>
    <section class="card results" role="region" aria-label="${esc(t('Results'))}" tabindex="-1">
      <div class="results-body"></div>
      <div class="result-actions">
        <button type="button" class="btn small" data-act="share"><span aria-hidden="true">🔗</span> ${esc(t('Share'))}</button>
        <button type="button" class="btn small" data-act="copy"><span aria-hidden="true">⧉</span> ${esc(t('Copy results'))}</button>
        <button type="button" class="btn small" data-act="print"><span aria-hidden="true">🖨</span> ${esc(t('Print'))}</button>
      </div>
      <p class="sr-only" aria-live="polite" aria-atomic="true"></p>
    </section></div>
    <button type="button" class="mbar" data-act="jump" hidden aria-label="${esc(t('Show results'))}"><span class="mbar-label"></span><b class="mbar-value"></b><span class="mbar-go" aria-hidden="true">↓</span></button>`;
  root.classList.add('ready');

  const form = root.querySelector('form');
  const fields = root.querySelector('.fields');
  const results = root.querySelector('.results');
  const body = root.querySelector('.results-body');
  const live = root.querySelector('[aria-live]');
  const mbar = root.querySelector('.mbar');
  let last = null;
  let tableOpen = null; // remember whether the user opened/closed the table across recalculations

  function buildFields() {
    const active = document.activeElement;
    const focused = fields.contains(active) ? active.name : null;
    const caret = focused && active.selectionStart != null ? active.selectionStart : null;
    fields.innerHTML = calc.inputs.filter((i) => !i.showIf || i.showIf(state)).map((i) => fieldHTML(i, state)).join('');
    if (focused) {
      const el = fields.querySelector(`[name="${focused}"]`);
      el?.focus();
      if (caret != null && el?.setSelectionRange && el.type === 'text') try { el.setSelectionRange(caret, caret); } catch { /* ignore */ }
    }
  }

  let liveTimer;
  function announce(res) {
    clearTimeout(liveTimer);
    if (!res?.primary) return;
    const p = res.primary;
    const text = D(`${p.label}: ${format(p.value, p.type)}${p.unit ? ` ${p.unit}` : ''}`);
    liveTimer = setTimeout(() => { live.textContent = text; }, 900);
  }

  function invalidFields() {
    return calc.inputs.filter((inp) => inp.type === 'number' && (!inp.showIf || inp.showIf(state)) && validateNumber(inp, state[inp.id], state));
  }

  function drawCharts(res) {
    const fmtMoney = (v) => D(format(v, 'money'));
    body.querySelectorAll('[data-chart]').forEach((el) => {
      const kind = el.dataset.chart;
      if (kind === 'donut') donut(el, res.chart.data, fmtMoney);
      else if (kind === 'stacked') stacked(el, res.chart.data, res.chart.legend, (v) => D(formatCompact(v)), fmtMoney);
      else if (kind === 'gauge') gauge(el, res.gauge);
    });
    if (!getTranslator()?.calc?.asciiDigits) digitsInDOM(body);
  }

  function compute() {
    const bad = invalidFields();
    if (bad.length && last) {
      // Keep the last good result visible but mark it as out of date.
      results.classList.add('stale');
      body.querySelector('.stale-msg')?.remove();
      body.insertAdjacentHTML('afterbegin', `<p class="stale-msg">${esc(t(`Fix “${resolve(bad[0].labelFn, state) || bad[0].label}” to update the results.`))}</p>`);
      return;
    }
    results.classList.remove('stale');
    try {
      const tr = getTranslator();
      const res = tr ? localizeResult(calc.compute({ ...state }), tr, D) : calc.compute({ ...state });
      last = res;
      body.innerHTML = resultsHTML(res, tableOpen);
      drawCharts(res);
      announce(res);
      updateBar(res);
      onResult?.(res);
    } catch (err) {
      last = null;
      body.innerHTML = `<div class="error" role="alert"><span aria-hidden="true">⚠️</span> ${esc(D(t(err.message || 'Please check your inputs.')))}</div>`;
      updateBar(null);
    }
  }

  /* ----- URL state ----- */
  let urlTimer;
  function writeURL() {
    const params = new URLSearchParams();
    for (const inp of calc.inputs) {
      const v = state[inp.id];
      if (inp.type === 'checkbox' ? v !== base[inp.id] : String(v) !== String(base[inp.id])) {
        params.set(inp.id, inp.type === 'checkbox' ? (v ? '1' : '0') : v);
      }
    }
    const qs = params.toString();
    history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
  }
  function syncURL() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(writeURL, 250);
  }

  /* ----- Field validation UI ----- */
  function showValidity(el, inp) {
    const field = el.closest('.field');
    const msg = validateNumber(inp, state[inp.id], state);
    field?.classList.toggle('invalid', Boolean(msg));
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    const err = field?.querySelector('.err');
    if (err && err.textContent !== msg) err.textContent = msg;
  }

  function onChange(e) {
    const el = e.target;
    if (el.classList.contains('slider')) {
      const target = fields.querySelector(`[name="${el.dataset.for}"]`);
      if (!target) return;
      state[el.dataset.for] = el.value;
      target.value = target.dataset.money ? groupDigits(el.value, locale()) : el.value;
      showValidity(target, calc.inputs.find((i) => i.id === el.dataset.for));
      compute();
      syncURL();
      return;
    }
    if (!el.name || !(el.name in state)) return;
    const inp = calc.inputs.find((i) => i.id === el.name);
    // Accept Bangla (০-৯) digits everywhere: convert them in place (1:1 characters, so the caret stays put).
    if ((el.tagName === 'TEXTAREA' || el.type === 'text') && /[০-৯٠-٩]/.test(el.value)) {
      const pos = el.selectionStart;
      el.value = toAsciiDigits(el.value);
      if (pos != null) try { el.setSelectionRange(pos, pos); } catch { /* ignore */ }
    }
    if (el.type === 'checkbox') state[el.name] = el.checked;
    else if (el.dataset.money) {
      // Live thousands separators without moving the caret.
      const { value, caret } = regroupWithCaret(el.value, el.selectionStart ?? el.value.length, locale());
      if (value !== el.value) {
        el.value = value;
        try { el.setSelectionRange(caret, caret); } catch { /* ignore */ }
      }
      state[el.name] = stripGrouping(value);
    } else state[el.name] = el.value;
    if (inp?.type === 'number') {
      showValidity(el, inp);
      const slider = fields.querySelector(`.slider[data-for="${el.name}"]`);
      const n = parseFloat(stripGrouping(el.value));
      if (slider && Number.isFinite(n)) slider.value = n;
    }
    if (inp?.rerender) {
      normalise(calc, state, el.name);
      buildFields();
    }
    if (!calc.volatile || e.type === 'change') compute();
    syncURL();
  }

  form.addEventListener('input', (e) => { if (e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') onChange(e); });
  form.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') onChange(e); else if (calc.volatile) compute(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    compute();
    document.activeElement?.blur?.();
    if (narrow()) showResults();
  });
  // Selecting a field's whole value on focus makes replacing numbers on touch screens one tap.
  form.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el.inputMode === 'decimal' && matchMedia('(pointer: coarse)').matches) setTimeout(() => { try { el.select(); } catch { /* ignore */ } }, 0);
  });

  function showResults() {
    results.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    results.focus({ preventScroll: true });
  }

  /* ----- Sticky compact result bar on mobile ----- */
  let resultsVisible = true;
  let formVisible = true;
  let headerVisible = true;
  function updateBar(res = last) {
    const p = res?.primary;
    if (p) {
      mbar.querySelector('.mbar-label').textContent = p.label;
      mbar.querySelector('.mbar-value').textContent = D(`${format(p.value, p.type)}${p.unit ? ` ${p.unit}` : ''}`);
    }
    // Only once the site header has scrolled away, so the bar never covers the logo/header controls.
    mbar.hidden = !(p && narrow() && !resultsVisible && formVisible && !headerVisible && p.type !== 'mono');
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.target === results) resultsVisible = en.isIntersecting;
        else formVisible = en.isIntersecting;
      });
      updateBar();
    }, { rootMargin: '0px 0px -80px 0px' }).observe(results);
    // Separate observer for the form so both states are tracked independently.
    new IntersectionObserver(([en]) => { formVisible = en.isIntersecting; updateBar(); }).observe(form);
    const header = document.querySelector('.site-header');
    if (header) new IntersectionObserver(([en]) => { headerVisible = en.isIntersecting; updateBar(); }).observe(header);
    else headerVisible = false;
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const act = btn.dataset.act;
    if (btn.dataset.copy) copyText(root.querySelector(btn.dataset.copy)?.textContent.trim() || '', btn, t('Result copied'));
    else if (act === 'reset') {
      Object.assign(state, defaults(calc));
      normalise(calc, state);
      tableOpen = null;
      buildFields();
      compute();
      syncURL();
      toast(t('Reset to default values'));
    } else if (act === 'share') {
      clearTimeout(urlTimer);
      writeURL();
      const data = { title: calcName(calc), text: last?.primary ? D(`${last.primary.label}: ${format(last.primary.value, last.primary.type)}`) : calcName(calc), url: location.href };
      if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share(data).catch(() => {});
      else copyText(location.href, btn, t('Link copied — it opens with these exact numbers'));
    } else if (act === 'copy' && last) {
      clearTimeout(urlTimer);
      writeURL();
      copyText(resultsText(calc, last), btn, t('Results copied'));
    } else if (act === 'print') window.print();
    else if (act === 'csv' && last?.table) {
      const tb = last.table;
      const slug = (calc.table?.slug || (tb.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
      download(`${calc.id}${slug ? `-${slug}` : ''}.csv`, toCSV(tb.head, tb.rows, tb.types));
      toast(t('CSV downloaded'));
    } else if (act === 'jump') showResults();
  });
  body.addEventListener('toggle', (e) => { if (e.target.matches('details.table-wrap')) tableOpen = e.target.open; }, true);

  // Print: expand tables and stamp the URL so the printout is reproducible.
  window.addEventListener('beforeprint', () => {
    results.dataset.url = location.href;
    root.querySelectorAll('details').forEach((d) => { d.dataset.wasOpen = d.open ? '1' : ''; d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    root.querySelectorAll('details').forEach((d) => { d.open = d.dataset.wasOpen === '1'; });
  });

  // Re-render money prefixes, values and chart colours when currency or theme changes.
  const rerender = () => { buildFields(); compute(); };
  document.addEventListener('currencychange', rerender);
  document.addEventListener('digitschange', rerender);
  document.addEventListener('themechange', () => { if (last) drawCharts(last); });
  matchMedia('(max-width: 820px)').addEventListener?.('change', () => updateBar());

  buildFields();
  compute();
}
