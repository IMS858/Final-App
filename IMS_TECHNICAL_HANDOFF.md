# IMS Program Generator · Technical Handoff for Coach OS Migration

This document hands off the entire codebase to enable the next phase: turning the form→PDF generator into a multi-stage Coach OS with persistent client records, saved assessments, editable program drafts, and PDF as just one export format among many.

---

## 1 · Current App Summary

**What it is:** A Flask web app that takes a coach's one-shot assessment of a client and outputs a 4-week training program as a styled PDF.

**Architecture:** Pure Python · zero LLM calls · deterministic. Same input → same output, always.

**The flow today:**

```
Coach opens web/index.html in browser
  ↓
Fills out single-page assessment form (10+ sections)
  ↓
Clicks "Generate Plan" with mode = client | coach | full
  ↓
Frontend POSTs JSON to /generate
  ↓
app.py · build_program_pdf() parses form into Assessment dataclass
  ↓
generator/generator.py · Generator.build_program(assessment) builds Program object
  · 4 weeks × N sessions × M blocks
  · Pulls from 10 JSON libraries for exercise pools
  · Anchors strength loads from tested rep maxes
  · Routes cardio by limitation tags
  · Picks correctives by joint+direction with concern filtering
  ↓
generator/plan_pdf.py · render_program() renders Program → PDF bytes
  · 3 modes diverge in label remapping, dose detail, appendix sections
  · Uses NumberedCanvas for accurate page numbering
  ↓
app.py returns PDF bytes as download
  ↓
Coach gets "[Client] [Mode] Plan.pdf" file
```

**No persistence.** Assessment data is in form state + browser localStorage (draft). Program object lives only in memory during one request. Once the PDF downloads, the program is gone.

**No editing.** The program is whatever the generator produces. Coach has no opportunity to swap an exercise or adjust loads after generation, short of regenerating with different input.

**No client records.** Each assessment is a fresh form. Coach must re-enter everything every time.

This is the core constraint that breaks when scaling to a real coaching tool. The migration plan below addresses each.

---

## 2 · File/Function Map

### Frontend
**`web/index.html`** (2,511 lines · single file)
- HTML form (Sections 01–09 + 06b/06c/06d sub-sections)
- All CSS inline (IMS dark premium aesthetic)
- All JS inline:
  - `collectData()` — builds JSON payload from DOM
  - `validate(data)` — runs 15+ frontend validation rules
  - `generatePlan(mode)` — submits to `/generate`, downloads PDF
  - `saveDraft()` / `loadDraft()` / `clearForm()` — localStorage round-trips
  - `addMobilityRow()` / `addPriority()` / `addAnchor()` — repeating row builders
  - Constraint card + body comp sync helpers

### Backend orchestration
**`app.py`** (352 lines)
- Flask app · single endpoint `/generate` (POST)
- Routes for `/` (serves index.html) and `/<filename>` (static files)
- `calculate_nutrition(body_comp, activity_factor, strategy)` — Katch-McArdle RMR + macros
- `build_program_pdf(form_data)` — the orchestrator: parses form → builds `Assessment` → calls `Generator.build_program()` → calls `render_program()` → returns PDF bytes
- One server-side blocker: form_data must be a dict. Everything else has graceful defaults.

### Program engine
**`generator/generator.py`** (3,512 lines · the big one)

Dataclasses:
- `MobilityRating`, `FRAPriority`, `Assessment`, `Exercise`, `Block`, `Session`, `Week`, `Program`

`Generator` class methods:
- Library loaders: `_load_unified_db`, `_load_markers`, `_load_hip_mobility`, `_load_corrective_library`, `_load_core_accessory_library`, `_load_accessory_library`
- Filtering: `_filter_variants_by_concerns`, `_infer_client_tier`
- Pickers: `_pick_core_accessory` (Strength B slot 1), `_pick_corrective_from_library` (Strength B slot 3), `_pick_strength_c_accessories` (3 picks day-routed), `_pick_strength_exercise` (Strength A pattern picker), `_match_pattern_to_tested_exercise`
- Block builders: `_build_cars_sequence`, `_build_mobility_prep`, `_build_strength_a`, `_build_strength_b`, `_build_hiit_finisher`, `_build_decompression_cooldown`, `_build_coach_finisher`, `_build_capsule_work_block`, `_build_joint_care`
- Strength math integration: `_strength_dose`, `_progression_note`, `_apply_week_progression`, `_attach_week_prescriptions`, `_fill_load`
- Top-level: `__init__(libraries_path)`, `build_program(assessment)`, `_assign_priorities`, `_build_week`, `_build_session`

Module-level: `parse_fra_priority(description)`, `sanitize_priority_description(raw)`

### PDF rendering
**`generator/plan_pdf.py`** (3,354 lines)
- `NumberedCanvas` — Canvas subclass that fixes page-count off-by-one
- Mode-aware drawing: client / coach / full
- Page builders: `draw_cover`, `draw_pantry_pages`, `draw_body_comp_and_nutrition`, `draw_fra_priorities`, `draw_mobility_map`, `draw_strength_markers`, `draw_strength_session_pages`, `draw_cardio_session_pages`, `draw_recovery_section`, `draw_coach_appendix`
- Helpers: `page_footer`, `_draw_wrapped` (no truncation marker), `_cardio_intensity_label`
- `_CLIENT_BLOCK_LABEL_REMAP` — "Coach Finisher" → "Assisted Recovery" in client mode
- Coach appendix flags soft anchor matches (category, fuzzy) with ⚠ warnings
- Per-mode capsule work softening: client sees "light effort", coach/full sees "@ 20-40%"
- Per-hand-aware suspicious-weight floors

