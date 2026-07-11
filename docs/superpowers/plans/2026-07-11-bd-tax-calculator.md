# Bangladesh Income Tax Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page, dependency-free web app that live-calculates Bangladesh personal income tax for salaried people, for income years 2025-26 and 2026-27.

**Architecture:** A pure calculation engine (`tax.js`, zero DOM code, all year-specific numbers in a `RULES` map) is loaded by two pages: `index.html` (form + sticky live breakdown pane) and `tests.html` (self-running scenario tests). No build step; everything works from `file://` or GitHub Pages.

**Tech Stack:** Plain HTML, CSS, JavaScript. No frameworks, no libraries, no npm.

**Spec:** `docs/superpowers/specs/2026-07-11-bd-tax-calculator-design.md`

## Global Constraints

- Zero dependencies, zero build step; all four files (`index.html`, `tax.js`, `tests.html`, `README.md`) must work opened directly via `file://`
- All amounts display with the ৳ symbol and Bangladeshi digit grouping: `৳12,34,567`
- Engine (`tax.js`) must never touch the DOM; UI must never compute tax
- Invalid/empty numeric input is treated as `0` — `NaN` must never appear anywhere in the UI
- Negative amounts are blocked (`min="0"` on inputs AND clamped in the engine)
- English UI text with explanatory hints (e.g. "DPS, sanchayapatra, life insurance premium")
- Fiscal year runs July–June; month indexes everywhere are fiscal: `0 = Jul … 11 = Jun`
- Footer must include: "Estimates only — not tax advice." and a link to `https://nbr.gov.bd`
- Repo root is the project directory (`bd-tax-calculator/`) — all paths below are relative to it

---

### Task 1: Test harness + RULES + formatBDT

**Files:**
- Create: `tax.js`
- Create: `tests.html`

**Interfaces:**
- Produces: global `BDTax` object with:
  - `BDTax.RULES` — map keyed by `'2025-26'` / `'2026-27'`; each entry has `{label, basis, thresholds, dependentBonus, slabs, salaryExemption, rebate, minimumTax}`
  - `BDTax.MONTHS` — `['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']`
  - `BDTax.formatBDT(n) → string` — rounds, then formats with Bangladeshi grouping and ৳ prefix; negative numbers as `-৳…`
- Produces: `tests.html` harness with `test(name, fn)` and `assertEqual(actual, expected, label)` used by all later tasks

- [ ] **Step 1: Write the test harness with failing formatBDT tests**

Create `tests.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>BD Tax Calculator — Tests</title>
<style>
  body { font-family: ui-monospace, Menlo, monospace; margin: 2rem; background: #fafafa; }
  h1 { font-size: 1.2rem; }
  .pass { color: #15803d; }
  .fail { color: #b91c1c; font-weight: bold; }
  #summary { font-size: 1.1rem; margin: 1rem 0; }
  li { margin: 0.15rem 0; }
</style>
</head>
<body>
<h1>BD Tax Calculator — engine tests</h1>
<div id="summary"></div>
<ul id="results"></ul>
<script src="tax.js"></script>
<script>
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
</script>
</body>
</html>
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `open tests.html` (macOS opens default browser)
Expected: summary shows FAILURES — every test fails because `tax.js` does not exist yet (BDTax is undefined; each `test()` catches the ReferenceError).

- [ ] **Step 3: Implement tax.js with RULES, MONTHS, formatBDT**

Create `tax.js`:

```js
// Bangladesh personal income tax engine.
// Pure data + functions — no DOM access. Loaded by index.html and tests.html.
const BDTax = (() => {
  'use strict';

  // Fiscal-year month order; index 0 = July … 11 = June.
  const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  // Shared between the two supported years (Finance Ordinance 2025 legislated
  // both; Finance Bill 2026 changed only the investment rebate).
  const THRESHOLDS = {
    general: 375000,
    woman: 425000,
    senior: 425000,
    thirdGender: 500000,
    disabled: 500000,
    freedomFighter: 525000,
    julyWarrior: 525000
  };
  const SLABS = [
    { size: 300000, rate: 0.10 },
    { size: 400000, rate: 0.15 },
    { size: 500000, rate: 0.20 },
    { size: 2000000, rate: 0.25 },
    { size: Infinity, rate: 0.30 }
  ];
  const SALARY_EXEMPTION = { fraction: 1 / 3, cap: 500000 };
  const MINIMUM_TAX = { regular: 5000, firstTime: 1000 };
  const DEPENDENT_BONUS = 50000;

  const RULES = {
    '2025-26': {
      label: 'Income year 2025-26 (AY 2026-27)',
      basis: 'Finance Ordinance 2025',
      thresholds: THRESHOLDS,
      dependentBonus: DEPENDENT_BONUS,
      slabs: SLABS,
      salaryExemption: SALARY_EXEMPTION,
      rebate: { incomeRate: 0.03, investmentRate: 0.15, cap: 1000000 },
      minimumTax: MINIMUM_TAX
    },
    '2026-27': {
      label: 'Income year 2026-27 (AY 2027-28)',
      basis: 'Finance Bill 2026',
      thresholds: THRESHOLDS,
      dependentBonus: DEPENDENT_BONUS,
      slabs: SLABS,
      salaryExemption: SALARY_EXEMPTION,
      rebate: { incomeRate: 0.03, investmentRate: 0.10, cap: 750000 },
      minimumTax: MINIMUM_TAX
    }
  };

  // ৳12,34,567 — last three digits, then groups of two.
  function formatBDT(n) {
    n = Math.round(Number(n) || 0);
    const neg = n < 0;
    let s = String(Math.abs(n));
    if (s.length > 3) {
      const last3 = s.slice(-3);
      const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      s = rest + ',' + last3;
    }
    return (neg ? '-' : '') + '৳' + s;
  }

  return { RULES, MONTHS, formatBDT };
})();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `open tests.html` — reload the tab.
Expected: `10/10 passing — ALL GREEN`

