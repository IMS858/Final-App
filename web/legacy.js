/* ================================================================
   IMS · LEGACY FORM LOGIC
   Preserved from the original web/index.html (pre-redesign).
   These functions are the contract boundary with the Python generator:
   - collectData() builds the JSON payload that POST /api/generate consumes
   - addMobilityRow / addPriority / addAnchor build the repeating rows
   - constraint card helpers
   - HR recovery auto-calc
   - validate(), generatePlan(), saveToStorage(), loadFromStorage(), clearForm(), previewData()

   DO NOT modify these without re-running the test suite. The wizard UI
   (app.js) wraps and decorates these — it does not replace them.
   ================================================================ */

// ═══════════════════════════════════════════════════════════
// SETUP · populate dynamic sections
// ═══════════════════════════════════════════════════════════

const JOINT_OPTIONS = [
  "", "hip", "knee", "ankle", "shoulder", "elbow", "wrist",
  "thoracic", "cervical", "lumbar", "sacroiliac", "hamstring", "calf"
];
const DIRECTION_OPTIONS = [
  "", "IR", "ER", "flexion", "extension", "abduction", "adduction",
  "plantarflexion", "dorsiflexion", "inversion", "eversion",
  "pronation", "supination", "flexibility"
];
const SIDE_OPTIONS = ["", "L", "R", "bilateral"];

let mobilityRowId = 0;
let priorityRowId = 0;

function addMobilityRow(joint = "", direction = "", side = "", rating = "") {
  mobilityRowId++;
  const id = mobilityRowId;
  const container = document.getElementById('mobility-map');
  const row = document.createElement('div');
  row.className = 'mobility-row';
  row.dataset.mobilityRow = id;
  row.innerHTML = `
    <div class="field" style="margin:0;">
      <label class="field-label">Joint</label>
      <select class="mob-joint">
        ${JOINT_OPTIONS.map(j => `<option value="${j}" ${j === joint ? 'selected' : ''}>${j || 'select…'}</option>`).join('')}
      </select>
    </div>
    <div class="field" style="margin:0;">
      <label class="field-label">Direction</label>
      <select class="mob-direction">
        ${DIRECTION_OPTIONS.map(d => `<option value="${d}" ${d === direction ? 'selected' : ''}>${d || 'select…'}</option>`).join('')}
      </select>
    </div>
    <div class="field" style="margin:0;">
      <label class="field-label">Side</label>
      <select class="mob-side">
        ${SIDE_OPTIONS.map(s => `<option value="${s}" ${s === side ? 'selected' : ''}>${s || 'select…'}</option>`).join('')}
      </select>
    </div>
    <div class="tl-group">
      <input type="radio" id="mob-${id}-red" name="mob-rating-${id}" value="red" ${rating === 'red' ? 'checked' : ''}>
      <label for="mob-${id}-red" class="red">Red</label>
      <input type="radio" id="mob-${id}-yellow" name="mob-rating-${id}" value="yellow" ${rating === 'yellow' ? 'checked' : ''}>
      <label for="mob-${id}-yellow" class="yellow">Yellow</label>
      <input type="radio" id="mob-${id}-green" name="mob-rating-${id}" value="green" ${rating === 'green' ? 'checked' : ''}>
      <label for="mob-${id}-green" class="green">Green</label>
    </div>
    <button type="button" class="icon-btn remove-row" onclick="this.parentElement.remove()" aria-label="Remove row">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>
  `;
  container.appendChild(row);
}

function addPriority() {
  const container = document.getElementById('priorities-list');
  const count = container.querySelectorAll('.field').length + 1;
  const num = String(count).padStart(2, '0');
  const field = document.createElement('div');
  field.className = 'field';
  field.innerHTML = `
    <label class="field-label">Priority ${num}</label>
    <input type="text" name="priority" placeholder="e.g. Thoracic Extension">
  `;
  container.appendChild(field);
}

// ═══════════════════════════════════════════════════════════
// STRENGTH TESTING ANCHORS · collapsible cards
// ═══════════════════════════════════════════════════════════

let anchorId = 0;

const LOAD_STYLE_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "per_hand", label: "Per hand · DB" },
  { value: "total_load", label: "Total load · BB / trap bar" },
  { value: "cable_stack", label: "Cable stack · pin number" },
  { value: "machine_number", label: "Machine setting · number" },
  { value: "bodyweight_added", label: "Bodyweight + added load" },
  { value: "bodyweight_assisted", label: "Bodyweight − assistance" },
];

const MOVEMENT_CATEGORY_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "squat", label: "Squat (knee-dominant)" },
  { value: "hinge", label: "Hinge (hip-dominant)" },
  { value: "lunge", label: "Lunge / unilateral leg" },
  { value: "push_horizontal", label: "Horizontal push" },
  { value: "push_vertical", label: "Vertical push / overhead" },
  { value: "pull_horizontal", label: "Horizontal pull" },
  { value: "pull_vertical", label: "Vertical pull" },
  { value: "carry", label: "Carry / loaded gait" },
  { value: "core", label: "Core / antiextension" },
  { value: "other", label: "Other / specify in notes" },
];

const FORM_QUALITY_OPTIONS = [
  { value: "clean", label: "Clean", color: "var(--optimal)" },
  { value: "moderate", label: "Moderate", color: "var(--moderate)" },
  { value: "poor", label: "Poor", color: "var(--limited)" },
];

