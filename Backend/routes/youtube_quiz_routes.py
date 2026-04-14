from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, HttpUrl
import os
from dotenv import load_dotenv
import uuid

from functions.youtube_quiz_functions import YouTubeQuizGenerator, extract_video_id, get_transcript, extract_core_topics

# Ensure environment variables are loaded
load_dotenv(override=True)

router = APIRouter(
    prefix="/api/youtube-quiz",
    tags=["youtube-quiz"],
    responses={404: {"description": "Not found"}},
)

# Cache for storing generated quizzes (in a production app, use a proper cache like Redis)
youtube_quiz_cache = {}


class YouTubeQuizRequest(BaseModel):
    """Request model for generating a quiz from a YouTube video"""
    video_url: HttpUrl
    num_questions: int = 5
    difficulty: str = "intermediate"
    languages: List[str] = ["en"]


class YouTubeTopicsRequest(BaseModel):
    """Request model for extracting core topics from a YouTube video"""
    video_url: HttpUrl
    languages: List[str] = ["en"]
    model_name: str = "auto"
    include_transcript: bool = False


class QuizSubmission(BaseModel):
    """User's quiz submission with answers"""
    quiz_id: str
    user_answers: List[int]


def get_quiz_generator():
    """Dependency to get the quiz generator"""
    api_token = os.getenv("LMSTUDIO_API_TOKEN") or os.getenv("LMSTUDIO_API_KEY")
    return YouTubeQuizGenerator(api_token)


@router.post("/generate", response_model=Dict[str, Any])
async def generate_youtube_quiz(
        params: YouTubeQuizRequest,
        background_tasks: BackgroundTasks,
        quiz_gen=Depends(get_quiz_generator)
):
    """
    Generate a quiz based on a YouTube video
    """
    try:
        # Generate a unique ID for this quiz
        quiz_id = str(uuid.uuid4())

        # Extract video_id first as a quick validation
        video_id = extract_video_id(str(params.video_url))
        if not video_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid YouTube URL"
            )

        # Start quiz generation
        quiz_content = quiz_gen.generate_quiz_from_video_url(
            video_url=str(params.video_url),
            num_questions=params.num_questions,
            difficulty=params.difficulty,
            languages=params.languages
        )

        # Add the quiz ID to the content
        quiz_content["quiz_id"] = quiz_id

        # Store the quiz with correct answers in cache
        youtube_quiz_cache[quiz_id] = quiz_content

        # Create a user-facing version without correct answers
        user_quiz = {
            "quiz_id": quiz_id,
            "video_id": quiz_content["video_id"],
            "video_url": quiz_content["video_url"],
            "questions": [
                {
                    "question": q["question"],
                    "options": q["options"],
                    "difficulty": q.get("difficulty", params.difficulty)
                }
                for q in quiz_content["questions"]
            ]
        }

        return user_quiz

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate quiz: {str(e)}"
        )


