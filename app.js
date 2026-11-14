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

  // ---- tax year picker, built from the engine's RULES ----
  const YEAR_STATUS = {
    filing: { tag: 'filing now', hint: 'Return for this year is filed July–November.' },
    current: { tag: 'this year', hint: 'The year running now — use it to plan your monthly deduction.' },
    planning: { tag: 'planning', hint: 'Rates already set by Finance Act 2026 — a future budget may still change them.' },
    past: { tag: 'past', hint: 'Filing season for this year has ended.' }
  };

  function fillYears() {
    const sel = $('taxYear');
    sel.innerHTML = BDTax.YEARS.map(y => {
      const r = BDTax.RULES[y];
      return `<option value="${y}">${r.incomeYear} (AY ${r.assessmentYear}) — ${YEAR_STATUS[BDTax.yearStatus(y)].tag}</option>`;
    }).join('');
    sel.value = BDTax.defaultYear();
  }

  // ---- read form → engine input ----
  function readInputs() {
    return {
      taxYear: $('taxYear').value,
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
  const pct = x => (x * 100).toFixed(0) + '%';

  // "3% of taxable income (৳X), 10% of investment (৳Y), or ৳7,50,000" —
  // shared by the pane's rebate line and the investment-field formula.
  function rebateCandidatesText(result) {
    const rb = result.rules.rebate;
    return `${pct(rb.incomeRate)} of taxable income (${fmt(result.rebateBreakdown.byIncome)}), ` +
      `${pct(rb.investmentRate)} of investment (${fmt(result.rebateBreakdown.byInvestment)}), ` +
      `or ${fmt(rb.cap)}`;
  }

  function line(lbl, amt, sub) {
    return `<div class="bd-line"><span class="lbl">${lbl}${sub ? `<small>${sub}</small>` : ''}</span>
            <span class="amt">${amt}</span></div>`;
  }

  function render(result) {
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
      `lowest of ${rebateCandidatesText(result)}`);
    const annualSub = [];
    if (result.minimumApplied) annualSub.push(`minimum tax — income above the tax-free limit pays at least ${fmt(result.minimumTax)}`);
    if (result.finalTax > 0) annualSub.push(`your office deducts ≈ ${fmt(result.monthlyTds)} per month`);
    h += line('<b>Annual tax</b>', `<b>${fmt(result.finalTax)}</b>`, annualSub.join('; '));
    if (result.tds > 0) h += line('− Already deducted at office (TDS)', fmt(result.tds), '');
    h += `<div class="bd-tear"></div>`;
    const total = totalView(result);
    h += `<div class="bd-total${total.refund ? ' refund' : ''}">` +
      `<span>${total.label}</span><span class="amt">${total.amount}</span></div>`;
    $('breakdown').innerHTML = h;
  }

  // One place decides how the bottom line reads — pane, live region, and bar.
  function totalView(result) {
    const refund = result.refundable > 0;
    return {
      refund,
      label: refund ? 'Refundable / adjustable' : 'Payable',
      shortLabel: refund ? 'Refundable' : 'Payable',
      amount: fmt(refund ? result.refundable : result.netPayable)
    };
  }

  // Always-visible rebate formula with live numbers — quiet reference text.
  function investmentFormula(result) {
    return `Rebate = lowest of ${rebateCandidatesText(result)} → your rebate: ${fmt(result.rebate)}.`;
  }

  // Actionable advice only — how much to invest and what it saves.
  function investmentHint(result) {
    const adv = result.investmentAdvice;
    const parts = [];
    if (adv.targetInvestment > 0) {
      parts.push(result.rebateBreakdown.byInvestment >= adv.maxUsefulRebate
        ? `You've met the ${fmt(adv.targetInvestment)} investment target — maximum rebate of ${fmt(adv.maxUsefulRebate)} applied.`
        : `Investing ${fmt(adv.targetInvestment)} in total earns the maximum rebate of ${fmt(adv.maxUsefulRebate)}.`);
    }
    if (adv.tip) {
      parts.push(`Investing ${fmt(adv.tip.extraInvestment)} more would save ${fmt(adv.tip.saving)} in tax.`);
      parts.push(`With the full ${fmt(adv.targetInvestment)} invested, annual tax drops to ` +
        `${fmt(adv.taxIfMaxInvested)} — ≈ ${fmt(adv.monthlyTdsIfMaxInvested)} per month from salary.`);
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
    const total = totalView(result);
    $('liveTotal').textContent = `${total.shortLabel} ${total.amount}`;
    const bar = $('stickyTotal');
    bar.classList.toggle('refund', total.refund);
    bar.querySelector('.lbl').textContent = total.shortLabel;
    bar.querySelector('.amt').textContent = total.amount;
    $('yearHint').textContent = YEAR_STATUS[BDTax.yearStatus(inputs.taxYear)].hint;
    $('footerBasis').textContent = `${result.rules.label} rules per ${result.rules.source}.`;
  }

  $('addRow').addEventListener('click', () => { addRow(); recalc(); });
  $('form').addEventListener('input', recalc);

  // Hide the mobile total bar while the real breakdown pane is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      $('stickyTotal').classList.toggle('pane-visible', entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe($('breakdown'));
  }

  fillYears();    // year picker, defaulting to the year most people want today
  addRow();       // start with one full-year row
  recalc();       // initial render (all zeros)
})();