function addAnchor(prefill = {}) {
  anchorId++;
  const id = anchorId;
  const container = document.getElementById('anchors-list');
  const card = document.createElement('div');
  card.className = 'anchor-card';
  card.dataset.anchorId = id;

  const v = (k) => (prefill[k] != null ? String(prefill[k]) : '');
  const esc = (s) => String(s || '').replace(/"/g, '&quot;');

  card.innerHTML = `
    <div class="anchor-header" onclick="toggleAnchor(${id})">
      <span class="anchor-toggle">▸</span>
      <div class="anchor-title">
        <strong class="anchor-title-text">Anchor ${String(anchorId).padStart(2, '0')}</strong>
        <span class="anchor-summary empty">Tap to enter test data</span>
      </div>
      <span class="anchor-status" style="font-size: 10px; color: var(--cream-dim); letter-spacing: 0.1em;"></span>
      <button type="button" class="icon-btn" onclick="event.stopPropagation(); removeAnchor(${id})" aria-label="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <div class="anchor-body">
      <div class="field">
        <label class="field-label">Exercise Name</label>
        <input type="text" class="anchor-name" placeholder="e.g. DB Bench Press · Trap Bar Deadlift · Goblet Squat" value="${esc(v('exercise_name'))}">
      </div>

      <div class="field">
        <label class="field-label">Movement Category</label>
        <select class="anchor-category">
          ${MOVEMENT_CATEGORY_OPTIONS.map(o =>
            `<option value="${o.value}" ${v('movement_category') === o.value ? 'selected' : ''}>${o.label}</option>`
          ).join('')}
        </select>
      </div>

      <div class="field">
        <label class="field-label">Load Style</label>
        <select class="anchor-load-style" onchange="updateLoadStyleHelper(${id})">
          ${LOAD_STYLE_OPTIONS.map(o =>
            `<option value="${o.value}" ${v('load_style') === o.value ? 'selected' : ''}>${o.label}</option>`
          ).join('')}
        </select>
        <div class="load-style-helper" id="load-helper-${id}"></div>
      </div>

      <div class="field">
        <label class="field-label">Tested Rep Maxes <span style="font-weight:300; text-transform: none; letter-spacing: 0.05em; color: var(--cream-dim); font-size: 9px;">· enter only what you tested</span></label>
        <div class="rm-grid">
          ${[12, 10, 8, 6, 5, 3, 1].map(r => `
            <div class="rm-field">
              <label>${r}RM</label>
              <input type="number" min="0" step="0.5"
                     class="anchor-rm" data-reps="${r}"
                     placeholder="—" value="${v('tested_' + r + 'rm')}"
                     oninput="updateAnchorSummary(${id})">
            </div>
          `).join('')}
        </div>
      </div>

      <div class="field">
        <label class="field-label">Form Quality</label>
        <div class="btn-group form-quality-group">
          ${FORM_QUALITY_OPTIONS.map(o => `
            <input type="radio" id="fq-${id}-${o.value}" name="fq-${id}" value="${o.value}"
                   ${v('form_quality') === o.value ? 'checked' : ''}>
            <label for="fq-${id}-${o.value}">${o.label}</label>
          `).join('')}
        </div>
      </div>

      <div class="field">
        <label class="field-label">Pain or Compensation Notes <span style="font-weight:300; text-transform:none; letter-spacing:0.05em; color: var(--cream-dim); font-size: 9px;">· optional</span></label>
        <input type="text" class="anchor-pain" placeholder="e.g. Mild left shoulder pinch at lockout" value="${esc(v('pain_or_compensation_notes'))}">
      </div>

      <div class="field">
        <label class="field-label">Test Notes <span style="font-weight:300; text-transform:none; letter-spacing:0.05em; color: var(--cream-dim); font-size: 9px;">· what happened during the test</span></label>
        <input type="text" class="anchor-notes" placeholder="e.g. Clean lockouts at 70s · stopped 2 reps before failure" value="${esc(v('test_notes'))}">
      </div>

      <div class="field" style="margin-bottom: 0;">
        <label class="field-label">Coach Notes <span style="font-weight:300; text-transform:none; letter-spacing:0.05em; color: var(--cream-dim); font-size: 9px;">· internal · not shown to client</span></label>
        <input type="text" class="anchor-coach-notes" placeholder="e.g. Loads conservative · push next test · or · regress to DB if shoulder flares" value="${esc(v('coach_notes'))}">
      </div>
    </div>
  `;
  container.appendChild(card);
  updateLoadStyleHelper(id);
  updateAnchorSummary(id);

  // Auto-expand if there's prefill data, OR if it's the very first one
  if (Object.keys(prefill).length > 0 || container.querySelectorAll('.anchor-card').length === 1) {
    card.classList.add('expanded');
  }
}

function toggleAnchor(id) {
  const card = document.querySelector(`.anchor-card[data-anchor-id="${id}"]`);
  if (card) card.classList.toggle('expanded');
}

function removeAnchor(id) {
  const card = document.querySelector(`.anchor-card[data-anchor-id="${id}"]`);
  if (card) card.remove();
}

function updateLoadStyleHelper(id) {
  const card = document.querySelector(`.anchor-card[data-anchor-id="${id}"]`);
  if (!card) return;
  const select = card.querySelector('.anchor-load-style');
  const helper = card.querySelector(`#load-helper-${id}`);
  const helpers = {
    per_hand:           "Enter the weight in ONE hand. Generator doubles for total load.",
    total_load:         "Enter the total bar weight (including the bar itself).",
    cable_stack:        "Enter the pin number, not pounds.",
    machine_number:     "Enter the machine's setting / position number.",
    bodyweight_added:   "Enter the ADDITIONAL load on top of bodyweight.",
    bodyweight_assisted: "Enter how much weight is being SUBTRACTED via band/machine.",
  };
  helper.textContent = helpers[select.value] || "";
}

function updateAnchorSummary(id) {
  const card = document.querySelector(`.anchor-card[data-anchor-id="${id}"]`);
  if (!card) return;
  const name = card.querySelector('.anchor-name').value.trim();
  const rms = Array.from(card.querySelectorAll('.anchor-rm'))
    .filter(i => i.value !== '' && parseFloat(i.value) >= 0)
    .map(i => ({ reps: parseInt(i.dataset.reps, 10), weight: parseFloat(i.value) }));

  const titleEl = card.querySelector('.anchor-title-text');
  const summaryEl = card.querySelector('.anchor-summary');
  const statusEl = card.querySelector('.anchor-status');

  // Title · use exercise name if entered, else generic
  titleEl.textContent = name || `Anchor ${String(card.dataset.anchorId).padStart(2, '0')}`;

  // Summary line · best (heaviest reps→ lowest reps means highest load proxy)
  if (rms.length === 0) {
    summaryEl.textContent = name ? "No rep maxes entered yet" : "Tap to enter test data";
    summaryEl.classList.add('empty');
    statusEl.textContent = "";
    card.classList.remove('has-data');
  } else {
    // Pick lowest-rep entry (closest to 1RM)
    rms.sort((a, b) => a.reps - b.reps);
    const top = rms[0];
    const styleEl = card.querySelector('.anchor-load-style');
    const styleSuffix = styleEl.value === 'per_hand' ? ' /hand'
                      : styleEl.value === 'bodyweight_added' ? ' added'
                      : styleEl.value === 'bodyweight_assisted' ? ' assist'
                      : '';
    const num = top.weight === Math.floor(top.weight) ? Math.floor(top.weight) : top.weight;
    summaryEl.textContent = `${num} lb${styleSuffix} × ${top.reps}` + (rms.length > 1 ? `  ·  +${rms.length - 1} more` : '');
    summaryEl.classList.remove('empty');
    statusEl.textContent = `${rms.length} ${rms.length === 1 ? 'value' : 'values'}`;
    card.classList.add('has-data');
  }
}

// Initial rows
function initForm() {
  // Start with one empty anchor card · keeps it inviting but uncluttered
  addAnchor();
  addMobilityRow('hip', 'IR', 'L', '');
  addMobilityRow('hip', 'IR', 'R', '');
  addMobilityRow('shoulder', 'ER', 'L', '');
}

// Run init on DOMContentLoaded, or immediately if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initForm);
} else {
  initForm();
}


