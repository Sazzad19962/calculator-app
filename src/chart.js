// Tiny dependency-free canvas charts (donut + stacked bars) sized for HiDPI screens.

function palette() {
  const cs = getComputedStyle(document.documentElement);
  return [1, 2, 3, 4, 5].map((i) => cs.getPropertyValue(`--chart-${i}`).trim() || '#888');
}

function setup(canvas, height) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth || 300;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, w, h: height };
}

function legendHTML(labels, colors, values) {
  return `<ul class="legend">${labels.map((l, i) => `<li><span class="swatch" style="background:${colors[i % colors.length]}"></span>${l}${values ? ` <b>${values[i]}</b>` : ''}</li>`).join('')}</ul>`;
}

export function donut(container, data, fmt) {
  const items = data.filter((d) => d.value > 0);
  const total = items.reduce((s, d) => s + d.value, 0);
  if (!total) return;
  const colors = palette();
  container.innerHTML = `<div class="donut-wrap"><canvas role="img" aria-label="Breakdown chart"></canvas>${legendHTML(items.map((d) => d.label), colors, items.map((d) => `${fmt(d.value)} · ${(d.value / total * 100).toFixed(1)}%`))}</div>`;
  const canvas = container.querySelector('canvas');
  const size = 180;
  canvas.parentElement.style.setProperty('--donut', `${size}px`);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = canvas.style.height = `${size}px`;
  canvas.width = canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  let a = -Math.PI / 2;
  const r = size / 2;
  items.forEach((d, i) => {
    const sweep = d.value / total * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(r, r, r - 2, a, a + sweep);
    ctx.arc(r, r, r * 0.58, a + sweep, a, true);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    a += sweep;
  });
}

export function stacked(container, data, legend, fmt) {
  if (!data.length) return;
  const colors = palette();
  container.innerHTML = `<canvas role="img" aria-label="Growth chart"></canvas>${legendHTML(legend, colors)}`;
  const canvas = container.querySelector('canvas');
  const { ctx, w, h } = setup(canvas, 220);
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const padL = 64;
  const padB = 22;
  const plotW = w - padL - 6;
  const plotH = h - padB - 8;
  const cs = getComputedStyle(document.documentElement);
  const muted = cs.getPropertyValue('--muted').trim();
  const line = cs.getPropertyValue('--border').trim();
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const y = 8 + plotH - plotH * i / 4;
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - 6, y);
    ctx.stroke();
    ctx.fillText(fmt(max * i / 4), padL - 6, y);
  }
  const bw = plotW / data.length;
  const step = Math.ceil(data.length / 10);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  data.forEach((d, i) => {
    let y = 8 + plotH;
    const x = padL + i * bw + bw * 0.15;
    (d.parts || [d.value]).forEach((p, j) => {
      const bh = p / max * plotH;
      ctx.fillStyle = colors[j % colors.length];
      ctx.fillRect(x, y - bh, bw * 0.7, bh);
      y -= bh;
    });
    if (i % step === 0 || i === data.length - 1) {
      ctx.fillStyle = muted;
      ctx.fillText(d.label, x + bw * 0.35, 8 + plotH + 6);
    }
  });
}

/** Horizontal band gauge (e.g. BMI) rendered as HTML for crisp text. */
export function gauge(container, { value, min, max, bands }) {
  let prev = min;
  const segs = bands.map(([to, label], i) => {
    const width = (Math.min(to, max) - prev) / (max - min) * 100;
    prev = to;
    return `<div class="gauge-seg g${i}" style="width:${width}%"><span>${label}</span></div>`;
  }).join('');
  const pos = Math.min(Math.max((value - min) / (max - min), 0), 1) * 100;
  container.innerHTML = `<div class="gauge"><div class="gauge-bar">${segs}</div><div class="gauge-marker" style="left:${pos}%"></div></div>`;
}
