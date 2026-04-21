from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


INTERNAL_ORPHAN_NOTEBOOK_ID = "__orphan_notebook__"
INTERNAL_ORPHAN_NOTEBOOK_NAME = "_orphan_internal"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class MetadataStore:
    """SQLite metadata store for notebooks, sources, and chat sessions."""

    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS notebooks (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS sources (
                    id TEXT PRIMARY KEY,
                    notebook_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    origin TEXT,
                    content TEXT NOT NULL,
                    chunk_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
                );

                CREATE TABLE IF NOT EXISTS notebook_sources (
                    notebook_id TEXT NOT NULL,
                    source_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (notebook_id, source_id),
                    FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,
                    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS chat_sessions (
                    id TEXT PRIMARY KEY,
                    notebook_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (notebook_id) REFERENCES notebooks(id)
                );

                CREATE TABLE IF NOT EXISTS chat_messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    meta_json TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
                );

                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    job_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    result_json TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT
                );

                CREATE TABLE IF NOT EXISTS prompt_templates (
                    name TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    notebook_id TEXT NOT NULL,
                    source_id TEXT,
                    source_ids_json TEXT,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,
                    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS audio_overviews (
                    id TEXT PRIMARY KEY,
                    notebook_id TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    script_json TEXT,
                    audio_path TEXT,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE,
                    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_sources_notebook_id ON sources(notebook_id);
                CREATE INDEX IF NOT EXISTS idx_notebook_sources_notebook_id ON notebook_sources(notebook_id);
                CREATE INDEX IF NOT EXISTS idx_notebook_sources_source_id ON notebook_sources(source_id);
                CREATE INDEX IF NOT EXISTS idx_sessions_notebook_id ON chat_sessions(notebook_id);
                CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages(session_id);
                CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
                CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
                CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON notes(notebook_id);
                CREATE INDEX IF NOT EXISTS idx_notes_source_id ON notes(source_id);
                CREATE INDEX IF NOT EXISTS idx_audio_overviews_notebook_id ON audio_overviews(notebook_id);
                CREATE INDEX IF NOT EXISTS idx_audio_overviews_job_id ON audio_overviews(job_id);
                """
            )

            # Migration backfill: ensure legacy sources are represented in notebook_sources.
            conn.execute(
                """
                INSERT OR IGNORE INTO notebook_sources (notebook_id, source_id, created_at)
                SELECT notebook_id, id, created_at FROM sources
                """
            )

            now = utc_now_iso()
            conn.execute(
                """
                INSERT OR IGNORE INTO notebooks (id, name, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    INTERNAL_ORPHAN_NOTEBOOK_ID,
                    INTERNAL_ORPHAN_NOTEBOOK_NAME,
                    "Internal orphan notebook for unlinked sources",
                    now,
                    now,
                ),
            )

    def create_notebook(self, name: str, description: str = "") -> dict[str, Any]:
        now = utc_now_iso()
        notebook = {
            "id": uuid4().hex,
            "name": name,
            "description": description,
            "created_at": now,
            "updated_at": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO notebooks (id, name, description, created_at, updated_at)
                VALUES (:id, :name, :description, :created_at, :updated_at)
                """,
                notebook,
            )
        return notebook

    def list_notebooks(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM notebooks
                WHERE id != ?
                ORDER BY updated_at DESC
                """,
                (INTERNAL_ORPHAN_NOTEBOOK_ID,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_notebook(self, notebook_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM notebooks WHERE id = ?", (notebook_id,)
            ).fetchone()
        return dict(row) if row else None

    def get_notebook_detail(self, notebook_id: str) -> dict[str, Any] | None:
        notebook = self.get_notebook(notebook_id)
        if notebook is None:
            return None
        notebook["source_ids"] = sorted(self.list_source_ids(notebook_id))
        return notebook

    def delete_notebook(self, notebook_id: str) -> dict[str, Any]:
        if notebook_id == INTERNAL_ORPHAN_NOTEBOOK_ID:
            raise ValueError("Cannot delete internal orphan notebook")

        with self._connect() as conn:
            notebook = conn.execute(
                "SELECT id FROM notebooks WHERE id = ?",
                (notebook_id,),
            ).fetchone()
            if notebook is None:
                raise ValueError(f"Notebook '{notebook_id}' not found")

            unlinked_sources = int(
                conn.execute(
                    "SELECT COUNT(*) FROM notebook_sources WHERE notebook_id = ?",
                    (notebook_id,),
                ).fetchone()[0]
            )
            deleted_notes = int(
                conn.execute(
                    "SELECT COUNT(*) FROM notes WHERE notebook_id = ?",
                    (notebook_id,),
                ).fetchone()[0]
            )

            owned_source_rows = conn.execute(
                "SELECT id FROM sources WHERE notebook_id = ?",
                (notebook_id,),
            ).fetchall()

            for row in owned_source_rows:
                source_id = str(row["id"])
                replacement = conn.execute(
                    """
                    SELECT notebook_id FROM notebook_sources
                    WHERE source_id = ? AND notebook_id != ?
                    ORDER BY created_at ASC
                    LIMIT 1
                    """,
                    (source_id, notebook_id),
                ).fetchone()
                replacement_notebook_id = (
                    str(replacement["notebook_id"])
                    if replacement is not None
                    else INTERNAL_ORPHAN_NOTEBOOK_ID
                )
                conn.execute(
                    "UPDATE sources SET notebook_id = ?, updated_at = ? WHERE id = ?",
                    (replacement_notebook_id, utc_now_iso(), source_id),
                )

            conn.execute("DELETE FROM notebooks WHERE id = ?", (notebook_id,))

        return {
            "success": True,
            "notebook_id": notebook_id,
            "unlinked_sources": unlinked_sources,
            "deleted_notes": deleted_notes,
        }

    def create_source(
        self,
        notebook_id: str,
        title: str,
        source_type: str,
        origin: str | None,
        content: str,
    ) -> dict[str, Any]:
        now = utc_now_iso()
        source = {
            "id": uuid4().hex,
            "notebook_id": notebook_id,
            "title": title,
            "source_type": source_type,
            "origin": origin,
            "content": content,
            "chunk_count": 0,
            "created_at": now,
            "updated_at": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sources (
                    id, notebook_id, title, source_type, origin, content,
                    chunk_count, created_at, updated_at
                ) VALUES (
                    :id, :notebook_id, :title, :source_type, :origin, :content,
                    :chunk_count, :created_at, :updated_at
                )
                """,
                source,
            )
            conn.execute(
                """
                INSERT OR IGNORE INTO notebook_sources (notebook_id, source_id, created_at)
                VALUES (?, ?, ?)
                """,
                (notebook_id, source["id"], now),
            )
        return source

    def list_sources(
        self,
        notebook_id: str | None = None,
        source_ids: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        query = "SELECT DISTINCT s.* FROM sources s"
        clauses: list[str] = []
        params: list[Any] = []

        if notebook_id:
            query += " JOIN notebook_sources ns ON ns.source_id = s.id"
            clauses.append("ns.notebook_id = ?")
            params.append(notebook_id)

        if source_ids:
            placeholders = ",".join("?" for _ in source_ids)
            clauses.append(f"s.id IN ({placeholders})")
            params.extend(source_ids)

        if clauses:
            query += " WHERE " + " AND ".join(clauses)

        query += " ORDER BY s.updated_at DESC"

        with self._connect() as conn:
            rows = conn.execute(query, tuple(params)).fetchall()

        return [dict(row) for row in rows]

    def list_source_ids(self, notebook_id: str) -> set[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT source_id FROM notebook_sources WHERE notebook_id = ?",
                (notebook_id,),
            ).fetchall()
        return {str(row["source_id"]) for row in rows}

    def link_source_to_notebook(self, notebook_id: str, source_id: str) -> bool:
        now = utc_now_iso()
        with self._connect() as conn:
            notebook = conn.execute(
                "SELECT id FROM notebooks WHERE id = ?",
                (notebook_id,),
            ).fetchone()
            if notebook is None:
                raise ValueError(f"Notebook '{notebook_id}' not found")

            source = conn.execute(
                "SELECT id FROM sources WHERE id = ?",
                (source_id,),
            ).fetchone()
            if source is None:
                raise ValueError(f"Source '{source_id}' not found")

            result = conn.execute(
                """
                INSERT OR IGNORE INTO notebook_sources (notebook_id, source_id, created_at)
                VALUES (?, ?, ?)
                """,
                (notebook_id, source_id, now),
            )

            current_owner_row = conn.execute(
                "SELECT notebook_id FROM sources WHERE id = ?",
                (source_id,),
            ).fetchone()
            current_owner = (
                str(current_owner_row["notebook_id"])
                if current_owner_row is not None
                else ""
            )
            if current_owner == INTERNAL_ORPHAN_NOTEBOOK_ID:
                conn.execute(
                    "UPDATE sources SET notebook_id = ?, updated_at = ? WHERE id = ?",
                    (notebook_id, now, source_id),
                )

            return result.rowcount > 0

    def unlink_source_from_notebook(self, notebook_id: str, source_id: str) -> bool:
        if notebook_id == INTERNAL_ORPHAN_NOTEBOOK_ID:
            return False

        with self._connect() as conn:
            result = conn.execute(
                "DELETE FROM notebook_sources WHERE notebook_id = ? AND source_id = ?",
                (notebook_id, source_id),
            )
            if result.rowcount <= 0:
                return False

            source_row = conn.execute(
                "SELECT notebook_id FROM sources WHERE id = ?",
                (source_id,),
            ).fetchone()
            if source_row is None:
                return True

            current_owner = str(source_row["notebook_id"])
            if current_owner == notebook_id:
                replacement = conn.execute(
                    """
                    SELECT notebook_id FROM notebook_sources
                    WHERE source_id = ?
                    ORDER BY created_at ASC
                    LIMIT 1
                    """,
                    (source_id,),
                ).fetchone()
                replacement_notebook_id = (
                    str(replacement["notebook_id"])
                    if replacement is not None
                    else INTERNAL_ORPHAN_NOTEBOOK_ID
                )
                conn.execute(
                    "UPDATE sources SET notebook_id = ?, updated_at = ? WHERE id = ?",
                    (replacement_notebook_id, utc_now_iso(), source_id),
                )

            return True

    def get_source(self, source_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM sources WHERE id = ?", (source_id,)).fetchone()
        return dict(row) if row else None

    def update_source_chunk_count(self, source_id: str, chunk_count: int) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE sources
                SET chunk_count = ?, updated_at = ?
                WHERE id = ?
                """,
                (chunk_count, utc_now_iso(), source_id),
            )

    def delete_source(self, source_id: str) -> bool:
        with self._connect() as conn:
            result = conn.execute("DELETE FROM sources WHERE id = ?", (source_id,))
            return result.rowcount > 0

    def create_chat_session(
        self,
        notebook_id: str,
        title: str,
        provider: str,
        model: str,
    ) -> dict[str, Any]:
        now = utc_now_iso()
        session = {
            "id": uuid4().hex,
            "notebook_id": notebook_id,
            "title": title,
            "provider": provider,
            "model": model,
            "created_at": now,
            "updated_at": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO chat_sessions (
                    id, notebook_id, title, provider, model, created_at, updated_at
                ) VALUES (
                    :id, :notebook_id, :title, :provider, :model, :created_at, :updated_at
                )
                """,
                session,
            )
        return session

    def list_chat_sessions(self, notebook_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM chat_sessions
                WHERE notebook_id = ?
                ORDER BY updated_at DESC
                """,
                (notebook_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def get_chat_session(self, session_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM chat_sessions WHERE id = ?", (session_id,)
            ).fetchone()
        return dict(row) if row else None

    def update_chat_session_model(
        self, session_id: str, provider: str, model: str
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE chat_sessions
                SET provider = ?, model = ?, updated_at = ?
                WHERE id = ?
                """,
                (provider, model, utc_now_iso(), session_id),
            )

    def append_message(
        self,
        session_id: str,
        role: str,
        content: str,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        message = {
            "id": uuid4().hex,
            "session_id": session_id,
            "role": role,
            "content": content,
            "meta_json": json.dumps(meta or {}),
            "created_at": utc_now_iso(),
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO chat_messages (id, session_id, role, content, meta_json, created_at)
                VALUES (:id, :session_id, :role, :content, :meta_json, :created_at)
                """,
                message,
            )
            conn.execute(
                "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
                (utc_now_iso(), session_id),
            )
        return message

    def get_messages(
        self, session_id: str, limit: int | None = None
    ) -> list[dict[str, Any]]:
        query = "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC"
        params: list[Any] = [session_id]
        if limit:
            query += " LIMIT ?"
            params.append(limit)

        with self._connect() as conn:
            rows = conn.execute(query, tuple(params)).fetchall()

        items: list[dict[str, Any]] = []
        for row in rows:
            row_dict = dict(row)
            meta_json = row_dict.get("meta_json") or "{}"
            row_dict["meta"] = json.loads(meta_json)
            items.append(row_dict)
        return items

    def create_job(self, *, job_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        job = {
            "id": uuid4().hex,
            "job_type": job_type,
            "status": "queued",
            "payload_json": json.dumps(payload),
            "result_json": None,
            "error": None,
            "created_at": now,
            "updated_at": now,
            "started_at": None,
            "completed_at": None,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO jobs (
                    id, job_type, status, payload_json, result_json, error,
                    created_at, updated_at, started_at, completed_at
                ) VALUES (
                    :id, :job_type, :status, :payload_json, :result_json, :error,
                    :created_at, :updated_at, :started_at, :completed_at
                )
                """,
                job,
            )
        return self._parse_job(job)

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return self._parse_job(dict(row)) if row else None

    def list_jobs(self, *, limit: int = 20, offset: int = 0) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM jobs
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                (limit, offset),
            ).fetchall()
        return [self._parse_job(dict(row)) for row in rows]

    def mark_job_running(self, job_id: str) -> None:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'running', updated_at = ?, started_at = ?
                WHERE id = ?
                """,
                (now, now, job_id),
            )

    def mark_job_completed(self, job_id: str, *, result: dict[str, Any]) -> None:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'completed',
                    result_json = ?,
                    error = NULL,
                    updated_at = ?,
                    completed_at = ?
                WHERE id = ?
                """,
                (json.dumps(result), now, now, job_id),
            )

    def mark_job_failed(self, job_id: str, *, error: str) -> None:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'failed',
                    error = ?,
                    updated_at = ?,
                    completed_at = ?
                WHERE id = ?
                """,
                (error, now, now, job_id),
            )

    def _parse_job(self, row: dict[str, Any]) -> dict[str, Any]:
        payload_json = row.pop("payload_json", None)
        result_json = row.pop("result_json", None)
        row["payload"] = json.loads(payload_json) if payload_json else {}
        row["result"] = json.loads(result_json) if result_json else None
        return row

    def upsert_prompt_template(self, name: str, content: str) -> dict[str, Any]:
        now = utc_now_iso()
        payload = {
            "name": name,
            "content": content,
            "updated_at": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO prompt_templates (name, content, updated_at)
                VALUES (:name, :content, :updated_at)
                ON CONFLICT(name) DO UPDATE SET
                    content = excluded.content,
                    updated_at = excluded.updated_at
                """,
                payload,
            )
        return payload

    def get_prompt_template(self, name: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT name, content, updated_at FROM prompt_templates WHERE name = ?",
                (name,),
            ).fetchone()
        return dict(row) if row else None

    def list_prompt_templates(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT name, content, updated_at FROM prompt_templates ORDER BY name ASC"
            ).fetchall()
        return [dict(row) for row in rows]

    def create_note(
        self,
        *,
        notebook_id: str,
        content: str,
        source_id: str | None = None,
        source_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        now = utc_now_iso()
        note = {
            "id": uuid4().hex,
            "notebook_id": notebook_id,
            "source_id": source_id,
            "source_ids_json": json.dumps(source_ids or []),
            "content": content,
            "created_at": now,
            "updated_at": now,
        }
        with self._connect() as conn:
            notebook = conn.execute(
                "SELECT id FROM notebooks WHERE id = ?",
                (notebook_id,),
            ).fetchone()
            if notebook is None:
                raise ValueError(f"Notebook '{notebook_id}' not found")

            linked_source_ids = {
                str(row["source_id"])
                for row in conn.execute(
                    "SELECT source_id FROM notebook_sources WHERE notebook_id = ?",
                    (notebook_id,),
                ).fetchall()
            }

            if source_id:
                source = conn.execute(
                    "SELECT id FROM sources WHERE id = ?",
                    (source_id,),
                ).fetchone()
                if source is None:
                    raise ValueError(f"Source '{source_id}' not found")
                if source_id not in linked_source_ids:
                    raise ValueError(
                        f"Source '{source_id}' is not linked to notebook '{notebook_id}'"
                    )

            if source_ids:
                invalid = [sid for sid in source_ids if sid not in linked_source_ids]
                if invalid:
                    joined = ", ".join(sorted({str(item) for item in invalid}))
                    raise ValueError(
                        f"Some note source references are not linked to the notebook: {joined}"
                    )

            conn.execute(
                """
                INSERT INTO notes (
                    id, notebook_id, source_id, source_ids_json, content, created_at, updated_at
                ) VALUES (
                    :id, :notebook_id, :source_id, :source_ids_json, :content, :created_at, :updated_at
                )
                """,
                note,
            )
        return self._parse_note(note)

    def list_notes(self, notebook_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT id, notebook_id, source_id, source_ids_json, content, created_at, updated_at
                FROM notes
                WHERE notebook_id = ?
                ORDER BY updated_at DESC
                """,
                (notebook_id,),
            ).fetchall()
        return [self._parse_note(dict(row)) for row in rows]

    def update_note(self, note_id: str, content: str) -> dict[str, Any] | None:
        now = utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                "UPDATE notes SET content = ?, updated_at = ? WHERE id = ?",
                (content, now, note_id),
            )
            row = conn.execute(
                """
                SELECT id, notebook_id, source_id, source_ids_json, content, created_at, updated_at
                FROM notes
                WHERE id = ?
                """,
                (note_id,),
            ).fetchone()
        return self._parse_note(dict(row)) if row else None

    def delete_note(self, note_id: str) -> bool:
        with self._connect() as conn:
            result = conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            return result.rowcount > 0

    def upsert_audio_overview(
        self,
        *,
        notebook_id: str,
        job_id: str,
        status: str,
        script: list[dict[str, str]] | None = None,
        audio_path: str | None = None,
        error: str | None = None,
    ) -> dict[str, Any]:
        now = utc_now_iso()
        existing = self.get_latest_audio_overview(notebook_id)
        payload = {
            "id": existing["id"] if existing else uuid4().hex,
            "notebook_id": notebook_id,
            "job_id": job_id,
            "status": status,
            "script_json": json.dumps(script) if script is not None else None,
            "audio_path": audio_path,
            "error": error,
            "created_at": existing["created_at"] if existing else now,
            "updated_at": now,
        }
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO audio_overviews (
                    id, notebook_id, job_id, status, script_json, audio_path, error, created_at, updated_at
                ) VALUES (
                    :id, :notebook_id, :job_id, :status, :script_json, :audio_path, :error, :created_at, :updated_at
                )
                ON CONFLICT(id) DO UPDATE SET
                    job_id = excluded.job_id,
                    status = excluded.status,
                    script_json = excluded.script_json,
                    audio_path = excluded.audio_path,
                    error = excluded.error,
                    updated_at = excluded.updated_at
                """,
                payload,
            )
        return self._parse_audio_overview(payload)

    def get_latest_audio_overview(self, notebook_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT id, notebook_id, job_id, status, script_json, audio_path, error, created_at, updated_at
                FROM audio_overviews
                WHERE notebook_id = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (notebook_id,),
            ).fetchone()
        return self._parse_audio_overview(dict(row)) if row else None

    def _parse_note(self, row: dict[str, Any]) -> dict[str, Any]:
        source_ids_json = row.pop("source_ids_json", None)
        row["source_ids"] = json.loads(source_ids_json) if source_ids_json else []
        return row

    def _parse_audio_overview(self, row: dict[str, Any]) -> dict[str, Any]:
        script_json = row.pop("script_json", None)
        row["script"] = json.loads(script_json) if script_json else None
        return row

    def get_resource_stats(self) -> dict[str, int]:
        with self._connect() as conn:
            notebooks_count = int(
                conn.execute(
                    "SELECT COUNT(*) FROM notebooks WHERE id != ?",
                    (INTERNAL_ORPHAN_NOTEBOOK_ID,),
                ).fetchone()[0]
            )
            sources_count = int(
                conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
            )
            chat_sessions_count = int(
                conn.execute("SELECT COUNT(*) FROM chat_sessions").fetchone()[0]
            )
            chat_messages_count = int(
                conn.execute("SELECT COUNT(*) FROM chat_messages").fetchone()[0]
            )
            notes_count = int(conn.execute("SELECT COUNT(*) FROM notes").fetchone()[0])
            audio_overviews_count = int(
                conn.execute("SELECT COUNT(*) FROM audio_overviews").fetchone()[0]
            )
            jobs_count = int(conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0])

        db_size_bytes = int(self.db_path.stat().st_size) if self.db_path.exists() else 0

        return {
            "notebooks_count": notebooks_count,
            "sources_count": sources_count,
            "chat_sessions_count": chat_sessions_count,
            "chat_messages_count": chat_messages_count,
            "notes_count": notes_count,
            "audio_overviews_count": audio_overviews_count,
            "jobs_count": jobs_count,
            "db_size_bytes": db_size_bytes,
        }
