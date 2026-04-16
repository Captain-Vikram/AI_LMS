import os
import sys

# Ensure Backend directory is on sys.path when running tests from repo root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from routes.classroom_routes import (
    _build_assessment_seed,
    _build_resources_from_outputs,
    _derive_focus_areas,
    _resource_counts,
    _subject_matches_pdf_excerpt,
)


def test_subject_match_requires_subject_tokens_in_excerpt():
    assert _subject_matches_pdf_excerpt("Mathematics", "This Mathematics chapter covers algebra.") is True
    assert _subject_matches_pdf_excerpt("Biology", "This chapter focuses on world history.") is False


def test_focus_area_derivation_is_not_empty():
    focus_areas = _derive_focus_areas(
        "Physics",
        "Cover mechanics, motion, and force with practical labs.",
        "Students should solve numerical problems and explain concepts clearly.",
    )

    assert len(focus_areas) >= 3
    assert "Physics" in focus_areas[0]


def test_assessment_seed_uses_focus_areas():
    focus_areas = ["Algebra fundamentals", "Linear equations", "Word problems"]
    seed = _build_assessment_seed("Mathematics", focus_areas, "Students should solve equations")

    assert "skill_gaps" in seed
    assert len(seed["skill_gaps"]["areas"]) == 3
    assert seed["skill_gaps"]["areas"][0]["skill"] == "Algebra fundamentals"


def test_resource_flattening_and_counts():
    playlists = [
        {
            "skill": "Algebra",
            "playlist": [
                {"concept": "Linear equations", "youtube_link": "https://youtube.com/watch?v=abc"},
                {"concept": "Linear equations", "youtube_link": "https://youtube.com/watch?v=abc"},
            ],
        }
    ]
    deepsearch = [
        {
            "skill": "Algebra",
            "documents": [
                {
                    "title": "Equation basics",
                    "content": "Understand linear equations",
                    "url": "https://example.com/equations",
                }
            ],
            "blogs": ["https://example.com/algebra-blog"],
        }
    ]

    resources = _build_resources_from_outputs(
        playlists=playlists,
        deepsearch_results=deepsearch,
        source="class_ai",
        approval_status="pending",
    )

    summary = _resource_counts(resources)

    assert len(resources) == 3
    assert summary["total"] == 3
    assert summary["pending"] == 3
    assert summary["approved"] == 0
