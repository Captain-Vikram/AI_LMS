from __future__ import annotations

import json
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient


def _poll_job(client: TestClient, path: str, timeout_seconds: int = 90) -> dict[str, Any]:
    deadline = time.time() + timeout_seconds
    last_payload: dict[str, Any] = {}

    while time.time() < deadline:
        response = client.get(path)
        if response.status_code != 200:
            return {
                "ok": False,
                "status_code": response.status_code,
                "payload": response.json() if response.content else {},
            }

        payload = response.json()
        last_payload = payload
        status = str(payload.get("status", "")).lower()
        if status in {"completed", "failed"}:
            return {
                "ok": True,
                "status": status,
                "payload": payload,
            }
        time.sleep(1)

    return {
        "ok": False,
        "status": "timeout",
        "payload": last_payload,
    }


def main() -> None:
    project_root = Path(__file__).resolve().parents[2]
    backend_dir = project_root / "Backend"
    handoff_path = backend_dir / "handoff_fastapi"

    if str(handoff_path) not in sys.path:
        sys.path.insert(0, str(handoff_path))

    # Isolate smoke-test data to avoid mutating normal local workspace data.
    tmp_data_dir = Path(tempfile.mkdtemp(prefix="portable_rag_smoke_"))
    os.environ["PORTABLE_DATA_DIR"] = str(tmp_data_dir)

    from portable_rag_backend.integration import create_standalone_app  # type: ignore[reportMissingImports]

    app = create_standalone_app(prefix="/api/portable-rag")
    client = TestClient(app)

    report: dict[str, Any] = {
        "portable_data_dir": str(tmp_data_dir),
        "checks": {},
        "ids": {},
    }

    # 1) Health and notebook/source setup
    health = client.get("/api/portable-rag/health")
    report["checks"]["health"] = {
        "ok": health.status_code == 200,
        "status_code": health.status_code,
    }

    notebook_resp = client.post(
        "/api/portable-rag/notebooks",
        json={
            "name": "Smoke Test Notebook",
            "description": "Notebook for portable RAG end-to-end smoke validation",
        },
    )
    notebook_payload = notebook_resp.json() if notebook_resp.content else {}
    notebook_id = notebook_payload.get("id")
    report["checks"]["create_notebook"] = {
        "ok": notebook_resp.status_code == 200 and bool(notebook_id),
        "status_code": notebook_resp.status_code,
    }
    report["ids"]["notebook_id"] = notebook_id

    text_source_content = (
        "SOURCE_MARKER_ALPHA: Chlorophyll captures sunlight and powers photosynthesis in plants. "
        "The process converts light energy into chemical energy."
    )

    source_text_resp = client.post(
        "/api/portable-rag/sources/text",
        json={
            "notebook_id": notebook_id,
            "title": "Smoke Source Text",
            "content": text_source_content,
            "embed": True,
        },
    )
    source_text_payload = source_text_resp.json() if source_text_resp.content else {}
    source_text_id = source_text_payload.get("id")
    report["checks"]["add_text_source"] = {
        "ok": source_text_resp.status_code == 200 and bool(source_text_id),
        "status_code": source_text_resp.status_code,
    }
    report["ids"]["text_source_id"] = source_text_id

    source_url_resp = client.post(
        "/api/portable-rag/sources/url",
        json={
            "notebook_id": notebook_id,
            "url": "https://example.com",
            "title": "Smoke Source URL",
            "embed": True,
        },
    )
    source_url_payload = source_url_resp.json() if source_url_resp.content else {}
    source_url_id = source_url_payload.get("id")
    report["checks"]["add_url_source"] = {
        "ok": source_url_resp.status_code == 200 and bool(source_url_id),
        "status_code": source_url_resp.status_code,
    }
    report["ids"]["url_source_id"] = source_url_id

    # 2) Vector DB checks
    stats_resp = client.get("/api/portable-rag/vector-db/stats")
    stats_payload = stats_resp.json() if stats_resp.content else {}
    vector_docs_count = int(stats_payload.get("vector_documents_count") or 0)
    report["checks"]["vector_db_stats"] = {
        "ok": stats_resp.status_code == 200,
        "status_code": stats_resp.status_code,
        "vector_documents_count": vector_docs_count,
    }

    # 3) Search should use indexed sources
    search_resp = client.post(
        "/api/portable-rag/search",
        json={
            "notebook_id": notebook_id,
            "query": "chlorophyll sunlight photosynthesis",
            "k": 5,
        },
    )
    search_payload = search_resp.json() if search_resp.content else {}
    search_results = search_payload.get("results") or []
    search_source_ids = {str(item.get("source_id")) for item in search_results if item.get("source_id")}
    search_snippets = "\n".join(str(item.get("snippet") or item.get("content") or "") for item in search_results)
    report["checks"]["search_uses_sources"] = {
        "ok": search_resp.status_code == 200 and bool(search_results) and ("SOURCE_MARKER_ALPHA" in search_snippets),
        "status_code": search_resp.status_code,
        "results_count": len(search_results),
        "source_ids_in_results": sorted(search_source_ids),
    }

    # 4) Chat session and message (base path used by quiz/report prompt flows)
    chat_session_resp = client.post(
        "/api/portable-rag/chat/sessions",
        json={
            "notebook_id": notebook_id,
            "title": "Smoke Chat",
        },
    )
    chat_session_payload = chat_session_resp.json() if chat_session_resp.content else {}
    chat_session_id = chat_session_payload.get("id")
    report["checks"]["create_chat_session"] = {
        "ok": chat_session_resp.status_code == 200 and bool(chat_session_id),
        "status_code": chat_session_resp.status_code,
    }
    report["ids"]["chat_session_id"] = chat_session_id

    chat_message_resp = client.post(
        f"/api/portable-rag/chat/sessions/{chat_session_id}/messages",
        json={
            "message": "What does SOURCE_MARKER_ALPHA say about photosynthesis?",
            "retrieval_k": 6,
            "temperature": 0.2,
        },
    )
    chat_message_payload = chat_message_resp.json() if chat_message_resp.content else {}
    chat_citations = chat_message_payload.get("citation_map") or []
    chat_citation_source_ids = {str(item.get("source_id")) for item in chat_citations if item.get("source_id")}
    report["checks"]["chat_uses_sources"] = {
        "ok": chat_message_resp.status_code == 200 and bool(chat_citations),
        "status_code": chat_message_resp.status_code,
        "citation_count": len(chat_citations),
        "citation_source_ids": sorted(chat_citation_source_ids),
    }

    # 5) "Quiz Generation (All Sources)" flow equivalent: prompt through chat
    quiz_prompt = "\n".join(
        [
            "Generate a quiz from all notebook sources.",
            "Return JSON with title and questions.",
            "Include key fact from SOURCE_MARKER_ALPHA.",
        ]
    )
    quiz_resp = client.post(
        f"/api/portable-rag/chat/sessions/{chat_session_id}/messages",
        json={
            "message": quiz_prompt,
            "retrieval_k": 24,
            "temperature": 0.2,
        },
    )
    quiz_payload = quiz_resp.json() if quiz_resp.content else {}
    quiz_citations = quiz_payload.get("citation_map") or []
    report["checks"]["quiz_prompt_uses_sources"] = {
        "ok": quiz_resp.status_code == 200 and len(quiz_citations) > 0,
        "status_code": quiz_resp.status_code,
        "citation_count": len(quiz_citations),
    }

    # 6) "Topic Report (.txt)" flow equivalent: prompt through chat
    report_prompt = "Create a topic report about photosynthesis using notebook sources only."
    topic_report_resp = client.post(
        f"/api/portable-rag/chat/sessions/{chat_session_id}/messages",
        json={
            "message": report_prompt,
            "retrieval_k": 20,
            "temperature": 0.2,
        },
    )
    topic_report_payload = topic_report_resp.json() if topic_report_resp.content else {}
    topic_report_citations = topic_report_payload.get("citation_map") or []
    report["checks"]["report_prompt_uses_sources"] = {
        "ok": topic_report_resp.status_code == 200 and len(topic_report_citations) > 0,
        "status_code": topic_report_resp.status_code,
        "citation_count": len(topic_report_citations),
    }

    # 7) Podcast generation + status polling
    podcast_gen_resp = client.post(
        "/api/portable-rag/podcasts/generate",
        json={
            "episode_profile": "default",
            "speaker_profile": "default",
            "episode_name": "Smoke Episode",
            "notebook_id": notebook_id,
        },
    )
    podcast_gen_payload = podcast_gen_resp.json() if podcast_gen_resp.content else {}
    podcast_job_id = podcast_gen_payload.get("job_id")
    report["checks"]["podcast_generate_request"] = {
        "ok": podcast_gen_resp.status_code in (200, 202) and bool(podcast_job_id),
        "status_code": podcast_gen_resp.status_code,
    }
    report["ids"]["podcast_job_id"] = podcast_job_id

    podcast_job_result = _poll_job(client, f"/api/portable-rag/podcasts/jobs/{podcast_job_id}")
    podcast_payload = podcast_job_result.get("payload") or {}
    podcast_status = str(podcast_payload.get("status") or podcast_job_result.get("status") or "unknown").lower()
    podcast_result = podcast_payload.get("result") if isinstance(podcast_payload.get("result"), dict) else {}
    podcast_script = podcast_result.get("script") if isinstance(podcast_result, dict) else None
    podcast_script_text = ""
    if isinstance(podcast_script, list):
        podcast_script_text = "\n".join(
            str(item.get("dialogue") or "") for item in podcast_script if isinstance(item, dict)
        )
    report["checks"]["podcast_job_status"] = {
        "ok": podcast_job_result.get("ok", False),
        "status": podcast_status,
        "error": podcast_payload.get("error"),
    }
    report["checks"]["podcast_uses_sources"] = {
        "ok": podcast_status == "completed" and ("SOURCE_MARKER_ALPHA" in podcast_script_text),
        "status": podcast_status,
        "script_turns": len(podcast_script) if isinstance(podcast_script, list) else 0,
    }

    # 8) Audio podcast generation + refresh status
    audio_gen_resp = client.post(
        f"/api/portable-rag/notebooks/{notebook_id}/audio-overview",
        json={
            "briefing": "Create an audio overview focused on SOURCE_MARKER_ALPHA",
            "temperature": 0.3,
        },
    )
    audio_gen_payload = audio_gen_resp.json() if audio_gen_resp.content else {}
    audio_job_id = audio_gen_payload.get("job_id")
    report["checks"]["audio_generate_request"] = {
        "ok": audio_gen_resp.status_code in (200, 202) and bool(audio_job_id),
        "status_code": audio_gen_resp.status_code,
    }
    report["ids"]["audio_job_id"] = audio_job_id

    audio_job_result = _poll_job(client, f"/api/portable-rag/jobs/{audio_job_id}")
    audio_payload = audio_job_result.get("payload") or {}
    audio_status = str(audio_payload.get("status") or audio_job_result.get("status") or "unknown").lower()

    audio_overview_resp = client.get(f"/api/portable-rag/notebooks/{notebook_id}/audio-overview")
    audio_overview_payload = audio_overview_resp.json() if audio_overview_resp.content else {}
    raw_audio_script = audio_overview_payload.get("script")
    audio_script: list[dict[str, Any]] = raw_audio_script if isinstance(raw_audio_script, list) else []
    audio_script_text = "\n".join(
        str(item.get("dialogue") or "") for item in audio_script if isinstance(item, dict)
    )

    report["checks"]["audio_job_status"] = {
        "ok": audio_job_result.get("ok", False),
        "status": audio_status,
        "error": audio_payload.get("error"),
    }
    report["checks"]["audio_overview_refresh"] = {
        "ok": audio_overview_resp.status_code in (200, 404),
        "status_code": audio_overview_resp.status_code,
        "overview_status": audio_overview_payload.get("status"),
    }
    report["checks"]["audio_uses_sources"] = {
        "ok": audio_overview_resp.status_code == 200
        and str(audio_overview_payload.get("status", "")).lower() == "completed"
        and ("SOURCE_MARKER_ALPHA" in audio_script_text),
        "status": audio_overview_payload.get("status"),
        "script_turns": len(audio_script),
    }

    # Aggregate summary
    checks = report["checks"]
    passed = [name for name, data in checks.items() if bool(data.get("ok"))]
    failed = [name for name, data in checks.items() if not bool(data.get("ok"))]

    report["summary"] = {
        "passed_count": len(passed),
        "failed_count": len(failed),
        "passed": passed,
        "failed": failed,
    }

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
