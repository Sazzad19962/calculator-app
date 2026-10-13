import { num, parseDate, addToDate, isoDate, todayISO, DAY_MS } from '../util.js';

const unitInput = { id: 'units', label: 'Units', type: 'select', value: 'metric', rerender: true, options: [['metric', 'Metric (kg, cm)'], ['imperial', 'US (lb, ft/in)']] };
const sexInput = { id: 'sex', label: 'Sex', type: 'select', value: 'male', options: [['male', 'Male'], ['female', 'Female']], rerender: true };
const metric = (v) => v.units !== 'imperial';
const imperial = (v) => v.units === 'imperial';
const bodyInputs = [
  { id: 'kg', label: 'Weight', type: 'number', value: 70, suffix: 'kg', showIf: metric },
  { id: 'cm', label: 'Height', type: 'number', value: 175, suffix: 'cm', showIf: metric },
  { id: 'lb', label: 'Weight', type: 'number', value: 154, suffix: 'lb', showIf: imperial },
  { id: 'ft', label: 'Height (feet)', type: 'number', value: 5, suffix: 'ft', showIf: imperial },
  { id: 'in', label: 'Height (inches)', type: 'number', value: 9, suffix: 'in', showIf: imperial },
];

/** Normalises weight/height inputs to kg and cm. */
function body(v) {
  if (imperial(v)) return { kg: num(v.lb) * 0.45359237, cm: (num(v.ft) * 12 + num(v.in)) * 2.54 };
  return { kg: num(v.kg), cm: num(v.cm) };
}

function bmr(sex, kg, cm, age) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5);
}

const activity = [
  ['1.2', 'Sedentary (little or no exercise)'],
  ['1.375', 'Light (1–3 days/week)'],
  ['1.55', 'Moderate (3–5 days/week)'],
  ['1.725', 'Active (6–7 days/week)'],
  ['1.9', 'Very active (physical job)'],
];

