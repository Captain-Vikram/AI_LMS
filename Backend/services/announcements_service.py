from bson import ObjectId
from datetime import datetime
from typing import Dict, List

class AnnouncementsService:
    def __init__(self, db):
        self.db = db

    def _materialize_query(
        self,
        query_result,
        sort_field: str = None,
        direction: int = -1,
        limit: int = None,
    ) -> List[Dict]:
        """Normalize cursor/list query results for both runtime and unit-test mocks."""
        if isinstance(query_result, list):
            items = list(query_result)
            if sort_field:
                items.sort(
                    key=lambda row: row.get(sort_field) or datetime.min,
                    reverse=direction == -1,
                )
            if limit is not None:
                items = items[:limit]
            return items

        cursor = query_result
        if sort_field:
            cursor = cursor.sort(sort_field, direction)
        if limit is not None:
            cursor = cursor.limit(limit)
        return list(cursor)

    def create_announcement(
        self,
        classroom_id: str,
        teacher_id: str,
        title: str,
        content: str,
        target_groups: List[str] = None,
        scheduled_date: datetime = None
    ) -> Dict:
        """Create a new announcement"""

        announcement = {
            "classroom_id": ObjectId(classroom_id),
            "teacher_id": ObjectId(teacher_id),
            "title": title,
            "content": content,
            "status": "published" if not scheduled_date else "scheduled",
            "target_groups": [ObjectId(g) for g in (target_groups or [])],
            "created_date": datetime.utcnow(),
            "updated_date": datetime.utcnow(),
            "scheduled_publish_date": scheduled_date,
            "views": 0,
            "viewed_by": []
        }

        result = self.db.announcements.insert_one(announcement)

        return {
            "announcement_id": str(result.inserted_id),
            "classroom_id": classroom_id,
            "status": "created"
        }

    def get_classroom_announcements(
        self,
        classroom_id: str,
        student_id: str = None,
        limit: int = 10
    ) -> List[Dict]:
        """Get published announcements for classroom"""

        classroom_oid = ObjectId(classroom_id)
        student_oid = ObjectId(student_id) if student_id else None

        announcements = self._materialize_query(
            self.db.announcements.find(
                {
                    "classroom_id": classroom_oid,
                    "status": "published"
                }
            ),
            sort_field="created_date",
            direction=-1,
            limit=limit,
        )

        result = []
        for ann in announcements:
            # Check if student is in target groups (if any)
            if ann.get("target_groups") and student_oid:
                classroom = self.db.classrooms.find_one(
                    {"_id": classroom_oid},
                    {"student_groups": 1}
                )
                student_in_group = any(
                    student_oid in group.get("students", [])
                    for group in classroom.get("student_groups", []) if any(tg["$oid"] if isinstance(tg, dict) else tg == group["_id"] for tg in ann.get("target_groups", []))
                ) if classroom else False
                if not student_in_group:
                    continue

            result.append({
                "announcement_id": str(ann["_id"]),
                "title": ann["title"],
                "content": ann["content"],
                "created_by": str(ann.get("teacher_id")),
                "created_date": ann.get("created_date").isoformat()
                if isinstance(ann.get("created_date"), datetime)
                else ann.get("created_date"),
                "views": ann.get("views", 0)
            })

        return result

    def mark_announcement_viewed(
        self,
        announcement_id: str,
        student_id: str
    ) -> Dict:
        """Mark announcement as viewed by student"""

        ann_oid = ObjectId(announcement_id)
        student_oid = ObjectId(student_id)

        self.db.announcements.update_one(
            {"_id": ann_oid},
            {
                "$inc": {"views": 1},
                "$addToSet": {"viewed_by": student_oid}
            }
        )

        return {"status": "marked_viewed"}

    def update_announcement(
        self,
        announcement_id: str,
        title: str = None,
        content: str = None,
        target_groups: List[str] = None
    ) -> Dict:
        """Update announcement"""

        ann_oid = ObjectId(announcement_id)
        update_dict = {"updated_date": datetime.utcnow()}

        if title:
            update_dict["title"] = title
        if content:
            update_dict["content"] = content
        if target_groups is not None:
            update_dict["target_groups"] = [ObjectId(g) for g in target_groups]

        result = self.db.announcements.update_one(
            {"_id": ann_oid},
            {"$set": update_dict}
        )

        if result.matched_count == 0:
            raise ValueError("Announcement not found")

        return {"status": "updated"}

    def delete_announcement(self, announcement_id: str) -> Dict:
        """Soft delete (archive) announcement"""

        ann_oid = ObjectId(announcement_id)

        self.db.announcements.update_one(
            {"_id": ann_oid},
            {"$set": {"status": "archived"}}
        )

        return {"status": "deleted"}
