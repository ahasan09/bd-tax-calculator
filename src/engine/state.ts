// Share-link state: form inputs <-> a compact string for the URL fragment
// (#s=…). The fragment never reaches a server. No DOM, no React.
import { CATEGORIES, INVESTMENT_ITEMS, YEARS, type Category, type InvestmentKey, type TaxInputs } from './tax';

const VERSION = 1;
const MAX_EMPLOYERS = 10;
const MAX_ROWS = 24;

// ---- base64url over UTF-8 ----
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

// A positive finite amount, or undefined (dropped from the link).
function amount(v: unknown): number | undefined {
  const n = Number(v);
  return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined;
}
const month = (v: unknown, max = 11): number | undefined =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max ? v as number : undefined;
// Drop undefined / empty values so links stay short.
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === 0 && k !== 'n' || (Array.isArray(v) && !v.length) ||
      (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)) continue;
    out[k] = v;
  }
  return out;
}

// Decoded link state: the calculator inputs with every field present and
// validated (amounts as numbers). nextMonth only when the sender chose it.
export interface SharedState {
  taxYear?: string;
  category: Category;
  isFirstTimeTaxpayer: boolean;
  disabledDependents: number;
  employers: { salaryPeriods: { monthlyAmount: number; fromMonth: number; toMonth: number }[]; bonus: number; tds: number }[];
  otherIncomes: {
    bankInterest: { amount: number; tds: number };
    savingsInterest: { amount: number; tds: number };
    rent: { amount: number };
    agriculture: { amount: number };
    other: { amount: number };
  };
  advanceTax: number;
  investments: Record<InvestmentKey, number>;
  nextMonth?: number;
}

// nextMonth is kept only when the user chose it (otherwise it follows the date).
export function encode(inputs: TaxInputs, { keepNextMonth = false } = {}): string {
  const o = inputs.otherIncomes || {};
  const pair = (e?: { amount?: unknown; tds?: unknown }) =>
    e && (amount(e.amount) || amount(e.tds)) ? [amount(e.amount) || 0, amount(e.tds) || 0] : undefined;
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
    o: compact({ bi: pair(o.bankInterest), si: pair(o.savingsInterest),
      rt: amount(o.rent?.amount), ag: amount(o.agriculture?.amount), ot: amount(o.other?.amount) }),
    a: amount(inputs.advanceTax),
    i: compact(Object.fromEntries(Object.entries(inputs.investments || {}).map(([k, v]) => [k, amount(v)]))),
    n: keepNextMonth ? inputs.nextMonth : undefined
  });
  return toBase64Url(JSON.stringify(state));
}

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v);

// Returns the validated state, or null when the string can't be read. Every
// field is checked: a link is untrusted input.
export function decode(s: string): SharedState | null {
  let raw: unknown;
  try { raw = JSON.parse(fromBase64Url(String(s))); } catch { return null; }
  if (!isObject(raw) || raw.v !== VERSION) return null;

  const employers = Array.isArray(raw.e) ? raw.e.slice(0, MAX_EMPLOYERS) : [];
  const o = isObject(raw.o) ? raw.o : {};
  const pair = (p: unknown) => Array.isArray(p) ? { amount: amount(p[0]) || 0, tds: amount(p[1]) || 0 } : { amount: 0, tds: 0 };
  const inv = isObject(raw.i) ? raw.i : {};

  const out: SharedState = {
    category: (CATEGORIES as readonly unknown[]).includes(raw.c) ? raw.c as Category : 'general',
    isFirstTimeTaxpayer: raw.f === 1,
    disabledDependents: Math.min(Math.floor(amount(raw.d) || 0), 20),
    employers: employers.filter(isObject).map(e => ({
      salaryPeriods: (Array.isArray(e.p) ? e.p.slice(0, MAX_ROWS) : [])
        .filter((p): p is unknown[] => Array.isArray(p) && month(p[1]) !== undefined && month(p[2]) !== undefined)
        .map(p => ({ monthlyAmount: amount(p[0]) || 0, fromMonth: p[1] as number, toMonth: p[2] as number })),
      bonus: amount(e.b) || 0,
      tds: amount(e.t) || 0
    })),
    otherIncomes: { bankInterest: pair(o.bi), savingsInterest: pair(o.si),
      rent: { amount: amount(o.rt) || 0 }, agriculture: { amount: amount(o.ag) || 0 }, other: { amount: amount(o.ot) || 0 } },
    advanceTax: amount(raw.a) || 0,
    investments: Object.fromEntries(INVESTMENT_ITEMS.map(({ key }) => [key, amount(inv[key]) || 0])) as Record<InvestmentKey, number>
  };
  if (typeof raw.y === 'string' && YEARS.includes(raw.y)) out.taxYear = raw.y;
  const n = month(raw.n, 12);
  if (n !== undefined) out.nextMonth = n;
  return out;
}
