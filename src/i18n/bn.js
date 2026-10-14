// বাংলা (Bangla) translations for CalcHub.
//
// English is the source language. Every English string — UI text, input labels, option labels, help text,
// and the labels/notes/table headings returned by each calculator's compute() — is looked up here and
// falls back to English if missing (see src/i18n.js for the lookup rules). Numbers inside strings are
// matched by "#" in keys and inserted with {1}, {2}… in translations.
//
// Layout:
//   ui        interface strings (header, buttons, toasts, errors, consent banner…)
//   words     word-by-word fallback (month/day names, short units) for dates and durations
//   patterns  regex rules for messages that embed a field name (validation errors)
//   categories category names, descriptions and hub intros
//   strings   shared result/input strings, merged from the per-category files in ./bn/
//   calc      per-calculator name, desc, keywords, SEO title/description, about (HTML) and FAQ, from ./bn/
//
// Style: formal standard Bangla (প্রমিত বাংলা). Technical terms keep the English in brackets where it
// helps recognition, e.g. "ইএমআই (EMI)". Digits are written in ASCII here; Bangla pages convert them to
// Bangla numerals for display (static text at build time, results at runtime with a toggle).

import * as finance from './bn/finance.js';
import * as health from './bn/health.js';
import * as math from './bn/math.js';
import * as converters from './bn/converters.js';
import * as bangladesh from './bn/bangladesh.js';
import * as everyday from './bn/everyday.js';
import * as more from './bn/more.js';
import * as more2 from './bn/more2.js';
import * as common from './bn/common.js';

