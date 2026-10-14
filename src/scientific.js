// Interactive scientific calculator widget: 2nd-function layer, memory, persistent history,
// copy, full keyboard support, and a side-by-side history panel on wide screens.
import { evaluate } from './expr.js';
import { sig } from './util.js';
import { copyText, toast } from './engine.js';
import { t } from './i18n.js';

// [primary, second] — second-layer keys are shown when "2nd" is active.
const KEYS = [
  ['2nd'], ['deg'], ['('], [')'], ['AC'],
  ['sin', 'sin⁻¹'], ['cos', 'cos⁻¹'], ['tan', 'tan⁻¹'], ['π', 'e'], ['⌫'],
  ['x²', 'x³'], ['xʸ', 'ʸ√x'], ['√', '∛'], ['ln', 'eˣ'], ['log', '10ˣ'],
  ['n!', '1/x'], ['7'], ['8'], ['9'], ['÷'],
  ['%', '|x|'], ['4'], ['5'], ['6'], ['×'],
  ['MR', 'MC'], ['1'], ['2'], ['3'], ['−'],
  ['M+', 'M−'], ['0'], ['.'], ['Ans', 'Rnd'], ['+'],
  ['EXP'], ['='],
];

const INSERT = {
  sin: 'sin(', cos: 'cos(', tan: 'tan(', 'sin⁻¹': 'asin(', 'cos⁻¹': 'acos(', 'tan⁻¹': 'atan(',
  ln: 'ln(', log: 'log(', 'eˣ': 'e^(', '10ˣ': '10^(', '√': '√(', '∛': 'cbrt(', '|x|': 'abs(',
  'x²': '^2', 'x³': '^3', 'xʸ': '^', 'ʸ√x': '^(1÷', 'n!': '!', '1/x': '^(−1)', EXP: '×10^(', Ans: 'Ans', π: 'π', e: 'e',
};

const LABEL = {
  'x²': 'x<sup>2</sup>', 'x³': 'x<sup>3</sup>', 'xʸ': 'x<sup>y</sup>', 'ʸ√x': '<sup>y</sup>√x', 'eˣ': 'e<sup>x</sup>', '10ˣ': '10<sup>x</sup>',
  'sin⁻¹': 'sin<sup>−1</sup>', 'cos⁻¹': 'cos<sup>−1</sup>', 'tan⁻¹': 'tan<sup>−1</sup>',
};
const SPOKEN = {
  '2nd': 'Second functions', deg: 'Angle mode', '⌫': 'Backspace', AC: 'All clear', '√': 'Square root', '∛': 'Cube root',
  'x²': 'Square', 'x³': 'Cube', 'xʸ': 'Power', 'ʸ√x': 'Y-th root', 'n!': 'Factorial', '1/x': 'Reciprocal', '|x|': 'Absolute value',
  'eˣ': 'e to the power', '10ˣ': '10 to the power', '−': 'Minus', '×': 'Times', '÷': 'Divide', EXP: 'Times ten to the power',
  MR: 'Memory recall', MC: 'Memory clear', 'M+': 'Memory add', 'M−': 'Memory subtract', Rnd: 'Random number', '%': 'Percent',
  'sin⁻¹': 'Arc sine', 'cos⁻¹': 'Arc cosine', 'tan⁻¹': 'Arc tangent',
};

const HKEY = 'calc.sciHistory';
const fmt = (n) => (Number.isFinite(n) ? sig(n, 12) : Number.isNaN(n) ? 'Error' : n > 0 ? '∞' : '−∞');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const touch = () => matchMedia('(pointer: coarse)').matches;

function loadHistory() {
  try {
    const h = JSON.parse(localStorage.getItem(HKEY));
    return Array.isArray(h) ? h.filter((x) => Array.isArray(x) && x.length === 2).slice(0, 50) : [];
  } catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 50))); } catch { /* storage full or blocked */ }
}

function keyClass(k) {
  if (/^[0-9.]$/.test(k)) return 'num';
  if (k === '=') return 'eq';
  if (k === 'AC' || k === '⌫') return 'danger';
  if (['+', '−', '×', '÷'].includes(k)) return 'op';
  if (k === '2nd') return 'second';
  return 'fn';
}

