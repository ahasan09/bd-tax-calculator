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
const cats = t => [t.general, t.woman, t.senior, t.thirdGender, t.disabled, t.freedomFighter, t.julyWarrior];
test('RULES: five income years, filing year through AY 2030-31', () => {
  assertEqual(BDTax.YEARS, ['2025-26', '2026-27', '2027-28', '2028-29', '2029-30']);
  assertEqual(BDTax.YEARS.map(y => BDTax.RULES[y].assessmentYear),
    ['2026-27', '2027-28', '2028-29', '2029-30', '2030-31']);
});
test('RULES: thresholds for AY 2026-27 and 2027-28 (Finance Act 2026)', () => {
  for (const y of ['2025-26', '2026-27'])
    assertEqual(cats(BDTax.RULES[y].thresholds), [400000, 450000, 450000, 525000, 525000, 550000, 550000], y);
});
test('RULES: thresholds for AY 2028-29 and 2029-30', () => {
  for (const y of ['2027-28', '2028-29'])
    assertEqual(cats(BDTax.RULES[y].thresholds), [450000, 500000, 500000, 575000, 575000, 600000, 600000], y);
});
test('RULES: thresholds for AY 2030-31', () => {
  assertEqual(cats(BDTax.RULES['2029-30'].thresholds), [500000, 550000, 550000, 625000, 625000, 650000, 650000]);
});
test('RULES: same rebate rule every year (3% / 10% / 750k, §78 from AY 2026-27)', () => {
  for (const y of BDTax.YEARS)
    assertEqual(BDTax.RULES[y].rebate, { incomeRate: 0.03, investmentRate: 0.10, cap: 750000 }, y);
});
test('RULES: 35% band only from AY 2028-29', () => {
  const top = y => BDTax.RULES[y].slabs.map(s => s.rate).pop();
  assertEqual(BDTax.YEARS.map(top), [0.30, 0.30, 0.35, 0.35, 0.35]);
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
  const r = BDTax.calculateTax({ ...base, otherIncome: 400000 });
  assertEqual(r.grossTax, 0);
  assertEqual(r.slabs.length, 1, 'only nil band');
});

test('slabs: just above threshold', () => {
  // salary 51,125×12 = 613,500; exemption 204,500; taxable 409,000
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 51125, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.taxableIncome, 409000);
  assertEqual(r.grossTax, 900, '9,000 @ 10%');
});

test('slabs: three bands engaged', () => {
  // taxable 1,300,000 → 300k@10% + 400k@15% + 200k@20% = 130,000
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.grossTax, 130000);
  assertEqual(r.slabs.length, 4, 'nil + 3 taxed bands');
  assertEqual(r.slabs[3], { amount: 200000, rate: 0.20, tax: 40000 }, 'partial 20% band');
});

test('slabs: top 30% band', () => {
  // taxable 40,000,000 → 30k+60k+100k+500k + 36,400,000@30% = 11,610,000
  const r = BDTax.calculateTax({ ...base, otherIncome: 40000000 });
  assertEqual(r.grossTax, 11610000);
});

test('threshold: woman category', () => {
  const r = BDTax.calculateTax({ ...base, category: 'woman', otherIncome: 450000 });
  assertEqual(r.threshold, 450000);
  assertEqual(r.grossTax, 0);
});

test('threshold: third gender / disabled category (525,000)', () => {
  const at = BDTax.calculateTax({ ...base, category: 'thirdGender', otherIncome: 525000 });
  assertEqual(at.finalTax, 0, 'at threshold');
  const above = BDTax.calculateTax({ ...base, category: 'disabled', otherIncome: 535000 });
  assertEqual(above.grossTax, 1000, '10,000 @ 10%');
  assertEqual(above.finalTax, 5000, 'floored to minimum tax');
});

test('threshold: freedom fighter / July Warrior category (550,000)', () => {
  const at = BDTax.calculateTax({ ...base, category: 'freedomFighter', otherIncome: 550000 });
  assertEqual(at.finalTax, 0, 'at threshold');
  const above = BDTax.calculateTax({ ...base, category: 'julyWarrior', otherIncome: 625000 });
  assertEqual(above.grossTax, 7500, '75,000 @ 10%');
  assertEqual(above.finalTax, 7500, 'above the minimum-tax floor');
});

