# Bangladesh Income Tax Calculator — Design

**Date:** 2026-07-11
**Status:** Approved

## Purpose

A single-page, self-contained web app that calculates Bangladesh personal income
tax for salaried individuals. Everything computes live in the browser as the user
types — no backend, no database, no build step. Hosted as a static page
(GitHub Pages-ready) so anyone can use it.

Supported tax years — selectable via a two-option toggle at the top of the form:

- **Income year 2025-26 (AY 2026-27)** — "return filing now" (Jul–Nov 2026),
  per the Finance Ordinance 2025 (sources: KPMG/Rahman Rahman Huq salient
  features; ACNABIN summary; rebate formula confirmed against the official
  law text of §78, Income Tax Act 2023 on bdlaws.minlaw.gov.bd)
- **Income year 2026-27 (AY 2027-28)** — "current year", per the June 2026
  budget / Finance Bill 2026 (reduced investment rebate; other personal-tax
  parameters unchanged from FO 2025, which legislated both years)

Each year is a self-contained entry in a `RULES` map; adding a future year is
one new entry.

## Scope

**In scope**
- Salaried income with mid-year salary changes (multiple salary periods)
- Yearly bonus total
- One generic "other income" field (added to taxable income as-is)
- Investment tax rebate
- TDS (tax already deducted at office) and payable/refundable result
- All official taxpayer categories (different tax-free thresholds)
- First-time-taxpayer minimum tax rule; disabled-dependent threshold bump
- Year toggle: income year 2025-26 (filing) and 2026-27 (current)

**Out of scope (YAGNI)**
- Years before 2025-26
- Quarterly filing incentives/charges introduced in Budget 2026-27
- House rent, capital gains, business income with their own rules
- Surcharge on net worth, environment surcharge
- Saving or sharing data (no storage of any kind)
- Bangla/English toggle (English UI with Bangla-flavored hints instead)

## Tax rules

All values live in a `RULES` map keyed by income year (`"2025-26"`,
`"2026-27"`). The two years share everything except the investment rebate.

**Tax-free thresholds (both years)**

| Category | Threshold (BDT) |
|---|---|
| General (male) | 375,000 |
| Woman; senior citizen 65+ | 425,000 |
| Third gender; person with disability | 500,000 |
| Gazetted war-wounded freedom fighter; July Warrior | 525,000 |

Parent/legal guardian of a physically challenged dependent: +50,000 per
dependent on top of their category threshold.

**Slabs (after the category threshold)**

| Band | Rate |
|---|---|
| First — up to threshold | 0% |
| Next 300,000 | 10% |
| Next 400,000 | 15% |
| Next 500,000 | 20% |
| Next 2,000,000 | 25% |
| Balance | 30% |

**Employment income exemption:** the lower of ⅓ of total employment income
(salary periods + bonus) or BDT 500,000 is exempt.

**Investment rebate** (the one rule that differs between years):

| Income year | Formula — lowest of |
|---|---|
| 2025-26 (AY 2026-27) | 3% of taxable income · **15%** of eligible investment · **BDT 1,000,000** |
| 2026-27 (AY 2027-28) | 3% of taxable income · **10%** of eligible investment · **BDT 750,000** |

(2025-26 formula confirmed against §78, Income Tax Act 2023 as amended, on
bdlaws.minlaw.gov.bd; 2026-27 formula per Finance Bill 2026 budget coverage —
re-verify against the NBR paripatra for AY 2027-28 when published.)

**Minimum tax:** if taxable income exceeds the threshold, tax after rebate is
floored at BDT 5,000 — or BDT 1,000 for a first-time taxpayer. At or below the
threshold, tax is 0 and no minimum applies.

## Architecture

One deliverable folder of plain files, zero dependencies, no build step:

```
bd-tax-calculator/
├── index.html    — page markup + CSS, loads tax.js and app.js
├── tax.js        — RULES map + calculateTax(), zero DOM code
├── app.js        — form reading + breakdown rendering, zero tax math
├── tests.html    — browser test page, loads tax.js and tests.js
├── tests.js      — test cases + harness (browser and node)
├── run-tests.mjs — headless node test runner
└── README.md
```

The engine lives in `tax.js` so the app and the tests share one source of
truth. Both pages work served statically or opened via `file://`.

### Calculation engine

`calculateTax(inputs) → breakdown` — a pure function, no DOM access. UI code
never computes anything; it only renders the returned breakdown.

**Inputs**

```js
{
  taxYear,             // "2025-26" | "2026-27" — key into RULES
  category,            // key into RULES[taxYear].thresholds
  isFirstTimeTaxpayer, // boolean
  disabledDependents,  // integer ≥ 0
  salaryPeriods,       // [{ monthlyAmount, fromMonth, toMonth }] — months are
                       // fiscal-year indexed: 0 = July … 11 = June
  bonus,               // yearly total
  otherIncome,         // yearly total, added to taxable income as-is
  investment,          // yearly total eligible investment
  tds                  // tax already deducted at office
}
```

