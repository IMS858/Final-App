/* ============================================================
   IMS Coach OS · shared fetch helpers
   Thin layer over fetch() that keeps endpoints centralized.
   When this app moves to a real backend later, swap the
   implementations here without touching any page code.
   ============================================================ */

(function () {
  async function jsonOrThrow(res) {
    if (!res.ok) {
      let body;
      try { body = await res.text(); } catch (_) { body = ''; }
      throw new Error(`HTTP ${res.status}${body ? ' · ' + body.slice(0, 160) : ''}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  const API = {
    /* Exercise Library — already implemented on the backend. */
    async listExercises(filters = {}) {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v === '' || v === null || v === undefined || v === false) return;
        qs.set(k, v === true ? '1' : String(v));
      });
      const url = '/api/library/exercises' + (qs.toString() ? `?${qs}` : '');
      return jsonOrThrow(await fetch(url));
    },

    async libraryHealth() {
      return jsonOrThrow(await fetch('/api/library/health'));
    },

    /* Demo program · used by Program Review when no real plan saved. */
    async fetchDemoProgram() {
      try {
        return await jsonOrThrow(await fetch('/api/demo/program'));
      } catch (_) {
        // Fall back to mock_amanda.json shipped with the SPA
        return jsonOrThrow(await fetch('/mock_amanda.json'));
      }
    },

    /* PDF generation — preserved exactly. POSTs the assessment payload. */
    async generatePlanPdf(payload) {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`generate failed · ${res.status} · ${txt.slice(0, 200)}`);
      }
      return res.blob();
    },

    /* Calendar events · backend optional (returns 200 with [] today;
       wire to Supabase later). */
    async listCalendarEvents(params = {}) {
      try {
        const qs = new URLSearchParams(params).toString();
        return await jsonOrThrow(await fetch('/api/calendar/events' + (qs ? `?${qs}` : '')));
      } catch (_) {
        return { events: [] };
      }
    },
    async saveCalendarEvents(events) {
      try {
        return await jsonOrThrow(
          await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events }),
          }),
        );
      } catch (_) {
        return { ok: false };
      }
    },

    /* Session notes · backend optional today. */
    async listSessionNotes(programId) {
      try {
        return await jsonOrThrow(await fetch(`/api/session-notes?program_id=${encodeURIComponent(programId || '')}`));
      } catch (_) {
        return { notes: [] };
      }
    },
    async saveSessionNote(payload) {
      try {
        return await jsonOrThrow(
          await fetch('/api/session-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );
      } catch (_) {
        return { ok: false };
      }
    },
  };

  window.IMSApi = API;
})();