// ═══════════════════════════════════════════════════════════
// CONSTRAINT CARDS · expand on checkbox, collapse on uncheck
// ═══════════════════════════════════════════════════════════

const SIDE_CONSTRAINT_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "bilateral", label: "Bilateral" },
  { value: "general", label: "General / N/A" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "active_flare_up", label: "Active flare-up" },
  { value: "history", label: "History · not active" },
  { value: "cleared", label: "Cleared by provider" },
  { value: "post_surgery", label: "Post-surgery" },
  { value: "avoid_loading", label: "Avoid loading" },
];

// Map constraint key → card DOM id
function _ckey(key) { return 'constraint-card-' + key.replace(/[^a-z0-9_]/gi, '_'); }

function toggleConstraintCard(key, displayName) {
  const checkbox = document.querySelector(`input[name="constraint"][value="${key}"]`);
  const container = document.getElementById('constraint-cards');
  const cardId = _ckey(key);
  const existing = document.getElementById(cardId);

  if (checkbox && checkbox.checked) {
    if (!existing) {
      const card = buildConstraintCard(key, displayName, cardId);
      container.appendChild(card);
    }
  } else if (existing) {
    existing.remove();
  }
}

function syncOtherConstraintCard(value) {
  const v = (value || '').trim();
  const cardId = 'constraint-card-other';
  const existing = document.getElementById(cardId);
  const container = document.getElementById('other-constraint-card');
  if (v && !existing) {
    const card = buildConstraintCard('other', v || 'Other', cardId);
    container.appendChild(card);
  } else if (!v && existing) {
    existing.remove();
  } else if (v && existing) {
    // Update title text live
    const titleEl = existing.querySelector('.anchor-title-text');
    if (titleEl) titleEl.textContent = v;
  }
}

