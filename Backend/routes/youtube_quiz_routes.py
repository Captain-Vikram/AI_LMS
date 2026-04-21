"""YouTube quiz endpoints for strict resource progression."""

from datetime import datetime, timedelta
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, HttpUrl

from database_async import get_db
from functions.youtube_quiz_functions import YouTubeQuizGenerator, extract_video_id
from models.activity_feed import ActivityType
from models.quiz_attempt import QuestionType, QuizAttempt, QuizQuestion

load_dotenv(override=True)

router = APIRouter(
    prefix="/api/youtube-quiz",
    tags=["youtube-quiz"],
    responses={404: {"description": "Not found"}},
)


class GenerateQuizRequest(BaseModel):
    """Request to generate a quiz for a resource"""
    youtube_url: str = Field(..., description="YouTube video URL")
    resource_id: str = Field(..., description="Resource ID from database")
    module_id: str = Field("standalone", description="Module ID from database")
    classroom_id: str = Field("standalone", description="Classroom ID from database")
    student_id: str = Field(..., description="Student ID requesting this quiz")
    pathway_quiz_prompt: Optional[str] = Field(
        None,
        description="Optional pathway stage quiz prompt to guide generated questions",
    )


class SubmitQuizRequest(BaseModel):
    """Request to submit quiz answers"""
    quiz_attempt_id: str = Field(..., description="ID of the quiz attempt")
    student_id: str = Field(..., description="ID of the student submitting")
    answers: List[Dict[str, str]] = Field(
        ...,
        description="List of {question_id, answer} pairs"
    )


class QuizFeedback(BaseModel):
    """Feedback after quiz submission"""
    score_obtained: int
    total_points: int
    score_percentage: float
    passed: bool
    ai_feedback: str
    correct_answers: List[Dict[str, Any]]
    progress_update: Dict[str, Any]


def get_quiz_generator():
    """Get the quiz generator instance"""
    api_token = os.getenv("LMSTUDIO_API_TOKEN") or os.getenv("LMSTUDIO_API_KEY")
    return YouTubeQuizGenerator(api_token)


def _to_object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def _resource_id(resource: Dict[str, Any]) -> str:
    return str(resource.get("id") or resource.get("resource_id") or "").strip()


def _normalize_resource_url(raw_url: Any) -> str:
    if isinstance(raw_url, list):
        for item in raw_url:
            if isinstance(item, str) and item.strip():
                return item.strip()
        return ""

    text = str(raw_url or "").strip()
    if not text:
        return ""

    # Handle legacy list-like string payloads such as ['https://...'].
    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text.replace("'", '"'))
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, str) and item.strip():
                        return item.strip()
        except Exception:
            pass

    text = text.replace("\\u0026", "&")
    matched = re.search(r"https?://[^\s'\"]+", text)
    if matched:
        return matched.group(0).strip()

    return text.strip("'\"")


def _sorted_module_resources(module: Dict[str, Any]) -> List[Dict[str, Any]]:
    resources = [item for item in module.get("resources", []) if isinstance(item, dict)]
    return sorted(resources, key=lambda item: int(item.get("order", 0) or 0))


def _resolve_module_resource(
    module: Dict[str, Any],
    resource_id: str,
) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, Any]], int]:
    ordered_resources = _sorted_module_resources(module)
    target_index = -1
    target_resource: Optional[Dict[str, Any]] = None

    for index, resource in enumerate(ordered_resources):
        if _resource_id(resource) == resource_id:
            target_index = index
            target_resource = resource
            break

    return target_resource, ordered_resources, target_index


async def _require_previous_resource_completion(
    student_id: str,
    module_id: str,
    ordered_resources: List[Dict[str, Any]],
    target_index: int,
) -> None:
    if target_index <= 0:
        return

    previous_resource_id = _resource_id(ordered_resources[target_index - 1])
    if not previous_resource_id:
        return

    db = get_db()
    previous_progress = await db.student_progress.find_one(
        {
            "student_id": student_id,
            "module_id": module_id,
            "resource_id": previous_resource_id,
        }
    )

    if not previous_progress or int(previous_progress.get("passed_tests_count", 0) or 0) < 2:
        raise HTTPException(
            status_code=403,
            detail="Resource locked. Complete the previous resource (2 passing quizzes) first.",
        )


