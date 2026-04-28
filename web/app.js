/* ================================================================
   IMS COACH OS · APP.JS
   App shell state + routing + wizard navigation + summary updates
   + plan review render + dashboard wiring.

   Boundaries:
   - Form fields and the JSON payload shape are owned by legacy.js
   - This file only orchestrates: which view is visible, which step is
     active, what the snapshot/summary show, and how the action bar
     and review screen render.

   For Phase 6, replace the inline localStorage calls in
   `dataAdapter` with Supabase fetches. No other code should change.
   ================================================================ */

/* ---------------- 1. STATE ---------------- */

const STEPS = [
  { num: 1,  key: 'client_basics',         short: 'Basics',     full: 'Client Basics' },
  { num: 2,  key: 'schedule_goal',         short: 'Goal',       full: 'Schedule & Goal' },
  { num: 3,  key: 'constraints_concerns',  short: 'Constraints',full: 'Constraints' },
  { num: 4,  key: 'mobility_assessment',   short: 'Mobility',   full: 'Mobility / FRA' },
  { num: 5,  key: 'strength_tests',        short: 'Strength',   full: 'Strength Testing' },
  { num: 6,  key: 'cardio_profile',        short: 'Cardio',     full: 'Cardio Profile' },
  { num: 7,  key: 'body_comp',             short: 'Body Comp',  full: 'Body Composition' },
  { num: 8,  key: 'nutrition',             short: 'Nutrition',  full: 'Nutrition' },
  { num: 9,  key: 'accessories',           short: 'Accessory',  full: 'Accessory Plug-Ins' },
  { num: 10, key: 'coach_notes',           short: 'Review',     full: 'Coach Notes & Review' },
];

const ROUTES = {
  '#/':                'view-dashboard',
  '#/clients':         'view-clients',
  '#/assessments':     'view-assessments',
  '#/assessment/new':  'view-assessment',
  '#/assessment/draft':'view-assessment',
  '#/programs':        'view-programs',
  '#/program/amanda':  'view-review',
};

const ROUTE_TITLES = {
  '#/':                ['Dashboard', 'Today'],
  '#/clients':         ['Clients', 'All clients'],
  '#/assessments':     ['Assessments', 'All assessments'],
  '#/assessment/new':  ['Assessment', 'New movement assessment'],
  '#/assessment/draft':['Assessment', 'Resumed draft'],
  '#/programs':        ['Programs', 'Saved programs'],
  '#/program/amanda':  ['Programs', 'Amanda Patterson · Block 1'],
};

const state = {
  currentRoute: '#/',
  currentStep: 1,
  // section_status default: every section starts "complete" except optional ones
  // (body_comp / accessories) which default to "skipped" / "na" via HTML
  sectionStatuses: {},
  reviewProgram: null,        // loaded program JSON for review screen
  reviewActiveWeek: 1,        // 1..4
  reviewActiveSession: 0,
  formInitialized: false,
};

/* ---------------- 2. DATA ADAPTER ---------------- */
/* Phase 6 swap point: replace the bodies with Supabase calls. */

const STORAGE_KEY = 'ims_assessment_draft_v2';
const STORAGE_STEP_KEY = 'ims_assessment_step_v2';
const STORAGE_STATUS_KEY = 'ims_section_statuses_v2';

const dataAdapter = {
  saveDraft(payload, step, statuses) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(STORAGE_STEP_KEY, String(step));
      localStorage.setItem(STORAGE_STATUS_KEY, JSON.stringify(statuses));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e };
    }
  },

  loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const step = parseInt(localStorage.getItem(STORAGE_STEP_KEY) || '1', 10);
      const statuses = JSON.parse(localStorage.getItem(STORAGE_STATUS_KEY) || '{}');
      return raw ? { payload: JSON.parse(raw), step, statuses } : null;
    } catch (e) { return null; }
  },

  clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_STEP_KEY);
      localStorage.removeItem(STORAGE_STATUS_KEY);
    } catch (e) {}
  },

  async fetchAmandaProgram() {
    const res = await fetch('/mock_amanda.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Failed to load mock_amanda.json');
    return await res.json();
  },
};

/* ---------------- 3. ROUTER ---------------- */

