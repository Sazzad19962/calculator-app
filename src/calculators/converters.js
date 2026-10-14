import { req, sig } from '../util.js';

// Factors convert each unit to the category's base unit.
export const UNITS = {
  length: { label: 'Length', units: { mm: ['Millimetre', 0.001], cm: ['Centimetre', 0.01], m: ['Metre', 1], km: ['Kilometre', 1000], in: ['Inch', 0.0254], ft: ['Foot', 0.3048], yd: ['Yard', 0.9144], mi: ['Mile', 1609.344], nmi: ['Nautical mile', 1852] }, def: ['km', 'mi'] },
  mass: { label: 'Weight / Mass', units: { mg: ['Milligram', 1e-6], g: ['Gram', 0.001], kg: ['Kilogram', 1], t: ['Metric ton', 1000], oz: ['Ounce', 0.028349523125], lb: ['Pound', 0.45359237], st: ['Stone', 6.35029318], tola: ['Tola', 0.0116638038], maund: ['Maund (mon)', 37.3242] }, def: ['kg', 'lb'] },
  temperature: { label: 'Temperature', units: { c: ['Celsius'], f: ['Fahrenheit'], k: ['Kelvin'], r: ['Rankine'] }, def: ['c', 'f'] },
  area: { label: 'Area', units: { mm2: ['Square millimetre', 1e-6], cm2: ['Square centimetre', 1e-4], m2: ['Square metre', 1], ha: ['Hectare', 1e4], km2: ['Square kilometre', 1e6], in2: ['Square inch', 0.00064516], ft2: ['Square foot', 0.09290304], yd2: ['Square yard', 0.83612736], acre: ['Acre', 4046.8564224], mi2: ['Square mile', 2589988.110336], decimal: ['Decimal (shotok)', 40.468564224], katha: ['Katha (720 ft²)', 66.8901888], bigha: ['Bigha (33 decimal)', 1335.462619392] }, def: ['m2', 'ft2'] },
  volume: { label: 'Volume', units: { ml: ['Millilitre', 0.001], l: ['Litre', 1], m3: ['Cubic metre', 1000], tsp: ['Teaspoon (US)', 0.00492892159375], tbsp: ['Tablespoon (US)', 0.01478676478125], floz: ['Fluid ounce (US)', 0.0295735295625], cup: ['Cup (US)', 0.2365882365], pt: ['Pint (US)', 0.473176473], qt: ['Quart (US)', 0.946352946], gal: ['Gallon (US)', 3.785411784], igal: ['Gallon (Imperial)', 4.54609], ft3: ['Cubic foot', 28.316846592] }, def: ['l', 'gal'] },
  speed: { label: 'Speed', units: { mps: ['Metre/second', 1], kph: ['Kilometre/hour', 1 / 3.6], mph: ['Mile/hour', 0.44704], kn: ['Knot', 1852 / 3600], fps: ['Foot/second', 0.3048] }, def: ['kph', 'mph'] },
  time: { label: 'Time', units: { ms: ['Millisecond', 0.001], s: ['Second', 1], min: ['Minute', 60], h: ['Hour', 3600], d: ['Day', 86400], wk: ['Week', 604800], mo: ['Month (avg)', 2629746], yr: ['Year (avg)', 31556952] }, def: ['h', 'min'] },
  data: { label: 'Data storage', units: { bit: ['Bit', 0.125], B: ['Byte', 1], KB: ['Kilobyte (1000)', 1e3], MB: ['Megabyte', 1e6], GB: ['Gigabyte', 1e9], TB: ['Terabyte', 1e12], KiB: ['Kibibyte (1024)', 1024], MiB: ['Mebibyte', 1048576], GiB: ['Gibibyte', 1073741824], TiB: ['Tebibyte', 1099511627776] }, def: ['GB', 'MB'] },
  energy: { label: 'Energy', units: { j: ['Joule', 1], kj: ['Kilojoule', 1000], cal: ['Calorie', 4.184], kcal: ['Kilocalorie', 4184], wh: ['Watt-hour', 3600], kwh: ['Kilowatt-hour', 3.6e6], btu: ['BTU', 1055.05585262] }, def: ['kcal', 'kj'] },
  angle: { label: 'Angle', units: { deg: ['Degree', Math.PI / 180], rad: ['Radian', 1], grad: ['Gradian', Math.PI / 200], arcmin: ['Arcminute', Math.PI / 10800], arcsec: ['Arcsecond', Math.PI / 648000], turn: ['Turn (revolution)', 2 * Math.PI] }, def: ['deg', 'rad'] },
  fuel: { label: 'Fuel economy', units: { kmpl: ['Kilometres per litre', 1], l100: ['Litres per 100 km'], mpg: ['Miles per gallon (US)', 1.609344 / 3.785411784], mpguk: ['Miles per gallon (UK)', 1.609344 / 4.54609], mpl: ['Miles per litre', 1.609344] }, def: ['l100', 'mpg'] },
  pressure: { label: 'Pressure', units: { pa: ['Pascal', 1], kpa: ['Kilopascal', 1000], bar: ['Bar', 1e5], psi: ['PSI', 6894.757293168], atm: ['Atmosphere', 101325], mmhg: ['mmHg', 133.322387415] }, def: ['psi', 'bar'] },
};