export const ui = {
  // Header, layout, footer
  'Skip to content': 'মূল বিষয়বস্তুতে যান',
  'Search calculators': 'ক্যালকুলেটর খুঁজুন',
  Currency: 'মুদ্রা',
  'Toggle dark mode': 'ডার্ক মোড চালু/বন্ধ',
  'Switch to light mode': 'লাইট মোডে যান',
  'Switch to dark mode': 'ডার্ক মোডে যান',
  Advertisement: 'বিজ্ঞাপন',
  'Cookie consent': 'কুকি সম্মতি',
  Reject: 'প্রত্যাখ্যান',
  Accept: 'সম্মতি দিন',
  Breadcrumb: 'অবস্থান-নির্দেশিকা',
  'Popular calculators': 'জনপ্রিয় ক্যালকুলেটর',
  Categories: 'বিভাগসমূহ',
  'Free online calculators — fast, accurate and private': 'বিনামূল্যের অনলাইন ক্যালকুলেটর — দ্রুত, নির্ভুল ও গোপনীয়',
  'All calculations run in your browser — your numbers never leave your device.': 'সব হিসাব আপনার ব্রাউজারেই হয় — আপনার দেওয়া সংখ্যা কখনো আপনার ডিভাইসের বাইরে যায় না।',
  'About us': 'আমাদের সম্পর্কে',
  'Editorial policy': 'সম্পাদকীয় নীতি',
  Contact: 'যোগাযোগ',
  'All calculators (sitemap)': 'সব ক্যালকুলেটর (সাইটম্যাপ)',
  'Privacy Policy': 'গোপনীয়তা নীতি',
  'Cookie Policy': 'কুকি নীতি',
  'Terms of Use': 'ব্যবহারের শর্তাবলি',
  'Cookie settings': 'কুকি সেটিংস',
  'Results are estimates for informational purposes only and are not financial, medical or legal advice.': 'ফলাফলগুলো কেবল তথ্যের জন্য আনুমানিক হিসাব; এগুলো আর্থিক, চিকিৎসা বা আইনগত পরামর্শ নয়।',
  'What do you want to calculate?': 'কী হিসাব করতে চান?',
  Instant: 'তাৎক্ষণিক',
  'Results update as you type': 'লেখার সঙ্গে সঙ্গে ফলাফল বদলায়',
  Private: 'গোপনীয়',
  'Everything runs on your device': 'সব হিসাব আপনার ডিভাইসেই হয়',
  Shareable: 'শেয়ারযোগ্য',
  'Every result has its own link': 'প্রতিটি ফলাফলের নিজস্ব লিংক আছে',
  'Dark mode & offline': 'ডার্ক মোড ও অফলাইন',
  'Install it like an app': 'অ্যাপের মতো ইনস্টল করুন',
  'Your saved calculators': 'আপনার সংরক্ষিত ক্যালকুলেটর',
  'Recently used': 'সম্প্রতি ব্যবহৃত',
  'Frequently asked questions': 'সচরাচর জিজ্ঞাসা',
  Home: 'প্রথম পাতা',
  Save: 'সংরক্ষণ',
  Saved: 'সংরক্ষিত',
  'Last updated': 'সর্বশেষ হালনাগাদ',
  'How it works': 'যেভাবে কাজ করে',
  FAQ: 'জিজ্ঞাসা',
  'Please enable JavaScript to use this calculator.': 'এই ক্যালকুলেটর ব্যবহার করতে জাভাস্ক্রিপ্ট চালু করুন।',
  'Related calculators': 'সম্পর্কিত ক্যালকুলেটর',
  'Other categories': 'অন্যান্য বিভাগ',
  'Saved — find it on the home page': 'সংরক্ষিত হয়েছে — প্রথম পাতায় পাবেন',
  'Removed from saved calculators': 'সংরক্ষিত তালিকা থেকে সরানো হয়েছে',
  'No calculator found. Try "loan", "bmi" or "age".': 'কোনো ক্যালকুলেটর পাওয়া যায়নি। "ঋণ", "আয়কর" বা "বয়স" লিখে চেষ্টা করুন।',

  // Calculator form and results (engine)
  'Enter a number, e.g. 1250 or 3.5': 'একটি সংখ্যা লিখুন, যেমন 1250 বা 3.5',
  'Must be at least #': 'কমপক্ষে {1} হতে হবে',
  'Must be at most #': 'সর্বোচ্চ {1} হতে পারে',
  Details: 'বিস্তারিত',
  '# rows': '{1}টি সারি',
  '# row': '{1}টি সারি',
  'Download CSV': 'CSV ডাউনলোড',
  'Copy result': 'ফলাফল কপি করুন',
  'Copied to clipboard': 'ক্লিপবোর্ডে কপি হয়েছে',
  'Copy failed — select the text and copy manually': 'কপি করা যায়নি — লেখাটি নির্বাচন করে নিজে কপি করুন',
  inputs: 'তথ্য প্রদান',
  Calculate: 'হিসাব করুন',
  Recalculate: 'আবার হিসাব করুন',
  Reset: 'রিসেট',
  Results: 'ফলাফল',
  Share: 'শেয়ার',
  'Copy results': 'ফলাফল কপি',
  Print: 'প্রিন্ট',
  'Show results': 'ফলাফল দেখুন',
  'Please check your inputs.': 'অনুগ্রহ করে আপনার দেওয়া তথ্য যাচাই করুন।',
  'Result copied': 'ফলাফল কপি হয়েছে',
  'Reset to default values': 'প্রাথমিক মানে ফিরিয়ে নেওয়া হয়েছে',
  'Link copied — it opens with these exact numbers': 'লিংক কপি হয়েছে — এটি ঠিক এই সংখ্যাগুলো নিয়েই খুলবে',
  'Results copied': 'ফলাফল কপি হয়েছে',
  'CSV downloaded': 'CSV ডাউনলোড হয়েছে',
  Breakdown: 'বিভাজন',
  Total: 'মোট',
  ' and ': ' ও ',

  // Scientific calculator
  Copy: 'কপি',
  Expression: 'রাশি',
  'Second functions': 'দ্বিতীয় ফাংশন',
  'Angle mode': 'কোণের একক',
  Backspace: 'ব্যাকস্পেস',
  'All clear': 'সব মুছুন',
  'Square root': 'বর্গমূল',
  'Cube root': 'ঘনমূল',
  Square: 'বর্গ',
  Cube: 'ঘন',
  Power: 'ঘাত',
  'Y-th root': 'y-তম মূল',
  Factorial: 'ফ্যাক্টোরিয়াল',
  Reciprocal: 'বিপরীত (1/x)',
  'Absolute value': 'পরম মান',
  'e to the power': 'e-এর ঘাত',
  '10 to the power': '10-এর ঘাত',
  Minus: 'বিয়োগ',
  Times: 'গুণ',
  Divide: 'ভাগ',
  'Times ten to the power': 'গুণ 10-এর ঘাত',
  'Memory recall': 'মেমরি থেকে আনুন',
  'Memory clear': 'মেমরি মুছুন',
  'Memory add': 'মেমরিতে যোগ',
  'Memory subtract': 'মেমরি থেকে বিয়োগ',
  'Random number': 'দৈব সংখ্যা',
  Percent: 'শতাংশ',
  'Arc sine': 'বিপরীত সাইন',
  'Arc cosine': 'বিপরীত কোসাইন',
  'Arc tangent': 'বিপরীত ট্যানজেন্ট',
  Sine: 'সাইন',
  Cosine: 'কোসাইন',
  Tangent: 'ট্যানজেন্ট',
  'Logarithm (base 10)': 'লগারিদম (ভিত্তি 10)',
  'Natural logarithm': 'স্বাভাবিক লগারিদম',
  'Previous answer': 'আগের উত্তর',
  Pi: 'পাই',
  "Euler's number e": 'অয়লারের সংখ্যা e',
  'Open bracket': 'প্রথম বন্ধনী শুরু',
  'Close bracket': 'প্রথম বন্ধনী শেষ',
  'Decimal point': 'দশমিক বিন্দু',
  Plus: 'যোগ',
  Equals: 'সমান',
  'Tip: type directly — <kbd>Enter</kbd> = equals, <kbd>Esc</kbd> clears, <kbd>Backspace</kbd> deletes.': 'পরামর্শ: সরাসরি টাইপ করুন — <kbd>Enter</kbd> = সমান, <kbd>Esc</kbd> মুছে দেয়, <kbd>Backspace</kbd> একটি অক্ষর মোছে।',
  History: 'ইতিহাস',
  Clear: 'মুছুন',
  'Your calculations appear here and are saved on this device.': 'আপনার হিসাবগুলো এখানে দেখা যাবে এবং এই ডিভাইসেই সংরক্ষিত থাকবে।',
  'Edit this expression': 'এই রাশিটি সম্পাদনা করুন',
  'Insert this result': 'এই ফলাফল বসান',
  Error: 'ত্রুটি',
  equals: 'সমান',
  'Angles in degrees': 'কোণ ডিগ্রিতে',
  'Angles in radians': 'কোণ রেডিয়ানে',
  Copied: 'কপি হয়েছে',
  'Nothing to copy yet': 'কপি করার মতো কিছু এখনো নেই',
  'History cleared': 'ইতিহাস মুছে ফেলা হয়েছে',
  'Empty parentheses': 'বন্ধনীর ভেতরে কিছু নেই',
  'Expression is nested too deeply': 'রাশিতে অনেক বেশি স্তরের বন্ধনী',
  'Expression is too long': 'রাশিটি অনেক দীর্ঘ',
  'Incomplete expression': 'রাশিটি অসম্পূর্ণ',
  'Missing argument after ","': '"," এর পরে মান নেই',
  'Missing exponent after "^"': '"^" এর পরে ঘাত নেই',
  'Two "^" in a row — did you mean a single "^"?': 'পরপর দুটি "^" — আপনি কি একটি "^" বোঝাতে চেয়েছেন?',
  'Unexpected "," — commas only separate function arguments, e.g. nCr(5, 2)': 'অপ্রত্যাশিত "," — কমা কেবল ফাংশনের মান আলাদা করতে ব্যবহৃত হয়, যেমন nCr(5, 2)',
  'Unexpected ","': 'অপ্রত্যাশিত ","',
  'Unmatched ")"': 'মিলহীন ")"',
  'gcd/lcm need whole numbers': 'gcd/lcm-এর জন্য পূর্ণসংখ্যা দরকার',
};