function navigate(route) {
  if (!ROUTES[route]) route = '#/';
  state.currentRoute = route;

  // Switch view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const viewId = ROUTES[route];
  const viewEl = document.getElementById(viewId);
  if (viewEl) viewEl.classList.add('active');

  // Switch sidebar active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  // Highlight by base path
  const baseMap = { '#/': '#/', '#/clients': '#/clients', '#/assessments': '#/assessments',
                    '#/assessment/new': '#/assessments', '#/assessment/draft': '#/assessments',
                    '#/programs': '#/programs', '#/program/amanda': '#/programs' };
  const navTarget = baseMap[route] || '#/';
  const navEl = document.querySelector(`.nav-item[data-route="${navTarget}"]`);
  if (navEl) navEl.classList.add('active');

  // Update topbar title
  const [crumb, title] = ROUTE_TITLES[route] || ['', ''];
  document.getElementById('crumb-1').textContent = crumb;
  document.getElementById('page-now').textContent = title;

  // Action bar visibility
  const actionBar = document.getElementById('action-bar');
  if (viewId === 'view-assessment') {
    actionBar.classList.add('visible');
    if (!state.formInitialized) {
      // legacy.js initForm() runs on DOMContentLoaded but if the assessment
      // view is hidden at load, the seed mobility/anchor rows still happened.
      // Mark initialized so we don't double-seed.
      state.formInitialized = true;
    }
    showStep(state.currentStep);
    refreshSnapshot();
    refreshSummary();
  } else {
    actionBar.classList.remove('visible');
  }

  if (viewId === 'view-review') {
    loadReviewScreen();
  }

  // Scroll to top
  if (viewEl) viewEl.scrollTop = 0;
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => navigate(window.location.hash || '#/'));

/* ---------------- 4. SIDEBAR + DASHBOARD WIRING ---------------- */

function bindSidebar() {
  document.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;
      window.location.hash = route;
    });
  });
}

function bindActions() {
  // Wire any element with [data-action]
  document.body.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'new-assessment') {
      window.location.hash = '#/assessment/new';
      // Don't auto-load draft for "new"
    } else if (action === 'resume-draft') {
      const draft = dataAdapter.loadDraft();
      if (draft) {
        window.location.hash = '#/assessment/draft';
        setTimeout(() => {
          if (typeof applyData === 'function') applyData(draft.payload);
          if (draft.statuses) restoreStatuses(draft.statuses);
          state.currentStep = draft.step || 1;
          showStep(state.currentStep);
          refreshSnapshot();
          refreshSummary();
          showToast('✓ Draft restored');
        }, 50);
      } else {
        showToast('No saved draft found');
        window.location.hash = '#/assessment/new';
      }
    } else if (action === 'open-amanda') {
      // Send to the dedicated Program Review page (consolidated build).
      // The old in-SPA prototype at #/program/amanda is preserved as a
      // fallback but is no longer the canonical surface.
      window.location.href = '/program-review';
    } else if (action === 'back-to-dashboard') {
      window.location.hash = '#/';
    }
  });
}

/* ---------------- 5. WIZARD: STEPPER ---------------- */

function buildStepper() {
  const stepper = document.getElementById('stepper');
  stepper.innerHTML = '';
  STEPS.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'step-btn';
    btn.dataset.step = s.num;
    btn.innerHTML = `
      <span class="step-status-dot"></span>
      <span class="num">Step ${String(s.num).padStart(2,'0')}</span>
      <span class="label">${s.short}</span>
    `;
    btn.addEventListener('click', () => {
      state.currentStep = s.num;
      showStep(s.num);
    });
    stepper.appendChild(btn);
  });
}

