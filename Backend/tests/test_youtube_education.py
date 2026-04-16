import os
import sys

# Ensure Backend directory is on sys.path when running tests from repo root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import functions.youtube_education as youtube_education


def test_build_youtube_tool_query_sanitizes_internal_commas():
    query = youtube_education._build_youtube_tool_query(
        "Cloud Computing",
        "Service Models (IaaS, PaaS, SaaS)",
        max_results=1,
    )

    # The LangChain tool expects exactly one comma delimiter: query,max_results
    assert query.count(",") == 1
    assert query.endswith(",1")
    assert "IaaS PaaS SaaS" in query


def test_generate_skill_playlist_handles_concepts_with_commas(monkeypatch):
    calls = []

    class FakeYouTubeSearchTool:
        def run(self, query):
            calls.append(query)
            # Simulate parser strictness: only one trailing delimiter is valid.
            if query.count(",") != 1:
                raise ValueError("malformed query")
            return "https://www.youtube.com/watch?v=dummy"

    monkeypatch.setattr(youtube_education, "YouTubeSearchTool", FakeYouTubeSearchTool)
    monkeypatch.setattr(
        youtube_education,
        "_fallback_concepts_for_skill",
        lambda _skill: ["Service Models (IaaS, PaaS, SaaS)"],
    )
    monkeypatch.setattr(youtube_education.genai, "configure", lambda **_kwargs: None)

    payload = {
        "skill_gaps": {
            "areas": [
                {"skill": "Cloud Computing", "level": "needs improvement"},
            ]
        }
    }

    result = youtube_education.generate_skill_playlist(payload, force_fallback=True)

    assert len(result) == 1
    assert result[0]["skill"] == "Cloud Computing"
    assert len(result[0]["playlist"]) == 1
    assert result[0]["playlist"][0]["concept"] == "Service Models (IaaS, PaaS, SaaS)"
    assert result[0]["playlist"][0]["youtube_link"].startswith("https://")
    assert calls and calls[0].count(",") == 1
