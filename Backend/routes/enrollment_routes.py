from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from database import get_db
from bson import ObjectId
from typing import List
import csv
import io

from services.enrollment_service import EnrollmentService
from services.rbac_service import RBACService
from functions.utils import get_current_user

router = APIRouter(prefix="/api/classroom", tags=["enrollment"])

# Student: Join classroom with enrollment code
@router.post("/{classroom_id}/enroll")
async def enroll_student(
    classroom_id: str,
    enrollment_code: str,
    current_user = Depends(get_current_user)
):
    """Enroll student in classroom using enrollment code"""
    db = get_db()
    enrollment_svc = EnrollmentService(db)

    try:
        result = enrollment_svc.enroll_student(
            current_user["user_id"],
            classroom_id,
            enrollment_code
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Teacher: Manually add student to classroom
@router.post("/{classroom_id}/members/add")
async def add_student_to_classroom(
    classroom_id: str,
    student_id: str,
    current_user = Depends(get_current_user)
):
    """Teacher adds student directly to classroom"""
    db = get_db()
    rbac = RBACService(db)

    if not rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom teacher can add students"
        )

    enrollment_svc = EnrollmentService(db)
    try:
        result = enrollment_svc.enroll_student(student_id, classroom_id)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Teacher: Bulk enroll students from CSV
@router.post("/{classroom_id}/members/bulk-upload")
async def bulk_upload_roster(
    classroom_id: str,
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    """Upload CSV to bulk enroll students"""
    db = get_db()
    rbac = RBACService(db)

    if not rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom teacher can upload roster"
        )

    content = await file.read()
    decoded = content.decode()
    reader = csv.DictReader(io.StringIO(decoded))
    
    student_emails = [row.get("email") or row.get("student_email") for row in reader]
    
    # Find user IDs by email
    students = db.users.find({"email": {"$in": student_emails}}, {"_id": 1})
    student_ids = [str(s["_id"]) for s in students]

    enrollment_svc = EnrollmentService(db)
    result = enrollment_svc.bulk_enroll_students(
        classroom_id,
        student_ids,
        current_user["user_id"]
    )

    return {
        "status": "upload_complete",
        "data": result
    }

# Teacher: Remove student from classroom
@router.delete("/{classroom_id}/members/{student_id}")
async def remove_student(
    classroom_id: str,
    student_id: str,
    current_user = Depends(get_current_user)
):
    """Remove a student from classroom"""
    db = get_db()
    rbac = RBACService(db)

    if not rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom teacher can remove students"
        )

    enrollment_svc = EnrollmentService(db)
    try:
        result = enrollment_svc.disenroll_student(student_id, classroom_id)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Get classroom roster
@router.get("/{classroom_id}/members")
async def get_classroom_roster(
    classroom_id: str,
    current_user = Depends(get_current_user)
):
    """Get classroom roster (member only)"""
    db = get_db()
    rbac = RBACService(db)

    if not rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )

    enrollment_svc = EnrollmentService(db)
    try:
        roster = enrollment_svc.get_classroom_roster(classroom_id)
        return {"status": "success", "data": roster}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Create student group
@router.post("/{classroom_id}/groups")
async def create_student_group(
    classroom_id: str,
    group_data: dict,
    current_user = Depends(get_current_user)
):
    """Create a student group (teacher only)"""
    db = get_db()
    rbac = RBACService(db)

    if not rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom teacher can create groups"
        )

    enrollment_svc = EnrollmentService(db)
    try:
        result = enrollment_svc.create_student_group(
            classroom_id,
            group_data.get("name"),
            group_data.get("description", ""),
            group_data.get("students", [])
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Add student to group
@router.post("/{classroom_id}/groups/{group_id}/members")
async def add_to_group(
    classroom_id: str,
    group_id: str,
    student_id: str,
    current_user = Depends(get_current_user)
):
    """Add student to a group"""
    db = get_db()
    rbac = RBACService(db)

    if not rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only classroom teacher can manage groups"
        )

    enrollment_svc = EnrollmentService(db)
    try:
        result = enrollment_svc.add_student_to_group(
            classroom_id,
            group_id,
            student_id
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/my/enrollments")
async def get_my_enrollments(current_user = Depends(get_current_user)):
    """Get current user's enrolled classrooms and membership progress."""
    db = get_db()
    enrollment_svc = EnrollmentService(db)

    try:
        data = enrollment_svc.get_student_enrollment_progress(current_user["user_id"])
        return {"status": "success", "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
