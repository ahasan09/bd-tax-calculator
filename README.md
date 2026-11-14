# Bangladesh Income Tax Calculator

Live, in-browser income tax calculator for salaried people in Bangladesh.
No backend, no database, nothing stored — open `index.html` and type.

**Tax years:** income years 2025-26 to 2029-30 (assessment years 2026-27
to 2030-31), all set by the **Finance Act 2026** as explained in NBR's
Income Tax Paripatra 2026-27. The page opens on the year you most likely
want: the filing year during filing season (July–November), otherwise the
running year. Later years are marked "planning", since a future budget may
still change them.

| Income year | General tax-free limit | Top rate |
|---|---|---|
| 2025-26, 2026-27 | ৳4,00,000 | 30% |
| 2027-28, 2028-29 | ৳4,50,000 | 35% above ৳3 crore |
| 2029-30 | ৳5,00,000 | 35% above ৳3 crore |

Investment rebate, every year: lowest of 3% of taxable income, 10% of
eligible investment, or ৳7,50,000.

**Features:** all official taxpayer categories, mid-year salary changes via
month-range rows, **several employers in one year** (job change — salaries
are pooled so the ৳5 lakh exemption cap applies once), bonus and TDS per
employer, other income, **itemized investments** (provident fund — yours
and your employer's — DPS up to ৳1,20,000, savings certificates up to
৳5,00,000, insurance, shares, funds, pension, donations; limits per NBR's
Aykor Nirdeshika 2026-27), minimum-tax and
first-time-taxpayer rules, full step-by-step breakdown, an "investing
৳X more saves ৳Y" hint, and a **monthly deduction planner**: tax still owed
after what your office has already deducted, spread over the salary months
left in the year (mid-year joiners and "pay with return" cases included).

## Run

Open `index.html` in any browser. No build, no dependencies.

## Test

Open `tests.html` in a browser — the scenarios run automatically and show
green/red per test. Or run headless: `node run-tests.mjs`.

## Updating for a new tax year

All year-specific numbers live in the `RULES` map at the top of `tax.js`.
Add one `year(...)` entry; the year picker builds itself from `RULES`.

## Disclaimer

Estimates only — not tax advice. Verify against [NBR](https://nbr.gov.bd).
