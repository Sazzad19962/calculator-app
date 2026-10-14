import { CALCULATORS, byId, search } from './registry.js';
import { mountCalculator, toast } from './engine.js';
import { getCurrency, setCurrency, CURRENCIES, pinCurrency, pinnedCurrency } from './format.js';
import { initAds, resetConsent } from './ads.js';
import { makeTranslator, setTranslator, t, bnDigitsOn, setBnDigits } from './i18n.js';

const SITE = window.SITE || {};
const BASE = SITE.basePath || '/';
const PREFIX = SITE.langPrefix || ''; // "bn/" on Bangla pages
const url = (id) => `${BASE}${PREFIX}${id}/`;
// Calculator list used for search and cards; on Bangla pages names/descriptions are localised and
// the search also matches the English name and keywords.
let LIST = CALCULATORS;
let LIST_BY_ID = byId;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

/* ---------- Theme ---------- */
const tr = (s) => t(s);

function initTheme() {
  const btn = document.getElementById('theme-btn');
  const meta = document.querySelector('meta[name="theme-color"]');
  const apply = (t) => {
    document.documentElement.dataset.theme = t;
    if (btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.setAttribute('aria-pressed', String(t === 'dark'));
      btn.title = tr(t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('aria-label', btn.title);
    }
    meta?.setAttribute('content', t === 'dark' ? '#0e1320' : '#2453d6');
    document.dispatchEvent(new Event('themechange')); // redraw charts with new colours
  };
  apply(document.documentElement.dataset.theme || 'light');
  btn?.addEventListener('click', () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    store.set('calc.theme', t);
    apply(t);
  });
  // Follow the OS setting until the visitor picks a theme themselves.
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', (e) => {
    if (!store.get('calc.theme', null)) apply(e.matches ? 'dark' : 'light');
  });
}

/* ---------- Currency ---------- */
function initCurrency() {
  const sel = document.getElementById('currency');
  if (!sel) return;
  sel.innerHTML = Object.entries(CURRENCIES).map(([k, c]) => `<option value="${k}">${c.symbol.trim()} ${k}</option>`).join('');
  sel.value = getCurrency();
  if (pinnedCurrency()) {
    // This calculator's rules are in a fixed currency; the selector shows it but cannot change it here.
    sel.disabled = true;
    sel.title = t('This calculator always uses Bangladeshi Taka (৳)');
    return;
  }
  sel.addEventListener('change', () => {
    setCurrency(sel.value);
    document.dispatchEvent(new Event('currencychange'));
  });
}

