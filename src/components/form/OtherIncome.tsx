import { Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useLang } from '../../i18n/context';
import type { FormState, Num } from '../../state/form';
import type { Calculator } from '../../state/useCalculator';
import { AmountInput } from '../AmountInput';

type AmountField = { [K in keyof FormState]: FormState[K] extends Num ? K : never }[keyof FormState];

export function OtherIncome({ calc }: { calc: Calculator }) {
  const { t } = useLang().i18n;
  const { form, actions } = calc;
  const field = (key: AmountField, label: string, description?: string) => (
    <AmountInput label={t(label)} description={description && t(description)} leftSection="৳"
      value={form[key]} onChange={v => actions.update({ [key]: v })} />
  );

  return (
    <Paper withBorder p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <div>
          <Title order={2} size="h4">{t('other.heading')}</Title>
          <Text size="sm" c="dimmed" mt={4}>{t('other.hint')}</Text>
        </div>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="md">
          {field('bankInterest', 'other.bankInterest')}
          {field('bankTds', 'other.bankTds')}
          {field('savingsInterest', 'other.savingsInterest')}
          {field('savingsTds', 'other.savingsTds')}
          {field('rent', 'other.rent', 'other.afterExpenses')}
          {field('agriculture', 'other.agriculture', 'other.afterExpenses')}
          {field('otherIncome', 'other.other', 'other.otherHint')}
          {field('advanceTax', 'other.advanceTax', 'other.advanceHint')}
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
