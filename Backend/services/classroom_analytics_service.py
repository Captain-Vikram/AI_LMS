from bson import ObjectId
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

class ClassroomAnalyticsService:
    def __init__(self, db):
        self.db = db

    def _normalize_id(self, value) -> str:
        if value is None:
            return ""
        text = str(value).strip()
        return text

    def _coerce_object_id(self, value) -> Optional[ObjectId]:
        try:
            return ObjectId(str(value))
        except Exception:
            return None

    def _extract_source_value(self, payload) -> str:
        if not isinstance(payload, dict):
            return "unknown"

        for key in ("source", "resource_source", "resource_type", "type", "platform"):
            raw = payload.get(key)
            if raw is None:
                continue
            value = str(raw).strip().lower()
            if value:
                return value
        return "unknown"

    def _safe_count(self, collection, query: Dict) -> int:
        count_documents = getattr(collection, "count_documents", None)
        if not callable(count_documents):
            return 0

        try:
            value = count_documents(query)
            return int(value) if isinstance(value, (int, float)) else 0
        except Exception:
            return 0

    def get_student_progress(self, classroom_id: str, student_id: str) -> Dict:
        """Get detailed progress for a student in classroom including module and resource progress"""
        
        classroom_oid = ObjectId(classroom_id)
        student_oid = ObjectId(student_id)

        # Get completed assignments
        completed_assignments = list(self.db.assignment_submissions.find(
            {
                "classroom_id": classroom_oid,
                "student_id": student_oid,
                "status": {"$in": ["graded", "submitted"]}
            }
        ))

        total_points = 0
        earned_points = 0

        for submission in completed_assignments:
            assignment_id = submission.get("assignment_id")
            assignment = self.db.assignments.find_one({"_id": assignment_id}) if assignment_id else None
            if assignment:
                total_points += assignment.get("total_points", 0)

            if submission.get("score") is not None:
                earned_points += submission["score"]

        average_score = (earned_points / total_points * 100) if total_points > 0 else 0

        # Get module progress with strict resource pass tracking
        modules = list(self.db.learning_modules.find(
            {"classroom_id": classroom_oid, "status": "published"},
            {"name": 1, "order": 1, "resources": 1, "assessments": 1}
        ))

        module_progress = []
        for module in modules:
            module_id = module.get("_id")

            # Traditional assessment tracking
            assessment_ids = [
                assessment.get("id")
                for assessment in module.get("assessments", [])
                if isinstance(assessment, dict) and assessment.get("id") is not None
            ]

            completed_assessments = self._safe_count(self.db.assignment_submissions, {
                "classroom_id": classroom_oid,
                "student_id": student_oid,
                "assignment_id": {"$in": assessment_ids},
                "status": {"$in": ["graded", "submitted"]}
            })

            # Resource engagement tracking
            resource_engagements = list(self.db.resource_engagement.find(
                {
                    "student_id": student_oid,
                    "module_id": module_id
                }
            ))

            resources = module.get("resources", [])
            total_resources = len(resources)

            # Keep latest engagement per resource.
            engagements_by_resource_id = {}
            for engagement in resource_engagements:
                resource_id = str(engagement.get("resource_id") or "").strip()
                if not resource_id:
                    continue

                existing = engagements_by_resource_id.get(resource_id)
                if existing is None:
                    engagements_by_resource_id[resource_id] = engagement
                    continue

                existing_updated = existing.get("updated_at")
                engagement_updated = engagement.get("updated_at")
                if engagement_updated and (not existing_updated or engagement_updated >= existing_updated):
                    engagements_by_resource_id[resource_id] = engagement

            viewed_resources = 0
            attempted_resources = 0
            passed_resources = 0
            scored_attempts = []

            for resource in resources:
                resource_id = str(resource.get("id") or resource.get("resource_id") or "").strip()
                if not resource_id:
                    continue

                engagement = engagements_by_resource_id.get(resource_id)
                if not engagement:
                    continue

                if engagement.get("viewed"):
                    viewed_resources += 1

                score = engagement.get("test_score")
                test_attempts = int(engagement.get("test_attempts", 0) or 0)
                if score is not None or test_attempts > 0:
                    attempted_resources += 1

                if score is not None:
                    numeric_score = float(score)
                    scored_attempts.append(numeric_score)
                    if numeric_score >= 80:
                        passed_resources += 1

            avg_test_score = (sum(scored_attempts) / len(scored_attempts)) if scored_attempts else 0

            # If resources are present, completion is pass-based per resource.
            # Otherwise fall back to assessment completion.
            if total_resources > 0:
                completion_percentage = (
                    (passed_resources / total_resources) * 100 if total_resources > 0 else 0
                )
            else:
                total_assessments = len(module.get("assessments", []))
                completion_percentage = (
                    (completed_assessments / total_assessments) * 100
                    if total_assessments > 0
                    else 0
                )

            module_progress.append({
                "module_id": str(module_id),
                "module_name": module.get("name", "Untitled Module"),
                "completed_assessments": completed_assessments,
                "total_assessments": len(module.get("assessments", [])),
                "viewed_resources": viewed_resources,
                "attempted_resources": attempted_resources,
                "passed_resources": passed_resources,
                "total_resources": total_resources,
                "average_resource_test_score": round(avg_test_score, 2),
                "completion_percentage": round(completion_percentage, 2)
            })

        return {
            "student_id": str(student_oid),
            "classroom_id": str(classroom_oid),
            "total_earned_points": earned_points,
            "total_possible_points": total_points,
            "average_score_percentage": round(average_score, 2),
            "assignments_completed": len(completed_assignments),
            "module_progress": module_progress
        }

    def get_classroom_analytics(self, classroom_id: str) -> Dict:
        """Get classroom-wide analytics"""
        
        classroom_oid = ObjectId(classroom_id)
        classroom = self.db.classrooms.find_one({"_id": classroom_oid})

        if not classroom:
            raise ValueError("Classroom not found")

        students = classroom.get("students", [])
        
        # Get student progress summaries
        student_analytics = []
        for student_id in students:
            progress = self.get_student_progress(classroom_id, str(student_id))
            student_analytics.append(progress)

        # Calculate class stats
        total_assignments_submitted = self._safe_count(self.db.assignment_submissions, {
            "classroom_id": classroom_oid
        })

        average_class_score = 0
        if student_analytics:
            average_class_score = sum(s["average_score_percentage"] for s in student_analytics) / len(student_analytics)

        # Assignment completion rate
        total_assignments = self._safe_count(self.db.assignments, {"classroom_id": classroom_oid})
        completion_rate = (total_assignments_submitted / (total_assignments * len(students)) * 100) if (total_assignments * len(students)) > 0 else 0

        return {
            "classroom_id": str(classroom_oid),
            "classroom_name": classroom.get("name", "Classroom"),
            "total_students": len(students),
            "average_class_score": round(average_class_score, 2),
            "assignment_completion_rate": round(completion_rate, 2),
            "total_assignments": total_assignments,
            "total_submissions": total_assignments_submitted,
            "student_analytics": student_analytics
        }

    def get_ai_questions_by_module(self, classroom_id: str, student_id: Optional[str] = None) -> Dict:
        """Aggregate ask-AI activity counts by module and source for heatmap rendering."""

        try:
            classroom_oid = ObjectId(classroom_id)
        except Exception as exc:
            raise ValueError("Invalid classroom id") from exc
        classroom = self.db.classrooms.find_one({"_id": classroom_oid}, {"_id": 1})
        if not classroom:
            raise ValueError("Classroom not found")

        module_name_lookup: Dict[str, str] = {}
        resource_to_module: Dict[str, str] = {}
        resource_to_source: Dict[str, str] = {}

        module_docs = list(
            self.db.learning_modules.find(
                {"classroom_id": {"$in": [classroom_id, classroom_oid]}},
                {"name": 1, "resources": 1},
            )
        )

        for module in module_docs:
            module_id = self._normalize_id(module.get("_id"))
            if not module_id:
                continue

            module_name_lookup[module_id] = str(module.get("name") or "Untitled Module")
            resources = module.get("resources") if isinstance(module.get("resources"), list) else []
            for resource in resources:
                if not isinstance(resource, dict):
                    continue

                source = self._extract_source_value(resource)
                for key in ("id", "resource_id", "_id"):
                    resource_id = self._normalize_id(resource.get(key))
                    if not resource_id:
                        continue
                    resource_to_module.setdefault(resource_id, module_id)
                    if source != "unknown":
                        resource_to_source.setdefault(resource_id, source)

        resources_collection_docs = list(
            self.db.resources.find(
                {"classroom_id": {"$in": [classroom_id, classroom_oid]}},
                {"_id": 1, "module_id": 1, "source": 1, "resource_source": 1, "resource_type": 1, "type": 1},
            )
        )
        for resource in resources_collection_docs:
            resource_id = self._normalize_id(resource.get("_id"))
            if not resource_id:
                continue

            module_id = self._normalize_id(resource.get("module_id"))
            if module_id:
                resource_to_module.setdefault(resource_id, module_id)

            source = self._extract_source_value(resource)
            if source != "unknown":
                resource_to_source.setdefault(resource_id, source)

        activity_filter: Dict = {
            "classroom_id": {"$in": [classroom_id, classroom_oid]},
            "action_type": "ai_question_asked",
        }

        if student_id:
            user_candidates: List = [student_id]
            student_oid = self._coerce_object_id(student_id)
            if student_oid is not None:
                user_candidates.append(student_oid)

            activity_filter["$or"] = [
                {"student_id": {"$in": user_candidates}},
                {"action_performed_by_id": {"$in": user_candidates}},
            ]

        activity_docs = list(
            self.db.activity_feed.find(
                activity_filter,
                {"module_id": 1, "resource_id": 1, "details": 1},
            )
        )

        counts: Dict[Tuple[str, str], int] = {}
        module_totals: Dict[str, int] = {}
        source_totals: Dict[str, int] = {}

        for entry in activity_docs:
            details = entry.get("details") if isinstance(entry.get("details"), dict) else {}
            module_id = self._normalize_id(entry.get("module_id") or details.get("module_id"))
            resource_id = self._normalize_id(entry.get("resource_id"))

            if not module_id and resource_id:
                module_id = resource_to_module.get(resource_id, "")

            if not module_id:
                module_id = "unassigned"

            source = self._extract_source_value(details)
            if source == "unknown":
                source = self._extract_source_value(entry)
            if source == "unknown" and resource_id:
                source = resource_to_source.get(resource_id, "unknown")

            if module_id not in module_name_lookup:
                if module_id == "unassigned":
                    module_name_lookup[module_id] = "Unassigned"
                else:
                    module_name_lookup[module_id] = f"Module {module_id[:8]}"

            key = (module_id, source)
            counts[key] = counts.get(key, 0) + 1
            module_totals[module_id] = module_totals.get(module_id, 0) + 1
            source_totals[source] = source_totals.get(source, 0) + 1

        missing_module_ids: List[ObjectId] = []
        for module_id in module_totals.keys():
            if module_id == "unassigned":
                continue
            module_name = module_name_lookup.get(module_id, "")
            if module_name and not module_name.startswith("Module "):
                continue
            module_oid = self._coerce_object_id(module_id)
            if module_oid is not None:
                missing_module_ids.append(module_oid)

        if missing_module_ids:
            resolved_modules = list(
                self.db.learning_modules.find(
                    {"_id": {"$in": missing_module_ids}},
                    {"name": 1},
                )
            )
            for module in resolved_modules:
                module_id = self._normalize_id(module.get("_id"))
                if module_id:
                    module_name_lookup[module_id] = str(module.get("name") or "Untitled Module")

        if not counts:
            return {
                "classroom_id": str(classroom_oid),
                "scope": {
                    "type": "student" if student_id else "classroom",
                    "student_id": student_id,
                },
                "modules": [],
                "sources": [],
                "cells": [],
                "max_count": 0,
                "total_questions": 0,
            }

        sorted_modules = sorted(
            module_totals.keys(),
            key=lambda module_id: (-module_totals.get(module_id, 0), module_name_lookup.get(module_id, "Module")),
        )
        sorted_sources = sorted(
            source_totals.keys(),
            key=lambda source: (-source_totals.get(source, 0), source),
        )
        max_count = max(counts.values()) if counts else 0

        cells = []
        for source in sorted_sources:
            for module_id in sorted_modules:
                count = counts.get((module_id, source), 0)
                cells.append(
                    {
                        "module_id": module_id,
                        "module_name": module_name_lookup.get(module_id, "Module"),
                        "source": source,
                        "count": count,
                        "intensity": round((count / max_count), 4) if max_count > 0 else 0,
                    }
                )

        return {
            "classroom_id": str(classroom_oid),
            "scope": {
                "type": "student" if student_id else "classroom",
                "student_id": student_id,
            },
            "modules": [
                {
                    "module_id": module_id,
                    "module_name": module_name_lookup.get(module_id, "Module"),
                    "total_questions": module_totals.get(module_id, 0),
                }
                for module_id in sorted_modules
            ],
            "sources": [
                {
                    "source": source,
                    "total_questions": source_totals.get(source, 0),
                }
                for source in sorted_sources
            ],
            "cells": cells,
            "max_count": max_count,
            "total_questions": sum(module_totals.values()),
        }

    def get_submission_analytics(self, classroom_id: str, assignment_id: str) -> Dict:
        """Get analytics for a specific assignment"""
        
        classroom_oid = ObjectId(classroom_id)
        assignment_oid = ObjectId(assignment_id)

        submissions = list(self.db.assignment_submissions.find({
            "classroom_id": classroom_oid,
            "assignment_id": assignment_oid
        }))

        scored_submissions = [s for s in submissions if s.get("score") is not None]
        
        scores = [s["score"] for s in scored_submissions]
        average_score = sum(scores) / len(scores) if scores else 0

        return {
            "assignment_id": str(assignment_oid),
            "total_submissions": len(submissions),
            "graded_submissions": len(scored_submissions),
            "pending_grading": len(submissions) - len(scored_submissions),
            "average_score": round(average_score, 2),
            "highest_score": max(scores) if scores else 0,
            "lowest_score": min(scores) if scores else 0
        }
