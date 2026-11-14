import type { ReactNode } from 'react';
import { Anchor, Divider, Group, Stack, Text } from '@mantine/core';
import type { TaxResult } from '../../engine/tax';
import { useLang } from '../../i18n/context';
import { rebateCandidatesText } from '../text';

function Line({ label, amount, sub, bold }: { label: ReactNode; amount: string; sub?: string; bold?: boolean }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
      <div>
        <Text size="sm" fw={bold ? 700 : 400}>{label}</Text>
        {sub && <Text size="xs" c="dimmed">{sub}</Text>}
      </div>
      <Text size="sm" fw={bold ? 700 : 400} className="amt" style={{ whiteSpace: 'nowrap' }}>{amount}</Text>
    </Group>
  );
}

// One place decides how the bottom line reads — pane, live region, mobile bar.
export function totalView(t: (k: string) => string, money: (n: number) => string, result: TaxResult) {
  const refund = result.refundable > 0;
  return {
    refund,
    label: t(refund ? 'total.refundable' : 'total.payable'),
    shortLabel: t(refund ? 'total.refundShort' : 'total.payable'),
    amount: money(refund ? result.refundable : result.netPayable)
  };
}

export function Breakdown({ result, onShowPlan }: { result: TaxResult; onShowPlan: () => void }) {
  const { i18n } = useLang();
  const { t, money, pct, digits } = i18n;
  const many = result.employers.length > 1;
  const perEmployer = (key: 'gross' | 'tds') =>
    result.employers.map((e, i) => t('bd.employerAmt', { n: digits(i + 1), amount: money(e[key]) })).join(' · ');
  const total = totalView(t, money, result);
  const hasPlan = result.grossSalary > 0 || result.finalTax > 0;

  return (
    <Stack gap={8}>
      <Line label={t('bd.gross')} amount={money(result.grossSalary)}
        sub={[many ? perEmployer('gross') : '', result.bonus > 0 ? t('bd.includesBonus', { amount: money(result.bonus) }) : '']
          .filter(Boolean).join('; ')} />
      <Line label={t('bd.taxFree')} amount={money(result.exemption)}
        sub={t('bd.taxFreeSub', { cap: money(result.rules.salaryExemption.cap) }) + (many ? t('bd.taxFreeCombined') : '')} />
      {result.otherIncomeItems.filter(i => i.amount > 0).map(i =>
        <Line key={i.key} label={`+ ${t('bd.inc.' + i.key)}`} amount={money(i.amount)} />)}
      <Divider />
      <Line bold label={t('bd.taxable')} amount={money(result.taxableIncome)} />
      <Divider />
      {result.slabs.map((s, i) => (
        <Line key={i} amount={money(s.tax)} label={i === 0
          ? t('bd.slabFirst', { amount: money(s.amount) })
          : t('bd.slabNext', { amount: money(s.amount), rate: pct(s.rate) })} />
      ))}
      <Line bold label={t('bd.beforeRebate')} amount={money(result.grossTax)} />
      {result.rebate > 0 && <Line label={t('bd.rebate')} amount={money(result.rebate)}
        sub={t('bd.rebateSub', { list: rebateCandidatesText(i18n, result) })} />}
      <Line bold label={t('bd.annual')} amount={money(result.finalTax)}
        sub={result.minimumApplied ? t('bd.minimumSub', { amount: money(result.minimumTax) }) : undefined} />
      {result.employerTds > 0 && <Line label={t(many ? 'bd.byEmployers' : 'bd.byOffice')}
        amount={money(result.employerTds)} sub={many ? perEmployer('tds') : undefined} />}
      {result.sourceTds > 0 && <Line label={t('bd.onInterest')} amount={money(result.sourceTds)} />}
      {result.advanceTax > 0 && <Line label={t('bd.advance')} amount={money(result.advanceTax)} />}
      <Divider variant="dashed" my={4} />
      <Group justify="space-between" align="baseline" wrap="nowrap">
        <Text fw={700} size="lg" c={total.refund ? 'teal' : undefined}>{total.label}</Text>
        <Text fw={800} fz={30} className="amt" c={total.refund ? 'teal' : 'bdgreen'}>{total.amount}</Text>
      </Group>
      {hasPlan && (
        <Anchor component="button" type="button" size="sm" ta="left" onClick={onShowPlan} className="no-print">
          {result.plan.perMonth > 0 ? t('bd.planLink', { amount: money(result.plan.perMonth) }) : t('bd.planLinkPlain')}
        </Anchor>
      )}
    </Stack>
  );
}
