// Share-link state: form inputs <-> a compact string for the URL fragment
// (#s=…). The fragment never reaches a server. No DOM access — loaded by
// index.html, tests.html and the node test runner, after tax.js.
const BDState = (() => {
  'use strict';
  const VERSION = 1;
  const MAX_EMPLOYERS = 10;
  const MAX_ROWS = 24;

  // ---- base64url over UTF-8 ----
  function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromBase64Url(s) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  }

  // A positive finite amount, or undefined (dropped from the link).
  function amount(v) {
    const n = Number(v);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
  }
  const month = (v, max = 11) => Number.isInteger(v) && v >= 0 && v <= max ? v : undefined;
  // Drop undefined / empty values so links stay short.
  function compact(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === 0 && k !== 'n' || (Array.isArray(v) && !v.length) ||
        (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) continue;
      out[k] = v;
    }
    return out;
  }

  // inputs: the shape app.js reads from the form (and calculateTax takes).
  // nextMonth is kept only when the user chose it (otherwise it follows the date).
  function encode(inputs, { keepNextMonth = false } = {}) {
    const o = inputs.otherIncomes || {};
    const pair = e => e && (amount(e.amount) || amount(e.tds)) ? [amount(e.amount) || 0, amount(e.tds) || 0] : undefined;
    const state = compact({
      v: VERSION,
      y: inputs.taxYear,
      c: inputs.category !== 'general' ? inputs.category : undefined,
      f: inputs.isFirstTimeTaxpayer ? 1 : undefined,
      d: amount(inputs.disabledDependents),
      e: (inputs.employers || []).map(e => compact({
        p: (e.salaryPeriods || []).map(p => [amount(p.monthlyAmount) || 0, p.fromMonth, p.toMonth]),
        b: amount(e.bonus),
        t: amount(e.tds)
      })),
      o: compact({ bi: pair(o.bankInterest), si: pair(o.savingsInterest), ot: amount(o.other && o.other.amount) }),
      a: amount(inputs.advanceTax),
      i: compact(Object.fromEntries(Object.entries(inputs.investments || {}).map(([k, v]) => [k, amount(v)]))),
      n: keepNextMonth ? inputs.nextMonth : undefined
    });
    return toBase64Url(JSON.stringify(state));
  }

  // Returns form inputs (amounts as numbers, absent fields omitted) or null
  // when the string can't be read. Every field is validated: a link is
  // untrusted input.
  function decode(s) {
    let raw;
    try { raw = JSON.parse(fromBase64Url(String(s))); } catch (e) { return null; }
    if (!raw || typeof raw !== 'object' || raw.v !== VERSION) return null;
    const rules = BDTax.RULES[BDTax.YEARS[0]];
    const out = {};
    if (BDTax.YEARS.includes(raw.y)) out.taxYear = raw.y;
    out.category = Object.prototype.hasOwnProperty.call(rules.thresholds, raw.c) ? raw.c : 'general';
    out.isFirstTimeTaxpayer = raw.f === 1;
    out.disabledDependents = Math.min(Math.floor(amount(raw.d) || 0), 20);

    const employers = Array.isArray(raw.e) ? raw.e.slice(0, MAX_EMPLOYERS) : [];
    out.employers = employers.filter(e => e && typeof e === 'object').map(e => ({
      salaryPeriods: (Array.isArray(e.p) ? e.p.slice(0, MAX_ROWS) : [])
        .filter(p => Array.isArray(p) && month(p[1]) !== undefined && month(p[2]) !== undefined)
        .map(p => ({ monthlyAmount: amount(p[0]) || 0, fromMonth: p[1], toMonth: p[2] })),
      bonus: amount(e.b) || 0,
      tds: amount(e.t) || 0
    }));

    const o = raw.o && typeof raw.o === 'object' ? raw.o : {};
    const pair = p => Array.isArray(p) ? { amount: amount(p[0]) || 0, tds: amount(p[1]) || 0 } : { amount: 0, tds: 0 };
    out.otherIncomes = { bankInterest: pair(o.bi), savingsInterest: pair(o.si), other: { amount: amount(o.ot) || 0 } };
    out.advanceTax = amount(raw.a) || 0;

    const inv = raw.i && typeof raw.i === 'object' ? raw.i : {};
    out.investments = {};
    for (const { key } of rules.investmentItems) out.investments[key] = amount(inv[key]) || 0;

    if (month(raw.n, 12) !== undefined) out.nextMonth = raw.n;
    return out;
  }

  return { encode, decode };
})();
