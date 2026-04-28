/* ============================================================
   IMS Coach OS · Program Review
   Three-pane editable view of the generated program JSON.
   - Loads /api/demo/program (falls back to /mock_amanda.json)
   - Coach can: replace exercises, edit dose, add notes,
     mark coach-only, log session notes, push to calendar.
   - Persists to localStorage (forward-compatible with Supabase).
   ============================================================ */

(function () {
  /* ── State ──────────────────────────────────────────── */
  const state = {
    program: null,
    programId: null,           // derived from client name + block
    activeWeek: 1,
    activeTab: null,           // 'nutrition' | 'recovery' | 'notes' | null
    libraryItems: null,        // cached on first drawer open
    review: null,              // {status, replacements, doseEdits, coachNotes, coachOnly}
    pendingReplaceTarget: null,
    pendingDoseTarget: null,
    pendingNoteTarget: null,
    pendingSessionTarget: null,
  };

  function programId(p) {
    const name = (p.client_name || p.assessment?.name || 'client').toLowerCase().replace(/\s+/g, '_');
    return `${name}_block${p.block_number || 1}`;
  }

  function exerciseKey(weekNum, sessionIdx, blockIdx, exIdx) {
    return `w${weekNum}_s${sessionIdx}_b${blockIdx}_e${exIdx}`;
  }

  function sessionKey(weekNum, sessionIdx) {
    return `w${weekNum}_s${sessionIdx}`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ── Boot ───────────────────────────────────────────── */
  async function boot() {
    try {
      const program = await IMSApi.fetchDemoProgram();
      state.program = program;
      state.programId = programId(program);
      state.review = IMSStorage.getPlanReview(state.programId);
      renderTitle();
      renderWeekNav();
      renderActiveView();
      renderRightPanel();
      renderStatusPill();
      bindActionBar();
      bindModals();
    } catch (err) {
      document.getElementById('pr-main').innerHTML =
        `<p class="help">Could not load program — ${escapeHtml(err.message)}</p>`;
    }
  }

  /* ── Title + status ─────────────────────────────────── */
  function renderTitle() {
    const p = state.program;
    const name = p.client_name || p.assessment?.name || 'Client';
    document.getElementById('pr-client-name').textContent = name;
    document.getElementById('pr-left-title').textContent =
      `Block ${p.block_number || 1}`;
  }

  function renderStatusPill() {
    const pill = document.getElementById('pr-status');
    const s = state.review.status || 'draft';
    pill.className = 'status-pill ' + s;
    pill.textContent = s;
    const saved = state.review.lastSavedAt;
    document.getElementById('pr-saved-at').textContent =
      saved ? `Saved ${new Date(saved).toLocaleString()}` : '';
  }

  /* ── Left nav: weeks + nutrition/recovery/notes ─────── */
  function renderWeekNav() {
    const nav = document.getElementById('pr-week-nav');
    const weeks = state.program.weeks || [];
    nav.innerHTML =
      weeks
        .map(
          (w) => `
        <div class="nav-link ${
          state.activeTab === null && w.week_number === state.activeWeek ? 'active' : ''
        }" data-week="${w.week_number}">
          <span>Week ${w.week_number}</span>
          <span class="small">${escapeHtml((w.intent || '').slice(0, 14))}</span>
        </div>`,
        )
        .join('') +
      `
        <div class="nav-link ${state.activeTab === 'nutrition' ? 'active' : ''}" data-tab="nutrition">
          <span>Nutrition</span><span class="small">Macros</span>
        </div>
        <div class="nav-link ${state.activeTab === 'recovery' ? 'active' : ''}" data-tab="recovery">
          <span>Recovery</span><span class="small">Routines</span>
        </div>
        <div class="nav-link ${state.activeTab === 'notes' ? 'active' : ''}" data-tab="notes">
          <span>Notes</span><span class="small">Coach</span>
        </div>`;

    nav.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        if (link.dataset.week) {
          state.activeWeek = parseInt(link.dataset.week, 10);
          state.activeTab = null;
        } else {
          state.activeTab = link.dataset.tab;
        }
        renderWeekNav();
        renderActiveView();
      });
    });
  }

  /* ── Center pane ────────────────────────────────────── */
  function renderActiveView() {
    if (state.activeTab === 'nutrition') return renderNutrition();
    if (state.activeTab === 'recovery') return renderRecovery();
    if (state.activeTab === 'notes') return renderNotes();
    return renderWeek(state.activeWeek);
  }

  function renderWeek(weekNum) {
    const main = document.getElementById('pr-main');
    const week = (state.program.weeks || []).find((w) => w.week_number === weekNum);
    if (!week) {
      main.innerHTML = '<p class="help">Week not found.</p>';
      return;
    }
    let html = `
      <div class="card" style="padding:16px 20px;">
        <span class="eyebrow">Week ${weekNum}</span>
        <div class="display" style="font-size:24px;margin-top:4px;">
          ${escapeHtml(week.intent || '')}
        </div>
        ${
          week.progression_notes
            ? `<p class="help" style="margin-top:8px;">${escapeHtml(week.progression_notes)}</p>`
            : ''
        }
      </div>
    `;
    (week.sessions || []).forEach((session, sIdx) => {
      html += renderSessionCard(session, sIdx, weekNum);
    });
    main.innerHTML = html;
    bindSessionEvents();
  }

  function renderSessionCard(session, sIdx, weekNum) {
    const dayType = session.day_type || '';
    const focus = session.focus || '';
    const blocks = session.blocks || [];
    const dayLabel = (() => {
      if (dayType === 'cardio') return 'Cardio &amp; Recovery';
      if (dayType.startsWith('strength_lb')) return 'Lower Body Strength';
      if (dayType.startsWith('strength_ub')) return 'Upper Body Strength';
      if (dayType.startsWith('strength_full')) return 'Full Body Strength';
      return escapeHtml(dayType);
    })();
    const sKey = sessionKey(weekNum, sIdx);
    const sessionNotes = IMSStorage.getSessionNotes(state.programId);
    const hasNote = !!sessionNotes[sKey];

    const blocksHtml = blocks
      .map((block, bIdx) => renderBlock(block, weekNum, sIdx, bIdx))
      .join('');

    return `
      <div class="session-card">
        <div class="session-head">
          <div>
            <div class="day-num">Day ${session.day_number}</div>
            <div class="day-title flourish">Day ${session.day_number}. <em>${dayLabel}.</em></div>
            ${focus ? `<div class="day-focus">Focus · ${escapeHtml(focus)}</div>` : ''}
          </div>
          <div class="session-actions">
            <span class="chip chip-info">${blocks.length} blocks</span>
            ${hasNote ? '<span class="chip chip-complete">Notes</span>' : ''}
            <button class="btn-ghost" data-add-note data-week="${weekNum}" data-sidx="${sIdx}">
              ${hasNote ? 'Edit Session Note' : 'Add Session Note'}
            </button>
          </div>
        </div>
        ${blocksHtml}
      </div>
    `;
  }

  function renderBlock(block, weekNum, sIdx, bIdx) {
    const exHtml = (block.exercises || [])
      .map((ex, eIdx) => renderExerciseRow(ex, weekNum, sIdx, bIdx, eIdx))
      .join('');
    return `
      <div class="block-group">
        <div class="block-head">
          <span class="block-name">${escapeHtml(block.name)}</span>
          ${block.duration_note ? `<span class="block-note">${escapeHtml(block.duration_note)}</span>` : ''}
        </div>
        ${exHtml}
      </div>
    `;
  }

  function renderExerciseRow(ex, weekNum, sIdx, bIdx, eIdx) {
    const key = exerciseKey(weekNum, sIdx, bIdx, eIdx);
    const review = state.review;
    const replacement = review.replacements.find((r) => r.key === key);
    const display = replacement ? replacement.to : ex;

    const doseEdit = review.doseEdits[key];
    const dose = doseEdit ? doseEdit.dose : (display.dose || '');
    const coachNote = review.coachNotes[key];
    const isCoachOnly = !!review.coachOnly[key];
    const isModified = !!(replacement || doseEdit);

    const wp = display.week_prescriptions || [];
    const sourceLabel = display.library || display.source_library;

    let html = `
      <div class="exercise-row" data-key="${key}">
        <div class="exercise-name">
          <span>${escapeHtml(display.name || '')}</span>
          ${sourceLabel ? `<span class="src">${escapeHtml(sourceLabel)}</span>` : ''}
          ${isModified ? '<span class="badge-modified">Modified by coach</span>' : ''}
          ${isCoachOnly ? '<span class="badge-coach-only">Coach-only</span>' : ''}
        </div>
        <span class="exercise-dose">${escapeHtml(dose)}${
      display.tempo ? ' · ' + escapeHtml(display.tempo) : ''
    }</span>
        <div class="row-menu">
          <button class="row-menu-btn" data-menu-btn data-key="${key}">⋯</button>
          <div class="row-menu-pop" data-menu-pop>
            <button data-act="replace">Replace exercise</button>
            <button data-act="dose">Edit dose</button>
            <button data-act="note">Add coach note</button>
            <button data-act="coach-only">${isCoachOnly ? 'Show to client' : 'Mark coach-only'}</button>
            ${isModified ? '<button data-act="revert" class="danger">Revert to original</button>' : ''}
          </div>
        </div>
        ${
          coachNote
            ? `<div class="coach-note-inline">${escapeHtml(coachNote)}</div>`
            : ''
        }
      </div>
    `;

    if (wp.length) {
      html += `
        <table class="week-prescription-table">
          <thead>
            <tr>
              <th>WK 1</th><th>WK 2</th><th>WK 3</th><th>WK 4</th>
            </tr>
          </thead>
          <tbody><tr>
            ${[1, 2, 3, 4]
              .map((n) => {
                const w = wp.find((x) => x.week === n);
                if (!w) return '<td>—</td>';
                return `<td><strong>${w.sets}×${w.reps}</strong>${
                  w.weight ? ` · @ ${w.weight} ${w.weight_unit || 'lb'}` : ''
                }<br><span style="font-size:10px;color:var(--cream-faint);">${escapeHtml(
                  w.intent_label || '',
                )}${w.rpe ? ' · RPE ' + w.rpe : ''}${w.tempo_note ? ' · ' + w.tempo_note : ''}</span></td>`;
              })
              .join('')}
          </tr></tbody>
        </table>
      `;
    }
    return html;
  }

  /* ── Static tabs ────────────────────────────────────── */
  function renderNutrition() {
    const main = document.getElementById('pr-main');
    const a = state.program.assessment || {};
    const bc = a.body_comp || {};
    const t = bc.nutrition_targets || {};
    const has = !!t.calories;
    main.innerHTML = `
      <div class="session-card">
        <div class="session-head"><div class="day-title flourish">Nutrition · <em>Daily Targets</em></div></div>
        ${
          has
            ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:8px;">
                <div class="card"><span class="eyebrow">Calories</span><div style="font-size:18px;color:var(--cream);">${escapeHtml(
                  t.calories,
                )}</div></div>
                <div class="card"><span class="eyebrow">Protein</span><div style="font-size:18px;color:var(--cream);">${escapeHtml(
                  t.protein,
                )}</div></div>
                <div class="card"><span class="eyebrow">Carbs</span><div style="font-size:18px;color:var(--cream);">${escapeHtml(
                  t.carbs,
                )}</div></div>
                <div class="card"><span class="eyebrow">Fat</span><div style="font-size:18px;color:var(--cream);">${escapeHtml(
                  t.fat,
                )}</div></div>
              </div>
              <p class="help" style="margin-top:14px;">Water · ${escapeHtml(t.water || '')}</p>`
            : '<p class="help">No body comp data — using general guidance copy. Targets render only when BOD POD lean mass is present.</p>'
        }
      </div>
    `;
  }

  function renderRecovery() {
    document.getElementById('pr-main').innerHTML = `
      <div class="session-card">
        <div class="session-head"><div class="day-title flourish">Recovery · <em>Routines</em></div></div>
        <p class="help" style="margin-top:8px;">Each session ends with assisted recovery — Hypervolt, capsule (PAIL/RAIL), and decompression. Cool-down lists live inside each session card; the program also includes a daily 4-step mobility maintenance routine.</p>
      </div>
    `;
  }

  function renderNotes() {
    const a = state.program.assessment || {};
    document.getElementById('pr-main').innerHTML = `
      <div class="session-card">
        <div class="session-head"><div class="day-title flourish">Coach <em>Notes</em></div></div>
        <p class="help" style="margin-top:8px;">${escapeHtml(
          a.concern_notes || a.background || 'No notes captured.',
        )}</p>
      </div>
    `;
  }

  /* ── Right panel ────────────────────────────────────── */
  function renderRightPanel() {
    const right = document.getElementById('pr-right');
    const a = state.program.assessment || {};
    const priorities = a.fra_priorities || [];
    const constraints = a.constraints || [];
    const concerns = a.concerns || [];
    const tests = a.strength_marker_tests || [];
    const cardio = a.cardio_profile || {};

    // Soft anchor warnings
    const anchorWarnings = [];
    (state.program.weeks || []).forEach((w) =>
      (w.sessions || []).forEach((s) =>
        (s.blocks || []).forEach((b) =>
          (b.exercises || []).forEach((e) => {
            if (
              e.anchor_match_method &&
              ['fuzzy', 'category'].includes(e.anchor_match_method)
            ) {
              anchorWarnings.push(
                `${e.name} · ${e.anchor_match_method} match`,
              );
            }
          }),
        ),
      ),
    );

    // Replacement history
    const replacements = state.review.replacements || [];

    right.innerHTML = `
      <div class="panel-card">
        <h4>Coach <em>Logic</em></h4>
        <div class="panel-block">
          <div class="label">Priorities (${priorities.length})</div>
          ${
            priorities.length
              ? `<ul>${priorities
                  .map((p) => `<li>${escapeHtml(p.description || p)}</li>`)
                  .join('')}</ul>`
              : '<div class="muted" style="font-style:italic;">None set</div>'
          }
        </div>
        <div class="panel-block">
          <div class="label">Constraints (${constraints.length})</div>
          ${
            constraints.length
              ? `<ul>${constraints.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`
              : '<div class="muted" style="font-style:italic;">None</div>'
          }
        </div>
        <div class="panel-block">
          <div class="label">Concerns (${concerns.length})</div>
          ${
            concerns.length
              ? `<ul>${concerns.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`
              : '<div class="muted" style="font-style:italic;">None flagged</div>'
          }
        </div>
        <div class="panel-block">
          <div class="label">Strength anchors</div>
          <div class="value">${tests.length} test${tests.length === 1 ? '' : 's'}</div>
        </div>
        <div class="panel-block">
          <div class="label">Cardio</div>
          <div class="value">${escapeHtml(cardio.primary_modality || 'not set')}</div>
        </div>
      </div>

      ${
        anchorWarnings.length
          ? `<div class="panel-card">
               <h4>Missing Data <em>Warnings</em></h4>
               ${anchorWarnings
                 .slice(0, 5)
                 .map(
                   (w) =>
                     `<div class="warning"><span class="warn-title">Soft anchor match</span>${escapeHtml(
                       w,
                     )}</div>`,
                 )
                 .join('')}
               ${
                 anchorWarnings.length > 5
                   ? `<p class="help" style="font-size:11px;margin-top:6px;">+ ${
                       anchorWarnings.length - 5
                     } more</p>`
                   : ''
               }
             </div>`
          : ''
      }

      <div class="panel-card">
        <h4>Exercise <em>Swaps</em></h4>
        ${
          replacements.length
            ? `<ul style="list-style:none;padding:0;margin:0;">${replacements
                .map(
                  (r) =>
                    `<li style="padding:6px 0;border-bottom:1px solid var(--divider);font-size:11px;color:var(--cream-dim);">
                  <span style="text-decoration:line-through;color:var(--cream-faint);">${escapeHtml(
                    r.from?.name || '',
                  )}</span><br>
                  → <span style="color:var(--cream);">${escapeHtml(r.to?.name || '')}</span>
                </li>`,
                )
                .join('')}</ul>`
            : '<div class="muted" style="font-style:italic;font-size:12px;">No swaps yet.</div>'
        }
      </div>
    `;
  }

  /* ── Session events (delegated) ─────────────────────── */
  function bindSessionEvents() {
    // Open the row menu
    document.querySelectorAll('[data-menu-btn]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pop = btn.parentElement.querySelector('[data-menu-pop]');
        document
          .querySelectorAll('[data-menu-pop].open')
          .forEach((p) => p !== pop && p.classList.remove('open'));
        pop.classList.toggle('open');
      });
    });
    // Menu actions
    document.querySelectorAll('[data-menu-pop] button').forEach((b) => {
      b.addEventListener('click', (e) => {
        const pop = b.closest('[data-menu-pop]');
        const row = b.closest('.exercise-row');
        const key = row.dataset.key;
        const act = b.dataset.act;
        pop.classList.remove('open');
        handleExerciseAction(act, key);
      });
    });
    // Add session note buttons
    document.querySelectorAll('[data-add-note]').forEach((b) => {
      b.addEventListener('click', () => {
        openSessionNoteModal(parseInt(b.dataset.week, 10), parseInt(b.dataset.sidx, 10));
      });
    });
    // Click outside closes menus
    document.addEventListener('click', () => {
      document.querySelectorAll('[data-menu-pop].open').forEach((p) => p.classList.remove('open'));
    });
  }

  function handleExerciseAction(act, key) {
    const ex = findExerciseByKey(key);
    if (!ex) return;
    if (act === 'replace') openReplaceDrawer(key, ex);
    else if (act === 'dose') openDoseModal(key, ex);
    else if (act === 'note') openNoteModal(key, ex);
    else if (act === 'coach-only') toggleCoachOnly(key);
    else if (act === 'revert') revertExercise(key);
  }

  function findExerciseByKey(key) {
    const m = key.match(/^w(\d+)_s(\d+)_b(\d+)_e(\d+)$/);
    if (!m) return null;
    const [_, w, s, b, e] = m.map(Number);
    const wk = (state.program.weeks || []).find((x) => x.week_number === w);
    if (!wk) return null;
    return wk.sessions?.[s]?.blocks?.[b]?.exercises?.[e];
  }

  /* ── Replace drawer ─────────────────────────────────── */
  async function openReplaceDrawer(key, ex) {
    state.pendingReplaceTarget = { key, ex };
    const drawer = document.getElementById('drawer-replace');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');

    if (!state.libraryItems) {
      try {
        const data = await IMSApi.listExercises();
        state.libraryItems = data.exercises || [];
        populateDrawerFilters(state.libraryItems);
      } catch (err) {
        document.getElementById('drawer-list').innerHTML =
          `<p class="help">Could not load library — ${escapeHtml(err.message)}</p>`;
        return;
      }
    }
    renderDrawerList();
  }

  function populateDrawerFilters(items) {
    const sources = Array.from(new Set(items.map((i) => i.source_library).filter(Boolean))).sort();
    const cats = Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort();
    const uses = Array.from(
      new Set(items.flatMap((i) => i.program_uses || []).filter(Boolean)),
    ).sort();
    const set = (id, opts) => {
      const sel = document.getElementById(id);
      const first = sel.querySelector('option');
      sel.innerHTML = first.outerHTML + opts.map((o) => `<option value="${o}">${o}</option>`).join('');
    };
    set('lib-source', sources);
    set('lib-category', cats);
    set('lib-program-use', uses);
  }

  function renderDrawerList() {
    const list = document.getElementById('drawer-list');
    const q = (document.getElementById('lib-search').value || '').toLowerCase().trim();
    const src = document.getElementById('lib-source').value;
    const cat = document.getElementById('lib-category').value;
    const use = document.getElementById('lib-program-use').value;

    // Pre-filter by client concerns: knee bad → flag avoid/caution
    const concerns = (state.program.assessment?.concerns || []).map((c) => String(c).toLowerCase());
    const concernJoint = (() => {
      // map common concern keys to sensitivity keys
      if (concerns.some((c) => c.includes('knee'))) return 'knee';
      if (concerns.some((c) => c.includes('shoulder'))) return 'shoulder';
      if (concerns.some((c) => c.includes('back'))) return 'low_back';
      if (concerns.some((c) => c.includes('wrist'))) return 'wrist';
      return null;
    })();

    let items = state.libraryItems || [];
    items = items.filter((it) => {
      if (src && it.source_library !== src) return false;
      if (cat && it.category !== cat) return false;
      if (use && !(it.program_uses || []).includes(use)) return false;
      if (q) {
        const hay = `${it.name} ${(it.tags || []).join(' ')} ${it.movement_category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Score by concern sensitivity (safe first, caution mid, avoid last)
    items = items
      .map((it) => {
        let score = 0;
        if (concernJoint) {
          const s = it.sensitivity?.[concernJoint];
          if (s === 'safe') score += 2;
          else if (s === 'caution') score -= 1;
          else if (s === 'avoid') score -= 5;
        }
        return { it, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 200)
      .map((x) => x.it);

    if (!items.length) {
      list.innerHTML = '<p class="help" style="padding:18px 0;">No matches.</p>';
      return;
    }
    list.innerHTML = items
      .map((it) => {
        const sens = concernJoint ? it.sensitivity?.[concernJoint] : null;
        const sensBadge = sens
          ? `<span class="sens-badge sens-${sens}">${sens}</span>`
          : '';
        return `
          <div class="lib-row">
            <div>
              <div class="name">${escapeHtml(it.name)}</div>
              <div class="meta">
                ${escapeHtml(it.source_library || '')}${
          it.category ? ' · ' + escapeHtml(it.category) : ''
        }${it.movement_category ? ' · ' + escapeHtml(it.movement_category) : ''}
                ${sensBadge}
              </div>
            </div>
            <button class="pick" data-pick="${escapeHtml(it.id)}">Use</button>
          </div>
        `;
      })
      .join('');
    list.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.pick;
        const item = items.find((x) => x.id === id);
        if (item) commitReplacement(item);
      });
    });
  }

  function commitReplacement(item) {
    const target = state.pendingReplaceTarget;
    if (!target) return;
    const replacement = {
      key: target.key,
      from: { ...target.ex },
      to: {
        name: item.name,
        library: item.source_library,
        library_id: item.id,
        dose: item.default_dose || target.ex.dose || '',
        tempo: target.ex.tempo,
        rationale: item.rationale || '',
        week_prescriptions: target.ex.week_prescriptions || [],
        anchor_match_method: 'coach_replacement',
      },
      replacedAt: new Date().toISOString(),
    };
    // Replace any existing replacement for this key
    state.review.replacements = state.review.replacements.filter((r) => r.key !== target.key);
    state.review.replacements.push(replacement);
    closeDrawer();
    saveAndRerender('Exercise replaced');
  }

  function closeDrawer() {
    const d = document.getElementById('drawer-replace');
    d.classList.remove('open');
    d.setAttribute('aria-hidden', 'true');
    state.pendingReplaceTarget = null;
  }

  /* ── Dose / note / coach-only ──────────────────────── */
  function openDoseModal(key, ex) {
    state.pendingDoseTarget = key;
    const review = state.review;
    document.getElementById('dose-target').textContent = ex.name;
    document.getElementById('dose-input').value =
      review.doseEdits[key]?.dose || ex.dose || '';
    document.getElementById('dose-note').value =
      review.doseEdits[key]?.note || '';
    openModal('modal-dose');
  }
  function saveDose() {
    const key = state.pendingDoseTarget;
    if (!key) return;
    const dose = document.getElementById('dose-input').value;
    const note = document.getElementById('dose-note').value;
    state.review.doseEdits[key] = { dose, note };
    closeModal('modal-dose');
    saveAndRerender('Dose updated');
  }
  function openNoteModal(key, ex) {
    state.pendingNoteTarget = key;
    document.getElementById('note-target').textContent = ex.name;
    document.getElementById('note-input').value = state.review.coachNotes[key] || '';
    openModal('modal-note');
  }
  function saveNote() {
    const key = state.pendingNoteTarget;
    if (!key) return;
    const note = document.getElementById('note-input').value.trim();
    if (note) state.review.coachNotes[key] = note;
    else delete state.review.coachNotes[key];
    closeModal('modal-note');
    saveAndRerender('Note saved');
  }
  function toggleCoachOnly(key) {
    state.review.coachOnly[key] = !state.review.coachOnly[key];
    saveAndRerender(state.review.coachOnly[key] ? 'Marked coach-only' : 'Visible to client');
  }
  function revertExercise(key) {
    state.review.replacements = state.review.replacements.filter((r) => r.key !== key);
    delete state.review.doseEdits[key];
    saveAndRerender('Reverted to original');
  }

  /* ── Session note modal ─────────────────────────────── */
  function openSessionNoteModal(weekNum, sIdx) {
    const sKey = sessionKey(weekNum, sIdx);
    state.pendingSessionTarget = sKey;
    const all = IMSStorage.getSessionNotes(state.programId);
    const note = all[sKey] || {};
    document.getElementById('session-target').textContent = `Week ${weekNum} · Day ${sIdx + 1}`;
    document.getElementById('sn-completed').checked = !!note.completed;
    document.getElementById('sn-observation').value = note.observation || '';
    document.getElementById('sn-loads').value = note.loads || '';
    document.getElementById('sn-pain').value = note.pain || '';
    document.getElementById('sn-energy').value = note.energy || '';
    document.getElementById('sn-changes').value = note.changes || '';
    document.getElementById('sn-next').value = note.next || '';
    document.getElementById('sn-retest').checked = !!note.retest;
    openModal('modal-session');
  }
  function saveSessionNote() {
    const sKey = state.pendingSessionTarget;
    if (!sKey) return;
    const payload = {
      completed: document.getElementById('sn-completed').checked,
      observation: document.getElementById('sn-observation').value,
      loads: document.getElementById('sn-loads').value,
      pain: document.getElementById('sn-pain').value,
      energy: document.getElementById('sn-energy').value,
      changes: document.getElementById('sn-changes').value,
      next: document.getElementById('sn-next').value,
      retest: document.getElementById('sn-retest').checked,
    };
    IMSStorage.saveSessionNote(state.programId, sKey, payload);
    // Also try the backend (no-op if not wired)
    IMSApi.saveSessionNote({ program_id: state.programId, session_key: sKey, ...payload });
    closeModal('modal-session');
    showToast('Session note saved');
    renderActiveView();
  }

  /* ── Calendar push ──────────────────────────────────── */
  function openCalendarModal() {
    // Default Monday of next week
    const today = new Date();
    const dow = today.getDay();
    const daysToMon = (8 - dow) % 7 || 7;
    const next = new Date(today.getTime() + daysToMon * 86400000);
    document.getElementById('cal-start').valueAsDate = next;
    // Day toggles (Mon-Fri default)
    const days = document.getElementById('cal-days');
    days.innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      .map(
        (d, i) =>
          `<label style="font-size:11px;display:flex;align-items:center;gap:4px;color:var(--cream-dim);">
            <input type="checkbox" value="${i + 1}" ${i < 5 ? 'checked' : ''}> ${d}
          </label>`,
      )
      .join('');
    document.querySelectorAll('#cal-days input').forEach((c) => c.addEventListener('change', renderCalPreview));
    document.getElementById('cal-start').addEventListener('change', renderCalPreview);
    document.getElementById('cal-time').addEventListener('change', renderCalPreview);
    renderCalPreview();
    openModal('modal-calendar');
  }
  function gatherCalendarConfig() {
    return {
      start: document.getElementById('cal-start').value,
      time: document.getElementById('cal-time').value,
      trainer: document.getElementById('cal-trainer').value,
      room: document.getElementById('cal-room').value,
      days: Array.from(document.querySelectorAll('#cal-days input:checked')).map((c) =>
        parseInt(c.value, 10),
      ),
    };
  }
  function buildCalendarEvents() {
    const cfg = gatherCalendarConfig();
    const program = state.program;
    const weeks = program.weeks || [];
    if (!cfg.start || !cfg.days.length) return [];
    const startDate = new Date(cfg.start + 'T' + (cfg.time || '09:00') + ':00');
    const events = [];
    let dayCursor = 0;
    weeks.forEach((w) => {
      (w.sessions || []).forEach((s, sIdx) => {
        // Pick the next training day from cfg.days based on weekday
        let when = null;
        for (let probe = 0; probe < 60 && !when; probe++) {
          const cand = new Date(startDate.getTime() + (dayCursor + probe) * 86400000);
          // 1=Mon..7=Sun
          const dowMon = ((cand.getDay() + 6) % 7) + 1;
          if (cfg.days.includes(dowMon)) {
            when = cand;
            dayCursor = dayCursor + probe + 1;
          }
        }
        if (!when) return;
        events.push({
          id: `${state.programId}_${w.week_number}_${sIdx}`,
          program_id: state.programId,
          client_name: program.client_name || 'Client',
          week_number: w.week_number,
          day_number: s.day_number,
          session_type: s.day_type,
          focus: s.focus,
          trainer: cfg.trainer,
          room: cfg.room || null,
          start: when.toISOString(),
          duration_min: 60,
          link: `/program-review#w${w.week_number}d${sIdx}`,
        });
      });
    });
    return events;
  }
  function renderCalPreview() {
    const events = buildCalendarEvents();
    const wrap = document.getElementById('cal-preview');
    if (!events.length) {
      wrap.innerHTML = '<span class="muted">Select a start date and at least one training day to preview.</span>';
      return;
    }
    const sample = events.slice(0, 5);
    wrap.innerHTML = `
      <div class="eyebrow" style="margin-bottom:6px;">${events.length} events</div>
      ${sample
        .map(
          (e) => `<div style="padding:3px 0;">
        ${new Date(e.start).toLocaleString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })} · W${e.week_number} D${e.day_number} · ${escapeHtml(e.session_type || '')}
      </div>`,
        )
        .join('')}
      ${events.length > 5 ? `<div class="muted" style="margin-top:4px;">+ ${events.length - 5} more</div>` : ''}
    `;
  }
  async function commitCalendar() {
    const events = buildCalendarEvents();
    IMSStorage.saveCalendarEvents(state.programId, events);
    await IMSApi.saveCalendarEvents(events);
    state.review.status = 'scheduled';
    state.review = IMSStorage.savePlanReview(state.programId, state.review);
    closeModal('modal-calendar');
    renderStatusPill();
    showToast(`${events.length} events added to calendar`);
  }

  /* ── Modals ─────────────────────────────────────────── */
  function openModal(id) {
    document.getElementById(id).classList.add('open');
  }
  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }
  function bindModals() {
    document.querySelectorAll('[data-modal-cancel]').forEach((b) => {
      b.addEventListener('click', () => {
        b.closest('.ims-modal-backdrop').classList.remove('open');
      });
    });
    document.querySelectorAll('.ims-modal-backdrop').forEach((bg) => {
      bg.addEventListener('click', (e) => {
        if (e.target === bg) bg.classList.remove('open');
      });
    });
    document.getElementById('drawer-close').addEventListener('click', closeDrawer);
    ['lib-search', 'lib-source', 'lib-category', 'lib-program-use'].forEach((id) => {
      document.getElementById(id).addEventListener('input', renderDrawerList);
    });
    document.getElementById('dose-save').addEventListener('click', saveDose);
    document.getElementById('note-save').addEventListener('click', saveNote);
    document.getElementById('sn-save').addEventListener('click', saveSessionNote);
    document.getElementById('cal-save').addEventListener('click', commitCalendar);
  }

  /* ── Top action bar ─────────────────────────────────── */
  function bindActionBar() {
    document.getElementById('btn-save').addEventListener('click', () => {
      state.review = IMSStorage.savePlanReview(state.programId, state.review);
      // Try backend save (no-op if not wired)
      fetch('/api/program/review/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program_id: state.programId, review: state.review }),
      }).catch(() => {});
      renderStatusPill();
      showToast('Review saved');
    });
    document.getElementById('btn-approve').addEventListener('click', () => {
      state.review.status = 'approved';
      state.review = IMSStorage.savePlanReview(state.programId, state.review);
      renderStatusPill();
      showToast('Plan approved');
    });
    document.getElementById('btn-add-cal').addEventListener('click', openCalendarModal);

    const exportToast = (mode) => () =>
      showToast(`Export (${mode}) — Phase 5 will reuse existing PDF flow`);
    document.getElementById('btn-export-client').addEventListener('click', exportToast('client'));
    document.getElementById('btn-export-coach').addEventListener('click', exportToast('coach'));
    document.getElementById('btn-export-full').addEventListener('click', exportToast('full'));
  }

  /* ── Save + rerender helper ─────────────────────────── */
  function saveAndRerender(toast) {
    state.review = IMSStorage.savePlanReview(state.programId, state.review);
    renderStatusPill();
    renderRightPanel();
    renderActiveView();
    if (toast) showToast(toast);
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
