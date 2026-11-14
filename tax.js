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

  // Investments eligible for the §78 rebate, per NBR Aykor Nirdeshika
  // 2026-27 ("কর রেয়াতযোগ্য বিনিয়োগের সারণী", pp. 12–13). Only two items
  // carry a stated limit there. Most-used items first: the UI shows the
  // first four up front.
  const INVESTMENT_ITEMS = [
    { key: 'providentFund', label: 'Provident fund — your and your employer\'s contribution' },
    { key: 'dps', label: 'DPS / monthly savings scheme', cap: 120000 },
    { key: 'govtSecurities', label: 'Savings certificates (সঞ্চয়পত্র) & other government securities', cap: 500000 },
    { key: 'lifeInsurance', label: 'Life insurance premium / deferred annuity' },
    { key: 'listedShares', label: 'Listed shares — new investment' },
    { key: 'funds', label: 'Mutual funds, unit certificates, ETFs — new investment' },
    { key: 'universalPension', label: 'Universal pension scheme (সর্বজনীন পেনশন)' },
    { key: 'pensionFund', label: 'Approved superannuation / pension fund' },
    { key: 'donations', label: 'Donations: zakat fund, charitable hospital, disability or approved institutions' },
    { key: 'welfareFund', label: 'Welfare fund / group insurance fund' },
    { key: 'other', label: 'Other eligible investment' }
  ];

  // Kinds of non-salary income the form asks for, in display order.
  // (rent and agriculture are entered after their own allowed expenses.)
  const OTHER_INCOME_KEYS = ['bankInterest', 'savingsInterest', 'rent', 'agriculture', 'other'];

  const COMMON = {
    source: SOURCE,
    investmentItems: INVESTMENT_ITEMS,
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

  // One employer's pay for the year: salary rows (rows with from > to are
  // ignored), bonus, and the tax it deducted.
  function employment(e) {
    const validPeriods = (e.salaryPeriods || []).filter(p => Number(p.toMonth) >= Number(p.fromMonth));
    const salary = Math.round(validPeriods.reduce((s, p) =>
      s + toNonNegativeAmount(p.monthlyAmount) * (Number(p.toMonth) - Number(p.fromMonth) + 1), 0));
    const bonus = Math.round(toNonNegativeAmount(e.bonus));
    return { validPeriods, salary, bonus, gross: salary + bonus,
      tds: Math.round(toNonNegativeAmount(e.tds)) };
  }

  function calculateTax(inputs) {
    const rules = RULES[inputs.taxYear] || RULES[defaultYear()];

    // One entry per employer this year. Older callers pass salaryPeriods /
    // bonus / tds at the top level — that is a single employer.
    const employers = (inputs.employers ||
      [{ salaryPeriods: inputs.salaryPeriods, bonus: inputs.bonus, tds: inputs.tds }]).map(employment);
    const validPeriods = employers.flatMap(e => e.validPeriods);
    const sum = key => employers.reduce((s, e) => s + e[key], 0);
    const salaryFromPeriods = sum('salary');
    const bonus = sum('bonus');
    // Employment income is pooled across employers: the exemption cap below
    // applies once per person, not once per job.
    const grossSalary = salaryFromPeriods + bonus;
    const exemption = Math.round(
      Math.min(grossSalary * rules.salaryExemption.fraction, rules.salaryExemption.cap));
    // Non-salary income by source, each with any tax deducted at source on it.
    // Interest (bank and savings certificates) is taxed in the normal slabs
    // and its TDS is a credit — NBR Aykor Nirdeshika 2026-27, examples ক/খ.
    // Older callers pass one `otherIncome` total, treated as "other".
    const enteredOther = inputs.otherIncomes || { other: { amount: inputs.otherIncome } };
    const otherIncomeItems = OTHER_INCOME_KEYS.map(key => {
      const e = enteredOther[key] || {};
      return { key, amount: Math.round(toNonNegativeAmount(e.amount)), tds: Math.round(toNonNegativeAmount(e.tds)) };
    });
    const otherIncome = otherIncomeItems.reduce((s, i) => s + i.amount, 0);
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

    // Each item counts up to its legal limit. Older callers pass one total
    // in `investment`, treated as "other".
    const entered = inputs.investments || { other: inputs.investment };
    const investmentItems = rules.investmentItems.map(({ key, cap }) => {
      const amount = Math.round(toNonNegativeAmount(entered[key]));
      const allowed = cap === undefined ? amount : Math.min(amount, cap);
      return { key, amount, allowed, capped: allowed < amount };
    });
    const investmentEntered = investmentItems.reduce((s, i) => s + i.amount, 0);
    const investment = investmentItems.reduce((s, i) => s + i.allowed, 0);
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
    // Every tax already paid this year counts against the bill: employers'
    // TDS, TDS on other income, and advance tax.
    const employerTds = sum('tds');
    const sourceTds = otherIncomeItems.reduce((s, i) => s + i.tds, 0);
    const advanceTax = Math.round(toNonNegativeAmount(inputs.advanceTax));
    const tds = employerTds + sourceTds + advanceTax;
    // Months 0..11 in which any salary is paid — an employer can only deduct then.
    const salaryMonths = MONTHS.map((_, m) => validPeriods.some(p =>
      toNonNegativeAmount(p.monthlyAmount) > 0 && m >= Number(p.fromMonth) && m <= Number(p.toMonth)));
    const nextMonth = Math.min(Math.max(Math.floor(Number(inputs.nextMonth) || 0), 0), 12);
    const plan = planDeductions(finalTax, tds, salaryMonths, nextMonth);

    // Annual tax if the full target investment were made, and the monthly
    // deduction that would follow from it.
    const taxIfMaxInvested = aboveThreshold
      ? Math.max(grossTax - maxUsefulRebate, minimumTax) : 0;
    const investmentAdvice = {
      maxUsefulRebate, targetInvestment, tip,
      taxIfMaxInvested,
      monthlyTdsIfMaxInvested: planDeductions(taxIfMaxInvested, tds, salaryMonths, nextMonth).perMonth
    };

    return { rules, salaryFromPeriods, bonus, grossSalary, exemption, otherIncome, otherIncomeItems,
      employerTds, sourceTds, advanceTax,
      taxableIncome, threshold, slabs, grossTax,
      investmentItems, investmentEntered, investment, rebateBreakdown, rebate, taxAfterRebate, minimumTax, minimumApplied, finalTax,
      plan, investmentAdvice, tds,
      employers: employers.map(({ salary, bonus, gross, tds }) => ({ salary, bonus, gross, tds })),
      netPayable: Math.max(finalTax - tds, 0),
      refundable: Math.max(tds - finalTax, 0) };
  }

  // The figures in the order the individual return (IT-11GA 2023) asks for
  // them — "মোট আয়ের বিবরণী" serials 1–11, "কর পরিগণনা" 12–19, "কর পরিশোধ
  // বিবরণ" 20–26 — plus Schedule 1 (salary) and Schedule 5 (rebate). Serials
  // this calculator doesn't cover (business, capital gains, surcharge…) are
  // left out rather than shown as zero.
  function returnSummary(result) {
    const other = key => result.otherIncomeItems.find(i => i.key === key).amount;
    const employment = result.grossSalary - result.exemption;
    const sourceAndEmployerTds = result.employerTds + result.sourceTds;
    const row = (serial, key, amount) => ({ serial, key, amount });
    return {
      income: [
        row(1, 'employment', employment),
        row(2, 'rent', other('rent')),
        row(3, 'agriculture', other('agriculture')),
        row(6, 'financialAssets', other('bankInterest') + other('savingsInterest')),
        row(7, 'otherSources', other('other')),
        row(11, 'totalIncome', result.taxableIncome)
      ],
      tax: [
        row(12, 'taxOnIncome', result.grossTax),
        row(13, 'rebate', result.rebate),
        row(14, 'afterRebate', result.taxAfterRebate),
        row(15, 'minimumTax', result.minimumTax),
        row(16, 'payableTax', result.finalTax),
        row(19, 'totalPayable', result.finalTax)
      ],
      payment: [
        row(20, 'deductedAtSource', sourceAndEmployerTds),
        row(21, 'advanceTax', result.advanceTax),
        row(23, 'paidWithReturn', result.netPayable),
        row(24, 'totalPaid', sourceAndEmployerTds + result.advanceTax + result.netPayable),
        row(25, 'excessPayment', result.refundable),
        row(26, 'exemptIncome', result.exemption)
      ],
      schedule1: { gross: result.grossSalary, exempt: result.exemption, taxable: employment },
      schedule5: {
        items: result.investmentItems.filter(i => i.allowed > 0).map(i => ({ key: i.key, amount: i.allowed })),
        total: result.investment,
        rebate: result.rebate
      }
    };
  }

  // What the employer still has to deduct, spread evenly over the salary
  // months from `nextMonth` on (rounded up so the plan never falls short).
  // Months before `nextMonth` are already deducted; their split is unknown.
  function planDeductions(annualTax, deducted, salaryMonths, nextMonth) {
    const remaining = Math.max(annualTax - deducted, 0);
    const monthsLeft = salaryMonths.filter((paid, m) => paid && m >= nextMonth).length;
    const perMonth = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : 0;
    const months = salaryMonths.map((paid, m) => !paid ? { status: 'none', amount: 0 }
      : m < nextMonth ? { status: 'deducted', amount: 0 }
      : { status: 'planned', amount: perMonth });
    return { nextMonth, remaining, monthsLeft, perMonth, months,
      payWithReturn: monthsLeft > 0 ? 0 : remaining };
  }

  // Month index (0 = July … 11 = June, 12 = year over) of the next salary
  // deduction for a year, as of `date`.
  function defaultNextMonth(key, date = new Date()) {
    const status = yearStatus(key, date);
    if (status === 'planning') return 0;
    if (status === 'current') return (date.getMonth() + 6) % 12;
    return 12;
  }

  return { RULES, YEARS, MONTHS, formatBDT, calculateTax, returnSummary, yearStatus, defaultYear, defaultNextMonth };
})();
