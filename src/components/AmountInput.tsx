import { useState } from 'react';
import { TextInput, type TextInputProps } from '@mantine/core';
import { formatBDT } from '../engine/tax';
import { toLatinDigits } from '../i18n';
import { useLang } from '../i18n/context';
import type { Num } from '../state/form';

// 120000.5 → "1,20,000.5" (Indian lakh grouping, no ৳).
function groupLakh(n: number): string {
  const [int, frac] = String(n).split('.');
  return formatBDT(Number(int)).slice(1) + (frac ? '.' + frac : '');
}

interface Props extends Omit<TextInputProps, 'value' | 'onChange'> {
  value: Num;
  onChange: (value: Num) => void;
  integer?: boolean;
}

// A money field that accepts Bangla or Latin digits (and commas/spaces).
// While focused it shows exactly what was typed; on blur it shows the
// amount grouped the Bangladeshi way, in the page's digits.
export function AmountInput({ value, onChange, integer, ...rest }: Props) {
  const { i18n } = useLang();
  const [draft, setDraft] = useState<string | null>(null);   // null = not editing
  const shown = draft ?? (value === '' ? '' : i18n.digits(groupLakh(value)));
  const pattern = integer ? /^\d*$/ : /^\d*\.?\d*$/;

  return (
    <TextInput
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      placeholder={i18n.digits('0')}
      {...rest}
      value={shown}
      classNames={{ input: 'amt' }}
      onFocus={e => { setDraft(value === '' ? '' : i18n.digits(String(value))); rest.onFocus?.(e); }}
      onBlur={e => { setDraft(null); rest.onBlur?.(e); }}
      onChange={e => {
        const raw = e.currentTarget.value;
        const latin = toLatinDigits(raw);
        if (!pattern.test(latin)) return;          // ignore anything that isn't a number
        setDraft(raw);
        onChange(latin === '' || latin === '.' ? '' : Number(latin));
      }}
    />
  );
}
