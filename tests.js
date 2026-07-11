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
