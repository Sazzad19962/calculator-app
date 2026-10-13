import { num, parseDate, todayISO, diffYMD, addToDate, DAY_MS } from '../util.js';

const fmtDate = (d) => d.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function businessDays(a, b) {
  let count = 0;
  for (let t = a.getTime(); t < b.getTime(); t += DAY_MS) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

const GRADE_POINTS = { 'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0 };

export default [
  {
    id: 'age',
    name: 'Age Calculator',
    cat: 'everyday',
    icon: '🎂',
    desc: 'Exact age in years, months and days, plus total days lived and your next birthday.',
    keywords: 'age birthday how old date of birth',
    inputs: [
      { id: 'dob', label: 'Date of birth', type: 'date', value: '1995-06-15' },
      { id: 'on', label: 'Age on', type: 'date', value: () => todayISO() },
    ],
    compute(v) {
      const dob = parseDate(v.dob);
      const on = parseDate(v.on);
      if (!dob || !on) throw new Error('Enter valid dates.');
      if (on < dob) throw new Error('Date of birth must be before the "age on" date.');
      const d = diffYMD(dob, on);
      const days = Math.round((on - dob) / DAY_MS);
      let next = addToDate(dob, { years: d.years + 1 });
      if (d.months === 0 && d.days === 0) next = on;
      const toNext = Math.round((next - on) / DAY_MS);
      return {
        primary: { label: 'Age', value: `${plural(d.years, 'year')}, ${plural(d.months, 'month')}, ${plural(d.days, 'day')}`, type: 'text' },
        items: [
          { label: 'Total months', value: d.years * 12 + d.months, type: 'int' },
          { label: 'Total weeks', value: Math.floor(days / 7), type: 'int' },
          { label: 'Total days', value: days, type: 'int' },
          { label: 'Total hours', value: days * 24, type: 'int' },
          { label: 'Born on a', value: dob.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long' }), type: 'text' },
          { label: 'Next birthday', value: toNext === 0 ? 'Today! 🎉' : `in ${plural(toNext, 'day')} (${fmtDate(next)})`, type: 'text' },
        ],
      };
    },
    about: '<p>Age is counted in completed calendar years, months and days. For official purposes such as job applications, check whether your organisation counts age on a specific cut-off date — enter it in "Age on".</p>',
  },
  {
    id: 'date-difference',
    name: 'Date Difference Calculator',
    cat: 'everyday',
    icon: '📅',
    desc: 'Days, weeks, months and business days between two dates.',
    keywords: 'days between dates duration count days working days',
    inputs: [
      { id: 'start', label: 'Start date', type: 'date', value: () => todayISO() },
      { id: 'end', label: 'End date', type: 'date', value: () => `${new Date().getFullYear()}-12-31` },
      { id: 'incl', label: 'Include end date', type: 'checkbox', value: false },
    ],
    compute(v) {
      let a = parseDate(v.start);
      let b = parseDate(v.end);
      if (!a || !b) throw new Error('Enter valid dates.');
      if (b < a) [a, b] = [b, a];
      const endAdj = v.incl ? new Date(b.getTime() + DAY_MS) : b;
      const days = Math.round((endAdj - a) / DAY_MS);
      const d = diffYMD(a, endAdj);
      return {
        primary: { label: 'Difference', value: plural(days, 'day'), type: 'text' },
        items: [
          { label: 'Years, months, days', value: `${d.years} y ${d.months} m ${d.days} d`, type: 'text' },
          { label: 'Weeks', value: `${Math.floor(days / 7)} weeks ${days % 7} days`, type: 'text' },
          { label: 'Business days (Mon–Fri)', value: businessDays(a, endAdj), type: 'int' },
          { label: 'Hours', value: days * 24, type: 'int' },
        ],
      };
    },
    about: '<p>Business days exclude Saturdays and Sundays but not public holidays. In countries with a Friday–Saturday weekend, adjust accordingly.</p>',
  },
  {
    id: 'date-add',
    name: 'Add / Subtract Days to a Date',
    cat: 'everyday',
    icon: '🗓️',
    desc: 'Find the date a number of years, months, weeks or days before or after a given date.',
    keywords: 'add days to date future date deadline subtract',
    inputs: [
      { id: 'start', label: 'Start date', type: 'date', value: () => todayISO() },
      { id: 'op', label: 'Operation', type: 'select', value: '1', options: [['1', 'Add (+)'], ['-1', 'Subtract (−)']] },
      { id: 'y', label: 'Years', type: 'number', value: 0 },
      { id: 'm', label: 'Months', type: 'number', value: 0 },
      { id: 'w', label: 'Weeks', type: 'number', value: 0 },
      { id: 'd', label: 'Days', type: 'number', value: 90 },
    ],
    compute(v) {
      const a = parseDate(v.start);
      if (!a) throw new Error('Enter a valid date.');
      const s = num(v.op) || 1;
      const r = addToDate(a, { years: s * Math.round(num(v.y)), months: s * Math.round(num(v.m)), days: s * Math.round(num(v.w) * 7 + num(v.d)) });
      return { primary: { label: 'Resulting date', value: fmtDate(r), type: 'text' } };
    },
    about: '<p>Years and months are applied first (clamping to the end of shorter months, e.g. 31 Jan + 1 month = 28/29 Feb), then weeks and days.</p>',
  },
  {
    id: 'time-duration',
    name: 'Time Duration Calculator',
    cat: 'everyday',
    icon: '⏱️',
    desc: 'Hours and minutes between two times — great for timesheets and shifts.',
    keywords: 'hours between times timesheet shift work hours',
    inputs: [
      { id: 'start', label: 'Start time', type: 'time', value: '09:00' },
      { id: 'end', label: 'End time', type: 'time', value: '17:30' },
      { id: 'brk', label: 'Break', type: 'number', value: 30, suffix: 'min' },
    ],
    compute(v) {
      const toMin = (t) => {
        const [h, m] = String(t || '').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
      };
      let diff = toMin(v.end) - toMin(v.start);
      if (diff < 0) diff += 1440; // overnight shift
      diff = Math.max(diff - num(v.brk), 0);
      return {
        primary: { label: 'Duration', value: `${Math.floor(diff / 60)} h ${diff % 60} min`, type: 'text' },
        items: [{ label: 'Decimal hours', value: diff / 60, type: 'number2' }, { label: 'Total minutes', value: diff, type: 'int' }],
      };
    },
    about: '<p>If the end time is earlier than the start, the shift is assumed to run past midnight.</p>',
  },
  {
    id: 'gpa',
    name: 'GPA Calculator',
    cat: 'everyday',
    icon: '🎓',
    desc: 'Calculate your grade point average on a 4.0 scale from letter grades and credits.',
    keywords: 'gpa cgpa grade point average college university',
    inputs: [{ id: 'courses', label: 'One course per line: grade, credits', type: 'textarea', value: 'A, 3\nB+, 4\nA-, 3\nB, 2', help: 'Grades: A+ A A- B+ B B- C+ C C- D+ D D- F, or a numeric grade point (e.g. 3.75).' }],
    compute(v) {
      let pts = 0;
      let cr = 0;
      const rows = [];
      for (const line of String(v.courses).split('\n')) {
        if (!line.trim()) continue;
        const [g, c] = line.split(/\s*[,\t;]\s*|\s+(?=[\d.]+\s*$)/).map((s) => s.trim());
        const credits = num(c);
        const gp = GRADE_POINTS[g?.toUpperCase()] ?? (Number.isFinite(parseFloat(g)) ? parseFloat(g) : null);
        if (gp === null || credits <= 0) throw new Error(`Could not read line: "${line.trim()}"`);
        pts += gp * credits;
        cr += credits;
        rows.push([g.toUpperCase(), credits, gp]);
      }
      if (!cr) throw new Error('Add at least one course.');
      return {
        primary: { label: 'GPA', value: pts / cr, type: 'number2' },
        items: [{ label: 'Total credits', value: cr, type: 'number' }, { label: 'Quality points', value: pts, type: 'number' }],
        table: { title: 'Courses', head: ['Grade', 'Credits', 'Points'], types: ['text', 'number', 'number'], rows },
      };
    },
    about: '<p>GPA = Σ(grade points × credits) ÷ Σ credits. Uses the common US 4.0 scale; enter numeric grade points directly if your university uses a different scale.</p>',
  },
  {
    id: 'fuel-cost',
    name: 'Fuel Cost Calculator',
    cat: 'everyday',
    icon: '⛽',
    desc: 'Trip fuel cost from distance, fuel efficiency and fuel price.',
    keywords: 'gas petrol trip cost mileage mpg km per litre',
    inputs: [
      { id: 'dist', label: 'Trip distance', type: 'number', value: 250, suffix: 'km' },
      { id: 'eff', label: 'Fuel efficiency', type: 'number', value: 12, suffix: 'km/L' },
      { id: 'price', label: 'Fuel price per litre', type: 'number', value: 1.5, money: true, step: 0.01 },
      { id: 'round', label: 'Round trip', type: 'checkbox', value: false },
    ],
    compute(v) {
      if (num(v.eff) <= 0) throw new Error('Fuel efficiency must be greater than zero.');
      const d = num(v.dist) * (v.round ? 2 : 1);
      const litres = d / num(v.eff);
      return {
        primary: { label: 'Fuel cost', value: litres * num(v.price), type: 'money' },
        items: [{ label: 'Fuel needed', value: litres, type: 'number2', unit: 'L' }, { label: 'Cost per km', value: num(v.price) / num(v.eff), type: 'money2' }],
      };
    },
    about: '<p>Fuel needed = distance ÷ efficiency. Cost = fuel needed × price.</p>',
  },
  {
    id: 'electricity',
    name: 'Electricity Cost Calculator',
    cat: 'everyday',
    icon: '💡',
    desc: 'Running cost of any appliance per day, month and year.',
    keywords: 'electricity bill power consumption kwh appliance watt',
    inputs: [
      { id: 'watts', label: 'Power', type: 'number', value: 1500, suffix: 'W' },
      { id: 'hours', label: 'Hours used per day', type: 'number', value: 8, step: 0.1 },
      { id: 'qty', label: 'Quantity', type: 'number', value: 1 },
      { id: 'price', label: 'Price per kWh', type: 'number', value: 0.15, money: true, step: 0.01 },
    ],
    compute(v) {
      const kwhDay = num(v.watts) * num(v.hours) * num(v.qty) / 1000;
      const c = kwhDay * num(v.price);
      return {
        primary: { label: 'Monthly cost', value: c * 30, type: 'money' },
        items: [
          { label: 'Daily cost', value: c, type: 'money2' },
          { label: 'Yearly cost', value: c * 365, type: 'money' },
          { label: 'Energy per day', value: kwhDay, type: 'number2', unit: 'kWh' },
          { label: 'Energy per month', value: kwhDay * 30, type: 'number1', unit: 'kWh' },
        ],
      };
    },
    about: '<p>kWh = watts × hours ÷ 1000. Many utilities use tiered (slab) pricing, so your real bill may differ.</p>',
  },
  {
    id: 'password',
    name: 'Password Generator',
    cat: 'everyday',
    icon: '🔐',
    desc: 'Generate strong, random passwords securely in your browser — nothing is sent anywhere.',
    keywords: 'password generator strong secure random',
    volatile: true,
    inputs: [
      { id: 'len', label: 'Length', type: 'number', value: 16, min: 4, max: 128 },
      { id: 'upper', label: 'Uppercase (A–Z)', type: 'checkbox', value: true },
      { id: 'lower', label: 'Lowercase (a–z)', type: 'checkbox', value: true },
      { id: 'digits', label: 'Numbers (0–9)', type: 'checkbox', value: true },
      { id: 'symbols', label: 'Symbols (!@#…)', type: 'checkbox', value: true },
      { id: 'similar', label: 'Avoid look-alikes (0 O l 1 I)', type: 'checkbox', value: false },
    ],
    compute(v) {
      const sets = [];
      if (v.upper) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      if (v.lower) sets.push('abcdefghijklmnopqrstuvwxyz');
      if (v.digits) sets.push('0123456789');
      if (v.symbols) sets.push('!@#$%^&*()-_=+[]{};:,.?/');
      if (!sets.length) throw new Error('Choose at least one character type.');
      const clean = (s) => (v.similar ? s.replace(/[0OlI1|]/g, '') : s);
      const pool = clean(sets.join(''));
      const len = Math.min(Math.max(Math.round(num(v.len)), 4), 128);
      const rnd = (n) => {
        const buf = new Uint32Array(1);
        const limit = Math.floor(2 ** 32 / n) * n; // avoid modulo bias
        do crypto.getRandomValues(buf); while (buf[0] >= limit);
        return buf[0] % n;
      };
      // Guarantee at least one character from each chosen set, then shuffle.
      const chars = sets.map((s) => clean(s)[rnd(clean(s).length)]);
      while (chars.length < len) chars.push(pool[rnd(pool.length)]);
      for (let i = chars.length - 1; i > 0; i--) {
        const j = rnd(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      const pw = chars.slice(0, len).join('');
      const bits = len * Math.log2(pool.length);
      const strength = bits < 40 ? 'Weak' : bits < 60 ? 'Fair' : bits < 80 ? 'Strong' : 'Very strong';
      return {
        primary: { label: 'Password', value: pw, type: 'mono', badge: strength },
        items: [{ label: 'Entropy', value: Math.round(bits), type: 'int', unit: 'bits' }, { label: 'Strength', value: strength, type: 'text' }],
      };
    },
    about: '<p>Passwords are generated locally with <code>crypto.getRandomValues</code> and never leave your device. Aim for at least 80 bits of entropy for important accounts, and use a password manager.</p>',
  },
];
