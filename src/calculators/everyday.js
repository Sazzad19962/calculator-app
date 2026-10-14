import { num, req, opt, parseDate, todayISO, diffYMD, addToDate, validDate, isLeapYear, plural, DAY_MS } from '../util.js';

const fmtDate = (d) => d.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const WEEKENDS = { satsun: [6, 0], frisat: [5, 6], fri: [5], sun: [0], none: [] };
const weekendInput = { id: 'weekend', label: 'Weekend days', type: 'select', value: 'satsun', options: [['satsun', 'Saturday & Sunday'], ['frisat', 'Friday & Saturday (e.g. Bangladesh, Gulf)'], ['fri', 'Friday only'], ['sun', 'Sunday only'], ['none', 'No weekend (count all days)']] };

/** Working days in [a, b) — O(1) regardless of span. */
export function businessDays(a, b, weekend = [6, 0]) {
  const n = Math.round((b - a) / DAY_MS);
  if (n <= 0) return 0;
  const startDow = a.getUTCDay();
  const perWeek = 7 - weekend.length;
  let count = Math.floor(n / 7) * perWeek;
  for (let i = 0; i < n % 7; i++) if (!weekend.includes((startDow + i) % 7)) count++;
  return count;
}

/** Adds (or subtracts) a number of working days, skipping weekend days. */
export function addBusinessDays(date, n, weekend = [6, 0]) {
  if (weekend.length >= 7) throw new Error('At least one working day per week is needed.');
  const step = n < 0 ? -1 : 1;
  let left = Math.abs(n);
  let t = date.getTime();
  // Jump whole weeks first so huge values stay fast.
  const perWeek = 7 - weekend.length;
  const weeks = Math.max(Math.floor(left / perWeek) - 1, 0);
  t += step * weeks * 7 * DAY_MS;
  left -= weeks * perWeek;
  while (left > 0) {
    t += step * DAY_MS;
    if (!weekend.includes(new Date(t).getUTCDay())) left--;
  }
  return new Date(t);
}

