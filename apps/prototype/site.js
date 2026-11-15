/* =====================================================================
   NMU Business Register — shared site behaviour (prototype)
   - Cookie consent banner with a preferences view
   - Copy-to-clipboard on reference numbers
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- cookie consent ---------------- */
  var KEY = 'nmu-register.consent';

  var BANNER = [
    '<div class="cookie" id="cookie-banner" role="dialog" aria-modal="false" aria-label="Cookie notice">',
    '  <div class="wrap">',
    '    <div class="cookie-inner">',
    '      <div>',
    '        <h4>We use a small number of cookies</h4>',
    '        <p>Nigeria Maritime University Media Department and Voeq use cookies to keep you signed in, remember where you left off in an application, and understand which parts of the register people actually use. We do not use cookies to build an advertising profile of students, and we never sell your data. Read the <a href="cookies.html">cookie policy</a> for the full list.</p>',
    '        <div class="cookie-detail" id="cookie-detail">',
    '          <table>',
    '            <thead><tr><th>Name</th><th>Purpose</th><th>Type</th><th>Duration</th></tr></thead>',
    '            <tbody>',
    '              <tr><td class="mono">nmu_session</td><td>Keeps you signed in while you apply or check an application</td><td>Essential</td><td>Until you sign out</td></tr>',
    '              <tr><td class="mono">nmu_draft</td><td>Remembers your in-progress application so you can finish later</td><td>Essential</td><td>30 days</td></tr>',
    '              <tr><td class="mono">nmu_register_consent</td><td>Records that you accepted these terms and this policy</td><td>Essential</td><td>12 months</td></tr>',
    '              <tr><td class="mono">voeq_analytics</td><td>Counts page views and which pages are read, in aggregate</td><td>Analytics</td><td>13 months</td></tr>',
    '              <tr><td class="mono">voeq_retargeting</td><td>Measures whether the marketplace adverts reach students</td><td>Marketing</td><td>90 days</td></tr>',
    '            </tbody>',
    '          </table>',
    '        </div>',
    '      </div>',
    '      <div class="cookie-actions">',
    '        <button class="btn btn--ghost btn--sm" id="cookie-detail-toggle" aria-expanded="false">Manage</button>',
    '        <button class="btn btn--outline btn--sm" id="cookie-essential">Essential only</button>',
    '        <button class="btn btn--primary btn--sm" id="cookie-accept">Accept all</button>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  function readConsent() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  }

  function writeConsent(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch (e) { /* private mode */ }
    document.documentElement.setAttribute('data-cookie', value.mode);
  }

  function mountCookieBanner() {
    if (!document.body) { return; }
    var existing = document.getElementById('cookie-banner');
    if (existing) { existing.parentNode.removeChild(existing); }

    document.body.insertAdjacentHTML('beforeend', BANNER);

    var banner = document.getElementById('cookie-banner');
    var detail = document.getElementById('cookie-detail');
    var detailToggle = document.getElementById('cookie-detail-toggle');

    detailToggle.addEventListener('click', function () {
      var open = detail.classList.toggle('is-open');
      detailToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      detailToggle.textContent = open ? 'Hide' : 'Manage';
    });

    document.getElementById('cookie-accept').addEventListener('click', function () {
      writeConsent({ mode: 'all', ts: new Date().toISOString() });
      banner.classList.remove('is-open');
      setTimeout(function () { banner.remove(); }, 320);
    });

    document.getElementById('cookie-essential').addEventListener('click', function () {
      writeConsent({ mode: 'essential', ts: new Date().toISOString() });
      banner.classList.remove('is-open');
      setTimeout(function () { banner.remove(); }, 320);
    });

    if (readConsent()) { return; }           /* already decided — stay hidden */
    requestAnimationFrame(function () { banner.classList.add('is-open'); });
  }

  /* ---------------- copy reference ---------------- */
  function mountCopyButtons() {
    document.querySelectorAll('.ref-copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var host = btn.closest('.ref');
        var value = host ? host.textContent.trim() : '';
        if (!value || !navigator.clipboard) { return; }
        navigator.clipboard.writeText(value).then(function () {
          var prev = btn.getAttribute('title');
          btn.setAttribute('title', 'Copied');
          btn.style.color = 'var(--seal)';
          setTimeout(function () {
            btn.setAttribute('title', prev || 'Copy reference');
            btn.style.color = '';
          }, 1400);
        });
      });
    });
  }

  function boot() {
    mountCookieBanner();
    mountCopyButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
