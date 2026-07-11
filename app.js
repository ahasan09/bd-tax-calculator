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
      `<input type="number" min="0" placeholder="Monthly amount" class="amount"
              aria-label="Monthly salary amount">
       from <select class="from" aria-label="From month">${monthOptions(from)}</select>
       to <select class="to" aria-label="To month">${monthOptions(to)}</select>
       <button type="button" class="remove" aria-label="Remove period" title="Remove period">✖</button>`;
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
      toMonth: Number(row.querySelector('.to').value)
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

  function render(result) {
    const pct = x => (x * 100).toFixed(0) + '%';
    let h = '<h2 class="bd-title">Your tax, step by step</h2>';
    h += line('Gross salary', fmt(result.grossSalary),
      result.bonus > 0 ? `includes ${fmt(result.bonus)} bonus` : '');
    h += line('− Tax-free part of salary', fmt(result.exemption),
      '⅓ of salary is tax-free (max ৳5,00,000)');
    if (result.otherIncome > 0) h += line('+ Other income', fmt(result.otherIncome), '');
    h += `<div class="bd-rule"></div>`;
    h += line('<b>Taxable income</b>', `<b>${fmt(result.taxableIncome)}</b>`, '');
    h += `<div class="bd-rule"></div>`;
    result.slabs.forEach((s, i) => {
      h += line(i === 0 ? `First ${fmt(s.amount)} — tax-free` : `Next ${fmt(s.amount)} @ ${pct(s.rate)}`,
        fmt(s.tax));
    });
    h += line('<b>Tax before rebate</b>', `<b>${fmt(result.grossTax)}</b>`, '');
    if (result.rebate > 0) h += line('− Investment rebate', fmt(result.rebate),
      `lowest of ${pct(result.rules.rebate.incomeRate)} of income (${fmt(result.rebateBreakdown.byIncome)}), ` +
      `${pct(result.rules.rebate.investmentRate)} of investment (${fmt(result.rebateBreakdown.byInvestment)}), ` +
      `${fmt(result.rebateBreakdown.cap)}`);
    const annualSub = [];
    if (result.minimumApplied) annualSub.push(`minimum tax — income above the tax-free limit pays at least ${fmt(result.minimumTax)}`);
    if (result.finalTax > 0) annualSub.push(`your office deducts ≈ ${fmt(result.monthlyTds)} per month`);
    h += line('<b>Annual tax</b>', `<b>${fmt(result.finalTax)}</b>`, annualSub.join('; '));
    if (result.tds > 0) h += line('− Already deducted at office (TDS)', fmt(result.tds), '');
    h += `<div class="bd-tear"></div>`;
    if (result.refundable > 0) {
      h += `<div class="bd-total refund"><span>Refundable / adjustable</span><span class="amt">${fmt(result.refundable)}</span></div>`;
    } else {
      h += `<div class="bd-total"><span>Payable</span><span class="amt">${fmt(result.netPayable)}</span></div>`;
    }
    $('breakdown').innerHTML = h;
  }

  // Always-visible rebate formula with live numbers — quiet reference text.
  function investmentFormula(result) {
    const pct = x => (x * 100).toFixed(0) + '%';
    const rb = result.rules.rebate;
    return `Rebate = lowest of ${pct(rb.incomeRate)} of taxable income (${fmt(result.rebateBreakdown.byIncome)}), ` +
      `${pct(rb.investmentRate)} of investment (${fmt(result.rebateBreakdown.byInvestment)}), or ${fmt(rb.cap)} ` +
      `→ your rebate: ${fmt(result.rebate)}.`;
  }

  // Actionable advice only — how much to invest and what it saves.
  function investmentHint(result) {
    const parts = [];
    if (result.targetInvestment > 0) {
      parts.push(result.rebateBreakdown.byInvestment >= result.maxUsefulRebate
        ? `You've met the ${fmt(result.targetInvestment)} investment target — maximum rebate of ${fmt(result.maxUsefulRebate)} applied.`
        : `Investing ${fmt(result.targetInvestment)} in total earns the maximum rebate of ${fmt(result.maxUsefulRebate)}.`);
    }
    if (result.investmentTip) {
      parts.push(`Investing ${fmt(result.investmentTip.extraInvestment)} more would save ${fmt(result.investmentTip.saving)} in tax.`);
      parts.push(`With the full ${fmt(result.targetInvestment)} invested, annual tax drops to ` +
        `${fmt(result.taxIfMaxInvested)} — ≈ ${fmt(result.monthlyTdsIfMaxInvested)} per month from salary.`);
    }
    return parts.join(' ');
  }

  // ---- main loop ----
  function recalc() {
    const inputs = readInputs();
    $('salaryWarning').textContent = salaryWarnings(inputs.salaryPeriods);
    const result = BDTax.calculateTax(inputs);
    render(result);
    $('investmentFormula').textContent = investmentFormula(result);
    $('investmentHint').textContent = investmentHint(result);
    $('liveTotal').textContent = result.refundable > 0
      ? `Refundable ${fmt(result.refundable)}`
      : `Payable ${fmt(result.netPayable)}`;
    const bar = $('stickyTotal');
    const refund = result.refundable > 0;
    bar.classList.toggle('refund', refund);
    bar.querySelector('.lbl').textContent = refund ? 'Refundable' : 'Payable';
    bar.querySelector('.amt').textContent = fmt(refund ? result.refundable : result.netPayable);
    $('footerBasis').textContent = `${result.rules.label} rules per ${result.rules.basis}. ` +
      (result.rules.note ? `${result.rules.note}. ` : '');
  }

  $('addRow').addEventListener('click', () => { addRow(); recalc(); });
  $('form').addEventListener('input', recalc);

  // Hide the mobile total bar while the real breakdown pane is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      $('stickyTotal').classList.toggle('pane-visible', entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe($('breakdown'));
  }

  addRow();       // start with one full-year row
  recalc();       // initial render (all zeros)
})();
