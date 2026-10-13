# CalcHub — fast, private, ad-supported calculator website

A modern alternative to calculator.net: **47 calculators**, instant results as you type, dark mode,
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
| Search | Basic | Instant search, `/` shortcut, keyboard navigation |
| Extras | — | Favourites, recent calculators, charts, copy/print results, offline |

## Calculators

- **Financial (18):** mortgage, loan, EMI, auto loan, compound interest, simple interest, retirement, savings goal, ROI, inflation, salary, discount, tip, VAT/sales tax, credit-card payoff, profit margin, break-even, Zakat
- **Health (8):** BMI, calorie (TDEE), BMR, body fat, ideal weight, pace, pregnancy due date, heart-rate zones
- **Math (10):** scientific calculator, percentage, fraction, quadratic, statistics, GCF/LCM, prime, random number, right triangle, area & volume
- **Converters (3):** unit converter (10 categories), number base, Roman numerals
- **Everyday (8):** age, date difference, add to date, time duration, GPA, fuel cost, electricity cost, password generator

Adding a calculator = adding one object to a file in `src/calculators/` (inputs + `compute()` + explanation). Pages, SEO, sitemap and search pick it up automatically.

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
scripts/build.mjs      static site generator (one SEO page per calculator)
test/                  node:test suite
```
