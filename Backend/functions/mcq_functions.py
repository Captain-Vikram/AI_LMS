import os
from typing import Dict, List, Any, Optional
import functions.llm_adapter as genai
import json
from pydantic import ValidationError
from models.quiz_models import QuizContent, MCQQuestion


def create_quiz_generator(api_key: str) -> Any:
    """
    Creates a structured quiz generator using local LM Studio inference.
    """
    # Configure local adapter (api_key is optional and treated as API token if set).
    genai.configure(api_key=api_key)

    # Use the configured local model unless an explicit model override is provided.
    try:
        quiz_max_tokens = int(os.getenv("QUIZ_MAX_OUTPUT_TOKENS", "2048"))
    except ValueError:
        quiz_max_tokens = 2048
    generation_config = {
        "temperature": 0.2,  # Lower temperature for more deterministic output
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": quiz_max_tokens,
    }

    # Create and return the model client
    model = genai.GenerativeModel(
        model_name=os.getenv("LMSTUDIO_MODEL"),
        generation_config=generation_config
    )

    return model


def generate_quiz(
        model: Any,
        primary_goal: str,
        selected_skills: List[str],
        time_commitment: str,
        career_path: str,
        experience_level: str = "intermediate",
        num_questions: int = 10
) -> Dict[str, Any]:
    """
    Generates a personalized quiz based on user parameters

    Args:
        model: The Gemini model for quiz generation
        primary_goal: User's primary learning goal (e.g., "Career Advancement")
        selected_skills: List of skills selected by user (e.g., ["Programming", "Data Science"])
        time_commitment: User's weekly time commitment (e.g., "Moderate (4-7 hours)")
        career_path: User's chosen career path (e.g., "Data Science")
        experience_level: User's experience level (e.g., "intermediate")
        num_questions: Number of questions to generate

    Returns:
        A dictionary containing the generated quiz
    """
    # Adjust num_questions based on time_commitment
    if "Minimal" in time_commitment:
        num_questions = min(num_questions, 5)  # Fewer questions for minimal time commitment
    elif "Intensive" in time_commitment:
        num_questions = max(num_questions, 15)  # More questions for intensive time commitment

    # Create the prompt
    prompt = f"""
    You are an expert assessment creator specializing in technical skills evaluation.

    Create a quiz to assess a user's current skill level in the following areas:
    - Primary goal: {primary_goal}
    - Selected skills: {', '.join(selected_skills)}
    - Time commitment: {time_commitment}

    For a user interested in {career_path} at an {experience_level} level, generate {num_questions} multiple-choice questions.

    Guidelines:
    - Questions should test both theoretical understanding and practical knowledge
    - Include a mix of difficulty levels appropriate for {experience_level} experience
    - Cover all the selected skills with balanced distribution
    - Ensure each question has 4 options with only one correct answer
    - Provide a brief explanation for the correct answer

    Return the result as a JSON object with the following structure:
    {{
      "questions": [
        {{
          "question": "Question text goes here?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_answer": 0,  // Index of the correct answer (0-based)
          "explanation": "Explanation for the correct answer",
          "difficulty": "beginner" // or "intermediate" or "advanced"
        }}
        // ... more questions
      ]
    }}

    IMPORTANT: Format your response ONLY as a valid JSON object. DO NOT include any additional text, markdown formatting, or code blocks.
    """

    def ensure_question_count(quiz_data: Dict[str, Any]) -> Dict[str, Any]:
        questions = list(quiz_data.get("questions", []))

        if len(questions) >= num_questions:
            quiz_data["questions"] = questions[:num_questions]
            return quiz_data

        fallback_questions = create_fallback_questions(
            selected_skills=selected_skills,
            career_path=career_path,
            experience_level=experience_level,
            num_questions=num_questions,
        ).get("questions", [])

        for fallback_question in fallback_questions:
            if len(questions) >= num_questions:
                break
            questions.append(fallback_question)

        quiz_data["questions"] = questions[:num_questions]
        return quiz_data

    # Generate the response
    try:
        response = model.generate_content(prompt)

        # Extract JSON from the response
        response_text = response.text

        # Look for JSON content - try to handle cases where model might add markdown code blocks
        if "```json" in response_text:
            json_content = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            json_content = response_text.split("```")[1].strip()
        else:
            json_content = response_text

        # Parse the JSON response
        try:
            parsed_json = json.loads(json_content)
            # Validate against our Pydantic model
            quiz_content = QuizContent(**parsed_json)
            return ensure_question_count(quiz_content.model_dump())
        except json.JSONDecodeError as e:
            print(f"JSON decoding error: {str(e)}")
            print(f"Raw content: {json_content}")
            # Return a minimal structure with sample questions
            return create_fallback_questions(selected_skills, career_path, experience_level, num_questions)
        except ValidationError as e:
            print(f"Validation error: {str(e)}")
            # Try to salvage what we can from the response
            if isinstance(parsed_json, dict) and "questions" in parsed_json:
                return ensure_question_count(parsed_json)
            else:
                return create_fallback_questions(selected_skills, career_path, experience_level, num_questions)
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        return create_fallback_questions(selected_skills, career_path, experience_level, num_questions)


