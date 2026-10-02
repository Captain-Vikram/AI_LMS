"""Pydantic models for request/response validation"""

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class AnalysisRequest(BaseModel):
    """Request body for project analysis"""
    project_topic: Optional[str] = None
    problem_statement: Optional[str] = None
    custom_requirements: List[str] = Field(default_factory=list)


class FileInfo(BaseModel):
    """File information"""
    path: str
    content: str
    size: int
    extension: str


class ExecutiveSummary(BaseModel):
    """Executive summary of analysis"""
    description: str = ""
    problem_solved: str = ""
    overall_assessment: str = "Needs Improvement"


class RequirementItem(BaseModel):
    """Requirement mapping item"""
    requirement: str = ""
    implemented: str = "No"
    implementation_details: str = ""
    quality: str = "Poor"
    missing_elements: str = ""


class CodeQualityWeakness(BaseModel):
    """Code quality weakness"""
    issue: str = ""
    location: str = ""
    problem: str = ""
    impact: str = "Medium"


class CodeQuality(BaseModel):
    """Code quality assessment"""
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[CodeQualityWeakness] = Field(default_factory=list)


class Improvement(BaseModel):
    """Improvement suggestion"""
    title: str = ""
    location: str = ""
    current_code: str = ""
    problem: str = ""
    suggested_fix: str = ""
    priority: str = "Medium"
    effort_hours: Any = 0


class ArchitectureReview(BaseModel):
    """Architecture review"""
    patterns_used: List[str] = Field(default_factory=list)
    organization: str = ""
    scalability: str = ""
    maintainability: str = ""


class PerformanceSecurity(BaseModel):
    """Performance and security assessment"""
    performance_issues: List[str] = Field(default_factory=list)
    security_concerns: List[str] = Field(default_factory=list)


class Recommendations(BaseModel):
    """Prioritized recommendations"""
    high_priority: List[str] = Field(default_factory=list)
    medium_priority: List[str] = Field(default_factory=list)
    low_priority: List[str] = Field(default_factory=list)


class FinalVerdict(BaseModel):
    """Final verdict"""
    score: int = 0
    grade: str = "F"
    summary: str = ""
    next_steps: str = ""


class WhatUserBuilt(BaseModel):
    """What the user built vs expected"""
    successful: List[str] = Field(default_factory=list)
    missing: List[str] = Field(default_factory=list)
    incomplete: List[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    """Complete analysis response"""
    executive_summary: ExecutiveSummary = Field(default_factory=ExecutiveSummary)
    requirements_mapping: List[RequirementItem] = Field(default_factory=list)
    what_user_built: WhatUserBuilt = Field(default_factory=WhatUserBuilt)
    code_quality: CodeQuality = Field(default_factory=CodeQuality)
    improvements: List[Improvement] = Field(default_factory=list)
    architecture_review: ArchitectureReview = Field(default_factory=ArchitectureReview)
    performance_security: PerformanceSecurity = Field(default_factory=PerformanceSecurity)
    recommendations: Recommendations = Field(default_factory=Recommendations)
    final_verdict: FinalVerdict = Field(default_factory=FinalVerdict)
    file_statistics: dict = Field(default_factory=lambda: {"total_files": 0, "file_types": {}})
    error: Optional[str] = None