### Cardio
**`generator/cardio_profile.py`** (288 lines)
- `parse_cardio_profile(raw_dict)` — type-coerces nested form data into structured object with `primary_modality`, `secondary_modalities`, `avoid_modalities`, `limitations`, `z2_baseline`, `interval_test`, `hr_recovery`

**`generator/cardio_rules.py`** (1,017 lines)
- Constants: `MODALITIES` (7 modalities), `MODALITY_DISPLAY`, `JOINT_LIMITS`, `CONDITION_LIMITS`
- Tables: `_SAFE_MACHINES_BY_LIMIT`, `_RISKY_MACHINES_BY_LIMIT`, `_GENERAL_PRIORITY`, `_FINISHER_VETOES_BY_LIMIT`
- `normalize_cardio_profile()` — input validation + filters avoid out of secondary
- `choose_primary_cardio_machine()` / `decide_machine_with_audit()` — machine selection
- `detect_contradictions()` — flags incompatible setups
- `determine_interval_clearance()` — returns blocked/z2_only/cleared
- `generate_cardio_progression()` — 4-week prescription dict
- `generate_cardio_coach_flags()` — warnings (e.g., treadmill+knee-sensitive)
- `filter_finishers_by_cardio_limitations()` / `replacement_finisher_pool()`

### Strength
**`generator/strength_testing.py`** (342 lines)
- `parse_strength_tests(raw_list)` — validates rep max consistency, returns list[StrengthMarkerTest]

**`generator/strength_anchor_resolver.py`** (573 lines)
- `_ALIAS_GROUPS_RAW` — 9 groups, 240 aliases (hip_extension, horizontal_press, vertical_press, vertical_pull, horizontal_pull, squat_pattern, lunge_pattern, hinge_pattern, carry_pattern)
- `_SINGULAR_FORMS` — handles plurals
- `_GROUP_TO_CATEGORY` — group → movement_category fallback
- `normalize_exercise_name()`, `_alias_group_for()`, `get_group_category()`
- `resolve_anchor_for_exercise()` — main entry, returns (test, method) where method in {exact, alias, fuzzy, category, None}
- `apply_anchor_to_program_exercise()` — attaches loads + week_prescriptions
- `AnchorUsageTracker` — for USED/UNUSED appendix

Match priority: exact > alias > fuzzy > category (last is soft warning, no loads applied)

**`generator/strength_math.py`** (361 lines)
- Constants: `TRAINING_MAX_MULTIPLIER = 0.85`, `FORM_QUALITY_MULTIPLIERS` (clean/moderate/poor → 1.00/0.93/0.85), `PAIN_NOTES_REDUCTION = 0.90`, `WEEK_PCT_OF_1RM = {1:0.65, 2:0.72, 3:0.78, 4:0.83}`
- `estimate_1rm(weight, reps)` — Epley
- `calculate_estimates_from_tests(test)` — picks most conservative across rep maxes
- `get_working_weight_for_reps(test, target_reps, week)`
- `round_load(weight, equipment_type)` — barbell→5 lb, DB→2.5 lb
- `detect_inconsistencies(test)` — flags impossible patterns
- `WeekPrescription` dataclass

### Library JSON files (in `libraries/`)
| File | Size | Purpose |
|---|---|---|
| `exercise_database.json` | 1,170 KB | 604 exercises across CARs, base positions, end range, external training, full range, ISO ramping, PAILs/RAILs, playbook |
| `pails_rails_library.json` | 199 KB | Detailed PAIL/RAIL prescriptions |
| `base_position_library.json` | 150 KB | Base position drills |
| `corrective_library.json` | 47 KB | 25 joint+direction pools, 136 variants for Strength B corrective |
| `iso_ramping_library.json` | 43 KB | Isometric ramp protocols |
| `cars_library.json` | 22 KB | Controlled articular rotations |
| `accessory_library.json` | 17 KB | 8 categories × ~50 entries for Strength C |
| `hip_mobility_targets.json` | 12 KB | 6 hip targets × 8 cue fields for Capsule Work |
| `core_accessory_library.json` | 8 KB | 22 entries × 5 categories for Strength B core |
| `strength_markers.json` | 8 KB | Strength marker definitions |
| `treadmill_exercises.json` | 6 KB | 6 tagged treadmill entries (not yet wired into output) |

All libraries use the same tag schema:
```
{
  "client_level": "beginner|intermediate|advanced",
  "knee_sensitive": "safe|caution|avoid",
  "low_back_sensitive": "safe|caution|avoid",
  "shoulder_sensitive": "safe|caution|avoid",
  "wrist_sensitive": "safe|caution|avoid",
  "default_dose": "..."
}
```

### Test files (`tests/`)
| File | Tests | Coverage |
|---|---|---|
| `test_strength_system.py` | 63 | Strength A/B/C variety, anchor application, dedup, knee filtering |
| `test_cardio_system.py` | 48 | Treadmill, modality routing, avoid/secondary contradiction, Amanda regression |
| `test_strength_anchor_resolver.py` | 19 | Alias matching, plural handling, fuzzy fallback |

**130 tests total · all passing.**

---

## 3 · Full Assessment Input Schema

### Client Basics
| Field | JSON key |
|---|---|
| Client name | `client_name` |
| Assessment date | `assessment_date` |
| Age range | `age_range` |
| Sex (M/F) | `sex` |
| Background | `background` |