test('threshold: below threshold is zero for every category', () => {
  for (const [cat, limit] of [['woman', 450000], ['thirdGender', 525000], ['freedomFighter', 550000]]) {
    const result = BDTax.calculateTax({ ...base, category: cat, otherIncome: limit - 50000 });
    assertEqual(result.finalTax, 0, cat + ' below threshold');
  }
});

test('threshold: just above floors to minimum (woman, July Warrior)', () => {
  const w = BDTax.calculateTax({ ...base, category: 'woman', otherIncome: 455000 });
  assertEqual(w.grossTax, 500, '5,000 @ 10%');
  assertEqual(w.finalTax, 5000, 'floored');
  const j = BDTax.calculateTax({ ...base, category: 'julyWarrior', otherIncome: 555000 });
  assertEqual(j.grossTax, 500, '5,000 @ 10%');
  assertEqual(j.finalTax, 5000, 'floored');
});

test('rebate: 3%-of-income limb binds', () => {
  // taxable 1,300,000 → byIncome 39,000; investment 500,000 → byInvestment 50,000
  const result = BDTax.calculateTax({ ...base, investment: 500000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(result.rebate, 39000, '3% of income is the lowest candidate');
  assertEqual(result.finalTax, 91000);
});

test('threshold: disabled dependent bonus', () => {
  const r = BDTax.calculateTax({ ...base, disabledDependents: 1, otherIncome: 425000 });
  assertEqual(r.threshold, 450000, '400,000 + 50,000');
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
  // taxable 409,000 → grossTax 900 → floored
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 51125, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.finalTax, 5000);
  assertEqual(r.minimumApplied, true);
});

test('final: first-time taxpayer minimum is 1,000', () => {
  const r = BDTax.calculateTax({ ...base, isFirstTimeTaxpayer: true,
    salaryPeriods: [{ monthlyAmount: 51125, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.finalTax, 1000);
});

test('final: spec mockup — rebate then floor', () => {
  // taxable 520,000, grossTax 12,000; rebate candidates 15,600 / 12,000 / 750k
  // → 12,000; after rebate 0 → floor 5,000
  const r = BDTax.calculateTax({ ...base, bonus: 60000, investment: 120000, salaryPeriods: [
    { monthlyAmount: 50000, fromMonth: 0, toMonth: 5 },
    { monthlyAmount: 70000, fromMonth: 6, toMonth: 11 }] });
  assertEqual(r.rebate, 12000);
  assertEqual(r.finalTax, 5000);
  assertEqual(r.minimumApplied, true);
});

test('final: rebate rule identical across years (10%)', () => {
  // taxable 1,300,000, grossTax 130,000, investment 200,000
  const inputs = { ...base, investment: 200000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] };
  const r25 = BDTax.calculateTax(inputs);
  const r26 = BDTax.calculateTax({ ...inputs, taxYear: '2026-27' });
  assertEqual(r25.rebate, 20000, '10% of 200,000 binds');
  assertEqual(r25.finalTax, 110000);
  assertEqual(r26.rebate, 20000, 'same in 2026-27');
  assertEqual(r26.finalTax, 110000);
});

test('final: absolute rebate cap (7.5 lakh, both years)', () => {
  const inputs = { ...base, otherIncome: 40000000, investment: 10000000 };
  const r25 = BDTax.calculateTax(inputs);
  const r26 = BDTax.calculateTax({ ...inputs, taxYear: '2026-27' });
  assertEqual(r25.rebate, 750000);
  assertEqual(r25.finalTax, 10860000);
  assertEqual(r26.rebate, 750000);
  assertEqual(r26.finalTax, 10860000);
});

test('final: TDS refund', () => {
  const r = BDTax.calculateTax({ ...base, investment: 200000, tds: 120000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.finalTax, 110000);
  assertEqual(r.netPayable, 0);
  assertEqual(r.refundable, 10000);
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
    salaryPeriods: [{ monthlyAmount: 51125, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.investmentAdvice.tip, null);
});

test('final: always exposes max useful rebate and target investment', () => {
  // maxUseful = min(3%×1,300,000 = 39,000; 750,000; grossTax 130,000) = 39,000
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
  // finalTax 110,000 → ≈9,167/month; with full 390,000 invested the rebate
  // becomes 39,000 → tax 91,000 → 7,583.3 → 7,584/month (rounded up)
  const r = BDTax.calculateTax({ ...base, investment: 200000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.plan.perMonth, 9167);
  assertEqual(r.investmentAdvice.taxIfMaxInvested, 91000);
  assertEqual(r.investmentAdvice.monthlyTdsIfMaxInvested, 7584);
});

test('final: minimum-tax floor holds after max investment', () => {
  // grossTax 900 → even the full rebate leaves the 5,000 floor → 417/month
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 51125, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.investmentAdvice.taxIfMaxInvested, 5000);
  assertEqual(r.plan.perMonth, 417);
  assertEqual(r.investmentAdvice.monthlyTdsIfMaxInvested, 417);
});

test('final: monthly figures zero at zero income', () => {
  const r = BDTax.calculateTax({ ...base });
  assertEqual([r.plan.perMonth, r.investmentAdvice.taxIfMaxInvested, r.investmentAdvice.monthlyTdsIfMaxInvested], [0, 0, 0]);
});

test('final: all-zero input is all zeros, no NaN', () => {
  const r = BDTax.calculateTax({ ...base });
  assertEqual([r.grossSalary, r.taxableIncome, r.grossTax, r.rebate, r.finalTax,
    r.netPayable, r.refundable], [0, 0, 0, 0, 0, 0, 0]);
});

// ---- multi-year rules ----
test('years: owner spreadsheet sample matches (2026-27)', () => {
  // 1,00,000 Jul–Dec, 1,10,000 Jan–Jun, 1,10,000 bonus, 2,74,000 invested
  const r = BDTax.calculateTax({ ...base, taxYear: '2026-27', bonus: 110000, investment: 274000,
    salaryPeriods: [{ monthlyAmount: 100000, fromMonth: 0, toMonth: 5 },
      { monthlyAmount: 110000, fromMonth: 6, toMonth: 11 }] });
  assertEqual([r.taxableIncome, r.grossTax, r.rebate, r.finalTax], [913333, 62000, 27400, 34600]);
});

test('years: higher threshold lowers tax in AY 2028-29 and 2030-31', () => {
  const tax = y => BDTax.calculateTax({ ...base, taxYear: y, otherIncome: 1000000 }).grossTax;
  // 1,000,000 − 400k → 300k@10% + 300k@15% = 75,000
  // 1,000,000 − 450k → 300k@10% + 250k@15% = 67,500
  // 1,000,000 − 500k → 300k@10% + 200k@15% = 60,000
  assertEqual([tax('2026-27'), tax('2027-28'), tax('2029-30')], [75000, 67500, 60000]);
});

test('years: 35% applies only above ৳3 crore (2027-28)', () => {
  const at = BDTax.calculateTax({ ...base, taxYear: '2027-28', otherIncome: 30000000 });
  // 690,000 on the first 32 lakh above threshold + 26,350,000 @30%
  assertEqual(at.grossTax, 8595000, 'exactly 3 crore: no 35%');
  assertEqual(at.slabs.length, 6, 'nil + five bands, no 35% line');
  const above = BDTax.calculateTax({ ...base, taxYear: '2027-28', otherIncome: 40000000 });
  assertEqual(above.grossTax, 8595000 + 3500000, '10,000,000 @35% on top');
});

test('years: 2029-30 30% band is 2,63,00,000 so 35% still starts at ৳3 crore', () => {
  const r = BDTax.calculateTax({ ...base, taxYear: '2029-30', otherIncome: 30000000 });
  assertEqual(r.slabs[r.slabs.length - 1], { amount: 26300000, rate: 0.30, tax: 7890000 });
});

// Dates built from parts so the local timezone can't shift the month.
const on = (y, m, d) => new Date(y, m - 1, d);
const statuses = d => BDTax.YEARS.map(y => BDTax.yearStatus(y, d));

test('years: filing season (Nov 2026) — 2025-26 filing, 2026-27 current', () => {
  assertEqual(statuses(on(2026, 11, 14)), ['filing', 'current', 'planning', 'planning', 'planning']);
  assertEqual(BDTax.defaultYear(on(2026, 11, 14)), '2025-26');
});

test('years: after November the filing year becomes past', () => {
  assertEqual(BDTax.yearStatus('2025-26', on(2026, 12, 1)), 'past');
  assertEqual(BDTax.defaultYear(on(2026, 12, 1)), '2026-27');
  assertEqual(BDTax.defaultYear(on(2027, 3, 1)), '2026-27', 'Jan–Jun: running year');
});

test('years: July starts the new income year and the next filing season', () => {
  assertEqual(BDTax.yearStatus('2026-27', on(2027, 7, 1)), 'filing');
  assertEqual(BDTax.yearStatus('2027-28', on(2027, 7, 1)), 'current');
  assertEqual(BDTax.yearStatus('2026-27', on(2027, 6, 30)), 'current', 'last day of the year');
});

test('years: default falls back to the nearest year with rules', () => {
  assertEqual(BDTax.defaultYear(on(2025, 8, 1)), '2025-26', 'filing year 2024-25 not covered');
  assertEqual(BDTax.defaultYear(on(2024, 1, 1)), '2025-26', 'before every year');
  assertEqual(BDTax.defaultYear(on(2032, 1, 1)), '2029-30', 'after every year');
});

// ---- monthly deduction planner ----
const sample = { ...base, taxYear: '2026-27', bonus: 110000, investment: 274000,
  salaryPeriods: [{ monthlyAmount: 100000, fromMonth: 0, toMonth: 5 },
    { monthlyAmount: 110000, fromMonth: 6, toMonth: 11 }] };

test('plan: mid-year — remaining tax spread over months left (mockup case)', () => {
  // annual 34,600 − 12,000 deducted Jul–Oct → 22,600 over Nov–Jun (8 months)
  const p = BDTax.calculateTax({ ...sample, tds: 12000, nextMonth: 4 }).plan;
  assertEqual([p.remaining, p.monthsLeft, p.perMonth, p.payWithReturn], [22600, 8, 2825, 0]);
  assertEqual(p.months.map(m => m.status),
    ['deducted', 'deducted', 'deducted', 'deducted', 'planned', 'planned',
      'planned', 'planned', 'planned', 'planned', 'planned', 'planned']);
  assertEqual(p.months[4].amount, 2825);
  assertEqual(p.months[0].amount, 0, 'past split unknown — no amount shown');
});

test('plan: whole year when nothing is deducted yet (default)', () => {
  const p = BDTax.calculateTax({ ...sample }).plan;
  assertEqual([p.monthsLeft, p.perMonth], [12, 2884], '34,600 ÷ 12 rounded up');
});

test('plan: rounds up so the plan never falls short', () => {
  const p = BDTax.calculateTax({ ...sample, tds: 12001, nextMonth: 4 }).plan;
  assertEqual(p.perMonth, 2825, '22,599 ÷ 8 = 2,824.9 → 2,825');
  assertEqual(p.perMonth * p.monthsLeft >= p.remaining, true);
});

test('plan: mid-year joiner — only months with salary count', () => {
  // joined in January: salary Jan–Jun only; planning from the start
  const p = BDTax.calculateTax({ ...base, taxYear: '2026-27',
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 6, toMonth: 11 }] }).plan;
  assertEqual(p.monthsLeft, 6);
  assertEqual(p.months.slice(0, 6).map(m => m.status), ['none', 'none', 'none', 'none', 'none', 'none']);
});

test('plan: no salary months left — pay the rest with the return', () => {
  const p = BDTax.calculateTax({ ...sample, tds: 30000, nextMonth: 12 }).plan;
  assertEqual([p.monthsLeft, p.perMonth, p.payWithReturn], [0, 0, 4600]);
});

test('plan: over-deducted — nothing more to deduct', () => {
  const r = BDTax.calculateTax({ ...sample, tds: 40000, nextMonth: 6 });
  assertEqual([r.plan.remaining, r.plan.perMonth, r.refundable], [0, 0, 5400]);
});

test('plan: no salary at all — whole tax paid with the return', () => {
  const p = BDTax.calculateTax({ ...base, otherIncome: 1000000 }).plan;
  assertEqual([p.monthsLeft, p.payWithReturn], [0, 75000]);
});

test('plan: default next month follows the year status', () => {
  const nov = on(2026, 11, 14);
  assertEqual(BDTax.defaultNextMonth('2026-27', nov), 4, 'current year: November');
  assertEqual(BDTax.defaultNextMonth('2025-26', nov), 12, 'filing year: over');
  assertEqual(BDTax.defaultNextMonth('2027-28', nov), 0, 'planning: from July');
  assertEqual(BDTax.defaultNextMonth('2026-27', on(2027, 6, 30)), 11, 'June');
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
