import { num, gcd, lcm, parseList, sig } from '../util.js';

function simplify(n, d) {
  if (d === 0) throw new Error('Denominator cannot be zero.');
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return [s * n / g, s * d / g];
}

function fracText([n, d]) {
  if (d === 1) return String(n);
  const whole = Math.trunc(n / d);
  const rem = Math.abs(n % d);
  return whole && rem ? `${n}/${d}  =  ${whole} ${rem}/${d}` : `${n}/${d}`;
}

function primeFactors(n) {
  const f = [];
  for (let d = 2; d * d <= n; d++) while (n % d === 0) { f.push(d); n /= d; }
  if (n > 1) f.push(n);
  return f;
}

const shapes = {
  circle: { label: 'Circle', dims: ['r'] },
  rectangle: { label: 'Rectangle', dims: ['l', 'w'] },
  triangle: { label: 'Triangle (base × height)', dims: ['b', 'h'] },
  trapezoid: { label: 'Trapezoid', dims: ['a', 'b', 'h'] },
  sphere: { label: 'Sphere', dims: ['r'] },
  cube: { label: 'Cube', dims: ['a'] },
  box: { label: 'Rectangular box', dims: ['l', 'w', 'h'] },
  cylinder: { label: 'Cylinder', dims: ['r', 'h'] },
  cone: { label: 'Cone', dims: ['r', 'h'] },
};
const dimLabels = { r: 'Radius', l: 'Length', w: 'Width', b: 'Base', h: 'Height', a: 'Side a' };
const dimInputs = ['r', 'l', 'w', 'b', 'h', 'a'].map((d) => ({
  id: d, label: dimLabels[d], type: 'number', value: 5, step: 'any',
  showIf: (v) => shapes[v.shape]?.dims.includes(d),
  labelFn: (v) => (v.shape === 'trapezoid' && d === 'a' ? 'Top side a' : v.shape === 'trapezoid' && d === 'b' ? 'Bottom side b' : dimLabels[d]),
}));

