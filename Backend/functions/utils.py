import jwt
import httpx
import re
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


async def get_current_user(
    authorization: str = Header(None),
    token: Optional[str] = None
):
    """FastAPI dependency: returns current user info by verifying Clerk token"""
    final_token = None
    if authorization and authorization.startswith("Bearer "):
        final_token = authorization.split(" ")[1]
    elif token:
        final_token = token

    if not final_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_db()

    payload = await verify_clerk_token(final_token)
    clerk_id = payload.get("sub")
    
    def _extract_email_from_payload(p: Dict[str, Any]) -> Optional[str]:
        # Common claim names
        email = p.get("email") or p.get("preferred_email") or p.get("email_address")
        if email:
            return email

        # Common list shapes
        for key in ("emails", "email_addresses", "email_addresses_verified", "email_addresses_list"):
            items = p.get(key)
            if isinstance(items, list) and items:
                first = items[0]
                if isinstance(first, str):
                    return first
                if isinstance(first, dict):
                    for fld in ("email", "value", "address"):
                        if first.get(fld):
                            return first.get(fld)
        return None

    # Find user by clerk_id
    user = await db.users.find_one({"clerk_id": clerk_id})
    if user:
        try:
            uid = str(user.get("_id"))
            print(f"[auth] found user by clerk_id: {uid} email={user.get('email')}")
        except Exception:
            pass
    
    if not user:
        # Try to extract an email from the token payload (many shapes possible)
        email = _extract_email_from_payload(payload)
        if email:
            # Case-insensitive match to avoid capitalization mismatches
            user = await db.users.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
            if user:
                # Update existing user with clerk_id
                await db.users.update_one({"_id": user["_id"]}, {"$set": {"clerk_id": clerk_id}})
                try:
                    print(f"[auth] mapped clerk_id {clerk_id} to existing user {str(user.get('_id'))} email={user.get('email')}")
                except Exception:
                    pass

        # If still not found, optionally call Clerk API (requires CLERK_API_KEY env var)
        if not user:
            CLERK_API_KEY = os.getenv("CLERK_API_KEY")
            if CLERK_API_KEY:
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        headers = {"Authorization": f"Bearer {CLERK_API_KEY}"}
                        resp = await client.get(f"https://api.clerk.dev/v1/users/{clerk_id}", headers=headers)
                        if resp.status_code == 200:
                            data = resp.json()
                            # Try multiple places for an email in Clerk user object
                            clerk_email = data.get("email") or data.get("primary_email_address")
                            if not clerk_email:
                                eaddrs = data.get("email_addresses") or []
                                if eaddrs and isinstance(eaddrs, list):
                                    first = eaddrs[0]
                                    if isinstance(first, dict):
                                        clerk_email = first.get("email") or first.get("email_address") or first.get("address")
                            if clerk_email:
                                user = await db.users.find_one({"email": {"$regex": f"^{re.escape(clerk_email)}$", "$options": "i"}})
                                if user:
                                    await db.users.update_one({"_id": user["_id"]}, {"$set": {"clerk_id": clerk_id}})
                                    try:
                                        print(f"[auth] Clerk API matched email {clerk_email} -> user {str(user.get('_id'))}; set clerk_id {clerk_id}")
                                    except Exception:
                                        pass
                except Exception as e:
                    print(f"Clerk API fetch error: {e}")
        
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
            try:
                print(f"[auth] created NEW user {str(result.inserted_id)} email={new_user_data.get('email')}")
            except Exception:
                pass

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
