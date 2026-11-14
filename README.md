# Bangladesh Income Tax Calculator

**Live site: https://ahasan09.github.io/bd-tax-calculator/**

Live, in-browser income tax calculator for salaried people in Bangladesh.
No backend, no database, nothing stored — everything calculates as you type.
Built with React, TypeScript and [Mantine](https://mantine.dev), with light
and dark themes.

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
employer, **other income by source** (bank interest and savings-certificate
profit taxed at normal rates, with the tax deducted on them and any advance
tax credited), **itemized investments** (provident fund — yours
and your employer's — DPS up to ৳1,20,000, savings certificates up to
৳5,00,000, insurance, shares, funds, pension, donations; limits per NBR's
Aykor Nirdeshika 2026-27), minimum-tax and
first-time-taxpayer rules, full step-by-step breakdown, an "investing
৳X more saves ৳Y" hint, and a **monthly deduction planner**: tax still owed
after what your office has already deducted, spread over the salary months
left in the year (mid-year joiners and "pay with return" cases included).

**বাংলা / English:** switch in the header; Bangla shows ০–৯ digits and Bangla
month names, the return summary uses the form's own Bangla wording, and
amounts can be typed with Bangla or Latin digits. The choice is remembered
in your browser (Bangla is the default on a Bangla-language system). Bangla
uses the device's own fonts, so no web-font request leaves the page. All
text lives in `src/i18n/text.ts`; the tests check both languages have every
key with the same placeholders.

**Layout:** two tabs — *Calculator* (the form, with the result pane split
into *Tax breakdown* and *Monthly plan*) and *Return summary* on its own
page. Printing always includes the breakdown, the plan and the return
summary, whichever tab is open.

**Responsive:** checked at 320–1920 px (phones, tablets in both
orientations, desktop) in both languages: no sideways scrolling, no clipped
text, touch targets at least 36 px. On phones the result total stays pinned
to the bottom of the screen; the monthly plan grid picks 3, 4 or 6 columns
from the space it actually has.

**Offline and installable:** after the first visit the calculator opens and
works with no connection, and it can be installed to a phone or desktop home
screen. A small service worker caches only the app's own files — nothing you
type is stored. Online, the page always comes from the network, so a new
deploy is picked up on the next visit and the old cache is removed.

**Return summary:** your figures in the order the individual return form
(IT-11GA 2023) asks for them — income serials 1–11, tax computation 12–19,
payment 20–26, plus Schedule 1 (salary) and Schedule 5 (rebate), each with
the form's own Bangla wording. Print / save as PDF, or copy as text.

**Share link:** "Copy share link" puts your inputs into the part of the URL
after `#`, which browsers never send to a server — the link itself is the
only copy. Anyone you give it to sees your figures. Links are validated when
opened, so an edited or broken link can't inject anything into the page.

## Develop

Needs Node.js 24 (LTS).

```bash
npm install
npm run dev        # local dev server with hot reload
npm test           # engine, share-link, text and form tests (Vitest)
npm run build      # type-check, build into dist/, then check every Mantine style the app uses is bundled
npm run preview    # serve dist/ locally (the service worker only runs in this production build)
```

## Project layout

| Path | What it holds |
|---|---|
| `src/engine/tax.ts` | The tax engine — rates per year (`RULES`), `calculateTax`, `returnSummary`. Pure functions, no React. |
| `src/engine/state.ts` | Share-link encode / decode (validates every field of an incoming link). |
| `src/i18n/` | English and Bangla text, Bangla digits, the language context. |
| `src/state/` | Form state and the `useCalculator` hook that turns it into a result. |
| `src/components/` | The Mantine UI: form sections, result panel, return summary. |
| `src/mantine-styles.ts` | The Mantine stylesheets the app imports — only what it uses, not the full bundle. |
| `scripts/check-css.mjs` | Build check: fails (and names the file to add) if a Mantine component is used without its stylesheet. |
| `pwa/` | The service worker template and the Vite plugin that fills in its file list and version at build time. |
| `public/` | Icons (SVG, ICO, Apple touch, 192/512 and maskable PNGs) and the web app manifest. |
| `tests/` | Vitest suites. |

## Test

`npm test` runs 100+ cases, including golden cases taken from the worked
examples in NBR's *Aykor Nirdeshika 2026-27* (pp. 56–57, 90–94).

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`: install, tests,
type-check and build must pass, then only the built site (`dist/`) is
published to GitHub Pages — source, tests and docs stay off the site.

## Updating for a new tax year

All year-specific numbers live in the `RULES` map in `src/engine/tax.ts`.
Add one `year(...)` entry; the year picker builds itself from `RULES`.

## Disclaimer

Estimates only — not tax advice. Verify against [NBR](https://nbr.gov.bd).