@router.post("/submit", response_model=Dict[str, Any])
async def submit_youtube_quiz(submission: QuizSubmission):
    """
    Submit answers for a YouTube video quiz and get results
    """
    # Retrieve the quiz from cache
    if submission.quiz_id not in youtube_quiz_cache:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quiz not found. It may have expired."
        )

    quiz_content = youtube_quiz_cache[submission.quiz_id]

    # Validate submission
    if len(submission.user_answers) != len(quiz_content["questions"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number of answers doesn't match number of questions"
        )

    # Score the quiz
    total_questions = len(quiz_content["questions"])
    correct_count = 0
    question_feedback = []

    for i, (answer, question) in enumerate(zip(submission.user_answers, quiz_content["questions"])):
        is_correct = answer == question["correct_answer"]
        if is_correct:
            correct_count += 1

        question_feedback.append({
            "question_index": i,
            "is_correct": is_correct,
            "correct_answer": question["correct_answer"],
            "explanation": question["explanation"]
        })

    score_percentage = (correct_count / total_questions) * 100 if total_questions > 0 else 0

    # Determine knowledge level for this video content
    if score_percentage >= 80:
        knowledge_level = "advanced"
    elif score_percentage >= 50:
        knowledge_level = "intermediate"
    else:
        knowledge_level = "beginner"

    # Construct the response
    response = {
        "quiz_id": submission.quiz_id,
        "video_id": quiz_content["video_id"],
        "video_url": quiz_content["video_url"],
        "score": {
            "correct": correct_count,
            "total": total_questions,
            "percentage": score_percentage
        },
        "knowledge_level": knowledge_level,
        "question_feedback": question_feedback
    }

    # In a production app, you'd probably want to clean up the cache eventually
    # background_tasks.add_task(lambda: youtube_quiz_cache.pop(submission.quiz_id, None))

    return response


@router.get("/status/{quiz_id}")
async def get_quiz_status(quiz_id: str):
    """
    Check if a quiz exists in the cache
    """
    if quiz_id in youtube_quiz_cache:
        return {"status": "available", "quiz_id": quiz_id}
    else:
        return {"status": "not_found", "quiz_id": quiz_id}


# New route for core topics extraction
@router.post("/topics", response_model=Dict[str, Any])
async def extract_youtube_topics(
        params: YouTubeTopicsRequest,
        quiz_gen=Depends(get_quiz_generator)
):
    """
    Extract core topics with timestamp ranges from a YouTube video
    """
    try:
        # Extract video_id first as a quick validation
        video_id = extract_video_id(str(params.video_url))
        if not video_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid YouTube URL"
            )

        # Get transcript
        transcriptions = get_transcript(video_id, params.languages)

        # Extract core topics with timestamp ranges
        result = quiz_gen.extract_topics_from_transcript(
            transcriptions=transcriptions,
            model_name=params.model_name
        )

        # Build response
        response = {
            "success": True,
            "video_id": video_id,
            "video_url": str(params.video_url),
            "core_topics": result.get("core_topics", []),
            "summary": result.get("summary", "")
        }

        # Include transcript if requested
        if params.include_transcript:
            response["transcriptions"] = transcriptions

        return response

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract topics: {str(e)}"
        )


@router.post("/comprehensive", response_model=Dict[str, Any])
async def generate_comprehensive_content(
        params: YouTubeQuizRequest,
        background_tasks: BackgroundTasks,
        quiz_gen=Depends(get_quiz_generator)
):
    """
    Generate comprehensive content from a YouTube video:
    - Transcript
    - Core topics with timestamp ranges
    - Brief summary
    - Quiz (optional)
    """
    try:
        # Generate a unique ID for this content
        content_id = str(uuid.uuid4())

        # Extract video_id first as a quick validation
        video_id = extract_video_id(str(params.video_url))
        if not video_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid YouTube URL"
            )

        # Get transcript
        transcriptions = get_transcript(video_id, params.languages)

        # Extract core topics with timestamp ranges
        topics_result = quiz_gen.extract_topics_from_transcript(
            transcriptions=transcriptions
        )

        # Generate quiz
        transcript_text = " ".join([entry["description"] for entry in transcriptions])
        quiz_result = quiz_gen.generate_quiz_from_transcript(
            transcript_text,
            num_questions=params.num_questions,
            difficulty=params.difficulty
        )

        # Combine everything
        result = {
            "video_id": video_id,
            "video_url": str(params.video_url),
            "transcriptions": transcriptions,
            "core_topics": topics_result.get("core_topics", []),
            "summary": topics_result.get("summary", ""),
            "questions": quiz_result.get("questions", [])
        }

        # Add to cache
        youtube_quiz_cache[content_id] = result

        # Create a user-facing version without quiz answers
        user_content = {
            "content_id": content_id,
            "video_id": video_id,
            "video_url": str(params.video_url),
            "core_topics": topics_result.get("core_topics", []),
            "summary": topics_result.get("summary", "")
        }

        # Add quiz without answers if it exists
        if "questions" in quiz_result:
            user_content["quiz"] = [
                {
                    "question": q["question"],
                    "options": q["options"],
                    "difficulty": q.get("difficulty", params.difficulty)
                }
                for q in quiz_result.get("questions", [])
            ]

        return user_content

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate comprehensive content: {str(e)}"
        )