### Training Frequency
| Field | JSON key |
|---|---|
| Strength days/week | `strength_days` |
| Cardio days/week | `cardio_days` |

### Goals
| Field | JSON key |
|---|---|
| Primary goal | `primary_goal` |

### FRA Priorities
Repeating list of free-text strings.
| Field | JSON key |
|---|---|
| FRA priorities (array) | `fra_priorities` |

### Mobility Map
Repeating rows. Each contributes one object.
| Field | JSON key |
|---|---|
| Joint | `mobility_map[].joint` |
| Direction | `mobility_map[].direction` |
| Side (L/R/bilateral) | `mobility_map[].side` |
| Rating (red/yellow/green) | `mobility_map[].rating` |

### Constraints
| Field | JSON key |
|---|---|
| Constraint flags (array) | `constraints` |
| Per-constraint rich data | `constraints_rich[]` (key, display_name, side, status, pain_level, avoid_notes, allowed_notes, coach_notes) |
| Other constraint freetext | `other_constraint` |

Constraint values: `SI_joint_sensitivity`, `no_axial_loading`, `post_surgery_shoulder`, `post_surgery_knee`, `post_surgery_hip`, `chronic_low_back`, `chronic_shoulder_impingement`, `pregnancy`

### Concerns
| Field | JSON key |
|---|---|
| Concern flags (array) | `concerns` |
| Concern notes | `concern_notes` |

Concern values: `bad_knee`, `bad_shoulder`, `lower_back`, `hip`, `neck`, `wrist`, `elbow`, `ankle`

### Strength Tests
Repeating cards. Each contributes one object.
| Field | JSON key |
|---|---|
| Exercise name | `strength_marker_tests[].exercise_name` |
| Movement category | `strength_marker_tests[].movement_category` |
| Load style (per_hand/total_load/bodyweight_added) | `strength_marker_tests[].load_style` |
| 12RM/10RM/8RM/6RM/5RM/3RM/1RM | `strength_marker_tests[].tested_12rm` ... `tested_1rm` |
| Form quality (clean/moderate/poor) | `strength_marker_tests[].form_quality` |
| Pain or compensation notes | `strength_marker_tests[].pain_or_compensation_notes` |
| Test notes | `strength_marker_tests[].test_notes` |
| Coach notes | `strength_marker_tests[].coach_notes` |

### Accessory Categories (Strength C)
| Field | JSON key |
|---|---|
| Category checkboxes (array) | `accessory_categories` |

Values: `arms`, `calves_tibialis`, `glutes_extra`, `grip_forearms`, `neck_traps`, `shoulders_delts`, `loaded_carries`, `conditioning_accessories`

### Cardio Profile
All fields nest under `cardio_profile`.
| Field | JSON key |
|---|---|
| Primary modality | `cardio_profile.primary_modality` |
| Secondary modalities (array) | `cardio_profile.secondary_modalities` |
| Avoid modalities (array) | `cardio_profile.avoid_modalities` |
| Limitations (array) | `cardio_profile.limitations` |
| Interval clearance | `cardio_profile.interval_clearance_status` |
| Z2 baseline (object) | `cardio_profile.z2_baseline.{machine, duration_minutes, avg_hr, peak_hr, rpe, distance, calories, avg_watts, resistance_level, notes, joint_tolerance_notes}` |
| Interval test (object) | `cardio_profile.interval_test.{machine, protocol, work_seconds, rest_seconds, rounds, peak_watts, avg_watts, peak_hr, ending_rpe, joint_tolerance_notes, recovery_notes}` |
| HR recovery (object) | `cardio_profile.hr_recovery.{end_hr, one_min_hr, drop_one_min}` |

Modality values: `upright_bike`, `stationary_bike`, `arc_trainer`, `treadmill`, `assault_bike`, `rower`, `skierg`
Limitation values: `knee_sensitive`, `hip_sensitive`, `low_back_sensitive`, `shoulder_sensitive`, `wrist_sensitive`, `conditioning_beginner`, `deconditioned`, `high_stress_poor_recovery`
Interval clearance values: `not_assessed`, `cleared_for_intervals`, `not_cleared_for_intervals`

### Body Composition
All fields nest under `body_comp`.
| Field | JSON key |
|---|---|
| Weight | `body_comp.weight` |
| Body fat % | `body_comp.body_fat` |
| Lean mass | `body_comp.lean_mass` |
| Fat mass | `body_comp.fat_mass` |
| Method (BOD POD/DEXA/etc) | `body_comp.method` |
| Test date | `body_comp.date` |

### Nutrition
| Field | JSON key |
|---|---|
| Nutrition strategy | `nutrition_strategy` |
| Activity factor | `activity_factor` |

Nutrition values: `maintenance`, `fat_loss`, `strength`, `endurance`
Activity factor values: `1.2`, `1.375`, `1.45`, `1.55`

### Coach Notes + PDF Mode
| Field | JSON key |
|---|---|
| Coach freeform notes | `coach_notes` |
| PDF mode | `pdf_mode` (client/coach/full) |

---

## 4 · Current Validation Rules

### Hard blockers (prevent submit)

All in `web/index.html` `validate(data)` function (lines 2116–2217):