/** Word-by-word fallback, used only when every word of a string is known (dates, durations). */
export const words = {
  Jan: 'জানু', Feb: 'ফেব্রু', Mar: 'মার্চ', Apr: 'এপ্রিল', May: 'মে', Jun: 'জুন', Jul: 'জুলাই', Aug: 'আগস্ট', Sep: 'সেপ্টে', Sept: 'সেপ্টে', Oct: 'অক্টো', Nov: 'নভে', Dec: 'ডিসে',
  January: 'জানুয়ারি', February: 'ফেব্রুয়ারি', March: 'মার্চ', April: 'এপ্রিল', June: 'জুন', July: 'জুলাই', August: 'আগস্ট', September: 'সেপ্টেম্বর', October: 'অক্টোবর', November: 'নভেম্বর', December: 'ডিসেম্বর',
  Mon: 'সোম', Tue: 'মঙ্গল', Wed: 'বুধ', Thu: 'বৃহস্পতি', Fri: 'শুক্র', Sat: 'শনি', Sun: 'রবি',
  Monday: 'সোমবার', Tuesday: 'মঙ্গলবার', Wednesday: 'বুধবার', Thursday: 'বৃহস্পতিবার', Friday: 'শুক্রবার', Saturday: 'শনিবার', Sunday: 'রবিবার',
  yr: 'বছর', yrs: 'বছর', mo: 'মাস', mos: 'মাস', wk: 'সপ্তাহ', wks: 'সপ্তাহ', d: 'দিন', h: 'ঘণ্টা', hr: 'ঘণ্টা', hrs: 'ঘণ্টা', m: 'মি', min: 'মিনিট', mins: 'মিনিট', s: 'সে', sec: 'সেকেন্ড',
  year: 'বছর', years: 'বছর', month: 'মাস', months: 'মাস', week: 'সপ্তাহ', weeks: 'সপ্তাহ', day: 'দিন', days: 'দিন', hour: 'ঘণ্টা', hours: 'ঘণ্টা', minute: 'মিনিট', minutes: 'মিনিট', second: 'সেকেন্ড', seconds: 'সেকেন্ড',
  and: 'ও', or: 'অথবা', AM: 'এএম', PM: 'পিএম', am: 'এএম', pm: 'পিএম',
};

