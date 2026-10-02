import json
import os
import re
import uuid
from urllib.parse import quote_plus, urlparse, parse_qs
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from functions.llm_adapter_async import generate_text_async

load_dotenv()

# ---------------------------------------------------------------------------
# Module-level search tool singletons — created once, reused across all calls.
# This avoids the overhead of re-instantiating heavy LangChain objects per request.
# ---------------------------------------------------------------------------
_yt_tool = None
_tavily_tool = None


def _get_yt_tool():
    global _yt_tool
    if _yt_tool is None:
        try:
            from langchain_community.tools import YouTubeSearchTool
            _yt_tool = YouTubeSearchTool()
        except Exception as e:
            print(f"[SkillPathwayService] YouTubeSearchTool unavailable: {e}")
    return _yt_tool


def _get_tavily_tool():
    global _tavily_tool
    if _tavily_tool is None and os.getenv("TAVILY_API_KEY"):
        try:
            from langchain_community.tools.tavily_search import TavilySearchResults
            _tavily_tool = TavilySearchResults()
        except Exception as e:
            print(f"[SkillPathwayService] TavilySearchResults unavailable: {e}")
    return _tavily_tool


def _extract_youtube_candidates(raw_value: Any) -> List[str]:
    """Extract URL candidates from the different shapes returned by YouTubeSearchTool."""
    candidates: List[str] = []

    if isinstance(raw_value, list):
        for item in raw_value:
            if isinstance(item, str) and item.strip():
                candidates.append(item.strip())
        return candidates

    text = str(raw_value or "").strip()
    if not text:
        return []

    # Handle string representation of list: "['/watch?v=...', '/watch?v=...']"
    if text.startswith("[") and text.endswith("]"):
        try:
            import ast
            parsed = ast.literal_eval(text)
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, str) and item.strip():
                        candidates.append(item.strip())
                if candidates:
                    return candidates
        except Exception:
            pass

    # Match full URLs
    url_matches = re.findall(r"https?://[^\s'\"]+", text)
    if url_matches:
        for url in url_matches:
            candidates.append(url.strip())

    # Match relative YouTube paths: /watch?v=... or watch?v=...
    relative_matches = re.findall(r"(?:/)?watch\?v=[a-zA-Z0-9_-]{11}", text)
    for rel in relative_matches:
        full_url = "https://www.youtube.com" + (rel if rel.startswith("/") else "/" + rel)
        if full_url not in candidates:
            candidates.append(full_url)

    if not candidates and text.startswith("http"):
        candidates.append(text)

    return candidates


def _is_youtube_shorts_url(url: str) -> bool:
    parsed = urlparse(str(url or "").strip())
    host = parsed.netloc.lower().replace("www.", "")

    # If it's a relative URL, it's probably not a shorts URL if it starts with /watch
    if not host:
        return "/shorts/" in parsed.path.lower()

    if host not in {"youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"}:
        return False

    path = (parsed.path or "").lower()
    return path.startswith("/shorts/") or "/shorts/" in path


def _normalize_youtube_watch_url(url: str) -> str:
    """Normalize common YouTube URL variants to a canonical watch URL."""
    raw_url = str(url or "").strip()
    if not raw_url:
        return ""

    if raw_url.startswith("/watch") or raw_url.startswith("watch?v="):
        raw_url = "https://www.youtube.com" + (raw_url if raw_url.startswith("/") else "/" + raw_url)

    parsed = urlparse(raw_url)
    host = parsed.netloc.lower().replace("www.", "")

    video_id = ""
    if host == "youtu.be":
        video_id = parsed.path.strip("/")
    elif host in {"youtube.com", "m.youtube.com", "youtube-nocookie.com"} or not host:
        path_parts = [part for part in parsed.path.split("/") if part]
        if parsed.path.startswith("/watch"):
            video_id = parse_qs(parsed.query).get("v", [""])[0]
        elif path_parts and path_parts[0] in {"embed", "v", "live"} and len(path_parts) > 1:
            video_id = path_parts[1]

    if video_id:
        return f"https://www.youtube.com/watch?v={video_id}"

    return raw_url


def _pick_non_shorts_youtube_url(raw_result: Any) -> str:
    candidates = _extract_youtube_candidates(raw_result)
    for candidate in candidates:
        normalized = _normalize_youtube_watch_url(candidate)
        # Ensure it's a real video URL and not a search page
        if "watch?v=" in normalized and not _is_youtube_shorts_url(normalized):
            return normalized
    return ""