export default [
  {
    id: 'scientific',
    name: 'Scientific Calculator',
    cat: 'math',
    icon: '🧮',
    desc: 'A full scientific calculator with trigonometry, logarithms, powers, factorials, memory and history. Works with your keyboard.',
    keywords: 'scientific calculator trig sin cos tan log online free',
    custom: 'scientific',
    about: `<p>Type with your keyboard or tap the buttons. Supports <code>sin cos tan</code> (and inverses), <code>ln log √ ∛</code>,
      powers <code>x^y</code>, factorial <code>n!</code>, percentages, the constants π and e, and the previous answer (Ans).
      Implicit multiplication like <code>2π</code> or <code>3(4+1)</code> works too. Press <kbd>Enter</kbd> to calculate,
      <kbd>Esc</kbd> to clear.</p>`,
  },
  {
    id: 'percentage',
    name: 'Percentage Calculator',
    cat: 'math',
    icon: '%',
    desc: 'Calculate percentages, percentage change, and what percent one number is of another.',
    keywords: 'percent of increase decrease change difference',
    inputs: [
      { id: 'mode', label: 'Calculation', type: 'select', value: 'of', rerender: true, options: [['of', 'What is X% of Y?'], ['is', 'X is what % of Y?'], ['change', '% change from X to Y'], ['diff', '% difference between X and Y']] },
      { id: 'x', label: 'X', type: 'number', value: 20, labelFn: (v) => (v.mode === 'of' ? 'Percentage (X)' : v.mode === 'change' ? 'From (X)' : 'X') },
      { id: 'y', label: 'Y', type: 'number', value: 150, labelFn: (v) => (v.mode === 'change' ? 'To (Y)' : 'Y') },
    ],
    compute(v) {
      const x = num(v.x);
      const y = num(v.y);
      switch (v.mode) {
        case 'is':
          if (!y) throw new Error('Y cannot be zero.');
          return { primary: { label: `${x} is this % of ${y}`, value: x / y * 100, type: 'percent' } };
        case 'change':
          if (!x) throw new Error('Starting value cannot be zero.');
          return {
            primary: { label: y >= x ? 'Increase' : 'Decrease', value: (y - x) / Math.abs(x) * 100, type: 'percent' },
            items: [{ label: 'Absolute change', value: y - x, type: 'number' }],
          };
        case 'diff':
          if (!(x + y)) throw new Error('X + Y cannot be zero.');
          return { primary: { label: 'Percentage difference', value: Math.abs(x - y) / ((x + y) / 2) * 100, type: 'percent' } };
        default:
          return { primary: { label: `${x}% of ${y}`, value: x / 100 * y, type: 'number' } };
      }
    },
    about: '<p>X% of Y = X/100 × Y. Percentage change = (new − old) ÷ |old| × 100. Percentage difference compares two values relative to their average.</p>',
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
      const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((k) => Math.round(num(v[k])));
      if (!b || !d) throw new Error('Denominators cannot be zero.');
      let n;
      let m;
      if (v.op === '+') [n, m] = [a * d + c * b, b * d];
      else if (v.op === '-') [n, m] = [a * d - c * b, b * d];
      else if (v.op === '*') [n, m] = [a * c, b * d];
      else {
        if (!c) throw new Error('Cannot divide by zero.');
        [n, m] = [a * d, b * c];
      }
      const s = simplify(n, m);
      return {
        primary: { label: 'Result', value: fracText(s), type: 'text' },
        items: [{ label: 'Decimal', value: s[0] / s[1], type: 'number' }, { label: 'Unsimplified', value: `${n}/${m}`, type: 'text' }],
      };
    },
    about: '<p>Fractions are brought to a common denominator to add or subtract, multiplied straight across, and divided by multiplying by the reciprocal. Results are reduced using the greatest common divisor.</p>',
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
      const a = num(v.a);
      const b = num(v.b);
      const c = num(v.c);
      if (a === 0) {
        if (b === 0) throw new Error('Not an equation: a and b are both zero.');
        return { primary: { label: 'Linear solution x', value: sig(-c / b), type: 'text' } };
      }
      const D = b * b - 4 * a * c;
      let roots;
      if (D >= 0) {
        const r1 = (-b + Math.sqrt(D)) / (2 * a);
        const r2 = (-b - Math.sqrt(D)) / (2 * a);
        roots = D === 0 ? `x = ${sig(r1)}` : `x₁ = ${sig(r1)},  x₂ = ${sig(r2)}`;
      } else {
        const re = sig(-b / (2 * a));
        const im = sig(Math.sqrt(-D) / (2 * Math.abs(a)));
        roots = `x = ${re} ± ${im}i`;
      }
      return {
        primary: { label: 'Roots', value: roots, type: 'text' },
        items: [
          { label: 'Discriminant (b² − 4ac)', value: D, type: 'number' },
          { label: 'Vertex', value: `(${sig(-b / (2 * a))}, ${sig(c - b * b / (4 * a))})`, type: 'text' },
          { label: 'Nature of roots', value: D > 0 ? 'Two real roots' : D === 0 ? 'One repeated real root' : 'Two complex roots', type: 'text' },
        ],
      };
    },
    about: '<p><code>x = (−b ± √(b² − 4ac)) / 2a</code>. The discriminant tells you whether the roots are real and distinct (&gt;0), repeated (=0) or complex (&lt;0).</p>',
  },
  {
    id: 'statistics',
    name: 'Statistics Calculator',
    cat: 'math',
    icon: '📉',
    desc: 'Mean, median, mode, range, variance and standard deviation for a list of numbers.',
    keywords: 'mean median mode average standard deviation variance data',
    inputs: [{ id: 'data', label: 'Numbers (separated by commas or spaces)', type: 'textarea', value: '10, 2, 38, 23, 38, 23, 21' }],
    compute(v) {
      const xs = parseList(v.data);
      if (!xs.length) throw new Error('Enter at least one number.');
      const n = xs.length;
      const sorted = [...xs].sort((a, b) => a - b);
      const sum = xs.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      const counts = new Map();
      xs.forEach((x) => counts.set(x, (counts.get(x) || 0) + 1));
      const maxC = Math.max(...counts.values());
      const modes = maxC > 1 ? [...counts].filter(([, c]) => c === maxC).map(([x]) => x) : [];
      const ss = xs.reduce((a, x) => a + (x - mean) ** 2, 0);
      return {
        primary: { label: 'Mean (average)', value: mean, type: 'number' },
        items: [
          { label: 'Count', value: n, type: 'int' },
          { label: 'Sum', value: sum, type: 'number' },
          { label: 'Median', value: median, type: 'number' },
          { label: 'Mode', value: modes.length ? modes.join(', ') : 'None', type: 'text' },
          { label: 'Min / Max', value: `${sorted[0]} / ${sorted[n - 1]}`, type: 'text' },
          { label: 'Range', value: sorted[n - 1] - sorted[0], type: 'number' },
          { label: 'Sample std. deviation (s)', value: n > 1 ? Math.sqrt(ss / (n - 1)) : 0, type: 'number' },
          { label: 'Population std. deviation (σ)', value: Math.sqrt(ss / n), type: 'number' },
          { label: 'Sample variance', value: n > 1 ? ss / (n - 1) : 0, type: 'number' },
          { label: 'Population variance', value: ss / n, type: 'number' },
        ],
        note: `Sorted: ${sorted.join(', ')}`,
      };
    },
    about: '<p>Sample standard deviation divides by n − 1 (use it for a sample of a larger population); population standard deviation divides by n.</p>',
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
      const xs = parseList(v.data).map((x) => Math.abs(Math.round(x))).filter(Boolean);
      if (xs.length < 2) throw new Error('Enter at least two non-zero whole numbers.');
      return {
        primary: { label: 'GCF (HCF)', value: xs.reduce(gcd), type: 'int' },
        items: [{ label: 'LCM', value: xs.reduce(lcm), type: 'int' }],
      };
    },
    about: '<p>The GCF is found with Euclid\'s algorithm; LCM(a, b) = |a·b| ÷ GCF(a, b), applied across the list.</p>',
  },
  {
    id: 'prime',
    name: 'Prime Number Checker',
    cat: 'math',
    icon: '🔍',
    desc: 'Check whether a number is prime and see its prime factorization.',
    keywords: 'prime factorization factors composite',
    inputs: [{ id: 'n', label: 'Number', type: 'number', value: 360, step: 1 }],
    compute(v) {
      const n = Math.round(num(v.n));
      if (n < 2) throw new Error('Enter a whole number of 2 or more.');
      if (n > Number.MAX_SAFE_INTEGER) throw new Error('Number is too large.');
      const f = primeFactors(n);
      const grouped = [...new Set(f)].map((p) => {
        const k = f.filter((x) => x === p).length;
        return k > 1 ? `${p}^${k}` : String(p);
      });
      let divisors = 1;
      new Set(f).forEach((p) => { divisors *= f.filter((x) => x === p).length + 1; });
      return {
        primary: { label: `Is ${n} prime?`, value: f.length === 1 ? 'Yes, it is prime' : 'No, it is composite', type: 'text' },
        items: [
          { label: 'Prime factorization', value: grouped.join(' × '), type: 'text' },
          { label: 'Number of divisors', value: divisors, type: 'int' },
        ],
      };
    },
    about: '<p>Uses trial division up to √n. Every whole number above 1 has a unique prime factorization.</p>',
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
    ],
    volatile: true,
    compute(v) {
      const lo = Math.ceil(Math.min(num(v.min), num(v.max)));
      const hi = Math.floor(Math.max(num(v.min), num(v.max)));
      const count = Math.min(Math.max(Math.round(num(v.count)), 1), 1000);
      const span = hi - lo + 1;
      if (span <= 0) throw new Error('No whole numbers in this range.');
      if (v.unique && count > span) throw new Error('Not enough numbers in the range for unique results.');
      const rand = () => {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        return lo + Math.floor((buf[0] / 2 ** 32) * span);
      };
      const out = [];
      const seen = new Set();
      while (out.length < count) {
        const r = rand();
        if (v.unique && seen.has(r)) continue;
        seen.add(r);
        out.push(r);
      }
      return { primary: { label: count > 1 ? 'Random numbers' : 'Random number', value: out.join(', '), type: 'text' } };
    },
    about: '<p>Numbers are drawn with the browser\'s cryptographically secure generator (<code>crypto.getRandomValues</code>). Change any input or press "Recalculate" for a new draw.</p>',
  },
  {
    id: 'triangle',
    name: 'Right Triangle Calculator',
    cat: 'math',
    icon: '📐',
    desc: 'Hypotenuse, angles, area and perimeter of a right triangle from its two legs (Pythagorean theorem).',
    keywords: 'pythagorean theorem hypotenuse triangle angle',
    inputs: [
      { id: 'a', label: 'Side a (leg)', type: 'number', value: 3 },
      { id: 'b', label: 'Side b (leg)', type: 'number', value: 4 },
    ],
    compute(v) {
      const a = num(v.a);
      const b = num(v.b);
      if (a <= 0 || b <= 0) throw new Error('Sides must be positive.');
      const c = Math.hypot(a, b);
      return {
        primary: { label: 'Hypotenuse c', value: c, type: 'number' },
        items: [
          { label: 'Angle A', value: Math.atan(a / b) * 180 / Math.PI, type: 'number', unit: '°' },
          { label: 'Angle B', value: Math.atan(b / a) * 180 / Math.PI, type: 'number', unit: '°' },
          { label: 'Area', value: a * b / 2, type: 'number' },
          { label: 'Perimeter', value: a + b + c, type: 'number' },
        ],
      };
    },
    about: '<p><code>c = √(a² + b²)</code>. Angle A (opposite side a) = arctan(a / b).</p>',
  },
  {
    id: 'area-volume',
    name: 'Area & Volume Calculator',
    cat: 'math',
    icon: '🧊',
    desc: 'Area, perimeter, surface area and volume of common 2D and 3D shapes.',
    keywords: 'area volume circle sphere cylinder cone surface',
    inputs: [
      { id: 'shape', label: 'Shape', type: 'select', value: 'circle', rerender: true, options: Object.entries(shapes).map(([k, s]) => [k, s.label]) },
      ...dimInputs,
    ],
    compute(v) {
      const g = (k) => num(v[k]);
      const PI = Math.PI;
      const r = g('r'); const h = g('h');
      switch (v.shape) {
        case 'circle': return { primary: { label: 'Area', value: PI * r * r, type: 'number' }, items: [{ label: 'Circumference', value: 2 * PI * r, type: 'number' }, { label: 'Diameter', value: 2 * r, type: 'number' }] };
        case 'rectangle': return { primary: { label: 'Area', value: g('l') * g('w'), type: 'number' }, items: [{ label: 'Perimeter', value: 2 * (g('l') + g('w')), type: 'number' }, { label: 'Diagonal', value: Math.hypot(g('l'), g('w')), type: 'number' }] };
        case 'triangle': return { primary: { label: 'Area', value: g('b') * h / 2, type: 'number' } };
        case 'trapezoid': return { primary: { label: 'Area', value: (g('a') + g('b')) / 2 * h, type: 'number' } };
        case 'sphere': return { primary: { label: 'Volume', value: 4 / 3 * PI * r ** 3, type: 'number' }, items: [{ label: 'Surface area', value: 4 * PI * r * r, type: 'number' }] };
        case 'cube': return { primary: { label: 'Volume', value: g('a') ** 3, type: 'number' }, items: [{ label: 'Surface area', value: 6 * g('a') ** 2, type: 'number' }] };
        case 'box': return { primary: { label: 'Volume', value: g('l') * g('w') * h, type: 'number' }, items: [{ label: 'Surface area', value: 2 * (g('l') * g('w') + g('l') * h + g('w') * h), type: 'number' }] };
        case 'cylinder': return { primary: { label: 'Volume', value: PI * r * r * h, type: 'number' }, items: [{ label: 'Surface area', value: 2 * PI * r * (r + h), type: 'number' }] };
        case 'cone': return { primary: { label: 'Volume', value: PI * r * r * h / 3, type: 'number' }, items: [{ label: 'Surface area', value: PI * r * (r + Math.hypot(r, h)), type: 'number' }, { label: 'Slant height', value: Math.hypot(r, h), type: 'number' }] };
        default: throw new Error('Choose a shape.');
      }
    },
    about: '<p>Results are in the square (area) or cubic (volume) of whatever length unit you enter.</p>',
  },
];
