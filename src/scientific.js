// Interactive scientific calculator widget.
import { evaluate } from './expr.js';
import { sig } from './util.js';

const KEYS = [
  ['deg', 'MC', 'MR', 'M+', 'M−'],
  ['sin', 'cos', 'tan', '(', ')'],
  ['sin⁻¹', 'cos⁻¹', 'tan⁻¹', 'x²', 'xʸ'],
  ['ln', 'log', 'eˣ', '10ˣ', '√'],
  ['π', 'e', 'n!', '%', '∛'],
  ['7', '8', '9', '⌫', 'AC'],
  ['4', '5', '6', '×', '÷'],
  ['1', '2', '3', '+', '−'],
  ['0', '.', 'EXP', 'Ans', '='],
];

const INSERT = {
  sin: 'sin(', cos: 'cos(', tan: 'tan(', 'sin⁻¹': 'asin(', 'cos⁻¹': 'acos(', 'tan⁻¹': 'atan(',
  ln: 'ln(', log: 'log(', 'eˣ': 'e^(', '10ˣ': '10^(', '√': '√(', '∛': 'cbrt(',
  'x²': '^2', 'xʸ': '^', 'n!': '!', EXP: '×10^(', Ans: 'Ans', π: 'π',
};

const fmt = (n) => (Number.isFinite(n) ? sig(n, 12) : Number.isNaN(n) ? 'Error' : n > 0 ? '∞' : '−∞');

export function mountScientific(root) {
  let deg = true;
  let ans = 0;
  let memory = 0;
  let justEvaluated = false;
  const history = [];

  root.innerHTML = `<div class="sci card">
    <div class="sci-screen">
      <div class="sci-flags"><span data-flag="mode">DEG</span><span data-flag="mem" hidden>M</span></div>
      <input class="sci-input" aria-label="Expression" spellcheck="false" autocomplete="off" inputmode="none" value="">
      <div class="sci-preview" aria-live="polite">0</div>
    </div>
    <div class="sci-keys">${KEYS.flat().map((k) => `<button type="button" data-k="${k}" class="${/^[0-9.]$/.test(k) ? 'num' : k === '=' ? 'eq' : ['AC', '⌫'].includes(k) ? 'danger' : ['+', '−', '×', '÷'].includes(k) ? 'op' : 'fn'}">${k === 'deg' ? 'Deg/Rad' : k}</button>`).join('')}</div>
    <details class="sci-history"><summary>History</summary><ol></ol></details>
  </div>`;

  const input = root.querySelector('.sci-input');
  const preview = root.querySelector('.sci-preview');
  const modeFlag = root.querySelector('[data-flag="mode"]');
  const memFlag = root.querySelector('[data-flag="mem"]');
  const histList = root.querySelector('.sci-history ol');
  // Desktop users can type directly; on touch devices we avoid the on-screen keyboard.
  if (!matchMedia('(pointer: coarse)').matches) input.removeAttribute('inputmode');

  const tryEval = (s) => {
    try { return evaluate(s, { deg, ans }); } catch { return null; }
  };

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
      preview.textContent = e.message;
      return;
    }
    history.unshift([s, fmt(v)]);
    history.length = Math.min(history.length, 20);
    histList.innerHTML = history.map(([e, r]) => `<li><button type="button" data-expr="${r}">${e.replace(/</g, '&lt;')} = <b>${r}</b></button></li>`).join('');
    if (Number.isFinite(v)) ans = v;
    input.value = fmt(v);
    preview.textContent = `= ${fmt(v)}`;
    justEvaluated = true;
  }

  function press(k) {
    switch (k) {
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
      case 'deg':
        deg = !deg;
        modeFlag.textContent = deg ? 'DEG' : 'RAD';
        return updatePreview();
      case 'MC': memory = 0; memFlag.hidden = true; return undefined;
      case 'MR': return insert(fmt(memory));
      case 'M+':
      case 'M−': {
        const v = tryEval(input.value || '0');
        if (v !== null && Number.isFinite(v)) {
          memory += k === 'M+' ? v : -v;
          memFlag.hidden = memory === 0;
        }
        return undefined;
      }
      default: return insert(INSERT[k] ?? k);
    }
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.expr) { input.value = b.dataset.expr; justEvaluated = true; updatePreview(); return; }
    if (b.dataset.k) {
      press(b.dataset.k);
      if (!matchMedia('(pointer: coarse)').matches) input.focus();
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
    if (t === input || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[0-9a-z.+\-*/^()!%]$/i.test(e.key)) {
      e.preventDefault();
      input.focus();
      insert({ '*': '×', '/': '÷' }[e.key] || e.key);
    } else if (e.key === 'Enter') { e.preventDefault(); equals(); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('⌫'); }
  });
  if (!matchMedia('(pointer: coarse)').matches) input.focus();
}
