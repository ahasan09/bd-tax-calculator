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
test('RULES: rebate differs by year', () => {
  assertEqual(BDTax.RULES['2025-26'].rebate, { incomeRate: 0.03, investmentRate: 0.15, cap: 1000000 });
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