function showStep(stepNum) {
  state.currentStep = stepNum;
  // Toggle step views
  document.querySelectorAll('.step-view').forEach(v => v.classList.remove('active'));
  const sv = document.querySelector(`.step-view[data-step="${stepNum}"]`);
  if (sv) sv.classList.add('active');

  // Update stepper visuals
  document.querySelectorAll('.step-btn').forEach(b => {
    b.classList.remove('active');
    const n = parseInt(b.dataset.step, 10);
    if (n === stepNum) b.classList.add('active');
  });
  applyStepperStatusClasses();

  // Update action bar buttons
  const backBtn = document.getElementById('btn-back');
  const nextBtn = document.getElementById('btn-next');
  const genGroup = document.getElementById('generate-group');

  backBtn.disabled = stepNum === 1;
  if (stepNum === STEPS.length) {
    nextBtn.style.display = 'none';
    genGroup.style.display = 'flex';
    refreshReviewSummary();
  } else {
    nextBtn.style.display = '';
    genGroup.style.display = 'none';
  }

  // Smooth scroll to top of the step
  if (sv) {
    const view = document.getElementById('view-assessment');
    if (view) view.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function applyStepperStatusClasses() {
  // Apply status (complete/partial/skipped) to each step button based on
  // the current section status selector value.
  STEPS.forEach(s => {
    const sel = document.querySelector(`.status-selector[data-section-status="${s.key}"] select`);
    if (!sel) return;
    const status = sel.value;
    const btn = document.querySelector(`.step-btn[data-step="${s.num}"]`);
    if (!btn) return;
    btn.classList.remove('complete', 'partial', 'skipped', 'pending', 'na');
    if (status === 'complete') {
      // mark complete only if step actually has any content filled (heuristic)
      if (stepHasContent(s.num)) btn.classList.add('complete');
    } else if (status === 'partial') btn.classList.add('partial');
    else if (status === 'skipped' || status === 'pending' || status === 'na') {
      btn.classList.add('skipped');
    }
  });
}

function stepHasContent(stepNum) {
  // Lightweight heuristic: does the step's form area have any non-default value?
  const sv = document.querySelector(`.step-view[data-step="${stepNum}"]`);
  if (!sv) return false;
  const inputs = sv.querySelectorAll('input, select, textarea');
  for (const el of inputs) {
    if (el.type === 'radio' || el.type === 'checkbox') {
      // a radio checked or a checkbox checked counts as content,
      // except for the "default" pre-checked options (sd-3, cd-1, nut-maintenance, af-1.45)
      const isDefault = ['sd-3', 'cd-1', 'nut-maintenance', 'af-1.45', 'ic-not-assessed'].includes(el.id);
      if (el.checked && !isDefault) return true;
    } else if (el.value && el.value.trim()) return true;
  }
  return false;
}

/* ---------------- 6. SECTION STATUS SELECTORS ---------------- */

function bindStatusSelectors() {
  document.querySelectorAll('.status-selector select').forEach(sel => {
    const sectionKey = sel.parentElement.dataset.sectionStatus;
    state.sectionStatuses[sectionKey] = sel.value;

    // Visual: dim step content when skipped/pending/na
    applyStepDimming(sectionKey, sel.value);

    sel.addEventListener('change', () => {
      state.sectionStatuses[sectionKey] = sel.value;
      applyStepDimming(sectionKey, sel.value);
      applyStepperStatusClasses();
      refreshSummary();
      autosave();
    });
  });
}

function applyStepDimming(sectionKey, status) {
  const sv = document.querySelector(`.step-view[data-section="${sectionKey}"]`);
  if (!sv) return;
  sv.classList.remove('is-skipped', 'is-pending', 'is-na', 'is-partial');
  if (status === 'skipped') sv.classList.add('is-skipped');
  else if (status === 'pending') sv.classList.add('is-pending');
  else if (status === 'na') sv.classList.add('is-na');
}

function restoreStatuses(statuses) {
  Object.entries(statuses).forEach(([k, v]) => {
    const sel = document.querySelector(`.status-selector[data-section-status="${k}"] select`);
    if (sel && [...sel.options].some(o => o.value === v)) {
      sel.value = v;
      state.sectionStatuses[k] = v;
      applyStepDimming(k, v);
    }
  });
  applyStepperStatusClasses();
}

/* ---------------- 7. SNAPSHOT + SUMMARY ---------------- */

function refreshSnapshot() {
  // Re-read the form to update the snapshot header
  if (typeof collectData !== 'function') return;
  let d;
  try { d = collectData(); } catch (e) { return; }

  // Avatar
  const initials = (d.client_name || '').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  document.getElementById('snap-avatar').textContent = initials;

  // Name
  const nameEl = document.getElementById('snap-name');
  if (d.client_name) {
    nameEl.textContent = d.client_name;
  } else {
    nameEl.innerHTML = '<span class="placeholder">New client · enter a name to begin</span>';
  }

  // Date / goal / split
  document.getElementById('snap-date').textContent = d.assessment_date || '—';
  const goalEl = document.getElementById('snap-goal');
  if (d.primary_goal) {
    const truncated = d.primary_goal.length > 60 ? d.primary_goal.slice(0, 60) + '…' : d.primary_goal;
    goalEl.textContent = truncated;
  } else {
    goalEl.innerHTML = '<em>not set</em>';
  }
  document.getElementById('snap-split').textContent = `${d.strength_days} strength · ${d.cardio_days} cardio`;

  // Progress
  const pct = computeCompletionPercent();
  document.getElementById('snap-progress').textContent = pct;
  document.getElementById('snap-progress-fill').style.width = pct + '%';
  const lbl = document.getElementById('snap-progress-label');
  if (pct < 20) lbl.textContent = 'Just starting';
  else if (pct < 50) lbl.textContent = 'Building';
  else if (pct < 90) lbl.textContent = 'Close to ready';
  else lbl.textContent = 'Ready to generate';
}

function refreshSummary() {
  if (typeof collectData !== 'function') return;
  let d;
  try { d = collectData(); } catch (e) { return; }

  // Client
  const sumClient = document.getElementById('sum-client');
  if (d.client_name) {
    sumClient.textContent = d.client_name + (d.age_range ? ` · ${d.age_range}` : '');
    sumClient.classList.remove('empty');
  } else {
    sumClient.textContent = 'Not set';
    sumClient.classList.add('empty');
  }

  // Goal
  const sumGoal = document.getElementById('sum-goal');
  if (d.primary_goal) {
    sumGoal.textContent = d.primary_goal.length > 110 ? d.primary_goal.slice(0,110)+'…' : d.primary_goal;
    sumGoal.classList.remove('empty');
  } else {
    sumGoal.textContent = 'Not set';
    sumGoal.classList.add('empty');
  }

  // Split
  document.getElementById('sum-split').textContent =
    `${d.strength_days} strength · ${d.cardio_days} cardio`;

  // Priorities
  const ulP = document.getElementById('sum-priorities');
  if (d.fra_priorities && d.fra_priorities.length) {
    ulP.innerHTML = d.fra_priorities.map(p => `<li>${escapeHtmlSafe(p)}</li>`).join('');
  } else {
    ulP.innerHTML = '<li class="empty">None added yet</li>';
  }

  // Constraints
  const ulC = document.getElementById('sum-constraints');
  if (d.constraints && d.constraints.length) {
    ulC.innerHTML = d.constraints.map(c => `<li>${escapeHtmlSafe(formatConstraintLabel(c))}</li>`).join('');
  } else {
    ulC.innerHTML = '<li class="empty">None checked</li>';
  }

  // Section statuses
  const stack = document.getElementById('sum-statuses');
  stack.innerHTML = STEPS.map(s => {
    const status = state.sectionStatuses[s.key] || 'complete';
    const cls = ({
      'complete': 'chip-complete',
      'partial': 'chip-partial',
      'skipped': 'chip-skipped',
      'pending': 'chip-pending',
      'na': 'chip-na',
    })[status] || 'chip-pending';
    return `<span class="chip ${cls}">${s.short}</span>`;
  }).join('');

  // Readiness
  const readiness = document.getElementById('readiness');
  const label = document.getElementById('readiness-label');
  const blockers = computeBlockers(d);
  if (blockers.length === 0) {
    readiness.className = 'readiness ready';
    label.textContent = '✓ Ready to Generate';
  } else if (blockers.length <= 2) {
    readiness.className = 'readiness partial';
    label.textContent = `Almost · ${blockers.length} item${blockers.length===1?'':'s'} left`;
  } else {
    readiness.className = 'readiness blocked';
    label.textContent = `${blockers.length} required items`;
  }

  // Update missing-count badge in action bar
  const missingEl = document.getElementById('missing-count');
  if (blockers.length > 0) {
    missingEl.style.display = 'block';
    missingEl.textContent = `${blockers.length} required missing`;
  } else {
    missingEl.style.display = 'none';
  }
}

function computeBlockers(d) {
  // Minimum required to generate (matches Phase 3 spec):
  // - client name
  // - primary goal
  // - at least 1 training day
  // - at least 1 priority OR mobility skipped/pending
  const blockers = [];
  if (!d.client_name) blockers.push('Client name');
  if (!d.primary_goal) blockers.push('Primary goal');
  const total = (d.strength_days || 0) + (d.cardio_days || 0);
  if (total === 0) blockers.push('At least 1 training day');
  const mobStatus = state.sectionStatuses.mobility_assessment || 'complete';
  if ((!d.fra_priorities || d.fra_priorities.length === 0) && mobStatus === 'complete') {
    blockers.push('At least 1 mobility priority');
  }
  return blockers;
}

function computeCompletionPercent() {
  const counts = STEPS.map(s => {
    const status = state.sectionStatuses[s.key] || 'complete';
    if (status === 'na' || status === 'skipped') return 1; // intentional
    if (status === 'pending') return 0;
    if (status === 'partial') return 0.5;
    // complete: weight by whether content exists
    return stepHasContent(s.num) ? 1 : 0;
  });
  const sum = counts.reduce((a, b) => a + b, 0);
  return Math.round((sum / STEPS.length) * 100);
}

function refreshReviewSummary() {
  // Render the inline summary at the bottom of step 10
  if (typeof collectData !== 'function') return;
  let d;
  try { d = collectData(); } catch (e) { return; }

  const target = document.getElementById('review-summary');
  if (!target) return;

  const blockers = computeBlockers(d);
  const skipped = STEPS.filter(s => ['skipped', 'pending', 'na'].includes(state.sectionStatuses[s.key]));
  const partial = STEPS.filter(s => state.sectionStatuses[s.key] === 'partial');

  let html = `<div class="card-meta" style="margin-top: 14px;">
    <span><strong>${escapeHtmlSafe(d.client_name || 'Unnamed')}</strong> · ${escapeHtmlSafe(d.age_range || '')} ${escapeHtmlSafe(d.sex || '')}</span>
    <span>${d.strength_days} strength · ${d.cardio_days} cardio</span>
    <span>${(d.fra_priorities||[]).length} priorities</span>
    <span>${(d.constraints||[]).length} constraints</span>
  </div>`;

  html += '<hr class="card-divider">';

  if (skipped.length) {
    html += `<p class="help" style="margin-bottom: 10px;"><strong style="color: var(--cream);">Sections skipped or pending:</strong> ${skipped.map(s => s.full).join(' · ')}</p>`;
  }
  if (partial.length) {
    html += `<p class="help" style="margin-bottom: 10px;"><strong style="color: var(--cream);">Partial:</strong> ${partial.map(s => s.full).join(' · ')}</p>`;
  }

  target.innerHTML = html;

  const warns = document.getElementById('review-warnings');
  if (!warns) return;
  if (blockers.length) {
    warns.innerHTML = `
      <div style="margin-top: 18px; padding: 14px 16px; background: rgba(226,92,69,0.08); border-left: 2px solid var(--limited);">
        <span class="eyebrow" style="color: var(--limited); display: block; margin-bottom: 6px;">Required items missing</span>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${blockers.map(b => `<li style="font-size: 13px; padding: 3px 0; color: var(--cream);">· ${escapeHtmlSafe(b)}</li>`).join('')}
        </ul>
      </div>`;
  } else {
    warns.innerHTML = `
      <div style="margin-top: 18px; padding: 14px 16px; background: rgba(76,169,138,0.08); border-left: 2px solid var(--optimal);">
        <span class="eyebrow" style="color: var(--optimal); display: block; margin-bottom: 4px;">Ready to generate</span>
        <p style="font-size: 13px; color: var(--cream); margin: 0;">All required fields present. Pick an export mode below.</p>
      </div>`;
  }
}

function escapeHtmlSafe(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatConstraintLabel(c) {
  return c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/* ---------------- 8. ACTION BAR + AUTOSAVE ---------------- */

function bindActionBar() {
  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.currentStep > 1) showStep(state.currentStep - 1);
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (state.currentStep < STEPS.length) showStep(state.currentStep + 1);
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    autosave(true);
    showToast('✓ Draft saved');
  });
}

let autosaveTimer = null;
function autosave(immediate = false) {
  const dot = document.getElementById('autosave-dot');
  const label = document.getElementById('autosave-label');
  if (dot) dot.classList.add('saving');
  if (label) label.textContent = 'Saving…';

  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (typeof collectData === 'function') {
      try {
        const data = collectData();
        dataAdapter.saveDraft(data, state.currentStep, state.sectionStatuses);
      } catch (e) {}
    }
    if (dot) dot.classList.remove('saving');
    if (label) {
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      label.textContent = `Saved · ${time}`;
    }
  }, immediate ? 0 : 600);
}

