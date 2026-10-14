// Safe math expression evaluator (no eval). Recursive-descent parser supporting
// + − × ÷ ^ ! !! % mod, parentheses, implicit multiplication, constants,
// one- and two-argument functions (nCr, nPr, gcd, lcm, min, max, log(x, base), root(x, n)).
//
// Grammar (lowest → highest precedence):
//   expr    := term (('+' | '-') term)*
//   term    := unary (('*' | '/' | 'mod' | 'nCr' | 'nPr') unary | <implicit ×> power)*
//   unary   := ('-' | '+') unary | power
//   power   := postfix ('^' unary)?            (right-associative; -2^2 = -4, 2^-1 = 0.5)
//   postfix := primary ('!' | '!!' | '%')*
//   primary := number | constant | 'Ans' | '(' expr ')' | func '(' args ')' | func power
// Missing closing parentheses at the end are tolerated ("2*(3+4" = 14) for live previews.

const MAX_LEN = 2000;
const MAX_DEPTH = 200;
const TRIG_EPS = 1e-15;

const toRad = (x, d) => (d ? (x % 360) * Math.PI / 180 : x);
/** Snap floating-point noise like sin(π) = 1.22e-16 to exactly 0. */
const snap = (r, rad) => (Math.abs(r) < TRIG_EPS * Math.max(1, Math.abs(rad)) && Math.abs(rad) > 1e-3 ? 0 : r);
const sinX = (x, d) => {
  if (d && Number.isFinite(x) && x % 180 === 0) return 0;
  const rad = toRad(x, d);
  return snap(Math.sin(rad), rad);
};
const cosX = (x, d) => {
  if (d && Number.isFinite(x) && (x - 90) % 180 === 0) return 0;
  const rad = toRad(x, d);
  return snap(Math.cos(rad), rad);
};
const inv = (f) => (x, d) => f(x) * (d ? 180 / Math.PI : 1);

