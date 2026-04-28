"""Tests for the IMS Coach OS library adapter.

Validates that the adapter normalizes all 11 source libraries correctly and
that the public API behaves as expected.
"""
import os
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "generator"))

from library_adapter import (
    load_all, search, filter_items, library_health,
    get_exercises_by_category, get_exercises_by_joint,
    get_safe_exercises_for_concern, get_replacement_exercises,
    search_exercises, ExerciseLibraryItem,
)


class TestLibraryAdapter(unittest.TestCase):
    """Adapter integration tests against the real JSON files."""

    @classmethod
    def setUpClass(cls):
        cls.items = load_all(repo_root=REPO_ROOT)

    def test_loads_at_least_1000_exercises(self):
        """The full library should yield at least 1000 normalized items."""
        self.assertGreaterEqual(len(self.items), 1000,
            f"Expected ≥1000 exercises, got {len(self.items)}")

    def test_every_item_has_required_fields(self):
        """id, name, source_library, category must always be set."""
        for it in self.items:
            self.assertTrue(it.id, f"Missing id: {it}")
            self.assertTrue(it.name, f"Missing name: {it.id}")
            self.assertTrue(it.source_library, f"Missing source: {it.id}")
            self.assertTrue(it.category, f"Missing category: {it.id}")

    def test_all_11_source_libraries_present(self):
        """We should see entries from every source we tried to load."""
        sources = {it.source_library for it in self.items}
        expected = {
            "exercise_database", "corrective_library", "accessory_library",
            "core_accessory_library", "cars_library", "pails_rails_library",
            "base_position_library", "hip_mobility_targets",
            "iso_ramping_library", "treadmill_exercises", "strength_markers",
        }
        self.assertEqual(expected, sources,
            f"Missing libraries: {expected - sources}")

    def test_all_categories_populated(self):
        """Every expected category should have at least one item."""
        cats = {it.category for it in self.items}
        expected = {
            "Strength", "Correctives", "Accessories", "Core",
            "CARs", "PAILs/RAILs", "Base Positions", "Mobility Prep",
            "ISO Ramping", "Cardio", "Strength Markers",
        }
        self.assertTrue(expected.issubset(cats),
            f"Missing categories: {expected - cats}")

    def test_ids_are_unique(self):
        """No two items should share an id (prefix scheme prevents collisions)."""
        ids = [it.id for it in self.items]
        dup_ids = [i for i in set(ids) if ids.count(i) > 1]
        self.assertEqual(dup_ids, [],
            f"Duplicate ids found: {dup_ids[:5]}")

    def test_sensitivity_values_are_normalized(self):
        """Any sensitivity value must be safe/caution/avoid/None."""
        valid = {None, "safe", "caution", "avoid"}
        for it in self.items:
            for k, v in (it.sensitivity or {}).items():
                self.assertIn(v, valid,
                    f"{it.name}: sensitivity['{k}']='{v}' is invalid")

    def test_to_dict_serializes_cleanly(self):
        """to_dict() must produce JSON-serializable output."""
        import json
        for it in self.items[:50]:
            d = it.to_dict()
            try:
                json.dumps(d)
            except TypeError as e:
                self.fail(f"{it.name} not JSON-serializable: {e}")


