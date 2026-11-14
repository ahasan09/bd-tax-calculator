// Sentences built from the result, shared by several components.
import type { Rules, TaxResult } from '../engine/tax';
import type { I18n } from '../i18n';
import type { EmployerForm } from '../state/form';

export const yearName = (i18n: I18n, r: Rules) =>
  i18n.t('year.name', { iy: i18n.digits(r.incomeYear), ay: i18n.digits(r.assessmentYear) });

// "3% of taxable income (৳X), 10% of investment (৳Y), or ৳7,50,000"
export function rebateCandidatesText(i18n: I18n, result: TaxResult) {
  const rb = result.rules.rebate;
  return i18n.t('invest.candidates', {
    ir: i18n.pct(rb.incomeRate), a: i18n.money(result.rebateBreakdown.byIncome),
    vr: i18n.pct(rb.investmentRate), b: i18n.money(result.rebateBreakdown.byInvestment), cap: i18n.money(rb.cap)
  });
}

// Warn on from>to rows and months counted twice; gaps are fine (mid-year joiners).
export function salaryWarnings(i18n: I18n, employers: EmployerForm[]): string[] {
  const msgs: string[] = [];
  const many = employers.length > 1;
  const prefix = (n: number) => many ? i18n.t('warn.prefix', { n: i18n.digits(n + 1) }) : '';
  const monthList = (idx: number[]) => idx.map(i18n.month).join(', ');
  const byEmployer = employers.map((e, n) => {
    const counts = new Array<number>(12).fill(0);
    for (const p of e.periods) {
      if (p.toMonth < p.fromMonth) {
        msgs.push(prefix(n) + i18n.t('warn.invalid', { from: i18n.month(p.fromMonth), to: i18n.month(p.toMonth) }));
      } else if (Number(p.monthlyAmount) > 0) {
        for (let m = p.fromMonth; m <= p.toMonth; m++) counts[m]++;
      }
    }
    const dup = counts.map((c, i) => c > 1 ? i : -1).filter(i => i >= 0);
    if (dup.length) msgs.push(prefix(n) + i18n.t('warn.dup', { months: monthList(dup) }));
    return counts;
  });
  const shared = [...Array(12).keys()].filter(i => byEmployer.filter(c => c[i] > 0).length > 1);
  if (shared.length) msgs.push(i18n.t('warn.shared', { months: monthList(shared) }));
  return msgs;
}

// Actionable advice under the investments: target, saving, after-max tax.
export function investmentHint(i18n: I18n, result: TaxResult): string {
  const adv = result.investmentAdvice;
  const { money } = i18n;
  const parts: string[] = [];
  if (adv.targetInvestment > 0) {
    parts.push(i18n.t(result.rebateBreakdown.byInvestment >= adv.maxUsefulRebate ? 'invest.met' : 'invest.target',
      { target: money(adv.targetInvestment), max: money(adv.maxUsefulRebate) }));
  }
  if (adv.tip) {
    parts.push(i18n.t('invest.more.tip', { extra: money(adv.tip.extraInvestment), saving: money(adv.tip.saving),
      where: result.investmentItems.some(i => i.capped) ? i18n.t('invest.more.where') : '' }));
    parts.push(i18n.t('invest.drops', { target: money(adv.targetInvestment), tax: money(adv.taxIfMaxInvested) }) +
      (result.plan.monthsLeft > 0
        ? i18n.t('invest.drops.monthly', { monthly: money(adv.monthlyTdsIfMaxInvested) }) : i18n.t('invest.drops.end')));
  }
  return parts.join(' ');
}
