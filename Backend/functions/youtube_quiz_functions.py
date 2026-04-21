import os
import json
from typing import Dict, List, Any, Optional
import functions.llm_adapter as genai
from functions.transcript_utils import fetch_transcript_entries
from pydantic import BaseModel, Field
import re
from tenacity import retry, stop_after_attempt, wait_exponential


def extract_video_id(youtube_url):
    """
    Extract the video ID from a YouTube URL.
    Supports various YouTube URL formats.
    """
    # Regular expression to match various YouTube URL formats
    youtube_regex = (
        r'(https?://)?(www\.)?'
        r'(youtube|youtu|youtube-nocookie)\.(com|be)/'
        r'(watch\?v=|embed/|v/|.+\?v=)?([^&=%\?]{11})'
    )

    youtube_match = re.match(youtube_regex, youtube_url)

    if youtube_match:
        return youtube_match.group(6)

    return None


def youtube_thumbnail_url_from_video_id(video_id: str) -> str:
    """Return a YouTube thumbnail URL for a given video id (best-effort)."""
    if not video_id:
        return ""
    return f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"


def get_transcript(video_id, languages=['en']):
    """
    Get the transcript for a YouTube video.
    Will try preferred languages first, but will use any available if those aren't found.

    Args:
        video_id (str): YouTube video ID
        languages (list): List of language codes to try, in order of preference

    Returns:
        list: List of transcript entries with 'timestamp' and 'text' keys
    """
    try:
        transcript_data = fetch_transcript_entries(video_id, languages)

        # Format the transcript data into a list of entries
        transcriptions = []
        for entry in transcript_data:
            start_time = float(entry.get('start', 0))
            duration = float(entry.get('duration', 0) or 0)
            # Convert seconds to HH:MM:SS format
            hours, remainder = divmod(start_time, 3600)
            minutes, seconds = divmod(remainder, 60)
            timestamp = f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"

            transcriptions.append({
                "timestamp": timestamp,
                "start_seconds": start_time,
                "duration": duration,
                "description": entry.get('text', '')
            })

        return transcriptions

    except Exception as e:
        raise Exception(f"Error retrieving transcript: {str(e)}")


def combine_transcriptions(transcriptions: List[Dict[str, str]]) -> str:
    """
    Combine transcription segments into a single text

    Args:
        transcriptions: List of transcript entries with 'timestamp' and 'description' keys

    Returns:
        str: Combined transcript text
    """
    return " ".join([entry["description"] for entry in transcriptions])


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def extract_core_topics(transcriptions: List[Dict[str, Any]],
                        model_name: str = None,
                        max_transcript_length: int = 15000) -> Dict[str, Any]:
    """
    Extract core topics with timestamp ranges from a list of transcription segments

    Args:
        transcriptions: List of transcript entries with 'timestamp', 'start_seconds', 'duration', and 'description' keys
        model_name: Local model name override
        max_transcript_length: Maximum characters of transcript to process

    Returns:
        dict: Dictionary containing 'core_topics' and 'summary'
    """
    model_name = model_name or os.getenv("LMSTUDIO_MODEL")

    try:
        # Configure local adapter for LM Studio.
        genai.configure(base_url=os.getenv("LMSTUDIO_URL"))

        # Combine transcriptions into a single text
        full_transcript = combine_transcriptions(transcriptions)

        # Truncate if too long to avoid token limits
        if len(full_transcript) > max_transcript_length:
            full_transcript = full_transcript[:max_transcript_length] + "..."
            print(f"Transcript truncated to {max_transcript_length} characters for topic extraction")

        # Prepare transcript with timestamps
        timestamped_transcript = ""
        for i, entry in enumerate(transcriptions):
            if i < 100 or i % 5 == 0:  # Include every 5th entry to reduce size but maintain context
                timestamped_transcript += f"[{entry['timestamp']}] {entry['description']}\n"

        # If we have too much text, truncate
        if len(timestamped_transcript) > max_transcript_length:
            timestamped_transcript = timestamped_transcript[:max_transcript_length] + "..."

        model = genai.GenerativeModel(model_name)

        # Configure generation parameters
        generation_config = {
            "temperature": 0.2,  # Lower temperature for more factual output
            "top_p": 0.95,
            "top_k": 64,
            "max_output_tokens": 4096,  # Allow for reasonably long output
        }

        # Extract core topics with timestamp ranges
        topics_prompt = f"""
        You are an expert at analyzing video transcripts and extracting core topics with timestamp ranges.

        Below is a transcript from a video with timestamps in the format [HH:MM:SS]. Extract the 5-10 main core topics discussed in this video.

        For each core topic:
        1. Identify a clear, concise name for the topic (a few words only)
        2. Determine the approximate timestamp range where this topic is discussed (start time and end time)
        3. Write a very brief description (1-2 sentences maximum)

        Format your response as a JSON array with objects containing:
        - topic: the core topic name
        - start_time: the timestamp when discussion of this topic begins
        - end_time: the timestamp when discussion of this topic ends
        - description: brief description of what's covered in this topic

        Transcript:
        ---
        {timestamped_transcript}
        ---

        Return ONLY the JSON array with no additional text, markdown formatting, or code blocks.
        """

        topics_response = model.generate_content(
            topics_prompt,
            generation_config=generation_config
        )
        topics_text = topics_response.text.strip()

        # Extract JSON content
        if "```json" in topics_text:
            json_content = topics_text.split("```json")[1].split("```")[0].strip()
        elif "```" in topics_text:
            json_content = topics_text.split("```")[1].strip()
        else:
            json_content = topics_text

        # Parse the JSON response
        try:
            core_topics = json.loads(json_content)
        except json.JSONDecodeError as e:
            print(f"JSON decoding error: {str(e)}")
            core_topics = []

        # Generate a brief summary
        summary_prompt = f"""
        You are an expert at creating concise summaries from transcripts.

        Below is a transcript from a video. Create a concise summary (1-2 paragraphs maximum) that captures:
        1. The main topic and purpose of the content
        2. The key points or arguments made

        Transcript:
        ---
        {full_transcript[:8000]}  # Limited to 8000 chars to avoid token limits
        ---

        Summary:
        """

        summary_response = model.generate_content(
            summary_prompt,
            generation_config=generation_config
        )
        summary = summary_response.text.strip()

        return {
            "core_topics": core_topics,
            "summary": summary
        }

    except Exception as e:
        print(f"Error extracting core topics: {e}")
        return {
            "core_topics": [],
            "summary": f"ERROR: Failed to extract core topics. {str(e)}"
        }


