import { byId, search } from './registry.js';
import { mountCalculator } from './engine.js';
import { getCurrency, setCurrency, CURRENCIES } from './format.js';
import { initAds, resetConsent } from './ads.js';

const SITE = window.SITE || {};
const BASE = SITE.basePath || '/';
const url = (id) => `${BASE}${id}/`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

/* ---------- Theme ---------- */
function initTheme() {
  const btn = document.getElementById('theme-btn');
  const apply = (t) => {
    document.documentElement.dataset.theme = t;
    if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  };
  apply(document.documentElement.dataset.theme || 'light');
  btn?.addEventListener('click', () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set('calc.theme', t);
    apply(t);
    document.dispatchEvent(new Event('currencychange')); // redraw charts with new colours
  });
}

/* ---------- Currency ---------- */
function initCurrency() {
  const sel = document.getElementById('currency');
  if (!sel) return;
  sel.innerHTML = Object.entries(CURRENCIES).map(([k, c]) => `<option value="${k}">${c.symbol.trim()} ${k}</option>`).join('');
  sel.value = getCurrency();
  sel.addEventListener('change', () => {
    setCurrency(sel.value);
    document.dispatchEvent(new Event('currencychange'));
  });
}

/* ---------- Search ---------- */
function initSearch(box) {
  const input = box.querySelector('input');
  const list = box.querySelector('.search-results');
  let items = [];
  let active = -1;
  const render = () => {
    items = search(input.value);
    active = items.length ? 0 : -1;
    list.hidden = !input.value.trim();
    list.innerHTML = items.length
      ? items.map((c, i) => `<li role="option" ${i === active ? 'aria-selected="true"' : ''}><a href="${url(c.id)}"><span class="ico">${c.icon}</span><span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span></a></li>`).join('')
      : '<li class="empty">No calculator found. Try "loan", "bmi" or "age".</li>';
  };
  const highlight = () => list.querySelectorAll('li[role=option]').forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
  input.addEventListener('input', render);
  input.addEventListener('focus', () => input.value && render());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, items.length - 1); highlight(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); highlight(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[active]) { location.href = url(items[active].id); e.preventDefault(); }
    else if (e.key === 'Escape') { list.hidden = true; input.blur(); }
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) list.hidden = true; });
}

function initShortcut() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.body.dataset.calc !== 'scientific') {
      e.preventDefault();
      document.querySelector('.search-box input')?.focus();
    }
  });
}

/* ---------- Favourites & recents ---------- */
const cardHTML = (c) => `<li><a class="calc-card" href="${url(c.id)}"><span class="ico">${c.icon}</span><span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span></a></li>`;

function renderPersonal() {
  const favs = store.get('calc.favs', []).map((id) => byId[id]).filter(Boolean);
  const recent = store.get('calc.recent', []).map((id) => byId[id]).filter(Boolean);
  for (const [sel, list] of [['#favs-section', favs], ['#recent-section', recent]]) {
    const sec = document.querySelector(sel);
    if (!sec) continue;
    sec.hidden = !list.length;
    sec.querySelector('ul').innerHTML = list.map(cardHTML).join('');
  }
}

function initFavButton(id) {
  const btn = document.getElementById('fav-btn');
  if (!btn) return;
  const sync = () => {
    const on = store.get('calc.favs', []).includes(id);
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? '★ Saved' : '☆ Save';
  };
  btn.addEventListener('click', () => {
    let f = store.get('calc.favs', []);
    f = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f].slice(0, 24);
    store.set('calc.favs', f);
    sync();
  });
  sync();
}

function trackRecent(id) {
  const r = store.get('calc.recent', []).filter((x) => x !== id);
  store.set('calc.recent', [id, ...r].slice(0, 8));
}

/* ---------- Boot ---------- */
async function boot() {
  initTheme();
  initCurrency();
  document.querySelectorAll('.search-box').forEach(initSearch);
  initShortcut();
  document.querySelectorAll('[data-reset-consent]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); resetConsent(); }));

  const id = document.body.dataset.calc;
  const calc = id && byId[id];
  if (calc) {
    const root = document.getElementById('calc-root');
    if (calc.custom === 'scientific') {
      const { mountScientific } = await import('./scientific.js');
      mountScientific(root);
    } else {
      mountCalculator(calc, root);
    }
    initFavButton(id);
    trackRecent(id);
  }
  if (document.body.dataset.page === 'home') {
    renderPersonal();
    const q = new URLSearchParams(location.search).get('q');
    const input = document.querySelector('.hero .search-box input');
    if (q && input) {
      input.value = q;
      input.focus();
      input.dispatchEvent(new Event('input'));
    }
  }

  initAds(SITE);

  if ('serviceWorker' in navigator && SITE.serviceWorker !== false && location.protocol === 'https:') {
    navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {});
  }
}

boot();
