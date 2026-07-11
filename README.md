# Bangladesh Income Tax Calculator

Live, in-browser income tax calculator for salaried people in Bangladesh.
No backend, no database, nothing stored — open `index.html` and type.

**Use it for:**
- Income year **2025-26** (AY 2026-27) — the return filed Jul–Nov 2026,
  per the Finance Ordinance 2025
- Income year **2026-27** (AY 2027-28) — the running year, per the
  Finance Bill 2026

Both years use the Finance Bill 2026 investment rebate: lowest of 3% of
taxable income, 10% of eligible investment, or ৳7,50,000.

**Features:** all official taxpayer categories, mid-year salary changes via
month-range rows, bonus / other income / investment / TDS, minimum-tax and
first-time-taxpayer rules, full step-by-step breakdown, and an "investing
৳X more saves ৳Y" hint.

## Run

Open `index.html` in any browser. No build, no dependencies.

## Test

Open `tests.html` in a browser — the scenarios run automatically and show
green/red per test. Or run headless: `node run-tests.mjs`.

## Updating for a new tax year

All year-specific numbers live in the `RULES` map at the top of `tax.js`.
Add a new entry (and a radio button in `index.html`) — nothing else changes.

## Disclaimer

Estimates only — not tax advice. Verify against [NBR](https://nbr.gov.bd).