/** Messages that embed a field name or a quoted value. "$n" = translated group n; groups in keep stay as-is. */
const basePatterns = [
  { re: '^Enter an? (.+)\\.$', to: '$1 লিখুন।' },
  { re: '^Enter the (.+)\\.$', to: '$1 লিখুন।' },
  { re: '^(.+) must be greater than zero\\.$', to: '$1 শূন্যের চেয়ে বেশি হতে হবে।' },
  { re: '^(.+) must be greater than (.+)\\.$', to: '$1 অবশ্যই $2-এর চেয়ে বেশি হতে হবে।', keep: [2] },
  { re: '^(.+) must be at least (.+)\\.$', to: '$1 কমপক্ষে $2 হতে হবে।', keep: [2] },
  { re: '^(.+) must be at most (.+)\\.$', to: '$1 সর্বোচ্চ $2 হতে পারে।', keep: [2] },
  { re: "^(.+) can't be negative\\.$", to: '$1 ঋণাত্মক হতে পারে না।' },
  { re: '^(.+) is too small\\.$', to: '$1 অনেক ছোট।' },
  { re: '^(.+) is too large\\.$', to: '$1 অনেক বড়।' },
  { re: '^(.+) must be a whole number\\.$', to: '$1 অবশ্যই পূর্ণসংখ্যা হতে হবে।' },
  { re: '^(.+) must be a number \\(you entered "(.*)"\\)\\.$', to: '$1 অবশ্যই একটি সংখ্যা হতে হবে (আপনি লিখেছেন "$2")।', keep: [2] },
  { re: '^Fix “(.+)” to update the results\\.$', to: 'ফলাফল হালনাগাদ করতে “$1” ঠিক করুন।' },
  { re: '^Bar chart of (.+) over (\\d+) periods; final (.+): (.+)$', to: '$2টি সময়কালের $1-এর বার চার্ট; সর্বশেষ $3: $4', keep: [1, 2, 3, 4] },
  { re: '^Value (.+) on a scale from (.+) to (.+): (.+)$', to: 'মান $1 ($2 থেকে $3 স্কেলে): $4', keep: [1, 2, 3, 4] },
  { re: '^Invalid number "(.*)"$', to: 'অবৈধ সংখ্যা "$1"', keep: [1] },
  { re: '^Invalid number at position (\\d+)$', to: '$1 নম্বর অবস্থানে অবৈধ সংখ্যা', keep: [1] },
  { re: '^Unexpected "(.+)" at position (\\d+)$', to: '$2 নম্বর অবস্থানে অপ্রত্যাশিত "$1"', keep: [1, 2] },
  { re: '^Unknown name "(.+)"$', to: 'অজানা নাম "$1"', keep: [1] },
  { re: '^Missing number after "(.+)"$', to: '"$1" এর পরে সংখ্যা নেই', keep: [1] },
  { re: '^Missing number before "(.+?)"(?: — .*)?$', to: '"$1" এর আগে সংখ্যা নেই', keep: [1] },
  { re: '^Missing value after "(.+)"$', to: '"$1" এর পরে মান নেই', keep: [1] },
  { re: '^"(.+)" must follow a number$', to: '"$1" একটি সংখ্যার পরে বসাতে হবে', keep: [1] },
  { re: '^(.+) needs non-negative whole numbers$', to: '$1-এর জন্য অঋণাত্মক পূর্ণসংখ্যা দরকার', keep: [1] },
  { re: '^(.+) needs parentheses, e\\.g\\. (.+)$', to: '$1-এর সঙ্গে বন্ধনী দরকার, যেমন $2', keep: [1, 2] },
  { re: '^(.+)\\(\\) takes (.+) arguments?, got (\\d+)$', to: '$1()-এ $2টি মান লাগে, দেওয়া হয়েছে $3টি', keep: [1, 2, 3] },
  // Unit converter: "1.5 Kilometre =", "1 km in all length units", option labels "Kilometre (km)", values "0.93 Mile".
  { re: '^([-−]?[\\d.,]+(?:e[-+]?\\d+)?) (.+) =$', to: '$1 $2 =', keep: [1] },
  { re: '^(.+) in all (.+) units$', to: '$1 — সব $2 এককে', keep: [1] },
  { re: '^(.+) \\(([^()]+)\\)$', to: '$1 ($2)', keep: [2] },
  { re: '^([-−]?[\\d.,]+(?:e[-+]?\\d+)?) ([^\\d].*)$', to: '$1 $2', keep: [1] },
  { re: '^Unexpected (.+) — expected "\\)"$', to: 'অপ্রত্যাশিত $1 — ")" প্রত্যাশিত ছিল', keep: [1] },
  { re: '^Unexpected (.+)$', to: 'অপ্রত্যাশিত $1', keep: [1] },
];