class YouTubeQuizGenerator:
    """Class to generate quizzes, extract topics, and summaries based on YouTube video content"""

    def __init__(self, api_key=None):
        """Initialize the quiz generator with local LM Studio configuration."""
        self.api_key = api_key
        genai.configure(base_url=os.getenv("LMSTUDIO_URL"))
        # Use a powerful model for generation
        self.generation_config = {
            "temperature": 0.2,  # Lower temperature for more deterministic output
            "top_p": 0.95,
            "top_k": 64,
            "max_output_tokens": 8192,  # Allow for long responses with multiple questions
        }
        self.model = genai.GenerativeModel(
            model_name=os.getenv("LMSTUDIO_MODEL"),
            generation_config=self.generation_config
        )

    def extract_video_metadata(self, video_id):
        """
        Extract metadata for a YouTube video using transcript.
        In a production system, you might want to use the YouTube Data API for this.

        Returns:
            dict: Video metadata including title and description
        """
        try:
            # For now, we'll use a simpler approach since we're focused on the transcript
            # You could extend this to use the YouTube Data API
            return {
                "video_id": video_id,
                "extracted_from_transcript": True
            }
        except Exception as e:
            raise Exception(f"Error extracting video metadata: {str(e)}")

    def prepare_transcript_for_quiz(self, transcriptions):
        """
        Prepare transcript for quiz generation by concatenating text.

        Args:
            transcriptions (list): List of transcript entries

        Returns:
            str: Concatenated transcript text
        """
        # Concatenate all transcript entries
        full_text = " ".join([entry["description"] for entry in transcriptions])

        # If text is very long, we might need to truncate or summarize it
        # For now, we'll use the full text if it's reasonable in length
        # This is where you might add chunking logic for very long videos
        return full_text

    def extract_topics_from_transcript(self, transcriptions, model_name=None):
        """
        Extract core topics with timestamp ranges from transcript.

        Args:
            transcriptions (list): List of transcript entries
            model_name (str): Model to use for topic extraction

        Returns:
            dict: Extracted core topics with timestamp ranges and a brief summary
        """
        try:
            # Use the extract_core_topics function
            result = extract_core_topics(
                transcriptions=transcriptions,
                model_name=model_name
            )

            return result
        except Exception as e:
            print(f"Error extracting core topics: {str(e)}")
            return {
                "core_topics": [],
                "summary": f"Error extracting core topics: {str(e)}"
            }

    def generate_quiz_from_transcript(
        self,
        transcript_text,
        num_questions=5,
        difficulty="intermediate",
        assessment_context=None,
    ):
        """
        Generate a quiz based on transcript text.

        Args:
            transcript_text (str): Video transcript text
            num_questions (int): Number of questions to generate
            difficulty (str): Difficulty level (beginner, intermediate, advanced)

        Returns:
            dict: Generated quiz with questions and answers
        """
        context_block = ""
        if assessment_context and str(assessment_context).strip():
            context_block = f"""
        Pathway assessment context (must influence question selection and phrasing):
        {str(assessment_context).strip()}
        """

        # Create the prompt
        prompt = f"""
        You are an expert in creating educational assessments. Generate a quiz based on the following video transcript:

        {transcript_text[:8000]}  # Limited to 8000 chars to avoid token limits

        {context_block}

        Create {num_questions} multiple-choice questions (with 4 options each) to test understanding of the key concepts in this video. 
        The questions should be at {difficulty} level.

        For each question:
        1. Make sure it tests understanding, not just recall
        2. Include one clear correct answer and three plausible but incorrect options
        3. Provide a brief explanation for why the correct answer is right

        Return the result as a JSON object with the following structure:
        {{
          "questions": [
            {{
              "question": "Question text goes here?",
              "options": ["Option A", "Option B", "Option C", "Option D"],
              "correct_answer": 0,  // Index of the correct answer (0-based)
              "explanation": "Explanation for the correct answer",
              "difficulty": "{difficulty}"
            }}
            // ... more questions
          ]
        }}

        IMPORTANT: Format your response ONLY as a valid JSON object. DO NOT include any additional text, markdown formatting, or code blocks.
        """

        # Generate the response
        try:
            response = self.model.generate_content(prompt)
            response_text = response.text

            # Extract JSON content
            if "```json" in response_text:
                json_content = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                json_content = response_text.split("```")[1].strip()
            else:
                json_content = response_text

            # Parse the JSON response
            try:
                parsed_json = json.loads(json_content)
                return parsed_json
            except json.JSONDecodeError as e:
                print(f"JSON decoding error: {str(e)}")
                # Return a fallback with error info
                return self._create_fallback_quiz(num_questions, difficulty, "JSON parsing error")
        except Exception as e:
            print(f"Error generating quiz: {str(e)}")
            return self._create_fallback_quiz(num_questions, difficulty, str(e))

    def _create_fallback_quiz(self, num_questions, difficulty, error_info):
        """Create a fallback quiz if generation fails"""
        questions = []
        for i in range(min(3, num_questions)):
            questions.append({
                "question": f"Question {i + 1} about the video content (Generation Error: {error_info})",
                "options": [
                    "Option A",
                    "Option B",
                    "Option C",
                    "Option D"
                ],
                "correct_answer": 0,
                "explanation": "Please try again later. There was an error generating this quiz.",
                "difficulty": difficulty
            })

        return {"questions": questions}

    def generate_quiz_from_video_url(
        self,
        video_url,
        num_questions=5,
        difficulty="intermediate",
        languages=['en'],
        assessment_context=None,
    ):
        """
        Generate a quiz from a YouTube video URL.

        Args:
            video_url (str): YouTube video URL
            num_questions (int): Number of questions to generate
            difficulty (str): Difficulty level (beginner, intermediate, advanced)
            languages (list): List of language codes to try for transcript

        Returns:
            dict: Generated quiz with video metadata and questions
        """
        # Extract video ID
        video_id = extract_video_id(video_url)
        if not video_id:
            raise ValueError("Invalid YouTube URL")

        # Get video transcript
        transcriptions = get_transcript(video_id, languages)

        # Extract video metadata
        metadata = self.extract_video_metadata(video_id)

        # Prepare transcript for quiz generation
        transcript_text = self.prepare_transcript_for_quiz(transcriptions)

        # Generate quiz
        quiz = self.generate_quiz_from_transcript(
            transcript_text,
            num_questions,
            difficulty,
            assessment_context=assessment_context,
        )

        # Combine everything
        result = {
            "video_id": video_id,
            "video_url": video_url,
                "metadata": metadata,
                "thumbnail_url": youtube_thumbnail_url_from_video_id(video_id),
            "questions": quiz["questions"]
        }

        return result