| Rule | Line |
|---|---|
| Client name required | 2120 |
| Age range required | 2121 |
| Sex required | 2122 |
| Primary goal required | 2123 |
| At least 1 FRA priority | 2124 |
| At least 1 mobility rating | 2128 |
| Incomplete mobility rows flagged | 2131 |
| At least 1 session/week | 2140 |
| Max 6 sessions/week | 2137 |
| Body comp arithmetic · lean+fat vs weight ±5% | 2153 |
| Body comp arithmetic · BF% vs fat mass ±3% | 2164 |
| Sample day calorie drift > 100 cal | 2179 (placeholder) |

Plus HTML `required` attribute on `client-name` input (line 722).

Server side: only one blocker — `form_data` must be a dict (`app.py` line 121).

### Soft warnings (prompt to proceed)

Distinguished by message starting with `"Heads up"`. Block routing happens in `generatePlan()` (`web/index.html` lines 1993–2022).

| Rule | Where |
|---|---|
| Concern × strength anchor mismatch | `web/index.html` line 2203 |

Mismatch table:
- `bad_knee` → squat, lunge
- `bad_shoulder` → push_horizontal, push_vertical, pull_vertical
- `lower_back` → hinge, squat, carry
- `hip` → hinge, squat, lunge
- `elbow` → push_horizontal, push_vertical, pull_horizontal, pull_vertical
- `wrist` → push_horizontal, pull_horizontal

---

## 5 · Optional/Bypassable Fields

### Currently graceful (no block, generator handles missing)
- **`background`** — defaults to empty string
- **`coach_notes`** — empty string
- **`assessment_date`** — empty
- **`accessory_categories`** — Strength C uses day-type defaults (calves/glutes/carries for LB, arms/neck/shoulders for UB)
- **`constraints`** + **`constraints_rich`** — empty list, no constraints applied
- **`concerns`** + **`concern_notes`** — empty list, no concern filtering
- **`other_constraint`** — empty
- **`pdf_mode`** — defaults to `"client"`

### Currently optional with consequence
- **Body composition** — if `body_comp.weight` is missing, nutrition calc is skipped and `body_comp` becomes empty dict. Page still renders but with placeholder copy. **Frontend BLOCKS if lean+fat/weight arithmetic fails or BF%/fat mass mismatch**, even though body comp itself is otherwise optional.
- **Cardio profile** — if `cardio_profile` is None or empty, generator falls back to a generic cardio block (no machine routing, no progression). Coach gets a warning in the appendix.
- **Strength tests** — if no tests provided, Strength A still picks exercises but with no anchored loads. Doses fall back to RIR-only prescriptions ("3 × 10 · RIR 2-3"). The complement slot in Strength B (Hamstring Bridge etc.) renders without load.
- **Activity factor** — defaults to 1.45
- **Nutrition strategy** — defaults to maintenance

### Currently REQUIRED (hard blockers despite being potentially optional in real use)
- **Client name** — blocked frontend + server falls back to "Client" but frontend never lets it through
- **Age range** — blocked frontend
- **Sex** — blocked frontend
- **Primary goal** — blocked frontend
- **At least 1 FRA priority** — blocked frontend
- **At least 1 mobility rating** — blocked frontend (with row completeness check)
- **At least 1 session/week** — blocked frontend
- **Max 6 sessions/week** — blocked frontend

### Specific scenarios
| Scenario | Today's behavior |
|---|---|
| BOD POD missing | Body comp dict empty, nutrition page shows "no data". Soft fail. |
| Cardio test missing | Generic cardio block. Coach gets warnings in appendix. Soft fail. |
| Strength anchor test missing | Programs render with RIR-only doses. Soft fail. |
| FRA/mobility rows missing | **HARD BLOCKED** at frontend. Cannot submit. |
| Nutrition data missing | Nutrition page shows defaults / empty. Soft fail. |

The big asymmetry: mobility + FRA priorities are required to submit, but body comp/cardio/strength tests are not. For a real coaching tool, ALL of these need bypass support.

---

## 6 · Current Output JSON Structure

The `Program` object (built in `generator/generator.py`) has this structure before going into the PDF renderer. It can be serialized to JSON via `Program.to_json(path)`:

```json
{
  "assessment": { "...": "full echo of input Assessment, see schema in section 3" },
  "block_number": 1,
  "weeks": [
    {
      "week_number": 1,
      "intent": "Base volume · groove movement patterns",
      "progression_notes": ["W1 base volume · build tolerance", "..."],
      "sessions": [
        {
          "day_number": 1,
          "day_type": "strength_lb",
          "lead_priority": { "description": "Hip IR L+R", "joints": ["hip"], "directions": ["ir"], "sides": ["bilateral"] },
          "blocks": [
            {
              "name": "CARs Sequence",
              "duration_note": "~5 min · joint preparation",
              "exercises": [
                { "name": "Hip CARs · Standing", "library": "cars", "dose": "2 × 3 each direction", "rationale": "...", "anchor_match_method": null, "week_prescriptions": [] }
              ]
            },
            { "name": "Mobility Prep", "exercises": ["..."] },
            {
              "name": "Strength A",
              "exercises": [
                {
                  "name": "Hip Thrusts",
                  "library": "external_training",
                  "dose": "3 × 12",
                  "anchor_match_method": "exact",
                  "anchor_source_name": "Hip Thrusts",
                  "week_prescriptions": [
                    { "weight": 170, "weight_unit": "lb", "reps": 12, "sets": 3, "tempo_or_rir": "RPE 7" },
                    { "weight": 185, "weight_unit": "lb", "reps": 10, "sets": 3, "tempo_or_rir": "3-sec eccentric" },
                    { "weight": 200, "weight_unit": "lb", "reps": 8, "sets": 4, "tempo_or_rir": "RPE 8" },
                    { "weight": 215, "weight_unit": "lb", "reps": 6, "sets": 4, "tempo_or_rir": "RPE 8-9" }
                  ]
                },
                { "name": "Bench Supported RDL", "...": "..." }
              ]
            },
            { "name": "Strength B", "exercises": ["core + complement + corrective"] },
            { "name": "Strength C", "exercises": ["3 day-routed accessories"] },
            { "name": "Conditioning Reset", "exercises": ["..."] },
            { "name": "Cool Down", "exercises": ["..."] },
            { "name": "Coach Finisher", "exercises": ["..."] },
            { "name": "Capsule Work (PAIL/RAIL)", "exercises": [{ "name": "90/90 Back Leg · Posterior Capsule (IR Bias)", "dose": "20s PAIL @ 20-40% · 20s RAIL @ 20-40% · 20s breathe · 2 rounds" }] }
          ]
        },
        { "day_number": 2, "day_type": "cardio", "blocks": ["..."] },
        { "day_number": 3, "day_type": "strength_ub", "blocks": ["..."] }
      ]
    },
    { "week_number": 2, "...": "..." },
    { "week_number": 3, "...": "..." },
    { "week_number": 4, "...": "..." }
  ]
}
```

