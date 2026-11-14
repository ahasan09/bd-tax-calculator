// Form state ↔ engine inputs ↔ share links, and the pure text helpers the
// React components use.
import { describe, expect, test } from 'vitest';
import { calculateTax, defaultNextMonth } from '../src/engine/tax';
import { decode, encode } from '../src/engine/state';
import { createI18n } from '../src/i18n';
import {
  effectiveNextMonth, emptyForm, fromShared, newEmployer, newPeriod, nextEmployerStart, toTaxInputs, type FormState
} from '../src/state/form';
import { investmentHint, salaryWarnings } from '../src/components/text';

// The owner's spreadsheet sample: ৳1,00,000 Jul–Dec, ৳1,10,000 Jan–Jun.
function sampleForm(): FormState {
  const f = emptyForm();
  return {
    ...f,
    taxYear: '2026-27',
    employers: [{ ...newEmployer(), periods: [newPeriod(0, 5, 100000), newPeriod(6, 11, 110000)], bonus: 110000, tds: 12000 }],
    investments: { ...f.investments, providentFund: 40000, dps: 60000, govtSecurities: 150000, lifeInsurance: 24000 },
    nextMonth: 4
  };
}

describe('form state', () => {
  test('an empty form calculates to zero', () => {
    const r = calculateTax(toTaxInputs(emptyForm()));
    expect([r.grossSalary, r.finalTax, r.netPayable]).toEqual([0, 0, 0]);
  });

  test('the sample form gives the spreadsheet result', () => {
    const r = calculateTax(toTaxInputs(sampleForm()));
    expect([r.taxableIncome, r.finalTax, r.netPayable, r.plan.perMonth]).toEqual([913333, 34600, 22600, 2825]);
  });

  test('form → share link → form keeps the result', () => {
    const f = sampleForm();
    const back = fromShared(decode(encode(toTaxInputs(f), { keepNextMonth: true }))!);
    const a = calculateTax(toTaxInputs(f)), b = calculateTax(toTaxInputs(back));
    expect(b.netPayable).toBe(a.netPayable);
    expect(b.plan).toEqual(a.plan);
    expect(back.employers[0].periods.map(p => [p.monthlyAmount, p.fromMonth, p.toMonth]))
      .toEqual([[100000, 0, 5], [110000, 6, 11]]);
    expect(back.nextMonth).toBe(4);
  });

  test('zero amounts from a link show as empty fields', () => {
    const back = fromShared(decode(encode(toTaxInputs(emptyForm())))!);
    expect([back.bankInterest, back.employers[0].bonus, back.investments.dps]).toEqual(['', '', '']);
    expect(back.employers[0].periods).toHaveLength(1);
  });

  test('next month follows the date until the user picks one', () => {
    const f = { ...emptyForm(), taxYear: '2027-28' };
    expect(effectiveNextMonth(f)).toBe(defaultNextMonth('2027-28'));
    expect(effectiveNextMonth({ ...f, nextMonth: 7 })).toBe(7);
  });

  test('a new employer starts after the last paid month', () => {
    const e = (from: number, to: number, amount: number | '' = 50000) => ({ ...newEmployer(), periods: [newPeriod(from, to, amount)] });
    expect(nextEmployerStart([e(0, 5)])).toBe(6);
    expect(nextEmployerStart([e(0, 11)])).toBe(0);
    expect(nextEmployerStart([e(0, 5, '')])).toBe(0);   // nothing paid yet
  });
});

describe('text helpers', () => {
  const en = createI18n('en'), bn = createI18n('bn');

  test('salary warnings: invalid range, double-counted month, two employers', () => {
    const bad = { ...newEmployer(), periods: [newPeriod(5, 2, 1000)] };
    expect(salaryWarnings(en, [bad])).toEqual(['"Dec–Sep" is invalid (start is after end) — row ignored.']);
    const two = [{ ...newEmployer(), periods: [newPeriod(0, 11, 1000)] }, { ...newEmployer(), periods: [newPeriod(3, 4, 500)] }];
    expect(salaryWarnings(en, two)).toEqual(['Oct, Nov paid by more than one employer — both salaries are counted.']);
    expect(salaryWarnings(bn, two)).toEqual(['অক্টোবর, নভেম্বর মাসে একাধিক নিয়োগকর্তা বেতন দিয়েছে — দুটো বেতনই ধরা হয়েছে।']);
  });

  test('investment hint in both languages', () => {
    const r = calculateTax(toTaxInputs(sampleForm()));
    expect(investmentHint(en, r)).toBe("You've met the ৳2,74,000 investment target — maximum rebate of ৳27,400 applied.");
    expect(investmentHint(bn, r)).toBe('আপনি ৳২,৭৪,০০০ বিনিয়োগের লক্ষ্য পূরণ করেছেন — সর্বোচ্চ ৳২৭,৪০০ রেয়াত পাচ্ছেন।');
  });
});
