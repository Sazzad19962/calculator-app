import { req, opt, parseDate, addToDate, isoDate, todayISO, DAY_MS } from '../util.js';

const LB = 0.45359237; // kg per pound (exact, international avoirdupois pound)
const IN = 2.54; // cm per inch (exact)

const unitInput = { id: 'units', label: 'Units', type: 'select', value: 'metric', rerender: true, options: [['metric', 'Metric (kg, cm)'], ['imperial', 'US (lb, ft/in)']] };
const sexInput = { id: 'sex', label: 'Sex', type: 'select', value: 'male', options: [['male', 'Male'], ['female', 'Female']], rerender: true };
const metric = (v) => v.units !== 'imperial';
const imperial = (v) => v.units === 'imperial';
const weightInputs = [
  { id: 'kg', label: 'Weight', type: 'number', value: 70, suffix: 'kg', showIf: metric },
  { id: 'lb', label: 'Weight', type: 'number', value: 154, suffix: 'lb', showIf: imperial },
];
const heightInputs = [
  { id: 'cm', label: 'Height', type: 'number', value: 175, suffix: 'cm', showIf: metric },
  { id: 'ft', label: 'Height (feet)', type: 'number', value: 5, suffix: 'ft', showIf: imperial },
  { id: 'in', label: 'Height (inches)', type: 'number', value: 9, suffix: 'in', showIf: imperial },
];
const bodyInputs = [weightInputs[0], heightInputs[0], weightInputs[1], heightInputs[1], heightInputs[2]];

/** Height in cm from metric or US inputs, validated. */
function heightCm(v) {
  const cm = imperial(v)
    ? (req(v.ft, 'Height (feet)', { min: 0, max: 9 }) * 12 + opt(v.in, 'Height (inches)', { min: 0, max: 120 })) * IN
    : req(v.cm, 'Height', { min: 0 });
  if (cm < 30 || cm > 280) throw new Error(imperial(v) ? 'Enter a height between 1 ft and 9 ft 2 in.' : 'Enter a height between 30 and 280 cm.');
  return cm;
}

/** Weight in kg from metric or US inputs, validated. */
function weightKg(v) {
  const kg = imperial(v) ? req(v.lb, 'Weight', { gt: 0 }) * LB : req(v.kg, 'Weight', { gt: 0 });
  if (kg < 1 || kg > 700) throw new Error(imperial(v) ? 'Enter a weight between 2 and 1,500 lb.' : 'Enter a weight between 1 and 700 kg.');
  return kg;
}

/** Normalises weight/height inputs to kg and cm. */
const body = (v) => ({ kg: weightKg(v), cm: heightCm(v) });

const ageField = (v, lo = 1, hi = 120) => req(v, 'Age', { min: lo, max: hi });

/** Mifflin–St Jeor (1990). */
function mifflin(sex, kg, cm, age) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5);
}
/** Revised Harris–Benedict (Roza & Shizgal, 1984). */
function harris(sex, kg, cm, age) {
  return sex === 'female' ? 447.593 + 9.247 * kg + 3.098 * cm - 4.33 * age : 88.362 + 13.397 * kg + 4.799 * cm - 5.677 * age;
}
/** Katch–McArdle: uses lean body mass. */
const katch = (kg, bfPct) => 370 + 21.6 * kg * (1 - bfPct / 100);

const activity = [
  ['1.2', 'Sedentary (little or no exercise)'],
  ['1.375', 'Light (1–3 days/week)'],
  ['1.55', 'Moderate (3–5 days/week)'],
  ['1.725', 'Active (6–7 days/week)'],
  ['1.9', 'Very active (physical job or 2×/day)'],
];
const formulaInput = { id: 'formula', label: 'BMR formula', type: 'select', value: 'msj', rerender: true, options: [['msj', 'Mifflin–St Jeor'], ['hb', 'Revised Harris–Benedict'], ['km', 'Katch–McArdle (needs body fat %)']] };
const bfInput = { id: 'bf', label: 'Body fat', type: 'number', value: 20, suffix: '%', showIf: (v) => v.formula === 'km' };

function chosenBmr(v, kg, cm, age) {
  if (v.formula === 'km') return katch(kg, req(v.bf, 'Body fat', { min: 2, max: 70 }));
  if (v.formula === 'hb') return harris(v.sex, kg, cm, age);
  return mifflin(v.sex, kg, cm, age);
}