/** Lanczos approximation of Γ(z) (g = 7, n = 9) — ~15 significant digits. */
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function gamma(z) {
  if (Number.isInteger(z) && z <= 0) return NaN;
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = LANCZOS[0];
  for (let i = 1; i < 9; i++) x += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/** n! for non-negative integers (exact up to 18!, ∞ above 170); Γ(n+1) for non-integers. */
export function factorial(n) {
  if (Number.isNaN(n)) return NaN;
  if (n < 0 && Number.isInteger(n)) return NaN;
  if (!Number.isInteger(n)) return n > 171.6 ? Infinity : gamma(n + 1);
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Double factorial n!! = n·(n−2)·(n−4)… (0!! = 1, (−1)!! = 1). */
export function doubleFactorial(n) {
  if (!Number.isInteger(n) || n < -1) return NaN;
  let r = 1;
  for (let i = n; i > 1; i -= 2) {
    r *= i;
    if (!Number.isFinite(r)) return Infinity;
  }
  return r;
}

const needInt = (name, ...xs) => {
  for (const x of xs) if (!Number.isInteger(x) || x < 0) throw new Error(`${name} needs non-negative whole numbers`);
};

/** Combinations C(n, r) — exact multiplicative formula, no factorial overflow. */
export function nCr(n, r) {
  needInt('nCr', n, r);
  if (r > n) return 0;
  r = Math.min(r, n - r);
  let c = 1;
  for (let i = 1; i <= r; i++) {
    c = c * (n - r + i) / i;
    if (!Number.isFinite(c)) return Infinity;
  }
  return Math.round(c);
}

/** Permutations P(n, r) = n! / (n − r)!. */
export function nPr(n, r) {
  needInt('nPr', n, r);
  if (r > n) return 0;
  let p = 1;
  for (let i = 0; i < r; i++) {
    p *= n - i;
    if (!Number.isFinite(p)) return Infinity;
  }
  return p;
}

/** Floored modulo (result has the sign of the divisor), like Python / Wolfram Mod. */
export function mod(a, b) {
  if (b === 0) return NaN;
  const r = a % b;
  return r !== 0 && (r < 0) !== (b < 0) ? r + b : r;
}

const gcd2 = (a, b) => {
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error('gcd/lcm need whole numbers');
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

// arity: 1 (default) or [min, max]
const FUNCS = {
  sin: sinX,
  cos: cosX,
  tan: (x, d) => {
    const c = cosX(x, d);
    if (c === 0) return NaN; // tan(90°) is undefined
    const s = sinX(x, d);
    return s === 0 ? 0 : Math.tan(toRad(x, d));
  },
  asin: inv(Math.asin), acos: inv(Math.acos), atan: inv(Math.atan),
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  ln: Math.log,
  log: Object.assign((x, d, base) => (base === undefined ? Math.log10(x) : Math.log(x) / Math.log(base)), { arity: [1, 2] }),
  log2: Math.log2, log10: Math.log10,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sign: Math.sign,
  fact: factorial,
  gamma,
  root: Object.assign((x, d, n) => {
    if (n === 0) return NaN;
    if (x < 0 && Number.isInteger(n) && n % 2 !== 0) return -Math.pow(-x, 1 / n);
    return Math.pow(x, 1 / n);
  }, { arity: [2, 2] }),
  ncr: Object.assign((n, d, r) => nCr(n, r), { arity: [2, 2] }),
  npr: Object.assign((n, d, r) => nPr(n, r), { arity: [2, 2] }),
  mod: Object.assign((a, d, b) => mod(a, b), { arity: [2, 2] }),
  gcd: Object.assign((...a) => a.filter((_, i) => i !== 1).reduce(gcd2), { arity: [2, 20] }),
  lcm: Object.assign((...a) => a.filter((_, i) => i !== 1).reduce((x, y) => (x && y ? Math.abs(x / gcd2(x, y) * y) : 0)), { arity: [2, 20] }),
  min: Object.assign((...a) => Math.min(...a.filter((_, i) => i !== 1)), { arity: [1, 50] }),
  max: Object.assign((...a) => Math.max(...a.filter((_, i) => i !== 1)), { arity: [1, 50] }),
};
const CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2, 'φ': (1 + Math.sqrt(5)) / 2, tau: 2 * Math.PI, 'τ': 2 * Math.PI };
// Word operators that act as infix binary operators at multiplication precedence.
const INFIX = { mod: 'mod', ncr: 'C', npr: 'P' };

/** Normalises common Unicode / typing variants into the parser's ASCII syntax. */
function normalise(src) {
  return String(src)
    .replace(/[×✕✖·⋅∙]/g, '*')
    .replace(/[÷∕]/g, '/')
    .replace(/[−–—]/g, '-')
    .replace(/√/g, 'sqrt')
    .replace(/∛/g, 'cbrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\*\*/g, '^')
    .replace(/[ \s]+/g, ' ');
}

function tokenize(src) {
  const s = normalise(src);
  if (s.length > MAX_LEN) throw new Error('Expression is too long');
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
      if (!m) throw new Error(`Invalid number at position ${i + 1}`);
      const after = s[i + m[0].length];
      if (after === '.' || (after && /\d/.test(after))) {
        const bad = s.slice(i).match(/^[\d.]+/)[0];
        throw new Error(`Invalid number "${bad}"`);
      }
      tokens.push({ t: 'num', v: parseFloat(m[0]), pos: i });
      i += m[0].length;
    } else if (/[a-zπφτ]/i.test(c)) {
      const m = s.slice(i).match(/^([πφτ]|log2(?=\()|log10(?=\()|[a-z]+)/i);
      tokens.push({ t: 'id', v: m[0].toLowerCase(), pos: i });
      i += m[0].length;
    } else if (c === '!' && s[i + 1] === '!') {
      tokens.push({ t: '!!', pos: i });
      i += 2;
    } else if ('+-*/^()!%,'.includes(c)) {
      tokens.push({ t: c, pos: i });
      i++;
    } else {
      throw new Error(`Unexpected "${c}" at position ${i + 1}`);
    }
  }
  return tokens;
}

const KNOWN = [...Object.keys(FUNCS), ...Object.keys(CONSTS), 'ans'].sort((a, b) => b.length - a.length);

/** Splits identifiers like "pie" or "2pix" into known names greedily; lone "x" means multiply. */
function splitIds(tokens) {
  const out = [];
  for (const tk of tokens) {
    if (tk.t !== 'id' || FUNCS[tk.v] || CONSTS[tk.v] !== undefined || tk.v === 'ans') {
      out.push(tk);
      continue;
    }
    let rest = tk.v;
    let pos = tk.pos;
    while (rest) {
      const n = KNOWN.find((x) => rest.startsWith(x));
      if (n) {
        out.push({ t: 'id', v: n, pos });
        rest = rest.slice(n.length);
        pos += n.length;
      } else if (rest[0] === 'x') {
        out.push({ t: '*', pos });
        rest = rest.slice(1);
        pos++;
      } else {
        throw new Error(`Unknown name "${tk.v}"`);
      }
    }
  }
  return out;
}

const NICE = { ncr: 'nCr', npr: 'nPr' };
const nice = (v) => NICE[v] || v;
const describe = (x) => (!x ? 'end of input' : x.t === 'num' ? `"${x.v}"` : x.t === 'id' ? `"${nice(x.v)}"` : `"${x.t}"`);

/**
 * Evaluates a math expression. Returns a number (NaN for domain errors such as
 * √−1 or tan 90°, ±Infinity on overflow). Throws an Error with a readable message
 * for syntax errors.
 * @param {string} src
 * @param {{deg?:boolean, ans?:number}} [opts] deg: trig in degrees; ans: value of "Ans"
 */
export function evaluate(src, { deg = false, ans = 0 } = {}) {
  const tk = splitIds(tokenize(String(src ?? '')));
  let p = 0;
  let depth = 0;
  const peek = () => tk[p];
  // In operator position (after an operand) "mod" / "nCr" / "nPr" are infix operators;
  // in operand position they are functions: mod(7, 3), nCr(5, 2).
  const isInfix = (x) => x && x.t === 'id' && INFIX[x.v];
  const startsPrimary = (x) => x && (x.t === 'num' || (x.t === 'id' && !INFIX[x.v]) || x.t === '(');
  const enter = () => { if (++depth > MAX_DEPTH) throw new Error('Expression is nested too deeply'); };

  function expr() {
    enter();
    let v = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = tk[p++].t;
      if (!peek() || [')', '*', '/', '^', '!', '%', ','].includes(peek().t)) throw new Error(`Missing number after "${op}"`);
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    depth--;
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const x = peek();
      if (x && (x.t === '*' || x.t === '/')) {
        p++;
        if (!peek()) throw new Error(`Missing number after "${x.t}"`);
        const r = unary();
        v = x.t === '*' ? v * r : v / r;
      } else if (isInfix(x)) {
        p++;
        if (!peek()) throw new Error(`Missing number after "${nice(x.v)}"`);
        const r = unary();
        const op = INFIX[x.v];
        v = op === 'mod' ? mod(v, r) : op === 'C' ? nCr(v, r) : nPr(v, r);
      } else if (startsPrimary(x)) {
        v *= power(); // implicit multiplication: 2π, 3(4), 2sin(30)
      } else break;
    }
    return v;
  }
  function unary() {
    if (peek()?.t === '-') { p++; return -unary(); }
    if (peek()?.t === '+') { p++; return unary(); }
    return power();
  }
  function power() {
    const base = postfix();
    if (peek()?.t === '^') {
      p++;
      const nx = peek();
      if (!nx) throw new Error('Missing exponent after "^"');
      if (nx.t === '^') throw new Error('Two "^" in a row — did you mean a single "^"?');
      if (['*', '/', ')', '!', '%', ','].includes(nx.t)) throw new Error(`Missing exponent after "^"`);
      enter();
      const e = unary(); // right-associative
      depth--;
      return Math.pow(base, e);
    }
    return base;
  }
  function postfix() {
    let v = primary();
    while (peek() && (peek().t === '!' || peek().t === '!!' || peek().t === '%')) {
      const op = tk[p++].t;
      v = op === '!' ? factorial(v) : op === '!!' ? doubleFactorial(v) : v / 100;
    }
    return v;
  }
  function args() {
    // assumes current token is '('
    p++;
    const list = [];
    if (peek()?.t === ')') throw new Error('Empty parentheses');
    for (;;) {
      list.push(expr());
      if (peek()?.t === ',') {
        p++;
        if (!peek() || peek().t === ')') throw new Error('Missing argument after ","');
        continue;
      }
      if (peek()?.t === ')') p++;
      else if (peek()) throw new Error(`Unexpected ${describe(peek())} — expected ")"`);
      return list;
    }
  }
  function primary() {
    const x = peek();
    if (!x) throw new Error('Incomplete expression');
    if (x.t === 'num') { p++; return x.v; }
    if (x.t === '(') {
      p++;
      if (peek()?.t === ')') throw new Error('Empty parentheses');
      const v = expr();
      if (peek()?.t === ')') p++;
      else if (peek()?.t === ',') throw new Error('Unexpected "," — commas only separate function arguments, e.g. nCr(5, 2)');
      else if (peek()) throw new Error(`Unexpected ${describe(peek())}`);
      return v;
    }
    if (x.t === 'id') {
      p++;
      if (x.v === 'ans') return ans;
      if (CONSTS[x.v] !== undefined) return CONSTS[x.v];
      if (INFIX[x.v] && peek()?.t !== '(') throw new Error(`Missing number before "${nice(x.v)}" — write e.g. 7 ${nice(x.v)} 3 or ${nice(x.v)}(7, 3)`);
      const f = FUNCS[x.v];
      if (f) {
        const [lo, hi] = f.arity || [1, 1];
        if (peek()?.t === '(') {
          const a = args();
          if (a.length < lo || a.length > hi) {
            const want = lo === hi ? `${lo}` : `${lo}–${hi}`;
            throw new Error(`${nice(x.v)}() takes ${want} argument${hi === 1 ? '' : 's'}, got ${a.length}`);
          }
          return f(a[0], deg, ...a.slice(1));
        }
        if (lo > 1) throw new Error(`${nice(x.v)} needs parentheses, e.g. ${nice(x.v)}(5, 2)`);
        if (!peek()) throw new Error(`Missing value after "${nice(x.v)}"`);
        return f(power(), deg);
      }
    }
    if (x.t === ')') throw new Error(p === 0 || ['(', '+', '-', '*', '/', '^', ','].includes(tk[p - 1]?.t) ? 'Missing number before ")"' : 'Unmatched ")"');
    if (x.t === '!' || x.t === '!!' || x.t === '%') throw new Error(`"${x.t}" must follow a number`);
    if (['*', '/', '^'].includes(x.t)) throw new Error(`Missing number before "${x.t}"`);
    if (x.t === ',') throw new Error('Unexpected ","');
    if (x.t === 'id' && INFIX[x.v]) throw new Error(`Missing number before "${nice(x.v)}"`);
    throw new Error(`Unexpected ${describe(x)}`);
  }

  if (!tk.length) return 0;
  const v = expr();
  if (p < tk.length) {
    const x = tk[p];
    if (x.t === ')') throw new Error('Unmatched ")"');
    if (x.t === ',') throw new Error('Unexpected "," — commas only separate function arguments, e.g. nCr(5, 2)');
    throw new Error(`Unexpected ${describe(x)}`);
  }
  return Object.is(v, -0) ? 0 : v;
}
