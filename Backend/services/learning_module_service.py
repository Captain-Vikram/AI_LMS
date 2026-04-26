"""
Learning Module Service (Async Optimized)
Handles module creation, resource linking, and progress tracking
"""

import re
import asyncio
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

    async def auto_generate_modules_from_resources(
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
        classroom = await self.db.classrooms.find_one(
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

        existing_modules = await self.db.learning_modules.find({"classroom_id": classroom_oid}).to_list(None)
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
                    await self.db.learning_modules.update_one(
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

                await self._link_resources_to_module(
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

            result = await self.db.learning_modules.insert_one(module_doc)

            await self._link_resources_to_module(
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

    async def create_module(
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

        classroom_exists = await self.db.classrooms.find_one({"_id": classroom_oid}, {"_id": 1})
        if not classroom_exists:
            return {"status": "error", "message": "Classroom not found"}

        module_name = re.sub(r"\s+", " ", str(name).strip())
        module_key = self._normalize_text_key(module_name)
        existing_modules = await self.db.learning_modules.find(
            {"classroom_id": classroom_oid}, {"name": 1, "subject": 1}
        ).to_list(None)
        
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

        latest_module = await self.db.learning_modules.find_one(
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

        await self.db.learning_modules.insert_one(module_doc)

        return {
            "status": "success",
            "message": "Module created successfully",
            "module": self._module_to_dict(module_doc),
        }

    async def reorder_modules(
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

        modules = await self.db.learning_modules.find(
            {"classroom_id": classroom_oid, "_id": {"$in": module_oids}},
            {"_id": 1},
        ).to_list(None)

        if len(modules) != len(module_oids):
            return {
                "status": "error",
                "message": "One or more modules were not found in this classroom",
            }

        timestamp = datetime.utcnow()
        # Use bulk write for efficiency if possible, or sequential async updates
        for order_index, module_oid in enumerate(module_oids, start=1):
            await self.db.learning_modules.update_one(
                {"_id": module_oid, "classroom_id": classroom_oid},
                {"$set": {"order": order_index, "updated_date": timestamp}},
            )

        refreshed = await self.get_classroom_modules(classroom_id)
        return {
            "status": "success",
            "message": "Modules reordered successfully",
            "modules": refreshed.get("modules", []),
        }

    async def get_approved_resources_for_module_assignment(
        self,
        classroom_id: str,
    ) -> Dict[str, Any]:
        """Returns approved classroom resources grouped by syllabus-aligned module category."""
        try:
            classroom_oid = ObjectId(classroom_id)
        except Exception:
            return {"status": "error", "message": "Invalid classroom ID"}

        classroom = await self.db.classrooms.find_one(
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

    async def add_resources_to_module(
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

        module = await self.db.learning_modules.find_one(
            {"_id": module_oid, "classroom_id": classroom_oid}
        )
        if not module:
            return {"status": "error", "message": "Module not found in classroom"}

        classroom = await self.db.classrooms.find_one(
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
            await self.db.learning_modules.update_one(
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

        await self._link_resources_to_module(
            classroom_oid,
            valid_resources,
            module_id,
            module_name=module.get("name"),
        )

        refreshed_module = await self.db.learning_modules.find_one({"_id": module_oid, "classroom_id": classroom_oid})
        return {
            "status": "success",
            "message": "Resources assigned to module",
            "added_count": added_count,
            "skipped_count": max(0, len(valid_resources) - added_count),
            "missing_resource_ids": missing_resource_ids,
            "module": self._module_to_dict(refreshed_module) if refreshed_module else None,
        }

    async def remove_resource_from_module(
        self,
        classroom_id: str,
        module_id: str,
        resource_id: str,
    ) -> Dict[str, Any]:
        """Removes a resource from a learning module and unlinks it in the classroom."""
        try:
            classroom_oid = ObjectId(classroom_id)
            module_oid = ObjectId(module_id)
        except Exception:
            return {"status": "error", "message": "Invalid classroom or module ID"}

        module = await self.db.learning_modules.find_one(
            {"_id": module_oid, "classroom_id": classroom_oid}
        )
        if not module:
            return {"status": "error", "message": "Module not found in classroom"}

        resources = list(module.get("resources", []))
        new_resources = [
            r for r in resources 
            if (r.get("id") or r.get("resource_id")) != resource_id
        ]

        if len(new_resources) == len(resources):
            return {"status": "error", "message": "Resource not found in module"}

        # Re-order remaining resources
        for i, r in enumerate(new_resources):
            r["order"] = i

        await self.db.learning_modules.update_one(
            {"_id": module_oid, "classroom_id": classroom_oid},
            {
                "$set": {
                    "resources": new_resources,
                    "estimated_hours": self._estimate_hours(new_resources),
                    "difficulty_level": self._estimate_difficulty(new_resources),
                    "updated_date": datetime.utcnow(),
                }
            },
        )

        # Unlink in classroom document
        await self.db.classrooms.update_one(
            {"_id": classroom_oid},
            {
                "$set": {
                    "ai_resources.$[elem].module_id": None,
                    "ai_resources.$[elem].module_name": None
                }
            },
            array_filters=[{"elem.resource_id": resource_id}]
        )

        return {
            "status": "success",
            "message": "Resource removed from module",
            "resource_id": resource_id
        }


    async def delete_module(
        self,
        classroom_id: str,
        module_id: str,
    ) -> Dict[str, Any]:
        """Deletes a learning module and unlinks its resources from the classroom."""
        try:
            classroom_oid = ObjectId(classroom_id)
            module_oid = ObjectId(module_id)
        except Exception:
            return {"status": "error", "message": "Invalid classroom or module ID"}

        # Check if module exists
        module = await self.db.learning_modules.find_one(
            {"_id": module_oid, "classroom_id": classroom_oid}
        )
        if not module:
            return {"status": "error", "message": "Module not found in classroom"}

        # Delete the module
        delete_result = await self.db.learning_modules.delete_one(
            {"_id": module_oid, "classroom_id": classroom_oid}
        )

        if delete_result.deleted_count == 0:
            return {"status": "error", "message": "Failed to delete module"}

        # Unlink resources in the classroom document
        await self.db.classrooms.update_one(
            {"_id": classroom_oid},
            {
                "$set": {
                    "ai_resources.$[elem].module_id": None,
                    "ai_resources.$[elem].module_name": None
                }
            },
            array_filters=[{"elem.module_id": module_id}]
        )

        return {
            "status": "success",
            "message": "Module deleted successfully",
            "module_id": module_id
        }

    async def get_classroom_modules(
        self,
        classroom_id: str,
        status_filter: Optional[str] = None,
        include_progress: bool = False,
        student_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retrieves all modules for a classroom with optional progress tracking.
        Optimized with batch progress lookups.
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

        modules = await self.db.learning_modules.find(query).sort("order", 1).to_list(None)

        if not modules:
            return {
                "status": "success",
                "message": "No modules found",
                "modules": [],
                "total": 0
            }

        # Optimized Batch Progress Lookup
        student_progress_map = {}
        if include_progress and student_id:
            try:
                student_oid = ObjectId(student_id)
                module_ids = [m["_id"] for m in modules]
                
                # Fetch all engagements for this student in these modules in one query
                all_engagements = await self.db.resource_engagement.find({
                    "student_id": student_oid,
                    "module_id": {"$in": module_ids}
                }).to_list(None)
                
                # Group engagements by module_id
                engagements_by_module = {}
                for eng in all_engagements:
                    m_id = str(eng["module_id"])
                    engagements_by_module.setdefault(m_id, []).append(eng)
                
                # Pre-calculate progress for each module
                for module in modules:
                    m_id_str = str(module["_id"])
                    module_engagements = engagements_by_module.get(m_id_str, [])
                    student_progress_map[m_id_str] = self._calculate_module_progress_from_data(
                        module, module_engagements
                    )
            except Exception as e:
                print(f"Error pre-calculating batch progress: {e}")

        result_modules = []
        for module in modules:
            module_dict = self._module_to_dict(module)
            if include_progress and student_id:
                module_dict["student_progress"] = student_progress_map.get(
                    str(module["_id"]),
                    {
                        "module_id": str(module["_id"]),
                        "progress_percentage": 0,
                        "resources_completed": 0,
                        "total_resources": len(module.get("resources", [])),
                        "status": "not_started"
                    }
                )
            result_modules.append(module_dict)

        return {
            "status": "success",
            "message": f"Retrieved {len(result_modules)} modules",
            "modules": result_modules,
            "total": len(result_modules)
        }

    async def get_module_progress(
        self,
        student_id: ObjectId,
        module_id: ObjectId
    ) -> Dict[str, Any]:
        """
        Calculates student progress on a specific module based on resource tests.
        """
        module = await self.db.learning_modules.find_one({"_id": module_id})

        if not module:
            return {
                "module_id": str(module_id),
                "progress_percentage": 0,
                "resources_completed": 0,
                "total_resources": 0,
                "average_score": 0,
                "status": "not_started"
            }

        engagements = await self.db.resource_engagement.find({
            "student_id": student_id,
            "module_id": module_id,
        }).to_list(None)

        return self._calculate_module_progress_from_data(module, engagements)

    def _calculate_module_progress_from_data(
        self,
        module: Dict[str, Any],
        engagements: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Helper to calculate progress from pre-fetched data."""
        module_id = module["_id"]
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

    async def track_resource_engagement(
        self,
        student_id: str,
        resource_id: str,
        module_id: str,
        engagement_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Tracks student engagement with a specific resource."""
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
            "test_score": engagement_data.get("test_score"),
            "test_attempts": engagement_data.get("test_attempts", 0),
            "rating": engagement_data.get("rating"),
            "helpful": engagement_data.get("helpful"),
            "notes": engagement_data.get("notes", ""),
            "updated_at": datetime.utcnow(),
        }

        result = await self.db.resource_engagement.update_one(
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

    async def get_module_resource_analytics(
        self,
        classroom_id: str,
        module_id: str
    ) -> Dict[str, Any]:
        """Gets analytics for resources in a module across all students."""
        try:
            classroom_oid = ObjectId(classroom_id)
            module_oid = ObjectId(module_id)
        except Exception:
            return {"status": "error", "message": "Invalid IDs"}

        module = await self.db.learning_modules.find_one(
            {"_id": module_oid, "classroom_id": classroom_oid}
        )

        if not module:
            return {"status": "error", "message": "Module not found in classroom"}

        resources = module.get("resources", [])
        resource_analytics = []

        # Optimized: Fetch ALL engagements for this module once
        all_module_engagements = await self.db.resource_engagement.find(
            {"module_id": module_oid}
        ).to_list(None)
        
        # Group by resource_id
        engagements_by_resource = {}
        for eng in all_module_engagements:
            r_id = str(eng["resource_id"])
            engagements_by_resource.setdefault(r_id, []).append(eng)

        for resource in resources:
            resource_id = str(resource.get("id") or resource.get("resource_id"))
            engagements = engagements_by_resource.get(resource_id, [])

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
                    "engagement_rate": round((viewed_count / len(engagements) * 100), 2)
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
        """Standardizes text for robust comparison and matching."""
        text = str(value or "").strip().lower()
        # Remove special characters and collapse whitespace
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    def _tokenize_for_match(self, value: Any) -> List[str]:
        """Tokenizes text while dropping low-signal connector words."""
        stop_words = {
            "the", "and", "for", "with", "from", "into", "module", "unit",
            "chapter", "topic", "lesson", "part", "intro", "introduction",
            "basics", "basics of", "fundamental", "fundamentals", "advanced",
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
        """Extracts module-like names from classroom syllabus metadata with improved structural awareness."""
        module_names: List[str] = []
        seen = set()

        def add_module_name(candidate: Any):
            cleaned = re.sub(r"\s+", " ", str(candidate or "").strip(" .:-\n\t•"))
            if not cleaned or len(cleaned) < 4 or len(cleaned) > 100 or len(cleaned.split()) > 12:
                return

            key = self._normalize_text_key(cleaned)
            if not key or key in seen:
                return

            seen.add(key)
            module_names.append(cleaned)

        # 1. Subject focus areas (usually teacher-defined)
        for focus_area in classroom.get("subject_focus_areas", []):
            add_module_name(focus_area)

        # 2. Extract from curriculum metadata (populated during onboarding)
        curriculum_excerpt = (classroom.get("curriculum_metadata") or {}).get("text_excerpt") or ""
        skip_prefixes = (
            "learning outcome", "learning outcomes", "outcome", "outcomes",
            "assessment", "assessments", "reference", "references",
            "objective", "objectives", "contents", "syllabus", "page",
        )
        
        # Look for structural module/unit markers
        structure_patterns = [
            r"^(?:module|unit|chapter|lesson|section|week)\s*\d+\s*[:\-.]\s*(.*)$",
            r"^\d+[\)\.\-:]\s*(.*)$",
        ]

        for raw_line in curriculum_excerpt.splitlines():
            line = raw_line.strip()
            if not line:
                continue

            matched = False
            for pattern in structure_patterns:
                m = re.match(pattern, line, flags=re.IGNORECASE)
                if m:
                    extracted = m.group(1).strip()
                    if extracted:
                        add_module_name(extracted)
                        matched = True
                        break
            
            if matched:
                continue

            # Fallback for clean lines that aren't outcomes/objectives
            line_cleaned = re.sub(r"^\d+[\)\.\-:]\s*", "", line)
            line_cleaned = re.sub(r"^(module|unit|chapter|week)\s*\d+\s*[:\-]\s*", "", line_cleaned, flags=re.IGNORECASE).strip(" -•\t")

            if not line_cleaned or line_cleaned.lower().startswith(skip_prefixes):
                continue

            # Ensure it's not a fragmented line or a long paragraph
            alpha_count = sum(1 for character in line_cleaned if character.isalpha())
            if alpha_count < 5 or len(line_cleaned.split()) > 12:
                continue

            add_module_name(line_cleaned)
            if len(module_names) >= 20:
                break

        return module_names

    def _match_skill_to_syllabus_module(
        self,
        skill: str,
        syllabus_modules: List[str],
    ) -> Optional[str]:
        """Matches a noisy skill label to the closest syllabus module name with hybrid similarity and higher precision."""
        if not syllabus_modules:
            return None

        skill_key = self._normalize_text_key(skill)
        if not skill_key:
            return None

        # 1. Exact normalized match
        for module_name in syllabus_modules:
            if self._normalize_text_key(module_name) == skill_key:
                return module_name

        # 2. Fuzzy Token & Sequence similarity
        skill_tokens = set(self._tokenize_for_match(skill))
        best_module = None
        best_score = 0.0

        for module_name in syllabus_modules:
            module_key = self._normalize_text_key(module_name)
            module_tokens = set(self._tokenize_for_match(module_name))

            # Token overlap (Jaccard-like)
            overlap = len(skill_tokens & module_tokens)
            token_score = overlap / max(1, len(skill_tokens))
            
            # Sequence ratio
            sequence_score = SequenceMatcher(None, skill_key, module_key).ratio()
            
            # Hybrid score: prioritize token overlap for technical modules
            combined_score = max(token_score * 1.05, sequence_score * 0.9)

            if combined_score > best_score:
                best_score = combined_score
                best_module = module_name

        # Threshold increased to 0.45 for better reliability
        return best_module if best_score >= 0.45 else None

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
            if not isinstance(resource, dict) or resource.get("approval_status") != "approved":
                continue

            skill = resource.get("skill", "General")
            groups.setdefault(skill, []).append(resource)
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
            module_resources.append({
                "id": resource.get("resource_id", f"res_{idx}"),
                "title": resource.get("title", "Untitled"),
                "resource_type": resource.get("resource_type", "link"),
                "url": resource.get("url", ""),
                "description": resource.get("description", ""),
                "order": idx
            })
        return module_resources

    def _estimate_hours(
        self,
        resources: List[Dict[str, Any]]
    ) -> float:
        """Estimates module hours based on resource count and types"""
        base_hours = {"video": 0.5, "document": 0.25, "link": 0.2, "quiz": 0.15, "article": 0.3}
        total_hours = sum(base_hours.get(r.get("resource_type", "link"), 0.25) for r in resources)
        return round(total_hours, 1)

    def _estimate_difficulty(
        self,
        resources: List[Dict[str, Any]]
    ) -> str:
        """Estimates module difficulty based on resources"""
        if len(resources) > 8: return "hard"
        if len(resources) > 4: return "medium"
        return "easy"

    async def _link_resources_to_module(
        self,
        classroom_oid: ObjectId,
        resources: List[Dict[str, Any]],
        module_id: str,
        module_name: Optional[str] = None,
    ) -> None:
        """Updates classroom resources to link them to the module"""
        resource_ids = [r.get("resource_id") for r in resources if r.get("resource_id")]
        if resource_ids:
            for resource_id in resource_ids:
                set_payload = {"ai_resources.$[elem].module_id": module_id}
                if module_name:
                    set_payload["ai_resources.$[elem].module_name"] = module_name

                await self.db.classrooms.update_one(
                    {"_id": classroom_oid},
                    {"$set": set_payload},
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
