import { useState } from 'react';
import { Button, Group, Paper, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { returnSummary, type ReturnRow, type TaxResult } from '../engine/tax';
import { formBangla } from '../i18n';
import { useLang } from '../i18n/context';
import { yearName } from './text';

const TOTAL_ROWS = [11, 19, 24];

// Plain text for pasting: serial, label, amount. Amounts stay as Latin
// digits with no ৳ or commas so spreadsheets read them as numbers.
function returnText(t: (k: string, p?: Record<string, string | number>) => string, sub: string, result: TaxResult) {
  const s = returnSummary(result);
  const lines = [`${t('ret.title')} — ${sub}`, ''];
  const block = (title: string, rows: ReturnRow[]) => {
    lines.push(title);
    for (const row of rows) lines.push(`${row.serial}\t${t('ret.row.' + row.key)}\t${row.amount}`);
    lines.push('');
  };
  block(t('ret.income'), s.income);
  block(t('ret.tax'), s.tax);
  block(t('ret.payment'), s.payment);
  lines.push(t('ret.sched5'));
  for (const i of s.schedule5.items) lines.push(`\t${t('invest.' + i.key)}\t${i.amount}`);
  lines.push(`\t${t('ret.s5.total')}\t${s.schedule5.total}`, `\t${t('ret.s5.rebate')}\t${s.schedule5.rebate}`);
  return lines.join('\n');
}

export function ReturnSummary({ result }: { result: TaxResult }) {
  const { i18n } = useLang();
  const { t, money, digits, lang } = i18n;
  const [status, setStatus] = useState<string | null>(null);   // text key
  const s = returnSummary(result);
  const sub = t('ret.sub', { year: yearName(i18n, result.rules), source: t('rules.source') });

  // English shows the form's Bangla wording underneath, so rows are easy to
  // match against the printed form; in Bangla the label already is that wording.
  const serialTable = (rows: ReturnRow[]) => (
    <Table verticalSpacing={6} horizontalSpacing={4}>
      <Table.Tbody>
        {rows.map(row => {
          const key = 'ret.row.' + row.key;
          const bold = TOTAL_ROWS.includes(row.serial) ? 700 : 400;
          return (
            <Table.Tr key={row.serial}>
              <Table.Td w={28} c="dimmed" className="amt" style={{ verticalAlign: 'top' }}>{digits(row.serial)}</Table.Td>
              <Table.Td fw={bold}>
                {t(key)}
                {lang === 'en' && <Text size="xs" c="dimmed" lang="bn">{formBangla(key)}</Text>}
              </Table.Td>
              <Table.Td fw={bold} ta="right" className="amt" style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>{money(row.amount)}</Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
  const plainTable = (rows: [string, number, boolean?][]) => (
    <Table verticalSpacing={6} horizontalSpacing={4}>
      <Table.Tbody>
        {rows.map(([label, amount, total], i) => (
          <Table.Tr key={i} fw={total ? 700 : 400}>
            <Table.Td>{label}</Table.Td>
            <Table.Td ta="right" className="amt" style={{ whiteSpace: 'nowrap' }}>{money(amount)}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
  const section = (title: string) => <Text tt={lang === 'en' ? 'uppercase' : undefined} fz="xs" fw={700} c="dimmed" mb={4}>{title}</Text>;

  const copy = () => {
    const text = returnText(t, sub, result);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => setStatus('ret.copied'), () => setStatus('ret.copyBlocked'));
    } else setStatus('ret.copyUnavailable');
  };

  return (
    <Paper withBorder p="lg" className="return-panel">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="sm">
          <div style={{ flex: '1 1 20rem' }}>
            <Title order={2} size="h3">{t('ret.title')}</Title>
            <Text size="sm" c="dimmed">{sub}</Text>
          </div>
          <Group gap="xs" className="no-print">
            <Button onClick={() => window.print()}>{t('ret.print')}</Button>
            <Button variant="default" onClick={copy}>{t('ret.copy')}</Button>
          </Group>
        </Group>
        <Text size="sm" c="teal" role="status" className="no-print" mih={20}>{status ? t(status) : ''}</Text>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xl" verticalSpacing="lg" className="return-grid">
          <div>{section(t('ret.income'))}{serialTable(s.income)}</div>
          <div>{section(t('ret.tax'))}{serialTable(s.tax)}</div>
          <div>{section(t('ret.payment'))}{serialTable(s.payment)}</div>
          <div>
            {section(t('ret.sched1'))}
            {plainTable([[t('ret.s1.gross'), s.schedule1.gross],
              [t('ret.s1.exempt', { cap: money(result.rules.salaryExemption.cap) }), s.schedule1.exempt],
              [t('ret.s1.taxable'), s.schedule1.taxable, true]])}
          </div>
          <div>
            {section(t('ret.sched5'))}
            {plainTable([...s.schedule5.items.map(i => [t('invest.' + i.key), i.amount] as [string, number]),
              [t('ret.s5.total'), s.schedule5.total, true], [t('ret.s5.rebate'), s.schedule5.rebate, true]])}
          </div>
        </SimpleGrid>
        <Text size="xs" c="dimmed">{t('ret.notCovered')} {t('ret.estimate')}</Text>
      </Stack>
    </Paper>
  );
}
