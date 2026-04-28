/* ============================================================
   IMS Coach OS · shared sidebar nav
   Drop a <div data-ims-sidebar></div> in the page (or <body>
   has [data-ims-route]) and this script will render the nav.
   ============================================================ */

(function () {
  // Module registry · single source of truth for all sister pages.
  // Mirror this in app.py when adding new modules.
  const MODULES = [
    {
      label: 'Dashboard',
      short: 'HOME',
      path: '/dashboard',
      aliases: ['/', '/dashboard'],
      eyebrow: 'workspace',
    },
    {
      label: 'Program Generator',
      short: 'GEN',
      path: '/generator',
      aliases: ['/generator', '/assessment'],
      eyebrow: 'workspace',
    },
    {
      label: 'Exercise Library',
      short: 'LIB',
      path: '/exercise-library',
      aliases: ['/exercise-library'],
      eyebrow: 'workspace',
    },
    {
      label: 'Master Calendar',
      short: 'CAL',
      path: '/calendar',
      aliases: ['/calendar'],
      eyebrow: 'workspace',
    },
    {
      label: 'Program Review',
      short: 'REV',
      path: '/program-review',
      aliases: ['/program-review'],
      eyebrow: 'plans',
    },
    {
      label: 'Session Notes',
      short: 'NOTES',
      path: '/session-notes',
      aliases: ['/session-notes'],
      eyebrow: 'plans',
    },
  ];

  // Group by eyebrow. Order is preserved.
  function groupModules() {
    const groups = [];
    let current = null;
    MODULES.forEach((m) => {
      if (!current || current.eyebrow !== m.eyebrow) {
        current = { eyebrow: m.eyebrow, items: [] };
        groups.push(current);
      }
      current.items.push(m);
    });
    return groups;
  }

  function isActive(pathname, mod) {
    return mod.aliases.includes(pathname);
  }

  function renderSidebar(targetEl, opts) {
    const pathname = window.location.pathname.replace(/\/$/, '') || '/';
    const groups = groupModules();
    const html = `
      <div class="brand">
        <img src="/assets/ims-logo.png" alt="iMS · Innovative Movement Solutions"
             style="display:block;width:100%;max-width:160px;height:auto;margin:0 auto;" />
        <span class="sub" style="text-align:center;display:block;margin-top:4px;">Coach OS</span>
      </div>
      ${groups
        .map(
          (g) => `
        <div class="ims-nav-section-label">${g.eyebrow}</div>
        ${g.items
          .map(
            (m) => `
          <a class="ims-nav-link ${isActive(pathname, m) ? 'active' : ''}"
             href="${m.path}"
             data-short="${m.short}">
            <span>${m.label}</span>
            ${m.placeholder ? '<span class="ims-nav-soon">soon</span>' : ''}
          </a>
        `,
          )
          .join('')}
      `,
        )
        .join('')}
    `;
    targetEl.innerHTML = html;
    // Add the canonical class only if the page hasn't styled the container
    // itself (i.e. it relied on data-ims-sidebar). Pages with a pre-existing
    // .sidebar class keep their own styling.
    if (!targetEl.classList.contains('sidebar')) {
      targetEl.classList.add('ims-sidebar');
    }
  }

  // Public API
  window.IMSNav = {
    render(target) {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!el) return;
      renderSidebar(el);
    },
    modules: MODULES,
    activePath() {
      const pathname = window.location.pathname.replace(/\/$/, '') || '/';
      return MODULES.find((m) => m.aliases.includes(pathname));
    },
  };

  // Auto-render if the page declares [data-ims-sidebar]
  document.addEventListener('DOMContentLoaded', () => {
    const target = document.querySelector('[data-ims-sidebar]');
    if (target) renderSidebar(target);
  });
})();
