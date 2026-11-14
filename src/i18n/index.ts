// t('key', { name: value }) and number/date helpers for one language.
// Amounts are formatted by money()/digits() so Bangla shows ০–৯.
import { formatBDT } from '../engine/tax';
import { LANGS, MONTHS, T, type Lang } from './text';

export { LANGS, T, type Lang };

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

// Whatever the user typed (Bangla or Latin digits, commas, spaces) → a
// plain Latin number string the engine can read.
export function toLatinDigits(v: unknown): string {
  return String(v ?? '').replace(/[০-৯]/g, d => String(BN_DIGITS.indexOf(d))).replace(/[,\s]/g, '');
}

// The return form's own Bangla wording, shown under English labels.
export const formBangla = (key: string): string => T.bn[key];

export function createI18n(lang: Lang) {
  // Latin → Bangla digits (Bangla only); other characters untouched.
  const digits = (s: string | number) => {
    const str = String(s);
    return lang === 'bn' ? str.replace(/[0-9]/g, d => BN_DIGITS[Number(d)]) : str;
  };
  const t = (key: string, params: Record<string, string | number> = {}) => {
    const s = T[lang][key] ?? T.en[key];
    if (s === undefined) throw new Error(`missing text: ${key}`);
    return s.replace(/\{(\w+)\}/g, (m, name: string) => name in params ? String(params[name]) : m);
  };
  return {
    lang,
    t,
    digits,
    money: (n: number) => digits(formatBDT(n)),
    pct: (x: number) => digits((x * 100).toFixed(0) + '%'),
    month: (i: number) => MONTHS[lang][i]
  };
}
export type I18n = ReturnType<typeof createI18n>;
