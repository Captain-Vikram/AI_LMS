import asyncio
import io
import os
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from bson import ObjectId
from fastapi import HTTPException
from starlette.datastructures import UploadFile as StarletteUploadFile

# Ensure Backend directory is on sys.path when running tests from repo root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import routes.classroom_routes as classroom_routes


class _RBACMemberTeacher:
    def __init__(self, _db):
        pass

    def is_classroom_member(self, _user_id, _classroom_id):
        return True

    def is_teacher(self, _user_id, _classroom_id):
        return True


class _RBACMemberStudent:
    def __init__(self, _db):
        pass

    def is_classroom_member(self, _user_id, _classroom_id):
        return True

    def is_teacher(self, _user_id, _classroom_id):
        return False


def test_get_class_resources_teacher_receives_pending_and_approved(monkeypatch):
    classroom_id = str(ObjectId())
    user_id = str(ObjectId())

    mock_db = MagicMock()
    mock_db.classrooms.find_one.return_value = {
        "_id": ObjectId(classroom_id),
        "name": "Math 9",
        "subject": "Mathematics",
        "subject_focus_areas": ["Algebra"],
        "ai_resources": [
            {
                "resource_id": "r1",
                "title": "Approved item",
                "approval_status": "approved",
            },
            {
                "resource_id": "r2",
                "title": "Pending item",
                "approval_status": "pending",
            },
        ],
    }

    monkeypatch.setattr(classroom_routes, "get_db", lambda: mock_db)
    monkeypatch.setattr(classroom_routes, "RBACService", _RBACMemberTeacher)

    result = asyncio.run(
        classroom_routes.get_classroom_resources(
            classroom_id=classroom_id,
            mode="class",
            current_user={"user_id": user_id, "role": "teacher"},
        )
    )

    assert result["status"] == "success"
    assert result["mode"] == "class"
    assert result["summary"]["total"] == 2
    assert result["summary"]["pending"] == 1


def test_get_class_resources_student_receives_only_approved(monkeypatch):
    classroom_id = str(ObjectId())
    user_id = str(ObjectId())

    mock_db = MagicMock()
    mock_db.classrooms.find_one.return_value = {
        "_id": ObjectId(classroom_id),
        "name": "Math 9",
        "subject": "Mathematics",
        "subject_focus_areas": ["Algebra"],
        "ai_resources": [
            {
                "resource_id": "r1",
                "title": "Approved item",
                "approval_status": "approved",
            },
            {
                "resource_id": "r2",
                "title": "Pending item",
                "approval_status": "pending",
            },
        ],
    }

    monkeypatch.setattr(classroom_routes, "get_db", lambda: mock_db)
    monkeypatch.setattr(classroom_routes, "RBACService", _RBACMemberStudent)

    result = asyncio.run(
        classroom_routes.get_classroom_resources(
            classroom_id=classroom_id,
            mode="class",
            current_user={"user_id": user_id, "role": "student"},
        )
    )

    assert result["status"] == "success"
    assert result["summary"]["total"] == 1
    assert all(item["approval_status"] == "approved" for item in result["resources"])


def test_get_personal_resources_without_assessment_returns_empty_message(monkeypatch):
    classroom_id = str(ObjectId())
    user_id = str(ObjectId())

    mock_db = MagicMock()
    mock_db.classrooms.find_one.return_value = {
        "_id": ObjectId(classroom_id),
        "name": "Math 9",
        "subject": "Mathematics",
        "subject_focus_areas": ["Algebra"],
        "ai_resources": [],
    }
    mock_db.skill_assessment_results.find_one.return_value = None

    monkeypatch.setattr(classroom_routes, "get_db", lambda: mock_db)
    monkeypatch.setattr(classroom_routes, "RBACService", _RBACMemberStudent)

    result = asyncio.run(
        classroom_routes.get_classroom_resources(
            classroom_id=classroom_id,
            mode="personal",
            current_user={"user_id": user_id, "role": "student"},
        )
    )

    assert result["status"] == "success"
    assert result["mode"] == "personal"
    assert result["summary"]["total"] == 0
    assert "skill assessment" in result["message"].lower()


def test_update_resource_approval_teacher_success(monkeypatch):
    classroom_id = str(ObjectId())
    user_id = str(ObjectId())

    mock_db = MagicMock()
    mock_db.classrooms.find_one.side_effect = [
        {
            "_id": ObjectId(classroom_id),
            "teacher_id": ObjectId(user_id),
            "ai_resources": [{"resource_id": "res-1", "approval_status": "pending"}],
        },
        {
            "_id": ObjectId(classroom_id),
            "ai_resources": [{"resource_id": "res-1", "approval_status": "approved"}],
        },
    ]
    mock_db.classrooms.update_one.return_value = SimpleNamespace(matched_count=1)

    monkeypatch.setattr(classroom_routes, "get_db", lambda: mock_db)

    payload = classroom_routes.ResourceApprovalRequest(approved=True)
    result = asyncio.run(
        classroom_routes.update_resource_approval(
            classroom_id=classroom_id,
            resource_id="res-1",
            payload=payload,
            current_user={"user_id": user_id, "role": "teacher"},
        )
    )

    assert result["status"] == "success"
    assert result["resource_id"] == "res-1"
    assert result["approval_status"] == "approved"
    assert result["summary"]["approved"] == 1


def test_create_classroom_requires_pdf(monkeypatch):
    class _JsonOnlyRequest:
        headers = {"content-type": "application/json"}

        async def json(self):
            return {
                "name": "Grade 9 Algebra",
                "subject": "Mathematics",
                "grade_level": "9",
                "subject_description": "Core algebra foundations",
                "student_expectations": "Solve linear equations",
            }

    monkeypatch.setattr(classroom_routes, "get_db", lambda: MagicMock())

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            classroom_routes.create_classroom(
                request=_JsonOnlyRequest(),
                current_user={"user_id": str(ObjectId()), "role": "teacher"},
            )
        )

    assert exc.value.status_code == 400
    assert "subject PDF" in str(exc.value.detail)


def test_parse_create_classroom_request_accepts_starlette_uploadfile():
    class _MultipartRequest:
        headers = {"content-type": "multipart/form-data; boundary=demo"}

        async def form(self):
            return {
                "name": "Grade 6 Cloud Computing",
                "subject": "Cloud Computing",
                "grade_level": "6",
                "subject_description": "Foundations of cloud architecture",
                "student_expectations": "Understand IaaS and deployment basics",
                "require_approval": "true",
                "curriculum_pdf": StarletteUploadFile(
                    file=io.BytesIO(b"%PDF-1.4 demo"),
                    filename="Cloud Computing SEM 6.pdf",
                ),
            }

    payload, curriculum_pdf = asyncio.run(
        classroom_routes._parse_create_classroom_request(_MultipartRequest())
    )

    assert payload["subject"] == "Cloud Computing"
    assert curriculum_pdf is not None
    assert curriculum_pdf.filename == "Cloud Computing SEM 6.pdf"