### Which parts become which PDF pages

| Program field | PDF page(s) |
|---|---|
| `assessment.client_name`, `age_range` | Cover page |
| `assessment.body_comp` + nutrition_targets | Body comp + nutrition pages (Section 04) |
| `assessment.fra_priorities` | FRA Priorities page (Section 05) |
| `assessment.mobility_map` | Mobility Map page (Section 06) |
| `assessment.strength_marker_tests` | Strength Markers page (Section 06b) |
| `weeks[*].sessions[*].blocks[*]` | Strength session pages (Section 07) and cardio session pages (Section 08) — one session per page (or two pages for long ones) |
| Recovery blocks + capsule work | Recovery section (Section 09) |
| Coach appendix (USED/UNUSED anchors, warnings) | Last pages, coach + full modes only |

---

## 7 · Recommended Bypass System

Add a `completion_status` field to each major data section. Use this enum throughout the pipeline:

```
"complete"        - Fully filled in, valid
"partial"         - Some fields filled, intentionally leaving some blank
"skipped_today"   - Coach is skipping for THIS session, will revisit
"pending"         - Will be completed later, generator should hold a slot
"not_applicable"  - This client doesn't need this section (e.g., no body comp because no goal weight)
```

### Per-section design

```json
{
  "body_comp": {
    "completion_status": "skipped_today",
    "data": null,
    "skip_reason": "No BOD POD this week, will revisit Friday"
  },
  "cardio_profile": {
    "completion_status": "partial",
    "data": {
      "primary_modality": "stationary_bike",
      "limitations": ["knee_sensitive"]
    },
    "skip_reason": "No Z2 test yet, will assess next session"
  },
  "strength_tests": {
    "completion_status": "complete",
    "data": ["..."]
  },
  "mobility_assessment": {
    "completion_status": "complete",
    "data": ["..."]
  },
  "nutrition": {
    "completion_status": "not_applicable",
    "data": null,
    "skip_reason": "Coach handles nutrition separately, not in scope"
  }
}
```

### Generator behavior per status

| Section | `complete` | `partial` | `skipped_today` | `pending` | `not_applicable` |
|---|---|---|---|---|---|
| body_comp | Run nutrition calc, render full | Render what's filled, gray out missing | Render placeholder "Body comp not assessed this session" | Render placeholder "Coming soon" | Hide section entirely from PDF |
| cardio_profile | Full machine routing + 4-week progression | Use what's there, fall back where missing | Generic cardio block + "needs assessment" coach flag | Generic cardio + "scheduled for review" | Hide cardio section, no cardio days |
| strength_tests | Anchor all loads | Anchor what's testable, RIR-only for the rest | RIR-only programming + "retest scheduled" note | Skeleton sets/reps + "loads pending" | Strength still runs without loads, RIR-only by design |
| mobility_assessment | Full priority routing | Use what's there | Today is just CARs maintenance, no targeted prep | "Pending FRA next session" | No mobility section, just CARs |
| nutrition | Full Katch-McArdle + macros | Strategy without targets | Hide nutrition page | Hide with "scheduled" note | Hide entirely |

### UI implication

Each section gets a status selector at the top:
```
[ ✓ Complete ] [ Partial ] [ Skip Today ] [ Pending ] [ N/A ]
```

When coach picks "Skip Today" they get an optional reason field. When they pick "Partial", the form fields stay enabled but the form doesn't block on missing values.

### Validation update

Replace hard blockers with status-aware logic:
- Status `complete` → run today's full validation
- Status `partial` → run only field-level validation (e.g., if weight is set, body fat % must be valid)
- Status `skipped_today` / `pending` / `not_applicable` → skip all validation for this section

This eliminates the asymmetry where mobility is required but body comp isn't.

---

## 8 · Sample Payloads

### A · Full complete assessment

