# CalcHub — fast, private, ad-supported calculator website

A modern alternative to calculator.net: **81 calculators** in **English and Bangla (বাংলা)**, instant results as you type, dark mode,
multi-currency (incl. ৳ BDT / ₹ INR with lakh grouping), shareable result links, offline/PWA support,
and Google AdSense monetization built in. Zero runtime dependencies — plain HTML, CSS and ES modules.

## What makes it better than calculator.net

| | calculator.net | CalcHub |
|---|---|---|
| Results | Press "Calculate", page reloads | Live, updates as you type |
| Mobile | Desktop-first layout | Mobile-first, installable app (PWA) |
| Dark mode | No | Yes (auto + toggle) |
| Share a result | No | Every input is in the URL — copy & share |
| Currency | USD only | 11 currencies, ৳ / ₹ lakh formatting |
| Local units | — | Katha, bigha, decimal, tola, maund; Zakat & EMI calculators |
| Language | English only | English + full Bangla edition under `/bn/` (Bangla numerals toggle) |
| Search | Basic | Instant search, `/` shortcut, keyboard navigation |
| Extras | — | Favourites, recent calculators, charts, copy/print results, offline |

## Calculators

- **Financial (28):** mortgage, loan, EMI, auto loan, compound interest, simple interest, retirement, savings goal, ROI, inflation, salary, discount, tip, VAT/sales tax, credit-card payoff, profit margin, break-even, Zakat, investment, SIP, CAGR, depreciation, rent vs buy, debt-to-income, net worth, NPV/IRR, interest rate, house affordability
- **Bangladesh (8):** income tax, Sanchayapatra, FDR, DPS, gold price (vori), electricity bill (BERC), government pension & gratuity, GPF
- **Health (11):** BMI, calorie (TDEE), BMR, body fat, ideal weight, pace, pregnancy due date, heart-rate zones, sleep, macro, ovulation
- **Math (16):** scientific calculator, percentage, fraction, quadratic, statistics, GCF/LCM, prime, random number, right triangle, area & volume, logarithm, scientific notation, significant figures, ratio, weighted average, percent error
- **Converters (3):** unit converter, number base, Roman numerals
- **Everyday (15):** age, date difference, add to date, time duration, GPA, fuel cost, electricity cost, password generator, day of the week, days until, time card, concrete, tile, square footage, final grade

Adding a calculator = adding one object to a file in `src/calculators/` (inputs + `compute()` + explanation). Pages, SEO, sitemap and search pick it up automatically.

## Bangla (বাংলা) edition

Every page is also built under `/bn/` (e.g. `/bn/mortgage/`) with `hreflang` alternates (en, bn, x-default), a language
switcher in the header and both languages in `sitemap.xml`. Calculator logic is shared: `compute()` returns English labels and
the engine translates them through `src/i18n.js` (exact → number template → pattern → word-by-word, English fallback).

- Translations live in `src/i18n/bn.js` (UI, categories) and `src/i18n/bn/*.js` (per calculator: name, desc, keywords, SEO title,
  about, FAQ, and every result/input string); static pages are in `src/i18n/bn-pages.js`.
- `node scripts/i18n-harvest.mjs` runs every calculator over many inputs and reports strings still missing a translation
  (`--missing` prints them); `test/i18n.test.mjs` fails if any are missing.
- Bangla pages show Bangla numerals (০-৯) for display, with a toggle; inputs accept Bangla and English digits.
  Font: Noto Sans Bengali (Google Fonts, `display=swap`) with system fallbacks.

## Run locally

```bash
npm test        # formula tests
npm run dev     # build + serve at http://localhost:8080
```

## Earning money with ads (AdSense)

1. Deploy the site on your own domain (a custom domain is strongly recommended for AdSense approval).
2. Edit `site.config.json`: set `url`, `contactEmail`, and `adsenseClient` (`ca-pub-XXXXXXXXXXXXXXXX`).
3. Optional: create display ad units in AdSense and put their slot ids in `adSlots.top`, `adSlots.inContent`, `adSlots.sidebar`.
   Without slot ids, the boxes collapse and AdSense **Auto ads** fill the page instead.
4. `npm run build` — this also generates `ads.txt`, `sitemap.xml`, `robots.txt`, privacy & terms pages (required by AdSense).
5. For visitors from the EEA/UK, enable AdSense › *Privacy & messaging* (Google's certified CMP) and set `"useGoogleCMP": true`.
   Otherwise the built-in banner asks for consent and serves non-personalised ads to visitors who decline.
6. Submit `sitemap.xml` in Google Search Console.

Ad placements: top leaderboard, in-content (below results), sticky sidebar (desktop). Ad space is reserved to avoid layout shift.

## Deploy

- **GitHub Pages:** the included workflow tests, builds and deploys on every push to `main`
  (enable Pages › Source: *GitHub Actions*). Set repo variables `SITE_URL`, `BASE_PATH` (`/` for a custom domain) and `ADSENSE_CLIENT`.
- **Netlify / Vercel / Cloudflare Pages:** build command `npm run build`, output directory `dist`.

## Project structure

```
src/calculators/*.js   calculator definitions (pure, tested)
src/engine.js          renders inputs/results/charts from a definition
src/expr.js            safe expression parser for the scientific calculator (no eval)
src/ads.js             AdSense loader + consent
scripts/build.mjs      static site generator (one SEO page per calculator, English + /bn/)
src/i18n.js, src/i18n/ Bangla translations and lookup
test/                  node:test suite
```