def _normalize_quiz_questions(raw_questions: List[Dict[str, Any]]) -> List[QuizQuestion]:
    questions: List[QuizQuestion] = []
    for item in raw_questions:
        question_text = str(item.get("question") or item.get("question_text") or "").strip()
        if not question_text:
            continue

        options = item.get("options")
        option_values = [str(value) for value in options] if isinstance(options, list) and options else None
        correct_answer = item.get("correct_answer")

        if isinstance(correct_answer, int):
            correct_value = str(correct_answer)
        elif correct_answer is None:
            correct_value = ""
        else:
            correct_value = str(correct_answer).strip()

        try:
            points = int(item.get("points", 10) or 10)
        except Exception:
            points = 10

        question_type = QuestionType.MCQ if option_values else QuestionType.SHORT_ANSWER
        questions.append(
            QuizQuestion(
                type=question_type,
                question_text=question_text,
                options=option_values,
                correct_answer=correct_value,
                points=max(points, 1),
            )
        )

    return questions


async def _count_existing_attempts(student_id: str, resource_id: str) -> int:
    student_candidates: List[Any] = [student_id]
    resource_candidates: List[Any] = [resource_id]

    student_oid = _to_object_id(student_id)
    resource_oid = _to_object_id(resource_id)
    if student_oid:
        student_candidates.append(student_oid)
    if resource_oid:
        resource_candidates.append(resource_oid)

    db = get_db()
    return await db.quiz_attempts.count_documents(
        {
            "student_id": {"$in": student_candidates},
            "resource_id": {"$in": resource_candidates},
        }
    )


