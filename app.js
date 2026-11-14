// UI wiring for index.html. All math lives in tax.js, all text in i18n.js —
// this file reads the form, calls BDTax.calculateTax, and renders the result.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { t, money: fmt, pct, month, digits } = BDI18n;
  const num = v => BDI18n.toLatinDigits(v);   // typed text → engine number string

  // ---- language ----
  const LANG_KEY = 'bdtax.lang';
  function preferredLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (BDI18n.LANGS.includes(saved)) return saved;
    } catch (e) { /* storage blocked — fall through */ }
    return (navigator.languages || [navigator.language]).some(l => /^bn\b/i.test(l || '')) ? 'bn' : 'en';
  }

  // Static text marked up in index.html.
  function applyStaticText() {
    document.documentElement.lang = BDI18n.getLang();
    document.title = t('app.title');
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = digits(el.dataset.i18nPlaceholder);
    for (const b of document.querySelectorAll('.lang button')) b.setAttribute('aria-pressed', String(b.dataset.lang === BDI18n.getLang()));
    const rules = BDTax.RULES[BDTax.YEARS[0]];
    $('firstTimeHint').textContent = t('firstTime.hint', { low: fmt(rules.minimumTax.firstTime), high: fmt(rules.minimumTax.regular) });
    $('dependentsHint').textContent = t('dependents.hint', { amount: fmt(rules.dependentBonus) });
  }

  // ---- employers and their salary rows ----
  // All state is DOM-owned: each .employer card holds .salary-row rows
  // (input.amount, select.from, select.to) plus input.bonus and input.tds.
  const employersEl = $('employers');

  function monthOptions(selected) {
    return BDTax.MONTHS
      .map((m, i) => `<option value="${i}" ${i === selected ? 'selected' : ''}>${month(i)}</option>`)
      .join('');
  }

  function addRow(rowsEl, from = 0, to = 11) {
    const row = document.createElement('div');
    row.className = 'salary-row';
    // Word order differs: "from Jul to Jun" / "জুলাই থেকে জুন পর্যন্ত".
    const word = key => t(key) ? ` ${t(key)} ` : ' ';
    row.innerHTML =
      `<input type="text" inputmode="decimal" placeholder="${t('row.amount')}" class="amount num"
              aria-label="${t('row.amountAria')}">${word('row.pre')}<select class="from"
              aria-label="${t('row.fromAria')}">${monthOptions(from)}</select>${word('row.mid')}<select class="to"
              aria-label="${t('row.toAria')}">${monthOptions(to)}</select>${word('row.post')}<button type="button"
              class="remove" aria-label="${t('row.remove')}" title="${t('row.remove')}">✖</button>`;
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
       <button type="button" class="add-row">${t('employer.salaryChange')}</button>
       <label class="field">${t('employer.bonus')}
         <span class="hint">${t('employer.bonusHint')}</span>
         <input type="text" inputmode="decimal" placeholder="${digits('0')}" class="bonus num">
       </label>
       <label class="field">${t('employer.tds')}
         <span class="hint">${t('employer.tdsHint')}</span>
         <input type="text" inputmode="decimal" placeholder="${digits('0')}" class="tds num">
       </label>
       <button type="button" class="remove-employer">${t('employer.remove')}</button>`;
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
      card.querySelector('legend').textContent = cards.length > 1 ? t('employer.n', { n: digits(i + 1) }) : t('employer.one');
      card.querySelector('.remove-employer').hidden = cards.length === 1;
    });
  }

  function readEmployers() {
    return [...employersEl.querySelectorAll('.employer')].map(card => ({
      salaryPeriods: [...card.querySelectorAll('.salary-row')].map(row => ({
        monthlyAmount: num(row.querySelector('.amount').value),
        fromMonth: Number(row.querySelector('.from').value),
        toMonth: Number(row.querySelector('.to').value)
      })),
      bonus: num(card.querySelector('.bonus').value),
      tds: num(card.querySelector('.tds').value)
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
    const prefix = n => many ? t('warn.prefix', { n: digits(n + 1) }) : '';
    const monthList = idx => idx.map(month).join(', ');
    const byEmployer = employers.map((e, n) => {
      const counts = new Array(12).fill(0);
      for (const p of e.salaryPeriods) {
        if (p.toMonth < p.fromMonth) {
          msgs.push(prefix(n) + t('warn.invalid', { from: month(p.fromMonth), to: month(p.toMonth) }));
        } else if (Number(p.monthlyAmount) > 0) {
          for (let m = p.fromMonth; m <= p.toMonth; m++) counts[m]++;
        }
      }
      const dup = counts.map((c, i) => c > 1 ? i : -1).filter(i => i >= 0);
      if (dup.length) msgs.push(prefix(n) + t('warn.dup', { months: monthList(dup) }));
      return counts;
    });
    const shared = BDTax.MONTHS.map((_, i) => i).filter(i => byEmployer.filter(c => c[i] > 0).length > 1);
    if (shared.length) msgs.push(t('warn.shared', { months: monthList(shared) }));
    return msgs.join(' ');
  }

  // ---- tax year picker, built from the engine's RULES ----
  const yearName = r => t('year.name', { iy: digits(r.incomeYear), ay: digits(r.assessmentYear) });

  function fillYears() {
    const sel = $('taxYear');
    const keep = sel.value;
    sel.innerHTML = BDTax.YEARS.map(y => {
      const r = BDTax.RULES[y];
      const tag = t('year.tag.' + BDTax.yearStatus(y));
      return `<option value="${y}">${t('year.option', { iy: digits(r.incomeYear), ay: digits(r.assessmentYear), tag })}</option>`;
    }).join('');
    sel.value = keep || BDTax.defaultYear();
  }

  // ---- read form → engine input ----
  const val = id => num($(id).value);
  function readInputs() {
    return {
      taxYear: $('taxYear').value,
      category: $('category').value,
      isFirstTimeTaxpayer: $('firstTime').checked,
      disabledDependents: val('dependents'),
      employers: readEmployers(),
      otherIncomes: {
        bankInterest: { amount: val('bankInterest'), tds: val('bankTds') },
        savingsInterest: { amount: val('savingsInterest'), tds: val('savingsTds') },
        rent: { amount: val('rentIncome') },
        agriculture: { amount: val('agriIncome') },
        other: { amount: val('otherIncome') }
      },
      advanceTax: val('advanceTax'),
      investments: readInvestments(),
      nextMonth: Number($('nextMonth').value)
    };
  }

  // ---- itemized investments, built from the engine's item list ----
  // The first four are the common ones; the rest sit behind "More types".
  const COMMON_ITEMS = 4;
  const investmentItems = () => BDTax.RULES[BDTax.YEARS[0]].investmentItems;
  function fillInvestments() {
    const field = item => `<label class="field">${t('invest.' + item.key)}` +
      (item.cap ? `<span class="hint">${t('invest.capHint', { cap: fmt(item.cap) })}</span>` : '') +
      `<input type="text" inputmode="decimal" placeholder="${digits('0')}" class="num" data-key="${item.key}">` +
      `<span class="cap-warn" data-warn="${item.key}"></span></label>`;
    const items = investmentItems();
    $('investments').innerHTML = items.slice(0, COMMON_ITEMS).map(field).join('') +
      `<details><summary>${t('invest.more')}</summary>` +
      items.slice(COMMON_ITEMS).map(field).join('') + '</details>';
  }

  function readInvestments() {
    const out = {};
    for (const input of $('investments').querySelectorAll('input[data-key]')) out[input.dataset.key] = num(input.value);
    return out;
  }

  // Per-item "only ৳X counts" notes and the eligible total.
  function renderInvestments(result) {
    for (const item of result.investmentItems) {
      $('investments').querySelector(`[data-warn="${item.key}"]`).textContent = item.capped
        ? t('invest.capWarn', { amount: fmt(item.allowed) }) : '';
    }
    $('investmentTotal').textContent = result.investmentEntered === 0 ? ''
      : t('invest.total', { amount: fmt(result.investment) }) + (result.investment < result.investmentEntered
        ? t('invest.totalOf', { entered: fmt(result.investmentEntered) }) : '');
  }

  // Next-month picker: follows the chosen year (from today's date) until the
  // user picks a month themselves.
  let nextMonthTouched = false;
  function fillNextMonth() {
    const sel = $('nextMonth');
    const keep = sel.value;
    sel.innerHTML = BDTax.MONTHS.map((m, i) => `<option value="${i}">${month(i)}</option>`).join('') +
      `<option value="12">${t('monthly.yearOver')}</option>`;
    if (keep !== '') sel.value = keep;
  }

  // ---- render breakdown pane ----
  // "3% of taxable income (৳X), 10% of investment (৳Y), or ৳7,50,000" —
  // shared by the pane's rebate line and the investment-field formula.
  function rebateCandidatesText(result) {
    const rb = result.rules.rebate;
    return t('invest.candidates', { ir: pct(rb.incomeRate), a: fmt(result.rebateBreakdown.byIncome),
      vr: pct(rb.investmentRate), b: fmt(result.rebateBreakdown.byInvestment), cap: fmt(rb.cap) });
  }

  function line(lbl, amt, sub) {
    return `<div class="bd-line"><span class="lbl">${lbl}${sub ? `<small>${sub}</small>` : ''}</span>
            <span class="amt">${amt}</span></div>`;
  }

  function render(result) {
    let h = `<h2 class="bd-title">${t('bd.title')}</h2>`;
    const many = result.employers.length > 1;
    const perEmployer = key => result.employers.map((e, i) => t('bd.employerAmt', { n: digits(i + 1), amount: fmt(e[key]) })).join(' · ');
    h += line(t('bd.gross'), fmt(result.grossSalary), [
      many ? perEmployer('gross') : '',
      result.bonus > 0 ? t('bd.includesBonus', { amount: fmt(result.bonus) }) : ''].filter(Boolean).join('; '));
    h += line(t('bd.taxFree'), fmt(result.exemption),
      t('bd.taxFreeSub', { cap: fmt(result.rules.salaryExemption.cap) }) + (many ? t('bd.taxFreeCombined') : ''));
    for (const item of result.otherIncomeItems) {
      if (item.amount > 0) h += line(`+ ${t('bd.inc.' + item.key)}`, fmt(item.amount), '');
    }
    h += `<div class="bd-rule"></div>`;
    h += line(`<b>${t('bd.taxable')}</b>`, `<b>${fmt(result.taxableIncome)}</b>`, '');
    h += `<div class="bd-rule"></div>`;
    result.slabs.forEach((s, i) => {
      h += line(i === 0 ? t('bd.slabFirst', { amount: fmt(s.amount) }) : t('bd.slabNext', { amount: fmt(s.amount), rate: pct(s.rate) }),
        fmt(s.tax));
    });
    h += line(`<b>${t('bd.beforeRebate')}</b>`, `<b>${fmt(result.grossTax)}</b>`, '');
    if (result.rebate > 0) h += line(t('bd.rebate'), fmt(result.rebate), t('bd.rebateSub', { list: rebateCandidatesText(result) }));
    h += line(`<b>${t('bd.annual')}</b>`, `<b>${fmt(result.finalTax)}</b>`, result.minimumApplied
      ? t('bd.minimumSub', { amount: fmt(result.minimumTax) }) : '');
    if (result.employerTds > 0) h += line(t(many ? 'bd.byEmployers' : 'bd.byOffice'),
      fmt(result.employerTds), many ? perEmployer('tds') : '');
    if (result.sourceTds > 0) h += line(t('bd.onInterest'), fmt(result.sourceTds), '');
    if (result.advanceTax > 0) h += line(t('bd.advance'), fmt(result.advanceTax), '');
    h += `<div class="bd-tear"></div>`;
    const total = totalView(result);
    h += `<div class="bd-total${total.refund ? ' refund' : ''}">` +
      `<span>${total.label}</span><span class="amt">${total.amount}</span></div>`;
    h += renderPlan(result);
    $('breakdownBody').innerHTML = h;
  }

  // ---- monthly deduction plan ----
  // Headline + formula for every case the planner can be in.
  function planText(result) {
    const p = result.plan;
    const amt = n => `<span class="amt">${fmt(n)}</span>`;
    const left = p.months.map((m, i) => m.status === 'planned' ? i : -1).filter(i => i >= 0);
    if (result.finalTax === 0) return { head: t('plan.noTax') };
    if (result.refundable > 0) return { head: t('plan.over', { amount: fmt(result.refundable) }) };
    if (p.remaining === 0) return { head: t('plan.full') };
    if (p.monthsLeft === 0) return { head: t('plan.payWithReturn', { amount: amt(p.payWithReturn) }) };
    const many = result.employers.length > 1;
    const span = p.monthsLeft < 12 ? t('plan.span', { range: `${month(left[0])}–${month(left[left.length - 1])}` }) : '';
    const how = result.tds > result.employerTds ? 'plan.how.paid'
      : many ? 'plan.how.allEmployers' : 'plan.how.deducted';
    return {
      head: t(many ? 'plan.perMonthCurrent' : 'plan.perMonth', { amount: amt(p.perMonth), span }),
      sub: result.tds > 0
        ? t('plan.subPaid', { annual: fmt(result.finalTax), paid: fmt(result.tds), how: t(how), n: digits(p.monthsLeft) })
        : t('plan.subFull', { annual: fmt(result.finalTax), n: digits(p.monthsLeft) })
    };
  }

  function renderPlan(result) {
    const p = result.plan;
    if (result.grossSalary === 0 && result.finalTax === 0) return '';
    const pt = planText(result);
    let h = `<div class="plan"><h2 class="bd-title">${t('plan.title')}</h2>` +
      `<p class="plan-head">${pt.head}</p>` + (pt.sub ? `<small class="plan-sub">${pt.sub}</small>` : '');
    // The month strip only helps while there is something left to spread.
    if (p.months.some(m => m.status !== 'none') && (p.perMonth > 0 || p.monthsLeft === 0)) {
      h += '<div class="plan-grid">' + p.months.map((m, i) =>
        `<div class="plan-cell ${m.status}"><b>${month(i)}</b>` +
        `<span>${m.status === 'planned' ? fmt(m.amount).slice(1) : m.status === 'deducted' ? t('plan.done') : '—'}</span></div>`
      ).join('') + '</div>';
      h += `<div class="plan-key"><span><i style="background:#004d38"></i>${t('plan.key.deducted')}</span>` +
        `<span><i style="background:#e6f2ee"></i>${t('plan.key.planned')}</span>` +
        `<span><i style="background:#f3f4f6"></i>${t('plan.key.none')}</span></div>`;
    }
    return h + '</div>';
  }

  // One place decides how the bottom line reads — pane, live region, and bar.
  function totalView(result) {
    const refund = result.refundable > 0;
    return {
      refund,
      label: t(refund ? 'total.refundable' : 'total.payable'),
      shortLabel: t(refund ? 'total.refundShort' : 'total.payable'),
      amount: fmt(refund ? result.refundable : result.netPayable)
    };
  }

  // Always-visible rebate formula with live numbers — quiet reference text.
  function investmentFormula(result) {
    return t('invest.formula', { list: rebateCandidatesText(result), amount: fmt(result.rebate) });
  }

  // Actionable advice only — how much to invest and what it saves.
  function investmentHint(result) {
    const adv = result.investmentAdvice;
    const parts = [];
    if (adv.targetInvestment > 0) {
      parts.push(t(result.rebateBreakdown.byInvestment >= adv.maxUsefulRebate ? 'invest.met' : 'invest.target',
        { target: fmt(adv.targetInvestment), max: fmt(adv.maxUsefulRebate) }));
    }
    if (adv.tip) {
      parts.push(t('invest.more.tip', { extra: fmt(adv.tip.extraInvestment), saving: fmt(adv.tip.saving),
        where: result.investmentItems.some(i => i.capped) ? t('invest.more.where') : '' }));
      parts.push(t('invest.drops', { target: fmt(adv.targetInvestment), tax: fmt(adv.taxIfMaxInvested) }) +
        (result.plan.monthsLeft > 0
          ? t('invest.drops.monthly', { monthly: fmt(adv.monthlyTdsIfMaxInvested) }) : t('invest.drops.end')));
    }
    return parts.join(' ');
  }

  // ---- return summary: IT-11GA (2023) serials, from BDTax.returnSummary ----
  const TOTAL_ROWS = [11, 19, 24];

  function renderReturn(result) {
    const s = BDTax.returnSummary(result);
    const bn = BDI18n.getLang() === 'bn';
    $('returnSub').textContent = t('ret.sub', { year: yearName(result.rules), source: t('rules.source') });
    // English shows the form's Bangla wording underneath, so rows are easy
    // to match against the printed form; Bangla already is that wording.
    const table = rows => '<table class="ret-table"><tbody>' + rows.map(row => {
      const key = 'ret.row.' + row.key;
      return `<tr${TOTAL_ROWS.includes(row.serial) ? ' class="total"' : ''}><td class="sn">${digits(row.serial)}</td>` +
        `<td>${t(key)}${bn ? '' : `<small lang="bn">${BDI18n.FORM_BN[key]}</small>`}</td><td class="amt">${fmt(row.amount)}</td></tr>`;
    }).join('') + '</tbody></table>';
    const plain = rows => '<table class="ret-table"><tbody>' + rows.map(([label, amount, total]) =>
      `<tr${total ? ' class="total"' : ''}><td>${label}</td><td class="amt">${fmt(amount)}</td></tr>`).join('') + '</tbody></table>';
    $('returnBody').innerHTML = '<div class="return-grid">' +
      `<div><h3>${t('ret.income')}</h3>${table(s.income)}</div>` +
      `<div><h3>${t('ret.tax')}</h3>${table(s.tax)}</div>` +
      `<div><h3>${t('ret.payment')}</h3>${table(s.payment)}</div>` +
      `<div><h3>${t('ret.sched1')}</h3>${plain([[t('ret.s1.gross'), s.schedule1.gross],
        [t('ret.s1.exempt', { cap: fmt(result.rules.salaryExemption.cap) }), s.schedule1.exempt],
        [t('ret.s1.taxable'), s.schedule1.taxable, true]])}` +
      `<h3>${t('ret.sched5')}</h3>${plain([
        ...s.schedule5.items.map(i => [t('invest.' + i.key), i.amount]),
        [t('ret.s5.total'), s.schedule5.total, true], [t('ret.s5.rebate'), s.schedule5.rebate, true]])}</div>` +
      `</div><p class="ret-note">${t('ret.notCovered')} ${t('ret.estimate')}</p>`;
  }

  // Plain text for pasting: serial, label, amount. Amounts stay as Latin
  // digits with no ৳ or commas so spreadsheets read them as numbers.
  function returnText(result) {
    const s = BDTax.returnSummary(result);
    const lines = [`${t('ret.title')} — ${t('ret.sub', { year: yearName(result.rules), source: t('rules.source') })}`, ''];
    const block = (title, rows) => {
      lines.push(title);
      for (const row of rows) lines.push(`${row.serial}\t${t('ret.row.' + row.key)}\t${row.amount}`);
      lines.push('');
    };
    block(t('ret.income'), s.income);
    block(t('ret.tax'), s.tax);
    block(t('ret.payment'), s.payment);
    lines.push(t('ret.sched5'));
    for (const i of s.schedule5.items) lines.push(`\t${t('invest.' + i.key)}\t${i.amount}`);
    lines.push(`\t${t('ret.s5.total')}\t${s.schedule5.total}`, `\t${t('ret.s5.rebate')}\t${s.schedule5.rebate}`);
    return lines.join('\n');
  }

  function copyReturn() {
    const text = returnText(BDTax.calculateTax(readInputs()));
    const done = key => { $('returnStatus').textContent = t(key); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => done('ret.copied'), () => done('ret.copyBlocked'));
    } else done('ret.copyUnavailable');
  }

  // ---- share link: form <-> #s=… ----
  // Fill the form from decoded state (see state.js; already validated). Also
  // used to carry the form across a language switch.
  function writeInputs(st, { touched } = {}) {
    if (st.taxYear) $('taxYear').value = st.taxYear;
    $('category').value = st.category;
    $('firstTime').checked = st.isFirstTimeTaxpayer;
    $('dependents').value = digits(st.disabledDependents || 0);
    const show = v => Number(v) > 0 ? digits(v) : '';
    employersEl.innerHTML = '';
    for (const e of st.employers.length ? st.employers : [{ salaryPeriods: [], bonus: 0, tds: 0 }]) {
      const card = addEmployer();
      const rowsEl = card.querySelector('.rows');
      e.salaryPeriods.forEach((p, i) => {
        if (i > 0) addRow(rowsEl);
        const row = rowsEl.children[i];
        row.querySelector('.amount').value = show(p.monthlyAmount);
        row.querySelector('.from').value = p.fromMonth;
        row.querySelector('.to').value = p.toMonth;
      });
      card.querySelector('.bonus').value = show(e.bonus);
      card.querySelector('.tds').value = show(e.tds);
    }
    const o = st.otherIncomes;
    $('bankInterest').value = show(o.bankInterest.amount);
    $('bankTds').value = show(o.bankInterest.tds);
    $('savingsInterest').value = show(o.savingsInterest.amount);
    $('savingsTds').value = show(o.savingsInterest.tds);
    $('rentIncome').value = show(o.rent.amount);
    $('agriIncome').value = show(o.agriculture.amount);
    $('otherIncome').value = show(o.other.amount);
    $('advanceTax').value = show(st.advanceTax);
    for (const input of $('investments').querySelectorAll('input[data-key]')) {
      input.value = show(st.investments[input.dataset.key]);
      if (input.value) input.closest('details')?.setAttribute('open', '');
    }
    if (st.nextMonth !== undefined && touched !== false) { $('nextMonth').value = st.nextMonth; nextMonthTouched = true; }
  }

  function loadFromHash() {
    const m = location.hash.match(/^#s=([A-Za-z0-9_-]+)$/);
    if (!m) return;
    const st = BDState.decode(m[1]);
    if (st) writeInputs(st);
    else showShareStatus('share.bad', true);
  }

  function showShareStatus(key, bad = false) {
    $('shareStatus').textContent = key ? t(key) : '';
    $('shareStatus').classList.toggle('bad', bad);
  }

  function shareLink() {
    const url = location.href.split('#')[0] + '#s=' + BDState.encode(readInputs(), { keepNextMonth: nextMonthTouched });
    const fallback = () => {
      $('shareUrl').hidden = false;
      $('shareUrl').value = url;
      $('shareUrl').select();
      showShareStatus('share.copyBelow');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => showShareStatus('share.copied'), fallback);
    } else fallback();
  }

  // ---- main loop ----
  function recalc() {
    if (!nextMonthTouched) $('nextMonth').value = BDTax.defaultNextMonth($('taxYear').value);
    const inputs = readInputs();
    $('salaryWarning').textContent = salaryWarnings(inputs.employers);
    const result = BDTax.calculateTax(inputs);
    render(result);
    renderInvestments(result);
    renderReturn(result);
    $('returnStatus').textContent = '';
    $('investmentFormula').textContent = investmentFormula(result);
    $('investmentHint').textContent = investmentHint(result);
    const total = totalView(result);
    $('liveTotal').textContent = `${total.shortLabel} ${total.amount}`;
    const bar = $('stickyTotal');
    bar.classList.toggle('refund', total.refund);
    bar.querySelector('.lbl').textContent = total.shortLabel;
    bar.querySelector('.amt').textContent = total.amount;
    $('yearHint').textContent = t('year.hint.' + BDTax.yearStatus(inputs.taxYear));
    $('footerBasis').textContent = t('footer.basis', { year: yearName(result.rules), source: t('rules.source') });
  }

  // Switch language without losing anything typed: snapshot the form,
  // rebuild every generated part in the new language, then refill it.
  function setLanguage(lang) {
    const snapshot = BDState.decode(BDState.encode(readInputs(), { keepNextMonth: true }));
    const touched = nextMonthTouched;
    BDI18n.setLang(lang);
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* not saved — fine */ }
    applyStaticText();
    fillYears();
    fillNextMonth();
    fillInvestments();
    writeInputs(snapshot, { touched });
    showShareStatus('');
    $('shareUrl').hidden = true;
    recalc();
  }

  $('addEmployer').addEventListener('click', () => {
    addEmployer(nextEmployerStart(readEmployers()));
    recalc();
  });
  $('form').addEventListener('input', () => { showShareStatus(''); $('shareUrl').hidden = true; recalc(); });
  $('nextMonth').addEventListener('change', () => { nextMonthTouched = true; });
  $('shareBtn').addEventListener('click', shareLink);
  $('printReturn').addEventListener('click', () => window.print());
  $('copyReturn').addEventListener('click', copyReturn);
  for (const b of document.querySelectorAll('.lang button')) {
    b.addEventListener('click', () => { if (b.dataset.lang !== BDI18n.getLang()) setLanguage(b.dataset.lang); });
  }

  // Hide the mobile total bar while the real breakdown pane is on screen.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      $('stickyTotal').classList.toggle('pane-visible', entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe($('breakdown'));
  }

  BDI18n.setLang(preferredLang());
  applyStaticText();
  fillYears();    // year picker, defaulting to the year most people want today
  fillNextMonth();
  fillInvestments();
  addEmployer();  // one employer with one full-year row
  loadFromHash(); // a shared link replaces the empty form
  recalc();       // initial render
})();
