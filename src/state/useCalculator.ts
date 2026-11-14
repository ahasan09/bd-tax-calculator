import { useMemo, useState } from 'react';
import { calculateTax } from '../engine/tax';
import { decode, encode } from '../engine/state';
import {
  emptyForm, fromShared, newEmployer, newPeriod, nextEmployerStart, toTaxInputs,
  type EmployerForm, type FormState, type PeriodForm
} from './form';

// Start from a share link (#s=…) when one is present and readable.
function initialState(): { form: FormState; badLink: boolean } {
  const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
  if (!m) return { form: emptyForm(), badLink: false };
  const shared = decode(m[1]);
  return shared ? { form: fromShared(shared), badLink: false } : { form: emptyForm(), badLink: true };
}

export function useCalculator() {
  const [init] = useState(initialState);
  const [form, setForm] = useState<FormState>(init.form);
  const inputs = useMemo(() => toTaxInputs(form), [form]);
  const result = useMemo(() => calculateTax(inputs), [inputs]);

  const update = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));
  const mapEmployer = (id: string, fn: (e: EmployerForm) => EmployerForm) =>
    setForm(f => ({ ...f, employers: f.employers.map(e => e.id === id ? fn(e) : e) }));
  const mapPeriods = (empId: string, fn: (p: PeriodForm[]) => PeriodForm[]) =>
    mapEmployer(empId, e => ({ ...e, periods: fn(e.periods) }));

  const actions = {
    update,
    updateEmployer: (id: string, patch: Partial<EmployerForm>) => mapEmployer(id, e => ({ ...e, ...patch })),
    addEmployer: () => setForm(f => ({ ...f, employers: [...f.employers, newEmployer(nextEmployerStart(f.employers))] })),
    removeEmployer: (id: string) => setForm(f => f.employers.length > 1
      ? { ...f, employers: f.employers.filter(e => e.id !== id) } : f),
    addPeriod: (empId: string) => mapPeriods(empId, ps => [...ps, newPeriod()]),
    updatePeriod: (empId: string, id: string, patch: Partial<PeriodForm>) =>
      mapPeriods(empId, ps => ps.map(p => p.id === id ? { ...p, ...patch } : p)),
    // The last row is cleared rather than removed.
    removePeriod: (empId: string, id: string) => mapPeriods(empId, ps => ps.length > 1
      ? ps.filter(p => p.id !== id) : ps.map(p => ({ ...p, monthlyAmount: '' })))
  };

  // The share link carries nextMonth only when the user picked it.
  const shareUrl = () => location.href.split('#')[0] + '#s=' +
    encode(inputs, { keepNextMonth: form.nextMonth !== null });

  return { form, inputs, result, actions, shareUrl, badLink: init.badLink };
}
export type Calculator = ReturnType<typeof useCalculator>;
