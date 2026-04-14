from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status, Header
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from dotenv import load_dotenv
from bson import ObjectId
from datetime import datetime
import jwt
import os
import json
import functions.llm_adapter as genai
from functions.mcq_functions import create_quiz_generator, generate_quiz, score_quiz
from database import get_db
from jwt_config import settings

# Ensure environment variables are loaded
load_dotenv(override=True)

router = APIRouter(
    prefix="/api/quiz",
    tags=["quiz"],
    responses={404: {"description": "Not found"}},
)

quiz_cache = {}

# Define a class for quiz submission
class QuizSubmission(BaseModel):
    quiz_id: str
    user_answers: List[int]

class UserParameters(BaseModel):
    """User parameters for generating a quiz"""
    primary_goal: str
    selected_skills: List[str]
    time_commitment: str
    career_path: str
    experience_level: str = "intermediate"
    num_questions: int = 10

def get_quiz_generator():
    """Dependency to get the quiz generator"""
    api_token = os.getenv("LMSTUDIO_API_TOKEN") or os.getenv("LMSTUDIO_API_KEY") or ""
    return create_quiz_generator(api_token)

@router.post("/submit", response_model=Dict[str, Any])
async def submit_quiz(submission: QuizSubmission, authorization: str = Header(None)):
    """
    Submit answers for a generated quiz and get results with skill gap analysis
    """
    # Check authorization
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token format")

    # Get database connection
    db = get_db()

    global quiz_cache

    # Retrieve the quiz from cache or database
    quiz_content = None

    if submission.quiz_id in quiz_cache:
        quiz_content = quiz_cache[submission.quiz_id]
    else:
        # Try to get from database
        stored_quiz = db.quizzes.find_one({"quiz_id": submission.quiz_id})
        if stored_quiz:
            quiz_content = stored_quiz
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz not found. It may have expired."
            )

    # Validate submission
    if len(submission.user_answers) != len(quiz_content["questions"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number of answers doesn't match number of questions"
        )

    # Score the quiz
    result = score_quiz(submission.user_answers, quiz_content)
    print(result)

    # Generate skill gap analysis and learning recommendations using local LLM
    skill_level = result["assessed_level"]

    # Prepare prompt for local LLM
    llm_prompt = f"""
    Generate personalized skill gap analysis and learning recommendations for a user who has completed 
    a quiz with and answers '{result}'. 

    Format the response as a JSON object with:
    1. A 'recommendations' array with 3 items, each containing 'title' and 'type' fields
    2. A 'skill_gaps' object with 'overall' description and 'areas' array containing 2 skills with their assessment levels

    The format should match this structure:
    {{
      "recommendations": [
        {{"title": "COURSE_TITLE", "type": "course"}},
        {{"title": "WORKSHOP_TITLE", "type": "workshop"}},
        {{"title": "TUTORIAL_TITLE", "type": "tutorial"}}
      ],
      "skill_gaps": {{
        "overall": "OVERALL_ASSESSMENT",
        "areas": [
          {{"skill": "skill 1 based on the questions and answer one word only no bracket so that i can query in youtube directly", "level": "LEVEL_ASSESSMENT"}},
          {{"skill": "skill 2 based on the questions and answer one word only no bracket so that i can query in youtube directly", "level": "LEVEL_ASSESSMENT"}}
        ]
      }}
    }}
    """

    # Call local LLM API for generating recommendations and skill gaps
    try:
        llm_response = await call_local_llm_api(llm_prompt)
        print(f"Raw LLM response: {llm_response}")

        # Clean the response - try to extract just the JSON part
        # Sometimes the model returns explanatory text before or after the JSON
        import re
        json_match = re.search(r'(\{.*\})', llm_response, re.DOTALL)

        if json_match:
            json_str = json_match.group(1)
            # Try to parse the extracted JSON
            try:
                llm_data = json.loads(json_str)
                recommendations = llm_data["recommendations"]
                skill_gaps = llm_data["skill_gaps"]
            except json.JSONDecodeError:
                raise Exception("Extracted text is not valid JSON")
        else:
            raise Exception("No JSON-like structure found in the response")

    except Exception as e:
        print(f"Error calling local LLM API: {str(e)}")
        # Fallback to predefined JSON format if model generation fails
        example_json = """
        {
          "recommendations": [
            {
              "title": "Introduction to Data Science: A Beginner's Guide",
              "type": "course"
            },
            {
              "title": "Hands-on Data Visualization Workshop for Beginners",
              "type": "workshop"
            },
            {
              "title": "Python for Data Analysis: A Quick Start Tutorial",
              "type": "tutorial"
            }
          ],
          "skill_gaps": {
            "overall": "Based on your assessment, you are currently at a beginner level. Focus on building foundational knowledge in core areas of data science to progress.",
            "areas": [
              {
                "skill": "Data Analysis",
                "level": "Beginner: Requires foundational understanding of statistical concepts and data manipulation techniques."
              },
              {
                "skill": "Programming",
                "level": "Beginner: Requires understanding of basic programming concepts and ability to write simple scripts for data processing."
              }
            ]
          }
        }
        """

        # Modify the example JSON based on skill level
        if skill_level == "intermediate":
            example_json = example_json.replace("beginner level", "intermediate level")
            example_json = example_json.replace("Beginner:", "Intermediate:")
            example_json = example_json.replace("Introduction to Data Science", "Advanced Data Science Techniques")
            example_json = example_json.replace("for Beginners", "for Intermediate Users")
            example_json = example_json.replace("Quick Start", "Intermediate")
        elif skill_level == "advanced":
            example_json = example_json.replace("beginner level", "advanced level")
            example_json = example_json.replace("Beginner:", "Advanced:")
            example_json = example_json.replace("Introduction to Data Science", "Expert Data Science Applications")
            example_json = example_json.replace("for Beginners", "for Advanced Practitioners")
            example_json = example_json.replace("Quick Start", "Advanced")

        try:
            data = json.loads(example_json)
            recommendations = data["recommendations"]
            skill_gaps = data["skill_gaps"]
        except json.JSONDecodeError:
            # Ultimate fallback if even our JSON template is problematic
            if skill_level == "beginner":
                recommendations = [
                    {"title": "Fundamentals of Programming", "type": "course"},
                    {"title": "Introduction to Data Science", "type": "workshop"},
                    {"title": "Basic Statistical Concepts", "type": "tutorial"}
                ]
            elif skill_level == "intermediate":
                recommendations = [
                    {"title": "Machine Learning Algorithms", "type": "course"},
                    {"title": "SQL for Data Analysis", "type": "workshop"},
                    {"title": "Feature Engineering Techniques", "type": "tutorial"}
                ]
            else:  # advanced
                recommendations = [
                    {"title": "Advanced Deep Learning", "type": "course"},
                    {"title": "Large Scale Data Systems", "type": "workshop"},
                    {"title": "Research Methods in ML", "type": "tutorial"}
                ]

            skill_gaps = {
                "overall": "Based on your assessment, we've identified areas for improvement",
                "areas": [
                    {"skill": "Data Analysis",
                     "level": "needs improvement" if skill_level == "beginner" else "satisfactory"},
                    {"skill": "Programming",
                     "level": "satisfactory" if skill_level == "advanced" else "needs improvement"}
                ]
            }

    # Construct the response with skill gaps and recommendations
    response = {
        "score": result["score"],
        "assessed_level": skill_level,
        "question_feedback": result["question_feedback"],
        "skill_gaps": skill_gaps,
        "recommendations": recommendations
    }

    # Store the quiz results in the database
    try:
        # Create a document for quiz_results collection
        quiz_result_doc = {
            "user_id": ObjectId(user_id),
            "quiz_id": submission.quiz_id,
            "timestamp": datetime.utcnow(),
            "score": result["score"],
            "assessed_level": skill_level,
            "user_answers": submission.user_answers,
            "question_feedback": result["question_feedback"],
            "skill_gaps": response["skill_gaps"],
            "recommendations": recommendations
        }

        # Store in quiz_results collection
        db.skill_assessment_results.insert_one(quiz_result_doc)

        # Update user's assessment status
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"assessment_complete": True}}
        )

    except Exception as e:
        print(f"Error storing quiz results: {str(e)}")
        # Don't raise an exception here to allow the API to continue

    return response


