from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, status, Depends, Header
from datetime import datetime, timedelta
import hashlib
import jwt
from pymongo.errors import DuplicateKeyError
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError
from database import get_db
from models.user_models import UserRegistration, UserLogin
from jwt_config import settings
from functions.utils import get_current_user, normalize_user_role

router = APIRouter(prefix="/api/auth", tags=["auth"])


def decode_user_id_from_auth_header(authorization: str) -> str:
    """Extract and validate the current user id from a Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(
    user_id: str,
    email: str = None,
    role: str = None,
    institution_id: str = None,
    active_classroom_id: str = None,
    classroom_roles: dict = None,
):
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.utcnow() + expires_delta

    payload = {
        "sub": str(user_id),
        "user_id": str(user_id),
        "email": email,
        "role": role,
        "institution_id": institution_id,
        "active_classroom_id": active_classroom_id,
        "classroom_roles": classroom_roles or {},
        "exp": expire,
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _get_user_classroom_roles_map(user_id: str):
    db = get_db()
    try:
        from bson import ObjectId
        user = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return {}

    mapping = {}
    for m in user.get("classroom_memberships", []):
        cid = m.get("classroom_id")
        if cid:
            mapping[str(cid)] = m.get("role", "student")
    return mapping

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserRegistration):
    db = get_db()
    users_collection = db.users
    profiles_collection = db.user_profiles

    normalized_role = normalize_user_role(user.role if hasattr(user, 'role') else None)
    
    # Check if user already exists
    if users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create user data
    user_data = {
        "first_name": user.first_name,
        "last_name": user.last_name if hasattr(user, 'last_name') else None,
        "location": user.location if hasattr(user, 'location') else None,
        "role": normalized_role,
        "email": user.email,
        "password_hash": hash_password(user.password),
        "registration_date": datetime.utcnow(),
        "last_login": None,
        "status": "active",
        "onboarding_complete": False,
        "assessment_complete": False,
    }
    
    # Insert user and get the ID
    user_result = users_collection.insert_one(user_data)
    user_id = user_result.inserted_id
    
    # Create profile data if first_name is provided
    if hasattr(user, 'first_name') and user.first_name:
        profile_data = {
            "user_id": user_id,
            "first_name": user.first_name,
            "last_name": user.last_name if hasattr(user, 'last_name') else None,
            "location": user.location if hasattr(user, 'location') else None,
            "role": normalized_role,
        }
        profiles_collection.insert_one(profile_data)
    
    # Generate JWT token (include role + classroom roles)
    classroom_roles_map = _get_user_classroom_roles_map(user_id)
    access_token = create_access_token(
        user_id=str(user_id),
        email=user.email,
        role=normalized_role,
        institution_id=None,
        active_classroom_id=None,
        classroom_roles=classroom_roles_map,
    )
    
    return {
        "id": str(user_id), 
        "message": "User registered successfully",
        "token": access_token,
        "role": normalized_role,
        "onboarding_complete": False
    }

@router.post("/update-onboarding-status")
async def update_onboarding_status(
    status: dict,
    authorization: str = Header(None)
):
    # Check for the Authorization header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Extract the token
    token = authorization.split(" ")[1]
    
    try:
        # Decode the token to get user_id
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
            
        # Convert user_id string to ObjectId
        from bson import ObjectId
        user_id = ObjectId(user_id)
        
        # Update the user's onboarding status
        db = get_db()
        users_collection = db.users
        
        update_result = users_collection.update_one(
            {"_id": user_id},
            {"$set": {"onboarding_complete": status.get("onboarding_complete", True)}}
        )
        
        if update_result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Onboarding status updated successfully"}
        
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

@router.post("/login")
async def login(credentials: UserLogin):
    db = get_db()
    users_collection = db.users
    hashed_pw = hash_password(credentials.password)
    user = users_collection.find_one({"email": credentials.email, "password_hash": hashed_pw})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    normalized_role = normalize_user_role(user.get("role"))
    if user.get("role") != normalized_role:
        users_collection.update_one({"_id": user["_id"]}, {"$set": {"role": normalized_role}})
        user["role"] = normalized_role
    
    # Update the last_login timestamp
    current_login_time = datetime.utcnow()
    users_collection.update_one(
        {"_id": user["_id"]}, {"$set": {"last_login": current_login_time}}
    )

    # Track login events for weekly activity and streak analytics
    db.login_logs.insert_one({
        "user_id": user["_id"],
        "login_time": current_login_time,
    })
    
    # Generate JWT token (include role + classroom roles)
    classroom_roles_map = _get_user_classroom_roles_map(user["_id"]) or {}
    access_token = create_access_token(
        user_id=str(user["_id"]),
        email=user.get("email"),
        role=normalized_role,
        institution_id=user.get("institution_id"),
        active_classroom_id=None,
        classroom_roles=classroom_roles_map,
    )
    
    # Get onboarding status and assessment status
    onboarding_complete = user.get("onboarding_complete", False)
    assessment_complete = user.get("assessment_complete", False)
    
    return {
        "message": "User logged in successfully", 
        "user_id": str(user["_id"]),
        "token": access_token,
        "role": normalized_role,
        "onboarding_complete": onboarding_complete,
        "assessment_complete": assessment_complete
    }


@router.post("/set-active-classroom/{classroom_id}")
async def set_active_classroom(classroom_id: str, current_user = Depends(get_current_user)):
    """Set active classroom in a refreshed token for current user"""
    db = get_db()
    try:
        from bson import ObjectId
        class_obj = db.classrooms.find_one({"_id": ObjectId(classroom_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if not class_obj:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Check membership
    user_oid = ObjectId(current_user["user_id"])
    if not (user_oid == class_obj.get("teacher_id") or user_oid in class_obj.get("students", [])):
        raise HTTPException(status_code=403, detail="Not a member of this classroom")

    # Build new token
    classroom_roles_map = _get_user_classroom_roles_map(current_user["user_id"]) or {}
    new_token = create_access_token(
        user_id=current_user["user_id"],
        email=current_user.get("email"),
        role=current_user.get("role"),
        institution_id=current_user.get("institution_id"),
        active_classroom_id=classroom_id,
        classroom_roles=classroom_roles_map,
    )

    return {"access_token": new_token, "token_type": "bearer"}

@router.get("/user-profile")
async def get_user_profile(authorization: str = Header(None)):
    # Check for the Authorization header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Extract the token
    token = authorization.split(" ")[1]
    
    try:
        # Decode the token to get user_id
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
            
        # Convert user_id string to ObjectId
        user_id_obj = ObjectId(user_id)
        
        # Get the user data
        db = get_db()
        users_collection = db.users
        profiles_collection = db.user_profiles
        
        # First try to get from profiles collection for richer data
        user_profile = profiles_collection.find_one({"user_id": user_id_obj})
        
        # If no profile exists, get basic data from users collection
        if not user_profile:
            user = users_collection.find_one({"_id": user_id_obj})
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
                
            return {
                "id": user_id,
                "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "firstName": user.get("first_name"),
                "lastName": user.get("last_name"),
                "email": user.get("email"),
                "location": user.get("location"),
                "role": normalize_user_role(user.get("role")),
                "joinedDate": user.get("registration_date").strftime("%B %Y") if user.get("registration_date") else None,
                "lastActive": user.get("last_login").strftime("%Y-%m-%d %H:%M:%S") if user.get("last_login") else None,
                "onboardingComplete": user.get("onboarding_complete", False),
                "assessmentComplete": user.get("assessment_complete", False)
            }
        
        # Return enriched profile data
        user = users_collection.find_one({"_id": user_id_obj})
        
        return {
            "id": user_id,
            "name": f"{user_profile.get('first_name', '')} {user_profile.get('last_name', '')}".strip(),
            "firstName": user_profile.get("first_name"),
            "lastName": user_profile.get("last_name"),
            "email": user.get("email") if user else None,
            "location": user_profile.get("location"),
            "role": normalize_user_role(user_profile.get("role") if user_profile else user.get("role") if user else None),
            "bio": user_profile.get("bio"),
            "skills": user_profile.get("skills", []),
            "joinedDate": user.get("registration_date").strftime("%B %Y") if user and user.get("registration_date") else None,
            "lastActive": user.get("last_login").strftime("%Y-%m-%d %H:%M:%S") if user and user.get("last_login") else "Today",
            "onboardingComplete": user.get("onboarding_complete", False) if user else False,
            "assessmentComplete": user.get("assessment_complete", False) if user else False
        }
            
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve user data: {str(e)}")


@router.get("/user-status")
async def get_user_status(authorization: str = Header(None)):
    """Return backend-trusted onboarding/assessment completion status for the current user."""
    user_id = decode_user_id_from_auth_header(authorization)

    try:
        user_object_id = ObjectId(user_id)
    except InvalidId:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    try:
        db = get_db()
        user = db.users.find_one({"_id": user_object_id})

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        latest_assessment = db.skill_assessment_results.find_one(
            {"user_id": user_object_id},
            sort=[("timestamp", -1)],
        )

        last_assessment_date = None
        if latest_assessment and latest_assessment.get("timestamp"):
            last_assessment_date = latest_assessment["timestamp"].isoformat()

        return {
            "role": normalize_user_role(user.get("role")),
            "onboarding_complete": user.get("onboarding_complete", False),
            "assessment_complete": user.get("assessment_complete", False),
            "last_assessment_date": last_assessment_date,
        }
    except ServerSelectionTimeoutError:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable. Start MongoDB and verify MONGO_URI.",
        )
    except PyMongoError:
        raise HTTPException(status_code=503, detail="Database error while loading user status")
    
# Add this to your auth_routes.py file

@router.post("/update-assessment-status")
async def update_assessment_status(
    status: dict,
    authorization: str = Header(None)
):
    # Check for the Authorization header
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Extract the token
    token = authorization.split(" ")[1]
    
    try:
        # Decode the token to get user_id
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
            
        # Convert user_id string to ObjectId if needed
        from bson import ObjectId
        user_id = ObjectId(user_id)
        
        # Update the user's assessment status
        db = get_db()
        users_collection = db.users
        
        update_result = users_collection.update_one(
            {"_id": user_id},
            {"$set": {"assessment_complete": status.get("assessment_complete", True)}}
        )
        
        if update_result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
            
        return {"message": "Assessment status updated successfully"}
        
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    
@router.get("/login-activity")
async def get_login_activity(authorization: str = Header(None)):
    """Get user's login activity for the past week"""
    user_id = decode_user_id_from_auth_header(authorization)

    db = get_db()

    today = datetime.utcnow()
    past_week = today - timedelta(days=7)

    login_logs = list(db.login_logs.find({
        "user_id": ObjectId(user_id),
        "login_time": {"$gte": past_week}
    }).sort("login_time", -1))

    weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    response_order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    activity_by_day = {day: 0 for day in response_order}

    for log in login_logs:
        day_of_week = weekday_names[log["login_time"].weekday()]
        activity_by_day[day_of_week] += 1

    weekly_activity = []
    for day in response_order:
        percentage = min(100, activity_by_day[day] * 20)
        weekly_activity.append({
            "day": day,
            "count": activity_by_day[day],
            "percentage": percentage
        })

    return {"weekly_activity": weekly_activity}
    
    