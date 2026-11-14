// UI wiring for index.html. All math lives in tax.js — this file only
// reads the form, calls BDTax.calculateTax, and renders the result.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = BDTax.formatBDT;

  // ---- employers and their salary rows ----
  // All state is DOM-owned: each .employer card holds .salary-row rows
  // (input.amount, select.from, select.to) plus input.bonus and input.tds.
  const employersEl = $('employers');

  function monthOptions(selected) {
    return BDTax.MONTHS
      .map((m, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${m}</option>`)
      .join('');
  }

  function addRow(rowsEl, from = 0, to = 11) {
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

  function addEmployer(from = 0) {
    const card = document.createElement('fieldset');
    card.className = 'employer';
    card.innerHTML =
      `<legend></legend>
       <div class="rows"></div>
       <button type="button" class="add-row">+ Salary change</button>
       <label class="field">Bonus
         <span class="hint">festival + performance bonuses from this employer</span>
         <input type="number" min="0" placeholder="0" class="bonus">
       </label>
       <label class="field">Tax deducted so far (TDS)
         <span class="hint">total this employer has withheld this year up to now</span>
         <input type="number" min="0" placeholder="0" class="tds">
       </label>
       <button type="button" class="remove-employer">Remove this employer</button>`;
    const rowsEl = card.querySelector('.rows');
    card.querySelector('.add-row').addEventListener('click', () => { addRow(rowsEl); recalc(); });
    card.querySelector('.remove-employer').addEventListener('click', () => {
      card.remove(); renumberEmployers(); recalc();
    });
    addRow(rowsEl, from, 11);
    employersEl.appendChild(card);
    renumberEmployers();
    return card;
  }

  // Legends read "Employer 1, 2…" only when there is more than one job.
  function renumberEmployers() {
    const cards = [...employersEl.querySelectorAll('.employer')];
    cards.forEach((card, i) => {
      card.querySelector('legend').textContent = cards.length > 1 ? `Employer ${i + 1}` : 'Your employer';
      card.querySelector('.remove-employer').hidden = cards.length === 1;
    });
  }

  function readEmployers() {
    return [...employersEl.querySelectorAll('.employer')].map(card => ({
      salaryPeriods: [...card.querySelectorAll('.salary-row')].map(row => ({
        monthlyAmount: row.querySelector('.amount').value,
        fromMonth: Number(row.querySelector('.from').value),
        toMonth: Number(row.querySelector('.to').value)
      })),
      bonus: card.querySelector('.bonus').value,
      tds: card.querySelector('.tds').value
    }));
  }

  // A new employer usually starts the month after the last one's salary ends.
  function nextEmployerStart(employers) {
    const paid = employers.flatMap(e => e.salaryPeriods)
      .filter(p => Number(p.monthlyAmount) > 0 && p.toMonth >= p.fromMonth).map(p => p.toMonth);
    return paid.length && Math.max(...paid) < 11 ? Math.max(...paid) + 1 : 0;
  }

  // Warn on from>to rows and months counted twice; gaps are fine (mid-year joiners).
  function salaryWarnings(employers) {
    const msgs = [];
    const many = employers.length > 1;
    const byEmployer = employers.map((e, n) => {
      const counts = new Array(12).fill(0);
      for (const p of e.salaryPeriods) {
        if (p.toMonth < p.fromMonth) {
          msgs.push(`${many ? `Employer ${n + 1}: ` : ''}"${BDTax.MONTHS[p.fromMonth]}–${BDTax.MONTHS[p.toMonth]}" ` +
            'is invalid (start is after end) — row ignored.');
        } else if (Number(p.monthlyAmount) > 0) {
          for (let m = p.fromMonth; m <= p.toMonth; m++) counts[m]++;
        }
      }
      const dup = BDTax.MONTHS.filter((_, i) => counts[i] > 1);
      if (dup.length) msgs.push(`${many ? `Employer ${n + 1}: ` : ''}${dup.join(', ')} counted in more than one period — both amounts are added.`);
      return counts;
    });
    const shared = BDTax.MONTHS.filter((_, i) => byEmployer.filter(c => c[i] > 0).length > 1);
    if (shared.length) msgs.push(`${shared.join(', ')} paid by more than one employer — both salaries are counted.`);
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
      employers: readEmployers(),
      otherIncomes: {
        bankInterest: { amount: $('bankInterest').value, tds: $('bankTds').value },
        savingsInterest: { amount: $('savingsInterest').value, tds: $('savingsTds').value },
        other: { amount: $('otherIncome').value }
      },
      advanceTax: $('advanceTax').value,
      investments: readInvestments(),
      nextMonth: Number($('nextMonth').value)
    };
  }

  // ---- itemized investments, built from the engine's item list ----
  // The first four are the common ones; the rest sit behind "More types".
  const COMMON_ITEMS = 4;
  function fillInvestments() {
    const field = item => `<label class="field">${item.label}` +
      (item.cap ? `<span class="hint">counts up to ${fmt(item.cap)}</span>` : '') +
      `<input type="number" min="0" placeholder="0" data-key="${item.key}">` +
      `<span class="cap-warn" data-warn="${item.key}"></span></label>`;
    const items = BDTax.RULES[BDTax.YEARS[0]].investmentItems;
    $('investments').innerHTML = items.slice(0, COMMON_ITEMS).map(field).join('') +
      `<details><summary>More investment types (shares, funds, pension, donations…)</summary>` +
      items.slice(COMMON_ITEMS).map(field).join('') + '</details>';
  }

  function readInvestments() {
    const out = {};
    for (const input of $('investments').querySelectorAll('input[data-key]')) out[input.dataset.key] = input.value;
    return out;
  }

  // Per-item "only ৳X counts" notes and the eligible total.
  function renderInvestments(result) {
    for (const item of result.investmentItems) {
      $('investments').querySelector(`[data-warn="${item.key}"]`).textContent = item.capped
        ? `Only ${fmt(item.allowed)} of this counts toward the rebate.` : '';
    }
    $('investmentTotal').textContent = result.investmentEntered === 0 ? ''
      : `Eligible investment: ${fmt(result.investment)}` + (result.investment < result.investmentEntered
        ? ` (of ${fmt(result.investmentEntered)} entered — amounts above the limits don't count)` : '');
  }

  // Next-month picker: follows the chosen year (from today's date) until the
  // user picks a month themselves.
  let nextMonthTouched = false;
  function fillNextMonth() {
    $('nextMonth').innerHTML = BDTax.MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('') +
      '<option value="12">Year is over — all salary paid</option>';
    $('nextMonth').addEventListener('change', () => { nextMonthTouched = true; });
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

  const OTHER_INCOME_LABELS = {
    bankInterest: 'Bank interest', savingsInterest: 'Savings certificate profit', other: 'Other income'
  };

  function line(lbl, amt, sub) {
    return `<div class="bd-line"><span class="lbl">${lbl}${sub ? `<small>${sub}</small>` : ''}</span>
            <span class="amt">${amt}</span></div>`;
  }

  function render(result) {
    let h = '<h2 class="bd-title">Your tax, step by step</h2>';
    const many = result.employers.length > 1;
    const perEmployer = key => result.employers.map((e, i) => `Employer ${i + 1} ${fmt(e[key])}`).join(' · ');
    h += line('Gross salary', fmt(result.grossSalary), [
      many ? perEmployer('gross') : '',
      result.bonus > 0 ? `includes ${fmt(result.bonus)} bonus` : ''].filter(Boolean).join('; '));
    h += line('− Tax-free part of salary', fmt(result.exemption),
      '⅓ of salary is tax-free (max ৳5,00,000)' + (many ? ' — once, on all jobs combined' : ''));
    for (const item of result.otherIncomeItems) {
      if (item.amount > 0) h += line(`+ ${OTHER_INCOME_LABELS[item.key]}`, fmt(item.amount), '');
    }
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
    h += line('<b>Annual tax</b>', `<b>${fmt(result.finalTax)}</b>`, result.minimumApplied
      ? `minimum tax — income above the tax-free limit pays at least ${fmt(result.minimumTax)}` : '');
    if (result.employerTds > 0) h += line(`− Deducted by ${many ? 'employers' : 'your office'} (TDS)`,
      fmt(result.employerTds), many ? perEmployer('tds') : '');
    if (result.sourceTds > 0) h += line('− Tax deducted on interest', fmt(result.sourceTds), '');
    if (result.advanceTax > 0) h += line('− Advance tax paid', fmt(result.advanceTax), '');
    h += `<div class="bd-tear"></div>`;
    const total = totalView(result);
    h += `<div class="bd-total${total.refund ? ' refund' : ''}">` +
      `<span>${total.label}</span><span class="amt">${total.amount}</span></div>`;
    h += renderPlan(result);
    $('breakdown').innerHTML = h;
  }

  // ---- monthly deduction plan ----
  // Headline + formula for every case the planner can be in.
  function planText(result) {
    const p = result.plan;
    const left = p.months.map((m, i) => m.status === 'planned' ? i : -1).filter(i => i >= 0);
    const span = left.length ? `${BDTax.MONTHS[left[0]]}–${BDTax.MONTHS[left[left.length - 1]]}` : '';
    if (result.finalTax === 0) return { head: 'No tax to deduct this year.' };
    if (result.refundable > 0) return { head: `Already over-deducted by ${fmt(result.refundable)} — ` +
      'nothing more to deduct; claim it in your return.' };
    if (p.remaining === 0) return { head: 'Fully deducted — nothing more this year.' };
    if (p.monthsLeft === 0) return { head: `No salary months left — pay ` +
      `<span class="amt">${fmt(p.payWithReturn)}</span> with your return.` };
    const many = result.employers.length > 1;
    return {
      head: `Your ${many ? 'current ' : ''}office should deduct <span class="amt">${fmt(p.perMonth)}</span> per month` +
        (p.monthsLeft < 12 ? `, ${span}` : ''),
      sub: result.tds > 0
        ? `(${fmt(result.finalTax)} annual tax − ${fmt(result.tds)} already ${result.tds > result.employerTds ? 'deducted or paid' : 'deducted'}${many && result.tds === result.employerTds ? ' by all employers' : ''}) ÷ ${p.monthsLeft} salary months left`
        : `${fmt(result.finalTax)} annual tax ÷ ${p.monthsLeft} salary months`
    };
  }

  function renderPlan(result) {
    const p = result.plan;
    if (result.grossSalary === 0 && result.finalTax === 0) return '';
    const t = planText(result);
    let h = `<div class="plan"><h2 class="bd-title">Monthly deduction</h2>` +
      `<p class="plan-head">${t.head}</p>` + (t.sub ? `<small class="plan-sub">${t.sub}</small>` : '');
    if (p.months.some(m => m.status !== 'none')) {
      h += '<div class="plan-grid">' + p.months.map((m, i) =>
        `<div class="plan-cell ${m.status}"><b>${BDTax.MONTHS[i]}</b>` +
        `<span>${m.status === 'planned' ? fmt(m.amount).slice(1) : m.status === 'deducted' ? 'done' : '—'}</span></div>`
      ).join('') + '</div>';
      h += '<div class="plan-key"><span><i style="background:#004d38"></i>deducted</span>' +
        '<span><i style="background:#e6f2ee"></i>still to deduct</span>' +
        '<span><i style="background:#f3f4f6"></i>no salary</span></div>';
    }
    return h + '</div>';
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
      parts.push(`Investing ${fmt(adv.tip.extraInvestment)} more` +
        (result.investmentItems.some(i => i.capped) ? ' (in something still under its limit)' : '') +
        ` would save ${fmt(adv.tip.saving)} in tax.`);
      parts.push(`With the full ${fmt(adv.targetInvestment)} invested, annual tax drops to ` +
        `${fmt(adv.taxIfMaxInvested)}` + (result.plan.monthsLeft > 0
          ? ` — ${fmt(adv.monthlyTdsIfMaxInvested)} per month for the rest of the year.` : '.'));
    }
    return parts.join(' ');
  }

  // ---- main loop ----
  function recalc() {
    if (!nextMonthTouched) $('nextMonth').value = BDTax.defaultNextMonth($('taxYear').value);
    const inputs = readInputs();
    $('salaryWarning').textContent = salaryWarnings(inputs.employers);
    const result = BDTax.calculateTax(inputs);
    render(result);
    renderInvestments(result);
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

  $('addEmployer').addEventListener('click', () => {
    addEmployer(nextEmployerStart(readEmployers()));
    recalc();
  });
  $('form').addEventListener('input', recalc);

  // Hide the mobile total bar while the real breakdown pane is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      $('stickyTotal').classList.toggle('pane-visible', entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe($('breakdown'));
  }

  fillYears();    // year picker, defaulting to the year most people want today
  fillNextMonth();
  fillInvestments();
  addEmployer();  // one employer with one full-year row
  recalc();       // initial render (all zeros)
})();
