import jwt
import httpx
from fastapi import Header, HTTPException
from bson import ObjectId
from typing import Iterable, List, Optional, Dict, Any
from datetime import datetime
import os

try:
    from jwt_config import settings
    from database_async import get_db
except ModuleNotFoundError:
    # Supports imports when modules are referenced via Backend.* package paths.
    from Backend.jwt_config import settings
    from Backend.database_async import get_db

# Clerk configuration
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")

_jwks_cache: Dict[str, Any] = None

async def fetch_jwks():
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    
    if not CLERK_JWKS_URL:
        raise HTTPException(status_code=500, detail="CLERK_JWKS_URL environment variable is not set")
        
    async with httpx.AsyncClient() as client:
        response = await client.get(CLERK_JWKS_URL)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch JWKS from Clerk")
        _jwks_cache = response.json()
        return _jwks_cache

async def verify_clerk_token(token: str) -> Dict[str, Any]:
    """Verify a Clerk JWT and return the payload."""
    try:
        jwks = await fetch_jwks()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        public_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                from jwt import algorithms
                public_key = algorithms.RSAAlgorithm.from_jwk(key)
                break
        
        if not public_key:
            raise HTTPException(status_code=401, detail="Invalid token header (kid not found)")

        payload = jwt.decode(
            token, 
            public_key, 
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        return payload
    except jwt.PyJWTError as e:
        print(f"JWT Verification Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    except Exception as e:
        print(f"Authentication Error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during authentication")

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
    """FastAPI dependency: returns current user info by verifying Clerk token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ")[1]
    payload = await verify_clerk_token(token)
    
    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    db = get_db()
    
    # Find user by clerk_id
    user = await db.users.find_one({"clerk_id": clerk_id})
    
    if not user:
        # Check if user exists by email as a fallback/migration
        email = payload.get("email")
        if email:
            user = await db.users.find_one({"email": email})
            if user:
                # Update existing user with clerk_id
                await db.users.update_one({"_id": user["_id"]}, {"$set": {"clerk_id": clerk_id}})
        
        if not user:
            # Create new user record from Clerk data
            new_user_data = {
                "clerk_id": clerk_id,
                "email": payload.get("email"),
                "first_name": payload.get("given_name", "User"),
                "last_name": payload.get("family_name", ""),
                "role": "student", # Default role
                "registration_date": datetime.utcnow(),
                "onboarding_complete": False,
                "assessment_complete": False,
                "status": "active"
            }
            result = await db.users.insert_one(new_user_data)
            user = await db.users.find_one({"_id": result.inserted_id})

    roles = derive_user_roles(user)
    primary_role = get_primary_role(roles)

    return {
        "user_id": str(user["_id"]),
        "clerk_id": clerk_id,
        "email": user.get("email"),
        "role": primary_role,
        "roles": roles,
        "classroom_memberships": user.get("classroom_memberships", []),
    }


def get_user_classroom_roles(user_doc: dict):
    """Return mapping of classroom_id->role from a user document or payload"""
    mapping = {}
    for m in user_doc.get("classroom_memberships", []):
        cid = m.get("classroom_id") or m.get("classroom_id_str") or str(m.get("classroom_id"))
        if cid:
            mapping[str(cid)] = m.get("role", "student")
    return mapping


def get_user_display_name(user_doc: Optional[dict]) -> str:
    """Resolve a display name from a user document, checking various fields."""
    if not user_doc:
        return "Unknown"

    # 1. Top-level 'name'
    name = user_doc.get("name")
    if name:
        return str(name).strip()

    # 2. Nested 'profile.name'
    profile = user_doc.get("profile")
    if isinstance(profile, dict):
        p_name = profile.get("name")
        if p_name:
            return str(p_name).strip()

    # 3. first_name + last_name
    first = user_doc.get("first_name")
    last = user_doc.get("last_name")
    if first or last:
        res = f"{str(first or '').strip()} {str(last or '').strip()}".strip()
        if res:
            return res

    # 4. Email prefix as fallback
    email = user_doc.get("email")
    if email and "@" in str(email):
        return str(email).split("@")[0]

    return "Unknown"
