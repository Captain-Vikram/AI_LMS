from pydantic import BaseModel, Field
from typing import List

class UserParameters(BaseModel):
    """User parameters for generating a quiz"""
    primary_goal: str
    selected_skills: List[str]
    time_commitment: str
    career_path: str
    experience_level: str = "intermediate"
    num_questions: int = 10

class MCQQuestion(BaseModel):
    question: str = Field(description="The question text")
    options: List[str] = Field(description="List of possible answers")
    correct_answer: int = Field(description="Index of the correct answer (0-based)")
    explanation: str = Field(description="Explanation for why the correct answer is right")
    difficulty: str = Field(description="Difficulty level: 'beginner', 'intermediate', 'advanced'")


class QuizContent(BaseModel):
    questions: List[MCQQuestion] = Field(description="List of MCQ questions")