class TestSearch(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.items = load_all(repo_root=REPO_ROOT)

    def test_search_finds_known_exercise(self):
        """Searching for a common exercise should hit it."""
        results = search(self.items, "hip thrust")
        self.assertGreater(len(results), 0,
            "Expected to find at least one Hip Thrust variant")
        names_lower = " ".join(r.name.lower() for r in results)
        self.assertIn("hip thrust", names_lower)

    def test_search_empty_query_returns_all(self):
        """Empty query is a no-op."""
        results = search(self.items, "")
        self.assertEqual(len(results), len(self.items))

    def test_search_is_case_insensitive(self):
        a = search(self.items, "DEADBUG")
        b = search(self.items, "deadbug")
        self.assertEqual(len(a), len(b))


class TestFilter(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.items = load_all(repo_root=REPO_ROOT)

    def test_filter_by_category(self):
        cardio = filter_items(self.items, category="Cardio")
        self.assertGreater(len(cardio), 0)
        for it in cardio:
            self.assertEqual(it.category, "Cardio")

    def test_filter_by_source_library(self):
        corr = filter_items(self.items, source_library="corrective_library")
        self.assertGreater(len(corr), 0)
        for it in corr:
            self.assertEqual(it.source_library, "corrective_library")

    def test_filter_by_joint(self):
        hip_items = filter_items(self.items, joint="hip")
        self.assertGreater(len(hip_items), 0)
        for it in hip_items:
            self.assertEqual((it.joint or "").lower(), "hip")

    def test_filter_knee_safe_drops_caution_and_avoid(self):
        """Knee-safe filter must exclude any 'caution' or 'avoid' tagged items."""
        safe = filter_items(self.items, knee_safe=True)
        for it in safe:
            knee_tag = it.sensitivity.get("knee")
            self.assertNotIn(knee_tag, ("caution", "avoid"),
                f"{it.name} leaked knee_sensitive={knee_tag}")

    def test_filter_program_use(self):
        warmup_items = filter_items(self.items, program_use="warm_up")
        for it in warmup_items:
            self.assertIn("warm_up", it.program_uses)


class TestHelpers(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.items = load_all(repo_root=REPO_ROOT)

    def test_get_exercises_by_category(self):
        accs = get_exercises_by_category(self.items, "Accessories")
        self.assertGreater(len(accs), 0)
        for it in accs:
            self.assertEqual(it.category, "Accessories")

    def test_get_exercises_by_joint(self):
        ankle_items = get_exercises_by_joint(self.items, "ankle")
        for it in ankle_items:
            self.assertEqual((it.joint or "").lower(), "ankle")

    def test_get_safe_exercises_for_concern(self):
        safe = get_safe_exercises_for_concern(self.items, "knee")
        for it in safe:
            self.assertNotIn(it.sensitivity.get("knee"), ("caution", "avoid"))

    def test_get_replacement_exercises_excludes_self(self):
        """Replacement helper should exclude the current exercise's exact name."""
        accs = get_exercises_by_category(self.items, "Accessories")
        if not accs:
            self.skipTest("No accessories loaded")
        current = accs[0]
        replacements = get_replacement_exercises(self.items, current)
        for r in replacements:
            self.assertNotEqual(r.name, current.name)
        # All replacements are in the same category
        for r in replacements:
            self.assertEqual(r.category, current.category)

    def test_search_exercises_combines_filter_and_query(self):
        """search_exercises should AND filter and query."""
        results = search_exercises(self.items, "raise", category="Accessories")
        for it in results:
            self.assertEqual(it.category, "Accessories")
            self.assertIn("raise", it.name.lower())


class TestLibraryHealth(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.items = load_all(repo_root=REPO_ROOT)
        cls.h = library_health(cls.items)

    def test_health_returns_expected_keys(self):
        for key in ("total_exercises", "category_counts", "source_library_counts",
                    "duplicate_count", "missing_default_dose", "missing_sensitivity_tags"):
            self.assertIn(key, self.h)

    def test_total_matches_loaded_count(self):
        self.assertEqual(self.h["total_exercises"], len(self.items))

    def test_counts_are_ints(self):
        self.assertIsInstance(self.h["duplicate_count"], int)
        self.assertIsInstance(self.h["missing_default_dose"], int)
        self.assertIsInstance(self.h["missing_sensitivity_tags"], int)


class TestSourceFilesUnchanged(unittest.TestCase):
    """The adapter must NEVER mutate source JSON. Sentinel test."""

    def test_adapter_does_not_mutate_source(self):
        """Two consecutive load_all calls must produce identical results."""
        a = load_all(repo_root=REPO_ROOT)
        b = load_all(repo_root=REPO_ROOT)
        self.assertEqual(len(a), len(b))
        # Compare a stable subset of fields
        a_names = sorted(it.name for it in a)
        b_names = sorted(it.name for it in b)
        self.assertEqual(a_names, b_names)


if __name__ == "__main__":
    unittest.main(verbosity=2)
