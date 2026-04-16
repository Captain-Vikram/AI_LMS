from bson import ObjectId
from datetime import datetime, timedelta
from typing import Dict, List

class ClassroomAnalyticsService:
    def __init__(self, db):
        self.db = db

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