```json
{
  "client_name": "Amanda Patterson",
  "assessment_date": "Apr 21, 2026",
  "age_range": "early 50s",
  "sex": "F",
  "background": "post-knee surgery 2019, software engineer, sedentary day job",
  "strength_days": 3,
  "cardio_days": 2,
  "primary_goal": "Get stronger and protect knee",

  "fra_priorities": ["Hip IR L+R", "Ankle Dorsiflexion"],
  "mobility_map": [
    { "joint": "hip", "direction": "IR", "side": "L", "rating": "yellow" },
    { "joint": "knee", "direction": "flexion", "side": "R", "rating": "red" },
    { "joint": "ankle", "direction": "dorsiflexion", "side": "bilateral", "rating": "yellow" }
  ],

  "constraints": ["post_surgery_knee"],
  "constraints_rich": [{
    "key": "post_surgery_knee",
    "display_name": "Post-Surgery Knee",
    "side": "right",
    "status": "post_surgery",
    "pain_level": 3,
    "avoid_notes": "loaded twisting, deep loaded knee flexion, impact"
  }],

  "concerns": ["bad_knee"],
  "concern_notes": "Right meniscus repair · stairs going down sometimes flares",

  "strength_marker_tests": [
    { "exercise_name": "Hip Thrusts", "movement_category": "hinge", "load_style": "total_load", "tested_3rm": 235, "form_quality": "clean" },
    { "exercise_name": "Incline Bench Press", "movement_category": "press_horizontal", "load_style": "per_hand", "tested_5rm": 30, "form_quality": "clean" },
    { "exercise_name": "3 Point Row", "movement_category": "pull_horizontal", "load_style": "per_hand", "tested_3rm": 35, "form_quality": "clean" },
    { "exercise_name": "Bench Supported RDL", "movement_category": "hinge", "load_style": "per_hand", "tested_8rm": 25, "form_quality": "clean" }
  ],

  "accessory_categories": ["arms", "calves_tibialis", "glutes_extra", "loaded_carries"],

  "cardio_profile": {
    "primary_modality": "stationary_bike",
    "secondary_modalities": ["treadmill"],
    "avoid_modalities": ["rower"],
    "limitations": ["knee_sensitive", "not_cleared_for_intervals"],
    "z2_baseline": { "machine": "stationary_bike", "duration_minutes": 10, "avg_hr": 130, "rpe": 4 },
    "interval_test": {},
    "hr_recovery": { "end_hr": 150, "one_min_hr": 130, "drop_one_min": 20 }
  },

  "body_comp": {
    "weight": "168 lbs",
    "body_fat": "28%",
    "lean_mass": "121 lbs",
    "fat_mass": "47 lbs",
    "method": "BOD POD",
    "date": "Apr 14, 2026"
  },

  "nutrition_strategy": "maintenance",
  "activity_factor": 1.45,
  "coach_notes": "Knee is the watchpoint. Build patience.",
  "pdf_mode": "client"
}
```

### B · No BOD POD/body comp

Same as A, but:
```json
{
  "body_comp": {
    "completion_status": "skipped_today",
    "data": null,
    "skip_reason": "No BOD POD scheduled, will reassess in 4 weeks"
  },
  "nutrition_strategy": "maintenance",
  "activity_factor": 1.45
}
```

Generator behavior: hides the body comp + nutrition pages, or renders placeholder copy.

### C · No cardio test

Same as A, but:
```json
{
  "cardio_profile": {
    "completion_status": "partial",
    "data": {
      "primary_modality": "stationary_bike",
      "limitations": ["knee_sensitive"]
    },
    "skip_reason": "Z2 baseline test not yet performed"
  },
  "cardio_days": 2
}
```

Generator behavior: cardio days exist but use generic Zone 2 prescriptions (no specific HR/wattage targets). Coach flag in appendix: "Cardio profile incomplete · book Z2 baseline next session."

### D · No strength testing

Same as A, but:
```json
{
  "strength_tests": {
    "completion_status": "skipped_today",
    "data": [],
    "skip_reason": "First session · no testing yet, building patterns"
  }
}
```

Generator behavior: Strength A still runs with day-appropriate exercises but doses are RIR-based ("3 × 10 · RIR 2-3"). No anchored loads. Coach appendix flags ALL strength slots as "no anchor."

### E · Minimal quick-start plan

```json
{
  "client_name": "New Client",
  "age_range": "30s",
  "sex": "M",
  "primary_goal": "General strength + mobility",
  "strength_days": 2,
  "cardio_days": 0,

  "fra_priorities": ["Hip IR", "Shoulder ER"],
  "mobility_assessment": {
    "completion_status": "skipped_today",
    "data": [],
    "skip_reason": "Quick-start · doing first session today, will assess next"
  },

  "constraints": [],
  "concerns": ["bad_knee"],

  "strength_tests": { "completion_status": "skipped_today", "data": [] },
  "body_comp": { "completion_status": "not_applicable", "data": null },
  "cardio_profile": { "completion_status": "not_applicable", "data": null },
  "nutrition": { "completion_status": "not_applicable", "data": null },

  "accessory_categories": [],
  "pdf_mode": "client"
}
```

Generator behavior: 2 strength sessions per week, RIR-only programming, just CARs for mobility prep, no nutrition/body comp/cardio pages, Strength C uses day-type defaults. Coach gets a draft they can iterate from.

---

## 9 · Refactor Plan for IMS Coach OS

Migration from `single form → PDF` to `Client Profile → Wizard → Saved Assessment → Draft Program → Review/Edit → Export`:

### Phase 1 · Persistence layer (foundational)

**Decouple state from request.** Today, the only state is a transient form in the browser and a transient Python object in the request handler. Add Supabase to persist:
- Clients (with coach assignment)
- Assessments (immutable snapshots with completion_status per section)
- Programs (mutable drafts that hold the generated JSON, editable by coach)
- PDF exports (records of who exported what, when, in what mode)

Keep the existing generator + PDF renderer untouched. They become "the engine" called from new endpoints.

