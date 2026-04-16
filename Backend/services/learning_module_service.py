"""
Learning Module Service
Handles module creation, resource linking, and progress tracking
"""

import re
from bson import ObjectId
from datetime import datetime
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Any
from models.learning_module_models import (
    LearningModule,
    ModuleStatus,
    ModuleResource,
    LearningObjective,
    ModuleAssessment,
)


class LearningModuleService:
    """Service for managing learning modules and resource-based progression"""

    MODULE_PASS_THRESHOLD = 80.0

    def __init__(self, db):
        self.db = db

    def auto_generate_modules_from_resources(
        self,
        classroom_id: str,
        force_regenerate: bool = False
    ) -> Dict[str, Any]:
        """
        Auto-generates learning modules from approved classroom resources.
        Groups resources by skill and creates a module for each skill group.
        
        Args:
            classroom_id: ID of the classroom
            force_regenerate: If True, regenerates existing modules
            
        Returns:
            Dictionary with status, generated modules, and statistics
        """
        try:
            classroom_oid = ObjectId(classroom_id)
        except Exception:
            return {
                "status": "error",
                "message": "Invalid classroom ID"
            }

        # Get classroom and its resources
        classroom = self.db.classrooms.find_one(
            {"_id": classroom_oid},
            {
                "ai_resources": 1,
                "subject": 1,
                "name": 1,
                "curriculum_metadata": 1,
                "subject_focus_areas": 1,
            },
        )

        if not classroom:
            return {
                "status": "error",
                "message": "Classroom not found"
            }

        # Group approved resources by skill
        ai_resources = classroom.get("ai_resources", [])
        resources_by_skill = self._group_resources_by_skill(ai_resources)

        if not resources_by_skill:
            return {
                "status": "success",
                "message": "No approved resources to generate modules from",
                "modules_created": 0,
                "modules": []
            }

        syllabus_modules = self._extract_syllabus_module_names(classroom)

        # Map raw skills to syllabus module names when possible.
        resources_by_module: Dict[str, List[Dict[str, Any]]] = {}
        source_skills_by_module: Dict[str, set] = {}

        for skill, resources in resources_by_skill.items():
            matched_module_name = self._match_skill_to_syllabus_module(skill, syllabus_modules)
            module_name = matched_module_name or skill
            resources_by_module.setdefault(module_name, []).extend(resources)
            source_skills_by_module.setdefault(module_name, set()).add(skill)

        generated_modules = []
        created_count = 0
        updated_count = 0

        existing_modules = list(self.db.learning_modules.find({"classroom_id": classroom_oid}))
        existing_modules_by_name: Dict[str, Dict[str, Any]] = {}
        highest_order = 0

        for module in existing_modules:
            highest_order = max(highest_order, int(module.get("order", 0) or 0))
            aliases = [module.get("name"), module.get("subject")]
            for alias in aliases:
                alias_key = self._normalize_text_key(alias)
                if alias_key and alias_key not in existing_modules_by_name:
                    existing_modules_by_name[alias_key] = module

        next_order = highest_order + 1
        syllabus_order = {
            self._normalize_text_key(name): index
            for index, name in enumerate(syllabus_modules)
        }

        module_items = sorted(
            resources_by_module.items(),
            key=lambda item: (
                syllabus_order.get(self._normalize_text_key(item[0]), 10 ** 6),
                self._normalize_text_key(item[0]),
            ),
        )

        for module_name, resources in module_items:
            module_key = self._normalize_text_key(module_name)
            existing_module = existing_modules_by_name.get(module_key)

            module_resources = self._prepare_module_resources(resources)
            generated_objectives = self._generate_objectives_from_resources(module_name, resources)
            target_skills = sorted(source_skills_by_module.get(module_name, {module_name}))
            estimated_hours = self._estimate_hours(resources)
            difficulty_level = self._estimate_difficulty(resources)
            description = f"Learning module for {module_name}. Contains {len(resources)} resources."

            if existing_module:
                module_id = str(existing_module["_id"])
                existing_resources = existing_module.get("resources", [])

                if force_regenerate:
                    merged_resources = module_resources
                    module_was_updated = True
                else:
                    existing_resource_ids = {
                        resource.get("id") or resource.get("resource_id")
                        for resource in existing_resources
                        if isinstance(resource, dict)
                    }

                    new_resources = [
                        resource
                        for resource in module_resources
                        if (resource.get("id") or resource.get("resource_id")) not in existing_resource_ids
                    ]

                    start_order = len(existing_resources)
                    for offset, resource in enumerate(new_resources):
                        resource["order"] = start_order + offset

                    merged_resources = existing_resources + new_resources
                    module_was_updated = len(new_resources) > 0

                if force_regenerate or module_was_updated:
                    self.db.learning_modules.update_one(
                        {"_id": existing_module["_id"]},
                        {
                            "$set": {
                                "subject": module_name,
                                "name": module_name,
                                "description": description,
                                "objectives": generated_objectives,
                                "resources": merged_resources,
                                "estimated_hours": estimated_hours,
                                "difficulty_level": difficulty_level,
                                "target_skills": target_skills,
                                "status": existing_module.get("status", ModuleStatus.PUBLISHED.value),
                                "updated_date": datetime.utcnow(),
                            }
                        },
                    )
                    updated_count += 1

                self._link_resources_to_module(
                    classroom_oid,
                    resources,
                    module_id,
                    module_name=module_name,
                )

                generated_modules.append(
                    {
                        "module_id": module_id,
                        "name": module_name,
                        "resource_count": len(resources),
                        "order": existing_module.get("order", 0),
                        "action": "updated" if (force_regenerate or module_was_updated) else "linked",
                    }
                )
                continue

            module_doc = {
                "_id": ObjectId(),
                "classroom_id": classroom_oid,
                "subject": module_name,
                "name": module_name,
                "description": description,
                "order": next_order,
                "status": ModuleStatus.PUBLISHED.value,
                "objectives": generated_objectives,
                "resources": module_resources,
                "assessments": [],
                "estimated_hours": estimated_hours,
                "difficulty_level": difficulty_level,
                "target_skills": target_skills,
                "created_date": datetime.utcnow(),
                "updated_date": datetime.utcnow(),
                "published_date": datetime.utcnow(),
            }

            result = self.db.learning_modules.insert_one(module_doc)

            self._link_resources_to_module(
                classroom_oid,
                resources,
                str(result.inserted_id),
                module_name=module_name,
            )

            generated_modules.append(
                {
                    "module_id": str(result.inserted_id),
                    "name": module_name,
                    "resource_count": len(resources),
                    "order": next_order,
                    "action": "created",
                }
            )

            created_count += 1
            next_order += 1

        processed_count = created_count + updated_count
        return {
            "status": "success",
            "message": f"Processed {processed_count} modules ({created_count} created, {updated_count} updated)",
            "modules_created": created_count,
            "modules_updated": updated_count,
            "modules_processed": processed_count,
            "modules": generated_modules,
        }

    def create_module(
        self,
        classroom_id: str,
        name: str,
        description: str = "",
        status: str = ModuleStatus.PUBLISHED.value,
    ) -> Dict[str, Any]:
        """Creates a manual learning module for a classroom."""
        try:
            classroom_oid = ObjectId(classroom_id)
        except Exception:
            return {"status": "error", "message": "Invalid classroom ID"}

        if not str(name or "").strip():
            return {"status": "error", "message": "Module name is required"}

        classroom_exists = self.db.classrooms.find_one({"_id": classroom_oid}, {"_id": 1})
        if not classroom_exists:
            return {"status": "error", "message": "Classroom not found"}

        module_name = re.sub(r"\s+", " ", str(name).strip())
        module_key = self._normalize_text_key(module_name)
        existing_modules = list(
            self.db.learning_modules.find({"classroom_id": classroom_oid}, {"name": 1, "subject": 1})
        )
        duplicate_exists = any(
            self._normalize_text_key(item.get("name")) == module_key
            or self._normalize_text_key(item.get("subject")) == module_key
            for item in existing_modules
        )
        if duplicate_exists:
            return {
                "status": "error",
                "message": "A module with this name already exists in the classroom",
            }

        latest_module = self.db.learning_modules.find_one(
            {"classroom_id": classroom_oid},
            sort=[("order", -1)],
        )
        next_order = int(latest_module.get("order", 0) or 0) + 1 if latest_module else 1

        module_doc = {
            "_id": ObjectId(),
            "classroom_id": classroom_oid,
            "subject": module_name,
            "name": module_name,
            "description": str(description or "").strip() or f"Learning module for {module_name}.",
            "order": next_order,
            "status": status if status in {"draft", "published", "archived"} else ModuleStatus.PUBLISHED.value,
            "objectives": self._generate_objectives_from_resources(module_name, []),
            "resources": [],
            "assessments": [],
            "estimated_hours": 0,
            "difficulty_level": "medium",
            "target_skills": [module_name],
            "created_date": datetime.utcnow(),
            "updated_date": datetime.utcnow(),
            "published_date": datetime.utcnow(),
        }

        self.db.learning_modules.insert_one(module_doc)

        return {
            "status": "success",
            "message": "Module created successfully",
            "module": self._module_to_dict(module_doc),
        }

    def reorder_modules(
        self,
        classroom_id: str,
        module_ids: List[str],
    ) -> Dict[str, Any]:
        """Reorders classroom modules using the provided ordered module ID list."""
        try:
            classroom_oid = ObjectId(classroom_id)
        except Exception:
            return {"status": "error", "message": "Invalid classroom ID"}

        if not module_ids:
            return {"status": "error", "message": "module_ids cannot be empty"}

        ordered_unique_ids = []
        seen_ids = set()
        for module_id in module_ids:
            if module_id in seen_ids:
                continue
            seen_ids.add(module_id)
            ordered_unique_ids.append(module_id)

        try:
            module_oids = [ObjectId(module_id) for module_id in ordered_unique_ids]
        except Exception:
            return {"status": "error", "message": "module_ids must contain valid module IDs"}

        modules = list(
            self.db.learning_modules.find(
                {"classroom_id": classroom_oid, "_id": {"$in": module_oids}},
                {"_id": 1},
            )
        )

        if len(modules) != len(module_oids):
            return {
                "status": "error",
                "message": "One or more modules were not found in this classroom",
            }

        timestamp = datetime.utcnow()
        for order_index, module_oid in enumerate(module_oids, start=1):
            self.db.learning_modules.update_one(
                {"_id": module_oid, "classroom_id": classroom_oid},
                {"$set": {"order": order_index, "updated_date": timestamp}},
            )

        refreshed = self.get_classroom_modules(classroom_id)
        return {
            "status": "success",
            "message": "Modules reordered successfully",
            "modules": refreshed.get("modules", []),
        }

    def get_approved_resources_for_module_assignment(
        self,
        classroom_id: str,
    ) -> Dict[str, Any]:
        """Returns approved classroom resources grouped by syllabus-aligned module category."""
        try:
            classroom_oid = ObjectId(classroom_id)
        except Exception:
            return {"status": "error", "message": "Invalid classroom ID"}

        classroom = self.db.classrooms.find_one(
            {"_id": classroom_oid},
            {
                "ai_resources": 1,
                "curriculum_metadata": 1,
                "subject_focus_areas": 1,
            },
        )
        if not classroom:
            return {"status": "error", "message": "Classroom not found"}

        approved_resources = [
            resource
            for resource in classroom.get("ai_resources", [])
            if isinstance(resource, dict) and resource.get("approval_status") == "approved"
        ]

        syllabus_modules = self._extract_syllabus_module_names(classroom)
        grouped: Dict[str, List[Dict[str, Any]]] = {}

        for resource in approved_resources:
            explicit_module_name = str(resource.get("module_name") or "").strip()
            resource_skill = str(resource.get("skill") or "General").strip() or "General"
            matched_module_name = self._match_skill_to_syllabus_module(resource_skill, syllabus_modules)
            category_name = explicit_module_name or matched_module_name or resource_skill

            grouped.setdefault(category_name, []).append(
                self._resource_to_assignment_dict(resource)
            )

        syllabus_order = {
            self._normalize_text_key(name): index
            for index, name in enumerate(syllabus_modules)
        }

        categories = []
        for category_name in sorted(
            grouped,
            key=lambda name: (
                syllabus_order.get(self._normalize_text_key(name), 10 ** 6),
                self._normalize_text_key(name),
            ),
        ):
            category_resources = sorted(
                grouped[category_name],
                key=lambda resource: (resource.get("title") or "").lower(),
            )
            categories.append(
                {
                    "category": category_name,
                    "resource_count": len(category_resources),
                    "resources": category_resources,
                }
            )

        return {
            "status": "success",
            "categories": categories,
            "total_resources": len(approved_resources),
        }

    def add_resources_to_module(
        self,
        classroom_id: str,
        module_id: str,
        resource_ids: List[str],
    ) -> Dict[str, Any]:
        """Adds approved classroom resources into an existing module."""
        try:
            classroom_oid = ObjectId(classroom_id)
            module_oid = ObjectId(module_id)
        except Exception:
            return {"status": "error", "message": "Invalid classroom or module ID"}

        if not resource_ids:
            return {"status": "error", "message": "resource_ids cannot be empty"}

        module = self.db.learning_modules.find_one(
            {"_id": module_oid, "classroom_id": classroom_oid}
        )
        if not module:
            return {"status": "error", "message": "Module not found in classroom"}

        classroom = self.db.classrooms.find_one(
            {"_id": classroom_oid},
            {"ai_resources": 1},
        )
        if not classroom:
            return {"status": "error", "message": "Classroom not found"}

        approved_resource_map = {
            resource.get("resource_id"): resource
            for resource in classroom.get("ai_resources", [])
            if isinstance(resource, dict)
            and resource.get("resource_id")
            and resource.get("approval_status") == "approved"
        }

        unique_resource_ids = []
        seen_ids = set()
        for resource_id in resource_ids:
            if not resource_id or resource_id in seen_ids:
                continue
            seen_ids.add(resource_id)
            unique_resource_ids.append(resource_id)

        valid_resources = []
        missing_resource_ids = []
        for resource_id in unique_resource_ids:
            resource = approved_resource_map.get(resource_id)
            if not resource:
                missing_resource_ids.append(resource_id)
                continue
            valid_resources.append(resource)

        if not valid_resources:
            return {
                "status": "error",
                "message": "No approved resources found for assignment",
                "missing_resource_ids": missing_resource_ids,
            }

        module_resources = list(module.get("resources", []))
        existing_resource_ids = {
            resource.get("id") or resource.get("resource_id")
            for resource in module_resources
            if isinstance(resource, dict)
        }

        added_count = 0
        next_order = len(module_resources)
        for resource in valid_resources:
            resource_id = resource.get("resource_id")
            if not resource_id or resource_id in existing_resource_ids:
                continue

            module_resources.append(
                {
                    "id": resource_id,
                    "title": resource.get("title", "Untitled"),
                    "resource_type": resource.get("resource_type", "link"),
                    "url": resource.get("url", ""),
                    "description": resource.get("description", ""),
                    "order": next_order,
                }
            )
            existing_resource_ids.add(resource_id)
            next_order += 1
            added_count += 1

        if added_count > 0:
            self.db.learning_modules.update_one(
                {"_id": module_oid, "classroom_id": classroom_oid},
                {
                    "$set": {
                        "resources": module_resources,
                        "estimated_hours": self._estimate_hours(module_resources),
                        "difficulty_level": self._estimate_difficulty(module_resources),
                        "updated_date": datetime.utcnow(),
                    }
                },
            )

        self._link_resources_to_module(
            classroom_oid,
            valid_resources,
            module_id,
            module_name=module.get("name"),
        )

        refreshed_module = self.db.learning_modules.find_one({"_id": module_oid, "classroom_id": classroom_oid})
        return {
            "status": "success",
            "message": "Resources assigned to module",
            "added_count": added_count,
            "skipped_count": max(0, len(valid_resources) - added_count),
            "missing_resource_ids": missing_resource_ids,
            "module": self._module_to_dict(refreshed_module) if refreshed_module else None,
        }

    def get_classroom_modules(
        self,
        classroom_id: str,
        status_filter: Optional[str] = None,
        include_progress: bool = False,
        student_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves all modules for a classroom with optional progress tracking.
        
        Args:
            classroom_id: ID of the classroom
            status_filter: Filter by module status (draft, published, archived)
            include_progress: Whether to include student progress
            student_id: ID of student for progress tracking
            
        Returns:
            Dictionary with modules and statistics
        """
        try:
            classroom_oid = ObjectId(classroom_id)
        except Exception:
            return {
                "status": "error",
                "message": "Invalid classroom ID",
                "modules": []
            }

        query: Dict[str, Any] = {"classroom_id": classroom_oid}
        if status_filter:
            query["status"] = status_filter

        modules = list(self.db.learning_modules.find(query).sort("order", 1))

        if not modules:
            return {
                "status": "success",
                "message": "No modules found",
                "modules": [],
                "total": 0
            }

        # Convert ObjectIds to strings
        result_modules = []
        for module in modules:
            module_dict = self._module_to_dict(module)

            # Add progress if requested
            if include_progress and student_id:
                try:
                    student_oid = ObjectId(student_id)
                    progress = self.get_module_progress(
                        student_oid,
                        module["_id"]
                    )
                    module_dict["student_progress"] = progress
                except Exception:
                    pass

            result_modules.append(module_dict)

        return {
            "status": "success",
            "message": f"Retrieved {len(result_modules)} modules",
            "modules": result_modules,
            "total": len(result_modules)
        }

    def get_module_progress(
        self,
        student_id: ObjectId,
        module_id: ObjectId
    ) -> Dict[str, Any]:
        """
        Calculates student progress on a specific module based on resource tests.
        
        Args:
            student_id: ObjectId of the student
            module_id: ObjectId of the module
            
        Returns:
            Dictionary with progress statistics
        """
        # Get module to see how many resources it has
        module = self.db.learning_modules.find_one(
            {"_id": module_id}
        )

        if not module:
            return {
                "module_id": str(module_id),
                "progress_percentage": 0,
                "resources_completed": 0,
                "total_resources": 0,
                "average_score": 0,
                "status": "not_started"
            }

        resources = module.get("resources", [])
        total_resources = len(resources)

        if total_resources == 0:
            return {
                "module_id": str(module_id),
                "progress_percentage": 100,
                "resources_completed": 0,
                "total_resources": 0,
                "average_score": 0,
                "status": "completed"
            }

        # Check resource engagement for this student.
        engagements = list(
            self.db.resource_engagement.find(
                {
                    "student_id": student_id,
                    "module_id": module_id,
                }
            )
        )

        # Keep latest engagement per resource_id.
        engagements_by_resource_id: Dict[str, Dict[str, Any]] = {}
        for engagement in engagements:
            resource_id = str(engagement.get("resource_id") or "").strip()
            if not resource_id:
                continue

            current = engagements_by_resource_id.get(resource_id)
            if current is None:
                engagements_by_resource_id[resource_id] = engagement
                continue

            current_time = current.get("updated_at") or datetime.min
            engagement_time = engagement.get("updated_at") or datetime.min
            if engagement_time >= current_time:
                engagements_by_resource_id[resource_id] = engagement

        viewed_resources = 0
        attempted_resources = 0
        passed_resources = 0
        test_scores: List[float] = []

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
            if score is not None or int(engagement.get("test_attempts", 0) or 0) > 0:
                attempted_resources += 1

            if score is not None:
                numeric_score = float(score)
                test_scores.append(numeric_score)
                if numeric_score >= self.MODULE_PASS_THRESHOLD:
                    passed_resources += 1

        average_score = sum(test_scores) / len(test_scores) if test_scores else 0.0
        progress_percentage = (
            (passed_resources / total_resources) * 100 if total_resources > 0 else 0
        )

        if total_resources > 0 and passed_resources == total_resources:
            status = "completed"
        elif viewed_resources > 0 or attempted_resources > 0:
            status = "in_progress"
        else:
            status = "not_started"

        return {
            "module_id": str(module_id),
            "progress_percentage": round(progress_percentage, 2),
            "resources_completed": passed_resources,
            "resources_viewed": viewed_resources,
            "resources_attempted": attempted_resources,
            "total_resources": total_resources,
            "resources_with_tests": len(test_scores),
            "passed_resources": passed_resources,
            "average_score": round(average_score, 2),
            "status": status,
            "completion_requirement": "Each module resource must be attempted and scored at least 80%",
        }

    def track_resource_engagement(
        self,
        student_id: str,
        resource_id: str,
        module_id: str,
        engagement_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Tracks student engagement with a specific resource.
        
        Args:
            student_id: ID of the student
            resource_id: ID of the resource
            module_id: ID of the module containing the resource
            engagement_data: Dictionary with engagement metrics (viewed, duration, test_score, etc.)
            
        Returns:
            Status dictionary
        """
        try:
            student_oid = ObjectId(student_id)
            module_oid = ObjectId(module_id)
        except Exception:
            return {
                "status": "error",
                "message": "Invalid student or module ID"
            }

        engagement_doc = {
            "student_id": student_oid,
            "resource_id": resource_id,
            "module_id": module_oid,
            "viewed": engagement_data.get("viewed", False),
            "view_duration_seconds": engagement_data.get("view_duration_seconds", 0),
            "completion_percentage": engagement_data.get("completion_percentage", 0),
            "test_score": engagement_data.get("test_score"),  # Can be None if no test yet
            "test_attempts": engagement_data.get("test_attempts", 0),
            "rating": engagement_data.get("rating"),
            "helpful": engagement_data.get("helpful"),
            "notes": engagement_data.get("notes", ""),
            "updated_at": datetime.utcnow(),
        }

        # Use upsert to create or update
        result = self.db.resource_engagement.update_one(
            {
                "student_id": student_oid,
                "resource_id": resource_id,
                "module_id": module_oid
            },
            {"$set": engagement_doc},
            upsert=True
        )

        return {
            "status": "success",
            "message": "Resource engagement tracked",
            "action": "upserted" if result.upserted_id else "updated"
        }

    def get_module_resource_analytics(
        self,
        classroom_id: str,
        module_id: str
    ) -> Dict[str, Any]:
        """
        Gets analytics for resources in a module across all students.
        
        Args:
            classroom_id: ID of the classroom
            module_id: ID of the module
            
        Returns:
            Dictionary with resource analytics
        """
        try:
            classroom_oid = ObjectId(classroom_id)
            module_oid = ObjectId(module_id)
        except Exception:
            return {
                "status": "error",
                "message": "Invalid IDs"
            }

        # Get module
        module = self.db.learning_modules.find_one(
            {"_id": module_oid, "classroom_id": classroom_oid}
        )

        if not module:
            return {
                "status": "error",
                "message": "Module not found in classroom"
            }

        resources = module.get("resources", [])
        resource_analytics = []

        for resource in resources:
            resource_id = resource.get("id") or resource.get("resource_id")
            engagements = list(self.db.resource_engagement.find(
                {"resource_id": resource_id, "module_id": module_oid}
            ))

            if not engagements:
                analytics = {
                    "resource_id": resource_id,
                    "resource_title": resource.get("title", "Untitled"),
                    "resource_type": resource.get("resource_type", "unknown"),
                    "students_viewed": 0,
                    "students_completed": 0,
                    "average_score": 0,
                    "total_students": 0
                }
            else:
                viewed_count = sum(1 for e in engagements if e.get("viewed"))
                completed_count = sum(1 for e in engagements if e.get("completion_percentage", 0) >= 80)
                scores = [e.get("test_score") for e in engagements if e.get("test_score") is not None]
                avg_score = sum(scores) / len(scores) if scores else 0

                analytics = {
                    "resource_id": resource_id,
                    "resource_title": resource.get("title", "Untitled"),
                    "resource_type": resource.get("resource_type", "unknown"),
                    "students_viewed": viewed_count,
                    "students_completed": completed_count,
                    "average_score": round(avg_score, 2),
                    "total_students": len(engagements),
                    "engagement_rate": round((viewed_count / len(engagements) * 100), 2) if engagements else 0
                }

            resource_analytics.append(analytics)

        return {
            "status": "success",
            "module_id": str(module_oid),
            "module_name": module.get("name"),
            "resource_count": len(resources),
            "resource_analytics": resource_analytics
        }

    # ==================== Helper Methods ====================

    def _normalize_text_key(self, value: Any) -> str:
        """Normalizes text for stable matching and lookup."""
        text = str(value or "").strip().lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    def _tokenize_for_match(self, value: Any) -> List[str]:
        """Tokenizes text while dropping low-signal connector words."""
        stop_words = {
            "the",
            "and",
            "for",
            "with",
            "from",
            "into",
            "module",
            "unit",
            "chapter",
            "topic",
            "lesson",
            "part",
        }
        normalized = self._normalize_text_key(value)
        if not normalized:
            return []

        return [
            token
            for token in normalized.split(" ")
            if len(token) > 2 and token not in stop_words
        ]

    def _extract_syllabus_module_names(self, classroom: Dict[str, Any]) -> List[str]:
        """Extracts module-like names from classroom syllabus metadata."""
        module_names: List[str] = []
        seen = set()

        def add_module_name(candidate: Any):
            cleaned = re.sub(r"\s+", " ", str(candidate or "").strip(" .:-\n\t•"))
            if not cleaned:
                return
            if len(cleaned) < 4 or len(cleaned) > 90:
                return
            if len(cleaned.split()) > 10:
                return

            key = self._normalize_text_key(cleaned)
            if not key or key in seen:
                return

            seen.add(key)
            module_names.append(cleaned)

        # Prioritize explicit focus areas first.
        for focus_area in classroom.get("subject_focus_areas", []):
            add_module_name(focus_area)

        # Extract short heading-like lines from syllabus excerpt.
        curriculum_excerpt = (
            (classroom.get("curriculum_metadata") or {}).get("text_excerpt") or ""
        )

        skip_prefixes = (
            "learning outcome",
            "learning outcomes",
            "outcome",
            "outcomes",
            "assessment",
            "assessments",
            "reference",
            "references",
            "objective",
            "objectives",
            "contents",
            "syllabus",
        )

        for raw_line in curriculum_excerpt.splitlines():
            line = re.sub(r"\s+", " ", raw_line).strip()
            if not line:
                continue

            line = re.sub(r"^\d+[\)\.\-:]\s*", "", line)
            line = re.sub(
                r"^(module|unit|chapter)\s*\d+\s*[:\-]\s*",
                "",
                line,
                flags=re.IGNORECASE,
            )
            line = line.strip(" -•\t")

            if not line:
                continue
            if line.lower().startswith(skip_prefixes):
                continue

            alpha_count = sum(1 for character in line if character.isalpha())
            if alpha_count < 4:
                continue

            add_module_name(line)
            if len(module_names) >= 16:
                break

        return module_names

    def _match_skill_to_syllabus_module(
        self,
        skill: str,
        syllabus_modules: List[str],
    ) -> Optional[str]:
        """Matches a noisy skill label to the closest syllabus module name."""
        if not syllabus_modules:
            return None

        skill_key = self._normalize_text_key(skill)
        if not skill_key:
            return None

        # First pass: exact normalized name match.
        for module_name in syllabus_modules:
            if self._normalize_text_key(module_name) == skill_key:
                return module_name

        skill_tokens = set(self._tokenize_for_match(skill))
        best_module = None
        best_score = 0.0

        for module_name in syllabus_modules:
            module_key = self._normalize_text_key(module_name)
            module_tokens = set(self._tokenize_for_match(module_name))

            overlap = len(skill_tokens & module_tokens)
            token_score = overlap / max(1, len(skill_tokens))
            sequence_score = SequenceMatcher(None, skill_key, module_key).ratio()
            combined_score = max(token_score, sequence_score * 0.8)

            if combined_score > best_score:
                best_score = combined_score
                best_module = module_name

        if best_score >= 0.32:
            return best_module

        return None

    def _resource_to_assignment_dict(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        """Serializes a classroom resource for module assignment responses."""
        module_id = resource.get("module_id")
        return {
            "resource_id": resource.get("resource_id"),
            "title": resource.get("title", "Untitled Resource"),
            "description": resource.get("description", ""),
            "url": resource.get("url", ""),
            "resource_type": resource.get("resource_type", "article"),
            "skill": resource.get("skill", "General"),
            "module_id": str(module_id) if module_id else None,
            "module_name": resource.get("module_name"),
            "approval_status": resource.get("approval_status", "pending"),
            "source": resource.get("source", "ai"),
        }

    def _group_resources_by_skill(
        self,
        resources: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Groups resources by their skill field"""
        groups = {}
        for resource in resources:
            if not isinstance(resource, dict):
                continue

            # Only include approved resources
            if resource.get("approval_status") != "approved":
                continue

            skill = resource.get("skill", "General")
            if skill not in groups:
                groups[skill] = []

            groups[skill].append(resource)

        return groups

    def _generate_objectives_from_resources(
        self,
        skill: str,
        resources: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generates learning objectives from a list of resources"""
        objectives = [
            {
                "title": f"Understand {skill} concepts",
                "description": f"Learn fundamental concepts related to {skill}",
                "bloom_level": "comprehension"
            },
            {
                "title": f"Apply {skill} skills",
                "description": f"Apply what you've learned about {skill} in practical scenarios",
                "bloom_level": "application"
            }
        ]

        # Add more specific objectives if there are enough resources
        if len(resources) > 4:
            objectives.append({
                "title": f"Analyze {skill} problems",
                "description": f"Analyze complex problems using {skill} knowledge",
                "bloom_level": "analysis"
            })

        return objectives

    def _prepare_module_resources(
        self,
        resources: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Converts classroom resources to module resources format"""
        module_resources = []
        for idx, resource in enumerate(resources):
            module_resource = {
                "id": resource.get("resource_id", f"res_{idx}"),
                "title": resource.get("title", "Untitled"),
                "resource_type": resource.get("resource_type", "link"),
                "url": resource.get("url", ""),
                "description": resource.get("description", ""),
                "order": idx
            }
            module_resources.append(module_resource)

        return module_resources

    def _estimate_hours(
        self,
        resources: List[Dict[str, Any]]
    ) -> float:
        """Estimates module hours based on resource count and types"""
        base_hours = {
            "video": 0.5,
            "document": 0.25,
            "link": 0.2,
            "quiz": 0.15,
            "article": 0.3
        }

        total_hours = 0.0
        for resource in resources:
            resource_type = resource.get("resource_type", "link")
            hours = base_hours.get(resource_type, 0.25)
            total_hours += hours

        return round(total_hours, 1)

    def _estimate_difficulty(
        self,
        resources: List[Dict[str, Any]]
    ) -> str:
        """Estimates module difficulty based on resources"""
        # Simple heuristic: if many resources, likely more complex
        if len(resources) > 8:
            return "hard"
        elif len(resources) > 4:
            return "medium"
        else:
            return "easy"

    def _link_resources_to_module(
        self,
        classroom_oid: ObjectId,
        resources: List[Dict[str, Any]],
        module_id: str,
        module_name: Optional[str] = None,
    ) -> None:
        """Updates classroom resources to link them to the module"""
        resource_ids = [r.get("resource_id") for r in resources if r.get("resource_id")]

        if resource_ids:
            # Update each resource with proper array filter
            for resource_id in resource_ids:
                set_payload = {
                    "ai_resources.$[elem].module_id": module_id,
                }
                if module_name:
                    set_payload["ai_resources.$[elem].module_name"] = module_name

                self.db.classrooms.update_one(
                    {"_id": classroom_oid},
                    {
                        "$set": set_payload
                    },
                    array_filters=[{"elem.resource_id": resource_id}]
                )

    def _module_to_dict(self, module: Dict[str, Any]) -> Dict[str, Any]:
        """Converts a module document to a dictionary with string IDs"""
        return {
            "module_id": str(module.get("_id")),
            "classroom_id": str(module.get("classroom_id")),
            "name": module.get("name"),
            "subject": module.get("subject"),
            "description": module.get("description"),
            "order": module.get("order"),
            "status": module.get("status"),
            "objectives": module.get("objectives", []),
            "resources": module.get("resources", []),
            "assessments": module.get("assessments", []),
            "estimated_hours": module.get("estimated_hours", 0),
            "difficulty_level": module.get("difficulty_level", "medium"),
            "target_skills": module.get("target_skills", []),
            "created_date": module.get("created_date"),
            "updated_date": module.get("updated_date"),
            "published_date": module.get("published_date")
        }
