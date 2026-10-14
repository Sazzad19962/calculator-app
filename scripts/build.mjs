// Static site generator: one pre-rendered, SEO-friendly HTML page per calculator, plus category hubs,
// an HTML sitemap, E-E-A-T/legal pages, Open Graph images and XML sitemap — in English (/) and Bangla (/bn/).
// Usage: node scripts/build.mjs   (env overrides: SITE_URL, BASE_PATH, ADSENSE_CLIENT, DIST_DIR, SEO_STRICT=1)
import { readFile, writeFile, mkdir, rm, cp, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CALCULATORS, CATEGORIES } from '../src/registry.js';
import { seoTitle, seoDescription, CATEGORY_INTROS, clamp } from '../src/content/seo.js';
import { ogImage } from '../src/content/og.js';
import BN, { clientDict } from '../src/i18n/bn.js';
import bnPages from '../src/i18n/bn-pages.js';
import { makeTranslator, toBnDigits } from '../src/i18n.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = process.env.DIST_DIR ? join(ROOT, process.env.DIST_DIR) : join(ROOT, 'dist');

const cfg = JSON.parse(await readFile(join(ROOT, 'site.config.json'), 'utf8'));
if (process.env.SITE_URL) cfg.url = process.env.SITE_URL;
if (process.env.BASE_PATH) cfg.basePath = process.env.BASE_PATH;
if (process.env.ADSENSE_CLIENT) cfg.adsenseClient = process.env.ADSENSE_CLIENT;
cfg.basePath = `/${cfg.basePath.replace(/^\/|\/$/g, '')}/`.replace('//', '/');
cfg.url = cfg.url.replace(/\/$/, '');
const AUTHOR_EN = cfg.author?.name || `${cfg.name} Editorial Team`;

const BASE = cfg.basePath;
const abs = (path = '') => `${cfg.url}${BASE}${path}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const template = await readFile(join(ROOT, 'src/template.html'), 'utf8');
const VERSION = createHash('sha1').update(template + JSON.stringify(cfg) + Date.now()).digest('hex').slice(0, 8);
const TODAY = new Date().toISOString().slice(0, 10);

// FAQs are optional per calculator; a missing/broken module must never break the build.
let FAQ = {};
try { FAQ = (await import('../src/content/faq.js')).default || {}; } catch (e) { console.warn('FAQ content not loaded:', e.message); }

// The in-article slot falls back to the in-content unit id so it fills even without its own unit.
const adSlots = { ...(cfg.adSlots || {}) };
if (!adSlots.inArticle && adSlots.inContent) adSlots.inArticle = adSlots.inContent;
// Ad placeholders (dashed "Advertisement" boxes) help with layout work locally but look unfinished to visitors
// and AdSense reviewers. "local" (default): only when SITE_URL is not set, i.e. not a production/CI build.
function showPlaceholders() {
  const v = process.env.AD_PLACEHOLDERS ?? cfg.showAdPlaceholders ?? 'local';
  if (v === 'local') return !process.env.SITE_URL;
  return v === true || v === 'true' || v === '1';
}
const clientConfig = {
  name: cfg.name, basePath: BASE, currency: cfg.currency || '', adsenseClient: cfg.adsenseClient || '',
  adSlots, useGoogleCMP: Boolean(cfg.useGoogleCMP), showAdPlaceholders: showPlaceholders(), version: VERSION,
};

// ── "Last updated" dates: last git commit touching the file, or today if it has uncommitted edits. ──
function gitDate(file) {
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', file], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (dirty) return TODAY;
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return d || TODAY;
  } catch { return TODAY; }
}
const UPDATED = {};
for (const f of (await readdir(join(ROOT, 'src/calculators'))).filter((n) => n.endsWith('.js'))) {
  try {
    const mod = await import(pathToFileURL(join(ROOT, 'src/calculators', f)).href);
    const date = gitDate(`src/calculators/${f}`);
    for (const c of Object.values(mod).flat()) if (c && c.id) UPDATED[c.id] = date;
  } catch { /* registry import already validated these modules */ }
}
const faqDate = gitDate('src/content/faq.js');
const updatedFor = (id) => [UPDATED[id] || TODAY, FAQ[id] ? faqDate : ''].sort().pop();
const SITE_UPDATED = [gitDate('scripts/build.mjs'), gitDate('src/template.html')].sort().pop();
const BN_UPDATED = gitDate('src/i18n');
const updatedForLang = (L, id) => (L.code === 'bn' ? [updatedFor(id), BN_UPDATED].sort().pop() : updatedFor(id));

/** Converts ASCII digits to Bangla in HTML text (never inside tags, entities, <code>, <script>, <style> or <kbd>). */
function bnDigitsHTML(html) {
  let skip = 0;
  return String(html).split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) {
      const m = part.match(/^<(\/?)(code|script|style|kbd|pre)\b/i);
      if (m) skip = Math.max(0, skip + (m[1] ? -1 : 1));
      return part;
    }
    return skip ? part : part.replace(/(&#?\w+;)|[0-9]/g, (x, ent) => (ent ? ent : toBnDigits(x)));
  }).join('');
}

// ── Languages ──
const bnT = makeTranslator(BN);
const LANGS = {
  en: {
    code: 'en', htmlLang: cfg.lang || 'en', ogLocale: cfg.locale || 'en_US', prefix: '', t: (s) => s, author: AUTHOR_EN,
    calc: (c) => c,
    cat: (cat) => cat,
    faq: (id) => FAQ[id],
    intro: (id) => CATEGORY_INTROS[id],
    fmtDate: (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    digits: (h) => h,
    title: (c) => seoTitle(c, cfg.name),
    description: (c) => seoDescription(c),
  },
  bn: {
    code: 'bn', htmlLang: 'bn', ogLocale: 'bn_BD', prefix: 'bn/', t: bnT, author: cfg.author?.nameBn || `${cfg.name} সম্পাদকীয় দল`,
    calc: (c) => {
      const b = BN.calc[c.id] || {};
      return { ...c, name: b.name || c.name, desc: b.desc || c.desc, about: b.about || c.about, keywords: `${b.keywords || ''} ${c.keywords || ''}` };
    },
    cat: (cat) => ({ ...cat, name: BN.categories[cat.id]?.name || cat.name, desc: BN.categories[cat.id]?.desc || cat.desc }),
    faq: (id) => BN.calc[id]?.faq,
    intro: (id) => BN.categories[id]?.intro,
    fmtDate: (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    digits: bnDigitsHTML,
    title: (c) => {
      const b = BN.calc[c.id] || {};
      const base = b.title || b.name || c.name;
      for (const t of [`${base} | ${cfg.name}`, base, `${b.name || c.name} | ${cfg.name}`, b.name || c.name]) if (t.length <= 60) return t;
      return clamp(b.name || c.name, 60);
    },
    description: (c) => {
      const b = BN.calc[c.id] || {};
      let d = b.metaDesc || b.desc || seoDescription(c);
      if (d.length > 155) return clamp(d, 155);
      for (const tail of [' বিনামূল্যে, তাৎক্ষণিক ও গোপনীয় — কোনো নিবন্ধন লাগে না।', ' বিনামূল্যে, তাৎক্ষণিক ও গোপনীয়।']) {
        if (d.length < 110 && (d + tail).length <= 155) { d += tail; break; }
      }
      return d;
    },
  },
};
const LANG_LIST = Object.values(LANGS);

// ── Shared fragments ──
const org = {
  '@type': 'Organization', '@id': `${abs()}#org`, name: cfg.name, url: abs(),
  logo: { '@type': 'ImageObject', url: abs('icon-512.png'), width: 512, height: 512 },
  ...(cfg.contactEmail ? { email: cfg.contactEmail, contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: cfg.contactEmail, url: abs('about/contact/'), availableLanguage: ['English', 'Bengali'] } } : {}),
  ...(Array.isArray(cfg.sameAs) && cfg.sameAs.length ? { sameAs: cfg.sameAs } : {}),
};

