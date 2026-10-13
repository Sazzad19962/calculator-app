// Static site generator: one pre-rendered, SEO-friendly HTML page per calculator.
// Usage: node scripts/build.mjs   (env overrides: SITE_URL, BASE_PATH, ADSENSE_CLIENT)
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CALCULATORS, CATEGORIES } from '../src/registry.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const cfg = JSON.parse(await readFile(join(ROOT, 'site.config.json'), 'utf8'));
if (process.env.SITE_URL) cfg.url = process.env.SITE_URL;
if (process.env.BASE_PATH) cfg.basePath = process.env.BASE_PATH;
if (process.env.ADSENSE_CLIENT) cfg.adsenseClient = process.env.ADSENSE_CLIENT;
cfg.basePath = `/${cfg.basePath.replace(/^\/|\/$/g, '')}/`.replace('//', '/');
cfg.url = cfg.url.replace(/\/$/, '');

const BASE = cfg.basePath;
const abs = (path = '') => `${cfg.url}${BASE}${path}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const template = await readFile(join(ROOT, 'src/template.html'), 'utf8');
const VERSION = createHash('sha1').update(template + JSON.stringify(cfg) + Date.now()).digest('hex').slice(0, 8);

const clientConfig = {
  name: cfg.name, basePath: BASE, currency: cfg.currency || '', adsenseClient: cfg.adsenseClient || '',
  adSlots: cfg.adSlots || {}, useGoogleCMP: Boolean(cfg.useGoogleCMP), showAdPlaceholders: cfg.showAdPlaceholders !== false,
};

function headExtra(jsonLd) {
  let h = '';
  if (cfg.adsenseClient) h += `<meta name="google-adsense-account" content="${esc(cfg.adsenseClient)}">\n<link rel="preconnect" href="https://pagead2.googlesyndication.com" crossorigin>\n`;
  if (cfg.googleAnalyticsId) {
    h += `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.googleAnalyticsId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.googleAnalyticsId)}');</script>\n`;
  }
  if (jsonLd) h += `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`;
  return h;
}

const card = (c) => `<li><a class="calc-card" href="${BASE}${c.id}/"><span class="ico">${c.icon}</span><span><b>${esc(c.name)}</b><small>${esc(c.desc)}</small></span></a></li>`;
const POPULAR = ['mortgage', 'loan', 'bmi', 'scientific', 'percentage', 'age', 'compound-interest', 'calorie', 'unit-converter', 'emi'];

function sidebar() {
  const pop = POPULAR.map((id) => CALCULATORS.find((c) => c.id === id)).filter(Boolean);
  return `<div class="card side-list"><h3>Popular calculators</h3><ul>${pop.map((c) => `<li><a href="${BASE}${c.id}/"><span>${c.icon}</span>${esc(c.name)}</a></li>`).join('')}</ul></div>
    <div class="sticky"><div class="ad-slot ad-sidebar" data-slot="sidebar" aria-label="Advertisement"></div></div>`;
}

function footer() {
  const year = new Date().getFullYear();
  const col = (cat) => `<div><h4>${cat.name}</h4><ul>${CALCULATORS.filter((c) => c.cat === cat.id).slice(0, 6).map((c) => `<li><a href="${BASE}${c.id}/">${esc(c.name)}</a></li>`).join('')}</ul></div>`;
  return `<div class="footer-inner">
    <div><h4>${esc(cfg.name)}</h4><p>${esc(cfg.tagline)}. All calculations run in your browser — your numbers never leave your device.</p>
      <ul><li><a href="${BASE}about/">About</a></li><li><a href="${BASE}privacy/">Privacy Policy</a></li><li><a href="${BASE}terms/">Terms of Use</a></li><li><a href="#" data-reset-consent>Cookie settings</a></li></ul></div>
    ${CATEGORIES.slice(0, 3).map(col).join('')}
  </div><div class="copyright">© ${year} ${esc(cfg.name)}. Results are estimates for informational purposes only and are not financial, medical or legal advice.</div>`;
}