export const categories = {
  finance: {
    name: 'আর্থিক',
    desc: 'ঋণ, মর্টগেজ, সঞ্চয়, বিনিয়োগ, কর ও ব্যবসার হিসাব।',
    intro: `<p>সংখ্যাগুলো চোখের সামনে থাকলে টাকা-পয়সার সিদ্ধান্ত নেওয়া সহজ হয়। আমাদের আর্থিক ক্যালকুলেটরগুলোতে আছে ঋণ (গৃহঋণ, গাড়ির ঋণ, ইএমআই ও ক্রেডিট কার্ড), সঞ্চয় ও বিনিয়োগ (চক্রবৃদ্ধি সুদ, এসআইপি, অবসর ও সঞ্চয়ের লক্ষ্য) এবং ব্যবসা পরিচালনার হিসাব (মুনাফার মার্জিন, ব্রেক-ইভেন, অবচয়, এনপিভি ও আইআরআর)।</p>
    <p>প্রতিটি ক্যালকুলেটর ব্যাংক ও হিসাবরক্ষকেরা যে প্রচলিত সূত্র ব্যবহার করেন সেটিই ব্যবহার করে, প্রয়োজনে পূর্ণ কিস্তিসূচি বা চার্ট দেখায় এবং মুদ্রা বদলানোর সুযোগ দেয় — লাখ/কোটি বিভাজনসহ ৳ টাকা ও ₹ রুপিও আছে। ফলাফলগুলো আনুমানিক; চূড়ান্ত অঙ্ক আপনার ব্যাংক বা পরামর্শকের সঙ্গে মিলিয়ে নিন।</p>`,
  },
  health: {
    name: 'স্বাস্থ্য ও ফিটনেস',
    desc: 'বিএমআই, ক্যালরি, শরীরের চর্বি, দৌড়ের গতি, গর্ভাবস্থা ও হৃৎস্পন্দন।',
    intro: `<p>প্রকাশিত ও বিশেষজ্ঞ-পর্যালোচিত সূত্রের ভিত্তিতে তৈরি স্বাস্থ্য ও ফিটনেস ক্যালকুলেটর: বিশ্ব স্বাস্থ্য সংস্থার (WHO) শ্রেণিসহ বিএমআই, মিফলিন–সেন্ট জিওর সমীকরণে ক্যালরি ও ম্যাক্রোর লক্ষ্য, ইউএস নেভি পদ্ধতিতে শরীরের চর্বির হার, কারভোনেন পদ্ধতিতে হৃৎস্পন্দনের জোন, এবং গর্ভাবস্থা, ডিম্বস্ফোটন ও ঘুমের চক্রের পরিকল্পনা।</p>
    <p>প্রতিটি পাতায় সূত্র, তার সীমাবদ্ধতা ও উৎস ব্যাখ্যা করা আছে। এই টুলগুলো সাধারণ তথ্যের জন্য; এগুলো চিকিৎসক বা নিবন্ধিত পুষ্টিবিদের পরামর্শের বিকল্প নয়।</p>`,
  },
  math: {
    name: 'গণিত',
    desc: 'সায়েন্টিফিক ক্যালকুলেটর, শতাংশ, ভগ্নাংশ, বীজগণিত ও পরিসংখ্যান।',
    intro: `<p>পূর্ণাঙ্গ সায়েন্টিফিক ক্যালকুলেটর থেকে শুরু করে ধাপে ধাপে ভগ্নাংশ, শতাংশ, দ্বিঘাত সমীকরণ ও পরিসংখ্যান — শিক্ষার্থী, শিক্ষক এবং দ্রুত নির্ভুল উত্তর চান এমন সবার জন্য এই গণিত টুলগুলো তৈরি।</p>
    <p>যেখানে সম্ভব সেখানে হিসাব হয় নির্ভুল পাটিগণিতে (যেমন বড় পূর্ণসংখ্যার মৌলিকতা যাচাই এবং তাৎপর্যপূর্ণ অঙ্কের জন্য নির্ভুল দশমিক হিসাব), এবং প্রতিটি পাতায় পদ্ধতি ব্যাখ্যা করা আছে যাতে আপনি নিজের হিসাব মিলিয়ে নিতে পারেন।</p>`,
  },
  convert: {
    name: 'রূপান্তরকারী',
    desc: 'একক, সংখ্যা-পদ্ধতি ও রোমান সংখ্যা।',
    intro: `<p>মেট্রিক ও ইম্পেরিয়াল একক, সংখ্যা-পদ্ধতি এবং রোমান সংখ্যার মধ্যে মুহূর্তেই রূপান্তর করুন। একক রূপান্তরকারীতে আছে দৈর্ঘ্য, ওজন, তাপমাত্রা, ক্ষেত্রফল, আয়তন, গতি, সময়, ডেটা, শক্তি, কোণ, জ্বালানি সাশ্রয় ও চাপ — কাঠা, বিঘা ও শতাংশের (ডেসিমাল) মতো দক্ষিণ এশীয় জমির এককসহ।</p>
    <p>রূপান্তরের গুণকগুলো আন্তর্জাতিকভাবে স্বীকৃত নির্ভুল সংজ্ঞা অনুসরণ করে (যেমন 1 ইঞ্চি = 2.54 সেমি), তাই প্রদর্শিত নির্ভুলতা পর্যন্ত ফলাফল সঠিক।</p>`,
  },
  bangladesh: {
    name: 'বাংলাদেশ',
    desc: 'বাংলাদেশের জন্য আয়কর, সঞ্চয়পত্র, এফডিআর/ডিপিএস, স্বর্ণ (ভরি), বিদ্যুৎ বিল ও আরও অনেক কিছু।',
    intro: `<p>বিশেষভাবে বাংলাদেশের জন্য তৈরি ক্যালকুলেটর: আয়কর আইন, ২০২৩ অনুযায়ী ব্যক্তিগত আয়কর, সঞ্চয়পত্রের মুনাফা, উৎসে কর ও আবগারি শুল্কসহ ব্যাংকের এফডিআর ও ডিপিএসের মেয়াদপূর্তির অঙ্ক, ভরি ও আনায় স্বর্ণের দাম, বিইআরসির বিদ্যুৎ বিল, এবং সরকারি পেনশন, আনুতোষিক ও জিপিএফ।</p>
    <p>হারগুলো সরকারি উৎস থেকে নেওয়া — জাতীয় রাজস্ব বোর্ড, অর্থ বিভাগ, জাতীয় সঞ্চয় অধিদপ্তর, বাংলাদেশ ব্যাংক, বিইআরসি ও বাজুস — এবং প্রতিটি পাতায় প্রযোজ্য অর্থবছর ও সর্বশেষ যাচাইয়ের তারিখ উল্লেখ আছে। কোনো সিদ্ধান্ত নেওয়ার আগে সবসময় সরকারি উৎসের সঙ্গে মিলিয়ে নিন।</p>`,
  },
  everyday: {
    name: 'দৈনন্দিন ও সময়',
    desc: 'বয়স, তারিখ, সময়, জিপিএ, জ্বালানি, বিদ্যুৎ ও পাসওয়ার্ড।',
    intro: `<p>দৈনন্দিন জীবনের কাজের টুল: নির্ভুল বয়স, দুই তারিখের মধ্যে দিনের সংখ্যা, কাউন্টডাউন, টাইম কার্ড ও শিফটের সময়, জিপিএ ও চূড়ান্ত পরীক্ষার নম্বরের পরিকল্পনা, জ্বালানি ও বিদ্যুতের খরচ, কংক্রিট, টাইলস ও বর্গফুটের মতো ঘর-সংস্কারের হিসাব, এবং নিরাপদ পাসওয়ার্ড তৈরি।</p>
    <p>তারিখের হিসাবে অধিবর্ষ, মাসের দৈর্ঘ্য এবং আপনার পছন্দের সাপ্তাহিক ছুটি (শনি–রবি বা শুক্র–শনি) বিবেচনা করা হয়, আর সবকিছুই আপনার ব্রাউজারে গোপনে চলে।</p>`,
  },
};

const PARTS = [common, finance, health, math, converters, bangladesh, everyday, more, more2];

export const strings = Object.assign({}, ...PARTS.map((p) => p.strings || {}));
/** Category-specific patterns first, then the generic ones. */
export const patterns = [...PARTS.flatMap((p) => p.patterns || []), ...basePatterns];
export const calc = Object.assign({}, ...PARTS.map((p) => p.calc || {}));

const dict = { ui, words, patterns, categories, strings, calc };
export default dict;

/** The subset shipped to the browser: everything except about/FAQ prose (those are pre-rendered). */
export function clientDict() {
  const slim = {};
  for (const [id, c] of Object.entries(calc)) slim[id] = { name: c.name, desc: c.desc, keywords: c.keywords, ...(c.strings ? { strings: c.strings } : {}), ...(c.defaults ? { defaults: c.defaults } : {}), ...(c.asciiDigits ? { asciiDigits: true } : {}) };
  return { ui, words, patterns, strings, calc: slim };
}
