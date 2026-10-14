import finance from './calculators/finance.js';
import health from './calculators/health.js';
import math from './calculators/math.js';
import converters from './calculators/converters.js';
import everyday from './calculators/everyday.js';
import bangladesh from './calculators/bangladesh.js';
import more from './calculators/more.js';

export const CATEGORIES = [
  { id: 'finance', name: 'Financial', icon: '💰', desc: 'Loans, mortgages, savings, investment, tax and business.' },
  { id: 'health', name: 'Health & Fitness', icon: '💪', desc: 'BMI, calories, body fat, pace, pregnancy and heart rate.' },
  { id: 'math', name: 'Math', icon: '🧮', desc: 'Scientific calculator, percentages, fractions, algebra and statistics.' },
  { id: 'convert', name: 'Converters', icon: '🔄', desc: 'Units, number bases and Roman numerals.' },
  { id: 'bangladesh', name: 'Bangladesh', icon: '🇧🇩', desc: 'Income tax, savings certificates, FDR/DPS, gold (vori), electricity bill and more for Bangladesh.' },
  { id: 'everyday', name: 'Everyday & Time', icon: '📅', desc: 'Age, dates, time, GPA, fuel, electricity and passwords.' },
];

export const CALCULATORS = [...finance, ...health, ...math, ...converters, ...bangladesh, ...everyday, ...more];

export const byId = Object.fromEntries(CALCULATORS.map((c) => [c.id, c]));

/** Simple relevance search over name, keywords and description. */
export function search(query, limit = 8, list = CALCULATORS) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  return list.map((c) => {
    const name = c.name.toLowerCase();
    const hay = `${name} ${c.keywords || ''} ${c.desc}`.toLowerCase();
    let score = 0;
    if (name.startsWith(q)) score += 100;
    else if (name.includes(q)) score += 60;
    for (const w of words) {
      if (name.includes(w)) score += 20;
      else if ((c.keywords || '').toLowerCase().includes(w)) score += 12;
      else if (hay.includes(w)) score += 5;
      else score -= 15;
    }
    return { c, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.c);
}