function page({ title, description, path, main, page = 'page', calcId = '', jsonLd }) {
  const vars = {
    TITLE: esc(title), DESCRIPTION: esc(description), CANONICAL: abs(path), SITE_NAME: esc(cfg.name), BASE, VERSION,
    CONFIG_JSON: JSON.stringify(clientConfig).replace(/</g, '\\u003c'), HEAD_EXTRA: headExtra(jsonLd), PAGE: page, CALC_ID: calcId,
    MAIN: main, SIDEBAR: sidebar(), FOOTER: footer(), COUNT: String(CALCULATORS.length),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

async function emit(path, html) {
  const file = join(DIST, path, path.endsWith('.html') ? '' : 'index.html');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
}

function homeMain() {
  const chips = ['mortgage', 'bmi', 'percentage', 'age', 'emi', 'scientific', 'unit-converter', 'zakat'].map((id) => CALCULATORS.find((c) => c.id === id)).filter(Boolean);
  const cats = CATEGORIES.map((cat, i) => {
    const list = CALCULATORS.filter((c) => c.cat === cat.id);
    return `<section class="cat-section" id="cat-${cat.id}"><h2><span class="ico">${cat.icon}</span>${esc(cat.name)} calculators</h2><p>${esc(cat.desc)}</p>
      <ul class="card-grid">${list.map(card).join('')}</ul></section>${i === 1 ? '<div class="ad-slot ad-incontent" data-slot="inContent" aria-label="Advertisement"></div>' : ''}`;
  }).join('\n');
  return `<section class="hero">
      <h1>${esc(cfg.tagline)}</h1>
      <p>${CALCULATORS.length} beautifully simple calculators for money, health, math and everyday life. Instant results, no sign-up, works offline.</p>
      <div class="search-box big" role="search"><input type="search" placeholder="What do you want to calculate?" aria-label="Search calculators" autocomplete="off"><ul class="search-results" role="listbox" hidden></ul></div>
      <div class="chips">${chips.map((c) => `<a href="${BASE}${c.id}/">${c.icon} ${esc(c.name.replace(/ Calculator$/, ''))}</a>`).join('')}</div>
    </section>
    <div class="features">
      <div class="card"><b>⚡ Instant</b>Results update as you type</div>
      <div class="card"><b>🔒 Private</b>Everything runs on your device</div>
      <div class="card"><b>🔗 Shareable</b>Every result has its own link</div>
      <div class="card"><b>🌙 Dark mode & offline</b>Install it like an app</div>
    </div>
    <section class="cat-section" id="favs-section" hidden><h2><span class="ico">★</span>Your saved calculators</h2><ul class="card-grid"></ul></section>
    <section class="cat-section" id="recent-section" hidden><h2><span class="ico">🕘</span>Recently used</h2><ul class="card-grid"></ul></section>
    ${cats}`;
}

function calcMain(c) {
  const cat = CATEGORIES.find((x) => x.id === c.cat);
  const related = CALCULATORS.filter((x) => x.cat === c.cat && x.id !== c.id).slice(0, 6);
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="${BASE}">Home</a> › <a href="${BASE}#cat-${cat.id}">${esc(cat.name)}</a> › ${esc(c.name)}</nav>
    <div class="calc-head"><h1>${esc(c.name)}</h1><button class="btn small" id="fav-btn" type="button" aria-pressed="false">☆ Save</button></div>
    <p class="lead">${esc(c.desc)}</p>
    <div id="calc-root"><noscript><div class="card about">Please enable JavaScript to use this calculator.</div></noscript></div>
    <div class="ad-slot ad-incontent" data-slot="inContent" aria-label="Advertisement"></div>
    <section class="card about"><h2>How the ${esc(c.name.replace(/ Calculator$/, '').toLowerCase())} calculator works</h2>${c.about || ''}</section>
    <section class="related"><h2>Related calculators</h2><ul class="card-grid">${related.map(card).join('')}</ul></section>`;
}

const prose = (title, body) => `<article class="card prose"><h1>${title}</h1>${body}</article>`;

const STATIC_PAGES = {
  about: {
    title: `About ${cfg.name}`,
    body: `<p>${esc(cfg.name)} is a free collection of ${CALCULATORS.length} online calculators covering finance, health, math, unit conversion and everyday life.</p>
      <h2>Why we built it</h2><p>Most calculator sites are slow, cluttered and make you press "Calculate" again and again. Ours update instantly, work on any phone, support dark mode and many currencies (including ৳ BDT and ₹ INR), and can be installed to work offline.</p>
      <h2>Accuracy</h2><p>Every formula is documented on its calculator page and covered by automated tests. Results are estimates for information only and should not replace professional financial, medical or legal advice.</p>
      <h2>Privacy</h2><p>All calculations happen in your browser. We never receive the numbers you enter.</p>
      <h2>Contact</h2><p>Suggestions or corrections: <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></p>`,
  },
  privacy: {
    title: 'Privacy Policy',
    body: `<p>Last updated: ${new Date().toISOString().slice(0, 10)}</p>
      <h2>Information you enter</h2><p>Calculator inputs are processed entirely in your browser and are not sent to our servers. Your preferences (theme, currency, saved and recent calculators) are stored locally on your device using localStorage.</p>
      <h2>Advertising</h2><p>We use Google AdSense to display ads. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies enables it and its partners to serve ads based on your visits to this site and/or other sites on the Internet.</p>
      <p>You may opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" rel="nofollow noopener">Google Ads Settings</a> or <a href="https://www.aboutads.info/choices/" rel="nofollow noopener">aboutads.info</a>. Learn more in <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener">How Google uses information from sites that use its services</a>.</p>
      <p>You can change your cookie choice at any time via <a href="#" data-reset-consent>Cookie settings</a>.</p>
      <h2>Analytics</h2><p>We may use privacy-respecting analytics (such as Google Analytics) to understand which calculators are used, so we can improve them. This data is aggregated and does not include your calculator inputs.</p>
      <h2>Children</h2><p>This site is not directed to children under 13 and we do not knowingly collect their personal information.</p>
      <h2>Contact</h2><p>Questions about this policy: <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></p>`,
  },
  terms: {
    title: 'Terms of Use',
    body: `<p>By using ${esc(cfg.name)} you agree to these terms.</p>
      <h2>No professional advice</h2><p>All calculators are provided "as is" for educational and informational purposes. Results are estimates and may not reflect your actual situation. Consult a qualified professional before making financial, medical, legal or tax decisions.</p>
      <h2>No warranty</h2><p>We work hard to keep every formula accurate, but we make no warranty regarding accuracy, completeness or fitness for a particular purpose and accept no liability for decisions made using this site.</p>
      <h2>Acceptable use</h2><p>Do not attempt to disrupt the site, scrape it at scale, or interfere with advertisements.</p>`,
  },
};

async function build() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await cp(join(ROOT, 'src'), join(DIST, 'assets'), { recursive: true, filter: (p) => !p.endsWith('template.html') });
  await cp(join(ROOT, 'static'), DIST, { recursive: true });

  const org = { '@type': 'Organization', name: cfg.name, url: abs() };
  await emit('', page({
    title: `${cfg.name} — ${cfg.tagline}`,
    description: `${CALCULATORS.length} free online calculators: mortgage, loan, EMI, BMI, calorie, percentage, scientific, age, unit converter and more. Instant, private, mobile-friendly.`,
    path: '', page: 'home', main: homeMain(),
    jsonLd: { '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.name, url: abs(), publisher: org, potentialAction: { '@type': 'SearchAction', target: `${abs()}?q={query}`, 'query-input': 'required name=query' } },
  }));

  for (const c of CALCULATORS) {
    const cat = CATEGORIES.find((x) => x.id === c.cat);
    await emit(c.id, page({
      title: `${c.name} — Free & Instant | ${cfg.name}`,
      description: c.desc,
      path: `${c.id}/`, page: 'calc', calcId: c.id, main: calcMain(c),
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebApplication', name: c.name, description: c.desc, url: abs(`${c.id}/`), applicationCategory: c.cat === 'finance' ? 'FinanceApplication' : c.cat === 'health' ? 'HealthApplication' : 'UtilitiesApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
          { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: abs() }, { '@type': 'ListItem', position: 2, name: cat.name, item: `${abs()}#cat-${cat.id}` }, { '@type': 'ListItem', position: 3, name: c.name, item: abs(`${c.id}/`) }] },
        ],
      },
    }));
  }

  for (const [slug, p] of Object.entries(STATIC_PAGES)) {
    await emit(slug, page({ title: `${p.title} | ${cfg.name}`, description: `${p.title} for ${cfg.name}.`, path: `${slug}/`, main: prose(p.title, p.body) }));
  }
  await emit('404.html', page({ title: `Page not found | ${cfg.name}`, description: 'Page not found', path: '404.html', main: prose('Page not found', `<p>Sorry, that page doesn't exist. Try the search box above or go back to the <a href="${BASE}">home page</a>.</p>`) }));

  const urls = ['', ...CALCULATORS.map((c) => `${c.id}/`), ...Object.keys(STATIC_PAGES).map((s) => `${s}/`)];
  const today = new Date().toISOString().slice(0, 10);
  await writeFile(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${abs(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  await writeFile(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
  if (cfg.adsenseClient) {
    await writeFile(join(DIST, 'ads.txt'), `google.com, ${cfg.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  }

  // Manifest + service worker get the base path and a fresh cache version.
  const manifest = JSON.parse(await readFile(join(ROOT, 'static/manifest.webmanifest'), 'utf8'));
  Object.assign(manifest, { name: cfg.name, short_name: cfg.name, start_url: BASE, scope: BASE, icons: manifest.icons.map((i) => ({ ...i, src: BASE + i.src })) });
  await writeFile(join(DIST, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
  const sw = await readFile(join(ROOT, 'static/sw.js'), 'utf8');
  await writeFile(join(DIST, 'sw.js'), sw.replace('__VERSION__', VERSION).replace(/__BASE__/g, BASE));

  console.log(`Built ${urls.length} pages into dist/ (base ${BASE}, ads ${cfg.adsenseClient ? 'ON' : 'placeholders'})`);
}

await build();