def _normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _normalize_quiz_attempt_doc_for_model(quiz_doc: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(quiz_doc or {})

    # Mongo stores _id as ObjectId, but the Pydantic model expects alias _id as str.
    if normalized.get("_id") is not None:
        normalized["_id"] = str(normalized["_id"])

    for field in ("resource_id", "student_id", "classroom_id", "module_id"):
        if normalized.get(field) is not None:
            normalized[field] = str(normalized[field])

    return normalized


def _is_answer_correct(question: QuizQuestion, student_answer: str) -> bool:
    student_normalized = _normalize_text(student_answer)
    correct_value = str(question.correct_answer or "").strip()

    if question.options:
        if correct_value.isdigit():
            correct_index = int(correct_value)
            if 0 <= correct_index < len(question.options):
                correct_option = _normalize_text(question.options[correct_index])
                return student_normalized in {correct_value, correct_option}
        return student_normalized == _normalize_text(correct_value)

    return student_normalized == _normalize_text(correct_value)


def _next_resource_id(module: Dict[str, Any], current_resource_id: str) -> Optional[str]:
    ordered_resources = _sorted_module_resources(module)
    for index, resource in enumerate(ordered_resources):
        if _resource_id(resource) == current_resource_id:
            if index + 1 < len(ordered_resources):
                return _resource_id(ordered_resources[index + 1])
            return None
    return None


@router.post("/generate", response_model=Dict[str, Any])
async def generate_quiz(request: GenerateQuizRequest) -> Dict[str, Any]:
    """
    Generate a new, unique quiz for a resource.
    Creates a QuizAttempt record in MongoDB and returns the quiz.
    """
    try:
        db = get_db()
        classroom_id = str(request.classroom_id or "").strip() or "standalone"
        module_id = str(request.module_id or "").strip() or "standalone"
        is_pathway = classroom_id == "standalone" or module_id == "standalone"
        
        if not is_pathway:
            classroom_oid = _to_object_id(classroom_id)
            module_oid = _to_object_id(module_id)

            if not classroom_oid or not module_oid:
                raise HTTPException(status_code=400, detail="Invalid classroom or module id")

            classroom = await db.classrooms.find_one({"_id": classroom_oid})
            if not classroom:
                raise HTTPException(status_code=404, detail="Classroom not found")

            module = await db.learning_modules.find_one({"_id": module_oid, "classroom_id": classroom_oid})
            if not module:
                raise HTTPException(status_code=404, detail="Module not found")

            module_resource, ordered_resources, target_index = _resolve_module_resource(
                module,
                request.resource_id,
            )
            if not module_resource:
                raise HTTPException(status_code=404, detail="Resource not found")

            await _require_previous_resource_completion(
                student_id=request.student_id,
                module_id=str(module["_id"]),
                ordered_resources=ordered_resources,
                target_index=target_index,
            )

        normalized_youtube_url = _normalize_resource_url(request.youtube_url)
        if not normalized_youtube_url:
            raise HTTPException(status_code=400, detail="Missing youtube_url for this resource")

        if not extract_video_id(normalized_youtube_url):
            raise HTTPException(status_code=400, detail="Invalid YouTube URL for this resource")

        # Generate a fresh quiz for each attempt.
        quiz_gen = get_quiz_generator()
        quiz_content = quiz_gen.generate_quiz_from_video_url(
            video_url=normalized_youtube_url,
            num_questions=5,
            difficulty="intermediate",
            languages=["en"],
            assessment_context=request.pathway_quiz_prompt,
        )

        questions = _normalize_quiz_questions(quiz_content.get("questions", []))
        if not questions:
            raise HTTPException(status_code=500, detail="Failed to generate quiz questions")

        total_points = sum(question.points for question in questions)
        existing_attempts = int(
            await _count_existing_attempts(request.student_id, request.resource_id) or 0
        )
        new_quiz_oid = ObjectId()

        quiz_attempt = QuizAttempt(
            _id=str(new_quiz_oid),
            resource_id=str(request.resource_id),
            student_id=str(request.student_id),
            classroom_id=classroom_id,
            module_id=module_id,
            questions=questions,
            total_points=total_points,
            started_at=datetime.utcnow(),
            attempt_number=existing_attempts + 1,
        )

        # Save to database
        quiz_dict = quiz_attempt.model_dump(by_alias=True)
        quiz_dict["_id"] = new_quiz_oid
        result = await db.quiz_attempts.insert_one(quiz_dict)

        # Return quiz to student (without correct answers)
        return {
            "quiz_attempt_id": str(result.inserted_id),
            "questions": [
                {
                    "id": q.id,
                    "type": q.type.value,
                    "question_text": q.question_text,
                    "options": q.options,
                    "points": q.points,
                }
                for q in questions
            ],
            "total_points": total_points,
            "time_limit_minutes": None,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating quiz: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error generating quiz: {str(e)}"
        )


@router.post("/submit", response_model=QuizFeedback)
async def submit_quiz(request: SubmitQuizRequest) -> QuizFeedback:
    """
    Submit quiz answers.
    Grades the quiz, updates StudentProgress, and unlocks next resource if applicable.
    """
    try:
        db = get_db()
        quiz_attempt_oid = _to_object_id(request.quiz_attempt_id)
        quiz_attempt_filter: Dict[str, Any] = (
            {"_id": quiz_attempt_oid} if quiz_attempt_oid else {"_id": request.quiz_attempt_id}
        )
        quiz_doc = await db.quiz_attempts.find_one(quiz_attempt_filter)

        if not quiz_doc:
            raise HTTPException(status_code=404, detail="Quiz attempt not found")

        if quiz_doc.get("submitted_at"):
            raise HTTPException(status_code=400, detail="Quiz attempt already submitted")

        quiz_attempt_id = quiz_doc.get("_id")

        # Grade the quiz
        quiz_attempt = QuizAttempt(**_normalize_quiz_attempt_doc_for_model(quiz_doc))
        score_obtained = 0
        correct_answers_list = []

        for answer in request.answers:
            question_id = answer["question_id"]
            student_answer = str(answer["answer"])

            # Find the question
            question = next((q for q in quiz_attempt.questions if q.id == question_id), None)
            if not question:
                continue

            # Check if correct
            is_correct = _is_answer_correct(question, student_answer)
            if is_correct:
                score_obtained += question.points

            # Store the answer in the quiz
            question.student_answer = student_answer
            question.is_correct = is_correct

            # Add to correct answers response
            correct_answers_list.append({
                "question_id": question_id,
                "question_text": question.question_text,
                "your_answer": student_answer,
                "correct_answer": question.correct_answer,
                "is_correct": is_correct,
                "points": question.points if is_correct else 0,
            })

        # Calculate results
        score_percentage = (
            score_obtained / quiz_attempt.total_points if quiz_attempt.total_points else 0.0
        )
        passed = score_percentage >= 0.80

        # Generate AI feedback
        ai_feedback = generate_quiz_feedback(
            score_percentage,
            passed,
            correct_answers_list,
        )

        # Update quiz attempt in database
        await db.quiz_attempts.update_one(
            {"_id": quiz_attempt_id},
            {
                "$set": {
                    "submitted_at": datetime.utcnow(),
                    "score_obtained": score_obtained,
                    "score_percentage": score_percentage,
                    "passed": passed,
                    "ai_feedback": ai_feedback,
                    "questions": [q.model_dump(by_alias=True) for q in quiz_attempt.questions],
                    "duration_seconds": (datetime.utcnow() - quiz_attempt.started_at).total_seconds(),
                }
            }
        )

        # Update StudentProgress
        progress = await db.student_progress.find_one({
            "student_id": request.student_id,
            "module_id": quiz_attempt.module_id,
            "resource_id": quiz_attempt.resource_id
        })

        now = datetime.utcnow()
        if not progress:
            progress = {
                "student_id": request.student_id,
                "classroom_id": quiz_attempt.classroom_id,
                "module_id": quiz_attempt.module_id,
                "resource_id": quiz_attempt.resource_id,
                "is_unlocked": True,
                "unlocked_at": now,
                "tests_taken": 1,
                "passed_tests_count": 1 if passed else 0,
                "failed_tests_count": 0 if passed else 1,
                "highest_score": score_percentage,
                "last_test_date": now,
                "single_turn_chat_history": [],
                "created_at": now,
                "updated_at": now,
            }
            result = await db.student_progress.insert_one(progress)
            progress["_id"] = result.inserted_id
        else:
            passed_count = int(progress.get("passed_tests_count", 0) or 0)
            failed_count = int(progress.get("failed_tests_count", 0) or 0)
            highest_score = float(progress.get("highest_score", 0) or 0)

            if passed:
                passed_count += 1
            else:
                failed_count += 1

            highest_score = max(highest_score, score_percentage)

            await db.student_progress.update_one(
                {"_id": progress["_id"]},
                {
                    "$set": {
                        "tests_taken": progress.get("tests_taken", 0) + 1,
                        "passed_tests_count": passed_count,
                        "failed_tests_count": failed_count,
                        "highest_score": highest_score,
                        "last_test_date": now,
                        "updated_at": now,
                        "is_unlocked": True,
                    }
                }
            )

        updated_progress = await db.student_progress.find_one({"_id": progress["_id"]}) or progress
        passed_tests_count = int(updated_progress.get("passed_tests_count", 0) or 0)

        # Check if student should unlock next resource
        progress_update = {
            "passed_tests_count": passed_tests_count,
            "highest_score": max(float(updated_progress.get("highest_score", 0) or 0), score_percentage),
            "is_unlocked": False,
            "message": "",
            "unlocked_resource_id": None,
        }

        module_doc = None
        module_oid = _to_object_id(quiz_attempt.module_id)
        if module_oid:
            module_doc = await db.learning_modules.find_one({"_id": module_oid})

        # If this quiz belongs to a standalone pathway (frontend uses "standalone"
        # for classroom/module when running outside the classroom flow), update
        # the student_pathway_progress document so the pathway tracker reflects
        # passed tests and stage completion.
        try:
            if str(quiz_attempt.classroom_id) == "standalone" or str(quiz_attempt.module_id) == "standalone":
                path_progress = await db.student_pathway_progress.find_one({
                    "student_id": request.student_id,
                    "stage_progress.resources": {"$elemMatch": {"resource_id": quiz_attempt.resource_id}}
                })

                if path_progress:
                    stage_list = path_progress.get("stage_progress", [])
                    target_stage_index = None

                    for s in stage_list:
                        for r in s.get("resources", []):
                            if r.get("resource_id") == quiz_attempt.resource_id:
                                # update resource counters
                                r["tests_taken"] = int(r.get("tests_taken", 0)) + 1
                                if passed:
                                    r["passed_tests_count"] = int(r.get("passed_tests_count", 0)) + 1
                                target_stage_index = s.get("stage_index")
                                break
                        if target_stage_index is not None:
                            break

                    path_update = {
                        "stage_progress": stage_list,
                        "updated_at": datetime.utcnow(),
                    }

                    if passed:
                        today = now.date()
                        last_test_at = path_progress.get("last_test_at")
                        last_test_date = None
                        if isinstance(last_test_at, datetime):
                            last_test_date = last_test_at.date()
                        elif isinstance(last_test_at, str):
                            try:
                                last_test_date = datetime.fromisoformat(last_test_at).date()
                            except ValueError:
                                last_test_date = None

                        current_streak = int(path_progress.get("current_streak", 0) or 0)
                        if last_test_date == today:
                            updated_streak = max(current_streak, 1)
                        elif last_test_date == (today - timedelta(days=1)):
                            updated_streak = current_streak + 1
                        else:
                            updated_streak = 1

                        path_update["current_streak"] = updated_streak
                        path_update["last_test_at"] = now

                    # Persist the updated stage list back to DB
                    await db.student_pathway_progress.update_one(
                        {"_id": path_progress["_id"]},
                        {"$set": path_update}
                    )

                    # Check if the stage is now fully passed (all resources have >=2 passes)
                    if target_stage_index is not None:
                        stage_tracker = next((s for s in stage_list if s.get("stage_index") == target_stage_index), None)
                        if stage_tracker:
                            all_passed = all(int(r.get("passed_tests_count", 0)) >= 2 for r in stage_tracker.get("resources", []))
                            if all_passed:
                                # mark stage completed and unlock next
                                stage_tracker["status"] = "completed"
                                next_idx = target_stage_index + 1
                                for s in stage_list:
                                    if s.get("stage_index") == next_idx:
                                        s["status"] = "in-progress"
                                        break

                                await db.student_pathway_progress.update_one(
                                    {"_id": path_progress["_id"]},
                                    {"$set": path_update}
                                )

                                progress_update["is_unlocked"] = True
                                progress_update["unlocked_resource_id"] = None
                                progress_update["message"] = "Test passed! Stage completed and Next Stage Unlocked!"

                                await log_activity(
                                    classroom_id=quiz_attempt.classroom_id,
                                    action_type=ActivityType.RESOURCE_UNLOCKED,
                                    student_id=request.student_id,
                                    resource_id=None,
                                    details={"source_resource_id": quiz_attempt.resource_id},
                                )
                            else:
                                progress_update["message"] = "Test recorded for pathway resource. Keep going to master it."
        except Exception as e:
            # Do not block quiz submission on pathway update failure; log and continue
            print(f"Warning: failed updating pathway progress: {e}")

        if passed and passed_tests_count >= 2:
            progress_update["is_unlocked"] = True

            next_resource_id = _next_resource_id(module_doc, quiz_attempt.resource_id) if module_doc else None
            progress_update["unlocked_resource_id"] = next_resource_id

            if next_resource_id:
                next_progress = await db.student_progress.find_one(
                    {
                        "student_id": request.student_id,
                        "module_id": quiz_attempt.module_id,
                        "resource_id": next_resource_id,
                    }
                )
                if next_progress:
                    await db.student_progress.update_one(
                        {"_id": next_progress["_id"]},
                        {
                            "$set": {
                                "is_unlocked": True,
                                "unlocked_at": now,
                                "updated_at": now,
                            }
                        },
                    )
                else:
                    await db.student_progress.insert_one(
                        {
                            "student_id": request.student_id,
                            "classroom_id": quiz_attempt.classroom_id,
                            "module_id": quiz_attempt.module_id,
                            "resource_id": next_resource_id,
                            "is_unlocked": True,
                            "unlocked_at": now,
                            "tests_taken": 0,
                            "passed_tests_count": 0,
                            "failed_tests_count": 0,
                            "highest_score": None,
                            "last_test_date": None,
                            "single_turn_chat_history": [],
                            "created_at": now,
                            "updated_at": now,
                        }
                    )

                progress_update["message"] = (
                    "Great work. You completed this resource and unlocked the next one."
                )

                await log_activity(
                    classroom_id=quiz_attempt.classroom_id,
                    action_type=ActivityType.RESOURCE_UNLOCKED,
                    student_id=request.student_id,
                    resource_id=next_resource_id,
                    details={"source_resource_id": quiz_attempt.resource_id},
                )
            else:
                progress_update["message"] = (
                    "Great work. You completed this resource and finished the module resource chain."
                )
        else:
            remaining = max(0, 2 - passed_tests_count)
            if passed:
                progress_update["message"] = (
                    f"You passed this quiz. You need {remaining} more passing test(s) "
                    "to unlock the next resource."
                )
            else:
                progress_update["message"] = (
                    "This attempt did not reach 80%. Review the lesson and try again."
                )

        # Log activity
        await log_activity(
            classroom_id=quiz_attempt.classroom_id,
            action_type=ActivityType.QUIZ_PASSED if passed else ActivityType.QUIZ_FAILED,
            student_id=request.student_id,
            resource_id=quiz_attempt.resource_id,
            quiz_attempt_id=str(quiz_attempt_id),
            details={
                "score": round(score_percentage * 100, 2),
                "attempt_number": int(quiz_attempt.attempt_number or 1),
            },
        )

        return QuizFeedback(
            score_obtained=score_obtained,
            total_points=quiz_attempt.total_points,
            score_percentage=score_percentage,
            passed=passed,
            ai_feedback=ai_feedback,
            correct_answers=correct_answers_list,
            progress_update=progress_update,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting quiz: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error submitting quiz: {str(e)}"
        )


def generate_quiz_feedback(score_percentage: float, passed: bool, answers: List[Dict]) -> str:
    """Generate AI feedback for quiz performance"""
    feedback_lines = []
    
    if passed:
        feedback_lines.append(f"Great job! You scored {score_percentage*100:.1f}%.")
    else:
        feedback_lines.append(f"You scored {score_percentage*100:.1f}%. You need at least 80% to pass.")
    
    # Analyze which questions were missed
    missed = [a for a in answers if not a["is_correct"]]
    if missed:
        feedback_lines.append(f"\nYou missed {len(missed)} question(s):")
        for answer in missed[:3]:  # Show first 3
            feedback_lines.append(
                f"  • {answer['question_text'][:60]}... "
                f"(You answered: '{answer['your_answer']}', Correct: '{answer['correct_answer']}')"
            )
    
    feedback_lines.append("\nReview the video to strengthen your understanding of the material.")
    
    return "\n".join(feedback_lines)


async def log_activity(
    classroom_id: str,
    action_type: ActivityType,
    student_id: str,
    resource_id: Optional[str] = None,
    quiz_attempt_id: Optional[str] = None,
    details: Optional[Dict] = None
):
    """Log an activity to the activity feed"""
    try:
        activity = {
            "classroom_id": classroom_id,
            "action_type": action_type.value,
            "student_id": student_id,
            "action_performed_by_id": student_id,
            "resource_id": resource_id,
            "quiz_attempt_id": quiz_attempt_id,
            "details": details or {},
            "created_at": datetime.utcnow(),
        }
        db = get_db()
        await db.activity_feed.insert_one(activity)
    except Exception as e:
        print(f"Error logging activity: {e}")