export function mountScientific(root) {
  let deg = true;
  let ans = 0;
  let memory = 0;
  let second = false;
  let justEvaluated = false;
  let history = loadHistory();

  root.innerHTML = `<div class="sci-wrap">
    <div class="sci card">
      <div class="sci-screen">
        <div class="sci-flags"><span data-flag="mode">DEG</span><span data-flag="2nd" hidden>2ND</span><span data-flag="mem" hidden>M</span>
          <button type="button" class="sci-copy" data-act="copy" aria-label="${t('Copy result')}" title="${t('Copy result')}">⧉ ${t('Copy')}</button></div>
        <input class="sci-input" aria-label="${t('Expression')}" spellcheck="false" autocomplete="off" autocapitalize="off" inputmode="none" value="">
        <div class="sci-preview">0</div>
        <p class="sr-only" aria-live="polite" aria-atomic="true"></p>
      </div>
      <div class="sci-keys">${KEYS.map(([k, s]) => `<button type="button" data-k="${esc(k)}" ${s ? `data-k2="${esc(s)}"` : ''} class="${keyClass(k)}${k === '=' ? ' wide' : ''}" ${k === '2nd' ? 'aria-pressed="false"' : ''} aria-label="${esc(t(SPOKEN[k] || k))}">${s ? `<small aria-hidden="true">${LABEL[s] || esc(s)}</small>` : ''}<span>${k === 'deg' ? 'DEG' : LABEL[k] || esc(k)}</span></button>`).join('')}</div>
      <p class="sci-tip">${t('Tip: type directly — <kbd>Enter</kbd> = equals, <kbd>Esc</kbd> clears, <kbd>Backspace</kbd> deletes.')}</p>
    </div>
    <section class="sci-side card" aria-labelledby="sci-h">
      <div class="sci-side-head"><h2 id="sci-h">${t('History')}</h2><button type="button" class="btn small" data-act="clear-history">${t('Clear')}</button></div>
      <ol class="sci-history"></ol>
      <p class="sci-empty">${t('Your calculations appear here and are saved on this device.')}</p>
    </section>
  </div>`;

  const input = root.querySelector('.sci-input');
  const preview = root.querySelector('.sci-preview');
  const live = root.querySelector('[aria-live]');
  const modeFlag = root.querySelector('[data-flag="mode"]');
  const secondFlag = root.querySelector('[data-flag="2nd"]');
  const memFlag = root.querySelector('[data-flag="mem"]');
  const histList = root.querySelector('.sci-history');
  const empty = root.querySelector('.sci-empty');
  const keys = root.querySelector('.sci-keys');
  // Desktop users can type directly; on touch devices we avoid the on-screen keyboard.
  if (!touch()) input.removeAttribute('inputmode');

  const tryEval = (s) => {
    try { return evaluate(s, { deg, ans }); } catch { return null; }
  };

  function renderHistory() {
    histList.innerHTML = history.map(([e, r], i) => `<li><button type="button" class="h-expr" data-hi="${i}" title="${t('Edit this expression')}">${esc(e)}</button><button type="button" class="h-res" data-hr="${i}" title="${t('Insert this result')}">= ${esc(r)}</button></li>`).join('');
    empty.hidden = history.length > 0;
    root.querySelector('[data-act="clear-history"]').hidden = !history.length;
  }

  function setSecond(on) {
    second = on;
    secondFlag.hidden = !on;
    keys.classList.toggle('alt', on);
    keys.querySelector('[data-k="2nd"]').setAttribute('aria-pressed', String(on));
    keys.querySelectorAll('[data-k2]').forEach((b) => {
      const k = on ? b.dataset.k2 : b.dataset.k;
      const other = on ? b.dataset.k : b.dataset.k2;
      b.innerHTML = `<small aria-hidden="true">${LABEL[other] || esc(other)}</small><span>${LABEL[k] || esc(k)}</span>`;
      b.setAttribute('aria-label', t(SPOKEN[k] || k));
    });
  }

  function updatePreview() {
    const s = input.value.trim();
    if (!s) { preview.textContent = '0'; return; }
    const v = tryEval(s);
    preview.textContent = v === null ? '…' : `= ${fmt(v)}`;
  }

  function insert(text) {
    if (justEvaluated) {
      // Continue from the answer when an operator is pressed; start fresh otherwise.
      if (/^[+\-−×÷^!%]/.test(text)) input.value = 'Ans';
      else input.value = '';
      input.setSelectionRange(input.value.length, input.value.length);
      justEvaluated = false;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    const pos = start + text.length;
    input.setSelectionRange(pos, pos);
    updatePreview();
  }

  function equals() {
    const s = input.value.trim();
    if (!s) return;
    let v;
    try { v = evaluate(s, { deg, ans }); } catch (e) {
      preview.textContent = t(e.message);
      live.textContent = `${t('Error')}: ${t(e.message)}`;
      return;
    }
    const r = fmt(v);
    if (!justEvaluated) {
      history.unshift([s, r]);
      history = history.slice(0, 50);
      saveHistory(history);
      renderHistory();
    }
    if (Number.isFinite(v)) ans = v;
    input.value = r;
    preview.textContent = `= ${r}`;
    live.textContent = `${t('equals')} ${r}`;
    justEvaluated = true;
  }

  function press(k) {
    switch (k) {
      case '2nd': return setSecond(!second);
      case '=': return equals();
      case 'AC': input.value = ''; justEvaluated = false; return updatePreview();
      case '⌫': {
        if (justEvaluated) { input.value = ''; justEvaluated = false; return updatePreview(); }
        const st = input.selectionStart ?? input.value.length;
        const en = input.selectionEnd ?? st;
        const from = st === en ? Math.max(st - 1, 0) : st;
        input.value = input.value.slice(0, from) + input.value.slice(en);
        input.setSelectionRange(from, from);
        return updatePreview();
      }
      case 'deg': {
        deg = !deg;
        modeFlag.textContent = deg ? 'DEG' : 'RAD';
        const b = keys.querySelector('[data-k="deg"] span');
        if (b) b.textContent = deg ? 'DEG' : 'RAD';
        toast(t(deg ? 'Angles in degrees' : 'Angles in radians'));
        return updatePreview();
      }
      case 'MC': memory = 0; memFlag.hidden = true; return undefined;
      case 'MR': return insert(fmt(memory));
      case 'Rnd': return insert(String(Math.round(Math.random() * 1e6) / 1e6));
      case 'M+':
      case 'M−': {
        const v = tryEval(input.value || '0');
        if (v !== null && Number.isFinite(v)) {
          memory += k === 'M+' ? v : -v;
          memFlag.hidden = memory === 0;
          memFlag.title = `Memory: ${fmt(memory)}`;
        }
        return undefined;
      }
      default: return insert(INSERT[k] ?? k);
    }
  }

  function currentResult() {
    if (justEvaluated) return input.value;
    if (!input.value.trim()) return '';
    const v = tryEval(input.value.trim());
    return v === null ? input.value.trim() : fmt(v);
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.hi) { input.value = history[b.dataset.hi][0]; justEvaluated = false; updatePreview(); if (!touch()) input.focus(); return; }
    if (b.dataset.hr) { insert(history[b.dataset.hr][1].replace(/^−/, '-')); return; }
    if (b.dataset.act === 'copy') { const r = currentResult(); if (r) copyText(r, b, `${t('Copied')} ${r}`); else toast(t('Nothing to copy yet'), 'err'); return; }
    if (b.dataset.act === 'clear-history') { history = []; saveHistory(history); renderHistory(); toast(t('History cleared')); return; }
    if (b.dataset.k) {
      const k = second && b.dataset.k2 ? b.dataset.k2 : b.dataset.k;
      press(k);
      if (second && k !== '2nd') setSecond(false); // 2nd applies to one key press, like a real calculator
      if (!touch()) input.focus();
    }
  });

  input.addEventListener('input', () => { justEvaluated = false; updatePreview(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); equals(); }
    else if (e.key === 'Escape') { e.preventDefault(); press('AC'); }
    else if (justEvaluated && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const map = { '*': '×', '/': '÷', '-': '−' };
      insert(map[e.key] || e.key);
    }
  });
  // Typing anywhere on the page goes to the calculator.
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t === input || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(BUTTON|A|SUMMARY)$/.test(t.tagName) && (e.key === 'Enter' || e.key === ' ')) return; // let buttons/links activate
    if (/^[0-9a-z.+\-*/^()!%]$/i.test(e.key)) {
      e.preventDefault();
      input.focus();
      insert({ '*': '×', '/': '÷' }[e.key] || e.key);
    } else if (e.key === 'Enter') { e.preventDefault(); equals(); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
  });
  renderHistory();
  if (!touch()) input.focus({ preventScroll: true });
}
