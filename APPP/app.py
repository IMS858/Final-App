"""
IMS · Vercel Python entrypoint

Flask app that ·
  - Serves web/index.html at /
  - Generates a PDF plan at POST /api/generate

Vercel's Python runtime auto-detects the `app` variable here.
"""
import json
import sys
import tempfile
import traceback
from pathlib import Path
from flask import Flask, request, send_file, send_from_directory, jsonify, Response

# ── Make the generator importable ──────────────────────────
# app.py is at the repo ROOT, so parent = repo root
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "generator"))

from generator import (
    Assessment, MobilityRating, Generator, parse_fra_priority
)
from plan_pdf import generate_plan_pdf


app = Flask(__name__, static_folder=None)


# ── Static file serving ────────────────────────────────────

@app.route('/')
def index():
    try:
        resp = send_from_directory(str(ROOT / "web"), "index.html")
        # Don't cache the HTML · prevents stale UI sticking after a deploy.
        # Static assets (JS/CSS) are still fine to cache · they're served from
        # the catch-all route below.
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        resp.headers['Pragma'] = 'no-cache'
        resp.headers['Expires'] = '0'
        return resp
    except Exception as e:
        return Response(f"Home page failed to load: {e}", status=500)


@app.route('/favicon.ico')
@app.route('/favicon.png')
def favicon():
    """Handle favicon requests cleanly · return 204 No Content rather than crashing."""
    return Response('', status=204)


# ─── Exercise Library module ───────────────────────────────
# IMS Coach OS · view layer over the existing JSON libraries. The Generator
# is unaffected; these endpoints expose a normalized read-only view.

@app.route('/exercise-library')
def exercise_library_page():
    """Serve the Exercise Library dashboard page."""
    try:
        resp = send_from_directory(str(ROOT / "web"), "exercise-library.html")
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        resp.headers['Pragma'] = 'no-cache'
        return resp
    except Exception as e:
        return Response(f"Exercise Library failed to load: {e}", status=500)


@app.route('/api/library/exercises', methods=['GET'])
def api_library_exercises():
    """Return all normalized exercises as JSON.

    Optional query params · category, source_library, joint, direction,
    client_level, equipment, program_use, query, knee_safe, shoulder_safe,
    low_back_safe, wrist_safe.

    Filtering happens server-side so the frontend doesn't need the full
    raw JSON for every render. The frontend can also do its own client-side
    filter pass over the returned list.
    """
    try:
        from library_adapter import (
            load_all, search_exercises, library_health,
        )
        items = load_all(repo_root=ROOT)
        # Pull filter params · all optional
        q = request.args.get('query', '').strip()
        kwargs = {}
        for key in ('category', 'source_library', 'movement_category', 'joint',
                    'direction', 'client_level', 'equipment', 'program_use'):
            v = request.args.get(key, '').strip()
            if v:
                kwargs[key] = v
        for key in ('knee_safe', 'shoulder_safe', 'low_back_safe', 'wrist_safe'):
            if request.args.get(key, '').lower() in ('1', 'true', 'yes'):
                kwargs[key] = True

        if q or kwargs:
            items = search_exercises(items, q, **kwargs)

        return jsonify({
            "exercises": [it.to_dict() for it in items],
            "total":     len(items),
        })
    except Exception as e:
        return jsonify({"error": str(e), "exercises": [], "total": 0}), 500


@app.route('/api/library/health', methods=['GET'])
def api_library_health():
    """Return the library health summary for the admin panel."""
    try:
        from library_adapter import load_all, library_health
        items = load_all(repo_root=ROOT)
        return jsonify(library_health(items))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/<path:filename>')
def static_files(filename):
    """Serve anything else from /web (if present) or /assets.

    Wrapped in try/except · on Vercel's read-only filesystem certain path
    operations can raise, and we don't want that to bubble up as a 500.
    """
    try:
        web_path = ROOT / "web" / filename
        if web_path.exists() and web_path.is_file():
            return send_from_directory(str(ROOT / "web"), filename)
        assets_path = ROOT / "assets" / filename
        if assets_path.exists() and assets_path.is_file():
            return send_from_directory(str(ROOT / "assets"), filename)
    except Exception:
        pass
    return ('Not found', 404)


# ─── IMS Coach OS · module routes ─────────────────────────
# Each of these serves a discrete page in the unified app shell.
# Shared nav lives in web/assets/ims-nav.js · the same nav appears
# on every page so the modules feel like one product.

def _serve_html(filename):
    try:
        resp = send_from_directory(str(ROOT / "web"), filename)
        resp.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        resp.headers['Pragma'] = 'no-cache'
        return resp
    except Exception as e:
        return Response(f"{filename} failed to load: {e}", status=500)


@app.route('/dashboard')
def dashboard_alias():
    """Alias for the SPA dashboard view (same file as /)."""
    return _serve_html("index.html")