### Phase 2 · Client Profile

**New entity: Client.** A coach has many clients. A client has many assessments over time. The current "form" becomes "create new assessment for this client."

UI: client list page → click client → see history of assessments + active program → "New Assessment" button.

Fields: name, contact info, intake date, coach_id, intake notes. Body comp history goes here too (separate from assessments — it's a longitudinal record).

### Phase 3 · Assessment Wizard

Convert `web/index.html` from a single-page form to a multi-step wizard. Each step is one section from the current form. Each step has the new completion_status selector.

Steps:
1. Identity (auto-filled from client profile)
2. Schedule + goals
3. FRA priorities
4. Mobility map
5. Constraints + concerns
6. Strength tests *(skippable)*
7. Body comp *(skippable)*
8. Cardio profile *(skippable)*
9. Accessory plug-in
10. Nutrition *(skippable)*
11. Coach notes
12. Review + save

Save assessment to DB at every step (autosave). At the end, click "Generate Draft" → run generator → save program JSON.

### Phase 4 · Draft Program

The Program JSON returned by the generator is now persisted as a `plans` row. Coach can:
- View the generated draft in a structured editor (not a PDF)
- Swap an exercise for another from the same library/category
- Adjust loads, sets, reps, doses, rationale text
- Reorder blocks within a session
- Delete a session
- Add a custom session
- Mark sessions complete during the week

The PDF becomes one of several views:
- **Plan editor** (HTML, mutable) — coach-facing
- **Client portal** (HTML, read-only) — client-facing
- **PDF export** (downloadable, snapshot at point of export)

### Phase 5 · Multi-export

PDFs can be exported in any of the 3 modes (client / coach / full) at any time, without re-running the generator. A new export uses the current saved plan JSON.

Export records get logged in `pdf_exports` table for audit.

### Phase 6 · Coach review workflow

- Coach generates draft → status = `draft`
- Coach reviews/edits → status = `coach_approved`
- Coach delivers to client → status = `delivered`
- Client completes weeks → session_notes get added
- Coach iterates → new assessment + new plan → status of old plan = `archived`

### Phase 7 · Eventually

- Multi-tenant: multiple coaches, each with their own clients
- Calendar integration (when sessions actually happen)
- Workout completion tracking by client
- Adaptation: Week 4 retest data feeds into next block's anchors
- Analytics dashboard for coach (compliance, progress trends)

### Architecture diagram

```
Today:                                          Coach OS:

[Browser form]                                  [Browser SPA]
     │                                              │
     ▼                                              ▼
[POST /generate]  ──►  [PDF response]           [Auth: coach login]
                                                    │
                                                    ▼
                                                [Supabase: clients, assessments, plans]
                                                    │
                                                    ▼
                                                [Generator engine] ──► [Saved plan JSON in DB]
                                                    │
                                                    ▼
                                                [Edit/Review UI]
                                                    │
                                                    ▼
                                                [Export endpoints]
                                                  ├─ PDF (client/coach/full)
                                                  ├─ Client portal HTML
                                                  └─ Plain JSON
```

### What stays unchanged

- `generator/generator.py` — same engine, called from new endpoints
- `generator/plan_pdf.py` — same renderer, called for export only
- `generator/cardio_rules.py`, `strength_anchor_resolver.py`, `strength_math.py` — untouched
- All library JSON files

### What changes

- `web/index.html` — broken into wizard steps + new editor UI components
- `app.py` — endpoints split into `/clients`, `/assessments`, `/plans`, `/exports`. Each becomes thinner. Auth middleware added.
- New: database migrations, ORM models (or just Supabase RPC), auth flow

---

## 10 · Supabase Readiness

PDF is no longer the source of truth. The saved plan JSON in `plans.program_json` is the source of truth.

### Schema

```sql
-- Coaches
CREATE TABLE trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  studio_id UUID,  -- multi-tenant later
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  age_range TEXT,
  sex TEXT,
  background TEXT,
  intake_date DATE,
  status TEXT DEFAULT 'active',  -- active / paused / churned
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assessments (immutable snapshots)
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  assessment_date DATE NOT NULL,
  primary_goal TEXT,
  strength_days INT,
  cardio_days INT,
  fra_priorities JSONB,  -- list of strings
  constraints JSONB,
  constraints_rich JSONB,
  concerns JSONB,
  concern_notes TEXT,
  accessory_categories JSONB,  -- list of strings
  coach_notes TEXT,
  -- Section completion statuses
  body_comp_status TEXT DEFAULT 'pending',  -- enum from §7
  cardio_status TEXT DEFAULT 'pending',
  strength_status TEXT DEFAULT 'pending',
  mobility_status TEXT DEFAULT 'pending',
  nutrition_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Body composition tests (longitudinal · belongs to client, not assessment)
CREATE TABLE body_comp_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  assessment_id UUID REFERENCES assessments(id),  -- nullable · can exist outside an assessment
  test_date DATE NOT NULL,
  method TEXT,  -- BOD POD / DEXA / InBody / etc
  weight_lb NUMERIC,
  body_fat_pct NUMERIC,
  lean_mass_lb NUMERIC,
  fat_mass_lb NUMERIC,
  rmr_kcal NUMERIC,  -- computed
  tdee_kcal NUMERIC,  -- computed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mobility findings (one row per joint+direction+side per assessment)
CREATE TABLE mobility_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  joint TEXT NOT NULL,
  direction TEXT NOT NULL,
  side TEXT NOT NULL,  -- L / R / bilateral
  rating TEXT NOT NULL,  -- red / yellow / green
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Strength tests (one row per anchor per assessment)
CREATE TABLE strength_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  exercise_name TEXT NOT NULL,
  movement_category TEXT,
  load_style TEXT,  -- per_hand / total_load / bodyweight_added
  tested_12rm NUMERIC, tested_10rm NUMERIC, tested_8rm NUMERIC,
  tested_6rm NUMERIC, tested_5rm NUMERIC, tested_3rm NUMERIC, tested_1rm NUMERIC,
  form_quality TEXT,  -- clean / moderate / poor
  pain_or_compensation_notes TEXT,
  test_notes TEXT,
  coach_notes TEXT,
  -- Computed
  estimated_1rm NUMERIC,
  training_max NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cardio profiles (one per assessment, with nested test data)
CREATE TABLE cardio_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  primary_modality TEXT,
  secondary_modalities JSONB,  -- list
  avoid_modalities JSONB,
  limitations JSONB,
  interval_clearance_status TEXT,
  z2_baseline JSONB,  -- nested object
  interval_test JSONB,
  hr_recovery JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Plans (the editable program · the new source of truth)
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  trainer_id UUID NOT NULL REFERENCES trainers(id),
  block_number INT DEFAULT 1,  -- 1st 4-week block, 2nd, etc.
  status TEXT DEFAULT 'draft',  -- draft / coach_approved / delivered / archived
  program_json JSONB NOT NULL,  -- the full Program object · source of truth
  generator_version TEXT,  -- track which version of the engine produced this
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

-- Plan sessions (denormalized from program_json for query speed · optional)
CREATE TABLE plan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  day_number INT NOT NULL,
  day_type TEXT NOT NULL,  -- strength_lb / strength_ub / cardio
  lead_priority TEXT,
  scheduled_date DATE,  -- when client should do it (calendar integration)
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Plan exercises (denormalized further · for swap/edit UX)
CREATE TABLE plan_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_session_id UUID NOT NULL REFERENCES plan_sessions(id) ON DELETE CASCADE,
  block_name TEXT NOT NULL,  -- "Strength A" / "Strength B" / "Strength C" / etc.
  position INT NOT NULL,  -- order within the block
  exercise_name TEXT NOT NULL,
  library TEXT,
  dose TEXT,
  rationale TEXT,
  anchor_match_method TEXT,
  anchor_source_name TEXT,
  week_prescriptions JSONB,  -- [W1, W2, W3, W4] load+rep prescriptions
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PDF exports (audit log)
CREATE TABLE pdf_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id),
  exported_by UUID NOT NULL REFERENCES trainers(id),
  mode TEXT NOT NULL,  -- client / coach / full
  pdf_url TEXT,  -- if stored in Supabase Storage
  file_size_bytes INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Session completion notes (for tracking client progress)
CREATE TABLE session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_session_id UUID NOT NULL REFERENCES plan_sessions(id),
  noted_by UUID REFERENCES trainers(id),  -- nullable · could be client too
  note_text TEXT,
  rpe_actual NUMERIC,  -- if client logs how it felt
  loads_actual JSONB,  -- per-exercise actual weights used
  pain_or_compensation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Source-of-truth principle

- `plans.program_json` is **the canonical state** of any program.
- `plan_sessions` and `plan_exercises` are **denormalized indices** for query speed and UX. They get rebuilt from `program_json` whenever it changes (or eliminated entirely if you don't need them).
- PDFs are **frozen exports**. They reflect `program_json` at the moment of export. Audit log in `pdf_exports`.
- All assessment data is **immutable** once saved. To revise, create a new assessment.

### Row-level security

```sql
-- Coaches see only their own clients
CREATE POLICY "Coach sees own clients" ON clients
  FOR SELECT USING (trainer_id = auth.uid());

-- Same pattern for assessments, plans, etc.
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
```

### Migration path from current code

1. Add Supabase client to `app.py`
2. New endpoint `/clients` (list, create, update)
3. New endpoint `/clients/:id/assessments` (list, create as wizard step-by-step)
4. New endpoint `/assessments/:id/generate-plan` (calls existing `Generator.build_program()`, saves result to `plans.program_json`)
5. New endpoint `/plans/:id` (get, edit) — coach UI calls this for the editor
6. New endpoint `/plans/:id/export?mode=client` (calls existing `render_program()`, logs to `pdf_exports`, returns bytes)
7. Frontend wizard replaces single-page form
8. Frontend editor replaces "click and download PDF" flow
9. Existing `/generate` stays as a back-compat shim during transition · eventually deprecated

The generator and PDF renderer don't change. The shell around them does.

---

## What's NOT covered in this handoff

- Authentication flow (Supabase Auth or custom)
- File upload handling for body comp test images, etc.
- Client portal (separate frontend for the client to view their plan + log sessions)
- Calendar integration
- Payment / billing
- Mobile app considerations
- Notification system (email/SMS reminders)

These are downstream of getting the persistence layer + assessment wizard + plan editor working. They become straightforward once the core architecture is in place.

---

## Test coverage

Current: 130 tests passing across 3 suites (`tests/test_strength_system.py`, `tests/test_cardio_system.py`, `tests/test_strength_anchor_resolver.py`).

Migration must add:
- DB integration tests (mock Supabase)
- Auth middleware tests
- Endpoint contract tests for each new route
- Wizard step transition tests (frontend)
- Plan editor mutation tests (e.g., swapping an exercise updates `plan_exercises` correctly)