# Helper function to call the local LLM API
async def call_local_llm_api(prompt: str):
    """
    Call local LM Studio inference to generate content based on the prompt.
    """
    try:
        # Configure local adapter for LM Studio.
        genai.configure(base_url=os.getenv("LMSTUDIO_URL"))

        # Initialize the model
        model = genai.GenerativeModel(os.getenv("LMSTUDIO_MODEL"))

        # Set generation config to increase likelihood of proper JSON output
        generation_config = {
            "temperature": 0.2,  # Lower temperature for more deterministic output
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 1024,
        }

        # Add explicit instruction to return only valid JSON
        enhanced_prompt = prompt + "\n\nIMPORTANT: Return ONLY the JSON object without any additional text, explanation, or markdown formatting."

        # Generate content with configuration
        response = model.generate_content(
            enhanced_prompt,
            generation_config=generation_config
        )

        # Return the generated text
        return response.text
    except Exception as e:
        print(f"Local LLM API error: {str(e)}")
        raise e
@router.post("/generate", response_model=Dict[str, Any])
async def generate_assessment(
        params: UserParameters,
        background_tasks: BackgroundTasks,
        quiz_gen=Depends(get_quiz_generator)
):
    """
    Generate a personalized skill assessment quiz based on user parameters
    """
    try:
        # Generate a unique ID for this quiz
        import uuid
        quiz_id = str(uuid.uuid4())

        # Start quiz generation
        quiz_content = generate_quiz(
            model=quiz_gen,
            primary_goal=params.primary_goal,
            selected_skills=params.selected_skills,
            time_commitment=params.time_commitment,
            career_path=params.career_path,
            experience_level=params.experience_level,
            num_questions=params.num_questions
        )

        # Store the quiz with correct answers in cache
        global quiz_cache
        quiz_cache[quiz_id] = quiz_content

        # Create a user-facing version without correct answers
        user_quiz = {
            "quiz_id": quiz_id,
            "questions": [
                {
                    "question": q["question"],
                    "options": q["options"],
                    "difficulty": q.get("difficulty", "intermediate")
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

@router.get("/assessment-history")
async def get_assessment_history(authorization: str = Header(None)):
    """
    Get a user's assessment history
    """
    # Check authorization
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token format")

    # Get database connection
    db = get_db()
    
    try:
        # Find all assessment results for this user, sorted by timestamp (newest first)
        results = list(db.skill_assessment_results.find(
            {"user_id": ObjectId(user_id)},
            {"_id": 0}  # Exclude MongoDB _id field
        ).sort("timestamp", -1))
        
        # Convert ObjectId to string and format timestamps
        for result in results:
            if "timestamp" in result:
                result["timestamp"] = result["timestamp"].isoformat()
            if "user_id" in result and isinstance(result["user_id"], ObjectId):
                result["user_id"] = str(result["user_id"])
        
        return {"assessments": results}
    
    except Exception as e:
        print(f"Error retrieving assessment history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve assessment history: {str(e)}"
        )
    
# Add this route to your existing mcq_routes.py file

@router.get("/statistics")
async def get_assessment_statistics(authorization: str = Header(None)):
    """
    Get overall statistics for quiz assessments for admin/developer use
    """
    # Check authorization
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
            
        # Optional: Check if user has admin role
        # db = get_db()
        # user = db.users.find_one({"_id": ObjectId(user_id)})
        # if not user or "admin" not in user.get("roles", []):
        #     raise HTTPException(status_code=403, detail="Access denied")
            
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token format")

    # Get database connection
    db = get_db()
    
    try:
        # Calculate skill level distribution
        level_pipeline = [
            {"$group": {"_id": "$assessed_level", "count": {"$sum": 1}}},
            {"$project": {"name": "$_id", "value": "$count", "_id": 0}}
        ]
        level_distribution = list(db.skill_assessment_results.aggregate(level_pipeline))
        
        # Find common skill gaps
        skill_gaps = []
        results = db.skill_assessment_results.find({}, {"skill_gaps": 1})
        skill_count = {}
        
        for result in results:
            if "skill_gaps" in result and "areas" in result["skill_gaps"]:
                for area in result["skill_gaps"]["areas"]:
                    skill = area.get("skill")
                    if skill:
                        if skill in skill_count:
                            skill_count[skill] += 1
                        else:
                            skill_count[skill] = 1
        
        skill_gaps = [{"name": skill, "frequency": count} 
                     for skill, count in sorted(skill_count.items(), 
                                              key=lambda x: x[1], 
                                              reverse=True)[:10]]
        
        # Calculate average scores over time (by month)
        from datetime import datetime
        import pandas as pd
        
        scores = list(db.skill_assessment_results.find({}, {"timestamp": 1, "score": 1}))
        
        # Convert to pandas for easier grouping
        if scores:
            df = pd.DataFrame(scores)
            
            # Extract score percentage from the nested score structure
            def extract_percentage(row):
                if isinstance(row['score'], dict) and 'percentage' in row['score']:
                    return row['score']['percentage']
                elif isinstance(row['score'], int):
                    # Handle case where score might be stored as direct integer
                    return row['score']
                return 0  # Default fallback
            
            df['score_percentage'] = df.apply(extract_percentage, axis=1)
            df['month'] = df['timestamp'].dt.strftime('%Y-%m')
            
            monthly_avg = df.groupby('month')['score_percentage'].mean().reset_index()
            average_scores = [{"date": row['month'], "average": round(row['score_percentage'], 2)} 
                             for _, row in monthly_avg.iterrows()]
        else:
            average_scores = []
            
        # Count quizzes by month
        if scores:
            quiz_counts = df['month'].value_counts().reset_index()
            quiz_counts.columns = ['month', 'count']
            quiz_count_by_month = quiz_counts.sort_values('month').to_dict('records')
        else:
            quiz_count_by_month = []
            
        # Get top recommendations
        recommendations = []
        rec_results = db.skill_assessment_results.find({}, {"recommendations": 1})
        rec_count = {}
        
        for result in rec_results:
            if "recommendations" in result:
                for rec in result["recommendations"]:
                    rec_key = f"{rec.get('title')}|{rec.get('type')}"
                    if rec_key in rec_count:
                        rec_count[rec_key] += 1
                    else:
                        rec_count[rec_key] = 1
                        
        top_recs = []
        for rec_key, count in sorted(rec_count.items(), key=lambda x: x[1], reverse=True)[:10]:
            title, rec_type = rec_key.split('|')
            top_recs.append({"title": title, "type": rec_type, "count": count})
            
        return {
            "levelDistribution": level_distribution,
            "skillGapFrequency": skill_gaps,
            "averageScores": average_scores,
            "quizCountByMonth": quiz_count_by_month,
            "topRecommendations": top_recs
        }
    
    except Exception as e:
        print(f"Error getting statistics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve statistics: {str(e)}"
        )