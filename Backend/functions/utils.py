import jwt
from fastapi import Header, HTTPException
from bson import ObjectId
from typing import Iterable, List, Optional

try:
    from jwt_config import settings
    from database import get_db
except ModuleNotFoundError:
    # Supports imports when modules are referenced via Backend.* package paths.
    from Backend.jwt_config import settings
    from Backend.database import get_db


def normalize_user_role(raw_role: Optional[str]) -> str:
    role = (raw_role or "").strip().lower()
    if role in {"teacher", "student", "admin"}:
        return role

    if role in {"educator", "instructor", "faculty"}:
        return "teacher"

    if role in {"professional", "manager", "executive", "other"}:
        return "student"

    return "student"


def normalize_user_roles(raw_roles: Optional[Iterable[str]]) -> List[str]:
    if raw_roles is None:
        return []

    if isinstance(raw_roles, str):
        candidates = [raw_roles]
    else:
        candidates = list(raw_roles)

    normalized: List[str] = []
    for role in candidates:
        role_value = normalize_user_role(str(role))
        if role_value not in normalized:
            normalized.append(role_value)

    return normalized


def derive_user_roles(user_doc: dict) -> List[str]:
    roles = normalize_user_roles(user_doc.get("roles"))
    primary = normalize_user_role(user_doc.get("role"))

    if primary not in roles:
        roles.insert(0, primary)

    if not roles:
        roles = ["student"]

    return roles


def get_primary_role(roles: List[str]) -> str:
    priority = ["teacher", "admin", "student"]
    for role in priority:
        if role in roles:
            return role
    return roles[0] if roles else "student"


async def get_current_user(authorization: str = Header(None)):
    """FastAPI dependency: returns minimal current user info from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        db = get_db()
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        roles = derive_user_roles(user)
        primary_role = get_primary_role(roles)

        # Compose minimal user dict used by routes/services
        return {
            "user_id": str(user["_id"]),
            "email": user.get("email"),
            "role": primary_role,
            "roles": roles,
            "classroom_memberships": user.get("classroom_memberships", []),
        }

    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")


def get_user_classroom_roles(user_doc: dict):
    """Return mapping of classroom_id->role from a user document or payload"""
    mapping = {}
    for m in user_doc.get("classroom_memberships", []):
        cid = m.get("classroom_id") or m.get("classroom_id_str") or str(m.get("classroom_id"))
        if cid:
            mapping[str(cid)] = m.get("role", "student")
    return mapping