function bindFormChangesForLiveUpdate() {
  const form = document.getElementById('assessment-form');
  if (!form) return;
  form.addEventListener('input', () => {
    refreshSnapshot();
    refreshSummary();
    autosave();
  });
  form.addEventListener('change', () => {
    refreshSnapshot();
    refreshSummary();
    autosave();
  });
}

/* ---------------- 9. GENERATE PLAN WRAPPER ---------------- */
/* Decorate legacy generatePlan to attach _section_statuses to the payload.
   The backend ignores unknown keys today; Phase 3 will read this field
   to drive bypass-aware rendering. */

if (typeof window.generatePlan === 'function') {
  const _legacyGen = window.generatePlan;
  window.generatePlan = async function(mode = 'client') {
    // Inject section statuses into the form temporarily by patching collectData
    // Cleanest: monkey-patch collectData to add the field, then restore.
    const _legacyCollect = window.collectData;
    window.collectData = function() {
      const d = _legacyCollect();
      d._section_statuses = { ...state.sectionStatuses };
      return d;
    };
    try {
      await _legacyGen(mode);
    } finally {
      window.collectData = _legacyCollect;
    }
  };
}

/* ---------------- 10. PLAN REVIEW ---------------- */

async function loadReviewScreen() {
  const main = document.getElementById('review-main');
  const nav = document.getElementById('review-week-nav');
  const panel = document.getElementById('coach-panel');
  const titleEl = document.getElementById('review-title');

  main.innerHTML = '<p class="help">Loading program…</p>';

  let program;
  if (state.reviewProgram) {
    program = state.reviewProgram;
  } else {
    try {
      program = await dataAdapter.fetchAmandaProgram();
      state.reviewProgram = program;
    } catch (err) {
      main.innerHTML = `<p class="help">Could not load mock_amanda.json — ${escapeHtmlSafe(err.message)}</p>`;
      return;
    }
  }

  const clientName = program.client_name || program.assessment?.name || 'Client';
  titleEl.innerHTML = `Block 1, <em>${escapeHtmlSafe(clientName)}</em>.`;

  // Build week nav
  const weeks = program.weeks || [];
  nav.innerHTML = `<div class="nav-title">Block 1 · ${weeks.length} weeks</div>` +
    weeks.map(w => `
      <div class="nav-link ${w.week_number === state.reviewActiveWeek ? 'active' : ''}" data-week="${w.week_number}">
        <span>Week ${w.week_number}</span>
        <span class="small">${escapeHtmlSafe((w.intent || '').slice(0, 16))}</span>
      </div>
    `).join('') + `
      <div class="nav-link" data-week="nutrition"><span>Nutrition</span><span class="small">Macros</span></div>
      <div class="nav-link" data-week="recovery"><span>Recovery</span><span class="small">Routines</span></div>
      <div class="nav-link" data-week="notes"><span>Notes</span><span class="small">Coach</span></div>
    `;

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      const w = link.dataset.week;
      if (['nutrition', 'recovery', 'notes'].includes(w)) {
        renderReviewStaticTab(w, program);
      } else {
        state.reviewActiveWeek = parseInt(w, 10);
        renderReviewWeek(program, state.reviewActiveWeek);
      }
      nav.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  renderReviewWeek(program, state.reviewActiveWeek);
  renderCoachPanel(program);

  // Wire export buttons to call generatePlan
  document.getElementById('review-export-client').onclick = () => {
    showToast('Client export from saved plan · Phase 5');
  };
  document.getElementById('review-export-coach').onclick = () => {
    showToast('Coach export from saved plan · Phase 5');
  };
  document.getElementById('review-export-full').onclick = () => {
    showToast('Full export from saved plan · Phase 5');
  };
}

