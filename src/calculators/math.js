import { req, opt, parseList, sig } from '../util.js';

/** Exact BigInt GCD. */
function bgcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function fracText([n, d]) {
  if (d === 1n) return String(n);
  const whole = n / d; // BigInt division truncates toward zero
  const rem = n % d < 0n ? -(n % d) : n % d;
  return whole && rem ? `${n}/${d}  =  ${whole} ${rem}/${d}` : `${n}/${d}`;
}

// ---- Primality (deterministic Miller–Rabin) and factorization (Pollard's rho), BigInt ----
const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
function modpow(b, e, m) {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = r * b % m;
    b = b * b % m;
    e >>= 1n;
  }
  return r;
}
/** Deterministic for n < 3.3·10^24 using the first 13 prime bases. */
export function isPrimeBig(n) {
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s++; }
  outer: for (const a of SMALL_PRIMES) {
    let x = modpow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let i = 1; i < s; i++) {
      x = x * x % n;
      if (x === n - 1n) continue outer;
    }
    return false;
  }
  return true;
}
/** Pollard's rho with Brent's cycle detection and batched GCDs. Returns a non-trivial factor of composite n. */
function rho(n) {
  if (n % 2n === 0n) return 2n;
  for (let c = 1n; ; c++) {
    const f = (z) => (z * z + c) % n;
    let y = 2n;
    let x = 2n;
    let ys = 2n;
    let g = 1n;
    let q = 1n;
    let r = 1;
    const m = 128;
    do {
      x = y;
      for (let i = 0; i < r; i++) y = f(y);
      for (let k = 0; k < r && g === 1n; k += m) {
        ys = y;
        const lim = Math.min(m, r - k);
        for (let i = 0; i < lim; i++) {
          y = f(y);
          q = q * (x > y ? x - y : y - x) % n;
        }
        g = bgcd(q, n);
      }
      r *= 2;
    } while (g === 1n);
    if (g === n) {
      do {
        ys = f(ys);
        g = bgcd(x > ys ? x - ys : ys - x, n);
      } while (g === 1n);
    }
    if (g !== n) return g;
  }
}
/** Prime factors of n (BigInt), ascending, with repetition. */
export function factorBig(n) {
  const out = [];
  for (let p = 2n; p < 1000n && p * p <= n; p += p === 2n ? 1n : 2n) while (n % p === 0n) { out.push(p); n /= p; }
  const stack = n > 1n ? [n] : [];
  while (stack.length) {
    const m = stack.pop();
    if (m === 1n) continue;
    if (isPrimeBig(m)) { out.push(m); continue; }
    const d = rho(m);
    stack.push(d, m / d);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Linear-interpolated quantile (same as Excel QUARTILE.INC / R type 7). */
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const shapes = {
  circle: { label: 'Circle', dims: ['r'] },
  rectangle: { label: 'Rectangle', dims: ['l', 'w'] },
  triangle: { label: 'Triangle (base × height)', dims: ['b', 'h'] },
  heron: { label: 'Triangle (three sides)', dims: ['a', 'b', 'c'] },
  trapezoid: { label: 'Trapezoid', dims: ['a', 'b', 'h'] },
  ellipse: { label: 'Ellipse', dims: ['a', 'b'] },
  sphere: { label: 'Sphere', dims: ['r'] },
  hemisphere: { label: 'Hemisphere', dims: ['r'] },
  cube: { label: 'Cube', dims: ['a'] },
  box: { label: 'Rectangular box', dims: ['l', 'w', 'h'] },
  cylinder: { label: 'Cylinder', dims: ['r', 'h'] },
  cone: { label: 'Cone', dims: ['r', 'h'] },
  pyramid: { label: 'Square pyramid', dims: ['a', 'h'] },
};
const dimLabels = { r: 'Radius', l: 'Length', w: 'Width', b: 'Base', h: 'Height', a: 'Side a', c: 'Side c' };
const shapeDimLabel = (shape, d) => {
  if (shape === 'trapezoid') return { a: 'Top side a', b: 'Bottom side b' }[d];
  if (shape === 'heron') return { a: 'Side a', b: 'Side b', c: 'Side c' }[d];
  if (shape === 'ellipse') return { a: 'Semi-major axis a', b: 'Semi-minor axis b' }[d];
  if (shape === 'pyramid' && d === 'a') return 'Base side a';
  return undefined;
};
const dimInputs = ['r', 'l', 'w', 'b', 'h', 'a', 'c'].map((d) => ({
  id: d, label: dimLabels[d], type: 'number', value: d === 'c' ? 6 : 5, step: 'any',
  showIf: (v) => shapes[v.shape]?.dims.includes(d),
  labelFn: (v) => shapeDimLabel(v.shape, d) || dimLabels[d],
}));

/** Random integer in [0, n) without modulo bias, using 53 bits of crypto randomness. */
function secureInt(n) {
  const buf = new Uint32Array(2);
  const limit = Math.floor(2 ** 53 / n) * n;
  let x;
  do {
    crypto.getRandomValues(buf);
    x = (buf[0] & 0x1fffff) * 2 ** 32 + buf[1]; // 21 + 32 = 53 bits
  } while (x >= limit);
  return x % n;
}

const deg = (rad) => rad * 180 / Math.PI;
const rad = (d) => d * Math.PI / 180;

export default [
  {
    id: 'scientific',
    name: 'Scientific Calculator',
    cat: 'math',
    icon: '🧮',
    desc: 'A full scientific calculator with trigonometry, logarithms, powers, factorials, combinations, memory and history. Works with your keyboard.',
    keywords: 'scientific calculator trig sin cos tan log online free ncr npr mod factorial',
    custom: 'scientific',
    about: `<p>Type with your keyboard or tap the buttons. Supports <code>sin cos tan</code> (and inverses, in degrees or radians),
      <code>ln log √ ∛</code>, powers <code>x^y</code>, factorial <code>n!</code> (non-integers use the gamma function, so
      <code>0.5! = √π/2</code>), double factorial <code>n!!</code> (<code>5!! = 5·3·1 = 15</code>), percentages, the constants
      π, e and φ, and the previous answer (Ans).</p>
      <p>Extra functions: <code>7 mod 3</code> (remainder, with the sign of the divisor), combinations <code>nCr(52, 5)</code> or
      <code>52 nCr 5</code>, permutations <code>nPr(10, 3)</code>, <code>log(8, 2)</code> (any base), <code>root(27, 3)</code>,
      <code>gcd</code>, <code>lcm</code>, <code>min</code>, <code>max</code>, <code>abs</code>, <code>round</code> and hyperbolic functions.</p>
      <p>Precedence: <code>-2^2 = -4</code> and <code>2^3^2 = 2^9</code> (powers are right-associative). Implicit multiplication like
      <code>2π</code> or <code>3(4+1)</code> works too. Press <kbd>Enter</kbd> to calculate, <kbd>Esc</kbd> to clear.
      Results are shown to 12 significant digits; values beyond about 1.8 × 10<sup>308</sup> overflow to ∞.</p>`,
  },
  {
    id: 'percentage',
    name: 'Percentage Calculator',
    cat: 'math',
    icon: '%',
    desc: 'Calculate percentages, percentage change, increases and decreases, and what percent one number is of another.',
    keywords: 'percent of increase decrease change difference',
    inputs: [
      { id: 'mode', label: 'Calculation', type: 'select', value: 'of', rerender: true, options: [['of', 'What is X% of Y?'], ['is', 'X is what % of Y?'], ['whole', 'X is Y% of what?'], ['change', '% change from X to Y'], ['inc', 'X increased by Y%'], ['dec', 'X decreased by Y%'], ['diff', '% difference between X and Y']] },
      { id: 'x', label: 'X', type: 'number', value: 20, labelFn: (v) => (v.mode === 'of' ? 'Percentage (X)' : v.mode === 'change' ? 'From (X)' : 'X') },
      { id: 'y', label: 'Y', type: 'number', value: 150, labelFn: (v) => (v.mode === 'change' ? 'To (Y)' : ['whole', 'inc', 'dec'].includes(v.mode) ? 'Percentage (Y)' : 'Y') },
    ],
    compute(v) {
      const x = req(v.x, 'X');
      const y = req(v.y, 'Y');
      switch (v.mode) {
        case 'is':
          if (!y) throw new Error('Y cannot be zero.');
          return { primary: { label: `${sig(x)} is this % of ${sig(y)}`, value: x / y * 100, type: 'percent' } };
        case 'whole':
          if (!y) throw new Error('The percentage cannot be zero.');
          return { primary: { label: `${sig(x)} is ${sig(y)}% of`, value: x / (y / 100), type: 'number' } };
        case 'change':
          if (!x) throw new Error('Starting value cannot be zero.');
          return {
            primary: { label: y >= x ? 'Increase' : 'Decrease', value: (y - x) / Math.abs(x) * 100, type: 'percent' },
            items: [{ label: 'Absolute change', value: y - x, type: 'number' }, { label: 'Ratio (Y ÷ X)', value: y / x, type: 'number' }],
          };
        case 'inc':
        case 'dec': {
          const f = v.mode === 'inc' ? 1 + y / 100 : 1 - y / 100;
          return { primary: { label: `${sig(x)} ${v.mode === 'inc' ? 'increased' : 'decreased'} by ${sig(y)}%`, value: x * f, type: 'number' }, items: [{ label: 'Change', value: x * f - x, type: 'number' }] };
        }
        case 'diff':
          if (!(x + y)) throw new Error('X + Y cannot be zero.');
          return { primary: { label: 'Percentage difference', value: Math.abs(x - y) / (Math.abs(x + y) / 2) * 100, type: 'percent' } };
        default:
          return { primary: { label: `${sig(x)}% of ${sig(y)}`, value: x / 100 * y, type: 'number' } };
      }
    },
    about: '<p>X% of Y = X/100 × Y. X is what % of Y = X ÷ Y × 100. X is Y% of what = X ÷ (Y/100). Percentage change = (new − old) ÷ |old| × 100. Percentage difference compares two values relative to their average: |X − Y| ÷ ((X + Y)/2) × 100. Note that a 50% increase followed by a 50% decrease leaves you 25% below where you started.</p>',
  },
  {
    id: 'fraction',
    name: 'Fraction Calculator',
    cat: 'math',
    icon: '½',
    desc: 'Add, subtract, multiply and divide fractions, with simplified and mixed-number results.',
    keywords: 'fractions add subtract multiply divide simplify mixed number',
    inputs: [
      { id: 'a', label: 'Numerator 1', type: 'number', value: 3, step: 1 },
      { id: 'b', label: 'Denominator 1', type: 'number', value: 4, step: 1 },
      { id: 'op', label: 'Operation', type: 'select', value: '+', options: [['+', '+ Add'], ['-', '− Subtract'], ['*', '× Multiply'], ['/', '÷ Divide']] },
      { id: 'c', label: 'Numerator 2', type: 'number', value: 5, step: 1 },
      { id: 'd', label: 'Denominator 2', type: 'number', value: 6, step: 1 },
    ],
    compute(v) {
      const lim = { int: true, min: -1e15, max: 1e15 };
      const a = req(v.a, 'Numerator 1', lim);
      const b = req(v.b, 'Denominator 1', lim);
      const c = req(v.c, 'Numerator 2', lim);
      const d = req(v.d, 'Denominator 2', lim);
      if (!b || !d) throw new Error('Denominators cannot be zero.');
      const [A, B, C, D] = [a, b, c, d].map(BigInt);
      let n;
      let m;
      if (v.op === '+') [n, m] = [A * D + C * B, B * D];
      else if (v.op === '-') [n, m] = [A * D - C * B, B * D];
      else if (v.op === '*') [n, m] = [A * C, B * D];
      else {
        if (!c) throw new Error('Cannot divide by zero.');
        [n, m] = [A * D, B * C];
      }
      const g = bgcd(n, m) || 1n;
      const sgn = m < 0n ? -1n : 1n;
      const s = [sgn * n / g, sgn * m / g];
      return {
        primary: { label: 'Result', value: fracText(s), type: 'text' },
        items: [{ label: 'Decimal', value: Number(s[0]) / Number(s[1]), type: 'number' }, { label: 'Unsimplified', value: `${n}/${m}`, type: 'text' }],
      };
    },
    about: '<p>Fractions are brought to a common denominator to add or subtract, multiplied straight across, and divided by multiplying by the reciprocal. Results are reduced using the greatest common divisor, with exact integer arithmetic.</p>',
  },
  {
    id: 'quadratic',
    name: 'Quadratic Equation Solver',
    cat: 'math',
    icon: 'x²',
    desc: 'Solve ax² + bx + c = 0, including complex roots, discriminant and vertex.',
    keywords: 'quadratic formula roots solve equation algebra',
    inputs: [
      { id: 'a', label: 'a', type: 'number', value: 1 },
      { id: 'b', label: 'b', type: 'number', value: -3 },
      { id: 'c', label: 'c', type: 'number', value: 2 },
    ],
    compute(v) {
      const a = req(v.a, 'a');
      const b = opt(v.b, 'b');
      const c = opt(v.c, 'c');
      if (a === 0) {
        if (b === 0) throw new Error(c === 0 ? 'Every x is a solution (0 = 0).' : 'No solution: a and b are both zero.');
        return { primary: { label: 'Linear solution x', value: sig(-c / b + 0), type: 'text' }, note: 'With a = 0 this is a linear equation bx + c = 0.' };
      }
      let D = b * b - 4 * a * c;
      // Treat floating-point noise as a repeated root (e.g. b = 0.2, c = 0.01).
      if (Math.abs(D) <= 1e-12 * Math.max(b * b, Math.abs(4 * a * c))) D = 0;
      let roots;
      if (D >= 0) {
        // Numerically stable form avoids cancellation when b² ≫ 4ac.
        const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(D));
        let r1 = q / a;
        let r2 = q !== 0 ? c / q : -r1;
        if (r1 < r2) [r1, r2] = [r2, r1];
        roots = D === 0 ? `x = ${sig(-b / (2 * a) + 0)}` : `x₁ = ${sig(r1 + 0)},  x₂ = ${sig(r2 + 0)}`;
      } else {
        const re = sig(-b / (2 * a) + 0);
        const im = sig(Math.sqrt(-D) / (2 * Math.abs(a)));
        roots = `x = ${re} ± ${im}i`;
      }
      return {
        primary: { label: 'Roots', value: roots, type: 'text' },
        items: [
          { label: 'Discriminant (b² − 4ac)', value: D, type: 'number' },
          { label: 'Vertex', value: `(${sig(-b / (2 * a) + 0)}, ${sig(c - b * b / (4 * a) + 0)})`, type: 'text' },
          { label: 'Nature of roots', value: D > 0 ? 'Two real roots' : D === 0 ? 'One repeated real root' : 'Two complex roots', type: 'text' },
          { label: 'Sum / product of roots', value: `${sig(-b / a + 0)} / ${sig(c / a + 0)}`, type: 'text' },
        ],
      };
    },
    about: '<p><code>x = (−b ± √(b² − 4ac)) / 2a</code>. The discriminant tells you whether the roots are real and distinct (&gt;0), repeated (=0) or complex (&lt;0). To avoid round-off when b² is much larger than 4ac, the roots are computed as <code>q/a</code> and <code>c/q</code> with <code>q = −(b + sign(b)√D)/2</code>.</p>',
  },
  {
    id: 'statistics',
    name: 'Statistics Calculator',
    cat: 'math',
    icon: '📉',
    desc: 'Mean, median, mode, quartiles, range, variance and standard deviation for a list of numbers.',
    keywords: 'mean median mode average standard deviation variance quartile data',
    inputs: [{ id: 'data', label: 'Numbers (separated by commas or spaces)', type: 'textarea', value: '10, 2, 38, 23, 38, 23, 21' }],
    compute(v) {
      const tokens = String(v.data ?? '').split(/[\s,;]+/).filter(Boolean);
      const xs = parseList(v.data);
      if (!xs.length) throw new Error('Enter at least one number.');
      const skipped = tokens.length - xs.length;
      const n = xs.length;
      const sorted = [...xs].sort((a, b) => a - b);
      const sum = xs.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const median = quantile(sorted, 0.5);
      const counts = new Map();
      xs.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
      let maxC = 0;
      counts.forEach((c) => { if (c > maxC) maxC = c; });
      const modes = maxC > 1 ? [...counts].filter(([, c]) => c === maxC).map(([x]) => x) : [];
      const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
      const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
      const q1 = quantile(sorted, 0.25);
      const q3 = quantile(sorted, 0.75);
      const items = [
        { label: 'Count', value: n, type: 'int' },
        { label: 'Sum', value: sum, type: 'number' },
        { label: 'Median', value: median, type: 'number' },
        { label: 'Mode', value: modes.length ? modes.slice(0, 20).map((x) => sig(x)).join(', ') + (modes.length > 20 ? ' …' : '') : 'None', type: 'text' },
        { label: 'Min / Max', value: `${sig(sorted[0])} / ${sig(sorted[n - 1])}`, type: 'text' },
        { label: 'Range', value: sorted[n - 1] - sorted[0], type: 'number' },
        { label: 'Q1 / Q3', value: `${sig(q1)} / ${sig(q3)}`, type: 'text' },
        { label: 'Interquartile range', value: q3 - q1, type: 'number' },
        { label: 'Sample std. deviation (s)', value: sd, type: 'number' },
        { label: 'Population std. deviation (σ)', value: Math.sqrt(ss / n), type: 'number' },
        { label: 'Sample variance', value: n > 1 ? ss / (n - 1) : 0, type: 'number' },
        { label: 'Population variance', value: ss / n, type: 'number' },
        { label: 'Standard error of the mean', value: n > 1 ? sd / Math.sqrt(n) : 0, type: 'number' },
      ];
      if (sorted[0] > 0) items.push({ label: 'Geometric mean', value: Math.exp(xs.reduce((a, x) => a + Math.log(x), 0) / n), type: 'number' });
      const shown = sorted.slice(0, 200).map((x) => sig(x)).join(', ');
      let note = `Sorted: ${shown}${n > 200 ? ` … (${n - 200} more)` : ''}`;
      if (skipped > 0) note += ` — ${skipped} entr${skipped === 1 ? 'y was' : 'ies were'} not a number and ignored.`;
      return { primary: { label: 'Mean (average)', value: mean, type: 'number' }, items, note };
    },
    about: '<p>Sample standard deviation divides by n − 1 (use it for a sample of a larger population); population standard deviation divides by n. Quartiles use linear interpolation between data points (the method used by Excel\'s QUARTILE.INC). The standard error is s ÷ √n.</p>',
  },
  {
    id: 'gcd-lcm',
    name: 'GCF & LCM Calculator',
    cat: 'math',
    icon: '🔢',
    desc: 'Greatest common factor and least common multiple of two or more numbers.',
    keywords: 'gcd hcf gcf lcm common factor multiple',
    inputs: [{ id: 'data', label: 'Whole numbers', type: 'text', value: '12, 18, 30' }],
    compute(v) {
      const tokens = String(v.data ?? '').split(/[\s,;]+/).filter(Boolean);
      if (tokens.some((t) => !/^[+-]?\d+$/.test(t))) throw new Error('Enter whole numbers only, separated by commas or spaces.');
      const xs = tokens.map((t) => { const b = BigInt(t); return b < 0n ? -b : b; }).filter((x) => x !== 0n);
      if (xs.length < 2) throw new Error('Enter at least two non-zero whole numbers.');
      const g = xs.reduce(bgcd);
      const l = xs.reduce((a, b) => a / bgcd(a, b) * b);
      return {
        primary: { label: 'GCF (HCF)', value: String(g), type: 'text' },
        items: [{ label: 'LCM', value: String(l), type: 'text' }],
      };
    },
    about: '<p>The GCF is found with Euclid\'s algorithm; LCM(a, b) = |a·b| ÷ GCF(a, b), applied across the list. Exact integer arithmetic is used, so very large numbers are handled without rounding.</p>',
  },
  {
    id: 'prime',
    name: 'Prime Number Checker',
    cat: 'math',
    icon: '🔍',
    desc: 'Check whether a number is prime, see its prime factorization, divisors and the nearest primes.',
    keywords: 'prime factorization factors composite divisors',
    inputs: [{ id: 'n', label: 'Number', type: 'text', value: '360' }],
    compute(v) {
      const raw = String(v.n ?? '').trim().replace(/[,\s_]/g, '');
      if (!raw) throw new Error('Enter a whole number.');
      if (!/^\+?\d+$/.test(raw)) throw new Error('Enter a whole number of 2 or more (no decimals or letters).');
      if (raw.replace(/^\+?0*/, '').length > 24) throw new Error('Numbers up to 24 digits are supported.');
      const n = BigInt(raw.replace('+', ''));
      if (n < 2n) throw new Error('Enter a whole number of 2 or more (0 and 1 are neither prime nor composite).');
      const f = factorBig(n);
      const groups = new Map();
      f.forEach((p) => groups.set(p, (groups.get(p) || 0) + 1));
      const grouped = [...groups].map(([p, k]) => (k > 1 ? `${p}^${k}` : String(p)));
      let divisors = 1;
      groups.forEach((k) => { divisors *= k + 1; });
      const prime = f.length === 1;
      let prev = n - 1n;
      while (prev >= 2n && !isPrimeBig(prev)) prev--;
      let next = n + 1n;
      while (!isPrimeBig(next)) next++;
      const items = [
        { label: 'Prime factorization', value: grouped.join(' × '), type: 'text' },
        { label: 'Number of divisors', value: divisors, type: 'int' },
        { label: 'Previous prime', value: prev >= 2n ? String(prev) : '—', type: 'text' },
        { label: 'Next prime', value: String(next), type: 'text' },
      ];
      if (divisors <= 64) {
        let ds = [1n];
        groups.forEach((k, p) => {
          const more = [];
          let pk = 1n;
          for (let i = 1; i <= k; i++) { pk *= p; ds.forEach((d) => more.push(d * pk)); }
          ds = ds.concat(more);
        });
        ds.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        items.push({ label: 'Divisors', value: ds.join(', '), type: 'text' });
      }
      return {
        primary: { label: `Is ${n} prime?`, value: prime ? 'Yes, it is prime' : 'No, it is composite', type: 'text' },
        items,
      };
    },
    about: '<p>Primality is tested with a deterministic Miller–Rabin test (exact for every number below 3.3 × 10<sup>24</sup>) and composite numbers are factored with trial division plus Pollard\'s rho algorithm, so even 20-digit numbers are instant. Every whole number above 1 has a unique prime factorization; the number of divisors is the product of (exponent + 1).</p>',
  },
  {
    id: 'random',
    name: 'Random Number Generator',
    cat: 'math',
    icon: '🎲',
    desc: 'Generate cryptographically secure random integers in any range, with or without repeats.',
    keywords: 'random number picker lottery dice',
    inputs: [
      { id: 'min', label: 'Minimum', type: 'number', value: 1 },
      { id: 'max', label: 'Maximum', type: 'number', value: 100 },
      { id: 'count', label: 'How many', type: 'number', value: 1, min: 1 },
      { id: 'unique', label: 'No repeats', type: 'checkbox', value: false },
      { id: 'sort', label: 'Sort results', type: 'checkbox', value: false },
    ],
    volatile: true,
    compute(v) {
      const a = req(v.min, 'Minimum', { min: -9e15, max: 9e15 });
      const b = req(v.max, 'Maximum', { min: -9e15, max: 9e15 });
      const count = req(v.count, 'How many', { min: 1, max: 1000, int: true });
      const lo = Math.ceil(Math.min(a, b));
      const hi = Math.floor(Math.max(a, b));
      const span = hi - lo + 1;
      if (span <= 0) throw new Error('No whole numbers in this range.');
      if (span > 2 ** 53) throw new Error('The range is too large (max 9 × 10^15 numbers).');
      if (v.unique && count > span) throw new Error(`Only ${span} different numbers exist in this range — lower "How many" or allow repeats.`);
      const out = [];
      const seen = new Set();
      while (out.length < count) {
        const r = lo + secureInt(span);
        if (v.unique && seen.has(r)) continue;
        seen.add(r);
        out.push(r);
      }
      if (v.sort) out.sort((x, y) => x - y);
      const items = count > 1 ? [{ label: 'Sum', value: out.reduce((s, x) => s + x, 0), type: 'int' }] : undefined;
      return { primary: { label: count > 1 ? 'Random numbers' : 'Random number', value: out.join(', '), type: 'text' }, items };
    },
    about: '<p>Numbers are drawn with the browser\'s cryptographically secure generator (<code>crypto.getRandomValues</code>) using 53 random bits and rejection sampling, so every number in the range is exactly equally likely. Change any input or press "Recalculate" for a new draw.</p>',
  },
  {
    id: 'triangle',
    name: 'Right Triangle Calculator',
    cat: 'math',
    icon: '📐',
    desc: 'Solve a right triangle from any two values: sides, hypotenuse or an angle — Pythagorean theorem and trigonometry.',
    keywords: 'pythagorean theorem hypotenuse triangle angle trigonometry',
    inputs: [
      { id: 'mode', label: 'I know', type: 'select', value: 'ab', rerender: true, options: [['ab', 'Both legs (a, b)'], ['ac', 'Leg a and hypotenuse c'], ['aA', 'Leg a and opposite angle A'], ['cA', 'Hypotenuse c and angle A']] },
      { id: 'a', label: 'Side a (leg)', type: 'number', value: 3, showIf: (v) => v.mode !== 'cA' },
      { id: 'b', label: 'Side b (leg)', type: 'number', value: 4, showIf: (v) => !v.mode || v.mode === 'ab' },
      { id: 'c', label: 'Hypotenuse c', type: 'number', value: 5, showIf: (v) => v.mode === 'ac' || v.mode === 'cA' },
      { id: 'A', label: 'Angle A', type: 'number', value: 30, suffix: '°', showIf: (v) => v.mode === 'aA' || v.mode === 'cA' },
    ],
    compute(v) {
      let a;
      let b;
      let c;
      const mode = v.mode || 'ab';
      const angle = () => req(v.A, 'Angle A', { gt: 0, max: 89.999999 });
      if (mode === 'ac') {
        a = req(v.a, 'Side a', { gt: 0 });
        c = req(v.c, 'Hypotenuse c', { gt: 0 });
        if (c <= a) throw new Error('The hypotenuse must be longer than either leg.');
        b = Math.sqrt((c - a) * (c + a));
      } else if (mode === 'aA') {
        a = req(v.a, 'Side a', { gt: 0 });
        const A = angle();
        c = a / Math.sin(rad(A));
        b = a / Math.tan(rad(A));
      } else if (mode === 'cA') {
        c = req(v.c, 'Hypotenuse c', { gt: 0 });
        const A = angle();
        a = c * Math.sin(rad(A));
        b = c * Math.cos(rad(A));
      } else {
        a = req(v.a, 'Side a', { gt: 0 });
        b = req(v.b, 'Side b', { gt: 0 });
        c = Math.hypot(a, b);
      }
      return {
        primary: { label: mode === 'ab' ? 'Hypotenuse c' : 'Sides a, b, c', value: mode === 'ab' ? c : `${sig(a)}, ${sig(b)}, ${sig(c)}`, type: mode === 'ab' ? 'number' : 'text' },
        items: [
          { label: 'Side b', value: b, type: 'number' },
          { label: 'Angle A', value: deg(Math.atan2(a, b)), type: 'number', unit: '°' },
          { label: 'Angle B', value: deg(Math.atan2(b, a)), type: 'number', unit: '°' },
          { label: 'Area', value: a * b / 2, type: 'number' },
          { label: 'Perimeter', value: a + b + c, type: 'number' },
          { label: 'Altitude to hypotenuse', value: a * b / c, type: 'number' },
          { label: 'Inradius', value: (a + b - c) / 2, type: 'number' },
        ],
      };
    },
    about: '<p><code>c = √(a² + b²)</code>. Angle A (opposite side a) = arctan(a / b), and A + B = 90°. From an angle: a = c·sin A, b = c·cos A. The altitude to the hypotenuse is ab ÷ c and the inradius (a + b − c) ÷ 2.</p>',
  },
  {
    id: 'area-volume',
    name: 'Area & Volume Calculator',
    cat: 'math',
    icon: '🧊',
    desc: 'Area, perimeter, surface area and volume of common 2D and 3D shapes.',
    keywords: 'area volume circle sphere cylinder cone surface ellipse pyramid heron',
    inputs: [
      { id: 'shape', label: 'Shape', type: 'select', value: 'circle', rerender: true, options: Object.entries(shapes).map(([k, s]) => [k, s.label]) },
      ...dimInputs,
    ],
    compute(v) {
      const s = shapes[v.shape];
      if (!s) throw new Error('Choose a shape.');
      const g = {};
      for (const d of s.dims) g[d] = req(v[d], shapeDimLabel(v.shape, d) || dimLabels[d], { min: 0 });
      const { r = 0, h = 0, l = 0, w = 0, a = 0, b = 0, c = 0 } = g;
      const PI = Math.PI;
      const N = (label, value) => ({ label, value, type: 'number' });
      switch (v.shape) {
        case 'circle': return { primary: N('Area', PI * r * r), items: [N('Circumference', 2 * PI * r), N('Diameter', 2 * r)] };
        case 'rectangle': return { primary: N('Area', l * w), items: [N('Perimeter', 2 * (l + w)), N('Diagonal', Math.hypot(l, w))] };
        case 'triangle': return { primary: N('Area', b * h / 2) };
        case 'heron': {
          if (a + b <= c || a + c <= b || b + c <= a) throw new Error('These sides cannot form a triangle (each side must be shorter than the other two combined).');
          // Kahan's numerically stable form of Heron's formula.
          const [x, y, z] = [a, b, c].sort((p, q) => q - p);
          const area = Math.sqrt((x + (y + z)) * (z - (x - y)) * (z + (x - y)) * (x + (y - z))) / 4;
          return { primary: N('Area', area), items: [N('Perimeter', a + b + c)] };
        }
        case 'trapezoid': return { primary: N('Area', (a + b) / 2 * h) };
        case 'ellipse': {
          const hh = ((a - b) / (a + b || 1)) ** 2;
          return { primary: N('Area', PI * a * b), items: [{ label: 'Perimeter (Ramanujan approx.)', value: PI * (a + b) * (1 + 3 * hh / (10 + Math.sqrt(4 - 3 * hh))), type: 'number' }] };
        }
        case 'sphere': return { primary: N('Volume', 4 / 3 * PI * r ** 3), items: [N('Surface area', 4 * PI * r * r)] };
        case 'hemisphere': return { primary: N('Volume', 2 / 3 * PI * r ** 3), items: [N('Curved surface area', 2 * PI * r * r), N('Total surface area', 3 * PI * r * r)] };
        case 'cube': return { primary: N('Volume', a ** 3), items: [N('Surface area', 6 * a ** 2), N('Space diagonal', a * Math.sqrt(3))] };
        case 'box': return { primary: N('Volume', l * w * h), items: [N('Surface area', 2 * (l * w + l * h + w * h)), N('Space diagonal', Math.hypot(l, w, h))] };
        case 'cylinder': return { primary: N('Volume', PI * r * r * h), items: [N('Surface area', 2 * PI * r * (r + h)), N('Lateral area', 2 * PI * r * h)] };
        case 'cone': return { primary: N('Volume', PI * r * r * h / 3), items: [N('Surface area', PI * r * (r + Math.hypot(r, h))), N('Slant height', Math.hypot(r, h))] };
        case 'pyramid': {
          const slant = Math.hypot(a / 2, h);
          return { primary: N('Volume', a * a * h / 3), items: [N('Surface area', a * a + 2 * a * slant), N('Slant height', slant)] };
        }
        default: throw new Error('Choose a shape.');
      }
    },
    about: '<p>Results are in the square (area) or cubic (volume) of whatever length unit you enter. Triangle from three sides uses Heron\'s formula; the ellipse perimeter uses Ramanujan\'s second approximation, accurate to a few parts per million or better.</p>',
  },
];
