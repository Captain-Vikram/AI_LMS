from pydantic import BaseModel
from typing import List, Optional

class OnboardingData(BaseModel):
    # Goal Setting Data
    primaryGoal: Optional[str] = None
    timeCommitment: Optional[str] = None  # e.g., 'low', 'moderate', 'high'
    prioritySkills: Optional[List[str]] = None
    
    # Learning Style Data
    preferredStyle: Optional[str] = None
    learningPace: Optional[str] = None  # e.g., 'balanced', 'fast', 'thorough'
    preferredResources: Optional[List[str]] = None
    
    # Career Path Data
    careerPath: Optional[str] = None
    experienceLevel: Optional[str] = None  # e.g., 'beginner', 'intermediate', 'advanced'
    desiredCertifications: Optional[List[str]] = None