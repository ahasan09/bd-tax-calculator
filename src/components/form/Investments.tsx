import { useState } from 'react';
import { Button, Collapse, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { INVESTMENT_ITEMS } from '../../engine/tax';
import { useLang } from '../../i18n/context';
import type { Calculator } from '../../state/useCalculator';
import { AmountInput } from '../AmountInput';
import { investmentHint, rebateCandidatesText } from '../text';

// The first four are the common ones; the rest sit behind "More types".
const COMMON_ITEMS = 4;

export function Investments({ calc }: { calc: Calculator }) {
  const { i18n } = useLang();
  const { t, money } = i18n;
  const { form, result, actions } = calc;
  const extraHasValue = INVESTMENT_ITEMS.slice(COMMON_ITEMS).some(i => Number(form.investments[i.key]) > 0);
  const [showMore, setShowMore] = useState(extraHasValue);

  const field = (item: typeof INVESTMENT_ITEMS[number]) => {
    const r = result.investmentItems.find(i => i.key === item.key);
    return (
      <AmountInput
        key={item.key}
        label={t('invest.' + item.key)}
        description={'cap' in item ? t('invest.capHint', { cap: money(item.cap) }) : undefined}
        leftSection="৳"
        value={form.investments[item.key]}
        onChange={v => actions.update({ investments: { ...form.investments, [item.key]: v } })}
        error={r?.capped ? t('invest.capWarn', { amount: money(r.allowed) }) : undefined}
      />
    );
  };

  const hint = investmentHint(i18n, result);
  return (
    <Paper withBorder p={{ base: 'md', sm: 'lg' }}>
      <Stack gap="md">
        <Title order={2} size="h4">{t('invest.heading')}</Title>
        <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="md">
          {INVESTMENT_ITEMS.slice(0, COMMON_ITEMS).map(field)}
        </SimpleGrid>
        <div>
          <Button variant="subtle" size="sm" px={0} onClick={() => setShowMore(s => !s)}
            aria-expanded={showMore}>
            {showMore ? t('invest.less') : t('invest.more')}
          </Button>
          <Collapse expanded={showMore}>
            <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="md" verticalSpacing="md" mt="sm">
              {INVESTMENT_ITEMS.slice(COMMON_ITEMS).map(field)}
            </SimpleGrid>
          </Collapse>
        </div>
        <Paper bg="var(--mantine-color-default-hover)" p="sm" radius="sm">
          {result.investmentEntered > 0 && (
            <Text fw={600} size="sm">
              {t('invest.total', { amount: money(result.investment) })}
              {result.investment < result.investmentEntered && t('invest.totalOf', { entered: money(result.investmentEntered) })}
            </Text>
          )}
          <Text size="xs" c="dimmed">{t('invest.formula', { list: rebateCandidatesText(i18n, result), amount: money(result.rebate) })}</Text>
          {hint && <Text size="sm" c="bdgreen" mt={4}>{hint}</Text>}
        </Paper>
      </Stack>
    </Paper>
  );
}
