import { Checkbox, NativeSelect, Paper, SimpleGrid, Stack, Title } from '@mantine/core';
import { CATEGORIES, RULES, YEARS, yearStatus, type Category } from '../../engine/tax';
import { useLang } from '../../i18n/context';
import type { Calculator } from '../../state/useCalculator';
import { AmountInput } from '../AmountInput';

export function AboutYou({ calc }: { calc: Calculator }) {
  const { i18n } = useLang();
  const { t, digits, money } = i18n;
  const { form, actions } = calc;
  const rules = RULES[form.taxYear];

  const years = YEARS.map(y => ({
    value: y,
    label: t('year.option', { iy: digits(RULES[y].incomeYear), tag: t('year.tag.' + yearStatus(y)) })
  }));

  return (
    <Paper withBorder p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Title order={2} size="h4">{t('section.about')}</Title>
        <NativeSelect
          label={t('year.label')}
          // The assessment year lives here, keeping the dropdown short enough for small phones.
          description={`${t('year.ay', { ay: digits(rules.assessmentYear) })} · ${t('year.hint.' + yearStatus(form.taxYear))}`}
          data={years}
          value={form.taxYear}
          onChange={e => actions.update({ taxYear: e.currentTarget.value })}
          inputWrapperOrder={['label', 'input', 'description']}
        />
        <NativeSelect
          label={t('cat.label')}
          data={CATEGORIES.map(c => ({ value: c, label: t('cat.' + c) }))}
          value={form.category}
          onChange={e => actions.update({ category: e.currentTarget.value as Category })}
        />
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md">
          <Checkbox
            label={t('firstTime.label')}
            description={t('firstTime.hint', { low: money(rules.minimumTax.firstTime), high: money(rules.minimumTax.regular) })}
            checked={form.isFirstTimeTaxpayer}
            onChange={e => actions.update({ isFirstTimeTaxpayer: e.currentTarget.checked })}
          />
          <AmountInput
            integer
            label={t('dependents.label')}
            description={t('dependents.hint', { amount: money(rules.dependentBonus) })}
            value={form.disabledDependents}
            onChange={v => actions.update({ disabledDependents: v === '' ? '' : Math.min(v, 20) })}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}