**Pipeline (each step's result is a named field in the output)**

1. `grossSalary` = Σ(monthlyAmount × monthsInRange) + bonus
2. `exemption` = min(grossSalary / 3, 500,000)
3. `taxableIncome` = (grossSalary − exemption) + otherIncome
4. `threshold` = category threshold + 50,000 × disabledDependents
5. `slabTax` = progressive slabs applied above the threshold; output includes a
   per-slab array `{bandAmount, rate, tax}` for the trace
6. `rebate` = min(3% × taxableIncome, rebateRate × investment, rebateCap)
   using the selected year's rate/cap; never more than would take tax below
   the minimum-tax floor (and never below 0)
7. `minimumTaxApplied` = if taxableIncome > threshold, floor the result at
   5,000 (or 1,000 if first-time); flag when the floor changed the number
8. `netPayable` = tax − tds; negative values reported as `refundable`

### UI

Two-column layout: form on the left, sticky live-breakdown pane on the right;
columns stack vertically below ~800px. Every field recalculates on `input`.
No submit button. Amounts render with Bangladeshi digit grouping (৳12,34,567).

**Form (top to bottom)**
- Tax year toggle: "2025-26 — return filing now" / "2026-27 — current year"
  (default 2025-26 during filing season; the rebate hint text updates with it)
- Taxpayer category dropdown (7 entries mapping to the 4 thresholds)
- "First-time taxpayer" checkbox; "disabled dependents" number stepper (default 0)
- Salary period rows: `[monthly amount] from [month ▾] to [month ▾] ✖`, month
  dropdowns ordered Jul→Jun; "+ Add period" button. One row (Jul–Jun) by default.
- Bonus (yearly total) — hint: "festival + performance bonuses"
- Other income — hint: "bank interest, side income etc."
- Investment — hint: "DPS, sanchayapatra, life insurance premium, provident
  fund, listed shares". Helper line when the 3% cap is not yet reached:
  "Investing ৳X more would save ৳Y".
- TDS (yearly total deducted at office)

**Breakdown pane** — full trace with plain-language labels: gross salary,
exemption line ("⅓ of salary is tax-free, max ৳5,00,000"), taxable income,
slab-by-slab tax lines, rebate, minimum-tax line (only when the floor applied),
TDS, ending in a large PAYABLE figure (green REFUNDABLE when negative).

**Footer** — names the selected year's legal basis ("FY 2025-26 per Finance
Ordinance 2025" / "FY 2026-27 per Finance Bill 2026"). "Estimates only — not
tax advice." + link to nbr.gov.bd.

## Edge cases

- Taxable income ≤ threshold → tax 0, minimum tax does NOT apply
- Income just above threshold → minimum-tax floor shown as an explicit labeled
  line so a jump from ৳0 to ৳5,000 doesn't look like a bug
- Rebate never pushes tax below the minimum floor or below zero
- TDS > tax → green "Refundable/adjustable" result, never negative payable
- Empty/invalid fields treated as 0; NaN can never reach the pane; negative
  input blocked
- Salary rows: `from > to` → inline error, row excluded; overlapping rows →
  warning naming the double-counted months, but still computed as entered;
  gaps allowed silently (mid-year joiners)

## Testing

`tests.html` runs ~15 hand-computed scenarios against `calculateTax()` and
renders green/red results — open in a browser to verify. Scenarios cover:
each threshold boundary (all 4 categories, at/below/just-above), mid-year
raise vs flat salary equivalence, each of the three rebate caps binding —
verified under both years' rates (15%/৳10 lakh and 10%/৳7.5 lakh), same
inputs producing different rebates across the year toggle, minimum-tax floor
(regular and first-time), refund case, zero input, and the exemption cap
(salary above ৳15,00,000 where the ৳5,00,000 cap binds).

## Decisions log

- Two-year toggle (2025-26 filing / 2026-27 current); rules isolated in a
  per-year RULES map. The years differ only in the rebate formula: 15% of
  investment capped at ৳10 lakh vs 10% capped at ৳7.5 lakh (Finance Bill 2026)
- All 7 official taxpayer categories (single dropdown, near-zero extra cost)
- Salary entry = amount + month-range rows (handles any raise month)
- Income scope = salary + bonus + one generic other-income field
- Plain HTML/CSS/JS, no framework, no build
- English UI with explanatory hints; ৳ and Bangladeshi digit grouping
- Layout = form + sticky live breakdown pane (the trace is the teaching tool)
