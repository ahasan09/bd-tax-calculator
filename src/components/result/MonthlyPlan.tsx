import { Box, Group, Stack, Text, Title } from '@mantine/core';
import type { TaxResult } from '../../engine/tax';
import { useLang } from '../../i18n/context';

// Headline + formula for every case the planner can be in.
function usePlanText(result: TaxResult) {
  const { t, money, month, digits } = useLang().i18n;
  const p = result.plan;
  const amt = (n: number) => <Text span fw={800} fz={22} c="bdgreen" className="amt">{money(n)}</Text>;
  const left = p.months.map((m, i) => m.status === 'planned' ? i : -1).filter(i => i >= 0);
  // t() returns a string; split on the {amount} slot so the amount can be styled.
  const withAmount = (key: string, n: number, params: Record<string, string> = {}) => {
    const [before, after] = t(key, { ...params, amount: '\u0000' }).split('\u0000');
    return <>{before}{amt(n)}{after}</>;
  };
  if (result.finalTax === 0) return { head: t('plan.noTax') };
  if (result.refundable > 0) return { head: t('plan.over', { amount: money(result.refundable) }) };
  if (p.remaining === 0) return { head: t('plan.full') };
  if (p.monthsLeft === 0) return { head: withAmount('plan.payWithReturn', p.payWithReturn) };
  const many = result.employers.length > 1;
  const span = p.monthsLeft < 12 ? t('plan.span', { range: `${month(left[0])}–${month(left[left.length - 1])}` }) : '';
  const how = result.tds > result.employerTds ? 'plan.how.paid' : many ? 'plan.how.allEmployers' : 'plan.how.deducted';
  return {
    head: withAmount(many ? 'plan.perMonthCurrent' : 'plan.perMonth', p.perMonth, { span }),
    sub: result.tds > 0
      ? t('plan.subPaid', { annual: money(result.finalTax), paid: money(result.tds), how: t(how), n: digits(p.monthsLeft) })
      : t('plan.subFull', { annual: money(result.finalTax), n: digits(p.monthsLeft) })
  };
}

const CELL = {
  deducted: { bg: 'var(--mantine-color-bdgreen-8)', c: 'white' },
  planned: { bg: 'var(--mantine-color-bdgreen-light)', c: 'var(--mantine-color-bdgreen-light-color)' },
  none: { bg: 'var(--mantine-color-default-hover)', c: 'dimmed' }
} as const;

export function MonthlyPlan({ result }: { result: TaxResult }) {
  const { t, money, month } = useLang().i18n;
  const text = usePlanText(result);
  const p = result.plan;
  if (result.grossSalary === 0 && result.finalTax === 0) {
    return <Text size="sm" c="dimmed">{t('plan.empty')}</Text>;
  }
  // The month strip only helps while there is something left to spread.
  const showGrid = p.months.some(m => m.status !== 'none') && (p.perMonth > 0 || p.monthsLeft === 0);
  return (
    <Stack gap="sm">
      <Title order={3} size="h6" className="print-only">{t('plan.title')}</Title>
      <div>
        <Text size="sm">{text.head}</Text>
        {text.sub && <Text size="xs" c="dimmed" mt={2}>{text.sub}</Text>}
      </div>
      {showGrid && (
        <>
          {/* Columns follow the grid's own width (container query), not the
              screen's: 3, 4 or 6 — always a whole number of rows for 12 months. */}
          <div className="plan-wrap"><div className="plan-grid">
            {p.months.map((m, i) => (
              <Box key={i} bg={CELL[m.status].bg} c={CELL[m.status].c} p={6} ta="center" style={{ borderRadius: 6 }}>
                <Text fz={11} fw={600} lh={1.3}>{month(i)}</Text>
                <Text fz={11} className="amt" lh={1.3}>
                  {m.status === 'planned' ? money(m.amount).slice(1) : m.status === 'deducted' ? t('plan.done') : '—'}
                </Text>
              </Box>
            ))}
          </div></div>
          <Group gap="md">
            {(['deducted', 'planned', 'none'] as const).map(s => (
              <Group key={s} gap={6}>
                <Box w={10} h={10} bg={CELL[s].bg} style={{ borderRadius: 2 }} />
                <Text fz={11} c="dimmed">{t('plan.key.' + s)}</Text>
              </Group>
            ))}
          </Group>
        </>
      )}
    </Stack>
  );
}