- [ ] **Step 5: Commit**

```bash
git add tax.js tests.html
git commit -m "feat: add tax rules data, BDT formatter, and browser test harness"
```

---

### Task 2: Engine — salary aggregation, exemption, taxable income

**Files:**
- Modify: `tax.js` (add `calculateTax`, export it)
- Modify: `tests.html` (append tests at the marked comment line)

**Interfaces:**
- Consumes: `BDTax.RULES` from Task 1
- Produces: `BDTax.calculateTax(inputs) → breakdown` (partial at this stage). Input shape (all later tasks use exactly this):

```js
{
  taxYear: '2025-26' | '2026-27',
  category: 'general'|'woman'|'senior'|'thirdGender'|'disabled'|'freedomFighter'|'julyWarrior',
  isFirstTimeTaxpayer: boolean,
  disabledDependents: number,          // integer ≥ 0
  salaryPeriods: [{ monthlyAmount: number, fromMonth: 0-11, toMonth: 0-11 }],
  bonus: number, otherIncome: number, investment: number, tds: number
}
```

  Fields produced by this task (numbers, all rounded to whole taka):
  `salaryFromPeriods`, `bonus`, `grossSalary`, `exemption`, `otherIncome`, `taxableIncome`, plus `rules` (the selected year's RULES entry).

- [ ] **Step 1: Append failing tests to tests.html**

Insert immediately after the `// (later tasks append their tests below this line)` comment:

```js
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `open tests.html` — reload.
Expected: 10 old tests pass, 6 new tests fail with `BDTax.calculateTax is not a function`.

- [ ] **Step 3: Implement the income pipeline in tax.js**

In `tax.js`, add above the `return` statement, and extend the return:

```js
  // Coerce any user-supplied value to a non-negative finite number.
  function num(v) {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function calculateTax(inputs) {
    const rules = RULES[inputs.taxYear] || RULES['2025-26'];

    const validPeriods = (inputs.salaryPeriods || [])
      .filter(p => Number(p.toMonth) >= Number(p.fromMonth));
    const salaryFromPeriods = validPeriods.reduce(
      (sum, p) => sum + num(p.monthlyAmount) * (Number(p.toMonth) - Number(p.fromMonth) + 1), 0);

    const bonus = num(inputs.bonus);
    const grossSalary = salaryFromPeriods + bonus;
    const exemption = Math.round(
      Math.min(grossSalary * rules.salaryExemption.fraction, rules.salaryExemption.cap));
    const otherIncome = num(inputs.otherIncome);
    const taxableIncome = grossSalary - exemption + otherIncome;

    return { rules, salaryFromPeriods, bonus, grossSalary, exemption, otherIncome, taxableIncome };
  }
```

Change the module return to:

```js
  return { RULES, MONTHS, formatBDT, calculateTax };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `open tests.html` — reload.
Expected: `16/16 passing — ALL GREEN`

- [ ] **Step 5: Commit**

```bash
git add tax.js tests.html
git commit -m "feat: compute gross salary, employment exemption, and taxable income"
```

---

### Task 3: Engine — threshold and slab tax

**Files:**
- Modify: `tax.js` (extend `calculateTax`)
- Modify: `tests.html` (append tests)

**Interfaces:**
- Consumes: `calculateTax` fields from Task 2
- Produces: breakdown gains
  - `threshold` — category threshold + `dependentBonus × disabledDependents`
  - `slabs` — array for the trace: first entry `{ amount, rate: 0, tax: 0 }` (the nil band, `amount = min(taxableIncome, threshold)`), then one `{ amount, rate, tax }` per non-empty taxed band
  - `grossTax` — rounded sum of slab taxes

- [ ] **Step 1: Append failing tests to tests.html**

Append after the Task 2 tests:

```js
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

test('threshold: disabled dependent bonus', () => {
  const r = BDTax.calculateTax({ ...base, disabledDependents: 1, otherIncome: 400000 });
  assertEqual(r.threshold, 425000, '375,000 + 50,000');
  assertEqual(r.grossTax, 0);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `open tests.html` — reload.
Expected: 16 pass, 6 new fail (`grossTax`/`threshold` undefined).

- [ ] **Step 3: Extend calculateTax with threshold + slab walk**

In `calculateTax`, after the `taxableIncome` line and before `return`, add:

```js
    const threshold = (rules.thresholds[inputs.category] || rules.thresholds.general)
      + rules.dependentBonus * Math.max(0, Math.floor(Number(inputs.disabledDependents) || 0));

    const slabs = [{ amount: Math.min(taxableIncome, threshold), rate: 0, tax: 0 }];
    let remaining = Math.max(taxableIncome - threshold, 0);
    let grossTax = 0;
    for (const s of rules.slabs) {
      if (remaining <= 0) break;
      const amount = Math.min(remaining, s.size);
      const tax = Math.round(amount * s.rate);
      slabs.push({ amount, rate: s.rate, tax });
      grossTax += tax;
      remaining -= amount;
    }
```

Extend the return object:

```js
    return { rules, salaryFromPeriods, bonus, grossSalary, exemption, otherIncome,
      taxableIncome, threshold, slabs, grossTax };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `open tests.html` — reload.
Expected: `22/22 passing — ALL GREEN`

- [ ] **Step 5: Commit**

```bash
git add tax.js tests.html
git commit -m "feat: apply category thresholds and progressive slab tax"
```

---

### Task 4: Engine — rebate, minimum tax, payable/refund, investment tip

**Files:**
- Modify: `tax.js` (complete `calculateTax`)
- Modify: `tests.html` (append tests)

**Interfaces:**
- Consumes: everything from Tasks 2–3
- Produces: breakdown gains (this completes the engine; the UI in Task 6 renders exactly these fields):
  - `rebateBreakdown` — `{ byIncome, byInvestment, cap }` (the three candidates, rounded)
  - `rebate` — `min(byIncome, byInvestment, cap, grossTax)`
  - `taxAfterRebate` — `grossTax − rebate`
  - `minimumTax` — 5,000 / 1,000 when `taxableIncome > threshold`, else 0
  - `minimumApplied` — `true` when the floor raised the result
  - `finalTax` — `max(taxAfterRebate, minimumTax)` above threshold, else 0
  - `tds`, `netPayable` — `max(finalTax − tds, 0)`, `refundable` — `max(tds − finalTax, 0)`
  - `investmentTip` — `null`, or `{ extraInvestment, saving }` when investing more would genuinely lower `finalTax`

- [ ] **Step 1: Append failing tests to tests.html**

Append after the Task 3 tests:

```js
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
  // taxable 520,000, grossTax 14,500; rebate candidates 15,600 / 18,000 / 1M,
  // capped by grossTax → 14,500; after rebate 0 → floor 5,000
  const r = BDTax.calculateTax({ ...base, bonus: 60000, investment: 120000, salaryPeriods: [
    { monthlyAmount: 50000, fromMonth: 0, toMonth: 5 },
    { monthlyAmount: 70000, fromMonth: 6, toMonth: 11 }] });
  assertEqual(r.rebate, 14500);
  assertEqual(r.finalTax, 5000);
  assertEqual(r.minimumApplied, true);
});

test('final: year toggle changes rebate (15% vs 10%)', () => {
  // taxable 1,300,000, grossTax 135,000, investment 200,000
  const inputs = { ...base, investment: 200000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] };
  const r25 = BDTax.calculateTax(inputs);
  const r26 = BDTax.calculateTax({ ...inputs, taxYear: '2026-27' });
  assertEqual(r25.rebate, 30000, '15% of 200,000 binds');
  assertEqual(r25.finalTax, 105000);
  assertEqual(r26.rebate, 20000, '10% of 200,000 binds');
  assertEqual(r26.finalTax, 115000);
});

test('final: absolute rebate caps (10 lakh vs 7.5 lakh)', () => {
  const inputs = { ...base, otherIncome: 40000000, investment: 10000000 };
  const r25 = BDTax.calculateTax(inputs);
  const r26 = BDTax.calculateTax({ ...inputs, taxYear: '2026-27' });
  assertEqual(r25.rebate, 1000000);
  assertEqual(r25.finalTax, 10617500);
  assertEqual(r26.rebate, 750000);
  assertEqual(r26.finalTax, 10867500);
});

test('final: TDS refund', () => {
  const r = BDTax.calculateTax({ ...base, investment: 200000, tds: 120000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.finalTax, 105000);
  assertEqual(r.netPayable, 0);
  assertEqual(r.refundable, 15000);
});

test('final: investment tip suggests useful extra investment', () => {
  // rebate 30,000 vs 3%-cap 39,000 → 9,000 headroom → 60,000 more at 15%
  const r = BDTax.calculateTax({ ...base, investment: 200000,
    salaryPeriods: [{ monthlyAmount: 150000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.investmentTip, { extraInvestment: 60000, saving: 9000 });
});

test('final: no tip when floor makes investing useless', () => {
  // grossTax 900 → even full rebate leaves 5,000 floor
  const r = BDTax.calculateTax({ ...base,
    salaryPeriods: [{ monthlyAmount: 48000, fromMonth: 0, toMonth: 11 }] });
  assertEqual(r.investmentTip, null);
});

test('final: all-zero input is all zeros, no NaN', () => {
  const r = BDTax.calculateTax({ ...base });
  assertEqual([r.grossSalary, r.taxableIncome, r.grossTax, r.rebate, r.finalTax,
    r.netPayable, r.refundable], [0, 0, 0, 0, 0, 0, 0]);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `open tests.html` — reload.
Expected: 22 pass, 10 new fail (`finalTax` undefined etc.).

- [ ] **Step 3: Complete calculateTax**

In `calculateTax`, after the slab loop and before `return`, add:

```js
    const investment = num(inputs.investment);
    const rebateBreakdown = {
      byIncome: Math.round(taxableIncome * rules.rebate.incomeRate),
      byInvestment: Math.round(investment * rules.rebate.investmentRate),
      cap: rules.rebate.cap
    };
    // Rebate can never exceed the tax itself (tax never goes negative).
    const rebate = Math.min(
      rebateBreakdown.byIncome, rebateBreakdown.byInvestment, rebateBreakdown.cap, grossTax);
    const taxAfterRebate = grossTax - rebate;

    const aboveThreshold = taxableIncome > threshold;
    const minimumTax = aboveThreshold
      ? (inputs.isFirstTimeTaxpayer ? rules.minimumTax.firstTime : rules.minimumTax.regular)
      : 0;
    const finalTax = aboveThreshold ? Math.max(taxAfterRebate, minimumTax) : 0;
    const minimumApplied = aboveThreshold && finalTax > taxAfterRebate;

    // Would investing more actually lower the bill?
    const maxUsefulRebate = Math.min(rebateBreakdown.byIncome, rules.rebate.cap, grossTax);
    let investmentTip = null;
    if (aboveThreshold && rebate < maxUsefulRebate) {
      const saving = finalTax - Math.max(grossTax - maxUsefulRebate, minimumTax);
      if (saving > 0) {
        investmentTip = {
          extraInvestment: Math.ceil((maxUsefulRebate - rebate) / rules.rebate.investmentRate),
          saving
        };
      }
    }

    const tds = num(inputs.tds);
```

Replace the return with the full breakdown:

```js
    return { rules, salaryFromPeriods, bonus, grossSalary, exemption, otherIncome,
      taxableIncome, threshold, slabs, grossTax,
      rebateBreakdown, rebate, taxAfterRebate, minimumTax, minimumApplied, finalTax,
      investmentTip, tds,
      netPayable: Math.max(finalTax - tds, 0),
      refundable: Math.max(tds - finalTax, 0) };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `open tests.html` — reload.
Expected: `32/32 passing — ALL GREEN`

- [ ] **Step 5: Commit**

```bash
git add tax.js tests.html
git commit -m "feat: investment rebate, minimum tax floor, payable/refund, investment tip"
```

---

### Task 5: Static UI — layout, form controls, styling

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: nothing yet (script wiring is Task 6; this task ships the complete static page with an empty breakdown pane)
- Produces: element IDs Task 6 binds to — `taxYear` (radio pair, name `taxYear`), `category`, `firstTime`, `dependents`, `salaryRows`, `addRow`, `salaryWarning`, `bonus`, `otherIncome`, `investment`, `investmentHint`, `tds`, `breakdown`, `footerBasis`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bangladesh Income Tax Calculator</title>
<style>
  :root {
    --ink: #1f2937; --muted: #6b7280; --line: #e5e7eb;
    --accent: #0f766e; --warn: #b45309; --good: #15803d; --bg: #f8fafc;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
         color: var(--ink); background: var(--bg); line-height: 1.45; }
  header { text-align: center; padding: 1.5rem 1rem 0.5rem; }
  header h1 { margin: 0; font-size: 1.5rem; }
  header p { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.9rem; }
  main { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
         max-width: 960px; margin: 1rem auto; padding: 0 1rem; align-items: start; }
  @media (max-width: 800px) { main { grid-template-columns: 1fr; } }
  .panel { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 1.25rem; }
  #breakdown { position: sticky; top: 1rem; }
  fieldset { border: 1px solid var(--line); border-radius: 8px; margin: 0 0 1rem; padding: 0.6rem 0.8rem; }
  legend { font-size: 0.8rem; color: var(--muted); padding: 0 0.3rem; }
  label.field { display: block; margin-bottom: 0.9rem; font-weight: 600; font-size: 0.95rem; }
  label.field input[type=number], label.field select {
    display: block; width: 100%; margin-top: 0.25rem; padding: 0.45rem 0.6rem;
    border: 1px solid var(--line); border-radius: 6px; font-size: 1rem; font-weight: 400; }
  .hint { font-weight: 400; font-size: 0.8rem; color: var(--muted); display: block; }
  .inline { display: flex; align-items: center; gap: 0.5rem; font-weight: 400; margin-bottom: 0.6rem; }
  .inline input[type=number] { width: 4.5rem; padding: 0.3rem; border: 1px solid var(--line); border-radius: 6px; }
  h2 { font-size: 1rem; margin: 1.2rem 0 0.5rem; }
  .salary-row { display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.5rem; }
  .salary-row input { flex: 1; min-width: 0; padding: 0.45rem 0.6rem;
    border: 1px solid var(--line); border-radius: 6px; font-size: 1rem; }
  .salary-row select { padding: 0.45rem 0.3rem; border: 1px solid var(--line); border-radius: 6px; }
  .salary-row button { border: none; background: none; color: var(--warn);
    font-size: 1.1rem; cursor: pointer; padding: 0.2rem; }
  #addRow { background: none; border: 1px dashed var(--accent); color: var(--accent);
    border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.9rem; }
  .warn { color: var(--warn); font-size: 0.85rem; min-height: 1.2em; margin: 0.3rem 0 0; }
  .tip { color: var(--accent); font-size: 0.85rem; margin: 0.3rem 0 0; }
  /* breakdown pane */
  .bd-line { display: flex; justify-content: space-between; gap: 1rem;
    padding: 0.3rem 0; font-size: 0.95rem; }
  .bd-line .lbl { color: var(--ink); }
  .bd-line .lbl small { color: var(--muted); display: block; font-size: 0.75rem; }
  .bd-line .amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bd-sub { color: var(--muted); font-size: 0.85rem; }
  .bd-rule { border-top: 1px solid var(--line); margin: 0.5rem 0; }
  .bd-total { font-size: 1.25rem; font-weight: 700; display: flex;
    justify-content: space-between; padding-top: 0.6rem; }
  .bd-total.refund { color: var(--good); }
  footer { text-align: center; color: var(--muted); font-size: 0.8rem;
    padding: 1.5rem 1rem 2rem; }
  footer a { color: var(--accent); }
</style>
</head>
<body>
<header>
  <h1>Bangladesh Income Tax Calculator</h1>
  <p>For salaried people — everything calculates live, nothing is stored</p>
</header>
<main>
  <form class="panel" id="form" autocomplete="off">
    <fieldset>
      <legend>Tax year</legend>
      <label class="inline"><input type="radio" name="taxYear" value="2025-26" checked>
        2025-26 — return filing now (Jul–Nov 2026)</label>
      <label class="inline"><input type="radio" name="taxYear" value="2026-27">
        2026-27 — current year (planning)</label>
    </fieldset>

    <label class="field">Taxpayer category
      <select id="category">
        <option value="general">General (male)</option>
        <option value="woman">Woman</option>
        <option value="senior">Senior citizen (65+)</option>
        <option value="thirdGender">Third gender</option>
        <option value="disabled">Person with disability</option>
        <option value="freedomFighter">War-wounded freedom fighter</option>
        <option value="julyWarrior">July Warrior</option>
      </select>
    </label>
    <label class="inline"><input type="checkbox" id="firstTime"> First-time taxpayer
      <span class="hint">(minimum tax ৳1,000 instead of ৳5,000)</span></label>
    <label class="inline">Disabled dependents
      <input type="number" id="dependents" min="0" step="1" value="0">
      <span class="hint">+৳50,000 tax-free each</span></label>

    <h2>Monthly salary</h2>
    <div id="salaryRows"></div>
    <button type="button" id="addRow">+ Add period</button>
    <p class="warn" id="salaryWarning"></p>

    <h2>Other amounts (yearly totals)</h2>
    <label class="field">Bonus
      <span class="hint">festival + performance bonuses for the year</span>
      <input type="number" id="bonus" min="0" placeholder="0">
    </label>
    <label class="field">Other income
      <span class="hint">bank interest, side income etc. — added to taxable income as-is</span>
      <input type="number" id="otherIncome" min="0" placeholder="0">
    </label>
    <label class="field">Investment eligible for rebate
      <span class="hint">DPS, sanchayapatra, life insurance premium, provident fund, listed shares</span>
      <input type="number" id="investment" min="0" placeholder="0">
      <span class="tip" id="investmentHint"></span>
    </label>
    <label class="field">Tax already deducted at office (TDS)
      <span class="hint">total tax your employer withheld this year</span>
      <input type="number" id="tds" min="0" placeholder="0">
    </label>
  </form>

  <aside class="panel" id="breakdown" aria-live="polite"></aside>
</main>
<footer>
  <span id="footerBasis"></span>
  Estimates only — not tax advice.
  Official source: <a href="https://nbr.gov.bd" target="_blank" rel="noopener">nbr.gov.bd</a>
</footer>
<script src="tax.js"></script>
<script src="app.js"></script>
</body>
</html>
```

Note: `app.js` does not exist yet — created in Task 6. The page must still render fine without it (browsers ignore a failed script load).

- [ ] **Step 2: Verify the static page in a browser**

Run: `open index.html`
Expected: header, two-column layout (form left, empty white pane right), all fields and hints visible; stacks to one column when the window is narrower than ~800px; no console errors other than the missing `app.js` 404.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: static single-page layout with form controls and breakdown pane shell"
```

---

### Task 6: UI wiring — salary rows, live recalculation, breakdown render

**Files:**
- Create: `app.js`

**Interfaces:**
- Consumes: `BDTax.calculateTax`, `BDTax.formatBDT`, `BDTax.MONTHS`, `BDTax.RULES`; element IDs from Task 5
- Produces: the finished app; no exports

- [ ] **Step 1: Create app.js**

```js
// UI wiring for index.html. All math lives in tax.js — this file only
// reads the form, calls BDTax.calculateTax, and renders the result.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = BDTax.formatBDT;

  // ---- salary period rows ----
  // Each row is DOM-owned state: input.amount, select.from, select.to
  const rowsEl = $('salaryRows');

  function monthOptions(selected) {
    return BDTax.MONTHS
      .map((m, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${m}</option>`)
      .join('');
  }

  function addRow(from = 0, to = 11) {
    const row = document.createElement('div');
    row.className = 'salary-row';
    row.innerHTML =
      `<input type="number" min="0" placeholder="Monthly amount" class="amount">
       from <select class="from">${monthOptions(from)}</select>
       to <select class="to">${monthOptions(to)}</select>
       <button type="button" class="remove" title="Remove period">✖</button>`;
    row.querySelector('.remove').addEventListener('click', () => {
      if (rowsEl.children.length > 1) row.remove();
      else row.querySelector('.amount').value = '';   // last row: just clear it
      recalc();
    });
    rowsEl.appendChild(row);
  }

  function readPeriods() {
    return [...rowsEl.querySelectorAll('.salary-row')].map(row => ({
      monthlyAmount: row.querySelector('.amount').value,
      fromMonth: Number(row.querySelector('.from').value),
      toMonth: Number(row.querySelector('.to').value),
      el: row
    }));
  }

  // Warn on from>to rows and months counted twice; gaps are fine (mid-year joiners).
  function salaryWarnings(periods) {
    const msgs = [];
    const counts = new Array(12).fill(0);
    for (const p of periods) {
      if (p.toMonth < p.fromMonth) {
        msgs.push(`"${BDTax.MONTHS[p.fromMonth]}–${BDTax.MONTHS[p.toMonth]}" is invalid (start is after end) — row ignored.`);
      } else if (Number(p.monthlyAmount) > 0) {
        for (let m = p.fromMonth; m <= p.toMonth; m++) counts[m]++;
      }
    }
    const dup = BDTax.MONTHS.filter((_, i) => counts[i] > 1);
    if (dup.length) msgs.push(`${dup.join(', ')} counted in more than one period — both amounts are added.`);
    return msgs.join(' ');
  }

  // ---- read form → engine input ----
  function readInputs() {
    return {
      taxYear: document.querySelector('input[name="taxYear"]:checked').value,
      category: $('category').value,
      isFirstTimeTaxpayer: $('firstTime').checked,
      disabledDependents: $('dependents').value,
      salaryPeriods: readPeriods(),
      bonus: $('bonus').value,
      otherIncome: $('otherIncome').value,
      investment: $('investment').value,
      tds: $('tds').value
    };
  }

  // ---- render breakdown pane ----
  function line(lbl, amt, sub) {
    return `<div class="bd-line"><span class="lbl">${lbl}${sub ? `<small>${sub}</small>` : ''}</span>
            <span class="amt">${amt}</span></div>`;
  }

  function render(r) {
    const pct = x => (x * 100).toFixed(0) + '%';
    let h = '<h2 style="margin-top:0">Your tax, step by step</h2>';
    h += line('Gross salary', fmt(r.grossSalary),
      r.bonus > 0 ? `includes ${fmt(r.bonus)} bonus` : '');
    h += line('− Tax-free part of salary', fmt(r.exemption),
      '⅓ of salary is tax-free (max ৳5,00,000)');
    if (r.otherIncome > 0) h += line('+ Other income', fmt(r.otherIncome), '');
    h += `<div class="bd-rule"></div>`;
    h += line('<b>Taxable income</b>', `<b>${fmt(r.taxableIncome)}</b>`, '');
    h += `<div class="bd-rule"></div>`;
    r.slabs.forEach((s, i) => {
      h += line(i === 0 ? `First ${fmt(s.amount)} — tax-free` : `Next ${fmt(s.amount)} @ ${pct(s.rate)}`,
        fmt(s.tax));
    });
    h += line('<b>Tax before rebate</b>', `<b>${fmt(r.grossTax)}</b>`, '');
    if (r.rebate > 0) h += line('− Investment rebate', fmt(r.rebate),
      `lowest of ${pct(r.rules.rebate.incomeRate)} of income (${fmt(r.rebateBreakdown.byIncome)}), ` +
      `${pct(r.rules.rebate.investmentRate)} of investment (${fmt(r.rebateBreakdown.byInvestment)}), ` +
      `${fmt(r.rebateBreakdown.cap)}`);
    if (r.minimumApplied) h += line('Minimum tax applies', fmt(r.finalTax),
      `income above the tax-free limit pays at least ${fmt(r.minimumTax)}`);
    if (r.tds > 0) h += line('− Already deducted at office (TDS)', fmt(r.tds), '');
    h += `<div class="bd-rule"></div>`;
    if (r.refundable > 0) {
      h += `<div class="bd-total refund"><span>Refundable / adjustable</span><span>${fmt(r.refundable)}</span></div>`;
    } else {
      h += `<div class="bd-total"><span>Payable</span><span>${fmt(r.netPayable)}</span></div>`;
    }
    $('breakdown').innerHTML = h;
  }

  // ---- main loop ----
  function recalc() {
    const inputs = readInputs();
    $('salaryWarning').textContent = salaryWarnings(inputs.salaryPeriods);
    const r = BDTax.calculateTax(inputs);
    render(r);
    $('investmentHint').textContent = r.investmentTip
      ? `Investing ${fmt(r.investmentTip.extraInvestment)} more would save ${fmt(r.investmentTip.saving)} in tax.`
      : '';
    $('footerBasis').textContent = `${r.rules.label} rules per ${r.rules.basis}. `;
  }

  $('addRow').addEventListener('click', () => { addRow(); recalc(); });
  $('form').addEventListener('input', recalc);
  addRow();       // start with one full-year row
  recalc();       // initial render (all zeros)
})();
```

- [ ] **Step 2: Verify in the browser — functional checklist**

Run: `open index.html` and check each item:

1. Pane shows all-zero trace on load; typing `50000` in the salary row updates every line **on each keystroke**.
2. "+ Add period" adds a row; set row 1 to `50000` Jul–Dec, row 2 `70000` Jan–Jun, bonus `60000`, investment `120000` → Taxable income shows `৳5,20,000`, Payable shows `৳5,000` with a "Minimum tax applies" line (spec mockup case).
3. Flip year toggle to 2026-27 with salary `150000` Jul–Jun and investment `200000` → Payable changes from `৳1,05,000` to `৳1,15,000`; footer text switches to "Finance Bill 2026".
4. Set a row to from `Dec` to `Aug` → warning "…invalid (start is after end)…"; two rows both covering Jul → warning lists Jul as double-counted.
5. TDS `120000` with the 105,000 case → green "Refundable / adjustable ৳15,000".
6. Investment hint appears for case 3 ("Investing ৳60,000 more would save ৳9,000 in tax.").
7. ✖ on the only row clears it instead of removing; ✖ with two rows removes one.
8. Narrow the window below 800px → single column, pane below form; no horizontal scroll.
9. Console shows no errors.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: wire form to engine with live breakdown, salary rows, and warnings"
```

