"""IMS Coach OS · Exercise Library Adapter

Reads every library JSON file in `libraries/` (and `generator/strength_markers.json`)
and presents them as a single uniform list of exercises for the dashboard module.

Design contract:
  • Read-only · never mutates the source JSON files.
  • The Generator continues to read the source files exactly as before; this
    adapter is a SEPARATE view layer.
  • Each entry gets normalized into the same shape (`ExerciseLibraryItem`) so
    the frontend can render every exercise with the same card/drawer
    components regardless of source library.
  • `id` is stable: derived from source library + name. If the same exercise
    name appears in multiple libraries, each gets its own id.

Public API:
  load_all() → list of normalized exercises
  library_health(items) → validation summary
  search(items, query) → text-matched subset
  filter(items, **kwargs) → tag-matched subset
  get_categories(items) → category counts
  get_libraries(items) → source library counts
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Optional


# ─── Type & helpers ──────────────────────────────────────────

# These are the categories the frontend tab bar uses. Each source library
# maps to one of these. This is the ONLY place that knows about source-to-tab
# routing, so it's cheap to add new libraries later.
CATEGORY_BY_SOURCE = {
    "exercise_database":     "Strength",
    "corrective_library":    "Correctives",
    "accessory_library":     "Accessories",
    "core_accessory_library": "Core",
    "cars_library":          "CARs",
    "pails_rails_library":   "PAILs/RAILs",
    "base_position_library": "Base Positions",
    "hip_mobility_targets":  "Mobility Prep",
    "iso_ramping_library":   "ISO Ramping",
    "treadmill_exercises":   "Cardio",
    "strength_markers":      "Strength Markers",
}

# Sensitivity levels normalized to one of these tokens
_SENS_VALID = {"safe", "caution", "avoid"}


def _slug(s: str) -> str:
    """Slugify a name for stable IDs."""
    s = re.sub(r"[^\w\s-]", "", (s or "").lower())
    return re.sub(r"[\s_-]+", "-", s).strip("-")


def _norm_sensitivity(value: Any) -> Optional[str]:
    """Coerce a sensitivity tag to safe|caution|avoid|None."""
    if value is None:
        return None
    v = str(value).strip().lower()
    return v if v in _SENS_VALID else None


def _list_or_empty(value: Any) -> list:
    """Coerce list-ish values to a list. Tolerates None, str, list."""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if v is not None]
    if isinstance(value, str):
        # Some entries store comma-separated strings · split them
        return [p.strip() for p in value.split(",") if p.strip()]
    return [str(value)]


# ─── Normalized exercise shape ──────────────────────────────

@dataclass
class ExerciseLibraryItem:
    """The unified shape every exercise gets normalized into.

    Every field except `id`, `name`, `source_library`, `category` is optional.
    Frontend should display "Not specified" or hide if a field is missing.
    """
    id: str
    name: str
    source_library: str
    category: str
    raw: dict = field(default_factory=dict)

    movement_category: Optional[str] = None
    joint: Optional[str] = None
    direction: Optional[str] = None
    side: Optional[str] = None
    client_level: Optional[str] = None
    equipment: list[str] = field(default_factory=list)
    default_dose: Optional[str] = None

    setup: Optional[str] = None
    execution: Optional[str] = None
    coaching_cues: list[str] = field(default_factory=list)
    mistakes: list[str] = field(default_factory=list)
    progressions: list[str] = field(default_factory=list)
    regressions: list[str] = field(default_factory=list)
    rationale: Optional[str] = None

    tags: list[str] = field(default_factory=list)
    contraindications: list[str] = field(default_factory=list)

    sensitivity: dict = field(default_factory=dict)
    # Keys: knee, shoulder, low_back, wrist, hip → safe|caution|avoid|None

    program_uses: list[str] = field(default_factory=list)
    # E.g., ["warm_up", "strength_a", "strength_c", "recovery"]

    def to_dict(self) -> dict:
        return asdict(self)


# ─── Per-library normalizers ────────────────────────────────

def _build_sensitivity(d: dict) -> dict:
    """Pull standard sensitivity tags out of any dict."""
    return {
        "knee":     _norm_sensitivity(d.get("knee_sensitive")),
        "shoulder": _norm_sensitivity(d.get("shoulder_sensitive")),
        "low_back": _norm_sensitivity(d.get("low_back_sensitive")),
        "wrist":    _norm_sensitivity(d.get("wrist_sensitive")),
        "hip":      _norm_sensitivity(d.get("hip_sensitive")),
    }


def _normalize_exercise_database(data: dict) -> list[ExerciseLibraryItem]:
    """exercise_database.json · exercises is a dict keyed by id."""
    out = []
    exercises = (data or {}).get("exercises", {}) or {}
    for ex_id, ex in exercises.items():
        if not isinstance(ex, dict):
            continue
        name = ex.get("name") or ex_id
        # The source library name carries semantic info (cars, base_positions,
        # end_range, external_training, full_range, iso_ramping, pails_rails,
        # playbook). Use it to pick a more accurate category if possible.
        sub_lib = ex.get("library", "")
        category = {
            "cars": "CARs",
            "pails_rails": "PAILs/RAILs",
            "base_positions": "Base Positions",
            "iso_ramping": "ISO Ramping",
            "end_range": "Mobility Prep",
            "full_range": "Mobility Prep",
            "external_training": "Strength",
            "playbook": "Strength",
        }.get(sub_lib, "Strength")

        out.append(ExerciseLibraryItem(
            id=f"db__{ex_id}",
            name=name,
            source_library="exercise_database",
            category=category,
            raw=ex,
            equipment=_list_or_empty(ex.get("equipment")),
            client_level=ex.get("client_level") or ex.get("level"),
            default_dose=ex.get("dose") or ex.get("default_dose"),
            setup=ex.get("setup"),
            execution=ex.get("execution"),
            coaching_cues=_list_or_empty(ex.get("cues") or ex.get("coaching_cues")),
            mistakes=_list_or_empty(ex.get("common_mistakes") or ex.get("mistakes")),
            progressions=_list_or_empty(ex.get("progressions")),
            regressions=_list_or_empty(ex.get("regressions")),
            tags=_list_or_empty(ex.get("intent") or ex.get("tags")),
            contraindications=_list_or_empty(ex.get("contraindications")),
            joint=ex.get("primary_joint") or ex.get("joint"),
            direction=ex.get("direction"),
            movement_category=ex.get("movement_category"),
            rationale=ex.get("rationale"),
            sensitivity=_build_sensitivity(ex),
        ))
    return out


def _normalize_corrective(data: dict) -> list[ExerciseLibraryItem]:
    """corrective_library.json · {correctives: {joint_direction: [variants]}}"""
    out = []
    correctives = (data or {}).get("correctives", {}) or {}
    for key, variants in correctives.items():
        # key = "shoulder_er", "hip_ir", "lumbar_extension", etc.
        # Split into joint + direction for filtering
        parts = key.split("_", 1)
        joint = parts[0] if parts else None
        direction = parts[1] if len(parts) > 1 else None
        for v in variants or []:
            if not isinstance(v, dict):
                continue
            name = v.get("name", "Unnamed Corrective")
            out.append(ExerciseLibraryItem(
                id=f"corr__{_slug(key)}__{_slug(name)}",
                name=name,
                source_library="corrective_library",
                category="Correctives",
                raw=v,
                joint=joint,
                direction=direction,
                client_level=v.get("client_level"),
                default_dose=v.get("default_dose"),
                rationale=v.get("rationale"),
                equipment=_list_or_empty(v.get("load_style")),
                tags=[key],
                sensitivity=_build_sensitivity(v),
                program_uses=["strength_b"],
            ))
    return out


def _normalize_accessory(data: dict) -> list[ExerciseLibraryItem]:
    """accessory_library.json · {accessories: {category: [variants]}}"""
    out = []
    accessories = (data or {}).get("accessories", {}) or {}
    for cat_key, variants in accessories.items():
        for v in variants or []:
            if not isinstance(v, dict):
                continue
            name = v.get("name", "Unnamed Accessory")
            out.append(ExerciseLibraryItem(
                id=f"acc__{_slug(cat_key)}__{_slug(name)}",
                name=name,
                source_library="accessory_library",
                category="Accessories",
                raw=v,
                movement_category=cat_key,
                client_level=v.get("client_level"),
                default_dose=v.get("default_dose"),
                rationale=v.get("rationale"),
                tags=[cat_key],
                sensitivity=_build_sensitivity(v),
                program_uses=["strength_c"],
            ))
    return out


def _normalize_core_accessory(data: dict) -> list[ExerciseLibraryItem]:
    """core_accessory_library.json · {exercises: [list]}"""
    out = []
    for v in (data or {}).get("exercises", []) or []:
        if not isinstance(v, dict):
            continue
        name = v.get("name", "Unnamed Core Exercise")
        out.append(ExerciseLibraryItem(
            id=f"core__{_slug(name)}",
            name=name,
            source_library="core_accessory_library",
            category="Core",
            raw=v,
            movement_category=v.get("category"),
            client_level=v.get("client_level"),
            default_dose=v.get("default_dose"),
            rationale=v.get("rationale"),
            tags=[v["category"]] if v.get("category") else [],
            sensitivity=_build_sensitivity(v),
            program_uses=["strength_b"],
        ))
    return out


def _normalize_cars(data: dict) -> list[ExerciseLibraryItem]:
    """cars_library.json · {exercises: list-or-dict}"""
    out = []
    exercises = (data or {}).get("exercises", []) or []
    if isinstance(exercises, dict):
        exercises = list(exercises.values())
    for v in exercises:
        if not isinstance(v, dict):
            continue
        name = v.get("name") or v.get("id", "Unnamed CAR")
        out.append(ExerciseLibraryItem(
            id=f"cars__{_slug(name)}",
            name=name,
            source_library="cars_library",
            category="CARs",
            raw=v,
            joint=v.get("joint") or v.get("primary_joint"),
            client_level=v.get("level") or v.get("client_level"),
            default_dose=v.get("dose") or v.get("default_dose"),
            setup=v.get("setup"),
            execution=v.get("execution"),
            coaching_cues=_list_or_empty(v.get("cues") or v.get("coaching_cues")),
            mistakes=_list_or_empty(v.get("common_mistakes")),
            equipment=_list_or_empty(v.get("equipment")),
            tags=_list_or_empty(v.get("intent") or v.get("tags")),
            contraindications=_list_or_empty(v.get("contraindications")),
            sensitivity=_build_sensitivity(v),
            program_uses=["warm_up"],
        ))
    return out


def _normalize_pails_rails(data: dict) -> list[ExerciseLibraryItem]:
    """pails_rails_library.json · same shape as CARs."""
    out = []
    exercises = (data or {}).get("exercises", []) or []
    if isinstance(exercises, dict):
        exercises = list(exercises.values())
    for v in exercises:
        if not isinstance(v, dict):
            continue
        name = v.get("name") or v.get("id", "Unnamed PAIL/RAIL")
        out.append(ExerciseLibraryItem(
            id=f"pr__{_slug(name)}",
            name=name,
            source_library="pails_rails_library",
            category="PAILs/RAILs",
            raw=v,
            joint=v.get("joint") or v.get("primary_joint"),
            direction=v.get("direction"),
            client_level=v.get("level") or v.get("client_level"),
            default_dose=v.get("dose") or v.get("default_dose"),
            setup=v.get("setup"),
            execution=v.get("execution"),
            coaching_cues=_list_or_empty(v.get("cues") or v.get("coaching_cues")),
            equipment=_list_or_empty(v.get("equipment")),
            tags=_list_or_empty(v.get("intent") or v.get("tags")),
            contraindications=_list_or_empty(v.get("contraindications")),
            sensitivity=_build_sensitivity(v),
            program_uses=["recovery"],
        ))
    return out


def _normalize_base_positions(data: dict) -> list[ExerciseLibraryItem]:
    """base_position_library.json · {positions: list-or-dict}"""
    out = []
    positions = (data or {}).get("positions", []) or []
    if isinstance(positions, dict):
        positions = list(positions.values())
    for v in positions:
        if not isinstance(v, dict):
            continue
        name = v.get("name") or v.get("id", "Unnamed Position")
        out.append(ExerciseLibraryItem(
            id=f"bp__{_slug(name)}",
            name=name,
            source_library="base_position_library",
            category="Base Positions",
            raw=v,
            joint=v.get("joint") or v.get("primary_joint"),
            client_level=v.get("level") or v.get("client_level"),
            default_dose=v.get("dose") or v.get("default_dose"),
            setup=v.get("setup"),
            execution=v.get("execution"),
            coaching_cues=_list_or_empty(v.get("cues") or v.get("coaching_cues")),
            equipment=_list_or_empty(v.get("equipment")),
            tags=_list_or_empty(v.get("intent") or v.get("tags")),
            contraindications=_list_or_empty(v.get("contraindications")),
            sensitivity=_build_sensitivity(v),
            program_uses=["warm_up", "mobility"],
        ))
    return out


def _normalize_hip_mobility(data: dict) -> list[ExerciseLibraryItem]:
    """hip_mobility_targets.json · {targets: [list of target objects]}.

    Each target has: id, name, joint, direction, setup, passive_position,
    pail_intent, rail_intent, common_compensation, coach_cue, client_friendly_cue,
    contraindication_notes, fra_aliases.
    """
    out = []
    targets = (data or {}).get("targets", []) or []
    if isinstance(targets, dict):
        targets = list(targets.values())
    for t in targets:
        if not isinstance(t, dict):
            continue
        target_id = t.get("id") or _slug(t.get("name", "hip_target"))
        name = t.get("name") or target_id
        # PAIL/RAIL targets get rendered as multi-line execution
        execution_parts = []
        if t.get("passive_position"):
            execution_parts.append(f"Passive position: {t['passive_position']}")
        if t.get("pail_intent"):
            execution_parts.append(f"PAIL: {t['pail_intent']}")
        if t.get("rail_intent"):
            execution_parts.append(f"RAIL: {t['rail_intent']}")
        execution = "\n\n".join(execution_parts) if execution_parts else None

        cues = []
        if t.get("coach_cue"):
            cues.append(f"Coach cue: {t['coach_cue']}")
        if t.get("client_friendly_cue"):
            cues.append(f"Client cue: {t['client_friendly_cue']}")

        out.append(ExerciseLibraryItem(
            id=f"hipmob__{_slug(target_id)}",
            name=name,
            source_library="hip_mobility_targets",
            category="Mobility Prep",
            raw=t,
            joint=t.get("joint", "hip"),
            direction=t.get("direction"),
            default_dose=t.get("default_dose"),
            setup=t.get("setup"),
            execution=execution,
            coaching_cues=cues,
            mistakes=[t["common_compensation"]] if t.get("common_compensation") else [],
            tags=_list_or_empty(t.get("fra_aliases") or t.get("tags")),
            contraindications=_list_or_empty(t.get("contraindication_notes")),
            sensitivity=_build_sensitivity(t),
            program_uses=["mobility", "recovery"],
        ))
    return out


def _normalize_iso_ramping(data: dict) -> list[ExerciseLibraryItem]:
    """iso_ramping_library.json · same shape as CARs/PAILs."""
    out = []
    exercises = (data or {}).get("exercises", []) or []
    if isinstance(exercises, dict):
        exercises = list(exercises.values())
    for v in exercises:
        if not isinstance(v, dict):
            continue
        name = v.get("name") or v.get("id", "Unnamed ISO")
        out.append(ExerciseLibraryItem(
            id=f"iso__{_slug(name)}",
            name=name,
            source_library="iso_ramping_library",
            category="ISO Ramping",
            raw=v,
            joint=v.get("joint") or v.get("primary_joint"),
            client_level=v.get("level") or v.get("client_level"),
            default_dose=v.get("dose") or v.get("default_dose"),
            setup=v.get("setup"),
            execution=v.get("execution"),
            coaching_cues=_list_or_empty(v.get("cues") or v.get("coaching_cues")),
            equipment=_list_or_empty(v.get("equipment")),
            tags=_list_or_empty(v.get("intent") or v.get("tags")),
            sensitivity=_build_sensitivity(v),
            program_uses=["mobility"],
        ))
    return out


def _normalize_treadmill(data: dict) -> list[ExerciseLibraryItem]:
    """treadmill_exercises.json · {exercises: [list]}"""
    out = []
    for v in (data or {}).get("exercises", []) or []:
        if not isinstance(v, dict):
            continue
        name = v.get("name", "Unnamed Treadmill Drill")
        out.append(ExerciseLibraryItem(
            id=f"tread__{_slug(name)}",
            name=name,
            source_library="treadmill_exercises",
            category="Cardio",
            raw=v,
            movement_category=v.get("movement_pattern"),
            client_level=v.get("client_level"),
            equipment=_list_or_empty(v.get("equipment")) or ["treadmill"],
            default_dose=v.get("default_sets_reps") or v.get("default_dose"),
            rationale=v.get("coaching_notes") or v.get("rationale"),
            sensitivity={
                **_build_sensitivity(v),
                # Treadmill schema uses `meniscus_flare` flag too
            },
            tags=_list_or_empty(v.get("primary_joints")),
            program_uses=["cardio"],
        ))
    return out


def _normalize_strength_markers(data: dict) -> list[ExerciseLibraryItem]:
    """strength_markers.json · {markers: [list of marker objects]}.

    Each marker has: id, name, pattern, joint_demand, test_format,
    spine_loading, equipment, best_for, avoid_if.
    """
    out = []
    markers = (data or {}).get("markers", []) or []
    if isinstance(markers, dict):
        markers = list(markers.values())
    for m in markers:
        if not isinstance(m, dict):
            continue
        mkey = m.get("id") or _slug(m.get("name", "marker"))
        name = m.get("name") or mkey
        out.append(ExerciseLibraryItem(
            id=f"sm__{_slug(mkey)}",
            name=name,
            source_library="strength_markers",
            category="Strength Markers",
            raw=m,
            movement_category=m.get("pattern"),
            equipment=_list_or_empty(m.get("equipment")),
            tags=_list_or_empty(m.get("joint_demand")) + _list_or_empty(m.get("best_for")),
            rationale=m.get("test_format") or m.get("description"),
            contraindications=_list_or_empty(m.get("avoid_if")),
            program_uses=["strength_a"],
        ))
    return out


# ─── Loader ─────────────────────────────────────────────────

# Map source filename → (path-relative-to-repo-root, normalizer fn)
_LOADERS = [
    ("libraries/exercise_database.json",     _normalize_exercise_database),
    ("libraries/corrective_library.json",    _normalize_corrective),
    ("libraries/accessory_library.json",     _normalize_accessory),
    ("libraries/core_accessory_library.json", _normalize_core_accessory),
    ("libraries/cars_library.json",          _normalize_cars),
    ("libraries/pails_rails_library.json",   _normalize_pails_rails),
    ("libraries/base_position_library.json", _normalize_base_positions),
    ("libraries/hip_mobility_targets.json",  _normalize_hip_mobility),
    ("libraries/iso_ramping_library.json",   _normalize_iso_ramping),
    ("libraries/treadmill_exercises.json",   _normalize_treadmill),
    ("generator/strength_markers.json",      _normalize_strength_markers),
]


def load_all(repo_root: Optional[Path] = None) -> list[ExerciseLibraryItem]:
    """Load every library and return a single normalized list.

    Silently skips libraries that are missing or fail to parse — the
    library_health() report flags those instead. We don't raise here because
    one bad file shouldn't take down the whole dashboard.
    """
    if repo_root is None:
        # Default · file is in generator/, repo root is one level up
        repo_root = Path(__file__).resolve().parent.parent
    items: list[ExerciseLibraryItem] = []
    for rel_path, normalizer in _LOADERS:
        p = repo_root / rel_path
        if not p.exists():
            continue
        try:
            data = json.loads(p.read_text())
        except json.JSONDecodeError:
            continue
        try:
            items.extend(normalizer(data))
        except Exception:
            # If a normalizer crashes, skip that library rather than 500ing
            continue
    return items


# ─── Search & filter ────────────────────────────────────────

def search(items: list[ExerciseLibraryItem], query: str) -> list[ExerciseLibraryItem]:
    """Substring match across name + tags + rationale + cues."""
    if not query:
        return items
    q = query.lower().strip()
    out = []
    for it in items:
        haystack_parts = [
            it.name or "",
            " ".join(it.tags or []),
            it.rationale or "",
            " ".join(it.coaching_cues or []),
            it.movement_category or "",
            it.joint or "",
            it.direction or "",
        ]
        if q in " ".join(haystack_parts).lower():
            out.append(it)
    return out


def filter_items(
    items: list[ExerciseLibraryItem],
    *,
    category: Optional[str] = None,
    source_library: Optional[str] = None,
    movement_category: Optional[str] = None,
    joint: Optional[str] = None,
    direction: Optional[str] = None,
    client_level: Optional[str] = None,
    equipment: Optional[str] = None,
    program_use: Optional[str] = None,
    knee_safe: bool = False,
    shoulder_safe: bool = False,
    low_back_safe: bool = False,
    wrist_safe: bool = False,
) -> list[ExerciseLibraryItem]:
    """Apply a stack of filters. Each None argument is a no-op."""
    out = list(items)

    def keep(it, predicate):
        return predicate(it)

    if category:
        out = [it for it in out if it.category == category]
    if source_library:
        out = [it for it in out if it.source_library == source_library]
    if movement_category:
        mc = movement_category.lower()
        out = [it for it in out if (it.movement_category or "").lower() == mc]
    if joint:
        j = joint.lower()
        out = [it for it in out if (it.joint or "").lower() == j]
    if direction:
        d = direction.lower()
        out = [it for it in out if (it.direction or "").lower() == d]
    if client_level:
        cl = client_level.lower()
        out = [it for it in out if (it.client_level or "").lower() == cl]
    if equipment:
        eq = equipment.lower()
        out = [it for it in out if any(eq in (e or "").lower() for e in it.equipment)]
    if program_use:
        pu = program_use.lower()
        out = [it for it in out if pu in (it.program_uses or [])]

    # Sensitivity filters · "safe" filter drops avoid-tagged AND caution-tagged
    # for that joint. Coach is asking "is this safe enough to use?"
    if knee_safe:
        out = [it for it in out if it.sensitivity.get("knee") not in ("avoid", "caution")]
    if shoulder_safe:
        out = [it for it in out if it.sensitivity.get("shoulder") not in ("avoid", "caution")]
    if low_back_safe:
        out = [it for it in out if it.sensitivity.get("low_back") not in ("avoid", "caution")]
    if wrist_safe:
        out = [it for it in out if it.sensitivity.get("wrist") not in ("avoid", "caution")]

    return out


# ─── Plan editor helpers ────────────────────────────────────

def get_exercises_by_category(items, category: str):
    return filter_items(items, category=category)


def get_exercises_by_joint(items, joint: str):
    return filter_items(items, joint=joint)


def get_safe_exercises_for_concern(items, concern: str):
    """concern in {'knee', 'shoulder', 'low_back', 'wrist'}"""
    return filter_items(items, **{f"{concern}_safe": True})


def get_replacement_exercises(items, current_exercise, **filters):
    """Find candidates that match the current exercise's category/movement
    pattern, but are not the same exercise."""
    cat = current_exercise.category if hasattr(current_exercise, "category") else current_exercise.get("category")
    name = current_exercise.name if hasattr(current_exercise, "name") else current_exercise.get("name")
    candidates = filter_items(items, category=cat, **filters)
    return [it for it in candidates if it.name != name]


def search_exercises(items, query: str, **filters):
    """Combined query + filters."""
    return search(filter_items(items, **filters), query)


# ─── Library health ─────────────────────────────────────────

def library_health(items: list[ExerciseLibraryItem]) -> dict:
    """Return a small dashboard panel summary."""
    from collections import Counter
    name_counts = Counter(it.name for it in items)
    duplicates = sorted([n for n, c in name_counts.items() if c > 1])
    missing_dose = [it.name for it in items if not it.default_dose]
    missing_sens = [it.name for it in items
                      if not any(it.sensitivity.get(k) for k in ("knee", "shoulder", "low_back", "wrist"))]
    by_category = dict(Counter(it.category for it in items))
    by_source = dict(Counter(it.source_library for it in items))

    return {
        "total_exercises":         len(items),
        "category_counts":         by_category,
        "source_library_counts":   by_source,
        "duplicate_names":         duplicates[:50],   # cap for UI
        "duplicate_count":         len(duplicates),
        "missing_default_dose":    len(missing_dose),
        "missing_sensitivity_tags": len(missing_sens),
    }


# ─── Convenience for tests/CLI ──────────────────────────────

if __name__ == "__main__":
    items = load_all()
    h = library_health(items)
    print(f"Loaded {h['total_exercises']} exercises")
    print(f"By category: {h['category_counts']}")
    print(f"By source: {h['source_library_counts']}")
    print(f"Duplicates: {h['duplicate_count']}")
    print(f"Missing default dose: {h['missing_default_dose']}")
    print(f"Missing sensitivity tags: {h['missing_sensitivity_tags']}")
