// Dev-only helper: renders the glyph atlas used by og.js to draw Open Graph PNGs at build time
// without any runtime dependency. Re-run only if you change the font or character set:
//   node src/content/make-og-font.cjs
// Requires the globally installed Playwright + Chromium (not needed for normal builds).
const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const { deflateSync } = require('zlib');
const { join } = require('path');
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');

const CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + '–—‘’“”²³×÷·…éáíóúñüö₹৳€£';
const FACES = { title: { px: 72, weight: 800 }, text: { px: 34, weight: 600 } };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<canvas id="c" width="200" height="200"></canvas>');
  const out = {};
  for (const [name, { px, weight }] of Object.entries(FACES)) {
    out[name] = await p.evaluate(({ CHARS, px, weight }) => {
      const c = document.getElementById('c');
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const font = `${weight} ${px}px Inter, "DejaVu Sans", sans-serif`;
      const H = Math.ceil(px * 1.3);
      const glyphs = {};
      for (const ch of CHARS) {
        ctx.font = font;
        const adv = ctx.measureText(ch).width;
        const w = Math.max(1, Math.ceil(adv + px * 0.15));
        c.width = w; c.height = H;
        ctx.font = font;
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'alphabetic';
        ctx.clearRect(0, 0, w, H);
        ctx.fillText(ch, 0, Math.round(px * 1.0));
        const d = ctx.getImageData(0, 0, w, H).data;
        const a = new Array(w * H);
        for (let i = 0; i < w * H; i++) a[i] = d[i * 4 + 3];
        glyphs[ch] = { w, adv, a };
      }
      return { px, h: H, glyphs };
    }, { CHARS, px, weight });
  }
  await b.close();
  // Compact: each glyph's alpha bytes deflated + base64.
  for (const face of Object.values(out)) {
    for (const g of Object.values(face.glyphs)) {
      g.a = deflateSync(Buffer.from(g.a)).toString('base64');
      g.adv = Math.round(g.adv * 100) / 100;
    }
  }
  writeFileSync(join(__dirname, 'og-font.json'), JSON.stringify(out));
  console.log('wrote og-font.json');
})();