/* ---------- Search (ARIA combobox) ---------- */
let searchSeq = 0;
function initSearch(box) {
  const input = box.querySelector('input');
  const list = box.querySelector('.search-results');
  const lid = `sr-${++searchSeq}`;
  list.id = lid;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', lid);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('enterkeyhint', 'go');
  let items = [];
  let active = -1;
  const open = (on) => { list.hidden = !on; input.setAttribute('aria-expanded', String(on)); };
  const highlight = () => {
    list.querySelectorAll('li[role=option]').forEach((li, i) => {
      li.setAttribute('aria-selected', String(i === active));
      if (i === active) li.scrollIntoView({ block: 'nearest' });
    });
    if (active >= 0) input.setAttribute('aria-activedescendant', `${lid}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  };
  const render = () => {
    items = search(input.value, 8, LIST);
    active = items.length ? 0 : -1;
    open(Boolean(input.value.trim()));
    list.innerHTML = items.length
      ? items.map((c, i) => `<li role="option" id="${lid}-${i}" aria-selected="${i === active}"><a href="${url(c.id)}" tabindex="-1"><span class="ico" aria-hidden="true">${c.icon}</span><span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span></a></li>`).join('')
      : `<li class="empty" role="presentation">${esc(t('No calculator found. Try "loan", "bmi" or "age".'))}</li>`;
    highlight();
  };
  input.addEventListener('input', render);
  input.addEventListener('focus', () => input.value && render());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, items.length - 1); highlight(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); highlight(); e.preventDefault(); }
    else if (e.key === 'Enter' && items[active]) { location.href = url(items[active].id); e.preventDefault(); }
    else if (e.key === 'Escape') { open(false); input.blur(); }
  });
  document.addEventListener('click', (e) => { if (!box.contains(e.target)) open(false); });
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
const cardHTML = (c) => `<li><a class="calc-card" href="${url(c.id)}"><span class="ico" aria-hidden="true">${c.icon}</span><span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span></a></li>`;

function renderPersonal() {
  const favs = store.get('calc.favs', []).map((id) => LIST_BY_ID[id]).filter(Boolean);
  const recent = store.get('calc.recent', []).map((id) => LIST_BY_ID[id]).filter(Boolean);
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
    btn.textContent = on ? `★ ${t('Saved')}` : `☆ ${t('Save')}`;
  };
  btn.addEventListener('click', () => {
    let f = store.get('calc.favs', []);
    f = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f].slice(0, 24);
    store.set('calc.favs', f);
    sync();
    toast(t(f.includes(id) ? 'Saved — find it on the home page' : 'Removed from saved calculators'));
  });
  sync();
}

function trackRecent(id) {
  const r = store.get('calc.recent', []).filter((x) => x !== id);
  store.set('calc.recent', [id, ...r].slice(0, 8));
}

/* ---------- Language ---------- */
async function initLanguage(calcId) {
  if (SITE.lang !== 'bn') return;
  try {
    const dict = (await import(`./i18n/bn-client.js?v=${SITE.version || ''}`)).default;
    setTranslator(makeTranslator(dict, calcId));
    LIST = CALCULATORS.map((c) => {
      const b = dict.calc?.[c.id] || {};
      return { ...c, name: b.name || c.name, desc: b.desc || c.desc, keywords: `${b.keywords || ''} ${c.name} ${c.keywords || ''}` };
    });
    LIST_BY_ID = Object.fromEntries(LIST.map((c) => [c.id, c]));
  } catch (e) {
    console.warn('Bangla translations could not be loaded; showing English.', e);
  }
}

/** The ১২৩ / 123 toggle on Bangla pages: Bangla numerals in results are display-only. */
function initDigits() {
  const btn = document.getElementById('digits-btn');
  if (!btn) return;
  const sync = () => {
    const on = bnDigitsOn();
    btn.textContent = on ? '১২৩' : '123';
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'ইংরেজি সংখ্যা (123) দেখান' : 'বাংলা সংখ্যা (১২৩) দেখান';
  };
  btn.addEventListener('click', () => {
    setBnDigits(!bnDigitsOn());
    sync();
    document.dispatchEvent(new Event('digitschange')); // calculator results re-render with the chosen digits
  });
  sync();
}

/** Language links keep the current calculator inputs (query string) when switching. */
function initLangSwitch() {
  document.querySelectorAll('[data-lang-switch]').forEach((a) => a.addEventListener('click', () => {
    a.href = a.getAttribute('href').split(/[?#]/)[0] + location.search + location.hash;
  }));
}

/* ---------- Boot ---------- */
async function boot() {
  await initLanguage(document.body.dataset.calc || '');
  initDigits();
  initLangSwitch();
  initTheme();
  pinCurrency(byId[document.body.dataset.calc || '']?.currency);
  initCurrency();
  // Sets up ad slots synchronously (collapse/placeholder) so layout settles early;
  // the AdSense script itself loads later, on idle, after consent.
  initAds(SITE);
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

  // The service worker is not needed for first paint: register it once the page is idle.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  if ('serviceWorker' in navigator && SITE.serviceWorker !== false && location.protocol === 'https:') {
    const reg = () => idle(() => navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {}));
    if (document.readyState === 'complete') reg(); else addEventListener('load', reg, { once: true });
  }
}

boot();
