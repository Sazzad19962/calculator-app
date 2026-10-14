// Tiny dependency-free canvas charts (donut + stacked bars) with hover/tap tooltips,
// HiDPI rendering, colours from CSS custom properties and crisp redraws on resize.
import { t, D } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function vars() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, d) => cs.getPropertyValue(n).trim() || d;
  return {
    colors: [1, 2, 3, 4, 5].map((i) => v(`--chart-${i}`, '#888')),
    muted: v('--muted', '#666'),
    grid: v('--border', '#ddd'),
    text: v('--text', '#111'),
    surface: v('--surface', '#fff'),
    font: v('--font', 'system-ui, sans-serif'),
  };
}

function setup(canvas, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function legendHTML(labels, colors, values) {
  return `<ul class="legend">${labels.map((l, i) => `<li><span class="swatch" style="background:${colors[i % colors.length]}"></span><span>${esc(l)}</span>${values ? ` <b>${esc(values[i])}</b>` : ''}</li>`).join('')}</ul>`;
}

/** "Nice" axis maximum and step so gridlines land on round numbers. */
export function niceScale(max, ticks = 4) {
  if (!(max > 0)) return { max: 1, step: 0.25 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  return { max: Math.ceil(max / step - 1e-9) * step, step };
}

/** Shared tooltip behaviour: pointer move/tap → hit(x,y) returns {html,x,y} or null. */
function interactive(container, canvas, hit, redraw) {
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.setAttribute('role', 'status');
  tip.hidden = true;
  container.style.position = 'relative';
  container.appendChild(tip);
  let current = -1;
  const hide = () => { tip.hidden = true; if (current !== -1) { current = -1; redraw(-1); } };
  const show = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const h = hit(x, y);
    if (!h) return hide();
    if (h.index !== current) { current = h.index; redraw(h.index); }
    tip.innerHTML = h.html;
    tip.hidden = false;
    const cr = container.getBoundingClientRect();
    const ox = r.left - cr.left;
    const oy = r.top - cr.top;
    const tw = tip.offsetWidth;
    let left = ox + x - tw / 2;
    left = Math.max(0, Math.min(left, cr.width - tw));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, oy + y - tip.offsetHeight - 14)}px`;
    return undefined;
  };
  canvas.addEventListener('pointermove', show);
  canvas.addEventListener('pointerdown', show);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  // Keyboard: focus the chart and use arrow keys to step through values.
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Escape') return hide();
    const pt = hit.step(current, e.key === 'ArrowRight' ? 1 : -1);
    if (!pt) return undefined;
    const r = canvas.getBoundingClientRect();
    return show({ clientX: r.left + pt.x, clientY: r.top + pt.y });
  });
  canvas.addEventListener('blur', hide);
}

/** Watches the container width and calls draw() only when it actually changes. */
function onResize(container, draw) {
  if (!('ResizeObserver' in window)) return;
  let w = container.clientWidth;
  let raf;
  const ro = new ResizeObserver(() => {
    const nw = container.clientWidth;
    if (!container.isConnected) { ro.disconnect(); return; }
    if (Math.abs(nw - w) < 2) return;
    w = nw;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });
  ro.observe(container);
}

export function donut(container, data, fmt) {
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);
  if (!total) { container.remove(); return; }
  const v = vars();
  const pct = (x) => D(`${(x / total * 100).toFixed(1)}%`);
  const summary = items.map((d) => `${d.label} ${fmt(d.value)} (${pct(d.value)})`).join(', ');
  container.innerHTML = `<div class="donut-wrap"><canvas role="img" aria-label="${esc(`${t('Breakdown')}: ${summary}`)}"></canvas>${legendHTML(items.map((d) => d.label), v.colors, items.map((d) => `${fmt(d.value)} · ${pct(d.value)}`))}</div>`;
  const canvas = container.querySelector('canvas');
  const size = 180;
  const r = size / 2;
  const angles = [];
  const draw = (hi = -1) => {
    const ctx = setup(canvas, size, size);
    let a = -Math.PI / 2;
    angles.length = 0;
    items.forEach((d, i) => {
      const sweep = d.value / total * Math.PI * 2;
      const grow = i === hi ? 4 : 0;
      ctx.beginPath();
      ctx.arc(r, r, r - 6 + grow, a, a + sweep);
      ctx.arc(r, r, r * 0.6 - grow / 2, a + sweep, a, true);
      ctx.closePath();
      ctx.fillStyle = v.colors[i % v.colors.length];
      ctx.globalAlpha = hi === -1 || hi === i ? 1 : 0.55;
      ctx.fill();
      // thin separator between slices
      if (items.length > 1) { ctx.globalAlpha = 1; ctx.strokeStyle = v.surface; ctx.lineWidth = 2; ctx.stroke(); }
      angles.push([a, a + sweep]);
      a += sweep;
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = v.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const sel = items[hi];
    ctx.font = `600 11px ${v.font}`;
    ctx.fillStyle = v.muted;
    ctx.fillText(sel ? sel.label.slice(0, 18) : t('Total'), r, r - 11);
    ctx.font = `700 14px ${v.font}`;
    ctx.fillStyle = v.text;
    ctx.fillText(sel ? pct(sel.value) : fmt(total), r, r + 8, size * 0.56);
  };
  const center = (i) => {
    const [a0, a1] = angles[i];
    const m = (a0 + a1) / 2;
    return { x: r + Math.cos(m) * r * 0.8, y: r + Math.sin(m) * r * 0.8 };
  };
  const hit = (x, y) => {
    const dx = x - r;
    const dy = y - r;
    const dist = Math.hypot(dx, dy);
    if (dist < r * 0.55 || dist > r) return null;
    let ang = Math.atan2(dy, dx);
    if (ang < -Math.PI / 2) ang += Math.PI * 2;
    const i = angles.findIndex(([a0, a1]) => ang >= a0 && ang < a1);
    if (i < 0) return null;
    const d = items[i];
    return { index: i, html: `<b>${esc(d.label)}</b>${esc(fmt(d.value))} · ${pct(d.value)}` };
  };
  hit.step = (cur, dir) => center((cur + dir + items.length) % items.length);
  draw();
  interactive(container, canvas, hit, draw);
}

export function stacked(container, data, legend, fmt, fmtFull = fmt) {
  if (!data.length) { container.remove(); return; }
  const v = vars();
  const last = data[data.length - 1];
  container.innerHTML = `<canvas role="img" aria-label="${esc(D(t(`Bar chart of ${legend.join(t(' and '))} over ${data.length} periods; final ${last.label}: ${fmtFull(last.value)}`)))}"></canvas>${legendHTML(legend, v.colors)}`;
  const canvas = container.querySelector('canvas');
  const H = 240;
  const geo = { padL: 0, plotW: 0, plotH: 0, bw: 0, top: 10 };
  const scale = niceScale(Math.max(...data.map((d) => d.value)));
  const draw = (hi = -1) => {
    const w = Math.max(container.clientWidth, 240);
    const ctx = setup(canvas, w, H);
    ctx.font = `11px ${v.font}`;
    const yLabels = [];
    for (let t = 0; t <= scale.max + 1e-9; t += scale.step) yLabels.push(fmt(t));
    geo.padL = Math.ceil(Math.max(...yLabels.map((s) => ctx.measureText(s).width))) + 12;
    const padB = 24;
    geo.plotW = w - geo.padL - 4;
    geo.plotH = H - padB - geo.top;
    geo.bw = geo.plotW / data.length;
    const y0 = geo.top + geo.plotH;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    yLabels.forEach((lab, i) => {
      const y = Math.round(y0 - geo.plotH * (i * scale.step) / scale.max) + 0.5;
      ctx.strokeStyle = v.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(geo.padL, y);
      ctx.lineTo(w - 4, y);
      ctx.stroke();
      ctx.fillStyle = v.muted;
      ctx.fillText(lab, geo.padL - 8, y);
    });
    // Skip x labels so they never overlap.
    const labW = Math.max(...data.map((d) => ctx.measureText(String(d.label)).width)) + 10;
    const step = Math.max(1, Math.ceil(labW / geo.bw));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const gap = Math.min(geo.bw * 0.25, 10);
    data.forEach((d, i) => {
      let y = y0;
      const x = geo.padL + i * geo.bw + gap / 2;
      const bw = Math.max(geo.bw - gap, 1);
      ctx.globalAlpha = hi === -1 || hi === i ? 1 : 0.5;
      (d.parts || [d.value]).forEach((p, j) => {
        const bh = Math.max(p, 0) / scale.max * geo.plotH;
        ctx.fillStyle = v.colors[j % v.colors.length];
        ctx.fillRect(x, y - bh, bw, bh);
        y -= bh;
      });
      ctx.globalAlpha = 1;
      if (i % step === 0 || (i === data.length - 1 && (data.length - 1) % step > step / 2)) {
        ctx.fillStyle = hi === i ? v.text : v.muted;
        ctx.fillText(d.label, x + bw / 2, y0 + 6);
      }
    });
  };
  const hit = (x) => {
    const i = Math.floor((x - geo.padL) / geo.bw);
    if (i < 0 || i >= data.length) return null;
    const d = data[i];
    const parts = (d.parts || [d.value]).map((p, j) => `<span><i class="swatch" style="background:${v.colors[j % v.colors.length]}"></i>${esc(legend[j] || '')} ${esc(fmtFull(p))}</span>`).join('');
    return { index: i, html: `<b>${esc(d.label)} · ${esc(fmtFull(d.value))}</b>${d.parts ? parts : ''}` };
  };
  hit.step = (cur, dir) => {
    const i = Math.max(0, Math.min(data.length - 1, cur < 0 ? (dir > 0 ? 0 : data.length - 1) : cur + dir));
    return { x: geo.padL + (i + 0.5) * geo.bw, y: geo.top + geo.plotH * (1 - data[i].value / scale.max) };
  };
  draw();
  interactive(container, canvas, hit, draw);
  onResize(container, () => draw());
}

/** Horizontal band gauge (e.g. BMI) rendered as HTML for crisp text. */
export function gauge(container, { value, min, max, bands }) {
  let prev = min;
  const segs = bands.map(([to, label], i) => {
    const width = (Math.min(to, max) - prev) / (max - min) * 100;
    prev = to;
    return `<div class="gauge-seg g${i}" style="width:${width}%"><span>${esc(label)}</span></div>`;
  }).join('');
  const pos = Math.min(Math.max((value - min) / (max - min), 0), 1) * 100;
  const band = bands.find(([to]) => value < to) || bands[bands.length - 1];
  container.innerHTML = `<div class="gauge" role="img" aria-label="${esc(D(t(`Value ${Math.round(value * 10) / 10} on a scale from ${min} to ${max}: ${band[1]}`)))}"><div class="gauge-bar">${segs}</div><div class="gauge-marker" style="left:${pos}%"></div></div>`;
}
