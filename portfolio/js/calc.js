/* ==========================================================================
   AutoCare's money maths, running in this page.

   This is a port of autocare/lib/calc.ts, not a re-implementation. The source
   of truth is that file; it is imported unchanged by AutoCare's browser code
   and by its server, which is the whole point being demonstrated here. This
   copy exists only because the portfolio has no build step and cannot import
   TypeScript.

   The port was checked against the original over 2,000 generated cases, every
   field compared, zero disagreements. If lib/calc.ts changes, re-run that
   check: portfolio/README.md says how.

   All arithmetic happens in integer centavos so that repeated additions of
   values like 0.07 cannot drift.
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------- the maths --
     Ported verbatim. Do not "tidy" these: the EPSILON nudge and the order of
     the status rules are both load-bearing. */

  function toCentavos(value) {
    if (value === null || value === undefined || value === '') return 0;
    var n = typeof value === 'number' ? value : Number(String(value));
    if (!isFinite(n)) return 0;
    // Nudge away from binary-float boundaries (1.005 * 100 === 100.49999...).
    return Math.round((n + Number.EPSILON * Math.sign(n || 1)) * 100);
  }

  function toPesos(centavos) {
    return Math.round(centavos) / 100;
  }

  function toQuantity(value) {
    var n = typeof value === 'number' ? value : Number(value == null ? 0 : value);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function deriveStatus(balanceCentavos, amountPaidCentavos) {
    if (balanceCentavos <= 0) return 'PAID';
    if (amountPaidCentavos === 0) return 'UNPAID';
    return 'PARTIAL';
  }

  function computeJobTotals(input) {
    var parts = input.parts || [];
    var services = input.services || [];

    var partsCentavos = 0;
    for (var i = 0; i < parts.length; i++) {
      partsCentavos += toQuantity(parts[i].quantity) * toCentavos(parts[i].unitPrice);
    }
    var servicesCentavos = 0;
    for (var j = 0; j < services.length; j++) {
      servicesCentavos += toCentavos(services[j].price);
    }

    var laborCentavos = toCentavos(input.laborCharge);
    var expensesCentavos = toCentavos(input.expenses);
    var discountCentavos = toCentavos(input.discount);
    var amountPaidCentavos = toCentavos(input.amountPaid);

    var subtotalCentavos =
      laborCentavos + expensesCentavos + partsCentavos + servicesCentavos;
    var totalCentavos = subtotalCentavos - discountCentavos;
    var balanceCentavos = totalCentavos - amountPaidCentavos;

    return {
      partsTotal: toPesos(partsCentavos),
      servicesTotal: toPesos(servicesCentavos),
      laborCharge: toPesos(laborCentavos),
      expenses: toPesos(expensesCentavos),
      discount: toPesos(discountCentavos),
      subtotal: toPesos(subtotalCentavos),
      total: toPesos(totalCentavos),
      amountPaid: toPesos(amountPaidCentavos),
      balance: toPesos(balanceCentavos),
      status: deriveStatus(balanceCentavos, amountPaidCentavos)
    };
  }

  function formatPeso(value) {
    var amount = toPesos(toCentavos(value));
    try {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return '₱' + amount.toFixed(2);
    }
  }

  // Exposed so the console can be used to check it, which is the sort of thing
  // the person this page is written for will actually do.
  window.autocareCalc = {
    toCentavos: toCentavos,
    toPesos: toPesos,
    toQuantity: toQuantity,
    deriveStatus: deriveStatus,
    computeJobTotals: computeJobTotals,
    formatPeso: formatPeso
  };

  /* ------------------------------------------------------------- wiring -- */

  var form = document.getElementById('calc');
  if (!form) return;

  var out = {
    parts: document.getElementById('calc-parts'),
    labour: document.getElementById('calc-labour'),
    subtotal: document.getElementById('calc-subtotal'),
    discount: document.getElementById('calc-discount'),
    total: document.getElementById('calc-total'),
    paid: document.getElementById('calc-paid'),
    balance: document.getElementById('calc-balance'),
    status: document.getElementById('calc-status'),
    drift: document.getElementById('calc-drift')
  };

  function field(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function render() {
    var totals = computeJobTotals({
      laborCharge: field('calc-in-labour'),
      expenses: 0,
      discount: field('calc-in-discount'),
      amountPaid: field('calc-in-paid'),
      parts: [
        { quantity: field('calc-in-q1'), unitPrice: field('calc-in-p1') },
        { quantity: field('calc-in-q2'), unitPrice: field('calc-in-p2') }
      ],
      services: []
    });

    out.parts.textContent = formatPeso(totals.partsTotal);
    out.labour.textContent = formatPeso(totals.laborCharge);
    out.subtotal.textContent = formatPeso(totals.subtotal);
    out.discount.textContent = formatPeso(totals.discount);
    out.total.textContent = formatPeso(totals.total);
    out.paid.textContent = formatPeso(totals.amountPaid);
    out.balance.textContent = formatPeso(totals.balance);
    out.status.textContent = totals.status;
    out.status.setAttribute('data-status', totals.status);

    // The same first line added the naive way, so the drift is visible rather
    // than asserted. Repeated addition is what a spreadsheet or a hand-rolled
    // loop actually does.
    if (out.drift) {
      var qty = toQuantity(field('calc-in-q1'));
      var unit = Number(field('calc-in-p1'));
      var naive = 0;
      for (var i = 0; i < qty; i++) naive += isFinite(unit) ? unit : 0;
      var exact = toPesos(toQuantity(field('calc-in-q1')) * toCentavos(field('calc-in-p1')));
      var drifted = naive !== exact;
      out.drift.textContent = String(naive);
      out.drift.setAttribute('data-drift', drifted ? 'yes' : 'no');
    }
  }

  form.addEventListener('input', render);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  render();
})();