/** ISO-8601 week number. */
function isoWeek(d) {
  const t = new Date(d.getTime());
  const day = (t.getUTCDay() + 6) % 7; // Mon = 0
  t.setUTCDate(t.getUTCDate() - day + 3); // Thursday of this week
  const firstThu = new Date(Date.UTC(2000, 0, 4));
  firstThu.setUTCFullYear(t.getUTCFullYear());
  return 1 + Math.round(((t - firstThu) / DAY_MS - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
}
const dayOfYear = (d) => {
  const jan1 = new Date(Date.UTC(2000, 0, 1));
  jan1.setUTCFullYear(d.getUTCFullYear());
  return Math.round((d - jan1) / DAY_MS) + 1;
};

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
      if (!dob) throw new Error('Enter a valid date of birth.');
      if (!on) throw new Error('Enter a valid "age on" date.');
      if (on < dob) throw new Error('Date of birth must be on or before the "age on" date.');
      const d = diffYMD(dob, on);
      const days = Math.round((on - dob) / DAY_MS);
      const leapling = dob.getUTCMonth() === 1 && dob.getUTCDate() === 29;
      let next = addToDate(dob, { years: d.years + 1 });
      if (d.months === 0 && d.days === 0) next = on;
      const toNext = Math.round((next - on) / DAY_MS);
      return {
        primary: { label: 'Age', value: `${plural(d.years, 'year')}, ${plural(d.months, 'month')}, ${plural(d.days, 'day')}`, type: 'text' },
        items: [
          { label: 'Age in years (decimal)', value: (d.years + (d.months + d.days / 30.436875) / 12).toFixed(2), type: 'text' },
          { label: 'Total months', value: d.years * 12 + d.months, type: 'int' },
          { label: 'Total weeks', value: `${Math.floor(days / 7).toLocaleString()} weeks ${days % 7} days`, type: 'text' },
          { label: 'Total days', value: days, type: 'int' },
          { label: 'Total hours', value: days * 24, type: 'int' },
          { label: 'Born on a', value: dob.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long' }), type: 'text' },
          { label: 'Next birthday', value: toNext === 0 ? 'Today! 🎉' : `in ${plural(toNext, 'day')} (${fmtDate(next)})`, type: 'text' },
        ],
        note: leapling ? 'Born on 29 February: in common years your birthday is counted on 28 February here (the convention in many countries; some, like the UK for legal purposes, use 1 March).' : undefined,
      };
    },
    about: '<p>Age is counted in completed calendar years, months and days, the way people normally state their age. When a month is shorter than the birth day (e.g. born on the 31st), the month is treated as complete on its last day. Dates are handled as calendar dates in your own time zone, so the result never shifts by a day because of time zones or daylight saving. For official purposes such as job applications, check whether your organisation counts age on a specific cut-off date — enter it in "Age on".</p>',
  },
  {
    id: 'date-difference',
    name: 'Date Difference Calculator',
    cat: 'everyday',
    icon: '📅',
    desc: 'Days, weeks, months and business days between two dates — with Saturday–Sunday or Friday–Saturday weekends.',
    keywords: 'days between dates duration count days working days business days',
    inputs: [
      { id: 'start', label: 'Start date', type: 'date', value: () => todayISO() },
      { id: 'end', label: 'End date', type: 'date', value: () => `${todayISO().slice(0, 4)}-12-31` },
      { id: 'incl', label: 'Include end date', type: 'checkbox', value: false },
      weekendInput,
    ],
    compute(v) {
      let a = parseDate(v.start);
      let b = parseDate(v.end);
      if (!a) throw new Error('Enter a valid start date.');
      if (!b) throw new Error('Enter a valid end date.');
      const swapped = b < a;
      if (swapped) [a, b] = [b, a];
      const endAdj = v.incl ? new Date(b.getTime() + DAY_MS) : b;
      const days = Math.round((endAdj - a) / DAY_MS);
      const d = diffYMD(a, endAdj);
      const weekend = WEEKENDS[v.weekend] || WEEKENDS.satsun;
      const biz = businessDays(a, endAdj, weekend);
      return {
        primary: { label: 'Difference', value: plural(days, 'day'), type: 'text' },
        items: [
          { label: 'Years, months, days', value: `${plural(d.years, 'year')}, ${plural(d.months, 'month')}, ${plural(d.days, 'day')}`, type: 'text' },
          { label: 'Weeks', value: `${Math.floor(days / 7)} weeks ${plural(days % 7, 'day')}`, type: 'text' },
          { label: 'Business days', value: biz, type: 'int' },
          { label: 'Weekend days', value: days - biz, type: 'int' },
          { label: 'Hours', value: days * 24, type: 'int' },
          { label: 'Minutes', value: days * 1440, type: 'int' },
        ],
        note: swapped ? 'The end date is before the start date, so the dates were swapped.' : undefined,
      };
    },
    about: '<p>The day count is end − start (add one if you include the end date). Business days exclude the weekend days you choose but not public holidays. Dates are compared as calendar dates, so daylight-saving changes never add or lose a day.</p>',
  },
  {
    id: 'date-add',
    name: 'Add / Subtract Days to a Date',
    cat: 'everyday',
    icon: '🗓️',
    desc: 'Find the date a number of years, months, weeks, days or business days before or after a given date.',
    keywords: 'add days to date future date deadline subtract business days',
    inputs: [
      { id: 'start', label: 'Start date', type: 'date', value: () => todayISO() },
      { id: 'op', label: 'Operation', type: 'select', value: '1', options: [['1', 'Add (+)'], ['-1', 'Subtract (−)']] },
      { id: 'y', label: 'Years', type: 'number', value: 0 },
      { id: 'm', label: 'Months', type: 'number', value: 0 },
      { id: 'w', label: 'Weeks', type: 'number', value: 0 },
      { id: 'd', label: 'Days', type: 'number', value: 90 },
      { id: 'biz', label: 'Count days as business days (skip weekends)', type: 'checkbox', value: false, rerender: true },
      { ...weekendInput, showIf: (v) => Boolean(v.biz) },
    ],
    compute(v) {
      const a = parseDate(v.start);
      if (!a) throw new Error('Enter a valid start date.');
      const s = num(v.op) === -1 ? -1 : 1;
      const lim = { int: true, min: -1e6, max: 1e6 };
      const y = opt(v.y, 'Years', lim);
      const m = opt(v.m, 'Months', lim);
      const w = opt(v.w, 'Weeks', lim);
      const d = opt(v.d, 'Days', lim);
      let r = addToDate(a, { years: s * y, months: s * m });
      if (v.biz) {
        const weekend = WEEKENDS[v.weekend] || WEEKENDS.satsun;
        r = addBusinessDays(r, s * (w * (7 - weekend.length) + d), weekend);
      } else {
        r = addToDate(r, { days: s * (w * 7 + d) });
      }
      if (!validDate(r)) throw new Error('The result is outside the supported range (years 1–9999).');
      return {
        primary: { label: 'Resulting date', value: fmtDate(r), type: 'text' },
        items: [
          { label: 'ISO date', value: r.toISOString().slice(0, 10), type: 'text' },
          { label: 'Day of the year', value: `${dayOfYear(r)} of ${isLeapYear(r.getUTCFullYear()) ? 366 : 365}`, type: 'text' },
          { label: 'ISO week number', value: isoWeek(r), type: 'int' },
          { label: 'Calendar days from start', value: Math.round((r - a) / DAY_MS), type: 'int' },
        ],
      };
    },
    about: '<p>Years and months are applied first (clamping to the end of shorter months, e.g. 31 Jan + 1 month = 28/29 Feb), then weeks and days. In business-day mode each week counts as one working week (5 days for a two-day weekend) and the weekend days you choose are skipped; public holidays are not.</p>',
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
      const toMin = (t, label) => {
        const m = String(t ?? '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`Enter a valid ${label} (HH:MM).`);
        return Number(m[1]) * 60 + Number(m[2]) + Number(m[3] || 0) / 60;
      };
      const start = toMin(v.start, 'start time');
      const end = toMin(v.end, 'end time');
      const brk = opt(v.brk, 'Break', { min: 0, max: 1440 });
      let diff = end - start;
      const overnight = diff < 0;
      if (overnight) diff += 1440; // overnight shift
      if (brk > diff) throw new Error('The break is longer than the time worked.');
      diff = Math.round(diff - brk);
      return {
        primary: { label: 'Duration', value: `${Math.floor(diff / 60)} h ${diff % 60} min`, type: 'text' },
        items: [{ label: 'Decimal hours', value: diff / 60, type: 'number2' }, { label: 'Total minutes', value: diff, type: 'int' }],
        note: overnight ? 'The end time is earlier than the start, so the shift is assumed to run past midnight.' : undefined,
      };
    },
    about: '<p>Duration = end − start − break. If the end time is earlier than the start, the shift is assumed to run past midnight. Decimal hours (e.g. 7.50) are what most payroll systems use: minutes ÷ 60.</p>',
  },
  {
    id: 'gpa',
    name: 'GPA Calculator',
    cat: 'everyday',
    icon: '🎓',
    desc: 'Calculate your grade point average on a 4.0 scale from letter grades and credits.',
    keywords: 'gpa cgpa grade point average college university',
    inputs: [{ id: 'courses', label: 'One course per line: [name,] grade, credits', type: 'textarea', value: 'A, 3\nB+, 4\nA-, 3\nB, 2', help: 'Grades: A+ A A- B+ B B- C+ C C- D+ D D- F, or a numeric grade point (e.g. 3.75). Course names are optional, e.g. "Calculus, A-, 3".' }],
    compute(v) {
      let pts = 0;
      let cr = 0;
      const rows = [];
      for (const raw of String(v.courses ?? '').split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const tokens = line.split(/\s*[,\t;]\s*|\s+/).filter(Boolean);
        if (tokens.length < 2) throw new Error(`Could not read line: "${line}" — use "grade, credits".`);
        const c = tokens.at(-1);
        const g = tokens.at(-2).toUpperCase();
        const name = tokens.slice(0, -2).join(' ');
        const credits = Number(c);
        const gp = GRADE_POINTS[g] ?? (/^\d+(\.\d+)?$/.test(g) ? Number(g) : null);
        if (gp === null) throw new Error(`"${tokens.at(-2)}" is not a grade (line "${line}").`);
        if (gp > 5) throw new Error(`Grade point ${gp} is above the scale (line "${line}").`);
        if (!Number.isFinite(credits) || credits <= 0 || credits > 50) throw new Error(`"${c}" is not a valid number of credits (line "${line}").`);
        pts += gp * credits;
        cr += credits;
        rows.push([name || g, g, credits, gp]);
      }
      if (!cr) throw new Error('Add at least one course.');
      return {
        primary: { label: 'GPA', value: pts / cr, type: 'number2' },
        items: [{ label: 'Total credits', value: cr, type: 'number' }, { label: 'Quality points', value: pts, type: 'number' }],
        table: { title: 'Courses', head: ['Course', 'Grade', 'Credits', 'Points'], types: ['text', 'text', 'number', 'number'], rows },
      };
    },
    about: '<p>GPA = Σ(grade points × credits) ÷ Σ credits. Uses the common US 4.0 scale (A+ counts as 4.0, as at most US colleges); enter numeric grade points directly if your university uses a different scale, such as the 4.0 CGPA scale used in Bangladesh.</p>',
  },
  {
    id: 'fuel-cost',
    name: 'Fuel Cost Calculator',
    cat: 'everyday',
    icon: '⛽',
    desc: 'Trip fuel cost from distance, fuel efficiency and fuel price — in km/L, L/100 km or miles per gallon.',
    keywords: 'gas petrol trip cost mileage mpg km per litre l/100km',
    inputs: [
      { id: 'units', label: 'Units', type: 'select', value: 'kmpl', rerender: true, options: [['kmpl', 'km and km per litre'], ['l100', 'km and litres per 100 km'], ['mpg', 'miles and miles per US gallon']] },
      { id: 'dist', label: 'Trip distance', type: 'number', value: 250, labelFn: (v) => (v.units === 'mpg' ? 'Trip distance (miles)' : 'Trip distance (km)') },
      { id: 'eff', label: 'Fuel efficiency', type: 'number', value: 12, labelFn: (v) => (v.units === 'mpg' ? 'Fuel efficiency (mpg)' : v.units === 'l100' ? 'Fuel consumption (L/100 km)' : 'Fuel efficiency (km/L)') },
      { id: 'price', label: 'Fuel price per litre', type: 'number', value: 1.5, money: true, step: 0.01, labelFn: (v) => (v.units === 'mpg' ? 'Fuel price per gallon' : 'Fuel price per litre') },
      { id: 'round', label: 'Round trip', type: 'checkbox', value: false },
    ],
    compute(v) {
      const units = ['l100', 'mpg'].includes(v.units) ? v.units : 'kmpl';
      const dist = req(v.dist, 'Trip distance', { min: 0 });
      const eff = req(v.eff, units === 'l100' ? 'Fuel consumption' : 'Fuel efficiency', { gt: 0 });
      const price = req(v.price, 'Fuel price', { min: 0 });
      const d = dist * (v.round ? 2 : 1);
      const fuel = units === 'l100' ? d * eff / 100 : d / eff;
      const unit = units === 'mpg' ? 'gal' : 'L';
      const per = units === 'mpg' ? 'mile' : 'km';
      return {
        primary: { label: 'Fuel cost', value: fuel * price, type: 'money' },
        items: [
          { label: 'Fuel needed', value: fuel, type: 'number2', unit },
          { label: `Cost per ${per}`, value: d ? fuel * price / d : 0, type: 'money2' },
          { label: 'Total distance', value: d, type: 'number', unit: per === 'km' ? 'km' : 'mi' },
        ],
      };
    },
    about: '<p>Fuel needed = distance ÷ efficiency (or distance × L/100 km ÷ 100). Cost = fuel needed × price. To convert: L/100 km = 100 ÷ km/L, and 1 US mpg = 0.4251 km/L.</p>',
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
      const watts = req(v.watts, 'Power', { min: 0 });
      const hours = req(v.hours, 'Hours used per day', { min: 0, max: 24 });
      const qty = opt(v.qty, 'Quantity', { min: 0, def: 1 });
      const price = req(v.price, 'Price per kWh', { min: 0 });
      const kwhDay = watts * hours * qty / 1000;
      const c = kwhDay * price;
      const month = 365 / 12;
      return {
        primary: { label: 'Monthly cost', value: c * month, type: 'money' },
        items: [
          { label: 'Daily cost', value: c, type: 'money2' },
          { label: 'Yearly cost', value: c * 365, type: 'money' },
          { label: 'Energy per day', value: kwhDay, type: 'number2', unit: 'kWh' },
          { label: 'Energy per month', value: kwhDay * month, type: 'number1', unit: 'kWh' },
          { label: 'Energy per year', value: kwhDay * 365, type: 'number', unit: 'kWh' },
        ],
      };
    },
    about: '<p>kWh = watts × hours ÷ 1000. A month is taken as the average 365 ÷ 12 ≈ 30.42 days. Many utilities use tiered (slab) pricing and add fixed charges and taxes, so your real bill may differ.</p>',
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
      const len = req(v.len, 'Length', { min: 4, max: 128, int: true });
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
