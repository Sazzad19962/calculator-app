// Dependency-free Open Graph image generator (1200×630 PNG) used by scripts/build.mjs.
// Text is drawn from a pre-rendered glyph atlas (og-font.json, made by make-og-font.cjs),
// so builds need nothing beyond Node's built-in zlib.
import { readFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const W = 1200;
const H = 630;
const FONT = JSON.parse(readFileSync(new URL('./og-font.json', import.meta.url), 'utf8'));
for (const face of Object.values(FONT)) {
  for (const g of Object.values(face.glyphs)) g.alpha = inflateSync(Buffer.from(g.a, 'base64'));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgb) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function canvas(top, bottom) {
  const px = Buffer.alloc(W * H * 3);
  const [a, b] = [hex(top), hex(bottom)];
  for (let y = 0; y < H; y++) {
    const t = y / (H - 1);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    for (let x = 0; x < W; x++) px.set(c, (y * W + x) * 3);
  }
  return px;
}
function blend(px, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= W || y >= H || alpha <= 0) return;
  const o = (y * W + x) * 3;
  for (let i = 0; i < 3; i++) px[o + i] = Math.round(px[o + i] + (color[i] - px[o + i]) * alpha);
}
function circle(px, cx, cy, r, color, alpha) {
  for (let y = Math.max(0, cy - r - 1); y <= Math.min(H - 1, cy + r + 1); y++) {
    for (let x = Math.max(0, cx - r - 1); x <= Math.min(W - 1, cx + r + 1); x++) {
      const d = Math.hypot(x - cx, y - cy);
      const cover = Math.min(1, Math.max(0, r + 0.5 - d));
      blend(px, x, y, color, cover * alpha);
    }
  }
}
function rect(px, x0, y0, w, h, color, alpha = 1) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) blend(px, x, y, color, alpha);
}

const glyph = (face, ch) => face.glyphs[ch] || face.glyphs[ch.normalize('NFD')[0]] || null;
const textWidth = (face, s) => [...s].reduce((w, ch) => w + (glyph(face, ch)?.adv || 0), 0);

function drawText(px, faceName, s, x, y, color, alpha = 1) {
  const face = FONT[faceName];
  let cx = x;
  for (const ch of s) {
    const g = glyph(face, ch);
    if (!g) continue;
    const ox = Math.round(cx);
    for (let gy = 0; gy < face.h; gy++) {
      for (let gx = 0; gx < g.w; gx++) {
        const a = g.alpha[gy * g.w + gx];
        if (a) blend(px, ox + gx, y + gy, color, (a / 255) * alpha);
      }
    }
    cx += g.adv;
  }
  return cx - x;
}

/** Greedy word-wrap into at most `maxLines` lines (last line ellipsised if needed). */
function wrap(faceName, s, maxW, maxLines) {
  const face = FONT[faceName];
  const words = s.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (textWidth(face, next) <= maxW || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && textWidth(face, `${last}…`) > maxW) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

/**
 * Renders a 1200×630 PNG.
 * @param {{title:string, kicker?:string, footer?:string, site:string}} o
 */
const BASES = new Map();
function base(site) {
  if (BASES.has(site)) return BASES.get(site);
  const px = canvas('#2453d6', '#14328f');
  const white = [255, 255, 255];
  // Decorative calculator-ish shapes on the right.
  circle(px, 1090, 120, 230, white, 0.06);
  circle(px, 1150, 560, 170, white, 0.05);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rect(px, 905 + c * 74, 250 + r * 74, 58, 58, white, 0.08);
  // Brand row.
  rect(px, 80, 70, 56, 56, white, 1);
  drawText(px, 'title', '=', 88, 50, hex('#2453d6'));
  drawText(px, 'text', site, 152, 80, white);
  BASES.set(site, px);
  return px;
}

export function ogImage({ title, kicker = '', footer = '', site }) {
  const px = Buffer.from(base(site));
  const white = [255, 255, 255];
  // Kicker (category).
  let y = 190;
  if (kicker) { drawText(px, 'text', kicker.toUpperCase(), 80, y, hex('#c9d6ff')); y += 62; }
  // Title.
  const lines = wrap('title', title, 820, 3);
  for (const line of lines) { drawText(px, 'title', line, 80, y, white); y += 88; }
  // Footer.
  rect(px, 80, 535, 1040, 2, white, 0.25);
  if (footer) drawText(px, 'text', footer, 80, 552, white, 0.9);
  return encodePNG(px);
}
