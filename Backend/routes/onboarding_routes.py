from fastapi import APIRouter, HTTPException, Header, status, Depends
from datetime import datetime, timedelta
from bson import ObjectId
from models.onboarding_models import OnboardingData
from database import get_db
import jwt
from jwt_config import settings


router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

# Helper to get user ID from JWT token
async def get_current_user_id(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/save")
async def save_onboarding_data(onboarding_data: OnboardingData, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    
    # Save data to multiple collections according to schema
    
    # 1. Update UserPreferences
    preferences_data = {
        "user_id": ObjectId(user_id),
        "learning_style": onboarding_data.preferredStyle,
        "learning_pace": onboarding_data.learningPace,
        "preferred_resources": onboarding_data.preferredResources,
        "time_commitment": onboarding_data.timeCommitment,
        "updated_at": datetime.utcnow()
    }
    
    # Use upsert to create if not exists or update if exists
    db.user_preferences.update_one(
        {"user_id": ObjectId(user_id)},
        {"$set": preferences_data},
        upsert=True
    )
    
    # 2. Create/Update UserGoals
    if onboarding_data.primaryGoal:
        goal_data = {
            "user_id": ObjectId(user_id),
            "goal_title": onboarding_data.primaryGoal,
            "target_date": datetime.utcnow() + timedelta(days=90),  # default 3 months goal
            "status": "active",
            "created_at": datetime.utcnow()
        }
        db.user_goals.insert_one(goal_data)
    
    # 3. Update UserProfile with career-related info
    career_data = {
        "career_path": onboarding_data.careerPath,
        "experience_level": onboarding_data.experienceLevel,
        "desired_certifications": onboarding_data.desiredCertifications
    }
    
    db.user_profiles.update_one(
        {"user_id": ObjectId(user_id)},
        {"$set": career_data}
    )
    
    # 4. Save priority skills to user_skills collection
    if onboarding_data.prioritySkills and len(onboarding_data.prioritySkills) > 0:
        # First, remove existing skills to avoid duplicates
        db.user_skills.delete_many({"user_id": ObjectId(user_id)})
        
        # Insert each priority skill as a separate record
        current_time = datetime.utcnow()
        skill_documents = []
        
        for skill_id in onboarding_data.prioritySkills:
            skill_document = {
                "user_id": ObjectId(user_id),
                "skill_id": skill_id,
                "experience_level": onboarding_data.experienceLevel or "beginner",
                "proficiency": 0,  # Initial proficiency level
                "status": "in_progress",
                "created_at": current_time,
                "updated_at": current_time,
                "last_practiced": None
            }
            skill_documents.append(skill_document)
        
        if skill_documents:
            db.user_skills.insert_many(skill_documents)
    
    # 5. Mark onboarding as complete in user record
    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"onboarding_complete": True}}
    )
    
    return {"message": "Onboarding data saved successfully"}

@router.get("/status")
async def get_onboarding_status(user_id: str = Depends(get_current_user_id)):
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"onboarding_complete": user.get("onboarding_complete", False)}

@router.get("/user-skills")
async def get_user_skills(user_id: str = Depends(get_current_user_id)):
    """Retrieve a user's skills"""
    db = get_db()
    
    # Find user skills
    skills_cursor = db.user_skills.find({"user_id": ObjectId(user_id)})
    skills = []
    
    # Convert ObjectId to string for JSON response
    for skill in skills_cursor:
        skill["_id"] = str(skill["_id"])
        skill["user_id"] = str(skill["user_id"])
        skills.append(skill)
    
    return skills