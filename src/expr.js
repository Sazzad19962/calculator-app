// Safe math expression evaluator (no eval). Recursive-descent parser supporting
// + − × ÷ ^ ! %, parentheses, implicit multiplication, constants and functions.

const FUNCS = {
  sin: (x, d) => Math.sin(d ? x * Math.PI / 180 : x),
  cos: (x, d) => Math.cos(d ? x * Math.PI / 180 : x),
  tan: (x, d) => {
    if (d && Math.abs(x % 180) === 90) return NaN;
    return Math.tan(d ? x * Math.PI / 180 : x);
  },
  asin: (x, d) => Math.asin(x) * (d ? 180 / Math.PI : 1),
  acos: (x, d) => Math.acos(x) * (d ? 180 / Math.PI : 1),
  atan: (x, d) => Math.atan(x) * (d ? 180 / Math.PI : 1),
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
};
const CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E, phi: (1 + Math.sqrt(5)) / 2 };

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function tokenize(src) {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/√/g, 'sqrt').replace(/\s+/g, '');
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      const m = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
      if (!m) throw new Error('Invalid number');
      tokens.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
    } else if (/[a-zπ]/i.test(c)) {
      const m = s.slice(i).match(/^(π|log2|[a-z]+)/i);
      tokens.push({ t: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
    } else if ('+-*/^()!%'.includes(c)) {
      tokens.push({ t: c });
      i++;
    } else {
      throw new Error(`Unexpected "${c}"`);
    }
  }
  return tokens;
}

/** Splits identifiers like "pie" or "2pix" into known names greedily. */
function splitIds(tokens) {
  const out = [];
  const names = [...Object.keys(FUNCS), ...Object.keys(CONSTS), 'ans'].sort((a, b) => b.length - a.length);
  for (const tk of tokens) {
    if (tk.t !== 'id' || FUNCS[tk.v] || CONSTS[tk.v] !== undefined || tk.v === 'ans') {
      out.push(tk);
      continue;
    }
    let rest = tk.v;
    while (rest) {
      const n = names.find((x) => rest.startsWith(x));
      if (!n) throw new Error(`Unknown name "${rest}"`);
      out.push({ t: 'id', v: n });
      rest = rest.slice(n.length);
    }
  }
  return out;
}

export function evaluate(src, { deg = false, ans = 0 } = {}) {
  const tk = splitIds(tokenize(String(src)));
  let p = 0;
  const peek = () => tk[p];
  const take = (t) => {
    if (tk[p]?.t !== t) throw new Error(`Expected "${t}"`);
    return tk[p++];
  };
  const startsPrimary = (x) => x && (x.t === 'num' || x.t === 'id' || x.t === '(');

  function expr() {
    let v = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = tk[p++].t;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = unary();
    for (;;) {
      const x = peek();
      if (x && (x.t === '*' || x.t === '/')) {
        p++;
        const r = unary();
        v = x.t === '*' ? v * r : v / r;
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
      return Math.pow(base, unary()); // right-associative
    }
    return base;
  }
  function postfix() {
    let v = primary();
    while (peek() && (peek().t === '!' || peek().t === '%')) {
      v = tk[p++].t === '!' ? factorial(v) : v / 100;
    }
    return v;
  }
  function primary() {
    const x = peek();
    if (!x) throw new Error('Incomplete expression');
    if (x.t === 'num') { p++; return x.v; }
    if (x.t === '(') {
      p++;
      const v = expr();
      if (peek()?.t === ')') p++; // tolerate missing closing parens
      return v;
    }
    if (x.t === 'id') {
      p++;
      if (x.v === 'ans') return ans;
      if (CONSTS[x.v] !== undefined) return CONSTS[x.v];
      const f = FUNCS[x.v];
      if (f) {
        const arg = peek()?.t === '(' ? primary() : power();
        return f(arg, deg);
      }
    }
    throw new Error(`Unexpected "${x.v ?? x.t}"`);
  }

  if (!tk.length) return 0;
  const v = expr();
  if (p < tk.length) take('end');
  return v;
}
