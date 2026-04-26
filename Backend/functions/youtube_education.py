from typing import Optional
import json
import os
import re
from typing import Any, Dict, List
from urllib.parse import quote_plus

from dotenv import load_dotenv
from langchain_community.tools import YouTubeSearchTool

import functions.llm_adapter_async as genai
from functions.youtube_quiz_functions import extract_video_id

tool = YouTubeSearchTool()


async def respond_to_normal_query(query):
    # YouTubeSearchTool run is usually blocking, but for now we'll call it.
    return tool.run(f"{query},20")


def _fallback_concepts_for_skill(skill: str) -> List[str]:
    lowered = (skill or "").strip().lower()

    if "data" in lowered:
        return [
            "data analysis fundamentals",
            "data cleaning techniques",
            "exploratory data analysis",
            "data visualization basics",
            "python pandas workflows",
        ]

    if "program" in lowered or "coding" in lowered or "software" in lowered:
        return [
            "programming fundamentals",
            "object oriented programming",
            "data structures and algorithms",
            "error handling and debugging",
            "asynchronous programming",
        ]

    if "machine learning" in lowered or "ml" == lowered:
        return [
            "supervised learning basics",
            "model evaluation metrics",
            "feature engineering",
            "overfitting and regularization",
            "model deployment basics",
        ]

    seed = skill.strip() if skill else "learning"
    return [
        f"{seed} fundamentals",
        f"{seed} core concepts",
        f"{seed} best practices",
        f"{seed} practical projects",
        f"{seed} interview questions",
    ]


def _normalize_concepts(raw_concepts: Any, skill: str, max_items: int = 8) -> List[str]:
    normalized: List[str] = []

    if isinstance(raw_concepts, list):
        for item in raw_concepts:
            if isinstance(item, str) and item.strip():
                normalized.append(item.strip())
            elif isinstance(item, dict):
                maybe_text = item.get("concept") or item.get("name") or item.get("topic")
                if isinstance(maybe_text, str) and maybe_text.strip():
                    normalized.append(maybe_text.strip())

    if not normalized:
        normalized = _fallback_concepts_for_skill(skill)

    # Preserve order while removing duplicates.
    deduped: List[str] = []
    seen = set()
    for concept in normalized:
        key = concept.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(concept)

    return deduped[:max_items]


def _extract_skills(data: Dict[str, Any]) -> List[str]:
    improvement_areas = data.get("skill_gaps", {}).get("areas", [])
    skills = [area.get("skill") for area in improvement_areas if isinstance(area, dict) and area.get("skill")]

    if skills:
        return skills

    # Secondary fallback: derive from recommendation titles.
    recommendations = data.get("recommendations", [])
    for item in recommendations:
        if isinstance(item, dict) and isinstance(item.get("title"), str):
            title = item["title"].strip()
            if title:
                skills.append(title)

    return skills


def _build_youtube_search_link(skill: str, concept: str) -> str:
    # We return empty if we can't find a direct link, to let the caller handle it or use a better fallback.
    # But for compatibility, let's keep a valid search link but mark it.
    query = quote_plus(f"{skill} {concept} tutorial")
    return f"https://www.youtube.com/results?search_query={query}"


def _extract_video_link(tool_output: str) -> Optional[str]:
    """Extract a single valid video link from YouTubeSearchTool output."""
    if not tool_output:
        return None

    # Try parsing as list if it looks like one
    if tool_output.startswith("[") and tool_output.endswith("]"):
        try:
            import ast
            parsed = ast.literal_eval(tool_output)
            if isinstance(parsed, list) and len(parsed) > 0:
                for item in parsed:
                    if "watch?v=" in str(item):
                        video_path = str(item).strip("'").strip('"')
                        return f"https://www.youtube.com{video_path}"
        except Exception:
            pass

    # Fallback to regex if parsing fails
    import re
    match = re.search(r"/watch\?v=[\w-]+", tool_output)
    if match:
        return f"https://www.youtube.com{match.group(0)}"

    return None


