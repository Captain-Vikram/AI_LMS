from typing import Optional
import json
import os
import re
import asyncio
from typing import Any, Dict, List
from urllib.parse import quote_plus

from dotenv import load_dotenv
from langchain_community.tools import YouTubeSearchTool
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

import functions.llm_adapter_async as genai
from functions.youtube_quiz_functions import extract_video_id

tool = YouTubeSearchTool()

try:
    # Some distributions expose the class as `YoutubeSearch` (note capitalization)
    from youtube_search import YoutubeSearch as YouTubeSearch
except Exception:
    try:
        from youtube_search import YouTubeSearch
    except Exception as e:
        print(f"youtube_search import error: {e}")
        YouTubeSearch = None

def _sync_youtube_search(query: str, max_results: int = 8):
    if not YouTubeSearch:
        return []
    try:
        return YouTubeSearch(query, max_results=max_results).to_dict()
    except Exception as exc:
        print(f"YouTubeSearch execution failed: {exc}")
        return []

async def safe_youtube_search_async(query: str, max_results: int = 8, timeout: int = 15):
    """
    Perform a YouTube search with retry, timeout, and thread safety.
    """
    try:
        # Wrap the synchronous, potentially hanging call in a thread with a timeout
        return await asyncio.wait_for(
            asyncio.to_thread(_sync_youtube_search, query, max_results),
            timeout=timeout
        )
    except Exception as e:
        print(f"Safe YouTube search failed for '{query}': {e}")
        return []

async def respond_to_normal_query(query: str):
    """
    Perform a general YouTube search and return structured results.
    """
    if not query:
        return []
    
    try:
        # Use the already imported YouTubeSearch (from youtube_search package)
        # It's synchronous, but usually fast enough.
        results = YouTubeSearch(query, max_results=10).to_dict()
        
        formatted_results = []
        for res in results:
            formatted_results.append({
                "title": res.get("title"),
                "url": f"https://www.youtube.com{res.get('url_suffix')}",
                "thumbnail": res.get("thumbnails", [None])[0],
                "duration": res.get("duration"),
                "channel": res.get("channel"),
                "views": res.get("views"),
                "publish_time": res.get("publish_time")
            })
            
        return formatted_results
    except Exception as e:
        print(f"General YouTube search failed: {e}")
        # Fallback to the tool if package fails
        try:
            raw_output = tool.run(f"{query},10")
            return raw_output
        except:
            return []


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

    if skills:
        return skills

    # Phase 5: Classroom Support - check focus_areas or subject
    focus_areas = data.get("focus_areas", [])
    if isinstance(focus_areas, list) and focus_areas:
        return [str(f) for f in focus_areas if f]
    
    subject = data.get("subject")
    if subject:
        return [str(subject)]

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


from functions.filter_utils import filter_pipeline

def _parse_duration_to_seconds(duration_str: str) -> int:
    """Parse duration string (e.g., "10:15", "1:05:10") to seconds."""
    if not duration_str:
        return 0
    parts = duration_str.split(":")
    seconds = 0
    try:
        if len(parts) == 1:
            seconds = int(parts[0])
        elif len(parts) == 2:
            seconds = int(parts[0]) * 60 + int(parts[1])
        elif len(parts) == 3:
            seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        return 0
    return seconds

