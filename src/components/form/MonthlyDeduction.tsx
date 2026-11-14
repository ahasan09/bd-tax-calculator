import { Paper, Select, Stack, Title } from '@mantine/core';
import { MONTHS } from '../../engine/tax';
import { useLang } from '../../i18n/context';
import { effectiveNextMonth } from '../../state/form';
import type { Calculator } from '../../state/useCalculator';

// Next salary month: follows today's date for the chosen year until the
// user picks one.
export function MonthlyDeduction({ calc }: { calc: Calculator }) {
  const { t, month } = useLang().i18n;
  const data = [...MONTHS.map((_, i) => ({ value: String(i), label: month(i) })),
    { value: '12', label: t('monthly.yearOver') }];
  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        <Title order={2} size="h4">{t('monthly.heading')}</Title>
        <Select
          label={t('monthly.next')}
          description={t('monthly.nextHint')}
          data={data}
          value={String(effectiveNextMonth(calc.form))}
          onChange={v => v !== null && calc.actions.update({ nextMonth: Number(v) })}
          allowDeselect={false}
        />
      </Stack>
    </Paper>
  );
}