function renderReviewWeek(program, weekNum) {
  const main = document.getElementById('review-main');
  const week = (program.weeks || []).find(w => w.week_number === weekNum);
  if (!week) {
    main.innerHTML = '<p class="help">Week not found.</p>';
    return;
  }

  const intent = week.intent || '';
  const progNote = week.progression_notes || '';

  let html = `
    <div class="snapshot" style="margin-bottom: 8px;">
      <div class="id">
        <div class="name flourish">Week <em>${weekNum}</em></div>
        <div class="meta">
          <span>${escapeHtmlSafe(intent)}</span>
          <span>${(week.sessions || []).length} sessions</span>
        </div>
      </div>
    </div>
  `;
  if (progNote) {
    html += `<p class="help" style="margin: 4px 0 18px;">${escapeHtmlSafe(progNote)}</p>`;
  }

  (week.sessions || []).forEach((session, idx) => {
    html += renderSessionCard(session, idx);
  });

  main.innerHTML = html;
}

function renderSessionCard(session, idx) {
  const dayType = session.day_type || '';
  const focus = session.focus || '';
  const blocks = session.blocks || [];

  const dayLabel = (() => {
    if (dayType === 'cardio') return 'Cardio &amp; Recovery';
    if (dayType.startsWith('strength_lb')) return 'Lower Body Strength';
    if (dayType.startsWith('strength_ub')) return 'Upper Body Strength';
    if (dayType.startsWith('strength_full')) return 'Full Body Strength';
    return formatConstraintLabel(dayType);
  })();

  let blocksHtml = blocks.map(block => {
    const exHtml = (block.exercises || []).map(ex => renderExerciseRow(ex)).join('');
    return `
      <div class="block-group">
        <div class="block-head">
          <span class="block-name">${escapeHtmlSafe(block.name)}</span>
          ${block.duration_note ? `<span class="block-note">${escapeHtmlSafe(block.duration_note)}</span>` : ''}
        </div>
        ${exHtml}
      </div>
    `;
  }).join('');

  return `
    <div class="session-card">
      <div class="session-head">
        <div>
          <div class="day-num">Day ${session.day_number}</div>
          <div class="day-title flourish">Day ${session.day_number}. <em>${dayLabel}.</em></div>
          ${focus ? `<div class="day-focus">Focus · ${escapeHtmlSafe(focus)}</div>` : ''}
        </div>
        <span class="chip chip-info">${blocks.length} blocks</span>
      </div>
      ${blocksHtml}
    </div>
  `;
}