/** hreflang alternates for a language-neutral path (e.g. "mortgage/"). */
function alternates(path) {
  const alts = LANG_LIST.map((L) => ({ lang: L.htmlLang, href: abs(L.prefix + path) }));
  for (const a of cfg.alternateLanguages || []) if (a.lang && a.url) alts.push({ lang: a.lang, href: `${a.url.replace(/\/$/, '')}${BASE}${path}` });
  return [...alts, { lang: 'x-default', href: abs(path) }];
}
const hreflang = (path) => alternates(path).map((a) => `<link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(a.href)}">`).join('\n');

function headExtra(jsonLd) {
  let h = '';
  if (cfg.adsenseClient) h += `<meta name="google-adsense-account" content="${esc(cfg.adsenseClient)}">\n<link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin>\n`;
  if (cfg.googleSiteVerification) h += `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">\n`;
  if (cfg.googleAnalyticsId) {
    h += `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.googleAnalyticsId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.googleAnalyticsId)}');</script>\n`;
  }
  if (jsonLd) h += `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`;
  return h;
}

const POPULAR = ['mortgage', 'loan', 'bmi', 'scientific', 'percentage', 'age', 'compound-interest', 'calorie', 'unit-converter', 'emi'];
const POPULAR_BN = ['bd-income-tax', 'emi', 'bd-sanchayapatra', 'bd-fdr', 'bd-gold-price', 'bd-electricity-bill', 'zakat', 'bmi', 'age', 'percentage'];
const inCat = (id) => CALCULATORS.filter((c) => c.cat === id);

