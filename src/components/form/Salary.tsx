import { ActionIcon, Alert, Button, Fieldset, Group, NativeSelect, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { MONTHS } from '../../engine/tax';
import { useLang } from '../../i18n/context';
import type { EmployerForm } from '../../state/form';
import type { Calculator } from '../../state/useCalculator';
import { AmountInput } from '../AmountInput';
import { salaryWarnings } from '../text';

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
  );
}

function EmployerCard({ calc, employer, index }: { calc: Calculator; employer: EmployerForm; index: number }) {
  const { i18n } = useLang();
  const { t, month, digits } = i18n;
  const { actions, form } = calc;
  const many = form.employers.length > 1;
  const months = MONTHS.map((_, i) => ({ value: String(i), label: month(i) }));

  return (
    <Fieldset legend={many ? t('employer.n', { n: digits(index + 1) }) : t('employer.one')}>
      <Stack gap="sm">
        {employer.periods.map(p => (
          // Amount, then the month range; on a phone the range wraps under the amount.
          <Group key={p.id} gap="xs" wrap="wrap" align="center">
            <AmountInput
              aria-label={t('row.amountAria')}
              placeholder={t('row.amount')}
              leftSection="৳"
              value={p.monthlyAmount}
              onChange={v => actions.updatePeriod(employer.id, p.id, { monthlyAmount: v })}
              style={{ flex: '1 1 12rem', minWidth: 0 }}
            />
            <Group gap={6} wrap="nowrap" style={{ flex: '1 1 15rem', minWidth: 0 }}>
              <NativeSelect aria-label={t('row.fromAria')} data={months} value={String(p.fromMonth)}
                style={{ flex: 1, minWidth: 0 }}
                onChange={e => actions.updatePeriod(employer.id, p.id, { fromMonth: Number(e.currentTarget.value) })} />
              <Text c="dimmed" aria-hidden="true">–</Text>
              <NativeSelect aria-label={t('row.toAria')} data={months} value={String(p.toMonth)}
                style={{ flex: 1, minWidth: 0 }}
                onChange={e => actions.updatePeriod(employer.id, p.id, { toMonth: Number(e.currentTarget.value) })} />
              <ActionIcon variant="subtle" color="gray" aria-label={t('row.remove')} title={t('row.remove')}
                onClick={() => actions.removePeriod(employer.id, p.id)}>
                <CloseIcon />
              </ActionIcon>
            </Group>
          </Group>
        ))}
        <Group>
          <Button variant="light" size="xs" onClick={() => actions.addPeriod(employer.id)}>
            {t('employer.salaryChange')}
          </Button>
        </Group>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <AmountInput label={t('employer.bonus')} description={t('employer.bonusHint')} leftSection="৳"
            value={employer.bonus} onChange={v => actions.updateEmployer(employer.id, { bonus: v })} />
          <AmountInput label={t('employer.tds')} description={t('employer.tdsHint')} leftSection="৳"
            value={employer.tds} onChange={v => actions.updateEmployer(employer.id, { tds: v })} />
        </SimpleGrid>
        {many && (
          <Group>
            <Button variant="subtle" color="red" size="xs" onClick={() => actions.removeEmployer(employer.id)}>
              {t('employer.remove')}
            </Button>
          </Group>
        )}
      </Stack>
    </Fieldset>
  );
}

export function Salary({ calc }: { calc: Calculator }) {
  const { i18n } = useLang();
  const warnings = salaryWarnings(i18n, calc.form.employers);
  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        <Title order={2} size="h4">{i18n.t('salary.heading')}</Title>
        {calc.form.employers.map((e, i) => <EmployerCard key={e.id} calc={calc} employer={e} index={i} />)}
        <Button variant="default" fullWidth h="auto" py={8} styles={{ label: { whiteSpace: 'normal' } }}
          onClick={calc.actions.addEmployer}>{i18n.t('salary.addEmployer')}</Button>
        {warnings.length > 0 && (
          <Alert color="yellow" variant="light" role="status">{warnings.join(' ')}</Alert>
        )}
      </Stack>
    </Paper>
  );
}
