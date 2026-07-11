const _results = [];
function test(name, fn) {
  try { fn(); _results.push({ name, ok: true }); }
  catch (e) { _results.push({ name, ok: false, err: e.message }); }
}
function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label || 'value'}: expected ${b}, got ${a}`);
}

// ---- Task 1: formatBDT ----
test('formatBDT: zero', () => assertEqual(BDTax.formatBDT(0), '৳0'));
test('formatBDT: 3 digits untouched', () => assertEqual(BDTax.formatBDT(500), '৳500'));
test('formatBDT: thousands', () => assertEqual(BDTax.formatBDT(5000), '৳5,000'));
test('formatBDT: lakh grouping', () => assertEqual(BDTax.formatBDT(123456), '৳1,23,456'));
test('formatBDT: crore grouping', () => assertEqual(BDTax.formatBDT(12345678), '৳1,23,45,678'));
test('formatBDT: negative', () => assertEqual(BDTax.formatBDT(-5000), '-৳5,000'));
test('formatBDT: rounds decimals', () => assertEqual(BDTax.formatBDT(1234.6), '৳1,235'));

// ---- Task 1: RULES sanity ----
test('RULES: general threshold both years', () => {
  assertEqual(BDTax.RULES['2025-26'].thresholds.general, 375000);
  assertEqual(BDTax.RULES['2026-27'].thresholds.general, 375000);
});
test('RULES: same rebate rule both years (10% / 750k)', () => {
  assertEqual(BDTax.RULES['2025-26'].rebate, { incomeRate: 0.03, investmentRate: 0.10, cap: 750000 });
  assertEqual(BDTax.RULES['2026-27'].rebate, { incomeRate: 0.03, investmentRate: 0.10, cap: 750000 });
});
test('RULES: all 7 categories present', () => {
  const t = BDTax.RULES['2025-26'].thresholds;
  assertEqual([t.general, t.woman, t.senior, t.thirdGender, t.disabled, t.freedomFighter, t.julyWarrior],
    [375000, 425000, 425000, 500000, 500000, 525000, 525000]);
});

// (later tasks append their tests below this line)

// ---- Task 2: income pipeline ----
const Y = '2025-26';
const base = { taxYear: Y, category: 'general', isFirstTimeTaxpayer: false,
  disabledDependents: 0, salaryPeriods: [], bonus: 0, otherIncome: 0, investment: 0, tds: 0 };

test('income: full-year single salary row', () => {
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 30000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.grossSalary, 360000, 'grossSalary');
  assertEqual(r.exemption, 120000, 'exemption');
  assertEqual(r.taxableIncome, 240000, 'taxableIncome');
});

test('income: split rows equal one full-year row', () => {
  const single = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 60000, fromMonth: 0, toMonth: 11 }] });
  const split = BDTax.calculateTax({ ...base, salaryPeriods: [
    { monthlyAmount: 60000, fromMonth: 0, toMonth: 5 },
    { monthlyAmount: 60000, fromMonth: 6, toMonth: 11 }] });
  assertEqual(split.taxableIncome, single.taxableIncome, 'taxableIncome equal');
});

test('income: mid-year raise + bonus (spec mockup case)', () => {
  const r = BDTax.calculateTax({ ...base, bonus: 60000, salaryPeriods: [
    { monthlyAmount: 50000, fromMonth: 0, toMonth: 5 },
    { monthlyAmount: 70000, fromMonth: 6, toMonth: 11 }] });
  assertEqual(r.salaryFromPeriods, 720000, 'salaryFromPeriods');
  assertEqual(r.grossSalary, 780000, 'grossSalary incl bonus');
  assertEqual(r.exemption, 260000, 'exemption');
  assertEqual(r.taxableIncome, 520000, 'taxableIncome');
});

test('income: exemption capped at 500,000', () => {
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.exemption, 500000, 'cap binds (1/3 would be 600,000)');
  assertEqual(r.taxableIncome, 1300000, 'taxableIncome');
});

test('income: invalid period (from > to) excluded', () => {
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 50000, fromMonth: 5, toMonth: 2 }] });
  assertEqual(r.grossSalary, 0, 'invalid row contributes nothing');
});

test('income: other income added after exemption, empty/negative clamped', () => {
  const r = BDTax.calculateTax({ ...base, otherIncome: 100000, bonus: -50, tds: NaN });
  assertEqual(r.grossSalary, 0);
  assertEqual(r.taxableIncome, 100000, 'otherIncome not salary-exempted');
});

test('income: fractional inputs round to whole taka', () => {
  const r = BDTax.calculateTax({ ...base, otherIncome: 100000.4, bonus: 999.6 });
  assertEqual(r.bonus, 1000, 'bonus rounded');
  assertEqual(r.otherIncome, 100000, 'otherIncome rounded');
  assertEqual(Number.isInteger(r.taxableIncome), true, 'taxable is integer');
});

// ---- Task 3: threshold + slabs ----
test('slabs: at threshold, zero tax', () => {
  const r = BDTax.calculateTax({ ...base, otherIncome: 375000 });
  assertEqual(r.grossTax, 0);
  assertEqual(r.slabs.length, 1, 'only nil band');
});

test('slabs: just above threshold', () => {
  // salary 48,000×12 = 576,000; exemption 192,000; taxable 384,000
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 48000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.taxableIncome, 384000);
  assertEqual(r.grossTax, 900, '9,000 @ 10%');
});

test('slabs: three bands engaged', () => {
  // taxable 1,300,000 → 300k@10% + 400k@15% + 225k@20% = 135,000
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.grossTax, 135000);
  assertEqual(r.slabs.length, 4, 'nil + 3 taxed bands');
  assertEqual(r.slabs[3], { amount: 225000, rate: 0.20, tax: 45000 }, 'partial 20% band');
});

test('slabs: top 30% band', () => {
  // taxable 40,000,000 → 30k+60k+100k+500k + 36,425,000@30% = 11,617,500
  const r = BDTax.calculateTax({ ...base, otherIncome: 40000000 });
  assertEqual(r.grossTax, 11617500);
});

test('threshold: woman category', () => {
  const r = BDTax.calculateTax({ ...base, category: 'woman', otherIncome: 425000 });
  assertEqual(r.threshold, 425000);
  assertEqual(r.grossTax, 0);
});

test('threshold: third gender / disabled category (500,000)', () => {
  const at = BDTax.calculateTax({ ...base, category: 'thirdGender', otherIncome: 500000 });
  assertEqual(at.finalTax, 0, 'at threshold');
  const above = BDTax.calculateTax({ ...base, category: 'disabled', otherIncome: 510000 });
  assertEqual(above.grossTax, 1000, '10,000 @ 10%');
  assertEqual(above.finalTax, 5000, 'floored to minimum tax');
});

test('threshold: freedom fighter / July Warrior category (525,000)', () => {
  const at = BDTax.calculateTax({ ...base, category: 'freedomFighter', otherIncome: 525000 });
  assertEqual(at.finalTax, 0, 'at threshold');
  const above = BDTax.calculateTax({ ...base, category: 'julyWarrior', otherIncome: 600000 });
  assertEqual(above.grossTax, 7500, '75,000 @ 10%');
  assertEqual(above.finalTax, 7500, 'above the minimum-tax floor');
});

test('threshold: below threshold is zero for every category', () => {
  for (const [cat, limit] of [['woman', 425000], ['thirdGender', 500000], ['freedomFighter', 525000]]) {
    const result = BDTax.calculateTax({ ...base, category: cat, otherIncome: limit - 50000 });
    assertEqual(result.finalTax, 0, cat + ' below threshold');
  }
});

test('threshold: just above floors to minimum (woman, July Warrior)', () => {
  const w = BDTax.calculateTax({ ...base, category: 'woman', otherIncome: 430000 });
  assertEqual(w.grossTax, 500, '5,000 @ 10%');
  assertEqual(w.finalTax, 5000, 'floored');
  const j = BDTax.calculateTax({ ...base, category: 'julyWarrior', otherIncome: 530000 });
  assertEqual(j.grossTax, 500, '5,000 @ 10%');
  assertEqual(j.finalTax, 5000, 'floored');
});

test('rebate: 3%-of-income limb binds', () => {
  // taxable 1,300,000 → byIncome 39,000; investment 500,000 → byInvestment 50,000
  const result = BDTax.calculateTax({ ...base, investment: 500000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(result.rebate, 39000, '3% of income is the lowest candidate');
  assertEqual(result.finalTax, 96000);
});

test('threshold: disabled dependent bonus', () => {
  const r = BDTax.calculateTax({ ...base, disabledDependents: 1, otherIncome: 400000 });
  assertEqual(r.threshold, 425000, '375,000 + 50,000');
  assertEqual(r.grossTax, 0);
});

// ---- Task 4: rebate, minimum tax, payable ----
test('final: below threshold pays nothing, no minimum', () => {
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 30000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.finalTax, 0);
  assertEqual(r.minimumTax, 0);
  assertEqual(r.netPayable, 0);
});

test('final: minimum tax floor at 5,000', () => {
  // taxable 384,000 → grossTax 900 → floored
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 48000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.finalTax, 5000);
  assertEqual(r.minimumApplied, true);
});

test('final: first-time taxpayer minimum is 1,000', () => {
  const r = BDTax.calculateTax({ ...base, isFirstTimeTaxpayer: true,
    salaryPeriods: [{ monthlyAmount: 48000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.finalTax, 1000);
});

test('final: spec mockup — rebate then floor', () => {
  // taxable 520,000, grossTax 14,500; rebate candidates 15,600 / 12,000 / 750k
  // → 12,000; after rebate 2,500 → floor 5,000
  const r = BDTax.calculateTax({ ...base, bonus: 60000, investment: 120000, salaryPeriods: [
    { monthlyAmount: 50000, fromMonth: 0, toMonth: 5 },
    { monthlyAmount: 70000, fromMonth: 6, toMonth: 11 }] });
  assertEqual(r.rebate, 12000);
  assertEqual(r.finalTax, 5000);
  assertEqual(r.minimumApplied, true);
});

test('final: rebate rule identical across years (10%)', () => {
  // taxable 1,300,000, grossTax 135,000, investment 200,000
  const inputs = { ...base, investment: 200000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] };
  const r25 = BDTax.calculateTax(inputs);
  const r26 = BDTax.calculateTax({ ...inputs, taxYear: '2026-27' });
  assertEqual(r25.rebate, 20000, '10% of 200,000 binds');
  assertEqual(r25.finalTax, 115000);
  assertEqual(r26.rebate, 20000, 'same in 2026-27');
  assertEqual(r26.finalTax, 115000);
});

test('final: absolute rebate cap (7.5 lakh, both years)', () => {
  const inputs = { ...base, otherIncome: 40000000, investment: 10000000 };
  const r25 = BDTax.calculateTax(inputs);
  const r26 = BDTax.calculateTax({ ...inputs, taxYear: '2026-27' });
  assertEqual(r25.rebate, 750000);
  assertEqual(r25.finalTax, 10867500);
  assertEqual(r26.rebate, 750000);
  assertEqual(r26.finalTax, 10867500);
});

test('final: TDS refund', () => {
  const r = BDTax.calculateTax({ ...base, investment: 200000, tds: 120000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.finalTax, 115000);
  assertEqual(r.netPayable, 0);
  assertEqual(r.refundable, 5000);
});

test('final: investment tip suggests useful extra investment', () => {
  // rebate 20,000 vs 3%-cap 39,000 → 19,000 headroom → 190,000 more at 10%
  const r = BDTax.calculateTax({ ...base, investment: 200000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.investmentAdvice.tip, { extraInvestment: 190000, saving: 19000 });
});

test('final: no tip when floor makes investing useless', () => {
  // grossTax 900 → even full rebate leaves 5,000 floor
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 48000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.investmentAdvice.tip, null);
});

test('final: always exposes max useful rebate and target investment', () => {
  // maxUseful = min(3%×1,300,000 = 39,000; 750,000; grossTax 135,000) = 39,000
  // target = 39,000 / 10% = 390,000 — regardless of what is currently invested
  const r = BDTax.calculateTax({ ...base, investment: 200000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.investmentAdvice.maxUsefulRebate, 39000);
  assertEqual(r.investmentAdvice.targetInvestment, 390000);
});

test('final: target investment zero when there is no tax to rebate', () => {
  const r = BDTax.calculateTax({ ...base });
  assertEqual(r.investmentAdvice.maxUsefulRebate, 0);
  assertEqual(r.investmentAdvice.targetInvestment, 0);
});

test('final: monthly office deduction and tax after max investment', () => {
  // finalTax 115,000 → ≈9,583/month; with full 390,000 invested the rebate
  // becomes 39,000 → tax 96,000 → 8,000/month
  const r = BDTax.calculateTax({ ...base, investment: 200000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.monthlyTds, 9583);
  assertEqual(r.investmentAdvice.taxIfMaxInvested, 96000);
  assertEqual(r.investmentAdvice.monthlyTdsIfMaxInvested, 8000);
});

test('final: minimum-tax floor holds after max investment', () => {
  // grossTax 900 → even the full rebate leaves the 5,000 floor → 417/month
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 48000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.investmentAdvice.taxIfMaxInvested, 5000);
  assertEqual(r.monthlyTds, 417);
  assertEqual(r.investmentAdvice.monthlyTdsIfMaxInvested, 417);
});

test('final: monthly figures zero at zero income', () => {
  const r = BDTax.calculateTax({ ...base });
  assertEqual([r.monthlyTds, r.investmentAdvice.taxIfMaxInvested, r.investmentAdvice.monthlyTdsIfMaxInvested], [0, 0, 0]);
});

test('final: all-zero input is all zeros, no NaN', () => {
  const r = BDTax.calculateTax({ ...base });
  assertEqual([r.grossSalary, r.taxableIncome, r.grossTax, r.rebate, r.finalTax,
    r.netPayable, r.refundable], [0, 0, 0, 0, 0, 0, 0]);
});

if (typeof document !== 'undefined') {
  // ---- render ----
  const ul = document.getElementById('results');
  let passed = 0;
  for (const r of _results) {
    const li = document.createElement('li');
    li.className = r.ok ? 'pass' : 'fail';
    li.textContent = (r.ok ? '✓ ' : '✗ ') + r.name + (r.ok ? '' : ' — ' + r.err);
    ul.appendChild(li);
    if (r.ok) passed++;
  }
  document.getElementById('summary').textContent =
    `${passed}/${_results.length} passing` + (passed === _results.length ? ' — ALL GREEN' : ' — FAILURES');
  document.title = (passed === _results.length ? '✓ ' : '✗ ') + document.title;
}

if (typeof window === 'undefined') {
  globalThis.__results = _results;
}
