import { useEffect, useRef, useState } from 'react';
import { Button, Paper, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { useLang } from '../../i18n/context';
import type { Calculator } from '../../state/useCalculator';
import { Breakdown } from './Breakdown';
import { MonthlyPlan } from './MonthlyPlan';

function ShareLink({ calc }: { calc: Calculator }) {
  const { t } = useLang().i18n;
  const clipboard = useClipboard({ timeout: 4000 });
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  // A text key, so the message follows a language switch.
  const [status, setStatus] = useState<string | null>(calc.badLink ? 'share.bad' : null);

  // Any change to the form makes an earlier link or message stale.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setStatus(null);
    setFallbackUrl(null);
  }, [calc.inputs]);

  const copy = () => {
    const url = calc.shareUrl();
    // Clipboard needs a secure context; otherwise show the link to copy by hand.
    if (navigator.clipboard && window.isSecureContext) {
      clipboard.copy(url);
      setFallbackUrl(null);
      setStatus('share.copied');
    } else {
      setFallbackUrl(url);
      setStatus('share.copyBelow');
    }
  };

  return (
    <Stack gap={6} className="no-print">
      <Button onClick={copy} w="fit-content">{t('share.button')}</Button>
      <Text size="xs" c="dimmed">{t('share.note')}</Text>
      <Text size="sm" c={status === 'share.bad' ? 'orange' : 'teal'} role="status" mih={20}>{status ? t(status) : ''}</Text>
      {fallbackUrl && (
        <TextInput readOnly value={fallbackUrl} aria-label={t('share.urlAria')} size="xs"
          onFocus={e => e.currentTarget.select()} autoFocus />
      )}
    </Stack>
  );
}

export function ResultPanel({ calc }: { calc: Calculator }) {
  const { t } = useLang().i18n;
  const [tab, setTab] = useState<string | null>('breakdown');
  return (
    <Paper withBorder p={{ base: 'md', sm: 'lg' }} className="result-panel" style={{ borderTop: '4px solid var(--mantine-color-bdgreen-filled)' }}>
      <Stack gap="lg">
        <Tabs value={tab} onChange={setTab} keepMountedMode="display-none">
          <Tabs.List mb="md" className="no-print" aria-label={t('tab.result')}>
            <Tabs.Tab value="breakdown">{t('tab.breakdown')}</Tabs.Tab>
            <Tabs.Tab value="plan">{t('tab.plan')}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="breakdown">
            <Breakdown result={calc.result} onShowPlan={() => setTab('plan')} />
          </Tabs.Panel>
          <Tabs.Panel value="plan" className="print-gap">
            <MonthlyPlan result={calc.result} />
          </Tabs.Panel>
        </Tabs>
        <ShareLink calc={calc} />
      </Stack>
    </Paper>
  );
}