def create_fallback_questions(selected_skills, career_path, experience_level, num_questions: int = 10):
    """Create fallback questions if the LLM generation fails"""

    fallback_questions = {
        "questions": [
            {
                "question": "What is the primary purpose of exploratory data analysis in a data science workflow?",
                "options": [
                    "To clean and preprocess data",
                    "To understand patterns and relationships in data",
                    "To build predictive models",
                    "To create production-ready visualizations"
                ],
                "correct_answer": 1,
                "explanation": "Exploratory data analysis is primarily used to understand the underlying patterns and relationships in data before formal modeling.",
                "difficulty": "intermediate"
            },
            {
                "question": "Which Python library is commonly used for data manipulation and analysis?",
                "options": [
                    "Matplotlib",
                    "TensorFlow",
                    "Pandas",
                    "Flask"
                ],
                "correct_answer": 2,
                "explanation": "Pandas is the most commonly used library for data manipulation and analysis in Python.",
                "difficulty": "beginner"
            },
            {
                "question": "What does O(n) time complexity indicate?",
                "options": [
                    "Runtime stays constant as input grows",
                    "Runtime grows proportionally with input size",
                    "Runtime doubles every step",
                    "Runtime decreases with larger input"
                ],
                "correct_answer": 1,
                "explanation": "O(n) means runtime increases linearly with input size.",
                "difficulty": "intermediate"
            },
            {
                "question": "Which data structure follows First-In, First-Out behavior?",
                "options": [
                    "Stack",
                    "Queue",
                    "HashMap",
                    "Set"
                ],
                "correct_answer": 1,
                "explanation": "A queue processes items in the order they were added (FIFO).",
                "difficulty": "intermediate"
            },
            {
                "question": "What is the main purpose of exception handling in software systems?",
                "options": [
                    "To speed up every program",
                    "To remove all bugs automatically",
                    "To handle expected runtime failures gracefully",
                    "To avoid writing tests"
                ],
                "correct_answer": 2,
                "explanation": "Exception handling helps applications recover or fail gracefully on runtime errors.",
                "difficulty": "intermediate"
            },
            {
                "question": "Which principle best describes encapsulation in OOP?",
                "options": [
                    "Combining related data and behavior while hiding internals",
                    "Allowing one class to inherit all classes",
                    "Running code in parallel by default",
                    "Converting methods into constants"
                ],
                "correct_answer": 0,
                "explanation": "Encapsulation binds data and methods while restricting direct access to internals.",
                "difficulty": "intermediate"
            }
        ]
    }

    # Add some skill-specific questions
    if "programming" in [s.lower() for s in selected_skills]:
        fallback_questions["questions"].append({
            "question": "What does the following Python code output? \n\nx = [1, 2, 3]\ny = x\ny.append(4)\nprint(x)",
            "options": ["[1, 2, 3]", "[1, 2, 3, 4]", "[1, 2, 3], [1, 2, 3, 4]", "Error"],
            "correct_answer": 1,
            "explanation": "In Python, when you assign a list to another variable, both variables reference the same list object. Any modifications to the list through either variable will affect the original list.",
            "difficulty": "intermediate"
        })

    if "leadership" in [s.lower() for s in selected_skills]:
        fallback_questions["questions"].append({
            "question": "Which leadership style involves making decisions based on input from team members?",
            "options": ["Autocratic", "Laissez-faire", "Democratic", "Transformational"],
            "correct_answer": 2,
            "explanation": "Democratic leadership involves gathering input from team members before making decisions, fostering collaboration and engagement.",
            "difficulty": "intermediate"
        })

    questions = fallback_questions["questions"]

    if len(questions) < num_questions and questions:
        repeat_index = 0
        while len(questions) < num_questions:
            base_question = dict(questions[repeat_index % len(questions)])
            repeat_round = (len(questions) // len(fallback_questions["questions"])) + 1
            base_question["question"] = f"{base_question['question']} (Practice {repeat_round})"
            questions.append(base_question)
            repeat_index += 1

    fallback_questions["questions"] = questions[:num_questions]

    return fallback_questions


def score_quiz(user_answers: List[int], quiz_content: Dict[str, Any]) -> Dict[str, Any]:
    """
    Scores a completed quiz and provides feedback

    Args:
        user_answers: List of user's selected answer indices
        quiz_content: The original quiz content with questions and correct answers

    Returns:
        A dictionary with score and detailed feedback
    """
    total_questions = len(quiz_content["questions"])
    correct_count = 0
    question_feedback = []

    skill_performance = {}  # To track performance by skill area

    for i, (answer, question) in enumerate(zip(user_answers, quiz_content["questions"])):
        is_correct = answer == question["correct_answer"]
        if is_correct:
            correct_count += 1

        # Track which skills need improvement based on incorrect answers
        # This is simplified and would need proper skill tagging in a real implementation

        question_feedback.append({
            "question_index": i,
            "is_correct": is_correct,
            "correct_answer": question["correct_answer"],
            "explanation": question["explanation"]
        })

    score_percentage = (correct_count / total_questions) * 100 if total_questions > 0 else 0

    # Determine skill level based on score
    if score_percentage >= 80:
        skill_level = "advanced"
    elif score_percentage >= 50:
        skill_level = "intermediate"
    else:
        skill_level = "beginner"

    return {
        "score": {
            "correct": correct_count,
            "total": total_questions,
            "percentage": score_percentage
        },
        "assessed_level": skill_level,
        "question_feedback": question_feedback
    }