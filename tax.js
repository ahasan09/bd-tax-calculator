// Bangladesh personal income tax engine.
// Pure data + functions — no DOM access. Loaded by index.html and tests.html.
const BDTax = (() => {
  'use strict';

  // Fiscal-year month order; index 0 = July … 11 = June.
  const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  // Source for every figure below: Finance Act 2026, Schedule 2, as explained
  // in NBR's Income Tax Paripatra 2026-27 (§1.1–1.3 rates, §32 rebate). The
  // Act states rates per ASSESSMENT year; keys here are INCOME years
  // (income year Y-(Y+1) is assessed in AY (Y+1)-(Y+2)).
  const SOURCE = 'Finance Act 2026 · NBR Income Tax Paripatra 2026-27';

  // Tax-free thresholds: general, woman & 65+, third gender & disability,
  // war-wounded freedom fighter & July Warrior.
  function thresholds(general, womanSenior, thirdGenderDisabled, freedomFighterJuly) {
    return {
      general,
      woman: womanSenior,
      senior: womanSenior,
      thirdGender: thirdGenderDisabled,
      disabled: thirdGenderDisabled,
      freedomFighter: freedomFighterJuly,
      julyWarrior: freedomFighterJuly
    };
  }

  // Bands above the threshold. From AY 2028-29 a 30% band of fixed size is
  // followed by 35% — sized so 35% starts at ৳3 crore of total income.
  const BASE_BANDS = [
    { size: 300000, rate: 0.10 },
    { size: 400000, rate: 0.15 },
    { size: 500000, rate: 0.20 },
    { size: 2000000, rate: 0.25 }
  ];
  const slabs = thirtyBand => thirtyBand === Infinity
    ? [...BASE_BANDS, { size: Infinity, rate: 0.30 }]
    : [...BASE_BANDS, { size: thirtyBand, rate: 0.30 }, { size: Infinity, rate: 0.35 }];

  const COMMON = {
    source: SOURCE,
    dependentBonus: 50000,                                // per disabled child/ward
    salaryExemption: { fraction: 1 / 3, cap: 500000 },    // ITA 2023 — unchanged
    minimumTax: { regular: 5000, firstTime: 1000 },
    rebate: { incomeRate: 0.03, investmentRate: 0.10, cap: 750000 }  // §78, from AY 2026-27
  };

  function year(incomeYear, assessmentYear, t, thirtyBand) {
    return { ...COMMON, label: `Income year ${incomeYear} (AY ${assessmentYear})`,
      incomeYear, assessmentYear, thresholds: t, slabs: slabs(thirtyBand) };
  }

  const RULES = {
    '2025-26': year('2025-26', '2026-27', thresholds(400000, 450000, 525000, 550000), Infinity),
    '2026-27': year('2026-27', '2027-28', thresholds(400000, 450000, 525000, 550000), Infinity),
    '2027-28': year('2027-28', '2028-29', thresholds(450000, 500000, 575000, 600000), 26350000),
    '2028-29': year('2028-29', '2029-30', thresholds(450000, 500000, 575000, 600000), 26350000),
    '2029-30': year('2029-30', '2030-31', thresholds(500000, 550000, 625000, 650000), 26300000)
  };
  const YEARS = Object.keys(RULES).sort();

  // ---- which year is which, relative to a date ----
  // Income year Y-(Y+1) runs July Y – June Y+1; its return is filed
  // July–November of Y+1.
  const startOf = key => parseInt(key, 10);
  const currentStart = date => date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  const inFilingSeason = date => date.getMonth() >= 6 && date.getMonth() <= 10;

  // 'filing' | 'current' | 'planning' | 'past'
  function yearStatus(key, date = new Date()) {
    const s = startOf(key), cur = currentStart(date);
    if (s === cur) return 'current';
    if (s > cur) return 'planning';
    return s === cur - 1 && inFilingSeason(date) ? 'filing' : 'past';
  }

  // The year a visitor most likely wants: the filing year during filing
  // season, else the running year, else the nearest year we have rules for.
  function defaultYear(date = new Date()) {
    const filing = YEARS.find(k => yearStatus(k, date) === 'filing');
    if (filing) return filing;
    const current = YEARS.find(k => yearStatus(k, date) === 'current');
    if (current) return current;
    return startOf(YEARS[0]) > currentStart(date) ? YEARS[0] : YEARS[YEARS.length - 1];
  }

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
    const rules = RULES[inputs.taxYear] || RULES[defaultYear()];

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

  return { RULES, YEARS, MONTHS, formatBDT, calculateTax, yearStatus, defaultYear };
})();