// Balanced macronutrient split inside the US Acceptable Macronutrient Distribution Ranges
// (carbs 45–65%, protein 10–35%, fat 20–35% of energy).
const MACROS = { protein: 0.2, carbs: 0.5, fat: 0.3 };
const macroGrams = (kcal) => [kcal * MACROS.protein / 4, kcal * MACROS.carbs / 4, kcal * MACROS.fat / 9];

export default [
  {
    id: 'bmi',
    name: 'BMI Calculator',
    cat: 'health',
    icon: '⚖️',
    desc: 'Body Mass Index with WHO category, BMI Prime and your healthy weight range.',
    keywords: 'body mass index weight height obesity overweight',
    inputs: [unitInput, ...bodyInputs, { id: 'age', label: 'Age', type: 'number', value: 30, suffix: 'years', help: 'Adult categories apply from age 20. Children and teens use BMI-for-age percentiles.' }],
    compute(v) {
      const { kg, cm } = body(v);
      const age = opt(v.age, 'Age', { min: 0, max: 120, def: 30 });
      const m = cm / 100;
      const bmi = kg / (m * m);
      const cat = bmi < 16 ? 'Severe thinness' : bmi < 17 ? 'Moderate thinness' : bmi < 18.5 ? 'Mild thinness' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : bmi < 35 ? 'Obese (Class I)' : bmi < 40 ? 'Obese (Class II)' : 'Obese (Class III)';
      const lo = 18.5 * m * m;
      const hi = 25 * m * m;
      const w = (x) => (imperial(v) ? `${(x / LB).toFixed(1)} lb` : `${x.toFixed(1)} kg`);
      const child = age < 20;
      const items = [
        { label: child ? 'Category (adult scale — see note)' : 'Category', value: cat, type: 'text' },
        { label: 'Healthy weight range', value: `${w(lo)} – ${w(hi)}`, type: 'text' },
        { label: 'BMI Prime', value: bmi / 25, type: 'number2' },
        { label: 'Ponderal index', value: kg / (m * m * m), type: 'number1', unit: 'kg/m³' },
      ];
      if (bmi < 18.5) items.push({ label: 'Gain to reach BMI 18.5', value: w(lo - kg), type: 'text' });
      else if (bmi >= 25) items.push({ label: 'Lose to reach BMI 25', value: w(kg - hi), type: 'text' });
      return {
        primary: { label: 'Your BMI', value: bmi, type: 'number1', badge: child ? 'Child/teen' : cat },
        items,
        gauge: { value: bmi, min: 15, max: 40, bands: [[18.5, 'Under'], [25, 'Normal'], [30, 'Over'], [40, 'Obese']] },
        note: age < 2
          ? 'BMI is not used for children under 2; doctors use weight-for-length charts instead.'
          : child
            ? 'For children and teens aged 2–19, the adult categories do not apply. BMI is compared with others of the same age and sex on the CDC (US) or WHO BMI-for-age growth charts: under the 5th percentile is underweight, 85th–95th overweight and 95th or above obesity. Ask a paediatrician to interpret it.'
            : undefined,
      };
    },
    about: `<p><code>BMI = weight (kg) ÷ height (m)²</code> (US units: <code>703 × lb ÷ in²</code>). WHO adult categories: under 18.5
      underweight (16–17 moderate, under 16 severe thinness), 18.5–24.9 normal, 25–29.9 overweight, 30+ obese (classes I, II and III
      start at 30, 35 and 40). Some Asian health bodies use lower cut-offs (23 for overweight, 27.5 for obese).
      BMI Prime is BMI ÷ 25; the Ponderal index (kg/m³) scales better for very tall or short people.</p>
      <p><strong>Children and teens:</strong> for ages 2–19, BMI must be read on sex-specific BMI-for-age percentile charts
      (<a href="https://www.cdc.gov/bmi/child-teen-calculator/" rel="nofollow noopener">CDC</a>,
      <a href="https://www.who.int/tools/growth-reference-data-for-5to19-years" rel="nofollow noopener">WHO</a>) rather than the adult categories.</p>
      <p>BMI does not distinguish muscle from fat, so athletes may show a high BMI while being healthy, and it is not designed for pregnant women.</p>`,
  },
  {
    id: 'calorie',
    name: 'Calorie Calculator',
    cat: 'health',
    icon: '🔥',
    desc: 'Daily calorie needs (TDEE) to maintain, lose or gain weight, with protein, carb and fat targets.',
    keywords: 'tdee bmr calories diet weight loss maintenance macros protein carbs fat',
    inputs: [unitInput, sexInput, { id: 'age', label: 'Age', type: 'number', value: 30, suffix: 'years' }, ...bodyInputs,
      { id: 'act', label: 'Activity level', type: 'select', value: '1.55', options: activity }, formulaInput, bfInput],
    compute(v) {
      const { kg, cm } = body(v);
      const age = ageField(v.age, 1, 120);
      const act = Number(v.act) || 1.55;
      const b = chosenBmr(v, kg, cm, age);
      const tdee = b * act;
      const floor = v.sex === 'female' ? 1200 : 1500;
      const goals = [
        ['Extreme weight loss (−1 kg / 2.2 lb a week)', tdee - 1100],
        ['Weight loss (−0.5 kg / 1.1 lb a week)', tdee - 550],
        ['Mild weight loss (−0.25 kg / 0.55 lb a week)', tdee - 275],
        ['Maintain weight', tdee],
        ['Mild weight gain (+0.25 kg / 0.55 lb a week)', tdee + 275],
        ['Weight gain (+0.5 kg / 1.1 lb a week)', tdee + 550],
      ];
      let clamped = false;
      const rows = goals.map(([g, c]) => {
        const kcal = Math.round(Math.max(c, floor));
        if (c < floor) clamped = true;
        return [c < floor ? `${g} *` : g, kcal, ...macroGrams(kcal).map(Math.round)];
      });
      const [p, c, f] = macroGrams(tdee);
      const notes = [];
      if (age < 15 || age > 80) notes.push('These equations were developed for adults aged roughly 15–80; results outside that range are less reliable.');
      if (clamped) notes.push(`* Raised to the ${floor.toLocaleString()} kcal/day minimum generally advised without medical supervision.`);
      notes.push('Macros use a balanced 20% protein / 50% carbohydrate / 30% fat split.');
      return {
        primary: { label: 'Maintenance calories', value: Math.round(tdee), type: 'int', unit: 'kcal/day' },
        items: [
          { label: 'BMR (at rest)', value: Math.round(b), type: 'int', unit: 'kcal' },
          { label: 'Protein', value: Math.round(p), type: 'int', unit: 'g/day' },
          { label: 'Carbohydrate', value: Math.round(c), type: 'int', unit: 'g/day' },
          { label: 'Fat', value: Math.round(f), type: 'int', unit: 'g/day' },
        ],
        table: { title: 'Calories and macros by goal', head: ['Goal', 'kcal / day', 'Protein (g)', 'Carbs (g)', 'Fat (g)'], types: ['text', 'int', 'int', 'int', 'int'], rows },
        note: notes.join(' '),
      };
    },
    about: `<p>BMR (Mifflin–St Jeor, 1990): men <code>10W + 6.25H − 5A + 5</code>, women <code>10W + 6.25H − 5A − 161</code>
      (W in kg, H in cm, A in years). The revised Harris–Benedict and Katch–McArdle (<code>370 + 21.6 × lean mass in kg</code>,
      best if you know your body-fat percentage) equations are available too. Total daily energy expenditure (TDEE) is BMR
      multiplied by an activity factor (1.2 sedentary to 1.9 very active).</p>
      <p>About 7,700 kcal equals 1 kg of body fat (≈ 3,500 kcal per lb), so a 550 kcal daily deficit loses roughly 0.5 kg a week.
      Macronutrients use 4 kcal per gram of protein and carbohydrate and 9 kcal per gram of fat, split within the
      <a href="https://www.nationalacademies.org/our-work/dietary-reference-intakes-for-energy-carbohydrate-fiber-fat-fatty-acids-cholesterol-protein-and-amino-acids" rel="nofollow noopener">Acceptable Macronutrient Distribution Ranges</a>.</p>`,
  },
  {
    id: 'bmr',
    name: 'BMR Calculator',
    cat: 'health',
    icon: '🫀',
    desc: 'Basal Metabolic Rate — calories your body burns at complete rest — with three formulas and daily needs by activity.',
    keywords: 'basal metabolic rate harris benedict katch mcardle mifflin',
    inputs: [unitInput, sexInput, { id: 'age', label: 'Age', type: 'number', value: 30, suffix: 'years' }, ...bodyInputs,
      { id: 'bf', label: 'Body fat (optional, for Katch–McArdle)', type: 'number', value: '', suffix: '%' }],
    compute(v) {
      const { kg, cm } = body(v);
      const age = ageField(v.age, 1, 120);
      const msj = mifflin(v.sex, kg, cm, age);
      const hb = harris(v.sex, kg, cm, age);
      const bf = opt(v.bf, 'Body fat', { min: 2, max: 70, def: null });
      const items = [{ label: 'Revised Harris–Benedict', value: Math.round(hb), type: 'int', unit: 'kcal/day' }];
      if (bf !== null) items.push({ label: 'Katch–McArdle', value: Math.round(katch(kg, bf)), type: 'int', unit: 'kcal/day' });
      return {
        primary: { label: 'BMR (Mifflin–St Jeor)', value: Math.round(msj), type: 'int', unit: 'kcal/day' },
        items,
        table: { title: 'Daily calories by activity level', head: ['Activity', 'kcal / day'], types: ['text', 'int'], rows: activity.map(([f, l]) => [l, Math.round(msj * Number(f))]) },
      };
    },
    about: '<p>Mifflin–St Jeor (<code>10W + 6.25H − 5A + 5</code> for men, <code>− 161</code> for women) is considered the most accurate for most people. The revised Harris–Benedict (Roza &amp; Shizgal, 1984) is shown for comparison, and Katch–McArdle (<code>370 + 21.6 × lean body mass</code>) if you enter your body-fat percentage.</p>',
  },
  {
    id: 'body-fat',
    name: 'Body Fat Calculator',
    cat: 'health',
    icon: '📏',
    desc: 'Estimate body fat percentage with the U.S. Navy tape-measure method, plus fat mass, lean mass and the BMI method.',
    keywords: 'body fat percentage navy method waist neck lean mass',
    inputs: [sexInput,
      { id: 'units', label: 'Units', type: 'select', value: 'metric', rerender: true, options: [['metric', 'Metric (cm, kg)'], ['imperial', 'US (in, lb)']] },
      { id: 'cm', label: 'Height', type: 'number', value: 178, labelFn: (v) => (imperial(v) ? 'Height (in)' : 'Height (cm)') },
      { id: 'neck', label: 'Neck', type: 'number', value: 38, labelFn: (v) => (imperial(v) ? 'Neck (in)' : 'Neck (cm)') },
      { id: 'waist', label: 'Waist (at navel)', type: 'number', value: 85, labelFn: (v) => (imperial(v) ? 'Waist at navel (in)' : 'Waist at navel (cm)') },
      { id: 'hip', label: 'Hip', type: 'number', value: 95, showIf: (v) => v.sex === 'female', labelFn: (v) => (imperial(v) ? 'Hip (in)' : 'Hip (cm)') },
      { id: 'weight', label: 'Weight (optional)', type: 'number', value: '', labelFn: (v) => (imperial(v) ? 'Weight (lb, optional)' : 'Weight (kg, optional)') },
      { id: 'age', label: 'Age (optional)', type: 'number', value: '' }],
    compute(v) {
      const f = v.sex === 'female';
      const toCm = imperial(v) ? IN : 1;
      const h = req(v.cm, 'Height', { gt: 0 }) * toCm;
      const n = req(v.neck, 'Neck', { gt: 0 }) * toCm;
      const w = req(v.waist, 'Waist', { gt: 0 }) * toCm;
      const hip = f ? req(v.hip, 'Hip', { gt: 0 }) * toCm : 0;
      if (h < 50 || h > 280) throw new Error('Check the height — it should be in ' + (imperial(v) ? 'inches (e.g. 70).' : 'centimetres (e.g. 178).'));
      let bf;
      if (f) {
        if (w + hip - n <= 0) throw new Error('Waist + hip must be larger than neck.');
        bf = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450;
      } else {
        if (w - n <= 0) throw new Error('Waist must be larger than neck.');
        bf = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
      }
      if (!(bf > 0 && bf < 75)) throw new Error('These measurements give an implausible result — please re-measure (all values in the same unit).');
      const cat = bf < (f ? 14 : 6) ? 'Essential fat' : bf < (f ? 21 : 14) ? 'Athletes' : bf < (f ? 25 : 18) ? 'Fitness' : bf < (f ? 32 : 25) ? 'Average' : 'Obese';
      const items = [{ label: 'Category (ACE)', value: cat, type: 'text' }];
      const weight = opt(v.weight, 'Weight', { gt: 0, def: null });
      if (weight !== null) {
        const unit = imperial(v) ? 'lb' : 'kg';
        items.push(
          { label: 'Fat mass', value: weight * bf / 100, type: 'number1', unit },
          { label: 'Lean body mass', value: weight * (1 - bf / 100), type: 'number1', unit },
        );
        const age = opt(v.age, 'Age', { min: 18, max: 120, def: null });
        if (age !== null) {
          const kg = imperial(v) ? weight * LB : weight;
          const bmi = kg / (h / 100) ** 2;
          items.push({ label: 'Body fat (BMI method)', value: 1.2 * bmi + 0.23 * age - 10.8 * (f ? 0 : 1) - 5.4, type: 'percent' });
        }
      }
      return {
        primary: { label: 'Body fat', value: bf, type: 'percent', badge: cat },
        items,
      };
    },
    about: `<p>The U.S. Navy formula (Hodgdon &amp; Beckett, 1984) estimates body fat from circumference measurements and height.
      Metric form — men: <code>495 ÷ (1.0324 − 0.19077·log₁₀(waist − neck) + 0.15456·log₁₀(height)) − 450</code>;
      women: <code>495 ÷ (1.29579 − 0.35004·log₁₀(waist + hip − neck) + 0.22100·log₁₀(height)) − 450</code>.
      US measurements are converted to centimetres first. Measure at the narrowest point of the neck, at the navel for the waist,
      and the widest point of the hips.</p>
      <p>If you add weight and age, the Deurenberg BMI method (<code>1.20 × BMI + 0.23 × age − 10.8 × sex − 5.4</code>, sex = 1 for
      men) is shown for comparison. Categories follow the American Council on Exercise (ACE) chart.</p>`,
  },
  {
    id: 'ideal-weight',
    name: 'Ideal Weight Calculator',
    cat: 'health',
    icon: '🧍',
    desc: 'Ideal body weight from four well-known medical formulas, plus the healthy BMI weight range.',
    keywords: 'ideal body weight devine robinson miller hamwi',
    inputs: [sexInput, unitInput, ...heightInputs],
    compute(v) {
      const cm = heightCm(v);
      const inchesOver = cm / IN - 60;
      const f = v.sex === 'female';
      const r = {
        'Robinson (1983)': (f ? 49 : 52) + (f ? 1.7 : 1.9) * inchesOver,
        'Miller (1983)': (f ? 53.1 : 56.2) + (f ? 1.36 : 1.41) * inchesOver,
        'Devine (1974)': (f ? 45.5 : 50) + 2.3 * inchesOver,
        'Hamwi (1964)': (f ? 45.5 : 48) + (f ? 2.2 : 2.7) * inchesOver,
      };
      const vals = Object.values(r);
      if (vals.some((x) => x <= 0)) throw new Error('These formulas are not meaningful for this height.');
      const us = imperial(v);
      const conv = (kg) => (us ? kg / LB : kg);
      const unit = us ? 'lb' : 'kg';
      const m = cm / 100;
      return {
        primary: { label: 'Ideal weight (average)', value: conv(vals.reduce((a, b) => a + b) / vals.length), type: 'number1', unit },
        items: [
          ...Object.entries(r).map(([k, val]) => ({ label: `${k} formula`, value: conv(val), type: 'number1', unit })),
          { label: 'Healthy BMI range (18.5–25)', value: `${conv(18.5 * m * m).toFixed(1)} – ${conv(25 * m * m).toFixed(1)} ${unit}`, type: 'text' },
        ],
        note: inchesOver < 0 ? 'These formulas were designed for heights of 5 ft (152.4 cm) and above; values below that are extrapolated.' : undefined,
      };
    },
    about: '<p>Each formula starts from a base weight at 5 feet (152.4 cm) and adds a fixed amount per inch above it — e.g. Devine: 50 kg (men) or 45.5 kg (women) + 2.3 kg per inch. They were developed for drug dosing and give a rough guide only; the healthy BMI range is often a better target.</p>',
  },
  {
    id: 'pace',
    name: 'Pace Calculator',
    cat: 'health',
    icon: '🏃',
    desc: 'Running or cycling pace and speed from distance and time, with projected race finish times.',
    keywords: 'running pace marathon speed min per km',
    inputs: [
      { id: 'dist', label: 'Distance', type: 'number', value: 10, step: 0.01 },
      { id: 'unit', label: 'Distance unit', type: 'select', value: 'km', options: [['km', 'Kilometres'], ['mi', 'Miles'], ['m', 'Metres']] },
      { id: 'h', label: 'Hours', type: 'number', value: 0 },
      { id: 'm', label: 'Minutes', type: 'number', value: 50 },
      { id: 's', label: 'Seconds', type: 'number', value: 0 },
    ],
    compute(v) {
      const d = req(v.dist, 'Distance', { gt: 0 });
      const km = d * (v.unit === 'mi' ? 1.609344 : v.unit === 'm' ? 0.001 : 1);
      const sec = opt(v.h, 'Hours', { min: 0 }) * 3600 + opt(v.m, 'Minutes', { min: 0 }) * 60 + opt(v.s, 'Seconds', { min: 0 });
      if (sec <= 0) throw new Error('Enter the time it took.');
      /** h:mm:ss or m:ss, rounding the total to whole seconds first (avoids "4:60"). */
      const clock = (t, forceH = false) => {
        const s = Math.round(t);
        const hh = Math.floor(s / 3600);
        const mm = Math.floor((s % 3600) / 60);
        const ss = String(s % 60).padStart(2, '0');
        return hh || forceH ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
      };
      const perKm = sec / km;
      return {
        primary: { label: 'Pace', value: `${clock(perKm)} /km`, type: 'text' },
        items: [
          { label: 'Pace per mile', value: `${clock(perKm * 1.609344)} /mi`, type: 'text' },
          { label: 'Speed', value: km / (sec / 3600), type: 'number2', unit: 'km/h' },
          { label: 'Speed (mph)', value: km / 1.609344 / (sec / 3600), type: 'number2', unit: 'mph' },
          { label: 'Total time', value: clock(sec, true), type: 'text' },
        ],
        table: { title: 'Projected finish times at this pace', head: ['Race', 'Time'], types: ['text', 'text'], rows: [['1 mile', 1.609344], ['5K', 5], ['10K', 10], ['Half marathon', 21.0975], ['Marathon', 42.195]].map(([n, k]) => [n, clock(perKm * k, true)]) },
      };
    },
    about: '<p>Pace = time ÷ distance; speed = distance ÷ time. 1 mile = 1.609344 km exactly. A half marathon is 21.0975 km and a marathon 42.195 km. Projections assume an even pace — real race times over longer distances are usually slower (see Riegel\'s formula).</p>',
  },
  {
    id: 'due-date',
    name: 'Pregnancy Due Date Calculator',
    cat: 'health',
    icon: '🤰',
    desc: 'Estimate your baby\'s due date, current week of pregnancy and key milestones from your last period.',
    keywords: 'pregnancy due date conception weeks lmp trimester',
    inputs: [
      { id: 'lmp', label: 'First day of last period', type: 'date', value: () => isoDate(addToDate(parseDate(todayISO()), { days: -70 })) },
      { id: 'cycle', label: 'Average cycle length', type: 'number', value: 28, suffix: 'days' },
    ],
    compute(v) {
      const lmp = parseDate(v.lmp);
      if (!lmp) throw new Error('Pick a valid date for the first day of your last period.');
      const cycle = req(v.cycle, 'Cycle length', { min: 20, max: 45, int: true });
      const today = parseDate(todayISO());
      if (lmp > today) throw new Error('The first day of your last period can\'t be in the future.');
      const adj = cycle - 28;
      const day = (n) => addToDate(lmp, { days: n + adj });
      const due = day(280);
      const fmt = (d) => d.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
      const gestDays = Math.round((today - lmp) / DAY_MS) - adj;
      const pregnant = gestDays >= 0 && gestDays < 300;
      const toDue = Math.round((due - today) / DAY_MS);
      return {
        primary: { label: 'Estimated due date', value: fmt(due), type: 'text' },
        items: [
          { label: 'Current gestational age', value: pregnant ? `${Math.floor(gestDays / 7)} weeks ${gestDays % 7} days` : '—', type: 'text' },
          { label: 'Trimester', value: !pregnant ? '—' : gestDays < 98 ? 'First' : gestDays < 196 ? 'Second' : 'Third', type: 'text' },
          { label: 'Days until due date', value: toDue >= 0 ? toDue : '—', type: toDue >= 0 ? 'int' : 'text' },
          { label: 'Estimated conception', value: fmt(day(14)), type: 'text' },
        ],
        table: {
          title: 'Pregnancy milestones', head: ['Milestone', 'Week', 'Date'], types: ['text', 'text', 'text'],
          rows: [
            ['Second trimester begins', '14w 0d', fmt(day(98))],
            ['Viability (approx.)', '24w 0d', fmt(day(168))],
            ['Third trimester begins', '28w 0d', fmt(day(196))],
            ['Full term begins', '39w 0d', fmt(day(273))],
            ['Due date', '40w 0d', fmt(due)],
            ['Late term ends', '41w 6d', fmt(day(293))],
          ],
        },
        note: gestDays >= 300 ? 'This date is more than 42 weeks ago — please check the date you entered.' : 'Only about 4% of babies arrive on their due date. An early ultrasound gives a more accurate date. Always follow your doctor\'s advice.',
      };
    },
    about: '<p>Uses Naegele\'s rule: due date = first day of last menstrual period + 280 days (40 weeks), shifted by the number of days your cycle is longer or shorter than 28. Gestational age is counted from the LMP (also cycle-adjusted). Term definitions follow ACOG: early term 37w0d–38w6d, full term 39w0d–40w6d, late term 41w0d–41w6d.</p>',
  },
  {
    id: 'heart-rate',
    name: 'Heart Rate Zone Calculator',
    cat: 'health',
    icon: '❤️',
    desc: 'Target heart-rate training zones using the Karvonen (heart rate reserve) method.',
    keywords: 'target heart rate max hr zones cardio karvonen',
    inputs: [
      { id: 'age', label: 'Age', type: 'number', value: 30 },
      { id: 'rest', label: 'Resting heart rate', type: 'number', value: 65, suffix: 'bpm' },
      { id: 'max', label: 'Measured max heart rate (optional)', type: 'number', value: '', suffix: 'bpm' },
    ],
    compute(v) {
      const age = ageField(v.age, 5, 110);
      const rest = req(v.rest, 'Resting heart rate', { min: 25, max: 150 });
      const measured = opt(v.max, 'Max heart rate', { min: 60, max: 240, def: null });
      const tanaka = 208 - 0.7 * age;
      const max = measured ?? tanaka;
      if (rest >= max) throw new Error('Resting heart rate must be below your maximum heart rate.');
      const hrr = max - rest;
      const z = (lo, hi) => `${Math.round(rest + hrr * lo)} – ${Math.round(rest + hrr * hi)} bpm`;
      return {
        primary: { label: measured ? 'Maximum heart rate (measured)' : 'Maximum heart rate', value: Math.round(max), type: 'int', unit: 'bpm' },
        items: [
          { label: 'Heart rate reserve', value: Math.round(hrr), type: 'int', unit: 'bpm' },
          { label: 'Tanaka estimate (208 − 0.7 × age)', value: Math.round(tanaka), type: 'int', unit: 'bpm' },
          { label: 'Classic estimate (220 − age)', value: Math.round(220 - age), type: 'int', unit: 'bpm' },
        ],
        table: {
          title: 'Training zones', head: ['Zone', 'Intensity', 'Heart rate'], types: ['text', 'text', 'text'],
          rows: [['1 – Recovery', '50–60%', z(0.5, 0.6)], ['2 – Endurance', '60–70%', z(0.6, 0.7)], ['3 – Aerobic', '70–80%', z(0.7, 0.8)], ['4 – Threshold', '80–90%', z(0.8, 0.9)], ['5 – Maximum', '90–100%', z(0.9, 1)]],
        },
      };
    },
    about: '<p>Max HR uses the Tanaka formula <code>208 − 0.7 × age</code> (Tanaka, Monahan &amp; Seals, 2001), which is more accurate than the classic 220 − age for adults over 40; enter a measured maximum if you know it. Zones use the Karvonen method: resting HR + intensity × (max HR − resting HR).</p>',
  },
];
