const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const PORT = process.env.PORT || 8090; const DIR = require('path').resolve(__dirname, '..', process.env.DIST_DIR || 'dist'); const SHOTS = process.env.SHOTS || '/tmp/shots'; require('fs').mkdirSync(SHOTS, { recursive: true });
const ids = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`${p.url()}: ${m.text()}`); });
  const NON_CALC = ['about', 'privacy', 'terms', 'category', 'bn', 'og', 'assets'];
  const list = require('fs').readdirSync(DIR).filter((d) => require('fs').existsSync(`${DIR}/${d}/index.html`) && !NON_CALC.includes(d));
  // English pages, then the Bangla edition of every page under /bn/.
  for (const prefix of ['', 'bn/']) {
    for (const id of ['', ...list]) {
      await p.goto(`http://localhost:${PORT}/${prefix}${id ? id + '/' : ''}`);
      await p.waitForTimeout(150);
      if (id) {
        const txt = await p.locator('#calc-root').innerText({ timeout: 5000 }).catch(() => '');
        if (/⚠️/.test(txt) || txt.length < 20) errors.push(`${prefix}${id}: bad render: ${txt.slice(0, 120)}`);
      }
    }
  }
  await p.goto('http://localhost:' + PORT + '/'); await p.screenshot({ path: SHOTS + '/home.png', fullPage: false });
  await p.goto('http://localhost:' + PORT + '/mortgage/'); await p.waitForTimeout(200); await p.screenshot({ path: SHOTS + '/mortgage.png', fullPage: true });
  // interaction: change input, check URL & result updates
  await p.fill('#f-price', '500000'); await p.waitForTimeout(400);
  console.log('url after edit:', p.url(), '| primary:', await p.locator('#rp-value').innerText());
  await p.selectOption('#currency', 'BDT'); await p.waitForTimeout(100);
  console.log('BDT primary:', await p.locator('#rp-value').innerText());
  await p.goto('http://localhost:' + PORT + '/unit-converter/'); await p.selectOption('#f-cat', 'area'); await p.waitForTimeout(100);
  console.log('area conv:', await p.locator('#rp-value').innerText());
  await p.goto('http://localhost:' + PORT + '/bmi/'); await p.selectOption('#f-units', 'imperial'); await p.waitForTimeout(100);
  console.log('bmi imperial:', await p.locator('#rp-value').innerText());
  await p.goto('http://localhost:' + PORT + '/scientific/'); await p.waitForSelector('.sci-input'); await p.click('h1');
  await p.keyboard.type('2sin(30)+5!'); await p.keyboard.press('Enter');
  console.log('sci:', await p.locator('.sci-input').inputValue());
  await p.click('button[data-k="xʸ"]'); await p.click('button[data-k="2"]'); await p.click('button[data-k="="]');
  console.log('sci2:', await p.locator('.sci-input').inputValue());
  await p.screenshot({ path: SHOTS + '/scientific.png' });
  await p.goto('http://localhost:' + PORT + '/');
  await p.fill('.hero .search-box input', 'loan'); await p.waitForTimeout(100);
  console.log('search:', (await p.locator('.hero .search-results').innerText()).split('\n').slice(0, 3).join(' | '));
  // Bangla edition: language, translated results, Bangla numerals, Bangla digit input, switcher.
  await p.goto('http://localhost:' + PORT + '/bn/mortgage/'); await p.waitForTimeout(300);
  console.log('bn lang:', await p.evaluate(() => document.documentElement.lang), '| h1:', await p.locator('h1').innerText());
  console.log('bn primary:', await p.locator('.rp-label').innerText(), '=', await p.locator('#rp-value').innerText());
  await p.fill('#f-price', '৫০০০০০'); await p.waitForTimeout(400);
  console.log('bn after Bangla-digit edit:', p.url(), '|', await p.locator('#rp-value').innerText());
  await p.screenshot({ path: SHOTS + '/bn-mortgage.png', fullPage: true });
  await p.click('#digits-btn'); await p.waitForTimeout(200);
  console.log('bn digits off:', await p.locator('#rp-value').innerText());
  await p.click('#digits-btn'); await p.waitForTimeout(100);
  const sw2 = await p.locator('.lang-switch').getAttribute('href');
  console.log('lang switch href:', sw2);
  await p.goto('http://localhost:' + PORT + '/bn/'); await p.fill('.hero .search-box input', 'আয়কর'); await p.waitForTimeout(100);
  console.log('bn search:', (await p.locator('.hero .search-results').innerText()).split('\n').slice(0, 2).join(' | '));
  await p.screenshot({ path: SHOTS + '/bn-home.png' });
  await p.emulateMedia({ colorScheme: 'dark' });
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push(`mobile: ${e.message}`));
  await mp.goto('http://localhost:' + PORT + '/compound-interest/'); await mp.waitForTimeout(300);
  await mp.screenshot({ path: SHOTS + '/mobile-dark.png', fullPage: true });
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
  console.log('mobile scrollWidth', sw);
  await mp.goto('http://localhost:' + PORT + '/bn/mortgage/'); await mp.waitForTimeout(400);
  await mp.screenshot({ path: SHOTS + '/bn-mortgage-mobile.png', fullPage: true });
  console.log('bn mobile scrollWidth', await mp.evaluate(() => document.documentElement.scrollWidth));
  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await b.close();
})();
