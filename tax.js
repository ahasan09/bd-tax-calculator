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