function buildConstraintCard(key, displayName, cardId) {
  const card = document.createElement('div');
  card.className = 'anchor-card expanded';   // reuse anchor styling, expanded by default
  card.id = cardId;
  card.dataset.constraintKey = key;

  card.innerHTML = `
    <div class="anchor-header" onclick="this.parentElement.classList.toggle('expanded')">
      <span class="anchor-toggle">▸</span>
      <div class="anchor-title">
        <strong class="anchor-title-text">${escapeHtml(displayName)}</strong>
        <span class="anchor-summary empty">Tap to fill side, status, pain, and notes</span>
      </div>
      <span style="flex: 0 0 auto; font-size: 10px; color: var(--cream-dim); letter-spacing: 0.1em; padding-right: 12px;">CONSTRAINT</span>
    </div>

    <div class="anchor-body">
      <div class="field">
        <label class="field-label">Side</label>
        <select class="constraint-side">
          ${SIDE_CONSTRAINT_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label class="field-label">Status</label>
        <select class="constraint-status">
          ${STATUS_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label class="field-label">Pain Level <span style="font-weight:300; text-transform:none; letter-spacing:0.05em; color: var(--cream-dim); font-size: 9px;">· 0-10 · optional</span></label>
        <input type="number" min="0" max="10" step="1" class="constraint-pain" placeholder="0">
      </div>

      <div class="field">
        <label class="field-label">Avoid · what NOT to do</label>
        <input type="text" class="constraint-avoid" placeholder="e.g. deep flexion under load, overhead pressing">
      </div>

      <div class="field">
        <label class="field-label">Allowed · what IS okay</label>
        <input type="text" class="constraint-allowed" placeholder="e.g. pain-free range only, supported variants">
      </div>

      <div class="field" style="margin-bottom: 0;">
        <label class="field-label">Coach Notes <span style="font-weight:300; text-transform:none; letter-spacing:0.05em; color: var(--cream-dim); font-size: 9px;">· internal</span></label>
        <input type="text" class="constraint-coach-notes" placeholder="e.g. cleared by PT in March, monitor with QL bracing cue">
      </div>
    </div>
  `;
  return card;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                         .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function collectConstraintsRich() {
  // Returns array of structured constraint objects · always includes the
  // original `key` so the picker can match against legacy logic.
  const cards = Array.from(document.querySelectorAll('#constraint-cards .anchor-card, #other-constraint-card .anchor-card'));
  return cards.map(card => {
    const key = card.dataset.constraintKey;
    const titleEl = card.querySelector('.anchor-title-text');
    const display = titleEl ? titleEl.textContent.trim() : key;
    return {
      key: key,
      display_name: display,
      side: (card.querySelector('.constraint-side')?.value || '').trim() || null,
      status: (card.querySelector('.constraint-status')?.value || '').trim() || null,
      pain_level: parseInt(card.querySelector('.constraint-pain')?.value || '', 10) || null,
      avoid_notes: (card.querySelector('.constraint-avoid')?.value || '').trim() || null,
      allowed_notes: (card.querySelector('.constraint-allowed')?.value || '').trim() || null,
      coach_notes: (card.querySelector('.constraint-coach-notes')?.value || '').trim() || null,
    };
  });
}


// ═══════════════════════════════════════════════════════════
// LIVE UI HELPERS · HR drop, constraint card summary, preview
// ═══════════════════════════════════════════════════════════

function recomputeHrDrop() {
  const endEl = document.getElementById('hrr-end-hr');
  const oneEl = document.getElementById('hrr-one-min-hr');
  const dropEl = document.getElementById('hrr-drop-one-min');
  const hintEl = document.getElementById('hrr-quality-hint');
  if (!endEl || !oneEl || !dropEl) return;

  const end = parseInt(endEl.value, 10);
  const one = parseInt(oneEl.value, 10);
  if (Number.isFinite(end) && Number.isFinite(one) && end >= 0 && one >= 0) {
    const drop = Math.max(0, end - one);
    // Only auto-fill if the field is empty OR matches the previous auto-value
    // (so a coach-typed override is preserved).
    if (!dropEl.value || dropEl.dataset.auto === '1') {
      dropEl.value = String(drop);
      dropEl.dataset.auto = '1';
    }
    if (hintEl) {
      let q = '';
      if (drop >= 18) q = ' · STRONG recovery';
      else if (drop >= 12) q = ' · Normal recovery';
      else if (drop > 0) q = ' · Poor recovery (program will use joint-friendly options)';
      hintEl.textContent = `Drop ≥18 = strong · 12-17 = normal · <12 = poor.  Current drop · ${drop} bpm${q}`;
    }
  }
}

// Mark the drop field as user-overridden if the coach types into it directly.
document.addEventListener('DOMContentLoaded', () => {
  const dropEl = document.getElementById('hrr-drop-one-min');
  if (dropEl) {
    dropEl.addEventListener('input', () => { dropEl.dataset.auto = '0'; });
  }
});

function _updateConstraintCardSummary(card) {
  if (!card) return;
  const summaryEl = card.querySelector('.anchor-summary');
  if (!summaryEl) return;
  const side = (card.querySelector('.constraint-side')?.value || '').trim();
  const status = (card.querySelector('.constraint-status')?.value || '').trim();
  const pain = (card.querySelector('.constraint-pain')?.value || '').trim();
  const avoid = (card.querySelector('.constraint-avoid')?.value || '').trim();

  const parts = [];
  if (status) parts.push(status.replace(/_/g, ' '));
  if (side) parts.push(side);
  if (pain !== '') parts.push(`pain ${pain}/10`);
  if (avoid) parts.push(`avoid: ${avoid.length > 30 ? avoid.slice(0, 30) + '…' : avoid}`);

  if (parts.length === 0) {
    summaryEl.textContent = 'Tap to fill side, status, pain, and notes';
    summaryEl.classList.add('empty');
  } else {
    summaryEl.textContent = parts.join(' · ');
    summaryEl.classList.remove('empty');
  }
}

// Listen for any input inside a constraint card · update its summary line live.
document.addEventListener('input', (e) => {
  const card = e.target.closest && e.target.closest('.anchor-card[data-constraint-key]');
  if (card) _updateConstraintCardSummary(card);
});
document.addEventListener('change', (e) => {
  const card = e.target.closest && e.target.closest('.anchor-card[data-constraint-key]');
  if (card) _updateConstraintCardSummary(card);
});

function previewData() {
  let data;
  try { data = collectData(); }
  catch (err) { alert('Could not collect form data: ' + err.message); return; }
  // Strip diagnostic-only fields the user doesn't need to see
  const cleaned = { ...data };
  delete cleaned._incompleteMobilityRows;

  const json = JSON.stringify(cleaned, null, 2);
  // Build a modal dialog that shows the JSON with copy + close
  const existing = document.getElementById('preview-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'preview-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(11, 30, 49, 0.92); z-index: 300;
    display: flex; align-items: center; justify-content: center; padding: 40px;
  `;
  modal.innerHTML = `
    <div style="background: var(--navy); border: 1px solid var(--sky); max-width: 900px; width: 100%; max-height: 90vh; display: flex; flex-direction: column;">
      <div style="padding: 16px 24px; border-bottom: 1px solid var(--divider); display: flex; align-items: center; justify-content: space-between;">
        <strong style="font-family: var(--sans); letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px; color: var(--cream);">Preview · Collected Form Data (JSON)</strong>
        <button id="preview-close" class="btn ghost" style="padding: 6px 14px; font-size: 10px;">Close</button>
      </div>
      <pre style="flex: 1; overflow: auto; margin: 0; padding: 20px; color: var(--cream-dim); font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 11px; line-height: 1.5; background: rgba(0,0,0,0.2); white-space: pre-wrap; word-break: break-word;">${json.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>
      <div style="padding: 16px 24px; border-top: 1px solid var(--divider); display: flex; gap: 12px; justify-content: flex-end;">
        <button id="preview-copy" class="btn ghost" style="padding: 10px 20px;">Copy JSON</button>
        <button id="preview-close-2" class="btn" style="padding: 10px 20px;">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#preview-close').addEventListener('click', close);
  modal.querySelector('#preview-close-2').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('#preview-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json);
      showToast('✓ JSON copied to clipboard');
    } catch (err) {
      alert('Copy failed · select and copy manually');
    }
  });
}


// ═══════════════════════════════════════════════════════════
// COLLECT form data into the shape the generator expects
// ═══════════════════════════════════════════════════════════

function collectData() {
  const form = document.getElementById('assessment-form');
  const fd = new FormData(form);

  // Basics
  const name = (fd.get('name') || '').trim();
  const assessmentDate = (fd.get('assessment_date') || '').trim();
  const ageRange = (fd.get('age_range') || '').trim();
  const sex = fd.get('sex') || '';
  const background = (fd.get('background') || '').trim();
  const strengthDays = parseInt(fd.get('strength_days') || '3', 10);
  const cardioDays = parseInt(fd.get('cardio_days') || '1', 10);
  const frequency = strengthDays + cardioDays;  // total days (for back-compat)
  const primaryGoal = (fd.get('primary_goal') || '').trim();

  // Priorities
  const priorities = Array.from(document.querySelectorAll('#priorities-list input[name="priority"]'))
    .map(i => i.value.trim())
    .filter(v => v);

  // Mobility map · keep ALL rows (validator catches incomplete ones, not the filter)
  const mobilityRows = Array.from(document.querySelectorAll('#mobility-map .mobility-row'));
  const mobilityMapAll = mobilityRows.map((row, idx) => {
    const joint = row.querySelector('.mob-joint').value;
    const direction = row.querySelector('.mob-direction').value;
    const side = row.querySelector('.mob-side').value;
    const rating = row.querySelector('input[type="radio"]:checked')?.value || '';
    return { _rowIndex: idx + 1, joint, direction, side, rating };
  });
  // For output, keep only complete rows (but preserve the row list for validation messages)
  const mobilityMap = mobilityMapAll
    .filter(r => r.joint && r.direction && r.rating)
    .map(({ _rowIndex, ...r }) => r);

  // Strength Testing Anchors · collapsible cards
  const anchorCards = Array.from(document.querySelectorAll('#anchors-list .anchor-card'));
  const strengthMarkerTests = [];   // NEW · rich format
  const markers = [];               // legacy · slug list
  const markerResults = {};         // legacy · {slug: "result string"}

  anchorCards.forEach(card => {
    const name = card.querySelector('.anchor-name').value.trim();
    const category = card.querySelector('.anchor-category')?.value || null;
    const loadStyle = card.querySelector('.anchor-load-style').value || null;
    const formQualityEl = card.querySelector('.form-quality-group input[type="radio"]:checked');
    const formQuality = formQualityEl ? formQualityEl.value : null;
    const pain = card.querySelector('.anchor-pain').value.trim();
    const notes = card.querySelector('.anchor-notes').value.trim();
    const coachNotes = card.querySelector('.anchor-coach-notes')?.value?.trim() || '';

    // Pull rep maxes
    const rmFields = {};
    let hasAnyRm = false;
    card.querySelectorAll('.anchor-rm').forEach(input => {
      const reps = parseInt(input.dataset.reps, 10);
      const raw = input.value.trim();
      if (raw === '') return;
      const num = parseFloat(raw);
      if (Number.isNaN(num) || num < 0) return;
      rmFields[`tested_${reps}rm`] = num;
      hasAnyRm = true;
    });

    // Skip cards with no name AND no rep maxes (truly empty)
    if (!name && !hasAnyRm) return;

    // NEW format · richer test object
    strengthMarkerTests.push({
      exercise_name: name || null,
      movement_category: category || null,
      load_style: loadStyle,
      load_unit: 'lb',  // form is lb-only for now
      form_quality: formQuality,
      pain_or_compensation_notes: pain || null,
      test_notes: notes || null,
      coach_notes: coachNotes || null,
      ...rmFields,
    });

    // LEGACY format · keep populated so existing generator paths still see something
    if (name) {
      const slug = name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_');
      markers.push(slug);

      // Build a human-readable result string from the highest tested RM
      const sortedRms = Object.entries(rmFields)
        .map(([k, v]) => ({ reps: parseInt(k.match(/_(\d+)rm/)[1], 10), weight: v }))
        .sort((a, b) => a.reps - b.reps);
      if (sortedRms.length > 0) {
        const top = sortedRms[0];
        const styleSuffix = loadStyle === 'per_hand' ? ' lb/hand' : ' lb';
        markerResults[slug] = `${top.weight}${styleSuffix} × ${top.reps}`;
      } else {
        markerResults[slug] = name;
      }
      markerResults[slug + '__display'] = name;
    }
  });

  // Constraints · legacy flat list AND structured rich list
  const constraints = Array.from(document.querySelectorAll('input[name="constraint"]:checked'))
    .map(el => el.value);
  const otherConstraint = (fd.get('other_constraint') || '').trim();
  if (otherConstraint) constraints.push(otherConstraint);
  const constraintsRich = collectConstraintsRich();

  // Concerns · checkbox-driven joint flags + free-text notes
  const concerns = Array.from(document.querySelectorAll('input[name="concern"]:checked'))
    .map(el => el.value);
  const concernNotes = (fd.get('concern_notes') || '').trim();

  // Strength C accessory categories (06d)
  const accessoryCategories = Array.from(document.querySelectorAll('input[name="accessory_categories"]:checked'))
    .map(el => el.value);

  // Cardio Capacity & Machine Tolerance
  const cardioPrimary = (fd.get('cardio_primary') || '').trim() || null;
  const cardioSecondary = Array.from(document.querySelectorAll('input[name="cardio_secondary"]:checked'))
    .map(el => el.value);
  const cardioAvoid = Array.from(document.querySelectorAll('input[name="cardio_avoid"]:checked'))
    .map(el => el.value);
  const cardioLimitations = Array.from(document.querySelectorAll('input[name="cardio_limitation"]:checked'))
    .map(el => el.value);

  // Interval clearance · radio · "not_assessed" maps to no flag at all
  const intervalClearance = (fd.get('interval_clearance') || 'not_assessed').trim();
  if (intervalClearance === 'cleared_for_intervals' || intervalClearance === 'not_cleared_for_intervals') {
    if (!cardioLimitations.includes(intervalClearance)) {
      cardioLimitations.push(intervalClearance);
    }
  }

  function _numOrNull(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function _strOrNull(v) {
    const s = (v || '').trim();
    return s || null;
  }

  const z2Test = {
    machine: _strOrNull(fd.get('z2_machine')),
    duration_minutes: _numOrNull(fd.get('z2_duration_minutes')),
    avg_hr: _numOrNull(fd.get('z2_avg_hr')),
    peak_hr: _numOrNull(fd.get('z2_peak_hr')),
    rpe: _numOrNull(fd.get('z2_rpe')),
    distance: _strOrNull(fd.get('z2_distance')),
    calories: _numOrNull(fd.get('z2_calories')),
    avg_watts: _numOrNull(fd.get('z2_avg_watts')),
    resistance_level: _strOrNull(fd.get('z2_resistance_level')),
    notes: _strOrNull(fd.get('z2_notes')),
    joint_tolerance_notes: _strOrNull(fd.get('z2_joint_tolerance_notes')),
  };

  const intervalTest = {
    machine: _strOrNull(fd.get('iv_machine')),
    protocol: _strOrNull(fd.get('iv_protocol')),
    work_seconds: _numOrNull(fd.get('iv_work_seconds')),
    rest_seconds: _numOrNull(fd.get('iv_rest_seconds')),
    rounds: _numOrNull(fd.get('iv_rounds')),
    peak_watts: _numOrNull(fd.get('iv_peak_watts')),
    avg_watts: _numOrNull(fd.get('iv_avg_watts')),
    peak_hr: _numOrNull(fd.get('iv_peak_hr')),
    ending_rpe: _numOrNull(fd.get('iv_ending_rpe')),
    joint_tolerance_notes: _strOrNull(fd.get('iv_joint_tolerance_notes')),
    recovery_notes: _strOrNull(fd.get('iv_recovery_notes')),
  };

  const hrRecovery = {
    end_hr: _numOrNull(fd.get('hrr_end_hr')),
    one_min_hr: _numOrNull(fd.get('hrr_one_min_hr')),
    drop_one_min: _numOrNull(fd.get('hrr_drop_one_min')),
  };

  const cardioProfile = {
    primary_modality: cardioPrimary,
    secondary_modalities: cardioSecondary,
    avoid_modalities: cardioAvoid,
    limitations: cardioLimitations,
    z2_baseline: z2Test,
    interval_test: intervalTest,
    hr_recovery: hrRecovery,
  };

  // Body comp (only include if any field filled)
  const bcWeight = (fd.get('bc_weight') || '').trim();
  const bcBf = (fd.get('bc_body_fat') || '').trim();
  const bcLean = (fd.get('bc_lean_mass') || '').trim();
  const bcFat = (fd.get('bc_fat_mass') || '').trim();
  const bcMethod = (fd.get('bc_method') || '').trim();
  const bcDate = (fd.get('bc_date') || '').trim();
  const hasBc = bcWeight || bcBf || bcLean || bcFat;

  const bodyComp = hasBc ? {
    weight: bcWeight,
    body_fat: bcBf,
    lean_mass: bcLean,
    fat_mass: bcFat,
    method: bcMethod,
    assessment_date: bcDate || assessmentDate,
    rmr_katch_mcardle: "AUTO",
    tdee_estimated: "AUTO",
    nutrition_targets: "AUTO"
  } : {};

  // Nutrition
  const nutritionStrategy = fd.get('nutrition_strategy') || 'maintenance';
  const activityFactor = parseFloat(fd.get('activity_factor') || '1.45');

  // Notes
  const coachNotes = (fd.get('coach_notes') || '').trim();

  // Diagnostics · which mobility rows are incomplete (for validator messages)
  const incompleteMobilityRows = mobilityMapAll
    .filter(r => !r.joint || !r.direction || !r.rating)
    .map(r => {
      const missing = [];
      if (!r.joint) missing.push('joint');
      if (!r.direction) missing.push('direction');
      if (!r.rating) missing.push('traffic-light rating');
      return { rowIndex: r._rowIndex, missing };
    });

  return {
    client_name: name,
    age_range: ageRange,
    sex,
    background,
    training_frequency: frequency,
    strength_days: strengthDays,
    cardio_days: cardioDays,
    primary_goal: primaryGoal,
    assessment_date: assessmentDate,
    fra_priorities: priorities,
    strength_markers: markers,
    strength_marker_results: markerResults,
    strength_marker_tests: strengthMarkerTests,
    mobility_map: mobilityMap,
    constraints,
    constraints_rich: constraintsRich,
    concerns,
    concern_notes: concernNotes,
    accessory_categories: accessoryCategories,
    cardio_profile: cardioProfile,
    body_comp: bodyComp,
    nutrition_strategy: nutritionStrategy,
    activity_factor: activityFactor,
    coach_notes: coachNotes,
    _incompleteMobilityRows: incompleteMobilityRows
  };
}


// ═══════════════════════════════════════════════════════════
// GENERATE · POST to server, download PDF
// ═══════════════════════════════════════════════════════════

async function generatePlan(mode = 'client') {
  const data = collectData();
  data.pdf_mode = mode;  // 'client' | 'coach' | 'full'

  const problems = validate(data);

  if (problems.length) {
    // Soft warnings start with "Heads up" · everything else is a hard blocker.
    const blockers = problems.filter(p => !p.startsWith('Heads up'));
    const warnings = problems.filter(p => p.startsWith('Heads up'));

    if (blockers.length) {
      alert('Missing or invalid fields:\n\n' + blockers.map(p => '· ' + p).join('\n'));
      if (blockers.some(p => p.toLowerCase().includes('mobility'))) {
        document.getElementById('mobility-map').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (blockers.some(p => p.toLowerCase().includes('priority'))) {
        document.getElementById('priorities-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (warnings.length) {
      const proceed = confirm(
        'Heads up before generating ·\n\n' +
        warnings.map(p => '· ' + p.replace(/^Heads up · /, '')).join('\n') +
        '\n\nGenerate plan anyway?'
      );
      if (!proceed) return;
    }
  }

  // Clean up diagnostic fields before sending
  const cleaned = { ...data };
  delete cleaned._incompleteMobilityRows;
  const cleanedResults = {};
  Object.entries(cleaned.strength_marker_results || {}).forEach(([k, v]) => {
    if (!k.endsWith('__display')) cleanedResults[k] = v;
  });
  cleaned.strength_marker_results = cleanedResults;

  // Show loading state on the clicked button
  const btnSelector = `.btn[onclick="generatePlan('${mode}')"]`;
  const btn = document.querySelector(btnSelector);
  const originalLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = 'Generating…';
    btn.disabled = true;
    btn.style.opacity = '0.7';
  }

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleaned)
    });

    if (!response.ok) {
      let errText = 'Server error';
      try {
        const err = await response.json();
        errText = err.error || errText;
        if (err.trace) {
          const lines = err.trace.split('\n').filter(l => l.trim());
          const last = lines[lines.length - 1] || '';
          console.error('Server trace:', err.trace);
          errText = `${errText}\n\nDetails · ${last}`;
        }
      } catch (_) {
        try { errText = await response.text(); } catch (_) {}
      }
      throw new Error(errText);
    }

    // Download the PDF blob · filename includes the mode for clarity
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const safeName = (cleaned.client_name || 'client').toLowerCase()
      .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_${mode}_plan.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Success toast
    const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);
    showToast(`✓ ${modeLabel} plan generated for ${cleaned.client_name}`);
  } catch (err) {
    alert(`Plan generation failed:\n\n${err.message}\n\nIf this keeps happening, save a draft and try again in a minute.`);
    console.error(err);
  } finally {
    if (btn) {
      btn.textContent = originalLabel;
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: var(--sky); color: var(--navy); padding: 14px 24px;
      font-family: var(--sans); font-size: 12px; letter-spacing: 0.12em;
      text-transform: uppercase; font-weight: 500;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 200;
      opacity: 0; transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

function validate(data) {
  const problems = [];

  // ── Required identification ──
  if (!data.client_name) problems.push('Client name is required');
  if (!data.age_range) problems.push('Age range is required');
  if (!data.sex) problems.push('Sex is required');
  if (!data.primary_goal) problems.push('Primary goal is required');
  if (data.fra_priorities.length === 0) problems.push('At least one FRA priority is required');

  // ── Mobility · surface incomplete rows ──
  const incomplete = data._incompleteMobilityRows || [];
  if (data.mobility_map.length === 0 && incomplete.length === 0) {
    problems.push('At least one mobility rating is required');
  }
  incomplete.forEach(inc => {
    problems.push(`Mobility Row ${inc.rowIndex} · missing ${inc.missing.join(' + ')}`);
  });

  // ── Frequency cap ──
  const totalSessions = (data.strength_days || 0) + (data.cardio_days || 0);
  if (totalSessions > 6) {
    problems.push(`Total sessions exceeds 6/wk · adjust strength or cardio days (currently ${totalSessions}/wk)`);
  }
  if (totalSessions === 0) {
    problems.push('At least 1 session per week is required (strength or cardio)');
  }

  // ── Body comp arithmetic check ──
  // If both lean mass and fat mass are set, they should sum to weight ±5%.
  // If body fat % is set with weight, it should match the lean/fat mass split.
  const bc = data.body_comp || {};
  const weightNum = _parseNum(bc.weight);
  const leanNum = _parseNum(bc.lean_mass);
  const fatNum = _parseNum(bc.fat_mass);
  const bfPctNum = _parseNum(bc.body_fat);

  if (weightNum && leanNum && fatNum) {
    const sum = leanNum + fatNum;
    const drift = Math.abs(sum - weightNum);
    const tolerance = weightNum * 0.05;
    if (drift > tolerance) {
      problems.push(
        `Body comp arithmetic · lean ${leanNum} + fat ${fatNum} = ${sum.toFixed(1)} ` +
        `but weight is ${weightNum} (off by ${drift.toFixed(1)} lb)`
      );
    }
  }
  if (weightNum && bfPctNum && fatNum) {
    const expectedFat = weightNum * (bfPctNum / 100);
    const drift = Math.abs(expectedFat - fatNum);
    const tolerance = weightNum * 0.03;
    if (drift > tolerance) {
      problems.push(
        `Body comp arithmetic · ${bfPctNum}% of ${weightNum} should be ${expectedFat.toFixed(1)} ` +
        `but fat mass is ${fatNum} (off by ${drift.toFixed(1)} lb)`
      );
    }
  }

  // ── Calorie sample day vs target ──
  // (placeholder · the form does not currently capture per-meal calorie samples;
  //  if/when it does this hook is here to fire the warning)
  if (data.sample_day_calories && data.calorie_target) {
    const drift = Math.abs(data.sample_day_calories - data.calorie_target);
    if (drift > 100) {
      problems.push(
        `Sample day calories (${data.sample_day_calories}) drift more than ` +
        `±100 from target (${data.calorie_target}) · drift = ${drift}`
      );
    }
  }

  // ── Concern × Strength Anchor sanity ──
  // If client has an active joint concern AND a tested anchor through that joint,
  // surface a warning but don't block (coach may have intentionally tested it).
  const concerns = data.concerns || [];
  const tests = data.strength_marker_tests || [];
  const concernJoints = {
    bad_knee: ['squat', 'lunge'],
    bad_shoulder: ['push_horizontal', 'push_vertical', 'pull_vertical'],
    lower_back: ['hinge', 'squat', 'carry'],
    hip: ['hinge', 'squat', 'lunge'],
    elbow: ['push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical'],
    wrist: ['push_horizontal', 'pull_horizontal'],
  };

  concerns.forEach(concern => {
    const flaggedCats = concernJoints[concern];
    if (!flaggedCats) return;
    tests.forEach(t => {
      if (t.movement_category && flaggedCats.includes(t.movement_category)) {
        problems.push(
          `Heads up · "${concern}" flagged AND a ${t.movement_category} anchor was tested ` +
          `(${t.exercise_name || 'unnamed'}) · review for safety before generating`
        );
      }
    });
  });

  return problems;
}

function _parseNum(s) {
  if (s == null) return null;
  const m = String(s).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}



// ═══════════════════════════════════════════════════════════
// SAVE / LOAD DRAFT (in-memory · session only)
// ═══════════════════════════════════════════════════════════

let draftData = null;

function saveToStorage() {
  draftData = collectData();
  alert('Draft saved in this session. It will be lost if you close the page.');
}

function loadFromStorage() {
  if (!draftData) {
    alert('No draft saved.');
    return;
  }
  applyData(draftData);
  alert('Draft loaded.');
}

function applyData(d) {
  const setVal = (selector, val) => { const el = document.querySelector(selector); if (el) el.value = val || ''; };
  const checkRadio = (name, val) => {
    const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (el) el.checked = true;
  };

  setVal('#client-name', d.client_name);
  setVal('#assessment-date', d.assessment_date);
  setVal('#age-range', d.age_range);
  checkRadio('sex', d.sex);
  setVal('#background', d.background);
  checkRadio('frequency', d.training_frequency);
  checkRadio('strength_days', d.strength_days || d.training_frequency || 3);
  checkRadio('cardio_days', d.cardio_days != null ? d.cardio_days : 1);
  setVal('textarea[name="primary_goal"]', d.primary_goal);

  // Priorities
  const pContainer = document.getElementById('priorities-list');
  pContainer.innerHTML = '';
  const priorities = d.fra_priorities && d.fra_priorities.length ? d.fra_priorities : ['', '', ''];
  priorities.forEach((p, i) => {
    const num = String(i + 1).padStart(2, '0');
    const f = document.createElement('div');
    f.className = 'field';
    f.innerHTML = `
      <label class="field-label">Priority ${num}</label>
      <input type="text" name="priority" value="${p.replace(/"/g, '&quot;')}">
    `;
    pContainer.appendChild(f);
  });

  // Mobility
  const mContainer = document.getElementById('mobility-map');
  mContainer.innerHTML = '';
  (d.mobility_map || []).forEach(r => addMobilityRow(r.joint, r.direction, r.side, r.rating));
  if (!(d.mobility_map || []).length) {
    addMobilityRow('hip', 'IR', 'L', '');
    addMobilityRow('hip', 'IR', 'R', '');
  }

  // Strength Anchors · rebuild from saved data
  const anchorContainer = document.getElementById('anchors-list');
  anchorContainer.innerHTML = '';
  const savedTests = d.strength_marker_tests || [];

  if (savedTests.length) {
    // New format · rebuild rich anchor cards
    savedTests.forEach(t => addAnchor(t));
  } else if (d.strength_markers && d.strength_markers.length) {
    // Legacy format · best-effort migration
    d.strength_markers.forEach(slug => {
      const display = d.strength_marker_results?.[slug + '__display']
        || slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      addAnchor({ exercise_name: display });
    });
  } else {
    // Fresh draft · single empty card
    addAnchor();
  }

  // Constraints · checkboxes
  document.querySelectorAll('input[name="constraint"]').forEach(c => {
    c.checked = (d.constraints || []).includes(c.value);
  });
  // Constraints · also seed the structured cards
  const cardsContainer = document.getElementById('constraint-cards');
  if (cardsContainer) cardsContainer.innerHTML = '';
  const otherCardContainer = document.getElementById('other-constraint-card');
  if (otherCardContainer) otherCardContainer.innerHTML = '';

  (d.constraints_rich || []).forEach(cr => {
    const key = cr.key || '';
    const display = cr.display_name || key;
    if (!key) return;
    // Re-trigger the checkbox logic so the card builds via toggleConstraintCard
    const checkbox = document.querySelector(`input[name="constraint"][value="${key}"]`);
    if (checkbox) {
      checkbox.checked = true;
      toggleConstraintCard(key, display);
    } else if (key === 'other' || cr.display_name) {
      // free-text "other" constraint
      const otherInput = document.getElementById('other-constraint');
      if (otherInput) {
        otherInput.value = display;
        syncOtherConstraintCard(display);
      }
    }
    // Now populate the card fields
    const cardId = 'constraint-card-' + (key === 'other' ? 'other' : key.replace(/[^a-z0-9_]/gi, '_'));
    const card = document.getElementById(cardId);
    if (card) {
      const setField = (sel, v) => {
        const el = card.querySelector(sel);
        if (el && v != null) el.value = v;
      };
      setField('.constraint-side', cr.side);
      setField('.constraint-status', cr.status);
      setField('.constraint-pain', cr.pain_level);
      setField('.constraint-avoid', cr.avoid_notes);
      setField('.constraint-allowed', cr.allowed_notes);
      setField('.constraint-coach-notes', cr.coach_notes);
      _updateConstraintCardSummary(card);
    }
  });

  // Concerns
  document.querySelectorAll('input[name="concern"]').forEach(c => {
    c.checked = (d.concerns || []).includes(c.value);
  });
  setVal('#concern-notes', d.concern_notes);

  // Strength C accessory categories
  document.querySelectorAll('input[name="accessory_categories"]').forEach(c => {
    c.checked = (d.accessory_categories || []).includes(c.value);
  });

  // Cardio Capacity & Machine Tolerance
  const cp = d.cardio_profile || {};
  setVal('#cardio-primary', cp.primary_modality);
  // Open the cardio section if any data is present
  const cardioDetails = document.getElementById('cardio-details');
  if (cardioDetails && (cp.primary_modality || (cp.limitations && cp.limitations.length)
                          || (cp.z2_baseline && Object.keys(cp.z2_baseline).length))) {
    cardioDetails.open = true;
  }
  // Secondary + avoid + limitations checkboxes
  document.querySelectorAll('input[name="cardio_secondary"]').forEach(c => {
    c.checked = (cp.secondary_modalities || []).includes(c.value);
  });
  document.querySelectorAll('input[name="cardio_avoid"]').forEach(c => {
    c.checked = (cp.avoid_modalities || []).includes(c.value);
  });
  document.querySelectorAll('input[name="cardio_limitation"]').forEach(c => {
    c.checked = (cp.limitations || []).includes(c.value);
  });
  // Interval clearance radio · pull the matching limitation flag
  const limits = cp.limitations || [];
  let icValue = 'not_assessed';
  if (limits.includes('cleared_for_intervals')) icValue = 'cleared_for_intervals';
  else if (limits.includes('not_cleared_for_intervals')) icValue = 'not_cleared_for_intervals';
  const icRadio = document.querySelector(`input[name="interval_clearance"][value="${icValue}"]`);
  if (icRadio) icRadio.checked = true;

  // Z2 baseline
  const z2 = cp.z2_baseline || {};
  setVal('select[name="z2_machine"]', z2.machine);
  setVal('input[name="z2_duration_minutes"]', z2.duration_minutes);
  setVal('input[name="z2_avg_hr"]', z2.avg_hr);
  setVal('input[name="z2_peak_hr"]', z2.peak_hr);
  setVal('input[name="z2_rpe"]', z2.rpe);
  setVal('input[name="z2_distance"]', z2.distance);
  setVal('input[name="z2_calories"]', z2.calories);
  setVal('input[name="z2_avg_watts"]', z2.avg_watts);
  setVal('input[name="z2_resistance_level"]', z2.resistance_level);
  setVal('input[name="z2_notes"]', z2.notes);
  setVal('input[name="z2_joint_tolerance_notes"]', z2.joint_tolerance_notes);

  // Interval test
  const iv = cp.interval_test || {};
  setVal('select[name="iv_machine"]', iv.machine);
  setVal('input[name="iv_protocol"]', iv.protocol);
  setVal('input[name="iv_work_seconds"]', iv.work_seconds);
  setVal('input[name="iv_rest_seconds"]', iv.rest_seconds);
  setVal('input[name="iv_rounds"]', iv.rounds);
  setVal('input[name="iv_peak_watts"]', iv.peak_watts);
  setVal('input[name="iv_avg_watts"]', iv.avg_watts);
  setVal('input[name="iv_peak_hr"]', iv.peak_hr);
  setVal('input[name="iv_ending_rpe"]', iv.ending_rpe);
  setVal('input[name="iv_joint_tolerance_notes"]', iv.joint_tolerance_notes);
  setVal('input[name="iv_recovery_notes"]', iv.recovery_notes);

  // HR recovery · auto-recompute the drop after restoring end + 1-min
  const hrr = cp.hr_recovery || {};
  setVal('#hrr-end-hr', hrr.end_hr);
  setVal('#hrr-one-min-hr', hrr.one_min_hr);
  setVal('#hrr-drop-one-min', hrr.drop_one_min);
  recomputeHrDrop();

  // Body comp
  const bc = d.body_comp || {};
  setVal('#bc-weight', bc.weight);
  setVal('#bc-bf', bc.body_fat);
  setVal('#bc-lean', bc.lean_mass);
  setVal('#bc-fat', bc.fat_mass);
  setVal('#bc-method', bc.method);
  setVal('#bc-date', bc.assessment_date);

  // Nutrition
  checkRadio('nutrition_strategy', d.nutrition_strategy || 'maintenance');
  checkRadio('activity_factor', d.activity_factor || 1.45);

  // Notes
  setVal('textarea[name="coach_notes"]', d.coach_notes);
}

function clearForm() {
  if (!confirm('Clear the entire form?')) return;
  document.getElementById('assessment-form').reset();

  // Mobility · default rows
  const mContainer = document.getElementById('mobility-map');
  mContainer.innerHTML = '';
  addMobilityRow('hip', 'IR', 'L', '');
  addMobilityRow('hip', 'IR', 'R', '');
  addMobilityRow('shoulder', 'ER', 'L', '');

  // Strength anchors · single empty card
  const anchorContainer = document.getElementById('anchors-list');
  if (anchorContainer) {
    anchorContainer.innerHTML = '';
    addAnchor();
  }

  // Constraints · uncheck all + remove all dynamic cards
  document.querySelectorAll('input[name="constraint"]').forEach(c => { c.checked = false; });
  const cardsContainer = document.getElementById('constraint-cards');
  if (cardsContainer) cardsContainer.innerHTML = '';
  const otherCardContainer = document.getElementById('other-constraint-card');
  if (otherCardContainer) otherCardContainer.innerHTML = '';
  const otherInput = document.getElementById('other-constraint');
  if (otherInput) otherInput.value = '';

  // Concerns · uncheck + clear notes
  document.querySelectorAll('input[name="concern"]').forEach(c => { c.checked = false; });
  const concernNotes = document.getElementById('concern-notes');
  if (concernNotes) concernNotes.value = '';

  // Accessory categories · uncheck
  document.querySelectorAll('input[name="accessory_categories"]').forEach(c => { c.checked = false; });

  // Cardio section · clear all fields and reset radio + close panel
  document.querySelectorAll('input[name="cardio_secondary"], input[name="cardio_avoid"], input[name="cardio_limitation"]')
    .forEach(c => { c.checked = false; });
  const cardioPrimary = document.getElementById('cardio-primary');
  if (cardioPrimary) cardioPrimary.value = '';
  ['z2_machine','z2_duration_minutes','z2_avg_hr','z2_peak_hr','z2_rpe','z2_distance',
   'z2_calories','z2_avg_watts','z2_resistance_level','z2_notes','z2_joint_tolerance_notes',
   'iv_machine','iv_protocol','iv_work_seconds','iv_rest_seconds','iv_rounds',
   'iv_peak_watts','iv_avg_watts','iv_peak_hr','iv_ending_rpe',
   'iv_joint_tolerance_notes','iv_recovery_notes'].forEach(n => {
    const el = document.querySelector(`[name="${n}"]`);
    if (el) el.value = '';
  });
  ['hrr-end-hr','hrr-one-min-hr','hrr-drop-one-min'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.dataset.auto = ''; }
  });
  const hintEl = document.getElementById('hrr-quality-hint');
  if (hintEl) hintEl.textContent = 'Drop ≥18 bpm = strong recovery · 12-17 = normal · <12 = poor (program will use joint-friendly options).';
  const icDefault = document.querySelector('input[name="interval_clearance"][value="not_assessed"]');
  if (icDefault) icDefault.checked = true;
  const cardioDetails = document.getElementById('cardio-details');
  if (cardioDetails) cardioDetails.open = false;

  // Reset default radios for top-of-form fields
  const sd3 = document.querySelector('#sd-3'); if (sd3) sd3.checked = true;
  const cd1 = document.querySelector('#cd-1'); if (cd1) cd1.checked = true;
  const nutMaint = document.querySelector('#nut-maintenance'); if (nutMaint) nutMaint.checked = true;
  const af145 = document.querySelector('#af-1\\.45'); if (af145) af145.checked = true;
}