async def generate_skill_playlist(input_json, force_fallback: bool = False):
    """
    Build YouTube recommendations for each skill with robust LLM fallbacks.
    """
    load_dotenv(override=True)

    youtube_tool = YouTubeSearchTool()

    if isinstance(input_json, str):
        try:
            data = json.loads(input_json)
        except json.JSONDecodeError:
            data = {}
    elif isinstance(input_json, dict):
        data = input_json
    else:
        data = {}

    skills = _extract_skills(data)
    if not skills:
        return []

    try:
        max_tokens = int(os.getenv("YOUTUBE_WORKFLOW_MAX_OUTPUT_TOKENS", "1500"))
    except ValueError:
        max_tokens = 1500

    generation_config = {
        "temperature": 0.2,
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": max_tokens,
    }

    model = None
    if not force_fallback:
        try:
            model = genai.GenerativeModelAsync(
                model_name=os.getenv("LMSTUDIO_MODEL"),
                generation_config=generation_config,
            )
        except Exception as exc:
            print(f"Unable to initialize LLM for YouTube recommendations: {exc}")

    def clean_json_response(response_text: str) -> str:
        return re.sub(r"```json|```", "", (response_text or "")).strip()

    async def generate_workflow(skill: str) -> Dict[str, Any]:
        if model is None:
            return {"skill": skill, "concepts": _fallback_concepts_for_skill(skill)}

        prompt = f"""Generate a structured JSON response for learning {skill}, listing essential concepts in a logical order.
Return valid JSON only in this exact schema:
{{
  "skill": "{skill}",
  "concepts": ["keyword1", "keyword2", "keyword3"]
}}
Use 5 to 8 concise concepts.
"""

        try:
            response = await model.generate_content(prompt)
            raw_text = (response.text or "").strip()
            print(f"\nRaw response for {skill}:\n{raw_text}")
            cleaned = clean_json_response(raw_text)

            workflow_data = json.loads(cleaned)
            concepts = _normalize_concepts(workflow_data.get("concepts", []), skill)
            return {"skill": skill, "concepts": concepts}
        except Exception as exc:
            print(f"Workflow generation failed for {skill}: {exc}")
            return {"skill": skill, "concepts": _fallback_concepts_for_skill(skill)}

    def generate_playlist(skill: str, concepts: List[str]) -> List[Dict[str, str]]:
        playlist: List[Dict[str, str]] = []

        for concept in concepts:
            try:
                query = _build_youtube_tool_query(skill, concept, max_results=1)
                tool_output = youtube_tool.run(query)
                link = _extract_video_link(tool_output)
                
                if not link:
                    # Try a more specific search query if the first one failed
                    retry_query = f"{skill} {concept} complete tutorial course,1"
                    tool_output_retry = youtube_tool.run(retry_query)
                    link = _extract_video_link(tool_output_retry)
                
                if not link:
                    link = _build_youtube_search_link(skill, concept)

                # Attempt to extract video id and add a thumbnail URL
                vid = extract_video_id(str(link) or "")
                thumbnail = f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg" if vid else None
                playlist.append({
                    "concept": concept,
                    "youtube_link": str(link),
                    "video_id": vid,
                    "thumbnail_url": thumbnail,
                })
            except Exception as exc:
                print(f"Error fetching YouTube link for {concept}: {exc}")
                playlist.append({
                    "concept": concept,
                    "youtube_link": _build_youtube_search_link(skill, concept),
                    "video_id": None,
                    "thumbnail_url": None,
                })

        return playlist

    result = []
    for skill in skills:
        print(f"\nGenerating workflow for: {skill}")
        workflow_data = await generate_workflow(skill)
        concepts = _normalize_concepts(workflow_data.get("concepts", []), skill)
        playlist = generate_playlist(skill, concepts)
        result.append({"skill": skill, "playlist": playlist})

    return result

# Example usage:
# if __name__ == "__main__":
#     sample_json = """
#     {
#       "score": {
#         "correct": 5,
#         "total": 10,
#         "percentage": 50
#       },
#       "assessed_level": "intermediate",
#       "question_feedback": [
#         {
#           "question_index": 0,
#           "is_correct": true,
#           "correct_answer": 1,
#           "explanation": "NumPy is the fundamental package for scientific computing in Python, providing support for large, multi-dimensional arrays and matrices."
#         }
#       ],
#       "skill_gaps": {
#         "overall": "Based on your assessment, we've identified areas for improvement",
#         "areas": [
#           {
#             "skill": "Data Analysis",
#             "level": "satisfactory"
#           },
#           {
#             "skill": "Programming",
#             "level": "needs improvement"
#           }
#         ]
#       },
#       "recommendations": [
#         {
#           "title": "Machine Learning Algorithms",
#           "type": "course"
#         }
#       ]
#     }
#     """
#     playlists = generate_skill_playlist(sample_json)
#     print(playlists)
#     print("\n--- Generated Playlists ---")
#     for item in playlists:
#         print(f"\nSkill: {item['skill']}")
#         for concept in item["playlist"]:
#             print(f"  - {concept['concept']}: {concept['youtube_link']}")