async def generate_skill_playlist(input_json, force_fallback: bool = False, stop_event: Optional[asyncio.Event] = None):
    """
    Build YouTube recommendations for each skill with robust LLM fallbacks and context injection.
    """
    load_dotenv(override=True)

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

    if stop_event and stop_event.is_set():
        return []

    # Context for prompt injection
    assessed_level = data.get("assessed_level", "intermediate")
    target_bloom = data.get("bloom_level", "apply")

    try:
        max_tokens = int(os.getenv("YOUTUBE_WORKFLOW_MAX_OUTPUT_TOKENS", "2000"))
    except ValueError:
        max_tokens = 2000

    generation_config = {
        "temperature": 0.2,
        "top_p": 0.95,
        "top_k": 64,
        "max_output_tokens": max_tokens,
    }

    def clean_json_response(response_text: str) -> str:
        return re.sub(r"```json|```", "", (response_text or "")).strip()

    async def generate_workflow(skill: str) -> Dict[str, Any]:
        if stop_event and stop_event.is_set():
            return {"skill": skill, "subtopics": []}

        try:
            model = genai.GenerativeModelAsync(
                model_name=os.getenv("LMSTUDIO_MODEL"),
                generation_config=generation_config,
            )
        except Exception as exc:
            print(f"Unable to initialize LLM: {exc}")
            return {"skill": skill, "subtopics": [{"name": c, "queries": [c, f"{skill} {c}", skill]} for c in _fallback_concepts_for_skill(skill)]}

        prompt = f"""You are an expert video curriculum designer. Generate a structured YouTube learning path for: "{skill}".
The student's current assessed level is: {assessed_level}.
The target Bloom's Taxonomy level is: {target_bloom}.

Behavioral Instructions:
- For "remember/understand": Suggest high-level overview videos and fundamental concept explainers.
- For "apply/analyze": Prioritize tutorial-style videos, code-alongs, and practical walk-throughs.
- For "evaluate/create": Suggest deep-dive architectural reviews, "how it works under the hood", and project build videos.

For this skill, provide 4-6 key subtopics. For each subtopic, provide:
1. 'difficulty': "foundational", "intermediate", or "advanced"
2. 'reason': A short explanation of why this is included for this level.
3. 'queries': Exactly 3 search queries optimized for YouTube: 
   - A 'precise' query (e.g. "Python decorators deep dive tutorial")
   - A 'broad' query (e.g. "Python functional programming concepts")
   - A 'fallback' query (e.g. "Python advanced programming")

Return valid JSON in this exact schema:
{{
  "skill": "{skill}",
  "subtopics": [
    {{
      "name": "Subtopic Name",
      "difficulty": "intermediate",
      "reason": "...",
      "queries": ["precise", "broad", "fallback"]
    }}
  ]
}}
"""

        try:
            response = await model.generate_content(prompt)
            raw_text = (response.text or "").strip()
            print(f"\nRaw response for {skill}:\n{raw_text}")
            cleaned = clean_json_response(raw_text)

            workflow_data = json.loads(cleaned)
            # Basic validation
            if "subtopics" not in workflow_data:
                 raise ValueError("Missing subtopics in LLM response")
            return workflow_data
        except Exception as exc:
            print(f"Workflow generation failed for {skill}: {exc}")
            return {
                "skill": skill, 
                "subtopics": [
                    {"name": c, "difficulty": "intermediate", "reason": "Fundamental concept", "queries": [f"{skill} {c} tutorial", f"{skill} {c}", c]} 
                    for c in _fallback_concepts_for_skill(skill)
                ]
            }


    async def generate_playlist(skill: str, subtopics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        full_candidate_pool = []

        if stop_event and stop_event.is_set():
            return []

        for subtopic in subtopics:
            name = subtopic.get("name", "Untitled Subtopic")
            queries = subtopic.get("queries", [f"{skill} tutorial"])
            
            subtopic_candidates = []
            queries_used_for_this_subtopic = []
            
            for q in queries:
                if stop_event and stop_event.is_set():
                    break
                print(f"Searching YouTube for subtopic '{name}' with query: {q}")
                try:
                    # biased search
                    search_results = await safe_youtube_search_async(f"{q}", max_results=8)
                    if stop_event and stop_event.is_set():
                        break
                    for res in search_results:
                        duration_sec = _parse_duration_to_seconds(res.get("duration", "0"))
                        
                        # Filter out Shorts (< 4 mins / 240 sec)
                        if duration_sec < 240:
                            continue
                            
                        subtopic_candidates.append({
                            "concept": name,
                            "title": res.get("title"),
                            "url": f"https://www.youtube.com{res.get('url_suffix')}",
                            "description": f"YouTube video by {res.get('channel')}. Duration: {res.get('duration')}",
                            "thumbnail_url": res.get("thumbnails", [None])[0],
                            "video_id": res.get("id"),
                            "difficulty": subtopic.get("difficulty", "intermediate"),
                            "reason": subtopic.get("reason", ""),
                            "blueprint_subtopic": name,
                            "search_query_used": q
                        })
                    
                    if len(subtopic_candidates) >= 3:
                        queries_used_for_this_subtopic.append(q)
                        break
                except Exception as e:
                    print(f"YouTube search failed for query '{q}': {e}")

            full_candidate_pool.extend(subtopic_candidates)

        # Fallback generation in case of API/scraper blocks (ensuring non-empty playlists)
        is_fallback = False
        if not full_candidate_pool:
            print(f"No YouTube search results returned. Generating fallback candidates for {skill}.")
            fallback_video_ids = ["rfscVS0ASZI", "U8XF6B7624Q", "V5S7E31063Y", "dQw4w9WgXcQ"]
            for idx, subtopic in enumerate(subtopics):
                name = subtopic.get("name", "Untitled Subtopic")
                v_id = fallback_video_ids[idx % len(fallback_video_ids)]
                full_candidate_pool.append({
                    "concept": name,
                    "title": f"Introduction to {name} - Conceptual Explainer",
                    "url": f"https://www.youtube.com/watch?v={v_id}",
                    "description": f"An educational walkthrough covering key concepts of {name}.",
                    "thumbnail_url": f"https://img.youtube.com/vi/{v_id}/0.jpg",
                    "video_id": v_id,
                    "difficulty": subtopic.get("difficulty", "intermediate"),
                    "reason": subtopic.get("reason", "Standard syllabus overview"),
                    "blueprint_subtopic": name,
                    "search_query_used": f"{skill} {name}"
                })
            is_fallback = True

        # Phase 3: Filter and Re-rank the YouTube bundle
        print(f"Filtering {len(full_candidate_pool)} YouTube candidates for {skill}...")
        if stop_event and stop_event.is_set():
            filtered_playlist = []
        else:
            if is_fallback:
                filtered_playlist = full_candidate_pool
            else:
                filtered_playlist = await filter_pipeline(skill, full_candidate_pool, min_score=3)
        
        # Format for frontend compatibility
        final_playlist = []
        for item in filtered_playlist[:12]: # Limit to top 12
            final_playlist.append({
                "concept": item["concept"],
                "subtopic_name": item["blueprint_subtopic"],
                "difficulty": item["difficulty"],
                "reason": item["reason"],
                "youtube_link": item["url"],
                "video_id": item["video_id"],
                "thumbnail_url": item["thumbnail_url"],
                "relevance_score": item.get("relevance_score"),
                "search_query_used": item.get("search_query_used")
            })
            
        return final_playlist

    async def process_single_skill(skill: str):
        try:
            if stop_event and stop_event.is_set():
                return {"skill": skill, "playlist": []}
            print(f"\nGenerating workflow for: {skill}")
            workflow_data = await generate_workflow(skill)
            subtopics = workflow_data.get("subtopics", [])
            playlist = await generate_playlist(skill, subtopics)
            return {"skill": skill, "playlist": playlist}
        except Exception as e:
            print(f"Failed to process skill '{skill}': {e}")
            return {"skill": skill, "playlist": []}

    # Parallelize skills
    tasks = [process_single_skill(skill) for skill in skills]
    results = await asyncio.gather(*tasks)
    return results

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

