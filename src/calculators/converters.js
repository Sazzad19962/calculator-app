import { num, sig } from '../util.js';

// Factors convert each unit to the category's base unit.
export const UNITS = {
  length: { label: 'Length', units: { mm: ['Millimetre', 0.001], cm: ['Centimetre', 0.01], m: ['Metre', 1], km: ['Kilometre', 1000], in: ['Inch', 0.0254], ft: ['Foot', 0.3048], yd: ['Yard', 0.9144], mi: ['Mile', 1609.344], nmi: ['Nautical mile', 1852] }, def: ['km', 'mi'] },
  mass: { label: 'Weight / Mass', units: { mg: ['Milligram', 1e-6], g: ['Gram', 0.001], kg: ['Kilogram', 1], t: ['Metric ton', 1000], oz: ['Ounce', 0.028349523125], lb: ['Pound', 0.45359237], st: ['Stone', 6.35029318], tola: ['Tola', 0.0116638038], maund: ['Maund (mon)', 37.3242] }, def: ['kg', 'lb'] },
  temperature: { label: 'Temperature', units: { c: ['Celsius'], f: ['Fahrenheit'], k: ['Kelvin'] }, def: ['c', 'f'] },
  area: { label: 'Area', units: { mm2: ['Square millimetre', 1e-6], cm2: ['Square centimetre', 1e-4], m2: ['Square metre', 1], ha: ['Hectare', 1e4], km2: ['Square kilometre', 1e6], in2: ['Square inch', 0.00064516], ft2: ['Square foot', 0.09290304], yd2: ['Square yard', 0.83612736], acre: ['Acre', 4046.8564224], mi2: ['Square mile', 2589988.110336], decimal: ['Decimal (shotok)', 40.468564224], katha: ['Katha (720 ft²)', 66.8901888], bigha: ['Bigha (33 decimal)', 1335.462619392] }, def: ['m2', 'ft2'] },
  volume: { label: 'Volume', units: { ml: ['Millilitre', 0.001], l: ['Litre', 1], m3: ['Cubic metre', 1000], tsp: ['Teaspoon (US)', 0.00492892159375], tbsp: ['Tablespoon (US)', 0.01478676478125], floz: ['Fluid ounce (US)', 0.0295735295625], cup: ['Cup (US)', 0.2365882365], pt: ['Pint (US)', 0.473176473], qt: ['Quart (US)', 0.946352946], gal: ['Gallon (US)', 3.785411784], igal: ['Gallon (Imperial)', 4.54609], ft3: ['Cubic foot', 28.316846592] }, def: ['l', 'gal'] },
  speed: { label: 'Speed', units: { mps: ['Metre/second', 1], kph: ['Kilometre/hour', 1 / 3.6], mph: ['Mile/hour', 0.44704], kn: ['Knot', 1852 / 3600], fps: ['Foot/second', 0.3048] }, def: ['kph', 'mph'] },
  time: { label: 'Time', units: { ms: ['Millisecond', 0.001], s: ['Second', 1], min: ['Minute', 60], h: ['Hour', 3600], d: ['Day', 86400], wk: ['Week', 604800], mo: ['Month (avg)', 2629746], yr: ['Year (avg)', 31556952] }, def: ['h', 'min'] },
  data: { label: 'Data storage', units: { bit: ['Bit', 0.125], B: ['Byte', 1], KB: ['Kilobyte (1000)', 1e3], MB: ['Megabyte', 1e6], GB: ['Gigabyte', 1e9], TB: ['Terabyte', 1e12], KiB: ['Kibibyte (1024)', 1024], MiB: ['Mebibyte', 1048576], GiB: ['Gibibyte', 1073741824], TiB: ['Tebibyte', 1099511627776] }, def: ['GB', 'MB'] },
  energy: { label: 'Energy', units: { j: ['Joule', 1], kj: ['Kilojoule', 1000], cal: ['Calorie', 4.184], kcal: ['Kilocalorie', 4184], wh: ['Watt-hour', 3600], kwh: ['Kilowatt-hour', 3.6e6], btu: ['BTU', 1055.05585262] }, def: ['kcal', 'kj'] },
  pressure: { label: 'Pressure', units: { pa: ['Pascal', 1], kpa: ['Kilopascal', 1000], bar: ['Bar', 1e5], psi: ['PSI', 6894.757293168], atm: ['Atmosphere', 101325], mmhg: ['mmHg', 133.322387415] }, def: ['psi', 'bar'] },
};

function toBase(cat, unit, x) {
  if (cat === 'temperature') return unit === 'c' ? x : unit === 'f' ? (x - 32) * 5 / 9 : x - 273.15;
  return x * UNITS[cat].units[unit][1];
}
function fromBase(cat, unit, x) {
  if (cat === 'temperature') return unit === 'c' ? x : unit === 'f' ? x * 9 / 5 + 32 : x + 273.15;
  return x / UNITS[cat].units[unit][1];
}
export function convert(cat, from, to, x) {
  return fromBase(cat, to, toBase(cat, from, x));
}