/** All page builders for one language. Paths passed around are language-neutral ("mortgage/"). */
function site(L) {
  const t = L.t;
  const AUTHOR = L.author;
  const href = (path = '') => `${BASE}${L.prefix}${path}`;
  const labs = (path = '') => abs(L.prefix + path);
  const C = (c) => L.calc(c);
  const CAT = (cat) => L.cat(cat);
  const calcs = CALCULATORS.map(C);
  const catsL = CATEGORIES.map(CAT);
  const inCatL = (id) => calcs.filter((c) => c.cat === id);
  const fmtDate = L.fmtDate;
  const author = cfg.author?.url ? { '@type': 'Person', name: AUTHOR, url: cfg.author.url } : { '@type': 'Organization', name: AUTHOR, url: labs('about/editorial/') };

  /** An ad slot inside a labelled wrapper that keeps it visually separated from interactive content. */
  const ad = (slot, cls) => `<div class="ad-wrap"><span class="ad-label">${t('Advertisement')}</span><div class="ad-slot ${cls}" data-slot="${slot}" role="complementary" aria-label="${t('Advertisement')}"></div></div>`;
  const catUrl = (cat) => href(`category/${cat.id}/`);
  const card = (c) => `<li><a class="calc-card" href="${href(`${c.id}/`)}"><span class="ico" aria-hidden="true">${c.icon}</span><span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span></a></li>`;
  const catLabel = (cat) => (L.code === 'bn' ? `${cat.name} ক্যালকুলেটর` : `${cat.name} calculators`);

  function breadcrumbs(trail) {
    const html = `<nav class="breadcrumb" aria-label="${t('Breadcrumb')}">${trail.map((x, i) => (i < trail.length - 1 ? `<a href="${href(x.path)}">${esc(x.name)}</a>` : `<span aria-current="page">${esc(x.name)}</span>`)).join(' › ')}</nav>`;
    const ld = { '@type': 'BreadcrumbList', itemListElement: trail.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: labs(x.path) })) };
    return { html, ld };
  }

  function sidebar() {
    const pop = (L.code === 'bn' ? POPULAR_BN : POPULAR).map((id) => calcs.find((c) => c.id === id)).filter(Boolean);
    return `<div class="card side-list"><h3>${t('Popular calculators')}</h3><ul>${pop.map((c) => `<li><a href="${href(`${c.id}/`)}"><span aria-hidden="true">${c.icon}</span>${esc(c.name)}</a></li>`).join('')}</ul></div>
    <div class="card side-list"><h3>${t('Categories')}</h3><ul>${catsL.map((cat) => `<li><a href="${catUrl(cat)}"><span aria-hidden="true">${cat.icon}</span>${esc(cat.name)}</a></li>`).join('')}</ul></div>
    <div class="sticky"><span class="ad-label">${t('Advertisement')}</span><div class="ad-slot ad-sidebar" data-slot="sidebar" role="complementary" aria-label="${t('Advertisement')}"></div></div>`;
  }

  function footer() {
    const year = new Date().getFullYear();
    const allOf = (cat) => (L.code === 'bn' ? `সব ${cat.name} ক্যালকুলেটর →` : `All ${esc(cat.name.toLowerCase())} calculators →`);
    const col = (cat) => `<div><h4><a href="${catUrl(cat)}">${esc(cat.name)}</a></h4><ul>${inCatL(cat.id).slice(0, 6).map((c) => `<li><a href="${href(`${c.id}/`)}">${esc(c.name)}</a></li>`).join('')}<li><a href="${catUrl(cat)}">${allOf(cat)}</a></li></ul></div>`;
    const firstCats = L.code === 'bn' ? ['bangladesh', 'finance', 'health'].map((id) => catsL.find((c) => c.id === id)).filter(Boolean) : catsL.slice(0, 3);
    return `<div class="footer-inner">
    <div><h4>${esc(cfg.name)}</h4><p>${esc(t(cfg.tagline))}. ${t('All calculations run in your browser — your numbers never leave your device.')}</p>
      <ul><li><a href="${href('about/')}">${t('About us')}</a></li><li><a href="${href('about/editorial/')}">${t('Editorial policy')}</a></li><li><a href="${href('about/contact/')}">${t('Contact')}</a></li><li><a href="${href('about/sitemap/')}">${t('All calculators (sitemap)')}</a></li><li><a href="${href('privacy/')}">${t('Privacy Policy')}</a></li><li><a href="${href('privacy/')}#cookies">${t('Cookie Policy')}</a></li><li><a href="${href('terms/')}">${t('Terms of Use')}</a></li><li><a href="#" data-reset-consent>${t('Cookie settings')}</a></li></ul></div>
    ${firstCats.map(col).join('')}
  </div><div class="copyright">© ${year} ${esc(cfg.name)}. ${t('Results are estimates for informational purposes only and are not financial, medical or legal advice.')}
    <ul class="footer-links">${catsL.map((cat) => `<li><a href="${catUrl(cat)}">${esc(cat.name)}</a></li>`).join('')}</ul></div>`;
  }

  function langTools(path) {
    const other = L.code === 'bn' ? LANGS.en : LANGS.bn;
    const link = `<a class="lang-switch" href="${BASE}${other.prefix}${path}" hreflang="${other.htmlLang}" lang="${other.htmlLang}" data-lang-switch title="${other.code === 'bn' ? 'বাংলায় দেখুন' : 'View in English'}">${other.code === 'bn' ? 'বাংলা' : 'English'}</a>`;
    const digits = L.code === 'bn' ? '<button class="icon-btn digits-btn" id="digits-btn" type="button" aria-pressed="true" title="ইংরেজি সংখ্যা (123) দেখান">১২৩</button>' : '';
    return link + digits;
  }

  function page({ title, description, path, main, pageKind = 'page', calcId = '', jsonLd, og = 'default', ogType = 'website', robots = 'index, follow, max-image-preview:large', noAlternates = false }) {
    const bn = L.code === 'bn';
    const D = L.digits;
    const vars = {
      TITLE: esc(D(title)), DESCRIPTION: esc(D(description)), CANONICAL: labs(path), SITE_NAME: esc(cfg.name), BASE, VERSION, HOME: href(),
      CONFIG_JSON: JSON.stringify({ ...clientConfig, lang: L.code, langPrefix: L.prefix, ...(bn ? { currency: cfg.currencyBn || 'BDT' } : {}) }).replace(/</g, '\\u003c'), HEAD_EXTRA: headExtra(jsonLd), PAGE: pageKind, CALC_ID: calcId,
      MAIN: D(main), SIDEBAR: D(sidebar()), FOOTER: D(footer()), COUNT: String(CALCULATORS.length),
      LANG: L.htmlLang, OG_LOCALE: L.ogLocale, OG_TYPE: ogType, OG_IMAGE: abs(`og/${og}.png`), OG_ALT: esc(D(title)), ROBOTS: robots,
      HREFLANG: noAlternates ? '' : hreflang(path) + LANG_LIST.filter((x) => x !== L).map((x) => `\n<meta property="og:locale:alternate" content="${x.ogLocale}">`).join(''),
      AUTHOR: esc(AUTHOR),
      SEARCH_PH: esc(bn ? `${toBnDigits(CALCULATORS.length)}টি ক্যালকুলেটর খুঁজুন…` : `Search ${CALCULATORS.length} calculators…  ( / )`),
      CONSENT_TEXT: bn
        ? `বিজ্ঞাপন দেখাতে ও সাইটের ব্যবহার বুঝতে আমরা কুকি ব্যবহার করি। ব্যক্তিগতকৃত বিজ্ঞাপনের জন্য “সম্মতি দিন” এবং ব্যক্তিগতকৃত নয় এমন বিজ্ঞাপনের জন্য “প্রত্যাখ্যান” বেছে নিন। বিস্তারিত দেখুন আমাদের <a href="${href('privacy/')}#cookies">কুকি নীতিতে</a>।`
        : `We use cookies to show ads and understand site usage. Choose “Accept” for personalised ads or “Reject” for non-personalised ads. See our <a href="${href('privacy/')}#cookies">Cookie Policy</a>.`,
      LANG_TOOLS: langTools(path.endsWith('.html') ? '' : path),
      FONTS: bn ? '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;600;700;800&display=swap">' : '',
      PRELOAD: bn ? `<link rel="modulepreload" href="${BASE}assets/i18n/bn-client.js?v=${VERSION}">` : '',
    };
    return template.replace(/\{\{t:([^}]+)\}\}/g, (m, k) => esc(t(k))).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  }

  // ── Home ──
  function homeMain() {
    const chipIds = L.code === 'bn' ? ['bd-income-tax', 'emi', 'bd-sanchayapatra', 'bd-gold-price', 'zakat', 'bmi', 'age', 'percentage'] : ['mortgage', 'bmi', 'percentage', 'age', 'emi', 'scientific', 'unit-converter', 'zakat'];
    const chips = chipIds.map((id) => calcs.find((c) => c.id === id)).filter(Boolean);
    const order = L.code === 'bn' ? [...catsL.filter((c) => c.id === 'bangladesh'), ...catsL.filter((c) => c.id !== 'bangladesh')] : catsL;
    const cats = order.map((cat, i) => {
      const list = inCatL(cat.id);
      const browse = L.code === 'bn' ? `সব ${list.length}টি দেখুন →` : `Browse all ${list.length} →`;
      return `<section class="cat-section" id="cat-${cat.id}"><h2><span class="ico" aria-hidden="true">${cat.icon}</span><a href="${catUrl(cat)}">${esc(catLabel(cat))}</a></h2><p>${esc(cat.desc)} <a href="${catUrl(cat)}">${browse}</a></p>
      <ul class="card-grid">${list.map(card).join('')}</ul></section>${i === 1 ? ad('inContent', 'ad-incontent') : ''}`;
    }).join('\n');
    const bn = L.code === 'bn';
    return `<section class="hero">
      <h1>${esc(t(cfg.tagline))}</h1>
      <p>${bn ? `টাকা-পয়সা, স্বাস্থ্য, গণিত ও দৈনন্দিন জীবনের জন্য ${CALCULATORS.length}টি সহজ ক্যালকুলেটর — আয়কর, সঞ্চয়পত্র, এফডিআর, ডিপিএস, স্বর্ণের দাম ও বিদ্যুৎ বিলসহ। তাৎক্ষণিক ফলাফল, নিবন্ধন লাগে না, ইন্টারনেট ছাড়াও চলে।` : `${CALCULATORS.length} beautifully simple calculators for money, health, math and everyday life. Instant results, no sign-up, works offline.`}</p>
      <div class="search-box big" role="search"><input type="search" placeholder="${esc(t('What do you want to calculate?'))}" aria-label="${esc(t('Search calculators'))}" autocomplete="off"><ul class="search-results" role="listbox" hidden></ul></div>
      <div class="chips">${chips.map((c) => `<a href="${href(`${c.id}/`)}">${c.icon} ${esc(c.name.replace(/ Calculator$/, '').replace(/ ক্যালকুলেটর$/, ''))}</a>`).join('')}</div>
    </section>
    <div class="features">
      <div class="card"><b>⚡ ${t('Instant')}</b>${t('Results update as you type')}</div>
      <div class="card"><b>🔒 ${t('Private')}</b>${t('Everything runs on your device')}</div>
      <div class="card"><b>🔗 ${t('Shareable')}</b>${t('Every result has its own link')}</div>
      <div class="card"><b>🌙 ${t('Dark mode & offline')}</b>${t('Install it like an app')}</div>
    </div>
    <section class="cat-section" id="favs-section" hidden><h2><span class="ico">★</span>${t('Your saved calculators')}</h2><ul class="card-grid"></ul></section>
    <section class="cat-section" id="recent-section" hidden><h2><span class="ico">🕘</span>${t('Recently used')}</h2><ul class="card-grid"></ul></section>
    ${cats}
    <section class="card about"><h2>${bn ? `কেন ${esc(cfg.name)}-এর ওপর আস্থা রাখবেন?` : `Why trust ${esc(cfg.name)}?`}</h2><p>${bn
      ? `প্রতিটি ক্যালকুলেটরের পাতায় তার সূত্র ও তথ্যসূত্র উল্লেখ আছে, স্বয়ংক্রিয় পরীক্ষায় ফলাফল যাচাই করা হয় এবং ${esc(AUTHOR)} তা পর্যালোচনা করে — দেখুন আমাদের <a href="${href('about/editorial/')}">সম্পাদকীয় নীতি</a>। কর ও আইনগত হারের ক্ষেত্রে সরকারি উৎস ও প্রযোজ্য অর্থবছর উল্লেখ করা হয়। প্রশ্ন বা সংশোধনী থাকলে <a href="${href('about/contact/')}">যোগাযোগ করুন</a>।`
      : `Every calculator documents its formula and sources on its page, is covered by automated tests, and is reviewed by the ${esc(AUTHOR)} — see our <a href="${href('about/editorial/')}">editorial policy</a>. Tax and legal rates cite the official source and the fiscal year they apply to. Questions or corrections? <a href="${href('about/contact/')}">Contact us</a>.`}</p></section>`;
  }

  // ── Calculator pages ──
  /** FAQ answers in JSON-LD may only use a small set of HTML tags (per Google's guidelines). */
  const ldAnswer = (html) => html.replace(/<sup>(.*?)<\/sup>/g, '^$1').replace(/<sub>(.*?)<\/sub>/g, '$1').replace(/<(?!\/?(?:a|b|strong|i|em|br|p|ul|ol|li)\b)[^>]*>/g, '');

  function faqSection(c) {
    const list = L.faq(c.id);
    if (!Array.isArray(list) || !list.length) return { html: '', ld: null };
    const html = `<section class="card faq" id="faq"><h2>${t('Frequently asked questions')}</h2>${list.map((f, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(f.q)}</summary><div class="faq-a"><p>${f.a}</p></div></details>`).join('')}</section>`;
    const ld = { '@type': 'FAQPage', '@id': `${labs(`${c.id}/`)}#faq`, inLanguage: L.htmlLang, mainEntity: list.map((f) => ({ '@type': 'Question', name: L.digits(f.q), acceptedAnswer: { '@type': 'Answer', text: L.digits(ldAnswer(f.a)) } })) };
    return { html, ld };
  }

  function calcPage(orig) {
    const c = C(orig);
    const cat = catsL.find((x) => x.id === c.cat) || { id: c.cat, name: c.cat, icon: '' };
    const url = labs(`${c.id}/`);
    const updated = updatedForLang(L, c.id);
    const same = inCatL(c.cat).filter((x) => x.id !== c.id);
    const STOP = new Set(['calculator', 'calculate', 'calculation', 'online', 'free', 'convert', 'converter', 'bangladesh', 'with', 'from', 'your', 'what', 'much', 'many', 'time', 'number', 'total']);
    const kw = new Set(String(orig.keywords || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
    const score = (x) => String(CALCULATORS.find((o) => o.id === x.id)?.keywords || '').toLowerCase().split(/\s+/).filter((w) => kw.has(w)).length;
    const related = [...same].sort((a, b) => score(b) - score(a)).slice(0, 6);
    const cross = calcs.filter((x) => x.cat !== c.cat && score(x) >= 2).sort((a, b) => score(b) - score(a)).slice(0, 3);
    const bc = breadcrumbs([{ name: t('Home'), path: '' }, { name: cat.name, path: `category/${cat.id}/` }, { name: c.name, path: `${c.id}/` }]);
    const faq = faqSection(c);
    const bn = L.code === 'bn';
    const short = c.name.replace(/ Calculator$/, '').toLowerCase();
    const howTitle = bn ? `${c.name} যেভাবে কাজ করে` : `How the ${esc(short)} calculator works`;
    const main = `${bc.html}
    <div class="calc-head"><h1>${esc(c.name)}</h1><button class="btn small" id="fav-btn" type="button" aria-pressed="false">☆ ${t('Save')}</button></div>
    <p class="lead">${esc(c.desc)}</p>
    <p class="byline"><span>${bn ? `লিখেছে <a href="${href('about/editorial/')}">${esc(AUTHOR)}</a>` : `By <a href="${href('about/editorial/')}">${esc(AUTHOR)}</a>`}</span><span class="dot" aria-hidden="true">•</span><span>${t('Last updated')} <time datetime="${updated}">${fmtDate(updated)}</time></span><span class="dot" aria-hidden="true">•</span><a href="#how">${t('How it works')}</a>${faq.html ? `<span class="dot" aria-hidden="true">•</span><a href="#faq">${t('FAQ')}</a>` : ''}</p>
    <div id="calc-root"><noscript><div class="card about">${t('Please enable JavaScript to use this calculator.')}</div></noscript></div>
    ${ad('inContent', 'ad-incontent')}
    <section class="card about" id="how"><h2>${esc(howTitle)}</h2>${c.about || ''}
      <p class="sources">${bn
        ? `পর্যালোচনা করেছে ${esc(AUTHOR)} · সূত্রগুলো স্বয়ংক্রিয় পরীক্ষায় যাচাই করা · দেখুন আমাদের <a href="${href('about/editorial/')}">সম্পাদকীয় নীতি</a>। কোনো ভুল পেয়েছেন? <a href="${href('about/contact/')}">আমাদের জানান</a>।`
        : `Reviewed by the ${esc(AUTHOR)} · formulas are covered by automated tests · see our <a href="${href('about/editorial/')}">editorial policy</a>. Found an error? <a href="${href('about/contact/')}">Tell us</a>.`}</p></section>
    ${faq.html}
    ${ad('inArticle', 'ad-incontent ad-inarticle')}
    <section class="related"><h2>${t('Related calculators')}</h2><ul class="card-grid">${[...related, ...cross].map(card).join('')}</ul>
      <p><a href="${catUrl(cat)}">${bn ? `সব ${esc(cat.name)} ক্যালকুলেটর দেখুন →` : `See all ${esc(cat.name.toLowerCase())} calculators →`}</a></p></section>`;
    const title = L.title(orig);
    const description = L.description(orig);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        org,
        { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: L.digits(title), description: L.digits(description), inLanguage: L.htmlLang, isPartOf: { '@type': 'WebSite', '@id': `${abs()}#website`, name: cfg.name, url: abs() }, breadcrumb: bc.ld, dateModified: updated, author, publisher: { '@id': `${abs()}#org` }, primaryImageOfPage: { '@type': 'ImageObject', url: abs(`og/${c.id}.png`), width: 1200, height: 630 } },
        { '@type': 'WebApplication', name: c.name, description: c.desc, url, inLanguage: L.htmlLang, applicationCategory: c.cat === 'finance' || c.cat === 'bangladesh' ? 'FinanceApplication' : c.cat === 'health' ? 'HealthApplication' : c.cat === 'math' ? 'EducationalApplication' : 'UtilitiesApplication', operatingSystem: 'Any', browserRequirements: 'Requires JavaScript', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: c.cat === 'bangladesh' ? 'BDT' : 'USD' }, publisher: { '@id': `${abs()}#org` } },
        ...(faq.ld ? [faq.ld] : []),
      ],
    };
    return page({ title, description, path: `${c.id}/`, pageKind: 'calc', calcId: c.id, main, jsonLd, og: c.id });
  }

  // ── Category hubs ──
  function categoryPage(origCat) {
    const cat = CAT(origCat);
    const list = inCatL(cat.id);
    const bn = L.code === 'bn';
    const bc = breadcrumbs([{ name: t('Home'), path: '' }, { name: catLabel(cat), path: `category/${cat.id}/` }]);
    const intro = L.intro(cat.id) || `<p>${esc(cat.desc)}</p>`;
    const main = `${bc.html}
    <header class="hub-head"><h1>${bn ? `${esc(cat.name)} ক্যালকুলেটর` : `${esc(cat.name)} Calculators`}</h1><p class="lead">${esc(cat.desc)} ${bn ? `${list.length}টি বিনামূল্যের ক্যালকুলেটর — তাৎক্ষণিক ফলাফল, নিবন্ধন লাগে না।` : `${list.length} free calculators — instant results, no sign-up.`}</p></header>
    <section class="card hub-intro">${intro}</section>
    <ul class="card-grid">${list.map(card).join('')}</ul>
    ${ad('inContent', 'ad-incontent')}
    <section class="hub-other"><h2>${t('Other categories')}</h2><ul class="pill-list">${catsL.filter((x) => x.id !== cat.id).map((x) => `<li><a href="${catUrl(x)}"><span aria-hidden="true">${x.icon}</span>${esc(x.name)}</a></li>`).join('')}</ul></section>`;
    const url = labs(`category/${cat.id}/`);
    const title = bn
      ? [`${cat.name} ক্যালকুলেটর – বিনামূল্যে ও তাৎক্ষণিক | ${cfg.name}`, `${cat.name} ক্যালকুলেটর | ${cfg.name}`].find((x) => x.length <= 60) || `${cat.name} ক্যালকুলেটর`
      : [`${cat.name} Calculators – Free & Instant | ${cfg.name}`, `${cat.name} Calculators | ${cfg.name}`].find((x) => x.length <= 60) || `${cat.name} Calculators`;
    const description = bn
      ? clamp(`বিনামূল্যের ${cat.name} ক্যালকুলেটর: ${list.slice(0, 5).map((c) => c.name.replace(/ ক্যালকুলেটর$/, '')).join(', ')} এবং আরও অনেক। তাৎক্ষণিক, নির্ভুল ও গোপনীয়।`, 155)
      : clamp(`Free ${cat.name.toLowerCase()} calculators: ${list.slice(0, 5).map((c) => c.name.replace(/ Calculator$/, '')).join(', ')} and more. Instant, accurate and private.`, 155);
    return page({
      title, description, path: `category/${cat.id}/`, main, og: `category-${cat.id}`,
      jsonLd: { '@context': 'https://schema.org', '@graph': [org, { '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: L.digits(title), description: L.digits(description), inLanguage: L.htmlLang, breadcrumb: bc.ld, dateModified: [...list.map((c) => updatedForLang(L, c.id)), SITE_UPDATED].sort().pop(), publisher: { '@id': `${abs()}#org` }, mainEntity: { '@type': 'ItemList', numberOfItems: list.length, itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: labs(`${c.id}/`), name: c.name })) } }] },
    });
  }

  // ── Static / legal / trust pages ──
  const prose = (title, body, trail) => {
    const bc = trail ? breadcrumbs(trail).html : '';
    return `${bc}<article class="card prose"><h1>${title}</h1>${body}</article>`;
  };
  const mail = cfg.contactEmail ? `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>` : (L.code === 'bn' ? 'নিচের যোগাযোগ ফর্ম' : 'the contact form below');

  const STATIC_PAGES = L.code === 'bn' ? bnPages({ cfg, esc, href, mail, AUTHOR, count: CALCULATORS.length, siteUpdated: SITE_UPDATED, fmtDate, cats: catsL, inCat: inCatL }) : {
    about: {
      title: `About ${cfg.name}`,
      description: `Who builds ${cfg.name}, how our ${CALCULATORS.length} free calculators are tested and reviewed, and how we keep your data private.`,
      body: `<p>${esc(cfg.name)} is a free collection of ${CALCULATORS.length} online calculators covering finance, health, math, unit conversion, Bangladesh-specific tax and savings, and everyday life. It is written and maintained by the ${esc(AUTHOR)}. Every page is also available in <a href="${BASE}bn/about/" hreflang="bn" lang="bn">Bangla (বাংলা)</a>.</p>
      <h2>Why we built it</h2><p>Most calculator sites are slow, cluttered and make you press "Calculate" again and again. Ours update instantly, work on any phone, support dark mode and many currencies (including ৳ BDT and ₹ INR), and can be installed to work offline.</p>
      <h2>Accuracy and review</h2><p>Every formula is documented on its calculator page, references the standard or official source it comes from, and is covered by automated tests that check results against worked examples. Tax, tariff and legal rates state the fiscal year they apply to and are re-checked when budgets or notifications change. Read our <a href="${href('about/editorial/')}">editorial policy</a> for details.</p>
      <h2>Privacy</h2><p>All calculations happen in your browser. We never receive the numbers you enter. See our <a href="${href('privacy/')}">Privacy Policy</a> and <a href="${href('privacy/')}#cookies">Cookie Policy</a>.</p>
      <h2>How the site is funded</h2><p>${esc(cfg.name)} is free to use and supported by advertising. Ads are clearly labelled and kept separate from calculator inputs and results; advertisers have no influence on our content.</p>
      <h2>Contact</h2><p>Suggestions or corrections are always welcome: ${mail} or use our <a href="${href('about/contact/')}">contact page</a>.</p>`,
    },
    'about/editorial': {
      title: 'Editorial Policy & Methodology',
      description: `How ${cfg.name} researches, tests, sources and updates its calculators — formulas, official rates, review process and corrections.`,
      trail: [{ name: 'Home', path: '' }, { name: 'About', path: 'about/' }, { name: 'Editorial policy', path: 'about/editorial/' }],
      body: `<p>Last reviewed: <time datetime="${SITE_UPDATED}">${fmtDate(SITE_UPDATED)}</time></p>
      <p>Our goal is simple: every number ${esc(cfg.name)} shows should be one you could reproduce by hand from a cited formula or an official rate.</p>
      <h2>Formulas</h2><p>We use standard, widely published methods — for example the amortization formula used by lenders, the Mifflin–St Jeor equation for energy needs, WHO BMI categories and the U.S. Navy body-fat equations. Each calculator's "How it works" section names the formula and its limitations.</p>
      <h2>Official rates and the fiscal year</h2><p>Where results depend on law or regulation (income tax slabs, savings-certificate profit rates, electricity tariffs, pension rules), we take rates from the primary source — such as the National Board of Revenue, the Finance Division, the Department of National Savings, Bangladesh Bank or BERC — and state the fiscal year they apply to on the page. When a new budget or notification is published we update the calculator and its "last updated" date.</p>
      <h2>Translations</h2><p>The Bangla edition is translated by the same team into standard Bangla (প্রমিত বাংলা). Calculations are identical in both languages; technical terms keep their English name in brackets where that helps recognition.</p>
      <h2>Testing</h2><p>Every calculator is covered by automated tests that compare its output with worked examples, edge cases and published reference values. Tests run before every release.</p>
      <h2>Review</h2><p>Changes are reviewed by the ${esc(AUTHOR)} before publication. Each page shows the date it was last updated.</p>
      <h2>Corrections</h2><p>If you believe a result is wrong or a rate is out of date, please <a href="${href('about/contact/')}">contact us</a> with the inputs you used. We investigate every report and correct confirmed errors promptly.</p>
      <h2>Independence</h2><p>The site is funded by advertising. Advertisers do not influence our content, and ads are always labelled and placed apart from calculator inputs and results.</p>
      <h2>Limitations</h2><p>Results are estimates for general information. They are not financial, tax, legal or medical advice — consult a qualified professional before acting.</p>`,
    },
    'about/contact': {
      title: `Contact ${cfg.name}`,
      description: `Contact the ${cfg.name} team: report a calculation error, suggest a new calculator, or ask about advertising and privacy.`,
      trail: [{ name: 'Home', path: '' }, { name: 'About', path: 'about/' }, { name: 'Contact', path: 'about/contact/' }],
      body: `<p>We'd love to hear from you. ${cfg.contactEmail ? `Email us at ${mail} — we usually reply within two business days.` : ''}</p>
      <h2>What can we help with?</h2><ul>
        <li><b>Report an error</b> — tell us which calculator, the inputs you used and the result you expected.</li>
        <li><b>Suggest a calculator</b> — what would you like to calculate?</li>
        <li><b>Privacy requests</b> — questions about data, cookies or advertising choices.</li>
        <li><b>Business and advertising</b> enquiries.</li></ul>
      ${contactForm({ topic: 'Topic', topicPh: 'e.g. Error in the mortgage calculator', message: 'Message', messagePh: 'Your message', button: 'Open in your email app', note: 'This form opens your own email app — nothing is sent to us until you press send there.' })}
      ${cfg.address ? `<h2>Postal address</h2><p>${esc(cfg.address)}</p>` : ''}
      <p>Please don't send personal financial or medical details — our calculators never need them.</p>`,
    },
    'about/sitemap': {
      title: 'All Calculators (Sitemap)',
      description: `A complete list of all ${CALCULATORS.length} free calculators on ${cfg.name}, organised by category.`,
      trail: [{ name: 'Home', path: '' }, { name: 'Sitemap', path: 'about/sitemap/' }],
      body: `<p>Every calculator on ${esc(cfg.name)}, grouped by category. <a href="${BASE}bn/about/sitemap/" hreflang="bn" lang="bn">বাংলা সাইটম্যাপ</a>.</p><div class="sitemap-cols">${catsL.map((cat) => `<section><h2><a href="${catUrl(cat)}">${cat.icon} ${esc(cat.name)}</a></h2><ul>${inCatL(cat.id).map((c) => `<li><a href="${href(`${c.id}/`)}">${esc(c.name)}</a></li>`).join('')}</ul></section>`).join('')}
      <section><h2>About ${esc(cfg.name)}</h2><ul><li><a href="${href('about/')}">About us</a></li><li><a href="${href('about/editorial/')}">Editorial policy</a></li><li><a href="${href('about/contact/')}">Contact</a></li><li><a href="${href('privacy/')}">Privacy Policy</a></li><li><a href="${href('privacy/')}#cookies">Cookie Policy</a></li><li><a href="${href('terms/')}">Terms of Use</a></li></ul></section></div>`,
    },
    privacy: {
      title: 'Privacy & Cookie Policy',
      description: `How ${cfg.name} handles your data and cookies: calculations stay in your browser; ads by Google AdSense; your consent choices.`,
      body: `<p>Last updated: <time datetime="${SITE_UPDATED}">${fmtDate(SITE_UPDATED)}</time></p>
      <h2>Information you enter</h2><p>Calculator inputs are processed entirely in your browser and are not sent to our servers. Your preferences (theme, currency, number style, saved and recent calculators) are stored locally on your device using localStorage.</p>
      <h2>Advertising</h2><p>We use Google AdSense to display ads. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and/or other sites on the Internet.</p>
      <p>You may opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" rel="nofollow noopener">Google Ads Settings</a> or <a href="https://www.aboutads.info/choices/" rel="nofollow noopener">aboutads.info</a>. Learn more in <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener">How Google uses information from sites that use its services</a>.</p>
      <h2 id="cookies">Cookie policy</h2>
      <p>Cookies are small files a website stores on your device. Similar technologies include localStorage. We use them as follows:</p>
      <div class="table-scroll"><table><thead><tr><th>Type</th><th>Set by</th><th>Purpose</th><th>Can you refuse?</th></tr></thead><tbody>
        <tr><td>Strictly necessary (localStorage)</td><td>${esc(cfg.name)}</td><td>Remember your theme, currency, number style, saved/recent calculators and your cookie choice</td><td>Not needed for consent; clear them in your browser at any time</td></tr>
        <tr><td>Advertising</td><td>Google and its partners</td><td>Show, measure and (with consent) personalise ads; limit how often you see an ad; detect fraud</td><td>Yes — choose "Reject" for non-personalised ads</td></tr>
        ${cfg.googleAnalyticsId ? '<tr><td>Analytics</td><td>Google Analytics</td><td>Aggregated statistics about which pages are used</td><td>Yes — via your browser or the opt-out add-on</td></tr>' : ''}
      </tbody></table></div>
      <p>${cfg.useGoogleCMP ? 'Visitors in the EEA, UK and Switzerland are asked for consent through Google\'s certified consent management platform.' : 'When you first visit, a banner asks whether you accept personalised ads. If you choose "Reject", only non-personalised ads are shown (these still use cookies for frequency capping, aggregated reporting and fraud prevention).'} You can change your choice at any time via <a href="#" data-reset-consent>Cookie settings</a>, and you can block or delete cookies in your browser settings.</p>
      <h2>Analytics</h2><p>We may use privacy-respecting analytics (such as Google Analytics) to understand which calculators are used, so we can improve them. This data is aggregated and does not include your calculator inputs.</p>
      <h2>Your rights</h2><p>Depending on where you live (for example under the GDPR or CCPA) you may have rights to access, correct or delete personal data and to object to its processing. Because we don't collect your calculator inputs, most requests concern advertising cookies, which you can control as described above. For anything else, contact us.</p>
      <h2>Children</h2><p>This site is not directed to children under 13 and we do not knowingly collect their personal information.</p>
      <h2>Contact</h2><p>Questions about this policy: ${mail}${cfg.contactEmail ? ` or our <a href="${href('about/contact/')}">contact page</a>` : ''}.</p>`,
    },
    terms: {
      title: 'Terms of Use',
      description: `The terms that apply when you use ${cfg.name}'s free online calculators, including disclaimers and acceptable use.`,
      body: `<p>Last updated: <time datetime="${SITE_UPDATED}">${fmtDate(SITE_UPDATED)}</time></p><p>By using ${esc(cfg.name)} you agree to these terms.</p>
      <h2>No professional advice</h2><p>All calculators are provided "as is" for educational and informational purposes. Results are estimates and may not reflect your actual situation. Consult a qualified professional before making financial, medical, legal or tax decisions.</p>
      <h2>No warranty</h2><p>We work hard to keep every formula accurate, but we make no warranty regarding accuracy, completeness or fitness for a particular purpose and accept no liability for decisions made using this site.</p>
      <h2>Acceptable use</h2><p>Do not attempt to disrupt the site, scrape it at scale, or interfere with advertisements.</p>
      <h2>Contact</h2><p>Questions about these terms: <a href="${href('about/contact/')}">contact us</a>.</p>`,
    },
  };

  /** Emits every page of this language. */
  async function emitAll() {
    const bn = L.code === 'bn';
    const homeTitle = bn
      ? [`বিনামূল্যের অনলাইন ক্যালকুলেটর – দ্রুত ও গোপনীয় | ${cfg.name}`, `বিনামূল্যের অনলাইন ক্যালকুলেটর | ${cfg.name}`].find((x) => x.length <= 60)
      : [`Free Online Calculators – Fast & Private | ${cfg.name}`, `Free Online Calculators | ${cfg.name}`].find((x) => x.length <= 60);
    const homeDesc = bn
      ? clamp(`${CALCULATORS.length}টি বিনামূল্যের ক্যালকুলেটর: আয়কর, সঞ্চয়পত্র, এফডিআর, ডিপিএস, ইএমআই, স্বর্ণের দাম, বিদ্যুৎ বিল, বিএমআই, শতাংশ ও আরও অনেক। তাৎক্ষণিক, গোপনীয়, মোবাইল-বান্ধব।`, 155)
      : clamp(`${CALCULATORS.length} free online calculators: mortgage, loan, EMI, BMI, calorie, percentage, scientific, age, unit converter and more. Instant, private, mobile-friendly.`, 155);
    await emit(L.prefix, page({
      title: homeTitle, description: homeDesc, path: '', pageKind: 'home', main: homeMain(),
      jsonLd: { '@context': 'https://schema.org', '@graph': [org, { '@type': 'WebSite', '@id': `${labs()}#website`, name: cfg.name, url: labs(), inLanguage: L.htmlLang, publisher: { '@id': `${abs()}#org` }, potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${labs()}?q={query}` }, 'query-input': 'required name=query' } }] },
    }));
    for (const c of CALCULATORS) await emit(`${L.prefix}${c.id}`, calcPage(c));
    for (const cat of CATEGORIES) await emit(`${L.prefix}category/${cat.id}`, categoryPage(cat));
    for (const [slug, p] of Object.entries(STATIC_PAGES)) {
      const ti = `${p.title} | ${cfg.name}`;
      const trail = p.trail || [{ name: t('Home'), path: '' }, { name: p.title, path: `${slug}/` }];
      await emit(`${L.prefix}${slug}`, page({
        title: ti.length <= 60 ? ti : p.title, description: clamp(p.description, 155), path: `${slug}/`, main: prose(p.title, p.body, trail),
        jsonLd: { '@context': 'https://schema.org', '@graph': [org, { '@type': slug.endsWith('contact') ? 'ContactPage' : slug === 'about' ? 'AboutPage' : 'WebPage', url: labs(`${slug}/`), name: L.digits(p.title), inLanguage: L.htmlLang, dateModified: SITE_UPDATED, breadcrumb: breadcrumbs(trail).ld, publisher: { '@id': `${abs()}#org` } }] },
      }));
    }
    return Object.keys(STATIC_PAGES);
  }

  function contactForm(x) {
    if (!cfg.contactEmail) return '';
    return `<form class="contact-form" id="contact-form" action="mailto:${esc(cfg.contactEmail)}" method="post" enctype="text/plain">
        <label>${x.topic}<input name="subject" required maxlength="120" placeholder="${esc(x.topicPh)}"></label>
        <label>${x.message}<textarea name="body" required maxlength="4000" placeholder="${esc(x.messagePh)}"></textarea></label>
        <button class="btn primary" type="submit">${x.button}</button>
        <p class="byline">${x.note}</p>
      </form>
      <script>document.getElementById('contact-form').addEventListener('submit',function(e){e.preventDefault();var f=e.target;location.href='mailto:${esc(cfg.contactEmail)}?subject='+encodeURIComponent(f.subject.value)+'&body='+encodeURIComponent(f.body.value)});</script>`;
  }

  return { page, prose, emitAll, href };
}

const EMITTED = [];
async function emit(path, html) {
  const file = join(DIST, path, path.endsWith('.html') ? '' : 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
  EMITTED.push(file);
}

// ── Validation: each page needs one h1, a canonical, a meta description and parseable JSON-LD. ──
async function validate() {
  const problems = [];
  for (const file of EMITTED) {
    const html = await readFile(file, 'utf8');
    const rel = file.slice(DIST.length + 1).split(sep).join('/');
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) problems.push(`${rel}: ${h1} <h1> elements`);
    if ((html.match(/<link rel="canonical" href="[^"]+">/g) || []).length !== 1) problems.push(`${rel}: canonical missing or duplicated`);
    const desc = html.match(/<meta name="description" content="([^"]*)">/);
    if (!desc || !desc[1].trim()) problems.push(`${rel}: meta description missing`);
    else if (desc[1].replace(/&\w+;/g, '_').length > 160) problems.push(`${rel}: meta description too long (${desc[1].length})`);
    const title = html.match(/<title>([^<]*)<\/title>/);
    if (!title || title[1].replace(/&\w+;/g, '_').length > 60) problems.push(`${rel}: title missing or > 60 chars`);
    if (/\{\{[\w:]+[^}]*\}\}/.test(html)) problems.push(`${rel}: unreplaced template variable`);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { JSON.parse(m[1]); } catch (e) { problems.push(`${rel}: invalid JSON-LD (${e.message})`); }
    }
    if (rel.startsWith('bn/') && !/<html lang="bn">/.test(html)) problems.push(`${rel}: Bangla page without lang="bn"`);
  }
  return problems;
}

/**
 * Appends ?v=VERSION to every relative ES-module specifier (static and dynamic imports) in the copied
 * assets. app.js is already loaded with ?v=, so the whole module graph becomes immutable per build and a
 * returning visitor can never combine a new app.js with a stale engine.js from the HTTP cache.
 */
async function versionImports(dir) {
  const re = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"?#]+\.js)\2/g;
  for (const ent of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.js')) continue;
    const file = join(ent.parentPath || ent.path, ent.name);
    const src = await readFile(file, 'utf8');
    const out = src.replace(re, (m, kw, q, spec) => `${kw}${q}${spec}?v=${VERSION}${q}`);
    if (out !== src) await writeFile(file, out);
  }
}

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  const contentDir = join(ROOT, 'src', 'content');
  const i18nDir = join(ROOT, 'src', 'i18n');
  const skip = (p, d) => p === d || p.startsWith(d + sep);
  await cp(join(ROOT, 'src'), join(DIST, 'assets'), { recursive: true, filter: (p) => !p.endsWith('template.html') && !skip(p, contentDir) && !skip(p, i18nDir) });
  await cp(join(ROOT, 'static'), DIST, { recursive: true });
  await versionImports(join(DIST, 'assets'));
  // offline.html can be opened directly (not only through the service worker): fill in the base path now.
  const offline = join(DIST, 'offline.html');
  await writeFile(offline, (await readFile(offline, 'utf8')).replace(/%BASE%/g, BASE));

  // Client-side Bangla dictionary: UI + result strings + calculator names (no about/FAQ prose).
  await mkdir(join(DIST, 'assets', 'i18n'), { recursive: true });
  await writeFile(join(DIST, 'assets', 'i18n', 'bn-client.js'), `// Generated by scripts/build.mjs from src/i18n/bn.js — do not edit.\nexport default ${JSON.stringify(clientDict())};\n`);

  // Open Graph images (1200×630 PNG): one per calculator and category, plus a site default.
  await mkdir(join(DIST, 'og'), { recursive: true });
  const host = cfg.url.replace(/^https?:\/\//, '');
  const og = (name, o) => writeFile(join(DIST, 'og', `${name}.png`), ogImage({ site: cfg.name, footer: `Free · Instant · Private — ${host}`, ...o }));
  await og('default', { title: cfg.tagline.replace(/ — .*/, ''), kicker: `${CALCULATORS.length} free calculators` });
  for (const cat of CATEGORIES) await og(`category-${cat.id}`, { title: `${cat.name} Calculators`, kicker: `${inCat(cat.id).length} free calculators` });
  for (const c of CALCULATORS) {
    const cat = CATEGORIES.find((x) => x.id === c.cat);
    await og(c.id, { title: c.name, kicker: cat ? `${cat.name} calculators` : '' });
  }

  let staticSlugs = [];
  for (const L of LANG_LIST) {
    const slugs = await site(L).emitAll();
    if (L.code === 'en') staticSlugs = slugs;
  }

  const en = site(LANGS.en);
  await emit('404.html', en.page({
    title: `Page not found | ${cfg.name}`, description: 'Sorry, that page does not exist. Search our free calculators or browse by category.', path: '404.html', robots: 'noindex, follow', noAlternates: true,
    main: en.prose('Page not found', `<p>Sorry, that page doesn't exist. Try the search box above, go back to the <a href="${BASE}">home page</a> or browse <a href="${BASE}about/sitemap/">all calculators</a>.</p>
      <p lang="bn">দুঃখিত, পাতাটি খুঁজে পাওয়া যায়নি। <a href="${BASE}bn/">বাংলা প্রথম পাতায়</a> যান অথবা <a href="${BASE}bn/about/sitemap/">সব ক্যালকুলেটর</a> দেখুন।</p>
      <script>if (location.pathname.indexOf(${JSON.stringify(`${BASE}bn/`)}) === 0) location.replace(${JSON.stringify(`${BASE}bn/404.html`)});</script>`),
  }));
  // Bangla 404: static hosts (GitHub Pages) only serve the root 404.html, which forwards /bn/* misses here.
  const bnSite = site(LANGS.bn);
  await emit('bn/404.html', bnSite.page({
    title: `পাতাটি পাওয়া যায়নি | ${cfg.name}`, description: 'দুঃখিত, এই পাতাটি নেই। আমাদের বিনামূল্যের ক্যালকুলেটর খুঁজুন বা বিভাগ অনুযায়ী দেখুন।', path: '404.html', robots: 'noindex, follow', noAlternates: true,
    main: bnSite.prose('পাতাটি পাওয়া যায়নি', `<p>দুঃখিত, পাতাটি খুঁজে পাওয়া যায়নি। ওপরের সার্চ বক্স ব্যবহার করুন, <a href="${BASE}bn/">প্রথম পাতায়</a> ফিরে যান অথবা <a href="${BASE}bn/about/sitemap/">সব ক্যালকুলেটর</a> দেখুন।</p>
      <p lang="en">Sorry, that page doesn't exist. <a href="${BASE}">Go to the English home page</a>.</p>`),
  }));

  const paths = [
    ['', TODAY], ...CALCULATORS.map((c) => [`${c.id}/`, updatedFor(c.id), updatedForLang(LANGS.bn, c.id)]),
    ...CATEGORIES.map((cat) => [`category/${cat.id}/`, [...inCat(cat.id).map((c) => updatedFor(c.id)), SITE_UPDATED].sort().pop()]),
    ...staticSlugs.map((s) => [`${s}/`, SITE_UPDATED]),
  ];
  const alt = (u) => `\n    ${alternates(u).map((a) => `<xhtml:link rel="alternate" hreflang="${esc(a.lang)}" href="${esc(a.href)}"/>`).join('\n    ')}`;
  const entries = paths.flatMap(([u, d, dBn]) => LANG_LIST.map((L) => `  <url><loc>${abs(L.prefix + u)}</loc><lastmod>${L.code === 'bn' ? [dBn || d, BN_UPDATED].sort().pop() : d}</lastmod>${alt(u)}</url>`));
  await writeFile(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`);
  await writeFile(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
  if (cfg.adsenseClient) {
    await writeFile(join(DIST, 'ads.txt'), `google.com, ${cfg.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  }

  // Manifest + service worker get the base path and a fresh cache version.
  const manifest = JSON.parse(await readFile(join(ROOT, 'static/manifest.webmanifest'), 'utf8'));
  Object.assign(manifest, { name: cfg.name, short_name: cfg.name, start_url: BASE, scope: BASE, icons: manifest.icons.map((i) => ({ ...i, src: BASE + i.src.replace(/^\//, '') })) });
  await writeFile(join(DIST, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
  const sw = await readFile(join(ROOT, 'static/sw.js'), 'utf8');
  await writeFile(join(DIST, 'sw.js'), sw.replace('__VERSION__', VERSION).replace(/__BASE__/g, BASE));

  const problems = await validate();
  const missingFaq = CALCULATORS.filter((c) => !FAQ[c.id]).map((c) => c.id);
  if (missingFaq.length) console.warn(`No FAQ yet for: ${missingFaq.join(', ')}`);
  const missingBn = CALCULATORS.filter((c) => !BN.calc[c.id]?.about || !BN.calc[c.id]?.faq?.length).map((c) => c.id);
  if (missingBn.length) console.warn(`Bangla about/FAQ missing for: ${missingBn.join(', ')}`);
  if (problems.length) {
    console.warn(`SEO check: ${problems.length} problem(s)\n  ${problems.slice(0, 40).join('\n  ')}${problems.length > 40 ? `\n  … and ${problems.length - 40} more` : ''}`);
    if (process.env.SEO_STRICT) process.exitCode = 1;
  }
  console.log(`Built ${EMITTED.length} pages (${LANG_LIST.map((L) => L.code).join(' + ')}) into ${DIST.slice(ROOT.length + 1) || 'dist'}/ (base ${BASE}, ads ${cfg.adsenseClient ? 'ON' : clientConfig.showAdPlaceholders ? 'placeholders' : 'off (no client)'}, SEO check ${problems.length ? 'WARN' : 'OK'})`);
}

await build();
