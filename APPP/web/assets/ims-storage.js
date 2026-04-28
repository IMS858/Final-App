/* ============================================================
   IMS Coach OS · localStorage helpers
   Keys are namespaced under "ims." for easy cleanup.
   Data shapes are forward-compatible with the future Supabase
   schema (clients, plans, plan_sessions, calendar_events,
   session_notes, exercise_replacements).
   ============================================================ */

(function () {
  const PREFIX = 'ims.';

  function safeParse(str) {
    if (str == null) return null;
    try { return JSON.parse(str); } catch (_) { return null; }
  }

  const Storage = {
    get(key, fallback) {
      const raw = localStorage.getItem(PREFIX + key);
      const v = safeParse(raw);
      return v === null ? (fallback === undefined ? null : fallback) : v;
    },
    set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn('[ims-storage] set failed:', e);
        return false;
      }
    },
    remove(key) { localStorage.removeItem(PREFIX + key); },

    /* ── Domain helpers · forward-compatible with Supabase tables ── */

    // calendar_events → list per program (or "studio" global)
    listCalendarEvents(programId) {
      const all = Storage.get('calendarEvents', {});
      return all[programId || 'studio'] || [];
    },
    saveCalendarEvents(programId, events) {
      const all = Storage.get('calendarEvents', {});
      all[programId || 'studio'] = events;
      Storage.set('calendarEvents', all);
    },

    // session_notes → keyed by program + week + day
    getSessionNotes(programId) {
      const all = Storage.get('sessionNotes', {});
      return all[programId] || {};
    },
    saveSessionNote(programId, sessionKey, note) {
      const all = Storage.get('sessionNotes', {});
      all[programId] = all[programId] || {};
      all[programId][sessionKey] = {
        ...(all[programId][sessionKey] || {}),
        ...note,
        updatedAt: new Date().toISOString(),
      };
      Storage.set('sessionNotes', all);
      return all[programId][sessionKey];
    },

    // plan_review state · status, replacements, dose edits, coach notes
    getPlanReview(programId) {
      const all = Storage.get('planReviews', {});
      return all[programId] || {
        status: 'draft',
        replacements: [],
        doseEdits: {},
        coachNotes: {},
        coachOnly: {},
        lastSavedAt: null,
      };
    },
    savePlanReview(programId, state) {
      const all = Storage.get('planReviews', {});
      all[programId] = {
        ...state,
        lastSavedAt: new Date().toISOString(),
      };
      Storage.set('planReviews', all);
      return all[programId];
    },

    // exercise_replacements → kept inside planReview but exposed for analytics
    listReplacements(programId) {
      return Storage.getPlanReview(programId).replacements || [];
    },
  };

  window.IMSStorage = Storage;
})();