// Absolute zero in each temperature unit.
const ABS_ZERO = { c: -273.15, f: -459.67, k: 0, r: 0 };

function toBase(cat, unit, x) {
  if (cat === 'temperature') return { c: x, f: (x - 32) * 5 / 9, k: x - 273.15, r: (x - 491.67) * 5 / 9 }[unit];
  if (cat === 'fuel' && unit === 'l100') return 100 / x; // inverse scale: L/100 km ↔ km/L
  return x * UNITS[cat].units[unit][1];
}
function fromBase(cat, unit, x) {
  if (cat === 'temperature') return { c: x, f: x * 9 / 5 + 32, k: x + 273.15, r: (x + 273.15) * 9 / 5 }[unit];
  if (cat === 'fuel' && unit === 'l100') return 100 / x;
  return x / UNITS[cat].units[unit][1];
}
export function convert(cat, from, to, x) {
  if (from === to) return x;
  const r = fromBase(cat, to, toBase(cat, from, x));
  // Trim binary floating-point noise (e.g. 0.30000000000000004) to 15 significant digits.
  return Number.isFinite(r) && r !== 0 ? Number(r.toPrecision(15)) : r;
}

const unitOpts = (v) => Object.entries(UNITS[v.cat]?.units || UNITS.length.units).map(([k, [label]]) => [k, `${label} (${k})`]);

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new Error('Roman numerals cover 1 to 3999.');
  let s = '';
  for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; }
  return s;
}
export function fromRoman(s) {
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  s = String(s).toUpperCase();
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
    desc: 'Convert length, weight, temperature, area (incl. katha, bigha, decimal), volume, speed, time, data, energy, angle, fuel economy and pressure.',
    keywords: 'convert units metric imperial km miles kg lb celsius fahrenheit katha bigha decimal acre mpg l/100km degrees radians',
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
      const x = req(v.x, 'Value', { min: -1e300, max: 1e300 });
      if (cat === 'temperature' && x < ABS_ZERO[v.from] - 1e-9) throw new Error(`That is below absolute zero (${ABS_ZERO[v.from]} ${units[v.from][0]}).`);
      const nonNeg = ['length', 'mass', 'area', 'volume', 'data', 'fuel'];
      if (nonNeg.includes(cat) && x < 0) throw new Error(`${UNITS[cat].label} can't be negative.`);
      if (cat === 'fuel' && x === 0) throw new Error('Enter a fuel economy greater than zero.');
      const result = convert(cat, v.from, v.to, x);
      return {
        primary: { label: `${sig(x)} ${units[v.from][0]} =`, value: `${sig(result)} ${units[v.to][0]}`, type: 'text' },
        table: {
          title: `${sig(x)} ${v.from} in all ${UNITS[cat].label.toLowerCase()} units`,
          head: ['Unit', 'Value'], types: ['text', 'text'],
          rows: Object.entries(units).map(([k, [label]]) => [`${label} (${k})`, sig(convert(cat, v.from, k, x))]),
        },
        note: cat === 'area' ? 'Katha and bigha sizes vary by region; values shown use the common Bangladesh standard (1 katha = 720 ft², 1 bigha = 33 decimal ≈ 20 katha).'
          : cat === 'fuel' ? 'L/100 km is an inverse scale: lower is more efficient. US and UK (imperial) gallons differ by about 20%.'
            : cat === 'mass' ? 'Tola = 11.6638 g (the traditional South Asian unit, also called a vori in Bangladesh); maund (mon) = 40 seer = 37.3242 kg.' : undefined,
      };
    },
    about: '<p>Each unit is converted to a base unit (metre, kilogram, square metre, litre, radian…) and then to the target unit, using exact international definitions where they exist (e.g. 1 inch = 2.54 cm, 1 lb = 0.45359237 kg, 1 US gallon = 3.785411784 L). Temperatures use °F = °C × 9/5 + 32 and K = °C + 273.15; fuel economy in L/100 km is 100 ÷ (km per litre).</p>',
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
      { id: 'to', label: 'Also convert to base', type: 'number', value: 36, min: 2, max: 36 },
    ],
    compute(v) {
      const base = req(v.from, 'From base', { min: 2, max: 36, int: true });
      const toBase = req(v.to ?? 36, 'Target base', { min: 2, max: 36, int: true });
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base);
      let s = String(v.value ?? '').trim().toLowerCase().replace(/[\s_,]/g, '');
      const neg = s.startsWith('-');
      if (neg || s.startsWith('+')) s = s.slice(1);
      // Strip a prefix only when it matches the chosen base ("0b1" is a valid hex number otherwise).
      const prefix = { 16: '0x', 2: '0b', 8: '0o' }[base];
      if (prefix && s.startsWith(prefix) && s.length > 2) s = s.slice(2);
      if (!s) throw new Error('Enter a number.');
      if (s.length > 5000) throw new Error('That number is too long (max 5,000 digits).');
      const bad = [...s].find((ch) => !digits.includes(ch));
      if (bad) throw new Error(bad === '.' ? 'Only whole numbers are supported.' : `"${bad}" is not a valid digit in base ${base} (allowed: 0–${digits.at(-1).toUpperCase()}).`);
      let n = 0n;
      for (const ch of s) n = n * BigInt(base) + BigInt(digits.indexOf(ch));
      const out = (b) => (neg && n !== 0n ? '-' : '') + n.toString(b).toUpperCase();
      const items = [
        { label: 'Binary (base 2)', value: out(2), type: 'text' },
        { label: 'Octal (base 8)', value: out(8), type: 'text' },
        { label: 'Hexadecimal (base 16)', value: out(16), type: 'text' },
      ];
      if (![2, 8, 10, 16].includes(toBase)) items.push({ label: `Base ${toBase}`, value: out(toBase), type: 'text' });
      items.push({ label: 'Number of binary digits', value: n === 0n ? 1 : n.toString(2).length, type: 'int' });
      return { primary: { label: 'Decimal (base 10)', value: out(10), type: 'text' }, items };
    },
    about: '<p>Works with arbitrarily large whole numbers using BigInt arithmetic. Digits above 9 use letters A–Z (A = 10 … Z = 35). The prefixes 0x (hex), 0b (binary) and 0o (octal) are accepted when they match the chosen base; spaces and underscores are ignored.</p>',
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
      const s = String(v.value ?? '').trim().toUpperCase().replace(/[,\s]/g, '');
      if (!s) throw new Error('Enter a number or a Roman numeral.');
      const parts = (n) => ROMAN.reduce((acc, [val, r]) => { while (n >= val) { acc.push(`${r} (${val})`); n -= val; } return acc; }, []).join(' + ');
      if (/^\d+$/.test(s)) {
        const n = parseInt(s, 10);
        if (n < 1 || n > 3999) throw new Error('Enter a number from 1 to 3999 (standard Roman numerals have no zero and no symbol above M).');
        return { primary: { label: `${n} in Roman numerals`, value: toRoman(n), type: 'text' }, items: [{ label: 'Breakdown', value: parts(n), type: 'text' }] };
      }
      if (/^[IVXLCDM]+$/.test(s)) {
        const n = fromRoman(s);
        if (n < 1 || n > 3999 || toRoman(n) !== s) throw new Error(`"${s}" is not a valid Roman numeral${n >= 1 && n <= 3999 ? ` (did you mean ${toRoman(n)}?)` : ''}.`);
        return { primary: { label: `${s} in numbers`, value: n, type: 'int' }, items: [{ label: 'Breakdown', value: parts(n), type: 'text' }] };
      }
      throw new Error('Enter a whole number or Roman numeral (I, V, X, L, C, D, M).');
    },
    about: '<p>I=1, V=5, X=10, L=50, C=100, D=500, M=1000. A smaller numeral before a larger one is subtracted (IV = 4, XC = 90); only I, X and C are used this way, and a symbol is never repeated more than three times, so 4 is IV, not IIII.</p>',
  },
];