function renderExerciseRow(ex) {
  const name = ex.name || '';
  const dose = ex.dose || '';
  const tempo = ex.tempo;
  const wp = ex.week_prescriptions || [];

  // If there are week prescriptions, render a 4-week table beneath the row
  if (wp.length) {
    return `
      <div class="exercise-row">
        <span class="exercise-name">${escapeHtmlSafe(name)}</span>
        <span class="exercise-dose">${escapeHtmlSafe(tempo || '')}</span>
      </div>
      <table class="week-prescription-table">
        <thead>
          <tr>
            <th>WK 1 · BASE</th>
            <th>WK 2 · TEMPO</th>
            <th>WK 3 · STRENGTH</th>
            <th>WK 4 · PEAK</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            ${[1,2,3,4].map(n => {
              const w = wp.find(x => x.week === n);
              if (!w) return '<td class="exercise-cell">—</td>';
              return `<td class="exercise-cell"><strong>${w.sets}×${w.reps}</strong>${w.weight ? ` · @ ${w.weight} ${w.weight_unit || 'lb'}` : ''}<br><span style="font-size: 10px; color: var(--cream-faint);">${escapeHtmlSafe(w.intent_label || '')}${w.rpe ? ' · RPE ' + w.rpe : ''}${w.tempo_note ? ' · ' + w.tempo_note : ''}</span></td>`;
            }).join('')}
          </tr>
        </tbody>
      </table>
    `;
  }

  // Plain exercise row
  return `
    <div class="exercise-row">
      <span class="exercise-name">${escapeHtmlSafe(name)}</span>
      <span class="exercise-dose">${escapeHtmlSafe(dose)}</span>
    </div>
  `;
}