@app.route('/generator')
@app.route('/assessment')
def generator_page():
    """Serve the SPA · app.js detects the pathname and opens the wizard."""
    return _serve_html("index.html")


@app.route('/calendar')
def calendar_page():
    return _serve_html("calendar.html")


@app.route('/program-review')
def program_review_page():
    return _serve_html("program-review.html")


@app.route('/session-notes')
def session_notes_page():
    return _serve_html("session-notes.html")


# ─── IMS Coach OS · demo + bridge APIs ────────────────────
# Lightweight endpoints used by the new pages. These are designed to
# be no-op-friendly · the frontend gracefully falls back to localStorage
# when they're unavailable, so deploying without backend storage is fine.

@app.route('/api/demo/program', methods=['GET'])
def api_demo_program():
    """Return the demo program JSON for Program Review preview.

    Looks for mock_amanda.json in /web first, then falls back to the
    raw amanda_program_raw.json shipped with the repo if present.
    """
    candidates = [
        ROOT / "web" / "mock_amanda.json",
        ROOT / "amanda_program_raw.json",
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            try:
                with open(p, 'r') as f:
                    return jsonify(json.load(f))
            except Exception as e:
                return jsonify({"error": f"failed to read demo program: {e}"}), 500
    return jsonify({"error": "no demo program available"}), 404


# In-memory stores · sufficient for single-process dev. Swap for
# Supabase tables (calendar_events, session_notes, plan_reviews) later.
_calendar_events = []
_session_notes = []
_plan_reviews = {}


@app.route('/api/calendar/events', methods=['GET', 'POST'])
def api_calendar_events():
    global _calendar_events
    if request.method == 'GET':
        return jsonify({"events": _calendar_events})
    body = request.get_json(silent=True) or {}
    incoming = body.get('events', [])
    if not isinstance(incoming, list):
        return jsonify({"error": "events must be a list"}), 400
    # Replace by id (so re-saving a block updates rather than duplicates)
    incoming_ids = {e.get('id') for e in incoming if e.get('id')}
    _calendar_events = [e for e in _calendar_events if e.get('id') not in incoming_ids]
    _calendar_events.extend(incoming)
    return jsonify({"ok": True, "saved": len(incoming), "total": len(_calendar_events)})


@app.route('/api/session-notes', methods=['GET', 'POST'])
def api_session_notes():
    global _session_notes
    if request.method == 'GET':
        program_id = request.args.get('program_id', '').strip()
        notes = ([n for n in _session_notes if n.get('program_id') == program_id]
                 if program_id else _session_notes)
        return jsonify({"notes": notes})
    body = request.get_json(silent=True) or {}
    if not body.get('program_id') or not body.get('session_key'):
        return jsonify({"error": "program_id and session_key required"}), 400
    # Replace if program_id + session_key already exist
    _session_notes = [n for n in _session_notes
                       if not (n.get('program_id') == body.get('program_id')
                               and n.get('session_key') == body.get('session_key'))]
    _session_notes.append({**body})
    return jsonify({"ok": True, "total": len(_session_notes)})


@app.route('/api/program/review/save', methods=['POST'])
def api_program_review_save():
    body = request.get_json(silent=True) or {}
    pid = body.get('program_id')
    if not pid:
        return jsonify({"error": "program_id required"}), 400
    _plan_reviews[pid] = body.get('review', {})
    return jsonify({"ok": True})


# ── Nutrition calculation (Katch-McArdle) ──────────────────

def calculate_nutrition(body_comp, activity_factor, strategy):
    lean_str = body_comp.get('lean_mass', '')
    weight_str = body_comp.get('weight', '')
    try:
        lean_lb = float(''.join(c for c in lean_str if c.isdigit() or c == '.'))
        weight_lb = float(''.join(c for c in weight_str if c.isdigit() or c == '.'))
    except (ValueError, TypeError):
        return body_comp

    lean_kg = lean_lb / 2.2046
    weight_kg = weight_lb / 2.2046
    rmr = 370 + (21.6 * lean_kg)
    tdee = rmr * activity_factor

    if strategy == "fat_loss":
        target_cal, protein_g, carbs_g = tdee - 300, round(lean_lb * 1.0), round(weight_kg * 2.2)
    elif strategy == "endurance":
        target_cal, protein_g, carbs_g = tdee, round(lean_lb * 0.9), round(weight_kg * 4.0)
    elif strategy == "strength":
        target_cal, protein_g, carbs_g = tdee + 200, round(lean_lb * 1.0), round(weight_kg * 3.0)
    else:
        target_cal, protein_g, carbs_g = tdee, round(lean_lb * 0.9), round(weight_kg * 3.0)

    fat_cal = target_cal - (protein_g * 4) - (carbs_g * 4)
    fat_g = max(round(fat_cal / 9), round(weight_lb * 0.3))
    water_oz = round(weight_lb * 0.7)
    water_suffix = "+ 16 oz per run hour" if strategy == "endurance" else "+ 16 oz per training hour"

    body_comp['rmr_katch_mcardle'] = f"{rmr:,.0f} cal/day"
    body_comp['tdee_estimated'] = f"{tdee:,.0f} cal/day"
    body_comp['nutrition_targets'] = {
        "calories": f"{target_cal:,.0f} cal/day",
        "protein": f"{protein_g} g",
        "carbs": f"{carbs_g} g",
        "fat": f"{fat_g} g",
        "water": f"{water_oz} oz baseline · {water_suffix}"
    }
    return body_comp


# ── PDF generation endpoint ────────────────────────────────

def build_program_pdf(form_data):
    # ── Bulletproof input parsing ─────────────────────
    if not isinstance(form_data, dict):
        raise ValueError(f"Expected form_data to be a dict, got {type(form_data).__name__}")

    # FRA priorities · must be list of strings
    raw_priorities = form_data.get('fra_priorities', []) or []
    if not isinstance(raw_priorities, list):
        raw_priorities = []
    fra = []
    for p in raw_priorities:
        if isinstance(p, str) and p.strip():
            fra.append(parse_fra_priority(p))
        elif isinstance(p, dict) and p.get('description'):
            # In case someone sends pre-parsed priorities
            fra.append(parse_fra_priority(p['description']))

    # Mobility map · must be list of dicts
    raw_mobility = form_data.get('mobility_map', []) or []
    if not isinstance(raw_mobility, list):
        raw_mobility = []
    mob = []
    for m in raw_mobility:
        if not isinstance(m, dict):
            continue
        try:
            mob.append(MobilityRating(
                joint=str(m.get('joint', '')),
                direction=str(m.get('direction', '')),
                side=str(m.get('side', '')),
                rating=str(m.get('rating', ''))
            ))
        except Exception:
            continue

    # Body comp · must be dict (or empty)
    raw_bc = form_data.get('body_comp', {})
    if not isinstance(raw_bc, dict):
        raw_bc = {}
    body_comp = dict(raw_bc) if raw_bc else {}

    if body_comp and body_comp.get('weight'):
        try:
            activity = float(form_data.get('activity_factor', 1.45) or 1.45)
        except (TypeError, ValueError):
            activity = 1.45
        strategy = form_data.get('nutrition_strategy', 'maintenance') or 'maintenance'
        body_comp = calculate_nutrition(body_comp, activity, strategy)
    else:
        body_comp = {}

    # Guard · strip any leftover 'AUTO' placeholders so PDF renderer doesn't
    # try to call .get() on them. This happens if calculate_nutrition was
    # skipped or bailed early (e.g. lean_mass not a valid number).
    for key in ('rmr_katch_mcardle', 'tdee_estimated', 'nutrition_targets'):
        if body_comp.get(key) == 'AUTO':
            del body_comp[key]

    # Constraints · must be list of strings
    raw_constraints = form_data.get('constraints', []) or []
    constraints = [str(c) for c in raw_constraints if c] if isinstance(raw_constraints, list) else []

    # NEW · Structured constraint data (side, status, pain level, notes)
    raw_constraints_rich = form_data.get('constraints_rich', []) or []
    constraints_rich = []
    if isinstance(raw_constraints_rich, list):
        for cr in raw_constraints_rich:
            if not isinstance(cr, dict):
                continue
            constraints_rich.append({
                'key': str(cr.get('key') or '').strip(),
                'display_name': str(cr.get('display_name') or '').strip(),
                'side': (str(cr.get('side') or '').strip() or None),
                'status': (str(cr.get('status') or '').strip() or None),
                'pain_level': (int(cr.get('pain_level'))
                               if isinstance(cr.get('pain_level'), (int, float))
                                  and 0 <= cr.get('pain_level') <= 10
                               else None),
                'avoid_notes': (str(cr.get('avoid_notes') or '').strip() or None),
                'allowed_notes': (str(cr.get('allowed_notes') or '').strip() or None),
                'coach_notes': (str(cr.get('coach_notes') or '').strip() or None),
            })

    # Status-aware filtering · drop CLEARED constraints from the flat list used
    # by the picker. Coach kept the checkbox to track history, but cleared
    # constraints shouldn't actively filter exercises.
    cleared_keys = {cr['key'] for cr in constraints_rich
                     if (cr.get('status') or '').lower() == 'cleared'}
    if cleared_keys:
        constraints = [c for c in constraints if c not in cleared_keys]

    # NEW · Client concerns · joint flags + free-text notes
    raw_concerns = form_data.get('concerns', []) or []
    concerns = [str(c) for c in raw_concerns if c] if isinstance(raw_concerns, list) else []
    concern_notes = str(form_data.get('concern_notes', '') or '')

    # NEW · Cardio Capacity & Machine Tolerance profile
    try:
        from cardio_profile import parse_cardio_profile
        cardio_profile = parse_cardio_profile(form_data.get('cardio_profile'))
    except Exception:
        cardio_profile = None

    # NEW · accessory categories (Strength C block)
    raw_acc_cats = form_data.get('accessory_categories', []) or []
    accessory_categories = ([str(c) for c in raw_acc_cats if c]
                              if isinstance(raw_acc_cats, list) else [])

    # Strength markers + results
    raw_markers = form_data.get('strength_markers', []) or []
    markers = [str(m) for m in raw_markers if m] if isinstance(raw_markers, list) else []

    raw_results = form_data.get('strength_marker_results', {}) or {}
    if not isinstance(raw_results, dict):
        raw_results = {}
    marker_results = {
        k: (v if isinstance(v, str) else str(v))
        for k, v in raw_results.items()
        if not str(k).endswith('__display')
    }

    # NEW · richer strength test data (optional · empty list means use legacy results only)
    raw_tests = form_data.get('strength_marker_tests', []) or []
    try:
        from strength_testing import parse_strength_tests
        strength_tests = parse_strength_tests(raw_tests)
    except Exception:
        # If parsing fails for any reason, don't crash · just skip the new data
        strength_tests = []

    # Training frequency · parse strength_days + cardio_days separately
    # (fall back to training_frequency if the new fields aren't present)
    try:
        strength_days = int(form_data.get('strength_days', 0) or 0)
    except (TypeError, ValueError):
        strength_days = 0
    try:
        cardio_days = int(form_data.get('cardio_days', 0) or 0)
    except (TypeError, ValueError):
        cardio_days = 0

    if strength_days == 0 and cardio_days == 0:
        # Legacy · single training_frequency field
        try:
            freq = int(form_data.get('training_frequency', 3) or 3)
        except (TypeError, ValueError):
            freq = 3
        # Map old frequency to defaults · 2x = 2 strength / 0 cardio, 3x = 3s/0c, 4x = 3s/1c
        if freq <= 2:
            strength_days, cardio_days = 2, 0
        elif freq == 3:
            strength_days, cardio_days = 3, 0
        else:
            strength_days, cardio_days = 3, 1

    freq = strength_days + cardio_days  # total days (for Assessment back-compat)

    # PDF mode · "client" / "coach" / "full" · default to client if missing
    pdf_mode = str(form_data.get('pdf_mode', 'client') or 'client').lower().strip()
    if pdf_mode not in ('client', 'coach', 'full'):
        pdf_mode = 'client'

    assessment = Assessment(
        name=str(form_data.get('client_name', 'Client') or 'Client'),
        age_range=str(form_data.get('age_range', '') or ''),
        sex=str(form_data.get('sex', '') or ''),
        background=str(form_data.get('background', '') or ''),
        training_frequency=freq,
        strength_days=strength_days,
        cardio_days=cardio_days,
        primary_goal=str(form_data.get('primary_goal', '') or ''),
        fra_priorities=fra,
        strength_markers=markers,
        constraints=constraints,
        mobility_map=mob,
        body_comp=body_comp,
        progression_mode="autoregulated",
        strength_marker_results=marker_results,
        strength_marker_tests=strength_tests,
        concerns=concerns,
        concern_notes=concern_notes,
        constraints_rich=constraints_rich,
        pdf_mode=pdf_mode,
        cardio_profile=cardio_profile,
        accessory_categories=accessory_categories,
    )

    generator = Generator(libraries_path=str(ROOT / "libraries"))
    program = generator.build_program(assessment, block_number=1)

    with tempfile.TemporaryDirectory() as tmpdir:
        json_path = str(Path(tmpdir) / "program.json")
        pdf_path = str(Path(tmpdir) / "plan.pdf")
        program.to_json(json_path)
        generate_plan_pdf(program_json=json_path, output_pdf=pdf_path, pdf_mode=pdf_mode)
        with open(pdf_path, 'rb') as f:
            pdf_bytes = f.read()
    return pdf_bytes, assessment.name


@app.route('/api/generate', methods=['POST', 'OPTIONS'])
def generate():
    # CORS preflight
    if request.method == 'OPTIONS':
        return Response('', status=204, headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        })

    try:
        form_data = request.get_json(force=True)
        pdf_bytes, client_name = build_program_pdf(form_data)

        safe_name = (client_name or 'client').lower().replace(' ', '_')
        safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '_')

        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="{safe_name}_plan.pdf"',
                'Access-Control-Allow-Origin': '*'
            }
        )
    except Exception as e:
        return jsonify({
            'error': str(e),
            'trace': traceback.format_exc()
        }), 500


# ── Local dev runner ───────────────────────────────────────
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
