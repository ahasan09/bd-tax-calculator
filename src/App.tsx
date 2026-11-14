import { useState } from 'react';
import {
  ActionIcon, Affix, Anchor, Box, Container, Grid, Group, Paper, SegmentedControl, Stack, Tabs, Text, Title,
  useComputedColorScheme, useMantineColorScheme
} from '@mantine/core';
import { useIntersection } from '@mantine/hooks';
import { useLang } from './i18n/context';
import type { Lang } from './i18n';
import { useCalculator } from './state/useCalculator';
import { AboutYou } from './components/form/AboutYou';
import { Salary } from './components/form/Salary';
import { OtherIncome } from './components/form/OtherIncome';
import { Investments } from './components/form/Investments';
import { MonthlyDeduction } from './components/form/MonthlyDeduction';
import { ResultPanel } from './components/result/ResultPanel';
import { totalView } from './components/result/Breakdown';
import { ReturnSummary } from './components/ReturnSummary';
import { yearName } from './components/text';

function SchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  const { t } = useLang().i18n;
  const dark = scheme === 'dark';
  return (
    <ActionIcon variant="default" size="lg" aria-label={t(dark ? 'scheme.light' : 'scheme.dark')}
      title={t(dark ? 'scheme.light' : 'scheme.dark')} onClick={() => setColorScheme(dark ? 'light' : 'dark')}>
      {dark
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
    </ActionIcon>
  );
}

export function App() {
  const { i18n, setLang } = useLang();
  const { t } = i18n;
  const calc = useCalculator();
  const [view, setView] = useState<string | null>('calc');
  // Mobile: keep the total in view while the result pane is off screen.
  const { ref: resultRef, entry } = useIntersection({ threshold: 0.15 });
  const total = totalView(t, i18n.money, calc.result);
  const showBar = view !== 'calc' || (entry !== null && !entry.isIntersecting);

  return (
    <>
      <Container size="lg" py="lg">
        <Group justify="space-between" align="flex-start" mb="md" gap="sm" className="app-header">
          <div>
            <Title order={1} size="h2">{t('app.title')}</Title>
            <Text c="dimmed" size="sm">{t('app.subtitle')}</Text>
          </div>
          <Group gap="xs" className="no-print">
            <SegmentedControl
              aria-label={t('lang.switch')}
              value={i18n.lang}
              onChange={v => setLang(v as Lang)}
              data={[{ value: 'en', label: 'EN' }, { value: 'bn', label: 'বাংলা' }]}
            />
            <SchemeToggle />
          </Group>
        </Group>

        {/* display-none (not React Activity) so print CSS can show every tab */}
        <Tabs value={view} onChange={setView} keepMounted keepMountedMode="display-none">
          <Tabs.List mb="lg" className="no-print" aria-label={t('tab.views')}>
            <Tabs.Tab value="calc">{t('tab.calculator')}</Tabs.Tab>
            <Tabs.Tab value="return">{t('tab.return')}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="calc">
            <Grid gap="lg" align="flex-start">
              <Grid.Col span={{ base: 12, md: 7 }} className="no-print">
                <form autoComplete="off" onSubmit={e => e.preventDefault()}>
                  <Stack gap="lg">
                    <AboutYou calc={calc} />
                    <Salary calc={calc} />
                    <OtherIncome calc={calc} />
                    <Investments calc={calc} />
                    <MonthlyDeduction calc={calc} />
                  </Stack>
                </form>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }} className="result-col">
                <Box ref={resultRef} className="sticky-result">
                  <ResultPanel calc={calc} />
                </Box>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="return" className="print-page">
            <ReturnSummary result={calc.result} />
          </Tabs.Panel>
        </Tabs>

        <Text component="footer" ta="center" size="xs" c="dimmed" mt="xl" className="no-print">
          {t('footer.basis', { year: yearName(i18n, calc.result.rules), source: t('rules.source') })}{' '}
          {t('footer.note')}{' '}
          <Anchor href="https://nbr.gov.bd" target="_blank" rel="noopener" size="xs">nbr.gov.bd</Anchor>
        </Text>
      </Container>

      <span className="sr-only" aria-live="polite">{`${total.shortLabel} ${total.amount}`}</span>

      {showBar && (
        <Affix position={{ bottom: 0, left: 0, right: 0 }} hiddenFrom="md" className="no-print">
          <Paper shadow="md" px="md" py="sm" radius={0} style={{ borderTop: '2px solid var(--mantine-color-bdgreen-filled)' }}>
            <Group justify="space-between" align="baseline">
              <Text fw={700}>{total.shortLabel}</Text>
              <Text fw={800} fz="xl" className="amt" c={total.refund ? 'teal' : 'bdgreen'}>{total.amount}</Text>
            </Group>
          </Paper>
        </Affix>
      )}
    </>
  );
}
