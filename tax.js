// Bangladesh personal income tax engine.
// Pure data + functions — no DOM access. Loaded by index.html and tests.html.
const BDTax = (() => {
  'use strict';

  // Fiscal-year month order; index 0 = July … 11 = June.
  const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  // Shared between the two supported years (Finance Ordinance 2025 legislated
  // both; the Finance Bill 2026 rebate rule is applied to both years).
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
  // Finance Bill 2026 rebate rule, currently applied to both years.
  const REBATE = { incomeRate: 0.03, investmentRate: 0.10, cap: 750000 };

  const RULES = {
    '2025-26': {
      label: 'Income year 2025-26 (AY 2026-27)',
      basis: 'Finance Ordinance 2025',
      thresholds: THRESHOLDS,
      dependentBonus: DEPENDENT_BONUS,
      slabs: SLABS,
      salaryExemption: SALARY_EXEMPTION,
      // Owner's decision (2026-07-11): apply the Finance Bill 2026 rebate
      // to this year too. §78 ITA 2023 as consolidated on bdlaws reads
      // 15% / 1,000,000 for this filing year — replace REBATE with those
      // numbers here to revert. `note` is surfaced in the page footer.
      rebate: REBATE,
      note: 'Investment rebate applied at the Finance Bill 2026 rate (10%, max ৳7,50,000)',
      minimumTax: MINIMUM_TAX
    },
    '2026-27': {
      label: 'Income year 2026-27 (AY 2027-28)',
      basis: 'Finance Bill 2026',
      thresholds: THRESHOLDS,
      dependentBonus: DEPENDENT_BONUS,
      slabs: SLABS,
      salaryExemption: SALARY_EXEMPTION,
      rebate: REBATE,
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

  // Coerce any user-supplied value to a non-negative finite number.
  function toNonNegativeAmount(v) {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function calculateTax(inputs) {
    const rules = RULES[inputs.taxYear] || RULES['2025-26'];

    const validPeriods = (inputs.salaryPeriods || [])
      .filter(p => Number(p.toMonth) >= Number(p.fromMonth));
    const salaryFromPeriods = Math.round(validPeriods.reduce(
      (sum, p) => sum + toNonNegativeAmount(p.monthlyAmount) * (Number(p.toMonth) - Number(p.fromMonth) + 1), 0));

    const bonus = Math.round(toNonNegativeAmount(inputs.bonus));
    const grossSalary = salaryFromPeriods + bonus;
    const exemption = Math.round(
      Math.min(grossSalary * rules.salaryExemption.fraction, rules.salaryExemption.cap));
    const otherIncome = Math.round(toNonNegativeAmount(inputs.otherIncome));
    const taxableIncome = grossSalary - exemption + otherIncome;

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

    const investment = Math.round(toNonNegativeAmount(inputs.investment));
    const rebateBreakdown = {
      byIncome: Math.round(taxableIncome * rules.rebate.incomeRate),
      byInvestment: Math.round(investment * rules.rebate.investmentRate),
      cap: rules.rebate.cap
    };
    // The most rebate the non-investment limbs allow — income %, absolute cap,
    // and the tax itself (rebate never makes tax negative).
    const maxUsefulRebate = Math.min(rebateBreakdown.byIncome, rebateBreakdown.cap, grossTax);
    const rebate = Math.min(maxUsefulRebate, rebateBreakdown.byInvestment);
    const taxAfterRebate = grossTax - rebate;

    const aboveThreshold = taxableIncome > threshold;
    const minimumTax = aboveThreshold
      ? (inputs.isFirstTimeTaxpayer ? rules.minimumTax.firstTime : rules.minimumTax.regular)
      : 0;
    const finalTax = aboveThreshold ? Math.max(taxAfterRebate, minimumTax) : 0;
    const minimumApplied = aboveThreshold && finalTax > taxAfterRebate;

    // Everything the UI needs to advise on investing more, bundled together.
    const canRebateFromInvestment = rules.rebate.investmentRate > 0;
    // Total investment that earns the maximum rebate (0 when nothing to rebate).
    const targetInvestment = maxUsefulRebate > 0 && canRebateFromInvestment
      ? Math.ceil(maxUsefulRebate / rules.rebate.investmentRate) : 0;
    let tip = null;
    if (aboveThreshold && rebate < maxUsefulRebate && canRebateFromInvestment) {
      const saving = finalTax - Math.max(grossTax - maxUsefulRebate, minimumTax);
      if (saving > 0) {
        tip = {
          extraInvestment: Math.ceil((maxUsefulRebate - rebate) / rules.rebate.investmentRate),
          saving
        };
      }
    }
    // Annual tax if the full target investment were made, and its ÷12.
    const taxIfMaxInvested = aboveThreshold
      ? Math.max(grossTax - maxUsefulRebate, minimumTax) : 0;
    const investmentAdvice = {
      maxUsefulRebate, targetInvestment, tip,
      taxIfMaxInvested,
      monthlyTdsIfMaxInvested: Math.round(taxIfMaxInvested / 12)
    };

    // Approximate per-month salary deduction (annual tax ÷ 12).
    const monthlyTds = Math.round(finalTax / 12);

    const tds = Math.round(toNonNegativeAmount(inputs.tds));

    return { rules, salaryFromPeriods, bonus, grossSalary, exemption, otherIncome,
      taxableIncome, threshold, slabs, grossTax,
      rebateBreakdown, rebate, taxAfterRebate, minimumTax, minimumApplied, finalTax,
      monthlyTds, investmentAdvice, tds,
      netPayable: Math.max(finalTax - tds, 0),
      refundable: Math.max(tds - finalTax, 0) };
  }

  return { RULES, MONTHS, formatBDT, calculateTax };
})();