const unitOpts = (v) => Object.entries(UNITS[v.cat]?.units || UNITS.length.units).map(([k, [label]]) => [k, `${label} (${k})`]);

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function toRoman(n) {
  let s = '';
  for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; }
  return s;
}
export function fromRoman(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]];
    const next = map[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

export default [
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    cat: 'convert',
    icon: '🔄',
    desc: 'Convert length, weight, temperature, area (incl. katha, bigha, decimal), volume, speed, time, data, energy and pressure.',
    keywords: 'convert units metric imperial km miles kg lb celsius fahrenheit katha bigha decimal acre',
    inputs: [
      { id: 'cat', label: 'Category', type: 'select', value: 'length', rerender: true, options: Object.entries(UNITS).map(([k, c]) => [k, c.label]) },
      { id: 'x', label: 'Value', type: 'number', value: 1, step: 'any' },
      { id: 'from', label: 'From', type: 'select', value: 'km', options: unitOpts, defaultFn: (v) => UNITS[v.cat].def[0] },
      { id: 'to', label: 'To', type: 'select', value: 'mi', options: unitOpts, defaultFn: (v) => UNITS[v.cat].def[1] },
    ],
    compute(v) {
      const cat = UNITS[v.cat] ? v.cat : 'length';
      const units = UNITS[cat].units;
      if (!units[v.from] || !units[v.to]) throw new Error('Choose units.');
      const x = num(v.x);
      const result = convert(cat, v.from, v.to, x);
      return {
        primary: { label: `${sig(x)} ${units[v.from][0]} =`, value: `${sig(result)} ${units[v.to][0]}`, type: 'text' },
        table: {
          title: `${sig(x)} ${v.from} in all ${UNITS[cat].label.toLowerCase()} units`,
          head: ['Unit', 'Value'], types: ['text', 'text'],
          rows: Object.entries(units).map(([k, [label]]) => [`${label} (${k})`, sig(convert(cat, v.from, k, x))]),
        },
        note: cat === 'area' ? 'Katha and bigha sizes vary by region; values shown use the common Bangladesh standard (1 katha = 720 ft², 1 bigha = 33 decimal ≈ 20 katha).' : undefined,
      };
    },
    about: '<p>Each unit is converted to a base unit (metre, kilogram, square metre, litre…) and then to the target unit, using exact international definitions where they exist (e.g. 1 inch = 2.54 cm, 1 lb = 0.45359237 kg).</p>',
  },
  {
    id: 'base-converter',
    name: 'Number Base Converter',
    cat: 'convert',
    icon: '💻',
    desc: 'Convert numbers between binary, octal, decimal, hexadecimal and any base from 2 to 36.',
    keywords: 'binary hex hexadecimal octal decimal radix convert',
    inputs: [
      { id: 'value', label: 'Number', type: 'text', value: '255' },
      { id: 'from', label: 'From base', type: 'number', value: 10, min: 2, max: 36 },
    ],
    compute(v) {
      const base = Math.round(num(v.from));
      if (base < 2 || base > 36) throw new Error('Base must be between 2 and 36.');
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
      let s = String(v.value).trim().toLowerCase().replace(/^0[xbo]/, '');
      const neg = s.startsWith('-');
      if (neg) s = s.slice(1);
      if (!s || [...s].some((ch) => !digits.includes(ch))) throw new Error(`"${v.value}" is not a valid base-${base} number.`);
      let n = 0n;
      for (const ch of s) n = n * BigInt(base) + BigInt(digits.indexOf(ch));
      const out = (b) => (neg ? '-' : '') + n.toString(b).toUpperCase();
      return {
        primary: { label: 'Decimal (base 10)', value: out(10), type: 'text' },
        items: [
          { label: 'Binary (base 2)', value: out(2), type: 'text' },
          { label: 'Octal (base 8)', value: out(8), type: 'text' },
          { label: 'Hexadecimal (base 16)', value: out(16), type: 'text' },
          { label: 'Base 36', value: out(36), type: 'text' },
        ],
      };
    },
    about: '<p>Works with arbitrarily large whole numbers using BigInt arithmetic. Prefixes like 0x, 0b and 0o are ignored.</p>',
  },
  {
    id: 'roman-numerals',
    name: 'Roman Numeral Converter',
    cat: 'convert',
    icon: '🏛️',
    desc: 'Convert numbers to Roman numerals and back (1 – 3999).',
    keywords: 'roman numerals convert year',
    inputs: [{ id: 'value', label: 'Number or Roman numeral', type: 'text', value: '2026' }],
    compute(v) {
      const s = String(v.value).trim().toUpperCase();
      if (/^\d+$/.test(s)) {
        const n = parseInt(s, 10);
        if (n < 1 || n > 3999) throw new Error('Enter a number from 1 to 3999.');
        return { primary: { label: `${n} in Roman numerals`, value: toRoman(n), type: 'text' } };
      }
      if (/^[IVXLCDM]+$/.test(s)) {
        const n = fromRoman(s);
        if (toRoman(n) !== s) throw new Error(`"${s}" is not a valid Roman numeral (did you mean ${toRoman(n)}?).`);
        return { primary: { label: `${s} in numbers`, value: n, type: 'int' } };
      }
      throw new Error('Enter a whole number or Roman numeral (I, V, X, L, C, D, M).');
    },
    about: '<p>I=1, V=5, X=10, L=50, C=100, D=500, M=1000. A smaller numeral before a larger one is subtracted (IV = 4, XC = 90).</p>',
  },
];