---

### Task 7: README, spec sync, final verification

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/specs/2026-07-11-bd-tax-calculator-design.md` (file list: `app.js` was split out of `index.html` — update the architecture tree to five files)

**Interfaces:**
- Consumes: the finished app
- Produces: repo ready to publish on GitHub Pages

- [ ] **Step 1: Write README.md**

```markdown
# Bangladesh Income Tax Calculator

Live, in-browser income tax calculator for salaried people in Bangladesh.
No backend, no database, nothing stored — open `index.html` and type.

**Use it for:**
- Income year **2025-26** (AY 2026-27) — the return filed Jul–Nov 2026,
  per the Finance Ordinance 2025
- Income year **2026-27** (AY 2027-28) — the running year, per the
  Finance Bill 2026 (reduced investment rebate: 10% / ৳7.5 lakh cap)

**Features:** all official taxpayer categories, mid-year salary changes via
month-range rows, bonus / other income / investment / TDS, minimum-tax and
first-time-taxpayer rules, full step-by-step breakdown, and an "investing
৳X more saves ৳Y" hint.

## Run

Open `index.html` in any browser. No build, no dependencies.

## Test

Open `tests.html` — hand-computed scenarios run automatically and the page
shows green/red per test.

## Updating for a new tax year

All year-specific numbers live in the `RULES` map at the top of `tax.js`.
Add a new entry (and a radio button in `index.html`) — nothing else changes.

## Disclaimer

Estimates only — not tax advice. Verify against [NBR](https://nbr.gov.bd).
```

- [ ] **Step 2: Update the spec's file tree**

In `docs/superpowers/specs/2026-07-11-bd-tax-calculator-design.md`, replace the four-file tree with:

```
bd-tax-calculator/
├── index.html    — page markup + CSS, loads tax.js and app.js
├── tax.js        — RULES map + calculateTax(), zero DOM code
├── app.js        — form reading + breakdown rendering, zero tax math
├── tests.html    — self-running scenario tests, loads tax.js
└── README.md
```

and change "four plain files" to "five plain files".

- [ ] **Step 3: Final verification**

Run: `open tests.html` → Expected: `32/32 passing — ALL GREEN`.
Run: `open index.html` → spot-check items 2, 3, and 5 from the Task 6 checklist still pass.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-07-11-bd-tax-calculator-design.md
git commit -m "docs: add README and sync spec file tree with app.js split"
```