function renderReviewStaticTab(tab, program) {
  const main = document.getElementById('review-main');
  const a = program.assessment || {};
  if (tab === 'nutrition') {
    const bc = a.body_comp || {};
    const targets = bc.nutrition_targets || {};
    const hasTargets = targets && targets.calories;
    main.innerHTML = `
      <div class="session-card">
        <div class="session-head">
          <div class="day-title flourish">Nutrition · <em>Daily Targets</em></div>
        </div>
        ${hasTargets ? `
          <div class="dash-grid" style="margin-top: 10px;">
            <div class="stat-card"><span class="stat-label">Calories</span><span class="stat-num">${escapeHtmlSafe(targets.calories)}</span></div>
            <div class="stat-card"><span class="stat-label">Protein</span><span class="stat-num">${escapeHtmlSafe(targets.protein)}</span></div>
            <div class="stat-card"><span class="stat-label">Carbs</span><span class="stat-num">${escapeHtmlSafe(targets.carbs)}</span></div>
            <div class="stat-card"><span class="stat-label">Fat</span><span class="stat-num">${escapeHtmlSafe(targets.fat)}</span></div>
          </div>
          <p class="help" style="margin-top: 14px;">Water · ${escapeHtmlSafe(targets.water || '')}</p>
        ` : `
          <p class="help">No body comp data → using general nutrition guidance copy. Targets render only when BOD POD lean mass is present.</p>
        `}
      </div>
    `;
  } else if (tab === 'recovery') {
    main.innerHTML = `
      <div class="session-card">
        <div class="session-head"><div class="day-title flourish">Recovery · <em>Routines</em></div></div>
        <p class="help" style="margin-top: 8px;">Each session ends with assisted recovery — Hypervolt, capsule work (PAIL/RAIL), and decompression. The exact cool-down list lives inside each session card; the program also includes a daily 4-step mobility maintenance routine.</p>
      </div>
    `;
  } else if (tab === 'notes') {
    main.innerHTML = `
      <div class="session-card">
        <div class="session-head"><div class="day-title flourish">Coach <em>Notes</em></div></div>
        <p class="help" style="margin-top: 8px;">${escapeHtmlSafe(a.concern_notes || a.background || 'No notes captured.')}</p>
      </div>
    `;
  }
}

