// Form state for the calculator UI, and its mapping to the engine's inputs
// and the share-link state.
import { defaultNextMonth, defaultYear, INVESTMENT_ITEMS, type Category, type InvestmentKey, type TaxInputs } from '../engine/tax';
import type { SharedState } from '../engine/state';

// An amount field: a number, or '' while empty.
export type Num = number | '';

export interface PeriodForm { id: string; monthlyAmount: Num; fromMonth: number; toMonth: number }
export interface EmployerForm { id: string; periods: PeriodForm[]; bonus: Num; tds: Num }

export interface FormState {
  taxYear: string;
  category: Category;
  isFirstTimeTaxpayer: boolean;
  disabledDependents: Num;
  employers: EmployerForm[];
  bankInterest: Num;
  bankTds: Num;
  savingsInterest: Num;
  savingsTds: Num;
  rent: Num;
  agriculture: Num;
  otherIncome: Num;
  advanceTax: Num;
  investments: Record<InvestmentKey, Num>;
  // null = follow today's date for the chosen year.
  nextMonth: number | null;
}

let uid = 0;
export const newId = () => String(++uid);

export const newPeriod = (fromMonth = 0, toMonth = 11, monthlyAmount: Num = ''): PeriodForm =>
  ({ id: newId(), monthlyAmount, fromMonth, toMonth });
export const newEmployer = (fromMonth = 0): EmployerForm =>
  ({ id: newId(), periods: [newPeriod(fromMonth)], bonus: '', tds: '' });

const emptyInvestments = () =>
  Object.fromEntries(INVESTMENT_ITEMS.map(({ key }) => [key, ''])) as Record<InvestmentKey, Num>;

export function emptyForm(): FormState {
  return {
    taxYear: defaultYear(), category: 'general', isFirstTimeTaxpayer: false, disabledDependents: 0,
    employers: [newEmployer()],
    bankInterest: '', bankTds: '', savingsInterest: '', savingsTds: '',
    rent: '', agriculture: '', otherIncome: '', advanceTax: '',
    investments: emptyInvestments(), nextMonth: null
  };
}

export const effectiveNextMonth = (f: FormState) => f.nextMonth ?? defaultNextMonth(f.taxYear);

export function toTaxInputs(f: FormState): TaxInputs {
  return {
    taxYear: f.taxYear,
    category: f.category,
    isFirstTimeTaxpayer: f.isFirstTimeTaxpayer,
    disabledDependents: f.disabledDependents,
    employers: f.employers.map(e => ({
      salaryPeriods: e.periods.map(({ monthlyAmount, fromMonth, toMonth }) => ({ monthlyAmount, fromMonth, toMonth })),
      bonus: e.bonus, tds: e.tds
    })),
    otherIncomes: {
      bankInterest: { amount: f.bankInterest, tds: f.bankTds },
      savingsInterest: { amount: f.savingsInterest, tds: f.savingsTds },
      rent: { amount: f.rent },
      agriculture: { amount: f.agriculture },
      other: { amount: f.otherIncome }
    },
    advanceTax: f.advanceTax,
    investments: f.investments,
    nextMonth: effectiveNextMonth(f)
  };
}

// A decoded share link → form state (0 shows as an empty field).
export function fromShared(s: SharedState): FormState {
  const n = (v: number): Num => v > 0 ? v : '';
  const base = emptyForm();
  return {
    ...base,
    taxYear: s.taxYear ?? base.taxYear,
    category: s.category,
    isFirstTimeTaxpayer: s.isFirstTimeTaxpayer,
    disabledDependents: s.disabledDependents,
    employers: (s.employers.length ? s.employers : [{ salaryPeriods: [], bonus: 0, tds: 0 }]).map(e => ({
      id: newId(),
      periods: e.salaryPeriods.length
        ? e.salaryPeriods.map(p => newPeriod(p.fromMonth, p.toMonth, n(p.monthlyAmount)))
        : [newPeriod()],
      bonus: n(e.bonus), tds: n(e.tds)
    })),
    bankInterest: n(s.otherIncomes.bankInterest.amount), bankTds: n(s.otherIncomes.bankInterest.tds),
    savingsInterest: n(s.otherIncomes.savingsInterest.amount), savingsTds: n(s.otherIncomes.savingsInterest.tds),
    rent: n(s.otherIncomes.rent.amount), agriculture: n(s.otherIncomes.agriculture.amount),
    otherIncome: n(s.otherIncomes.other.amount),
    advanceTax: n(s.advanceTax),
    investments: Object.fromEntries(INVESTMENT_ITEMS.map(({ key }) => [key, n(s.investments[key])])) as Record<InvestmentKey, Num>,
    nextMonth: s.nextMonth ?? null
  };
}

// A new employer usually starts the month after the last one's salary ends.
export function nextEmployerStart(employers: EmployerForm[]): number {
  const ends = employers.flatMap(e => e.periods)
    .filter(p => Number(p.monthlyAmount) > 0 && p.toMonth >= p.fromMonth).map(p => p.toMonth);
  return ends.length && Math.max(...ends) < 11 ? Math.max(...ends) + 1 : 0;
}