def _clean_json_text(raw_text: str) -> str:
    text = str(raw_text or "").strip()
    
    # Try to find JSON block using regex if wrapped in conversational text
    json_match = re.search(r"\{[\s\S]*\}", text)
    if json_match:
        text = json_match.group(0).strip()
    else:
        # Strip markdown code blocks if regex didn't match (fallback)
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?", "", text).strip()
        if text.endswith("```"):
            text = text[:-3].strip()
            
    # Escape invalid backslashes (like LaTeX '\mathbb')
    text = re.sub(r'\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})', r'\\\\', text)
    return text


class SkillPathwayService:
    def __init__(self, db_client):
        self.db = db_client

    async def generate_stage_resources(self, student_id: str, pathway_id: str, stage_index: int) -> Dict:
        """
        Generates 5 videos and 5 articles based on the stage's resource_generation_prompt.
        Validates regeneration limits and updates StudentPathwayProgress.
        """
        # 1. Fetch Blueprint & Student Progress
        pathway = self.db.global_learning_pathways.find_one({"_id": pathway_id})
        student_progress = self.db.student_pathway_progress.find_one({"student_id": student_id, "pathway_id": pathway_id})
        
        if not pathway:
            return {"status": "error", "message": "Pathway not found."}
            
        stage_blueprint = next((s for s in pathway.get("stages", []) if s["stage_index"] == stage_index), None)
        if not stage_blueprint:
            return {"status": "error", "message": "Stage not found in pathway."}

        # Initialize stage progress if not exists
        if not student_progress:
            # Create fresh progress document
            student_progress = {
                "student_id": student_id,
                "pathway_id": pathway_id,
                "current_streak": 0,
                "total_score": 0,
                "earned_badges": [],
                "stage_progress": [{"stage_index": s["stage_index"], "status": "locked", "regenerations_used": 0, "resources": [], "project_completed": False} for s in pathway.get("stages", [])],
                "created_at": None # let mongo do it
            }
            # Unlock the first stage
            if student_progress["stage_progress"]:
                student_progress["stage_progress"][0]["status"] = "in-progress"
                
            self.db.student_pathway_progress.insert_one(student_progress)
            
        stage_tracker = next((s for s in student_progress.get("stage_progress", []) if s["stage_index"] == stage_index), None)
        
        if not stage_tracker:
            return {"status": "error", "message": "Stage progress not tracked."}

        # 2. Check Regeneration Limits
        if stage_tracker["regenerations_used"] >= stage_blueprint.get("max_regenerations", 3):
            return {"status": "error", "message": "Max regenerations reached for this stage."}

        # 3. Format Target Topics for the Prompt
        topic_context = "\n".join([f"- {t['name']}: {', '.join(t['subtopics'])}" for t in stage_blueprint.get("topics", [])])

        # 4. Construct the LLM Prompt
        prompt = f"""
        You are an expert AI curriculum generator for a completely student-driven environment.
        The student is studying {pathway['title']} - {stage_blueprint['title']}.

        Core Topics to cover:
        {topic_context}
        
        Base Instructions: {stage_blueprint['resource_generation_prompt']}

        Task: Select EXACTLY 5 high-quality YouTube video concepts and 5 article concepts that cover these specific subtopics perfectly.
        Return ONLY valid JSON in this exact structure:
        {{
            "videos": [{{"title": "...", "search_query": "..."}}],
            "articles": [{{"title": "...", "search_query": "..."}}]
        }}
        """

        # 5. Generate via LLM
        generated_data = None
        try:
            raw_response = await generate_text_async(
                prompt_or_messages=[{"role": "user", "content": prompt}],
                generation_config={"temperature": 0.3, "max_tokens": 8000},
                timeout=60
            )
            cleaned_json = _clean_json_text(raw_response)
            generated_data = json.loads(cleaned_json)
        except Exception as e:
            print(f"LLM generation failed, using fallback: {e}")
            # Fallback: Generate basic search queries from the blueprint topics
            fallback_videos = []
            fallback_articles = []
            for topic in stage_blueprint.get("topics", [])[:3]:
                topic_name = topic.get("name", "Topic")
                fallback_videos.append({"title": f"Introduction to {topic_name}", "search_query": f"{topic_name} tutorial for beginners"})
                fallback_articles.append({"title": f"Mastering {topic_name}", "search_query": f"{topic_name} comprehensive guide"})
            
            generated_data = {
                "videos": fallback_videos,
                "articles": fallback_articles
            }
        
        # 6. Parse and Call YouTube/DeepSearch APIs
        final_resources = []

        # Use module-level singletons (created once, not per-call)
        yt_tool = _get_yt_tool()
        tavily_tool = _get_tavily_tool()

        for v in generated_data.get("videos", [])[:5]:
            search_query = str(v.get("search_query") or v.get("title") or "").strip()
            url = f"https://www.youtube.com/results?search_query={quote_plus(search_query)}"

            if yt_tool:
                try:
                    # Ask for multiple candidates and choose the first non-shorts URL.
                    sanitized_query = re.sub(r"\s+", " ", search_query.replace(",", " ")).strip()
                    tool_result = yt_tool.run(f"{sanitized_query} tutorial,5")
                    selected_url = _pick_non_shorts_youtube_url(tool_result)

                    if not selected_url:
                        long_form_result = yt_tool.run(f"{sanitized_query} full tutorial long form,5")
                        selected_url = _pick_non_shorts_youtube_url(long_form_result)

                    if selected_url:
                        url = selected_url
                except Exception as e:
                    print(f"YT tool failed: {e}")

            final_resources.append({
                "resource_id": str(uuid.uuid4()),
                "type": "video",
                "title": v.get("title") or "YouTube Lesson",
                "url": url,
                "tests_taken": 0,
                "passed_tests_count": 0,
            })
            
        for a in generated_data.get("articles", [])[:5]:
            url = f"https://google.com/search?q={quote_plus(a['search_query'])}"
            if tavily_tool:
                try:
                    res_docs = tavily_tool.run(f"{a['search_query']} comprehensive guide tutorial")
                    if res_docs and isinstance(res_docs, list) and len(res_docs) > 0:
                        # Grab the URL of the first returned document
                        url = res_docs[0].get("url", url)
                except Exception as e:
                    print(f"Tavily tool failed: {e}")
            final_resources.append({"resource_id": str(uuid.uuid4()), "type": "article", "title": a["title"], "url": url, "tests_taken": 0, "passed_tests_count": 0})

        # 7. Save to DB
        self.db.student_pathway_progress.update_one(
            {"student_id": student_id, "pathway_id": pathway_id, "stage_progress.stage_index": stage_index},
            {
                "$set": {"stage_progress.$.resources": final_resources},
                "$inc": {"stage_progress.$.regenerations_used": 1}
            }
        )
        return {"status": "success", "resources": final_resources}

    async def generate_tests_for_resource(self, pathway_id: str, stage_index: int, resource_title: str) -> Dict:
        """
        Generates the 2 mandatory tests for a Specific Resource, ensuring it perfectly matches the subtopics.
        """
        pathway = self.db.global_learning_pathways.find_one({"_id": pathway_id})
        if not pathway:
            return {"status": "error", "message": "Pathway not found"}
            
        stage_blueprint = next((s for s in pathway.get("stages", []) if s["stage_index"] == stage_index), None)
        if not stage_blueprint:
            return {"status": "error", "message": "Stage not found"}
        
        # Ensure deep targeting by reminding the LLM of the specific resource and the overall stage goals.
        prompt = f"""
        You are evaluating a student's comprehension of '{resource_title}'.
        This resource belongs to the pathway stage '{stage_blueprint['title']}'.
        
        Teacher's Quiz Guidelines: {stage_blueprint['quiz_generation_prompt']}
        
        Task: Generate EXACTLY 2 distinct, highly rigorous multiple-choice assessments (tests) covering the core concepts of this resource.
        Each test must have 5 questions. The student must score 80% (4/5) to pass.
        
        Return ONLY valid JSON:
        {{
           "test_1": {{ "questions": [ {{"q": "...", "options": ["A", "B", "C", "D"], "answer": "..."}} ] }},
           "test_2": {{ "questions": [ {{"q": "...", "options": ["A", "B", "C", "D"], "answer": "..."}} ] }}
        }}
        """
        
        try:
            raw_response = await generate_text_async(
                prompt_or_messages=[{"role": "user", "content": prompt}],
                generation_config={"temperature": 0.2, "max_tokens": 16000}
            )
            cleaned_json = _clean_json_text(raw_response)
            return {"status": "success", "tests": json.loads(cleaned_json)}
        except Exception as e:
            print(f"FAILED TO PARSE TEST GENERATION JSON: {e}")
            try:
                print(f"RAW LLM RESPONSE:\n{raw_response}")
                print(f"CLEANED JSON:\n{cleaned_json}")
            except Exception:
                pass
            return {"status": "error", "message": f"Failed to generate tests: {str(e)}"}