function renderCoachPanel(program) {
  const panel = document.getElementById('coach-panel');
  const a = program.assessment || {};

  const priorities = a.fra_priorities || [];
  const constraints = a.constraints || [];
  const concerns = a.concerns || [];
  const tests = a.strength_marker_tests || [];
  const cardio = a.cardio_profile || {};

  // Detect anchor warnings: tests with no exercise_name match in program
  const anchorWarnings = [];
  (program.weeks || []).forEach(w => {
    (w.sessions || []).forEach(s => {
      (s.blocks || []).forEach(b => {
        (b.exercises || []).forEach(e => {
          if (e.anchor_match_method && ['fuzzy', 'category'].includes(e.anchor_match_method)) {
            anchorWarnings.push(`${e.name} · ${e.anchor_match_method} match (${e.anchor_source_name || '—'})`);
          }
        });
      });
    });
  });

  let html = `
    <h4>Coach Logic</h4>

    <div class="panel-block">
      <div class="label">Priorities (${priorities.length})</div>
      ${priorities.length ?
        `<ul>${priorities.map(p => `<li>${escapeHtmlSafe(p.description || p)}</li>`).join('')}</ul>` :
        `<div class="value" style="color: var(--cream-faint); font-style: italic;">None set</div>`}
    </div>

    <div class="panel-block">
      <div class="label">Constraints (${constraints.length})</div>
      ${constraints.length ?
        `<ul>${constraints.map(c => `<li>${escapeHtmlSafe(formatConstraintLabel(c))}</li>`).join('')}</ul>` :
        `<div class="value" style="color: var(--cream-faint); font-style: italic;">None</div>`}
    </div>

    <div class="panel-block">
      <div class="label">Concerns (${concerns.length})</div>
      ${concerns.length ?
        `<ul>${concerns.map(c => `<li>${escapeHtmlSafe(formatConstraintLabel(c))}</li>`).join('')}</ul>` :
        `<div class="value" style="color: var(--cream-faint); font-style: italic;">None flagged</div>`}
    </div>

    <div class="panel-block">
      <div class="label">Strength anchors tested</div>
      <div class="value">${tests.length} test${tests.length === 1 ? '' : 's'}</div>
    </div>

    <div class="panel-block">
      <div class="label">Cardio</div>
      <div class="value">Primary · ${escapeHtmlSafe(cardio.primary_modality || 'not set')}</div>
    </div>
  `;

  if (anchorWarnings.length) {
    html += `<hr style="border: 0; border-top: 1px solid var(--divider); margin: 14px 0;">`;
    anchorWarnings.slice(0, 3).forEach(w => {
      html += `<div class="warning"><span class="warn-title">Soft anchor match</span>${escapeHtmlSafe(w)}</div>`;
    });
    if (anchorWarnings.length > 3) {
      html += `<p class="help" style="font-size: 11px;">+ ${anchorWarnings.length - 3} more soft matches</p>`;
    }
  }

  panel.innerHTML = html;
}

/* ---------------- 11. INIT ---------------- */

// Flask path → SPA hash. Lets a coach land at /generator or /assessment
// and the SPA opens directly on the wizard. Bare / and /dashboard
// open the dashboard.
function pathToHash(pathname) {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  if (p === '/generator' || p === '/assessment') return '#/assessment/new';
  // /dashboard, /, anything else handled by Flask -> dashboard view here
  return '';
}

function init() {
  buildStepper();
  bindSidebar();
  bindActions();
  bindStatusSelectors();
  bindActionBar();
  bindFormChangesForLiveUpdate();

  // Initial route: prefer explicit hash, else translate the Flask path,
  // else fall back to dashboard.
  const fromPath = pathToHash(window.location.pathname);
  const route = window.location.hash || fromPath || '#/';
  navigate(route);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