export default [
  {
    id: 'bmi',
    name: 'BMI Calculator',
    cat: 'health',
    icon: '⚖️',
    desc: 'Body Mass Index with WHO category and your healthy weight range.',
    keywords: 'body mass index weight height obesity overweight',
    inputs: [unitInput, ...bodyInputs],
    compute(v) {
      const { kg, cm } = body(v);
      if (kg <= 0 || cm <= 0) throw new Error('Enter a valid weight and height.');
      const m = cm / 100;
      const bmi = kg / (m * m);
      const cat = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : bmi < 35 ? 'Obese (Class I)' : bmi < 40 ? 'Obese (Class II)' : 'Obese (Class III)';
      const lo = 18.5 * m * m;
      const hi = 24.9 * m * m;
      const w = (x) => (imperial(v) ? `${(x / 0.45359237).toFixed(1)} lb` : `${x.toFixed(1)} kg`);
      return {
        primary: { label: 'Your BMI', value: bmi, type: 'number1', badge: cat },
        items: [
          { label: 'Category', value: cat, type: 'text' },
          { label: 'Healthy weight range', value: `${w(lo)} – ${w(hi)}`, type: 'text' },
          { label: 'BMI Prime', value: bmi / 25, type: 'number2' },
        ],
        gauge: { value: bmi, min: 15, max: 40, bands: [[18.5, 'Under'], [25, 'Normal'], [30, 'Over'], [40, 'Obese']] },
      };
    },
    about: `<p><code>BMI = weight (kg) ÷ height (m)²</code>. WHO adult categories: under 18.5 underweight, 18.5–24.9 normal,
      25–29.9 overweight, 30+ obese. Some Asian health bodies use lower cut-offs (23 for overweight, 27.5 for obese).
      BMI does not distinguish muscle from fat, so athletes may show a high BMI while being healthy.</p>`,
  },
  {
    id: 'calorie',
    name: 'Calorie Calculator',
    cat: 'health',
    icon: '🔥',
    desc: 'Daily calorie needs (TDEE) to maintain, lose or gain weight, using the Mifflin–St Jeor equation.',
    keywords: 'tdee bmr calories diet weight loss maintenance',
    inputs: [unitInput, sexInput, { id: 'age', label: 'Age', type: 'number', value: 30, suffix: 'years' }, ...bodyInputs,
      { id: 'act', label: 'Activity level', type: 'select', value: '1.55', options: activity }],
    compute(v) {
      const { kg, cm } = body(v);
      const b = bmr(v.sex, kg, cm, num(v.age));
      const tdee = b * num(v.act);
      const goals = [
        ['Extreme weight loss (−1 kg/week)', tdee - 1100],
        ['Weight loss (−0.5 kg/week)', tdee - 550],
        ['Mild weight loss (−0.25 kg/week)', tdee - 275],
        ['Maintain weight', tdee],
        ['Mild weight gain (+0.25 kg/week)', tdee + 275],
        ['Weight gain (+0.5 kg/week)', tdee + 550],
      ];
      return {
        primary: { label: 'Maintenance calories', value: Math.round(tdee), type: 'int', unit: 'kcal/day' },
        items: [{ label: 'BMR (at rest)', value: Math.round(b), type: 'int', unit: 'kcal' }],
        table: { title: 'Calories by goal', head: ['Goal', 'Calories / day'], types: ['text', 'int'], rows: goals.map(([g, c]) => [g, Math.round(Math.max(c, v.sex === 'female' ? 1200 : 1500))]) },
        note: 'Very low calorie diets should only be followed under medical supervision. Minimums of 1,200 (women) / 1,500 (men) kcal are applied.',
      };
    },
    about: `<p>BMR (Mifflin–St Jeor): men <code>10W + 6.25H − 5A + 5</code>, women <code>10W + 6.25H − 5A − 161</code>
      (W in kg, H in cm, A in years). Total daily energy expenditure (TDEE) is BMR multiplied by an activity factor.
      About 7,700 kcal equals 1 kg of body fat.</p>`,
  },
  {
    id: 'bmr',
    name: 'BMR Calculator',
    cat: 'health',
    icon: '🫀',
    desc: 'Basal Metabolic Rate — calories your body burns at complete rest — with three formulas.',
    keywords: 'basal metabolic rate harris benedict katch',
    inputs: [unitInput, sexInput, { id: 'age', label: 'Age', type: 'number', value: 30, suffix: 'years' }, ...bodyInputs],
    compute(v) {
      const { kg, cm } = body(v);
      const age = num(v.age);
      const msj = bmr(v.sex, kg, cm, age);
      const hb = v.sex === 'female' ? 447.593 + 9.247 * kg + 3.098 * cm - 4.33 * age : 88.362 + 13.397 * kg + 4.799 * cm - 5.677 * age;
      return {
        primary: { label: 'BMR (Mifflin–St Jeor)', value: Math.round(msj), type: 'int', unit: 'kcal/day' },
        items: [{ label: 'Revised Harris–Benedict', value: Math.round(hb), type: 'int', unit: 'kcal/day' }],
      };
    },
    about: '<p>Mifflin–St Jeor is considered the most accurate for most people. Harris–Benedict (revised 1984) is shown for comparison.</p>',
  },
  {
    id: 'body-fat',
    name: 'Body Fat Calculator',
    cat: 'health',
    icon: '📏',
    desc: 'Estimate body fat percentage with the U.S. Navy tape-measure method.',
    keywords: 'body fat percentage navy method waist neck',
    inputs: [sexInput,
      { id: 'cm', label: 'Height', type: 'number', value: 178, suffix: 'cm' },
      { id: 'neck', label: 'Neck', type: 'number', value: 38, suffix: 'cm' },
      { id: 'waist', label: 'Waist (at navel)', type: 'number', value: 85, suffix: 'cm' },
      { id: 'hip', label: 'Hip', type: 'number', value: 95, suffix: 'cm', showIf: (v) => v.sex === 'female' }],
    compute(v) {
      const h = num(v.cm);
      const n = num(v.neck);
      const w = num(v.waist);
      const hip = num(v.hip);
      let bf;
      if (v.sex === 'female') {
        if (w + hip - n <= 0) throw new Error('Waist + hip must be larger than neck.');
        bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450;
      } else {
        if (w - n <= 0) throw new Error('Waist must be larger than neck.');
        bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
      }
      const f = v.sex === 'female';
      const cat = bf < (f ? 14 : 6) ? 'Essential fat' : bf < (f ? 21 : 14) ? 'Athletes' : bf < (f ? 25 : 18) ? 'Fitness' : bf < (f ? 32 : 25) ? 'Average' : 'Obese';
      return {
        primary: { label: 'Body fat', value: bf, type: 'percent', badge: cat },
        items: [{ label: 'Category (ACE)', value: cat, type: 'text' }],
      };
    },
    about: '<p>The U.S. Navy formula estimates body fat from circumference measurements and height. Measure at the narrowest point of the neck, at the navel for the waist, and the widest point of the hips.</p>',
  },
  {
    id: 'ideal-weight',
    name: 'Ideal Weight Calculator',
    cat: 'health',
    icon: '🧍',
    desc: 'Ideal body weight from four well-known medical formulas.',
    keywords: 'ideal body weight devine robinson miller hamwi',
    inputs: [sexInput, { id: 'cm', label: 'Height', type: 'number', value: 175, suffix: 'cm' }],
    compute(v) {
      const inchesOver = Math.max(num(v.cm) / 2.54 - 60, 0);
      const f = v.sex === 'female';
      const r = {
        Robinson: (f ? 49 : 52) + (f ? 1.7 : 1.9) * inchesOver,
        Miller: (f ? 53.1 : 56.2) + (f ? 1.36 : 1.41) * inchesOver,
        Devine: (f ? 45.5 : 50) + 2.3 * inchesOver,
        Hamwi: (f ? 45.5 : 48) + (f ? 2.2 : 2.7) * inchesOver,
      };
      const vals = Object.values(r);
      return {
        primary: { label: 'Ideal weight (average)', value: vals.reduce((a, b) => a + b) / vals.length, type: 'number1', unit: 'kg' },
        items: Object.entries(r).map(([k, val]) => ({ label: `${k} formula`, value: val, type: 'number1', unit: 'kg' })),
      };
    },
    about: '<p>These formulas were developed for drug dosing and give a rough guide only. They are based on height above 5 feet (152.4 cm).</p>',
  },
  {
    id: 'pace',
    name: 'Pace Calculator',
    cat: 'health',
    icon: '🏃',
    desc: 'Running or cycling pace and speed from distance and time.',
    keywords: 'running pace marathon speed min per km',
    inputs: [
      { id: 'dist', label: 'Distance', type: 'number', value: 10, step: 0.01 },
      { id: 'unit', label: 'Distance unit', type: 'select', value: 'km', options: [['km', 'Kilometres'], ['mi', 'Miles']] },
      { id: 'h', label: 'Hours', type: 'number', value: 0 },
      { id: 'm', label: 'Minutes', type: 'number', value: 50 },
      { id: 's', label: 'Seconds', type: 'number', value: 0 },
    ],
    compute(v) {
      const km = num(v.dist) * (v.unit === 'mi' ? 1.609344 : 1);
      const sec = num(v.h) * 3600 + num(v.m) * 60 + num(v.s);
      if (km <= 0 || sec <= 0) throw new Error('Enter a distance and time.');
      const fmt = (s) => {
        const mm = Math.floor(s / 60);
        const ss = Math.round(s % 60);
        return ss === 60 ? `${mm + 1}:00` : `${mm}:${String(ss).padStart(2, '0')}`;
      };
      const perKm = sec / km;
      const finish = (d) => {
        const t = perKm * d;
        return `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
      };
      return {
        primary: { label: 'Pace', value: `${fmt(perKm)} /km`, type: 'text' },
        items: [
          { label: 'Pace per mile', value: `${fmt(perKm * 1.609344)} /mi`, type: 'text' },
          { label: 'Speed', value: km / (sec / 3600), type: 'number2', unit: 'km/h' },
          { label: 'Speed (mph)', value: km / 1.609344 / (sec / 3600), type: 'number2', unit: 'mph' },
        ],
        table: { title: 'Projected finish times at this pace', head: ['Race', 'Time'], types: ['text', 'text'], rows: [['5K', finish(5)], ['10K', finish(10)], ['Half marathon', finish(21.0975)], ['Marathon', finish(42.195)]] },
      };
    },
    about: '<p>Pace = time ÷ distance. Speed = distance ÷ time.</p>',
  },
  {
    id: 'due-date',
    name: 'Pregnancy Due Date Calculator',
    cat: 'health',
    icon: '🤰',
    desc: 'Estimate your baby\'s due date and current week of pregnancy from your last period.',
    keywords: 'pregnancy due date conception weeks lmp',
    inputs: [
      { id: 'lmp', label: 'First day of last period', type: 'date', value: () => isoDate(addToDate(parseDate(todayISO()), { days: -70 })) },
      { id: 'cycle', label: 'Average cycle length', type: 'number', value: 28, suffix: 'days' },
    ],
    compute(v) {
      const lmp = parseDate(v.lmp);
      if (!lmp) throw new Error('Pick a valid date.');
      const adj = num(v.cycle) - 28;
      const due = addToDate(lmp, { days: 280 + adj });
      const conception = addToDate(lmp, { days: 14 + adj });
      const today = parseDate(todayISO());
      const gestDays = Math.floor((today - lmp) / DAY_MS) - adj;
      const fmt = (d) => d.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
      return {
        primary: { label: 'Estimated due date', value: fmt(due), type: 'text' },
        items: [
          { label: 'Current gestational age', value: gestDays >= 0 && gestDays < 300 ? `${Math.floor(gestDays / 7)} weeks ${gestDays % 7} days` : '—', type: 'text' },
          { label: 'Estimated conception', value: fmt(conception), type: 'text' },
          { label: 'Trimester', value: gestDays < 0 || gestDays >= 300 ? '—' : gestDays < 98 ? 'First' : gestDays < 196 ? 'Second' : 'Third', type: 'text' },
        ],
        note: 'Only about 4% of babies arrive on their due date. Always follow your doctor\'s advice.',
      };
    },
    about: '<p>Uses Naegele\'s rule: due date = first day of last menstrual period + 280 days, adjusted for cycles longer or shorter than 28 days.</p>',
  },
  {
    id: 'heart-rate',
    name: 'Heart Rate Zone Calculator',
    cat: 'health',
    icon: '❤️',
    desc: 'Target heart-rate training zones using the Karvonen (heart rate reserve) method.',
    keywords: 'target heart rate max hr zones cardio',
    inputs: [
      { id: 'age', label: 'Age', type: 'number', value: 30 },
      { id: 'rest', label: 'Resting heart rate', type: 'number', value: 65, suffix: 'bpm' },
    ],
    compute(v) {
      const max = 208 - 0.7 * num(v.age);
      const hrr = max - num(v.rest);
      const z = (lo, hi) => `${Math.round(num(v.rest) + hrr * lo)} – ${Math.round(num(v.rest) + hrr * hi)} bpm`;
      return {
        primary: { label: 'Maximum heart rate', value: Math.round(max), type: 'int', unit: 'bpm' },
        items: [{ label: 'Heart rate reserve', value: Math.round(hrr), type: 'int', unit: 'bpm' }],
        table: {
          title: 'Training zones', head: ['Zone', 'Intensity', 'Heart rate'], types: ['text', 'text', 'text'],
          rows: [['1 – Recovery', '50–60%', z(0.5, 0.6)], ['2 – Endurance', '60–70%', z(0.6, 0.7)], ['3 – Aerobic', '70–80%', z(0.7, 0.8)], ['4 – Threshold', '80–90%', z(0.8, 0.9)], ['5 – Maximum', '90–100%', z(0.9, 1)]],
        },
      };
    },
    about: '<p>Max HR uses the Tanaka formula <code>208 − 0.7 × age</code>. Zones = resting HR + intensity × (max HR − resting HR).</p>',
  },
];
